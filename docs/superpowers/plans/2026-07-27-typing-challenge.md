# 타이핑 연습 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오늘의 단어 페이지에서, 현재 표시 중인 단어의 영어 예문을 정확히 타이핑하면 아카이브의 다른 단어로 넘어가며 반복 연습할 수 있는 기능을 추가한다.

**Architecture:** 순수 로직(정답 판정, 무작위 다른 단어 선택)을 `src/lib/typingChallenge.ts`로 분리하고, 판정 UI를 `TypingChallenge` 컴포넌트로, "다른 단어로 전환/오늘로 복귀"라는 상태 관리는 `TodayPage`가 소유한다.

**Tech Stack:** React 18 + TypeScript, Vitest + React Testing Library (기존 스택 그대로, 신규 의존성 없음).

## Global Constraints

- 오늘의 단어 페이지는 여전히 "하루 1개의 실제 오늘 단어" 개념을 유지한다 — 다른 단어 보기는 임시 열람 상태일 뿐 오늘의 단어를 대체하지 않는다
- 정답 판정: 앞뒤 공백 무시 + 대소문자 무시. 문장부호는 정확히 일치해야 함
- 정답 시: 아카이브에서 현재 표시 중인 단어를 제외한 항목 중 무작위로 하나를 골라 카드 내용을 교체하고, 계속 반복 연습 가능
- 오답 시: 입력한 문장과 정답 문장을 나란히 비교해서 보여주고 재시도 가능 (진행을 막지 않음)
- 아카이브에 현재 단어 말고 다른 단어가 없으면 "다른 단어 보기" 버튼을 비활성화하고 안내 문구를 보여준다
- NEW 배지 및 `setLastViewedDate` 호출은 실제 오늘의 단어 최초 로딩 시점에만 1회 발생하며, 다른 단어로 전환/복귀해도 다시 호출되지 않는다
- 클라이언트 사이드 라우터 라이브러리 사용 안 함 (기존 프로젝트 전역 제약)
- 프론트엔드 테스트는 Vitest + React Testing Library
- 참고 spec: `docs/superpowers/specs/2026-07-27-typing-challenge-design.md`

---

### Task 1: 정답 판정 & 무작위 단어 선택 로직 (`typingChallenge.ts`)

**Files:**
- Create: `src/lib/typingChallenge.ts`
- Test: `src/lib/typingChallenge.test.ts`

**Interfaces:**
- Consumes: `ArchiveIndexItem` from `src/lib/wordTypes.ts` (기존 타입, 필드: `date`, `word`, `meaningKo`)
- Produces:
  - `normalizeForComparison(text: string): string`
  - `isCorrectAnswer(input: string, target: string): boolean`
  - `pickRandomOtherWord(archiveIndex: ArchiveIndexItem[], excludeDate: string): ArchiveIndexItem | null`
  이 3개 함수는 Task 2(`TypingChallenge`)와 Task 3(`TodayPage`)이 그대로 import해서 사용함

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { normalizeForComparison, isCorrectAnswer, pickRandomOtherWord } from './typingChallenge';
import { ArchiveIndexItem } from './wordTypes';

describe('normalizeForComparison', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalizeForComparison('  Hello World.  ')).toBe('hello world.');
  });
});

describe('isCorrectAnswer', () => {
  it('matches ignoring case and surrounding whitespace', () => {
    expect(isCorrectAnswer('  You Should TAKE it easy.  ', 'You should take it easy.')).toBe(true);
  });

  it('does not match when punctuation differs', () => {
    expect(isCorrectAnswer('You should take it easy', 'You should take it easy.')).toBe(false);
  });

  it('does not match when the wording differs', () => {
    expect(isCorrectAnswer('You should take it slow.', 'You should take it easy.')).toBe(false);
  });
});

describe('pickRandomOtherWord', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('excludes the given date from candidates', () => {
    const archive: ArchiveIndexItem[] = [
      { date: '2026-07-27', word: 'take it easy', meaningKo: '편하게 하다' },
      { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' },
    ];
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = pickRandomOtherWord(archive, '2026-07-27');

    expect(result).toEqual({ date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' });
  });

  it('returns null when no other candidates exist', () => {
    const single: ArchiveIndexItem[] = [
      { date: '2026-07-27', word: 'take it easy', meaningKo: '편하게 하다' },
    ];

    expect(pickRandomOtherWord(single, '2026-07-27')).toBeNull();
  });

  it('picks among multiple remaining candidates based on Math.random', () => {
    const three: ArchiveIndexItem[] = [
      { date: '2026-07-27', word: 'take it easy', meaningKo: 'a' },
      { date: '2026-07-23', word: 'awesome', meaningKo: 'b' },
      { date: '2026-07-20', word: 'figure out', meaningKo: 'c' },
    ];
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const result = pickRandomOtherWord(three, '2026-07-27');

    expect(result).toEqual({ date: '2026-07-20', word: 'figure out', meaningKo: 'c' });
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- typingChallenge`
Expected: FAIL — `src/lib/typingChallenge.ts` 모듈이 존재하지 않음

- [ ] **Step 3: 구현 작성**

```ts
import { ArchiveIndexItem } from './wordTypes';

export function normalizeForComparison(text: string): string {
  return text.trim().toLowerCase();
}

export function isCorrectAnswer(input: string, target: string): boolean {
  return normalizeForComparison(input) === normalizeForComparison(target);
}

export function pickRandomOtherWord(
  archiveIndex: ArchiveIndexItem[],
  excludeDate: string
): ArchiveIndexItem | null {
  const candidates = archiveIndex.filter((item) => item.date !== excludeDate);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- typingChallenge`
Expected: PASS — 6개 테스트 통과

- [ ] **Step 5: Commit**

```bash
git add src/lib/typingChallenge.ts src/lib/typingChallenge.test.ts
git commit -m "feat: add answer-checking and random-other-word logic for typing challenge"
```

---

### Task 2: `TypingChallenge` 컴포넌트

**Files:**
- Create: `src/components/TypingChallenge.tsx`
- Test: `src/components/TypingChallenge.test.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `isCorrectAnswer` from `src/lib/typingChallenge.ts` (Task 1), `PixelButton` from `src/components/PixelButton.tsx` (기존)
- Produces: `TypingChallenge({ targetSentence: string, onSuccess: () => void })` — Task 3(`TodayPage`)이 사용

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TypingChallenge } from './TypingChallenge';

describe('TypingChallenge', () => {
  it('calls onSuccess when the typed sentence matches (case/whitespace-insensitive)', async () => {
    const onSuccess = vi.fn();
    render(<TypingChallenge targetSentence="You should take it easy." onSuccess={onSuccess} />);

    await userEvent.type(screen.getByRole('textbox'), '  you SHOULD take it easy.  ');
    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('shows a comparison and does not call onSuccess when the answer is wrong', async () => {
    const onSuccess = vi.fn();
    render(<TypingChallenge targetSentence="You should take it easy." onSuccess={onSuccess} />);

    await userEvent.type(screen.getByRole('textbox'), 'You should take it slow.');
    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText(/내 입력: You should take it slow\./)).toBeInTheDocument();
    expect(screen.getByText(/정답: You should take it easy\./)).toBeInTheDocument();
  });

  it('allows retrying after a wrong answer', async () => {
    const onSuccess = vi.fn();
    render(<TypingChallenge targetSentence="You should take it easy." onSuccess={onSuccess} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'wrong answer');
    await userEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(onSuccess).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, 'You should take it easy.');
    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- TypingChallenge`
Expected: FAIL — `src/components/TypingChallenge.tsx` 모듈이 존재하지 않음

- [ ] **Step 3: 구현 작성**

```tsx
import { useState } from 'react';
import { isCorrectAnswer } from '../lib/typingChallenge';
import { PixelButton } from './PixelButton';

interface TypingChallengeProps {
  targetSentence: string;
  onSuccess: () => void;
}

type ChallengeStatus = { kind: 'idle' } | { kind: 'incorrect'; submitted: string };

export function TypingChallenge({ targetSentence, onSuccess }: TypingChallengeProps) {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ChallengeStatus>({ kind: 'idle' });

  function handleSubmit() {
    if (isCorrectAnswer(input, targetSentence)) {
      onSuccess();
      return;
    }
    setStatus({ kind: 'incorrect', submitted: input });
  }

  return (
    <div className="typing-challenge">
      <input
        type="text"
        className="typing-challenge__input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="예문을 그대로 입력해보세요"
      />
      <PixelButton onClick={handleSubmit}>제출</PixelButton>
      {status.kind === 'incorrect' && (
        <div className="typing-challenge__comparison">
          <p className="typing-challenge__submitted">내 입력: {status.submitted}</p>
          <p className="typing-challenge__target">정답: {targetSentence}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- TypingChallenge`
Expected: PASS — 3개 테스트 통과

- [ ] **Step 5: `theme.css`에 스타일 추가**

`src/styles/theme.css` 파일 끝에 다음을 추가한다 (기존 `.archive-list-item` 규칙 다음):

```css
.typing-challenge {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.typing-challenge__input {
  font-family: 'Galmuri11', sans-serif;
  border: 3px solid var(--color-wood-dark);
  padding: 8px;
  font-size: 1rem;
}

.typing-challenge__comparison {
  background: #fff;
  border: 2px solid var(--color-wood-dark);
  padding: 8px;
  text-align: left;
  font-size: 0.9rem;
}

.typing-challenge__submitted {
  color: #b23b3b;
}

.typing-challenge__target {
  color: var(--color-text);
}
```

- [ ] **Step 6: 빌드 확인**

Run: `npm run build`
Expected: 오류 없이 빌드 성공

- [ ] **Step 7: Commit**

```bash
git add src/components/TypingChallenge.tsx src/components/TypingChallenge.test.tsx src/styles/theme.css
git commit -m "feat: add TypingChallenge component with pixel-art styling"
```

---

### Task 3: `TodayPage`에 "다른 단어 보기" / "오늘의 단어로" 통합

**Files:**
- Modify: `src/pages/TodayPage.tsx`
- Modify: `src/pages/TodayPage.test.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `fetchTodayWord`, `fetchArchiveIndex`, `fetchWordByDate` from `src/lib/wordData.ts` (기존), `pickRandomOtherWord` from `src/lib/typingChallenge.ts` (Task 1), `TypingChallenge` from `src/components/TypingChallenge.tsx` (Task 2), `PixelButton` (기존), `WordCard` (기존)

- [ ] **Step 1: 기존 테스트를 포함해 전체 테스트 파일을 재작성 (실패 상태로 만듦)**

`src/pages/TodayPage.test.tsx` 전체를 다음으로 교체한다:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodayPage } from './TodayPage';
import * as wordData from '../lib/wordData';
import * as reminder from '../lib/reminder';

const todayEntry = {
  date: '2026-07-23',
  word: 'awesome',
  partOfSpeech: 'adjective',
  pronunciationKo: '어썸',
  meaningKo: '정말 멋진',
  exampleEn: 'x',
  exampleKo: 'y',
};

describe('TodayPage', () => {
  it('shows the word once loaded', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' },
    ]);
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});

    render(<TodayPage />);

    expect(screen.getByText('불러오는 중...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('awesome')).toBeInTheDocument());
  });

  it('shows an error message when fetching fails', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockRejectedValue(new Error('네트워크 오류'));
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([]);

    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText(/오류: 네트워크 오류/)).toBeInTheDocument());
  });

  it('still shows the word and disables "다른 단어 보기" when the archive index fetch fails', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(wordData, 'fetchArchiveIndex').mockRejectedValue(new Error('아카이브 오류'));
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText('awesome')).toBeInTheDocument());
    expect(screen.getByText('다른 단어 보기').closest('button')).toBeDisabled();
  });

  it('disables "다른 단어 보기" when the archive has no other word', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' },
    ]);
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});

    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText('다른 단어 보기')).toBeInTheDocument());
    expect(screen.getByText('다른 단어 보기').closest('button')).toBeDisabled();
    expect(screen.getByText('아직 연습할 다른 단어가 없어요')).toBeInTheDocument();
  });

  it('shows the typing challenge after clicking "다른 단어 보기", swaps the word on a correct answer, and returns to today on request', async () => {
    const otherEntry = {
      date: '2026-07-20',
      word: 'figure out',
      partOfSpeech: 'phrase',
      pronunciationKo: '피겨 아웃',
      meaningKo: '알아내다',
      exampleEn: 'Let me figure it out.',
      exampleKo: '내가 알아낼게.',
    };

    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' },
      { date: '2026-07-20', word: 'figure out', meaningKo: '알아내다' },
    ]);
    vi.spyOn(wordData, 'fetchWordByDate').mockResolvedValue(otherEntry);
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});

    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText('awesome')).toBeInTheDocument());

    await userEvent.click(screen.getByText('다른 단어 보기'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'x');
    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    await waitFor(() => expect(screen.getByText('figure out')).toBeInTheDocument());
    expect(screen.getByText('오늘의 단어로')).toBeInTheDocument();

    await userEvent.click(screen.getByText('오늘의 단어로'));

    await waitFor(() => expect(screen.getByText('awesome')).toBeInTheDocument());
    expect(screen.queryByText('오늘의 단어로')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- TodayPage`
Expected: FAIL — 현재 `TodayPage.tsx`는 아카이브를 fetch하지 않고, "다른 단어 보기"/"오늘의 단어로" 버튼도 없어 새 테스트들이 실패함

- [ ] **Step 3: `TodayPage.tsx` 전체 재작성**

```tsx
import { useEffect, useState } from 'react';
import { fetchTodayWord, fetchArchiveIndex, fetchWordByDate } from '../lib/wordData';
import { ArchiveIndexItem, WordEntry } from '../lib/wordTypes';
import { isNewDaySinceLastView, setLastViewedDate } from '../lib/reminder';
import { pickRandomOtherWord } from '../lib/typingChallenge';
import { WordCard } from '../components/WordCard';
import { PixelButton } from '../components/PixelButton';
import { TypingChallenge } from '../components/TypingChallenge';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      todayEntry: WordEntry;
      displayedEntry: WordEntry;
      archivePool: ArchiveIndexItem[];
      isNew: boolean;
      challengeVisible: boolean;
    };

export function TodayPage() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    fetchTodayWord()
      .then(async (entry) => {
        const isNew = isNewDaySinceLastView(entry.date);
        setLastViewedDate(entry.date);

        let archivePool: ArchiveIndexItem[] = [];
        try {
          archivePool = await fetchArchiveIndex();
        } catch (err) {
          console.warn('Failed to fetch archive index for the typing challenge pool:', err);
        }

        setState({
          status: 'ready',
          todayEntry: entry,
          displayedEntry: entry,
          archivePool,
          isNew,
          challengeVisible: false,
        });
      })
      .catch((err: Error) => setState({ status: 'error', message: err.message }));
  }, []);

  if (state.status === 'loading') return <p>불러오는 중...</p>;
  if (state.status === 'error') return <p>오류: {state.message}</p>;

  const { todayEntry, displayedEntry, archivePool, isNew, challengeVisible } = state;
  const hasOtherWord = archivePool.some((item) => item.date !== displayedEntry.date);
  const isShowingToday = displayedEntry.date === todayEntry.date;

  async function handleChallengeSuccess() {
    const next = pickRandomOtherWord(archivePool, displayedEntry.date);
    if (!next) return;
    const entry = await fetchWordByDate(next.date);
    if (!entry) {
      console.warn(`Archive index references missing file for ${next.date}`);
      return;
    }
    setState({ ...state, displayedEntry: entry, challengeVisible: false });
  }

  function handleBackToToday() {
    setState({ ...state, displayedEntry: todayEntry, challengeVisible: false });
  }

  return (
    <div>
      {isNew && <span className="new-badge">NEW</span>}
      <WordCard entry={displayedEntry} />
      {!isShowingToday && <PixelButton onClick={handleBackToToday}>오늘의 단어로</PixelButton>}
      {!challengeVisible && (
        <>
          <PixelButton
            onClick={() => setState({ ...state, challengeVisible: true })}
            disabled={!hasOtherWord}
          >
            다른 단어 보기
          </PixelButton>
          {!hasOtherWord && <p className="typing-challenge__empty">아직 연습할 다른 단어가 없어요</p>}
        </>
      )}
      {challengeVisible && (
        <TypingChallenge targetSentence={displayedEntry.exampleEn} onSuccess={handleChallengeSuccess} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- TodayPage`
Expected: PASS — 5개 테스트 통과

- [ ] **Step 5: `theme.css`에 안내 문구 스타일 추가**

`src/styles/theme.css` 파일 끝에 추가:

```css
.typing-challenge__empty {
  font-size: 0.85rem;
  color: var(--color-wood-dark);
}
```

- [ ] **Step 6: 전체 테스트 스위트 & 빌드 실행**

Run: `npm test && npm run build`
Expected: 모든 테스트 PASS, 빌드 성공

- [ ] **Step 7: Commit**

```bash
git add src/pages/TodayPage.tsx src/pages/TodayPage.test.tsx src/styles/theme.css
git commit -m "feat: integrate typing challenge into TodayPage (other-word browsing + return-to-today)"
```

---

## 완료 후 검증 체크리스트

- [ ] `npm test` 전체 통과
- [ ] `npm run build` 성공
- [ ] `npm run dev`로 로컬에서 "다른 단어 보기" → 타이핑 → 정답 시 카드 교체 → "오늘의 단어로" 복귀까지 육안으로 확인
