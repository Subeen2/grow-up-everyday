# 일본어 학습 서비스 (음성인식 챌린지) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Japanese learning track (language toggle EN/JA, daily auto-generated Japanese word, and a speech-recognition example-sentence challenge) that mirrors the existing English word-of-the-day flow.

**Architecture:** Extract the existing `TodayPage` state machine into a generic `useWordOfDayState` hook shared by English and Japanese; generalize `wordData.ts` fetch logic into a `createWordApi(basePath)` factory reused by a new `jaWordData.ts`; add Japanese-specific presentation components (`JaWordCard`, `VoiceChallenge`) and pages (`JaTodayPage`, `JaArchivePage`); add a language toggle to `App.tsx`; mirror the existing OpenAI word-generation script for Japanese and hook it into the existing daily GitHub Actions workflow.

**Tech Stack:** React 18 + TypeScript (Vite), Vitest + Testing Library, browser-native Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`, no new dependency), Node scripts + OpenAI SDK (already a dependency) for daily content generation, GitHub Actions.

## Global Constraints

- Languages are fixed to English and Japanese only — do not build a generic N-language plugin architecture (spec §2.5, YAGNI).
- No new npm dependencies. Voice recognition uses only the browser-native Web Speech API (spec §2.3).
- Unsupported browsers (no `SpeechRecognition`) show a guidance message only — no typing fallback is provided (spec §2.3, §2.5).
- Japanese data file paths are fixed: `public/data/ja/words/{date}.json` and `public/data/ja/archive-index.json` (spec §3.3).
- Japanese generation is added as a second step inside the existing `.github/workflows/generate-word.yml` — do not create a separate workflow file (spec §5.4).
- Existing English behavior must not change. Where an existing function's signature must change (adding a `namespace` argument), update its call sites and tests mechanically, but do not alter its externally observable behavior for the `'en'` namespace.
- Follow existing code patterns exactly (component structure, test structure, CSS class naming, Korean UI copy) — this codebase has one established style per file type; match it rather than introducing a new one.

---

### Task 1: Generalize `wordData.ts` into a reusable factory and add the Japanese data module

**Files:**
- Modify: `src/lib/wordTypes.ts`
- Modify: `src/lib/wordData.ts`
- Modify: `src/lib/wordData.test.ts`
- Create: `src/lib/jaWordData.ts`
- Create: `src/lib/jaWordData.test.ts`

**Interfaces:**
- Consumes: nothing new (pure refactor of existing fetch logic).
- Produces: `createWordApi<TEntry extends {date:string}, TIndexItem extends {date:string}>(basePath: string): { fetchWordByDate(date: string): Promise<TEntry|null>; fetchArchiveIndex(): Promise<TIndexItem[]>; fetchTodayWord(): Promise<TEntry> }` exported from `src/lib/wordData.ts`. `JaWordEntry` and `JaArchiveIndexItem` types exported from `src/lib/wordTypes.ts`. `fetchWordByDate`, `fetchArchiveIndex`, `fetchTodayWord` exported from `src/lib/jaWordData.ts` with the same shapes as the existing English ones, but typed to `JaWordEntry`/`JaArchiveIndexItem` and pointed at `data/ja`.

- [ ] **Step 1: Add the Japanese types**

Add to `src/lib/wordTypes.ts` (keep the existing `WordEntry`/`ArchiveIndexItem` untouched, append below them):

```ts
export interface JaWordEntry {
  date: string; // YYYY-MM-DD
  word: string; // 한자 표기 단어, 예: 大丈夫
  reading: string; // 단어 훈리가나, 예: だいじょうぶ
  meaningKo: string;
  exampleJa: string; // 한자+가나 예문
  exampleReading: string; // exampleJa 전체를 히라가나로 읽은 것 (음성 매칭용)
  exampleKo: string;
}

export interface JaArchiveIndexItem {
  date: string; // YYYY-MM-DD
  word: string;
  meaningKo: string;
}
```

- [ ] **Step 2: Write the failing test for `createWordApi`**

Add to `src/lib/wordData.test.ts` (add the import and the new `describe` block; keep every existing `describe` block in the file untouched):

```ts
import { getLocalDateString, fetchWordByDate, fetchArchiveIndex, fetchTodayWord, createWordApi } from './wordData';
```

```ts
describe('createWordApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches a word from the given basePath', async () => {
    const api = createWordApi<{ date: string }, { date: string }>('data/ja');
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ date: '2026-08-04' }) });

    await api.fetchWordByDate('2026-08-04');

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('data/ja/words/2026-08-04.json'));
  });

  it('fetches the archive index from the given basePath', async () => {
    const api = createWordApi<{ date: string }, { date: string }>('data/ja');
    (fetch as any).mockResolvedValue({ ok: true, json: async () => [] });

    await api.fetchArchiveIndex();

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('data/ja/archive-index.json'));
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- wordData.test.ts`
Expected: FAIL — `createWordApi` is not exported from `./wordData`.

- [ ] **Step 4: Refactor `wordData.ts` to expose `createWordApi` and re-export the English API from it**

Replace the full contents of `src/lib/wordData.ts` with:

```ts
import { ArchiveIndexItem, WordEntry } from './wordTypes';

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createWordApi<TEntry extends { date: string }, TIndexItem extends { date: string }>(
  basePath: string
) {
  async function fetchWordByDate(date: string): Promise<TEntry | null> {
    const res = await fetch(`${import.meta.env.BASE_URL}${basePath}/words/${date}.json`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to fetch word for ${date}: ${res.status}`);
    return (await res.json()) as TEntry;
  }

  async function fetchArchiveIndex(): Promise<TIndexItem[]> {
    const res = await fetch(`${import.meta.env.BASE_URL}${basePath}/archive-index.json`);
    if (!res.ok) throw new Error(`Failed to fetch archive index: ${res.status}`);
    const items = (await res.json()) as TIndexItem[];
    return [...items].sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  async function fetchTodayWord(): Promise<TEntry> {
    const today = getLocalDateString();
    const todayEntry = await fetchWordByDate(today);
    if (todayEntry) return todayEntry;

    const archive = await fetchArchiveIndex();
    if (archive.length === 0) {
      throw new Error('No word data available yet');
    }

    const latest = await fetchWordByDate(archive[0].date);
    if (!latest) {
      throw new Error(`Archive index references missing file for ${archive[0].date}`);
    }
    return latest;
  }

  return { fetchWordByDate, fetchArchiveIndex, fetchTodayWord };
}

const enApi = createWordApi<WordEntry, ArchiveIndexItem>('data');

export const fetchWordByDate = enApi.fetchWordByDate;
export const fetchArchiveIndex = enApi.fetchArchiveIndex;
export const fetchTodayWord = enApi.fetchTodayWord;
```

- [ ] **Step 5: Run the tests to verify everything passes**

Run: `npm test -- wordData.test.ts`
Expected: PASS — all existing `fetchWordByDate`/`fetchArchiveIndex`/`fetchTodayWord` tests plus the two new `createWordApi` tests.

- [ ] **Step 6: Write the failing test for `jaWordData.ts`**

Create `src/lib/jaWordData.test.ts`:

```ts
import { getLocalDateString } from './wordData';
import { fetchWordByDate, fetchArchiveIndex, fetchTodayWord } from './jaWordData';

describe('jaWordData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  const sample = {
    date: '2026-08-04',
    word: '大丈夫',
    reading: 'だいじょうぶ',
    meaningKo: '괜찮아',
    exampleJa: '今日は大丈夫です。',
    exampleReading: 'きょうはだいじょうぶです',
    exampleKo: '오늘은 괜찮아요.',
  };

  it('fetchWordByDate reads from the ja data path', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => sample });

    const result = await fetchWordByDate('2026-08-04');

    expect(result).toEqual(sample);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('data/ja/words/2026-08-04.json'));
  });

  it('fetchArchiveIndex reads from the ja archive index path', async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => [] });

    await fetchArchiveIndex();

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('data/ja/archive-index.json'));
  });

  it("fetchTodayWord returns today's ja entry when it exists", async () => {
    const todayStr = getLocalDateString();
    const entry = { ...sample, date: todayStr };
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => entry });

    expect(await fetchTodayWord()).toEqual(entry);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm test -- jaWordData.test.ts`
Expected: FAIL — cannot find module `./jaWordData`.

- [ ] **Step 8: Create `src/lib/jaWordData.ts`**

```ts
import { createWordApi } from './wordData';
import { JaArchiveIndexItem, JaWordEntry } from './wordTypes';

const jaApi = createWordApi<JaWordEntry, JaArchiveIndexItem>('data/ja');

export const fetchWordByDate = jaApi.fetchWordByDate;
export const fetchArchiveIndex = jaApi.fetchArchiveIndex;
export const fetchTodayWord = jaApi.fetchTodayWord;
```

- [ ] **Step 9: Run the tests to verify everything passes**

Run: `npm test -- wordData.test.ts jaWordData.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/lib/wordTypes.ts src/lib/wordData.ts src/lib/wordData.test.ts src/lib/jaWordData.ts src/lib/jaWordData.test.ts
git commit -m "feat: generalize word data fetching and add Japanese data module"
```

---

### Task 2: Namespace `browsingState.ts`/`reminder.ts` and extract the shared `useWordOfDayState` hook

This task is a behavior-preserving refactor: `TodayPage.tsx`'s existing state machine moves into a reusable hook, and the two localStorage-backed helper modules gain a required `namespace` argument so English and Japanese don't collide. All existing `TodayPage` tests must pass unchanged in what they assert (only mock/setup lines that call the changed functions get an added `'en'` argument).

**Files:**
- Modify: `src/lib/browsingState.ts`
- Modify: `src/lib/browsingState.test.ts`
- Modify: `src/lib/reminder.ts`
- Modify: `src/lib/reminder.test.ts`
- Modify: `src/lib/typingChallenge.ts`
- Create: `src/lib/useWordOfDayState.ts`
- Modify: `src/pages/TodayPage.tsx`
- Modify: `src/pages/TodayPage.test.tsx`

**Interfaces:**
- Consumes: `WordEntry`, `ArchiveIndexItem` from `./wordTypes` (Task 1); `fetchTodayWord`, `fetchArchiveIndex`, `fetchWordByDate` from `./wordData` (Task 1, unchanged names).
- Produces: `useWordOfDayState<TEntry extends {date:string}, TIndexItem extends {date:string}>(api: {fetchTodayWord(): Promise<TEntry>; fetchArchiveIndex(): Promise<TIndexItem[]>; fetchWordByDate(date: string): Promise<TEntry|null>}, namespace: string)` returning `{ state, celebrating, setCelebrating, showChallenge, handleChallengeSuccess, handleBackToToday }` from `src/lib/useWordOfDayState.ts`, where `state` has the same shape as today's `TodayPage` `State` type (`{status:'loading'} | {status:'error', message} | {status:'ready', todayEntry, displayedEntry, archivePool, isNew, challengeVisible}`). `pickRandomOtherWord<T extends {date:string}>(archiveIndex: T[], excludeDate: string): T | null` from `src/lib/typingChallenge.ts` (now generic; Task 7/8 reuse it for Japanese). This hook is consumed directly by `JaTodayPage` in Task 7 — its return shape must not change after this task.

- [ ] **Step 1: Update `browsingState.test.ts` for the namespaced signature**

Replace the full contents of `src/lib/browsingState.test.ts`:

```ts
import { getPersistedDisplayedWordDate, setPersistedDisplayedWordDate } from './browsingState';

describe('browsingState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing stored', () => {
    expect(getPersistedDisplayedWordDate('2026-07-23', 'en')).toBeNull();
  });

  it('returns the stored date when it was recorded on the same "today"', () => {
    setPersistedDisplayedWordDate('2026-07-20', '2026-07-23', 'en');
    expect(getPersistedDisplayedWordDate('2026-07-23', 'en')).toBe('2026-07-20');
  });

  it('overwrites the previously stored date', () => {
    setPersistedDisplayedWordDate('2026-07-20', '2026-07-23', 'en');
    setPersistedDisplayedWordDate('2026-07-22', '2026-07-23', 'en');
    expect(getPersistedDisplayedWordDate('2026-07-23', 'en')).toBe('2026-07-22');
  });

  it('returns null once a new day has started, even if a date is still stored', () => {
    setPersistedDisplayedWordDate('2026-07-20', '2026-07-23', 'en');
    expect(getPersistedDisplayedWordDate('2026-07-24', 'en')).toBeNull();
  });

  it('keeps English and Japanese namespaces independent', () => {
    setPersistedDisplayedWordDate('2026-07-20', '2026-07-23', 'en');
    setPersistedDisplayedWordDate('2026-07-21', '2026-07-23', 'ja');

    expect(getPersistedDisplayedWordDate('2026-07-23', 'en')).toBe('2026-07-20');
    expect(getPersistedDisplayedWordDate('2026-07-23', 'ja')).toBe('2026-07-21');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- browsingState.test.ts`
Expected: FAIL — too many arguments / stored value not namespaced yet.

- [ ] **Step 3: Update `browsingState.ts`**

Replace the full contents of `src/lib/browsingState.ts`:

```ts
const DISPLAYED_WORD_DATE_KEY = 'displayedWordDate';
const DISPLAYED_WORD_AS_OF_TODAY_KEY = 'displayedWordAsOfToday';

export function getPersistedDisplayedWordDate(today: string, namespace: string): string | null {
  const asOfToday = localStorage.getItem(`${DISPLAYED_WORD_AS_OF_TODAY_KEY}:${namespace}`);
  if (asOfToday !== today) return null;
  return localStorage.getItem(`${DISPLAYED_WORD_DATE_KEY}:${namespace}`);
}

export function setPersistedDisplayedWordDate(date: string, today: string, namespace: string): void {
  localStorage.setItem(`${DISPLAYED_WORD_DATE_KEY}:${namespace}`, date);
  localStorage.setItem(`${DISPLAYED_WORD_AS_OF_TODAY_KEY}:${namespace}`, today);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- browsingState.test.ts`
Expected: PASS

- [ ] **Step 5: Update `reminder.test.ts` for the namespaced signature**

Replace the full contents of `src/lib/reminder.test.ts`:

```ts
import { getLastViewedDate, setLastViewedDate, isNewDaySinceLastView } from './reminder';

describe('reminder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing stored', () => {
    expect(getLastViewedDate('en')).toBeNull();
  });

  it('stores and retrieves the last viewed date', () => {
    setLastViewedDate('2026-07-23', 'en');
    expect(getLastViewedDate('en')).toBe('2026-07-23');
  });

  it('is a new day when nothing was stored before', () => {
    expect(isNewDaySinceLastView('2026-07-23', 'en')).toBe(true);
  });

  it('is not a new day when the same date was already viewed', () => {
    setLastViewedDate('2026-07-23', 'en');
    expect(isNewDaySinceLastView('2026-07-23', 'en')).toBe(false);
  });

  it('is a new day when a different date was last viewed', () => {
    setLastViewedDate('2026-07-22', 'en');
    expect(isNewDaySinceLastView('2026-07-23', 'en')).toBe(true);
  });

  it('keeps English and Japanese namespaces independent', () => {
    setLastViewedDate('2026-07-23', 'en');
    expect(isNewDaySinceLastView('2026-07-23', 'ja')).toBe(true);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- reminder.test.ts`
Expected: FAIL

- [ ] **Step 7: Update `reminder.ts`**

Replace the top of `src/lib/reminder.ts` (keep `requestNotificationPermissionAndSync` exactly as-is below it):

```ts
const LAST_VIEWED_KEY = 'lastViewedDate';

export function getLastViewedDate(namespace: string): string | null {
  return localStorage.getItem(`${LAST_VIEWED_KEY}:${namespace}`);
}

export function setLastViewedDate(date: string, namespace: string): void {
  localStorage.setItem(`${LAST_VIEWED_KEY}:${namespace}`, date);
}

export function isNewDaySinceLastView(today: string, namespace: string): boolean {
  return getLastViewedDate(namespace) !== today;
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- reminder.test.ts`
Expected: PASS

- [ ] **Step 9: Make `pickRandomOtherWord` generic**

In `src/lib/typingChallenge.ts`, replace the `pickRandomOtherWord` function (keep `normalizeForComparison`/`isCorrectAnswer` and the `ArchiveIndexItem` import as-is, remove the import if it becomes unused — it stays used by nothing else in the file, so remove `import { ArchiveIndexItem } from './wordTypes';` and the type annotation):

```ts
export function pickRandomOtherWord<T extends { date: string }>(archiveIndex: T[], excludeDate: string): T | null {
  const candidates = archiveIndex.filter((item) => item.date !== excludeDate);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
```

- [ ] **Step 10: Run the existing typing challenge tests to confirm no regression**

Run: `npm test -- typingChallenge.test.ts`
Expected: PASS (unchanged assertions, generic type is inferred)

- [ ] **Step 11: Create `src/lib/useWordOfDayState.ts`**

```ts
import { useEffect, useState } from 'react';
import { isNewDaySinceLastView, setLastViewedDate } from './reminder';
import { getPersistedDisplayedWordDate, setPersistedDisplayedWordDate } from './browsingState';
import { pickRandomOtherWord } from './typingChallenge';

export interface WordOfDayApi<TEntry extends { date: string }, TIndexItem extends { date: string }> {
  fetchTodayWord(): Promise<TEntry>;
  fetchArchiveIndex(): Promise<TIndexItem[]>;
  fetchWordByDate(date: string): Promise<TEntry | null>;
}

export type WordOfDayState<TEntry, TIndexItem> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      todayEntry: TEntry;
      displayedEntry: TEntry;
      archivePool: TIndexItem[];
      isNew: boolean;
      challengeVisible: boolean;
    };

export function useWordOfDayState<TEntry extends { date: string }, TIndexItem extends { date: string }>(
  api: WordOfDayApi<TEntry, TIndexItem>,
  namespace: string
) {
  const [state, setState] = useState<WordOfDayState<TEntry, TIndexItem>>({ status: 'loading' });
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    api
      .fetchTodayWord()
      .then(async (entry) => {
        const isNew = isNewDaySinceLastView(entry.date, namespace);
        setLastViewedDate(entry.date, namespace);

        let archivePool: TIndexItem[] = [];
        try {
          archivePool = await api.fetchArchiveIndex();
        } catch (err) {
          console.warn('Failed to fetch archive index for the challenge pool:', err);
        }

        let displayedEntry = entry;
        const persistedDate = getPersistedDisplayedWordDate(entry.date, namespace);
        if (persistedDate && persistedDate !== entry.date) {
          try {
            const persistedEntry = await api.fetchWordByDate(persistedDate);
            if (persistedEntry) {
              displayedEntry = persistedEntry;
            }
          } catch (err) {
            console.warn(`Failed to resume previously displayed word for ${persistedDate}:`, err);
          }
        }

        setState({
          status: 'ready',
          todayEntry: entry,
          displayedEntry,
          archivePool,
          isNew,
          challengeVisible: false,
        });
      })
      .catch((err: Error) => setState({ status: 'error', message: err.message }));
    // Intentionally runs once on mount only, matching the original TodayPage effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showChallenge() {
    if (state.status !== 'ready') return;
    setState({ ...state, challengeVisible: true });
  }

  async function handleChallengeSuccess() {
    if (state.status !== 'ready') return;
    const next = pickRandomOtherWord(state.archivePool, state.displayedEntry.date);
    if (!next) return;

    let entry: TEntry | null;
    try {
      entry = await api.fetchWordByDate(next.date);
    } catch (err) {
      console.warn(`Failed to fetch word for ${next.date}:`, err);
      return;
    }
    if (!entry) {
      console.warn(`Archive index references missing file for ${next.date}`);
      return;
    }
    setState({ ...state, displayedEntry: entry, challengeVisible: false });
    setPersistedDisplayedWordDate(entry.date, state.todayEntry.date, namespace);
    setCelebrating(true);
  }

  function handleBackToToday() {
    if (state.status !== 'ready') return;
    setState({ ...state, displayedEntry: state.todayEntry, challengeVisible: false });
    setPersistedDisplayedWordDate(state.todayEntry.date, state.todayEntry.date, namespace);
  }

  return { state, celebrating, setCelebrating, showChallenge, handleChallengeSuccess, handleBackToToday };
}
```

- [ ] **Step 12: Refactor `TodayPage.tsx` to use the hook**

Replace the full contents of `src/pages/TodayPage.tsx`:

```tsx
import { fetchTodayWord, fetchArchiveIndex, fetchWordByDate } from '../lib/wordData';
import { useWordOfDayState } from '../lib/useWordOfDayState';
import { WordCard } from '../components/WordCard';
import { PixelButton } from '../components/PixelButton';
import { TypingChallenge } from '../components/TypingChallenge';
import { Celebration } from '../components/Celebration';

export function TodayPage() {
  const { state, celebrating, setCelebrating, showChallenge, handleChallengeSuccess, handleBackToToday } =
    useWordOfDayState({ fetchTodayWord, fetchArchiveIndex, fetchWordByDate }, 'en');

  if (state.status === 'loading') return <p>불러오는 중...</p>;
  if (state.status === 'error') return <p>오류: {state.message}</p>;

  const { todayEntry, displayedEntry, archivePool, isNew, challengeVisible } = state;
  const hasOtherWord = archivePool.some((item) => item.date !== displayedEntry.date);
  const isShowingToday = displayedEntry.date === todayEntry.date;

  return (
    <div>
      {isNew && isShowingToday && <span className="new-badge">NEW</span>}
      <WordCard entry={displayedEntry} hideExampleEn={challengeVisible} />
      {!isShowingToday && <PixelButton onClick={handleBackToToday}>오늘의 단어로</PixelButton>}
      {!challengeVisible && (
        <>
          <PixelButton onClick={showChallenge} disabled={!hasOtherWord}>
            다른 단어 보기
          </PixelButton>
          {!hasOtherWord && <p className="typing-challenge__empty">아직 연습할 다른 단어가 없어요</p>}
        </>
      )}
      {challengeVisible && (
        <TypingChallenge targetSentence={displayedEntry.exampleEn} onSuccess={handleChallengeSuccess} />
      )}
      {celebrating && <Celebration onDone={() => setCelebrating(false)} />}
    </div>
  );
}
```

- [ ] **Step 13: Update the two namespaced calls in `TodayPage.test.tsx`**

In `src/pages/TodayPage.test.tsx`, update the two `setPersistedDisplayedWordDate` calls to pass the `'en'` namespace (all other lines in the file stay exactly as they are):

```ts
setPersistedDisplayedWordDate('2026-07-20', '2026-07-23', 'en');
```

(There are two occurrences — one in "resumes showing the previously displayed word..." with args `('2026-07-20', '2026-07-23')`, one in "ignores a stale persisted word..." with args `('2026-07-20', '2026-07-22')`. Add `'en'` as the third argument to both, keeping their existing first two arguments unchanged.)

- [ ] **Step 14: Run the full existing page/hook test suite**

Run: `npm test -- TodayPage.test.tsx browsingState.test.ts reminder.test.ts typingChallenge.test.ts App.test.tsx`
Expected: PASS — every existing assertion still holds (this is a pure refactor).

- [ ] **Step 15: Commit**

```bash
git add src/lib/browsingState.ts src/lib/browsingState.test.ts src/lib/reminder.ts src/lib/reminder.test.ts src/lib/typingChallenge.ts src/lib/useWordOfDayState.ts src/pages/TodayPage.tsx src/pages/TodayPage.test.tsx
git commit -m "refactor: namespace localStorage keys and extract shared word-of-day state hook"
```

---

### Task 3: Japanese voice-answer matching logic

**Files:**
- Create: `src/lib/voiceChallenge.ts`
- Create: `src/lib/voiceChallenge.test.ts`

**Interfaces:**
- Consumes: nothing (pure string logic).
- Produces: `normalizeJaForComparison(text: string): string` and `isCorrectJaAnswer(spoken: string, entry: { exampleJa: string; exampleReading: string }): boolean` from `src/lib/voiceChallenge.ts`. Consumed by `VoiceChallenge.tsx` in Task 4.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/voiceChallenge.test.ts`:

```ts
import { normalizeJaForComparison, isCorrectJaAnswer } from './voiceChallenge';

describe('normalizeJaForComparison', () => {
  it('converts full-width katakana to hiragana', () => {
    expect(normalizeJaForComparison('キョウ')).toBe('きょう');
  });

  it('strips punctuation and whitespace', () => {
    expect(normalizeJaForComparison('今日は、大丈夫です。')).toBe('今日は大丈夫です');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeJaForComparison('  だいじょうぶ  ')).toBe('だいじょうぶ');
  });
});

describe('isCorrectJaAnswer', () => {
  const entry = {
    exampleJa: '今日は大丈夫です。',
    exampleReading: 'きょうはだいじょうぶです',
  };

  it('accepts a spoken transcript matching the kanji example', () => {
    expect(isCorrectJaAnswer('今日は大丈夫です。', entry)).toBe(true);
  });

  it('accepts a spoken transcript matching the hiragana reading', () => {
    expect(isCorrectJaAnswer('きょうはだいじょうぶです', entry)).toBe(true);
  });

  it('rejects a mismatched transcript', () => {
    expect(isCorrectJaAnswer('明日は大丈夫です。', entry)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- voiceChallenge.test.ts`
Expected: FAIL — cannot find module `./voiceChallenge`.

- [ ] **Step 3: Implement `src/lib/voiceChallenge.ts`**

```ts
const PUNCTUATION_AND_SPACE = /[\s。、！？!?.,]/g;

export function normalizeJaForComparison(text: string): string {
  return text
    .trim()
    .replace(PUNCTUATION_AND_SPACE, '')
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

// ponytail: accepts the kanji form or the pure-hiragana reading, but not other
// valid orthographic variants (different kanji for the same word, okurigana
// differences). Upgrade path if false negatives become common: run recognized
// text through a morphological reading converter (e.g. kuromoji) before compare.
export function isCorrectJaAnswer(spoken: string, entry: { exampleJa: string; exampleReading: string }): boolean {
  const normalizedSpoken = normalizeJaForComparison(spoken);
  return (
    normalizedSpoken === normalizeJaForComparison(entry.exampleJa) ||
    normalizedSpoken === normalizeJaForComparison(entry.exampleReading)
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- voiceChallenge.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/voiceChallenge.ts src/lib/voiceChallenge.test.ts
git commit -m "feat: add Japanese speech-answer normalization and matching"
```

---

### Task 4: `JaWordCard` component

**Files:**
- Create: `src/components/JaWordCard.tsx`
- Create: `src/components/JaWordCard.test.tsx`

**Interfaces:**
- Consumes: `JaWordEntry` from `../lib/wordTypes` (Task 1).
- Produces: `JaWordCard({ entry: JaWordEntry; hideExampleJa?: boolean })` React component from `src/components/JaWordCard.tsx`. Consumed by `JaTodayPage`/`JaArchivePage` (Tasks 7-8).

- [ ] **Step 1: Write the failing test**

Create `src/components/JaWordCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { JaWordCard } from './JaWordCard';

const sampleEntry = {
  date: '2026-08-04',
  word: '大丈夫',
  reading: 'だいじょうぶ',
  meaningKo: '괜찮아, 문제없어',
  exampleJa: '今日は大丈夫です。',
  exampleReading: 'きょうはだいじょうぶです',
  exampleKo: '오늘은 괜찮아요.',
};

describe('JaWordCard', () => {
  it('renders all fields of the entry', () => {
    render(<JaWordCard entry={sampleEntry} />);
    expect(screen.getByText('大丈夫')).toBeInTheDocument();
    expect(screen.getByText('[だいじょうぶ]')).toBeInTheDocument();
    expect(screen.getByText('괜찮아, 문제없어')).toBeInTheDocument();
    expect(screen.getByText('今日は大丈夫です。')).toBeInTheDocument();
    expect(screen.getByText('오늘은 괜찮아요.')).toBeInTheDocument();
  });

  it('hides only the Japanese example when hideExampleJa is true, keeping the Korean translation as a hint', () => {
    render(<JaWordCard entry={sampleEntry} hideExampleJa />);
    expect(screen.getByText('大丈夫')).toBeInTheDocument();
    expect(screen.queryByText('今日は大丈夫です。')).not.toBeInTheDocument();
    expect(screen.getByText('오늘은 괜찮아요.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- JaWordCard.test.tsx`
Expected: FAIL — cannot find module `./JaWordCard`.

- [ ] **Step 3: Implement `src/components/JaWordCard.tsx`**

```tsx
import { JaWordEntry } from '../lib/wordTypes';

interface JaWordCardProps {
  entry: JaWordEntry;
  hideExampleJa?: boolean;
}

export function JaWordCard({ entry, hideExampleJa }: JaWordCardProps) {
  return (
    <div className="word-card">
      <p className="word-card__date">{entry.date}</p>
      <h2 className="word-card__word">{entry.word}</h2>
      <p className="word-card__pronunciation">[{entry.reading}]</p>
      <p className="word-card__meaning">{entry.meaningKo}</p>
      {!hideExampleJa && <p className="word-card__example-en">{entry.exampleJa}</p>}
      <p className="word-card__example-ko">{entry.exampleKo}</p>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- JaWordCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/JaWordCard.tsx src/components/JaWordCard.test.tsx
git commit -m "feat: add JaWordCard component"
```

---

### Task 5: `VoiceChallenge` component

**Files:**
- Create: `src/components/VoiceChallenge.tsx`
- Create: `src/components/VoiceChallenge.test.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `isCorrectJaAnswer` from `../lib/voiceChallenge` (Task 3).
- Produces: `VoiceChallenge({ targetEntry: { exampleJa: string; exampleReading: string }; onSuccess: () => void })` React component from `src/components/VoiceChallenge.tsx`. Consumed by `JaTodayPage` (Task 7) exactly like `TypingChallenge` is consumed by `TodayPage`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/VoiceChallenge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceChallenge } from './VoiceChallenge';

const targetEntry = {
  exampleJa: '今日は大丈夫です。',
  exampleReading: 'きょうはだいじょうぶです',
};

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: { results: { 0: { transcript: string } }[][] }) => void) | null = null;
  onerror: (() => void) | null = null;
  start() {
    FakeRecognition.instances.push(this);
  }
}

function resolveWithTranscript(text: string) {
  const instance = FakeRecognition.instances[FakeRecognition.instances.length - 1];
  instance.onresult?.({ results: [[{ transcript: text }]] } as any);
}

describe('VoiceChallenge', () => {
  afterEach(() => {
    delete (window as any).SpeechRecognition;
    FakeRecognition.instances = [];
  });

  it('shows an unsupported message when the browser has no SpeechRecognition', () => {
    render(<VoiceChallenge targetEntry={targetEntry} onSuccess={vi.fn()} />);
    expect(screen.getByText(/음성인식을 지원하지 않아요/)).toBeInTheDocument();
  });

  it('calls onSuccess when the recognized transcript matches the kanji example', async () => {
    (window as any).SpeechRecognition = FakeRecognition;
    const onSuccess = vi.fn();
    render(<VoiceChallenge targetEntry={targetEntry} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByText('🎤 말하기'));
    resolveWithTranscript('今日は大丈夫です。');

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('calls onSuccess when the recognized transcript matches the hiragana reading', async () => {
    (window as any).SpeechRecognition = FakeRecognition;
    const onSuccess = vi.fn();
    render(<VoiceChallenge targetEntry={targetEntry} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByText('🎤 말하기'));
    resolveWithTranscript('きょうはだいじょうぶです');

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('shows a comparison and does not call onSuccess when the transcript is wrong', async () => {
    (window as any).SpeechRecognition = FakeRecognition;
    const onSuccess = vi.fn();
    render(<VoiceChallenge targetEntry={targetEntry} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByText('🎤 말하기'));
    resolveWithTranscript('明日は大丈夫です。');

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText(/내가 말한 문장: 明日は大丈夫です。/)).toBeInTheDocument();
    expect(screen.getByText(/정답: 今日は大丈夫です。/)).toBeInTheDocument();
  });

  it('shows a retry message on a recognition error', async () => {
    class ErrorRecognition extends FakeRecognition {
      start() {
        this.onerror?.();
      }
    }
    (window as any).SpeechRecognition = ErrorRecognition;
    render(<VoiceChallenge targetEntry={targetEntry} onSuccess={vi.fn()} />);

    await userEvent.click(screen.getByText('🎤 말하기'));

    expect(screen.getByText('다시 시도해주세요')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- VoiceChallenge.test.tsx`
Expected: FAIL — cannot find module `./VoiceChallenge`.

- [ ] **Step 3: Implement `src/components/VoiceChallenge.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { isCorrectJaAnswer } from '../lib/voiceChallenge';
import { PixelButton } from './PixelButton';

interface VoiceChallengeTarget {
  exampleJa: string;
  exampleReading: string;
}

interface VoiceChallengeProps {
  targetEntry: VoiceChallengeTarget;
  onSuccess: () => void;
}

type ChallengeStatus =
  | { kind: 'idle' }
  | { kind: 'listening' }
  | { kind: 'incorrect'; submitted: string }
  | { kind: 'unsupported' }
  | { kind: 'error' };

function getSpeechRecognitionCtor(): (new () => any) | undefined {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

export function VoiceChallenge({ targetEntry, onSuccess }: VoiceChallengeProps) {
  const [status, setStatus] = useState<ChallengeStatus>({ kind: 'idle' });

  useEffect(() => {
    if (!getSpeechRecognitionCtor()) {
      setStatus({ kind: 'unsupported' });
    }
  }, []);

  function handleStart() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setStatus({ kind: 'unsupported' });
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript as string;
      if (isCorrectJaAnswer(transcript, targetEntry)) {
        onSuccess();
      } else {
        setStatus({ kind: 'incorrect', submitted: transcript });
      }
    };
    recognition.onerror = () => setStatus({ kind: 'error' });

    setStatus({ kind: 'listening' });
    recognition.start();
  }

  if (status.kind === 'unsupported') {
    return (
      <div className="voice-challenge">
        <p className="voice-challenge__unsupported">
          이 브라우저는 음성인식을 지원하지 않아요. Chrome/Edge로 접속해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="voice-challenge">
      <PixelButton onClick={handleStart} disabled={status.kind === 'listening'}>
        {status.kind === 'listening' ? '듣고 있어요...' : '🎤 말하기'}
      </PixelButton>
      {status.kind === 'error' && <p className="voice-challenge__error">다시 시도해주세요</p>}
      {status.kind === 'incorrect' && (
        <div className="voice-challenge__comparison">
          <p className="voice-challenge__submitted">내가 말한 문장: {status.submitted}</p>
          <p className="voice-challenge__target">정답: {targetEntry.exampleJa}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add styles to `src/styles/theme.css`**

Append at the end of `src/styles/theme.css`:

```css
.voice-challenge {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.voice-challenge__comparison {
  background: #fff;
  border: 2px solid var(--color-wood-dark);
  padding: 8px;
  text-align: left;
  font-size: 0.9rem;
}

.voice-challenge__submitted {
  color: #b23b3b;
}

.voice-challenge__target {
  color: var(--color-text);
}

.voice-challenge__unsupported {
  font-size: 0.85rem;
  color: var(--color-wood-dark);
}

.voice-challenge__error {
  font-size: 0.85rem;
  color: #b23b3b;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- VoiceChallenge.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/VoiceChallenge.tsx src/components/VoiceChallenge.test.tsx src/styles/theme.css
git commit -m "feat: add VoiceChallenge component using the Web Speech API"
```

---

### Task 6: `JaTodayPage`

**Files:**
- Create: `src/pages/JaTodayPage.tsx`
- Create: `src/pages/JaTodayPage.test.tsx`

**Interfaces:**
- Consumes: `fetchTodayWord`, `fetchArchiveIndex`, `fetchWordByDate` from `../lib/jaWordData` (Task 1); `useWordOfDayState` from `../lib/useWordOfDayState` (Task 2); `JaWordCard` (Task 4); `VoiceChallenge` (Task 5); `Celebration`/`PixelButton` (existing).
- Produces: `JaTodayPage()` React component from `src/pages/JaTodayPage.tsx`. Consumed by `App.tsx` (Task 8).

- [ ] **Step 1: Write the failing tests**

Create `src/pages/JaTodayPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JaTodayPage } from './JaTodayPage';
import * as jaWordData from '../lib/jaWordData';

const todayEntry = {
  date: '2026-08-04',
  word: '大丈夫',
  reading: 'だいじょうぶ',
  meaningKo: '괜찮아',
  exampleJa: '今日は大丈夫です。',
  exampleReading: 'きょうはだいじょうぶです',
  exampleKo: '오늘은 괜찮아요.',
};

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: { results: { 0: { transcript: string } }[][] }) => void) | null = null;
  onerror: (() => void) | null = null;
  start() {
    FakeRecognition.instances.push(this);
  }
}

function resolveWithTranscript(text: string) {
  const instance = FakeRecognition.instances[FakeRecognition.instances.length - 1];
  instance.onresult?.({ results: [[{ transcript: text }]] } as any);
}

describe('JaTodayPage', () => {
  beforeEach(() => {
    localStorage.clear();
    (window as any).SpeechRecognition = FakeRecognition;
  });

  afterEach(() => {
    delete (window as any).SpeechRecognition;
    FakeRecognition.instances = [];
  });

  it('shows the word once loaded', async () => {
    vi.spyOn(jaWordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-08-04', word: '大丈夫', meaningKo: '괜찮아' },
    ]);

    render(<JaTodayPage />);

    expect(screen.getByText('불러오는 중...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('大丈夫')).toBeInTheDocument());
  });

  it('shows an error message when fetching fails', async () => {
    vi.spyOn(jaWordData, 'fetchTodayWord').mockRejectedValue(new Error('네트워크 오류'));
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([]);

    render(<JaTodayPage />);

    await waitFor(() => expect(screen.getByText(/오류: 네트워크 오류/)).toBeInTheDocument());
  });

  it('disables "다른 단어 보기" when the archive has no other word', async () => {
    vi.spyOn(jaWordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-08-04', word: '大丈夫', meaningKo: '괜찮아' },
    ]);

    render(<JaTodayPage />);

    await waitFor(() => expect(screen.getByText('다른 단어 보기')).toBeInTheDocument());
    expect(screen.getByText('다른 단어 보기').closest('button')).toBeDisabled();
    expect(screen.getByText('아직 연습할 다른 단어가 없어요')).toBeInTheDocument();
  });

  it('hides only the Japanese example while the voice challenge is open, keeping the Korean translation as a hint', async () => {
    vi.spyOn(jaWordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-08-04', word: '大丈夫', meaningKo: '괜찮아' },
      { date: '2026-08-01', word: '頑張って', meaningKo: '힘내' },
    ]);

    render(<JaTodayPage />);

    await waitFor(() => expect(screen.getByText('今日は大丈夫です。')).toBeInTheDocument());

    await userEvent.click(screen.getByText('다른 단어 보기'));

    expect(screen.queryByText('今日は大丈夫です。')).not.toBeInTheDocument();
    expect(screen.getByText('오늘은 괜찮아요.')).toBeInTheDocument();
  });

  it('shows the voice challenge after clicking "다른 단어 보기", swaps the word on a correct spoken answer, and returns to today on request', async () => {
    const otherEntry = {
      date: '2026-08-01',
      word: '頑張って',
      reading: 'がんばって',
      meaningKo: '힘내',
      exampleJa: '頑張ってください。',
      exampleReading: 'がんばってください',
      exampleKo: '힘내주세요.',
    };

    vi.spyOn(jaWordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-08-04', word: '大丈夫', meaningKo: '괜찮아' },
      { date: '2026-08-01', word: '頑張って', meaningKo: '힘내' },
    ]);
    vi.spyOn(jaWordData, 'fetchWordByDate').mockResolvedValue(otherEntry);

    render(<JaTodayPage />);

    await waitFor(() => expect(screen.getByText('大丈夫')).toBeInTheDocument());

    await userEvent.click(screen.getByText('다른 단어 보기'));
    await userEvent.click(screen.getByText('🎤 말하기'));
    resolveWithTranscript('今日は大丈夫です。');

    await waitFor(() => expect(screen.getByText('頑張って')).toBeInTheDocument());
    expect(screen.getByText('오늘의 단어로')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();

    await userEvent.click(screen.getByText('오늘의 단어로'));

    await waitFor(() => expect(screen.getByText('大丈夫')).toBeInTheDocument());
    expect(screen.queryByText('오늘의 단어로')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- JaTodayPage.test.tsx`
Expected: FAIL — cannot find module `./JaTodayPage`.

- [ ] **Step 3: Implement `src/pages/JaTodayPage.tsx`**

```tsx
import { fetchTodayWord, fetchArchiveIndex, fetchWordByDate } from '../lib/jaWordData';
import { useWordOfDayState } from '../lib/useWordOfDayState';
import { JaWordCard } from '../components/JaWordCard';
import { PixelButton } from '../components/PixelButton';
import { VoiceChallenge } from '../components/VoiceChallenge';
import { Celebration } from '../components/Celebration';

export function JaTodayPage() {
  const { state, celebrating, setCelebrating, showChallenge, handleChallengeSuccess, handleBackToToday } =
    useWordOfDayState({ fetchTodayWord, fetchArchiveIndex, fetchWordByDate }, 'ja');

  if (state.status === 'loading') return <p>불러오는 중...</p>;
  if (state.status === 'error') return <p>오류: {state.message}</p>;

  const { todayEntry, displayedEntry, archivePool, isNew, challengeVisible } = state;
  const hasOtherWord = archivePool.some((item) => item.date !== displayedEntry.date);
  const isShowingToday = displayedEntry.date === todayEntry.date;

  return (
    <div>
      {isNew && isShowingToday && <span className="new-badge">NEW</span>}
      <JaWordCard entry={displayedEntry} hideExampleJa={challengeVisible} />
      {!isShowingToday && <PixelButton onClick={handleBackToToday}>오늘의 단어로</PixelButton>}
      {!challengeVisible && (
        <>
          <PixelButton onClick={showChallenge} disabled={!hasOtherWord}>
            다른 단어 보기
          </PixelButton>
          {!hasOtherWord && <p className="typing-challenge__empty">아직 연습할 다른 단어가 없어요</p>}
        </>
      )}
      {challengeVisible && <VoiceChallenge targetEntry={displayedEntry} onSuccess={handleChallengeSuccess} />}
      {celebrating && <Celebration onDone={() => setCelebrating(false)} />}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- JaTodayPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/JaTodayPage.tsx src/pages/JaTodayPage.test.tsx
git commit -m "feat: add JaTodayPage with voice-recognition challenge"
```

---

### Task 7: `JaArchivePage`

**Files:**
- Create: `src/pages/JaArchivePage.tsx`
- Create: `src/pages/JaArchivePage.test.tsx`

**Interfaces:**
- Consumes: `fetchArchiveIndex`, `fetchWordByDate` from `../lib/jaWordData` (Task 1); `ArchiveListItem` (existing, structurally compatible — no changes needed); `JaWordCard` (Task 4).
- Produces: `JaArchivePage()` React component from `src/pages/JaArchivePage.tsx`. Consumed by `App.tsx` (Task 8).

- [ ] **Step 1: Write the failing test**

Create `src/pages/JaArchivePage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JaArchivePage } from './JaArchivePage';
import * as jaWordData from '../lib/jaWordData';

describe('JaArchivePage', () => {
  it('lists archive items and shows detail on click', async () => {
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-08-04', word: '大丈夫', meaningKo: '괜찮아' },
    ]);
    vi.spyOn(jaWordData, 'fetchWordByDate').mockResolvedValue({
      date: '2026-08-04',
      word: '大丈夫',
      reading: 'だいじょうぶ',
      meaningKo: '괜찮아',
      exampleJa: '今日は大丈夫です。',
      exampleReading: 'きょうはだいじょうぶです',
      exampleKo: '오늘은 괜찮아요.',
    });

    render(<JaArchivePage />);

    await waitFor(() => expect(screen.getByText('大丈夫')).toBeInTheDocument());
    await userEvent.click(screen.getByText('大丈夫'));

    await waitFor(() => expect(screen.getByText('今日は大丈夫です。')).toBeInTheDocument());
    expect(screen.getByText('← 목록으로')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- JaArchivePage.test.tsx`
Expected: FAIL — cannot find module `./JaArchivePage`.

- [ ] **Step 3: Implement `src/pages/JaArchivePage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { fetchArchiveIndex, fetchWordByDate } from '../lib/jaWordData';
import { JaArchiveIndexItem, JaWordEntry } from '../lib/wordTypes';
import { ArchiveListItem } from '../components/ArchiveListItem';
import { JaWordCard } from '../components/JaWordCard';
import { PixelButton } from '../components/PixelButton';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'list'; items: JaArchiveIndexItem[] };

export function JaArchivePage() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [selected, setSelected] = useState<JaWordEntry | null>(null);

  useEffect(() => {
    fetchArchiveIndex()
      .then((items) => setState({ status: 'list', items }))
      .catch((err: Error) => setState({ status: 'error', message: err.message }));
  }, []);

  async function handleSelect(date: string) {
    const entry = await fetchWordByDate(date);
    if (entry) setSelected(entry);
  }

  if (selected) {
    return (
      <div>
        <PixelButton onClick={() => setSelected(null)}>← 목록으로</PixelButton>
        <JaWordCard entry={selected} />
      </div>
    );
  }

  if (state.status === 'loading') return <p>불러오는 중...</p>;
  if (state.status === 'error') return <p>오류: {state.message}</p>;

  return (
    <ul className="archive-list">
      {state.items.map((item) => (
        <ArchiveListItem key={item.date} item={item} onSelect={handleSelect} />
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- JaArchivePage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/JaArchivePage.tsx src/pages/JaArchivePage.test.tsx
git commit -m "feat: add JaArchivePage"
```

---

### Task 8: Language toggle in `App.tsx` and seed Japanese data file

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Create: `public/data/ja/archive-index.json`

**Interfaces:**
- Consumes: `JaTodayPage` (Task 6), `JaArchivePage` (Task 7), `fetchTodayWord`/`fetchArchiveIndex` from `./lib/jaWordData` (Task 1, for the test's mocks).
- Produces: the full end-to-end language toggle. Nothing downstream consumes `App.tsx`.

- [ ] **Step 1: Write the failing test**

In `src/App.test.tsx`, add the import and a new test (keep the two existing tests untouched):

```tsx
import * as jaWordData from './lib/jaWordData';
```

```tsx
it('switches to Japanese mode and shows the Japanese today page', async () => {
  vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue({
    date: '2026-07-23',
    word: 'awesome',
    partOfSpeech: 'adjective',
    pronunciationKo: '어썸',
    meaningKo: '정말 멋진',
    exampleEn: 'x',
    exampleKo: 'y',
  });
  vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([]);
  vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
  vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});
  vi.spyOn(jaWordData, 'fetchTodayWord').mockResolvedValue({
    date: '2026-08-04',
    word: '大丈夫',
    reading: 'だいじょうぶ',
    meaningKo: '괜찮아',
    exampleJa: '今日は大丈夫です。',
    exampleReading: 'きょうはだいじょうぶです',
    exampleKo: '오늘은 괜찮아요.',
  });
  vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([]);

  render(<App />);
  await waitFor(() => expect(screen.getByText('awesome')).toBeInTheDocument());

  await userEvent.click(screen.getByText('일본어'));

  await waitFor(() => expect(screen.getByText('大丈夫')).toBeInTheDocument());
  expect(screen.queryByText('awesome')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- App.test.tsx`
Expected: FAIL — no element with the text `일본어`.

- [ ] **Step 3: Implement the language toggle in `src/App.tsx`**

Replace the full contents of `src/App.tsx`:

```tsx
import { useState } from 'react';
import { TodayPage } from './pages/TodayPage';
import { ArchivePage } from './pages/ArchivePage';
import { JaTodayPage } from './pages/JaTodayPage';
import { JaArchivePage } from './pages/JaArchivePage';
import { PixelButton } from './components/PixelButton';
import { PullToRefresh } from './components/PullToRefresh';
import { requestNotificationPermissionAndSync } from './lib/reminder';

type Tab = 'today' | 'archive';
type Language = 'en' | 'ja';

export function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [language, setLanguage] = useState<Language>('en');

  return (
    <PullToRefresh>
      <div className="app">
        <h1>명예 외국인</h1>
        <nav className="tab-bar">
          <PixelButton onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>
            영어
          </PixelButton>
          <PixelButton onClick={() => setLanguage('ja')} aria-pressed={language === 'ja'}>
            일본어
          </PixelButton>
        </nav>
        <nav className="tab-bar">
          <PixelButton onClick={() => setTab('today')} aria-pressed={tab === 'today'}>
            오늘의 단어
          </PixelButton>
          <PixelButton onClick={() => setTab('archive')} aria-pressed={tab === 'archive'}>
            아카이브
          </PixelButton>
          <PixelButton onClick={() => requestNotificationPermissionAndSync()}>
            🔔 알림 켜기
          </PixelButton>
        </nav>
        {language === 'en' ? (
          tab === 'today' ? (
            <TodayPage />
          ) : (
            <ArchivePage />
          )
        ) : tab === 'today' ? (
          <JaTodayPage />
        ) : (
          <JaArchivePage />
        )}
      </div>
    </PullToRefresh>
  );
}
```

- [ ] **Step 4: Create the seed Japanese archive index**

Create `public/data/ja/archive-index.json`:

```json
[]
```

(This lets `JaArchivePage`/`JaTodayPage` run against a real dev server before the first GitHub Actions run has generated any Japanese word — `fetchTodayWord` falls back to "no word data available yet" gracefully once this file exists but is empty, matching the existing English behavior when `public/data/words/` is empty.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- App.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS — every test file in the project.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx public/data/ja/archive-index.json
git commit -m "feat: add EN/JA language toggle to App"
```

---

### Task 9: Japanese word generation script

**Files:**
- Create: `scripts/wordGeneratorJa.mjs`
- Create: `scripts/wordGeneratorJa.test.mjs`
- Create: `scripts/generate-word-ja.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing project-specific (uses the `openai` package already in `dependencies`).
- Produces: `buildPrompt(recentWords)`, `parseWordResponse(raw)`, `getRecentWords(archiveIndex, days, now)`, `generateWordEntry(client, recentWords)` from `scripts/wordGeneratorJa.mjs`, mirroring `scripts/wordGenerator.mjs`'s exports exactly (same names, same signatures) but for the Japanese field set. `scripts/generate-word-ja.mjs` is a standalone entry point (no exports consumed elsewhere) invoked by `npm run generate:word:ja` and by the GitHub Actions workflow (Task 10).

- [ ] **Step 1: Write the failing tests**

Create `scripts/wordGeneratorJa.test.mjs`:

```js
import { buildPrompt, parseWordResponse, getRecentWords, generateWordEntry } from './wordGeneratorJa.mjs';

describe('buildPrompt', () => {
  it('includes an avoid-list when recentWords is non-empty', () => {
    const prompt = buildPrompt(['大丈夫', '頑張って']);
    expect(prompt).toContain('大丈夫, 頑張って');
  });

  it('omits the avoid-list section when recentWords is empty', () => {
    const prompt = buildPrompt([]);
    expect(prompt).not.toContain('최근에 이미 다뤘으니');
  });
});

describe('parseWordResponse', () => {
  const validJson = JSON.stringify({
    word: ' 大丈夫 ',
    reading: 'だいじょうぶ',
    meaningKo: '괜찮아',
    exampleJa: '今日は大丈夫です。',
    exampleReading: 'きょうはだいじょうぶです',
    exampleKo: '오늘은 괜찮아요.',
  });

  it('returns a trimmed entry for valid JSON', () => {
    expect(parseWordResponse(validJson)).toEqual({
      word: '大丈夫',
      reading: 'だいじょうぶ',
      meaningKo: '괜찮아',
      exampleJa: '今日は大丈夫です。',
      exampleReading: 'きょうはだいじょうぶです',
      exampleKo: '오늘은 괜찮아요.',
    });
  });

  it('throws when a required field is missing', () => {
    const missingField = JSON.stringify({ word: '大丈夫' });
    expect(() => parseWordResponse(missingField)).toThrow('Missing or invalid field');
  });

  it('throws when the response is not valid JSON', () => {
    expect(() => parseWordResponse('not json')).toThrow('not valid JSON');
  });
});

describe('getRecentWords', () => {
  it('filters out entries older than the cutoff', () => {
    const now = new Date('2026-08-04');
    const archiveIndex = [
      { date: '2026-08-01', word: 'recent', meaningKo: 'x' },
      { date: '2025-01-01', word: 'old', meaningKo: 'x' },
    ];
    expect(getRecentWords(archiveIndex, 90, now)).toEqual(['recent']);
  });
});

describe('generateWordEntry', () => {
  it('calls the OpenAI client and parses its response', async () => {
    const fakeClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    word: '大丈夫',
                    reading: 'だいじょうぶ',
                    meaningKo: '괜찮아',
                    exampleJa: '今日は大丈夫です。',
                    exampleReading: 'きょうはだいじょうぶです',
                    exampleKo: '오늘은 괜찮아요.',
                  }),
                },
              },
            ],
          }),
        },
      },
    };

    const result = await generateWordEntry(fakeClient, ['頑張って']);
    expect(result.word).toBe('大丈夫');
    expect(fakeClient.chat.completions.create).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- wordGeneratorJa.test.mjs`
Expected: FAIL — cannot find module `./wordGeneratorJa.mjs`.

- [ ] **Step 3: Implement `scripts/wordGeneratorJa.mjs`**

```js
const REQUIRED_FIELDS = ['word', 'reading', 'meaningKo', 'exampleJa', 'exampleReading', 'exampleKo'];

export function buildPrompt(recentWords) {
  const avoidList =
    recentWords.length > 0
      ? `다음 단어/표현은 최근에 이미 다뤘으니 피해줘: ${recentWords.join(', ')}`
      : '';

  return [
    '너는 한국인 일본어 학습자를 위한 "오늘의 단어" 콘텐츠를 만드는 도우미야.',
    '중급 수준의 일상 회화체 한자어 또는 표현 1개를 골라줘.',
    '반드시 아래 JSON 형식으로만 응답해: {"word": string, "reading": string, "meaningKo": string, "exampleJa": string, "exampleReading": string, "exampleKo": string}',
    '- word는 한자를 포함한 단어 표기 (예: "大丈夫")',
    '- reading은 word의 훈리가나, 히라가나로만 표기 (예: "だいじょうぶ")',
    '- exampleJa는 실생활에서 쓸 법한 자연스러운 짧은 문장 (한자+가나 혼용)',
    '- exampleReading은 exampleJa 문장 전체를 히라가나로만 정확하게 읽은 것 (음성 인식 정답 비교에 그대로 쓰이므로 한 글자도 틀리면 안 됨, 한자/가타카나 없이 히라가나만)',
    '- exampleKo는 exampleJa의 자연스러운 한국어 번역',
    avoidList,
  ]
    .filter(Boolean)
    .join('\n');
}

export function parseWordResponse(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('OpenAI response is not valid JSON');
  }

  const entry = {};
  for (const field of REQUIRED_FIELDS) {
    const value = data[field];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Missing or invalid field: ${field}`);
    }
    entry[field] = value.trim();
  }
  return entry;
}

export function getRecentWords(archiveIndex, days = 90, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return archiveIndex.filter((item) => item.date >= cutoffStr).map((item) => item.word);
}

export async function generateWordEntry(client, recentWords) {
  const prompt = buildPrompt(recentWords);
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You output strict JSON and nothing else.' },
      { role: 'user', content: prompt },
    ],
  });
  const raw = completion.choices[0].message.content;
  return parseWordResponse(raw);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- wordGeneratorJa.test.mjs`
Expected: PASS

- [ ] **Step 5: Implement `scripts/generate-word-ja.mjs`**

```js
import 'dotenv/config';
import OpenAI from 'openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateWordEntry, getRecentWords } from './wordGeneratorJa.mjs';

const DATA_DIR = path.join(process.cwd(), 'public', 'data', 'ja');
const WORDS_DIR = path.join(DATA_DIR, 'words');
const INDEX_PATH = path.join(DATA_DIR, 'archive-index.json');

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function readArchiveIndex() {
  try {
    const raw = await fs.readFile(INDEX_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  await fs.mkdir(WORDS_DIR, { recursive: true });

  const archiveIndex = await readArchiveIndex();
  const today = getTodayDateString();

  if (archiveIndex.some((item) => item.date === today)) {
    console.log(`Japanese word for ${today} already exists, skipping.`);
    return;
  }

  const recentWords = getRecentWords(archiveIndex);
  const client = new OpenAI({ apiKey });
  const entry = await generateWordEntry(client, recentWords);
  entry.date = today;

  await fs.writeFile(path.join(WORDS_DIR, `${today}.json`), JSON.stringify(entry, null, 2) + '\n');

  archiveIndex.unshift({ date: today, word: entry.word, meaningKo: entry.meaningKo });
  await fs.writeFile(INDEX_PATH, JSON.stringify(archiveIndex, null, 2) + '\n');

  console.log(`Generated Japanese word for ${today}: ${entry.word}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 6: Add the npm script**

In `package.json`, add a new entry to `"scripts"` right after `"generate:word"`:

```json
"generate:word:ja": "node scripts/generate-word-ja.mjs",
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS — every test file in the project, including the new `wordGeneratorJa.test.mjs`.

- [ ] **Step 8: Commit**

```bash
git add scripts/wordGeneratorJa.mjs scripts/wordGeneratorJa.test.mjs scripts/generate-word-ja.mjs package.json
git commit -m "feat: add Japanese daily word generation script"
```

---

### Task 10: Wire Japanese generation into the daily GitHub Actions workflow

**Files:**
- Modify: `.github/workflows/generate-word.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `scripts/generate-word-ja.mjs` (Task 9).
- Produces: nothing consumed elsewhere — this is the terminal integration point.

- [ ] **Step 1: Add the Japanese generation step**

In `.github/workflows/generate-word.yml`, add a second `run` step right after the existing `node scripts/generate-word.mjs` step, before the `Commit generated word` step:

```yaml
      - run: node scripts/generate-word.mjs
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          TZ: Asia/Seoul
      - run: node scripts/generate-word-ja.mjs
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          TZ: Asia/Seoul
      - name: Commit generated word
```

(The `git add public/data` line in the existing commit step already covers both `public/data/words/` and `public/data/ja/words/` — no change needed there.)

- [ ] **Step 2: Document the manual local run in `README.md`**

In `README.md`, right after the existing "단어 생성 스크립트 로컬 실행" section (which documents `npm run generate:word`), add:

```markdown
일본어 단어를 로컬에서 생성해보려면 동일한 `.env` 설정 후:
```bash
npm run generate:word:ja
```
성공하면 `public/data/ja/words/오늘날짜.json`이 생성되고 `public/data/ja/archive-index.json`에 항목이 추가됩니다.
```

- [ ] **Step 3: Verify the workflow YAML is well-formed**

Run: `cat .github/workflows/generate-word.yml` (or open the file)

This project has no YAML linter installed. Confirm by inspection that the added `- run: node scripts/generate-word-ja.mjs` step has the same 6-space indentation as the sibling `run` step above it, and that the `Commit generated word` step still immediately follows.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/generate-word.yml README.md
git commit -m "ci: generate the Japanese word alongside the English one"
```

---

### Task 11: Final full-suite verification

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all test files (English + Japanese) green.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors (this catches any structural-typing mismatch between `JaArchiveIndexItem`/`ArchiveIndexItem` in `ArchiveListItem` usage, and any leftover unnamespaced call to `browsingState`/`reminder`).

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, open the printed local URL in Chrome or Edge (required for `SpeechRecognition` — see Global Constraints), and check:
- The `영어 | 일본어` toggle switches the whole screen's content.
- Japanese "오늘의 단어" shows 대체 데이터 없으면 "오류: No word data available yet" (expected until the workflow or `npm run generate:word:ja` has produced at least one entry) — this is the same fallback behavior English already has on a fresh checkout.
- If a Japanese word entry exists (run `npm run generate:word:ja` locally with an `OPENAI_API_KEY` in `.env`, or hand-write one `public/data/ja/words/{today}.json` + matching `archive-index.json` entry for the smoke test), clicking "다른 단어 보기" then "🎤 말하기" prompts for microphone permission and reacts to spoken Japanese.
- In Firefox, the Japanese challenge shows the "이 브라우저는 음성인식을 지원하지 않아요" message instead of a mic button.

This step is manual and not required to pass CI — note any UX issue found and fix it before considering the feature done.
