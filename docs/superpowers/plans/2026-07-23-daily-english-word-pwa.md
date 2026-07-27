# 명예 외국인 PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매일 초중급 일상 회화체 영단어 1개를 픽셀아트(파스텔 코지) 스타일로 보여주는 PWA를 GitHub Pages에 서버 없이 배포한다.

**Architecture:** GitHub Actions가 매일 1회 OpenAI API를 호출해 그날의 단어 JSON을 저장소에 커밋하고, 별도의 GitHub Actions가 React+Vite 앱을 빌드해 GitHub Pages로 배포한다. 브라우저는 정적 JSON만 fetch하며 OpenAI 키를 절대 포함하지 않는다.

**Tech Stack:** React 18 + TypeScript + Vite, vite-plugin-pwa, Vitest + React Testing Library, Node.js(ESM) 스크립트 + `openai` SDK, GitHub Actions, GitHub Pages.

## Global Constraints

- 하루에 단어 1개만 표시 (여러 개 리스트나 퀴즈/플래시카드 모드는 범위 밖)
- 난이도: 초중급 일상 회화체, 특정 토픽(여행/비즈니스 등) 한정 아님
- 아카이브: 지난 단어 목록을 볼 수 있어야 하고, 상세는 오늘의 단어와 동일한 컴포넌트 재사용
- OpenAI API 키는 브라우저에 절대 노출되지 않아야 함 — GitHub Actions에서 빌드타임 사전 생성 방식만 사용
- 단어 중복 방지: 최근 90일 내 사용된 단어는 재사용 금지
- 발음 표기는 한글 발음표기 (`pronunciationKo`) 사용, IPA 아님
- 알림은 best-effort 로컬 알림 수준으로만 구현 (서버 Web Push 없음, 100% 보장 안 됨을 인지)
- 클라이언트 사이드 라우터 라이브러리 사용 안 함 — 상태 기반 탭 전환만
- 픽셀아트 디자인: 파스텔 코지 팔레트, 한글 지원 픽셀 폰트(타이틀/포인트용), TV 액자 모티프, 눌림 인터랙션
- 프론트엔드 테스트는 Vitest + React Testing Library, 단어 생성 스크립트는 OpenAI 응답을 모킹하여 테스트 (실제 API 호출 없이)
- GitHub Pages / GitHub Actions 무료 범위 안에서 동작해야 함
- 참고 spec: `docs/superpowers/specs/2026-07-23-daily-english-word-pwa-design.md`

---

### Task 1: 프로젝트 스캐폴딩 (Vite + React + TypeScript)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `.gitignore`

**Interfaces:**
- Produces: `App` component (default export 없음, named export `App`) from `src/App.tsx` — 이후 모든 Task가 이 파일을 확장함

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "daily-english-word-pwa",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "generate:word": "node scripts/generate-word.mjs",
    "generate:icons": "node scripts/generate-placeholder-icons.mjs"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "openai": "^4.55.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.1",
    "pngjs": "^7.0.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.1",
    "vite-plugin-pwa": "^0.20.1",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: 의존성 설치**

Run: `npm install`
Expected: `node_modules/`가 생성되고 오류 없이 종료됨

- [ ] **Step 3: tsconfig.json 작성**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "scripts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: tsconfig.node.json 작성**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: vite.config.ts 작성 (기본 뼈대, PWA 설정은 Task 12에서 추가)**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
```

- [ ] **Step 6: index.html 작성**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>명예 외국인</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: src/App.tsx 작성 (임시 플레이스홀더, Task 10에서 최종 완성)**

```tsx
export function App() {
  return <h1>명예 외국인</h1>;
}
```

- [ ] **Step 8: src/main.tsx 작성**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 9: .gitignore 작성**

```
node_modules
dist
dist-ssr
*.local
.DS_Store
```

- [ ] **Step 10: 빌드 확인**

Run: `npm run build`
Expected: `dist/` 폴더가 생성되고 오류 없이 `build complete` 메시지 출력

- [ ] **Step 11: Commit**

```bash
git add package.json tsconfig.json tsconfig.node.json vite.config.ts index.html src/main.tsx src/App.tsx .gitignore
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

---

### Task 2: 테스트 하네스 설정 (Vitest + React Testing Library)

**Files:**
- Create: `src/test/setup.ts`
- Create: `src/App.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `App` from Task 1 (`src/App.tsx`)
- Produces: 동작하는 Vitest 하네스 — 이후 모든 컴포넌트/로직 Task가 이 위에서 테스트를 작성함

- [ ] **Step 1: 테스트 셋업 파일 작성**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 2: 실패하는 테스트 작성**

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText('명예 외국인 앱')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 테스트 실행하여 실패 확인**

Run: `npm test`
Expected: FAIL — `App.tsx`가 "명예 외국인"만 렌더링하므로 "명예 외국인 앱" 텍스트를 찾지 못함

- [ ] **Step 4: App.tsx 수정하여 텍스트 일치시키기**

```tsx
export function App() {
  return <h1>명예 외국인 앱</h1>;
}
```

- [ ] **Step 5: 테스트 실행하여 통과 확인**

Run: `npm test`
Expected: PASS — 1개 테스트 통과

- [ ] **Step 6: Commit**

```bash
git add src/test/setup.ts src/App.test.tsx src/App.tsx vite.config.ts
git commit -m "test: set up Vitest + React Testing Library harness"
```

---

### Task 3: 단어 데이터 타입 & 로컬 개발용 픽스처

**Files:**
- Create: `src/lib/wordTypes.ts`
- Create: `public/data/words/2026-07-23.json`
- Create: `public/data/archive-index.json`

**Interfaces:**
- Produces: `WordEntry`, `ArchiveIndexItem` 타입 — 이후 `wordData.ts`, 모든 컴포넌트/페이지, `generate-word.mjs`가 이 필드 이름을 그대로 사용함

- [ ] **Step 1: 타입 정의 작성**

```ts
export interface WordEntry {
  date: string; // YYYY-MM-DD
  word: string;
  partOfSpeech: string;
  pronunciationKo: string;
  meaningKo: string;
  exampleEn: string;
  exampleKo: string;
}

export interface ArchiveIndexItem {
  date: string; // YYYY-MM-DD
  word: string;
  meaningKo: string;
}
```

- [ ] **Step 2: 로컬 개발/초기 배포용 픽스처 데이터 작성**

`public/data/words/2026-07-23.json`:

```json
{
  "date": "2026-07-23",
  "word": "awesome",
  "partOfSpeech": "adjective",
  "pronunciationKo": "어섬",
  "meaningKo": "정말 멋진, 굉장한",
  "exampleEn": "This place is awesome!",
  "exampleKo": "이곳 정말 멋지다!"
}
```

`public/data/archive-index.json`:

```json
[
  { "date": "2026-07-23", "word": "awesome", "meaningKo": "정말 멋진, 굉장한" }
]
```

- [ ] **Step 3: 타입체크 확인**

Run: `npx tsc --noEmit`
Expected: 오류 없이 종료

- [ ] **Step 4: Commit**

```bash
git add src/lib/wordTypes.ts public/data/words/2026-07-23.json public/data/archive-index.json
git commit -m "feat: add word data types and seed fixture data"
```

---

### Task 4: 단어 데이터 fetch & 폴백 로직 (`wordData.ts`)

**Files:**
- Create: `src/lib/wordData.ts`
- Test: `src/lib/wordData.test.ts`

**Interfaces:**
- Consumes: `WordEntry`, `ArchiveIndexItem` from `src/lib/wordTypes.ts` (Task 3)
- Produces:
  - `getLocalDateString(d?: Date): string`
  - `fetchWordByDate(date: string): Promise<WordEntry | null>`
  - `fetchArchiveIndex(): Promise<ArchiveIndexItem[]>` (최신순 내림차순 정렬됨)
  - `fetchTodayWord(): Promise<WordEntry>`
  이 4개 함수는 Task 8, 9의 `TodayPage`/`ArchivePage`가 그대로 import해서 사용함

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { getLocalDateString, fetchWordByDate, fetchArchiveIndex, fetchTodayWord } from './wordData';

describe('getLocalDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(getLocalDateString(new Date(2026, 6, 23))).toBe('2026-07-23');
  });

  it('pads single-digit month and day', () => {
    expect(getLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('fetchWordByDate', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  const sample = {
    date: '2026-07-23',
    word: 'awesome',
    partOfSpeech: 'adjective',
    pronunciationKo: '어섬',
    meaningKo: '정말 멋진',
    exampleEn: 'x',
    exampleKo: 'y',
  };

  it('returns the parsed entry when found', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => sample });
    expect(await fetchWordByDate('2026-07-23')).toEqual(sample);
  });

  it('returns null on 404', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 404 });
    expect(await fetchWordByDate('2099-01-01')).toBeNull();
  });

  it('throws on other non-ok statuses', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchWordByDate('2026-07-23')).rejects.toThrow();
  });
});

describe('fetchArchiveIndex', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sorts items by date descending', async () => {
    const items = [
      { date: '2026-07-20', word: 'a', meaningKo: 'a' },
      { date: '2026-07-23', word: 'c', meaningKo: 'c' },
      { date: '2026-07-21', word: 'b', meaningKo: 'b' },
    ];
    (fetch as any).mockResolvedValue({ ok: true, json: async () => items });
    const result = await fetchArchiveIndex();
    expect(result.map((i) => i.date)).toEqual(['2026-07-23', '2026-07-21', '2026-07-20']);
  });
});

describe('fetchTodayWord', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it("returns today's entry when it exists", async () => {
    const todayStr = getLocalDateString();
    const entry = { date: todayStr, word: 'awesome', partOfSpeech: 'adjective', pronunciationKo: '어섬', meaningKo: '정말 멋진', exampleEn: 'x', exampleKo: 'y' };
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => entry });
    expect(await fetchTodayWord()).toEqual(entry);
  });

  it('falls back to the latest archive entry when today is missing', async () => {
    const latest = { date: '2026-07-20', word: 'chill', partOfSpeech: 'verb', pronunciationKo: '칠', meaningKo: '느긋하게 쉬다', exampleEn: 'x', exampleKo: 'y' };
    (fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ date: '2026-07-20', word: 'chill', meaningKo: '느긋하게 쉬다' }] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => latest });
    expect(await fetchTodayWord()).toEqual(latest);
  });

  it('throws when no data exists at all', async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    await expect(fetchTodayWord()).rejects.toThrow('No word data available yet');
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- wordData`
Expected: FAIL — `src/lib/wordData.ts` 모듈이 존재하지 않음

- [ ] **Step 3: 구현 작성**

```ts
import { ArchiveIndexItem, WordEntry } from './wordTypes';

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchWordByDate(date: string): Promise<WordEntry | null> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/words/${date}.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch word for ${date}: ${res.status}`);
  return (await res.json()) as WordEntry;
}

export async function fetchArchiveIndex(): Promise<ArchiveIndexItem[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/archive-index.json`);
  if (!res.ok) throw new Error(`Failed to fetch archive index: ${res.status}`);
  const items = (await res.json()) as ArchiveIndexItem[];
  return [...items].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function fetchTodayWord(): Promise<WordEntry> {
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

export type { WordEntry, ArchiveIndexItem };
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- wordData`
Expected: PASS — 모든 테스트 통과

- [ ] **Step 5: Commit**

```bash
git add src/lib/wordData.ts src/lib/wordData.test.ts
git commit -m "feat: add word data fetching with today/archive fallback logic"
```

---

### Task 5: 로컬 알림 / 마지막 열람일 로직 (`reminder.ts`)

**Files:**
- Create: `src/lib/reminder.ts`
- Test: `src/lib/reminder.test.ts`

**Interfaces:**
- Produces:
  - `getLastViewedDate(): string | null`
  - `setLastViewedDate(date: string): void`
  - `isNewDaySinceLastView(today: string): boolean`
  - `requestNotificationPermissionAndSync(): Promise<void>`
  Task 8(`TodayPage`)과 Task 10(`App`)이 이 함수들을 import해서 사용함

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { getLastViewedDate, setLastViewedDate, isNewDaySinceLastView } from './reminder';

describe('reminder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing stored', () => {
    expect(getLastViewedDate()).toBeNull();
  });

  it('stores and retrieves the last viewed date', () => {
    setLastViewedDate('2026-07-23');
    expect(getLastViewedDate()).toBe('2026-07-23');
  });

  it('is a new day when nothing was stored before', () => {
    expect(isNewDaySinceLastView('2026-07-23')).toBe(true);
  });

  it('is not a new day when the same date was already viewed', () => {
    setLastViewedDate('2026-07-23');
    expect(isNewDaySinceLastView('2026-07-23')).toBe(false);
  });

  it('is a new day when a different date was last viewed', () => {
    setLastViewedDate('2026-07-22');
    expect(isNewDaySinceLastView('2026-07-23')).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- reminder`
Expected: FAIL — `src/lib/reminder.ts` 모듈이 존재하지 않음

- [ ] **Step 3: 구현 작성**

```ts
const LAST_VIEWED_KEY = 'lastViewedDate';

export function getLastViewedDate(): string | null {
  return localStorage.getItem(LAST_VIEWED_KEY);
}

export function setLastViewedDate(date: string): void {
  localStorage.setItem(LAST_VIEWED_KEY, date);
}

export function isNewDaySinceLastView(today: string): boolean {
  return getLastViewedDate() !== today;
}

export async function requestNotificationPermissionAndSync(): Promise<void> {
  if (typeof Notification === 'undefined') return;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;

  if (!('periodicSync' in registration)) return; // Android Chrome 등 일부 환경만 지원
  try {
    await (registration as any).periodicSync.register('daily-word-check', {
      minInterval: 24 * 60 * 60 * 1000,
    });
  } catch {
    // 미지원/거부 — best-effort이므로 조용히 무시
  }
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- reminder`
Expected: PASS — 5개 테스트 통과

- [ ] **Step 5: Commit**

```bash
git add src/lib/reminder.ts src/lib/reminder.test.ts
git commit -m "feat: add last-viewed-date tracking and best-effort notification sync"
```

---

### Task 6: `WordCard` 컴포넌트

**Files:**
- Create: `src/components/WordCard.tsx`
- Test: `src/components/WordCard.test.tsx`

**Interfaces:**
- Consumes: `WordEntry` from `src/lib/wordTypes.ts` (Task 3)
- Produces: `WordCard({ entry: WordEntry })` — Task 8 (`TodayPage`), Task 9 (`ArchivePage`)가 재사용

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { render, screen } from '@testing-library/react';
import { WordCard } from './WordCard';

const sampleEntry = {
  date: '2026-07-23',
  word: 'awesome',
  partOfSpeech: 'adjective',
  pronunciationKo: '어섬',
  meaningKo: '정말 멋진, 굉장한',
  exampleEn: 'This place is awesome!',
  exampleKo: '이곳 정말 멋지다!',
};

describe('WordCard', () => {
  it('renders all fields of the entry', () => {
    render(<WordCard entry={sampleEntry} />);
    expect(screen.getByText('awesome')).toBeInTheDocument();
    expect(screen.getByText('adjective')).toBeInTheDocument();
    expect(screen.getByText('[어섬]')).toBeInTheDocument();
    expect(screen.getByText('정말 멋진, 굉장한')).toBeInTheDocument();
    expect(screen.getByText('This place is awesome!')).toBeInTheDocument();
    expect(screen.getByText('이곳 정말 멋지다!')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- WordCard`
Expected: FAIL — `src/components/WordCard.tsx` 모듈이 존재하지 않음

- [ ] **Step 3: 구현 작성**

```tsx
import { WordEntry } from '../lib/wordTypes';

interface WordCardProps {
  entry: WordEntry;
}

export function WordCard({ entry }: WordCardProps) {
  return (
    <div className="word-card">
      <p className="word-card__date">{entry.date}</p>
      <h2 className="word-card__word">{entry.word}</h2>
      <p className="word-card__pos">{entry.partOfSpeech}</p>
      <p className="word-card__pronunciation">[{entry.pronunciationKo}]</p>
      <p className="word-card__meaning">{entry.meaningKo}</p>
      <p className="word-card__example-en">{entry.exampleEn}</p>
      <p className="word-card__example-ko">{entry.exampleKo}</p>
    </div>
  );
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- WordCard`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/WordCard.tsx src/components/WordCard.test.tsx
git commit -m "feat: add WordCard component"
```

---

### Task 7: `PixelButton` 컴포넌트

**Files:**
- Create: `src/components/PixelButton.tsx`
- Test: `src/components/PixelButton.test.tsx`

**Interfaces:**
- Produces: `PixelButton` — 표준 HTML button props를 모두 받는 래퍼 (`children`, `onClick`, `className` 등). Task 9, 10이 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PixelButton } from './PixelButton';

describe('PixelButton', () => {
  it('renders children and responds to click', async () => {
    const handleClick = vi.fn();
    render(<PixelButton onClick={handleClick}>클릭</PixelButton>);
    await userEvent.click(screen.getByText('클릭'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- PixelButton`
Expected: FAIL — `src/components/PixelButton.tsx` 모듈이 존재하지 않음

- [ ] **Step 3: 구현 작성**

```tsx
import { ButtonHTMLAttributes, ReactNode } from 'react';

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function PixelButton({ children, className, ...rest }: PixelButtonProps) {
  return (
    <button className={['pixel-button', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  );
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- PixelButton`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/PixelButton.tsx src/components/PixelButton.test.tsx
git commit -m "feat: add PixelButton component"
```

---

### Task 8: `TodayPage`

**Files:**
- Create: `src/pages/TodayPage.tsx`
- Test: `src/pages/TodayPage.test.tsx`

**Interfaces:**
- Consumes: `fetchTodayWord` from `src/lib/wordData.ts` (Task 4), `isNewDaySinceLastView`/`setLastViewedDate` from `src/lib/reminder.ts` (Task 5), `WordCard` from `src/components/WordCard.tsx` (Task 6)
- Produces: `TodayPage()` — Task 10 (`App`)이 사용

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { TodayPage } from './TodayPage';
import * as wordData from '../lib/wordData';
import * as reminder from '../lib/reminder';

describe('TodayPage', () => {
  it('shows the word once loaded', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue({
      date: '2026-07-23',
      word: 'awesome',
      partOfSpeech: 'adjective',
      pronunciationKo: '어섬',
      meaningKo: '정말 멋진',
      exampleEn: 'x',
      exampleKo: 'y',
    });
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});

    render(<TodayPage />);

    expect(screen.getByText('불러오는 중...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('awesome')).toBeInTheDocument());
  });

  it('shows an error message when fetching fails', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockRejectedValue(new Error('네트워크 오류'));

    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText(/오류: 네트워크 오류/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- TodayPage`
Expected: FAIL — `src/pages/TodayPage.tsx` 모듈이 존재하지 않음

- [ ] **Step 3: 구현 작성**

```tsx
import { useEffect, useState } from 'react';
import { fetchTodayWord } from '../lib/wordData';
import { WordEntry } from '../lib/wordTypes';
import { isNewDaySinceLastView, setLastViewedDate } from '../lib/reminder';
import { WordCard } from '../components/WordCard';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entry: WordEntry; isNew: boolean };

export function TodayPage() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    fetchTodayWord()
      .then((entry) => {
        const isNew = isNewDaySinceLastView(entry.date);
        setLastViewedDate(entry.date);
        setState({ status: 'ready', entry, isNew });
      })
      .catch((err: Error) => setState({ status: 'error', message: err.message }));
  }, []);

  if (state.status === 'loading') return <p>불러오는 중...</p>;
  if (state.status === 'error') return <p>오류: {state.message}</p>;

  return (
    <div>
      {state.isNew && <span className="new-badge">NEW</span>}
      <WordCard entry={state.entry} />
    </div>
  );
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- TodayPage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/TodayPage.tsx src/pages/TodayPage.test.tsx
git commit -m "feat: add TodayPage"
```

---

### Task 9: `ArchiveListItem` & `ArchivePage`

**Files:**
- Create: `src/components/ArchiveListItem.tsx`
- Create: `src/pages/ArchivePage.tsx`
- Test: `src/pages/ArchivePage.test.tsx`

**Interfaces:**
- Consumes: `fetchArchiveIndex`, `fetchWordByDate` from `src/lib/wordData.ts` (Task 4), `WordCard` (Task 6), `PixelButton` (Task 7), `ArchiveIndexItem`/`WordEntry` types (Task 3)
- Produces: `ArchivePage()` — Task 10 (`App`)이 사용

- [ ] **Step 1: `ArchiveListItem` 작성 (단순 프레젠테이셔널 컴포넌트, 별도 테스트 없이 `ArchivePage` 테스트로 커버)**

```tsx
import { ArchiveIndexItem } from '../lib/wordTypes';

interface ArchiveListItemProps {
  item: ArchiveIndexItem;
  onSelect: (date: string) => void;
}

export function ArchiveListItem({ item, onSelect }: ArchiveListItemProps) {
  return (
    <li>
      <button className="archive-list-item" onClick={() => onSelect(item.date)}>
        <span>{item.date}</span>
        <strong>{item.word}</strong>
        <span>{item.meaningKo}</span>
      </button>
    </li>
  );
}
```

- [ ] **Step 2: 실패하는 `ArchivePage` 테스트 작성**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArchivePage } from './ArchivePage';
import * as wordData from '../lib/wordData';

describe('ArchivePage', () => {
  it('lists archive items and shows detail on click', async () => {
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' },
    ]);
    vi.spyOn(wordData, 'fetchWordByDate').mockResolvedValue({
      date: '2026-07-23',
      word: 'awesome',
      partOfSpeech: 'adjective',
      pronunciationKo: '어섬',
      meaningKo: '정말 멋진',
      exampleEn: 'x',
      exampleKo: 'y',
    });

    render(<ArchivePage />);

    await waitFor(() => expect(screen.getByText('awesome')).toBeInTheDocument());
    await userEvent.click(screen.getByText('awesome'));

    await waitFor(() => expect(screen.getByText('x')).toBeInTheDocument());
    expect(screen.getByText('← 목록으로')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 테스트 실행하여 실패 확인**

Run: `npm test -- ArchivePage`
Expected: FAIL — `src/pages/ArchivePage.tsx` 모듈이 존재하지 않음

- [ ] **Step 4: `ArchivePage` 구현 작성**

```tsx
import { useEffect, useState } from 'react';
import { fetchArchiveIndex, fetchWordByDate } from '../lib/wordData';
import { ArchiveIndexItem, WordEntry } from '../lib/wordTypes';
import { ArchiveListItem } from '../components/ArchiveListItem';
import { WordCard } from '../components/WordCard';
import { PixelButton } from '../components/PixelButton';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'list'; items: ArchiveIndexItem[] };

export function ArchivePage() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [selected, setSelected] = useState<WordEntry | null>(null);

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
        <WordCard entry={selected} />
      </div>
    );
  }

  if (state.status === 'loading') return <p>불러오는 중...</p>;
  if (state.status === 'error') return <p>오류: {state.message}</p>;

  return (
    <ul>
      {state.items.map((item) => (
        <ArchiveListItem key={item.date} item={item} onSelect={handleSelect} />
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: 테스트 실행하여 통과 확인**

Run: `npm test -- ArchivePage`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ArchiveListItem.tsx src/pages/ArchivePage.tsx src/pages/ArchivePage.test.tsx
git commit -m "feat: add ArchivePage with list and detail view"
```

---

### Task 10: `App` 셸 (탭 전환 + 알림 버튼)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `TodayPage` (Task 8), `ArchivePage` (Task 9), `PixelButton` (Task 7), `requestNotificationPermissionAndSync` from `src/lib/reminder.ts` (Task 5)

- [ ] **Step 1: App.test.tsx를 최종 동작에 맞게 재작성 (실패 상태로 만듦)**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import * as wordData from './lib/wordData';
import * as reminder from './lib/reminder';

describe('App', () => {
  it('switches between Today and Archive tabs', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue({
      date: '2026-07-23',
      word: 'awesome',
      partOfSpeech: 'adjective',
      pronunciationKo: '어섬',
      meaningKo: '정말 멋진',
      exampleEn: 'x',
      exampleKo: 'y',
    });
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([]);
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});

    render(<App />);
    expect(screen.getByText('오늘의 단어')).toBeInTheDocument();

    await userEvent.click(screen.getByText('아카이브'));
    expect(screen.getByText('불러오는 중...')).toBeInTheDocument();
  });

  it('requests notification permission when the bell button is clicked', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue({
      date: '2026-07-23',
      word: 'awesome',
      partOfSpeech: 'adjective',
      pronunciationKo: '어섬',
      meaningKo: '정말 멋진',
      exampleEn: 'x',
      exampleKo: 'y',
    });
    const spy = vi.spyOn(reminder, 'requestNotificationPermissionAndSync').mockResolvedValue();

    render(<App />);
    await userEvent.click(screen.getByText('🔔 알림 켜기'));
    expect(spy).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- App`
Expected: FAIL — 현재 `App.tsx`는 "명예 외국인 앱" 텍스트만 렌더링하므로 탭/버튼을 찾지 못함

- [ ] **Step 3: App.tsx 최종 구현**

```tsx
import { useState } from 'react';
import { TodayPage } from './pages/TodayPage';
import { ArchivePage } from './pages/ArchivePage';
import { PixelButton } from './components/PixelButton';
import { requestNotificationPermissionAndSync } from './lib/reminder';

type Tab = 'today' | 'archive';

export function App() {
  const [tab, setTab] = useState<Tab>('today');

  return (
    <div className="app">
      <h1>명예 외국인</h1>
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
      {tab === 'today' ? <TodayPage /> : <ArchivePage />}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- App`
Expected: PASS

- [ ] **Step 5: 전체 테스트 스위트 실행**

Run: `npm test`
Expected: 지금까지의 모든 테스트 PASS

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire Today/Archive tabs and notification button in App shell"
```

---

### Task 11: 픽셀아트 테마 스타일링

**Files:**
- Create: `src/styles/theme.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `.word-card`, `.pixel-button`, `.tab-bar`, `.new-badge`, `.archive-list-item` 클래스명 (Task 6~10에서 이미 사용 중)

- [ ] **Step 1: 한글 픽셀 폰트 설치 시도**

Run: `npm install @fontsource/galmuri`

두 가지 경우로 나뉜다:
- **설치 성공 시:** `node_modules/@fontsource/galmuri/files` 디렉터리에서 400 weight, normal style의 정확한 파일명을 확인한다.
  Run: `ls node_modules/@fontsource/galmuri/files | grep 400-normal`
  아래 Step 2의 `@font-face` `src` url을 여기서 확인한 실제 파일 경로로 맞춘다.
- **패키지가 존재하지 않을 시:** https://github.com/quiple/galmuri 릴리스에서 `Galmuri11.woff2` 파일을 받아 `public/fonts/Galmuri11.woff2` 에 저장하고, Step 2의 `@font-face` `src`를 `url('/fonts/Galmuri11.woff2')`로 대체한다.

- [ ] **Step 2: `src/styles/theme.css` 작성**

```css
@font-face {
  font-family: 'Galmuri11';
  src: url('@fontsource/galmuri/files/galmuri-11-korean-400-normal.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

:root {
  --color-bg: #b8d8e8;
  --color-wood: #c9a876;
  --color-wood-dark: #a8875c;
  --color-accent-pink: #f4c6d7;
  --color-accent-lavender: #d8c6f4;
  --color-text: #3a3a3a;
  --shadow-pixel: 4px 4px 0 var(--color-wood-dark);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: 'Galmuri11', sans-serif;
}

.app {
  max-width: 480px;
  margin: 0 auto;
  padding: 16px;
}

.tab-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.pixel-button {
  font-family: 'Galmuri11', sans-serif;
  background: var(--color-wood);
  border: 3px solid var(--color-wood-dark);
  box-shadow: var(--shadow-pixel);
  padding: 8px 12px;
  cursor: pointer;
}

.pixel-button:active {
  transform: translate(4px, 4px);
  box-shadow: none;
}

.word-card {
  background: #fff;
  border: 6px solid var(--color-wood-dark);
  box-shadow: var(--shadow-pixel);
  padding: 24px 16px;
  text-align: center;
}

.word-card__word {
  font-size: 2rem;
  margin: 8px 0;
}

.new-badge {
  display: inline-block;
  background: var(--color-accent-pink);
  border: 2px solid var(--color-wood-dark);
  padding: 2px 8px;
  margin-bottom: 8px;
  font-size: 0.75rem;
}

.archive-list-item {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  background: var(--color-accent-lavender);
  border: 2px solid var(--color-wood-dark);
  padding: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  font-family: 'Galmuri11', sans-serif;
}
```

- [ ] **Step 3: main.tsx에 테마 import 추가**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/theme.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: 빌드 및 전체 테스트 확인**

Run: `npm test && npm run build`
Expected: 테스트 전부 PASS, 빌드 성공

- [ ] **Step 5: 개발 서버로 시각 확인**

Run: `npm run dev`
브라우저에서 `http://localhost:5173`에 접속해 파스텔 팔레트/픽셀 폰트/TV 액자 느낌의 카드가 의도대로 보이는지 육안으로 확인한다.

- [ ] **Step 6: Commit**

```bash
git add src/styles/theme.css src/main.tsx package.json package-lock.json
git commit -m "style: apply cozy pixel-art pastel theme"
```

---

### Task 12: PWA 통합 (manifest, 서비스워커, 오프라인 캐싱)

**Files:**
- Modify: `vite.config.ts`
- Create: `scripts/generate-placeholder-icons.mjs`

**Interfaces:**
- Consumes: `pngjs` (Task 1에서 이미 devDependencies에 포함됨)

- [ ] **Step 1: 플레이스홀더 아이콘 생성 스크립트 작성**

```js
import { PNG } from 'pngjs';
import fs from 'node:fs';

function createSolidIcon(size, outPath) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      png.data[idx] = 0xb8;
      png.data[idx + 1] = 0xd8;
      png.data[idx + 2] = 0xe8;
      png.data[idx + 3] = 0xff;
    }
  }
  fs.writeFileSync(outPath, PNG.sync.write(png));
}

createSolidIcon(192, 'public/pwa-192x192.png');
createSolidIcon(512, 'public/pwa-512x512.png');
console.log('Placeholder icons generated at public/pwa-192x192.png and public/pwa-512x512.png');
```

- [ ] **Step 2: 아이콘 생성 실행**

Run: `node scripts/generate-placeholder-icons.mjs`
Expected: `Placeholder icons generated...` 로그 출력, `public/pwa-192x192.png`, `public/pwa-512x512.png` 파일 생성됨

(참고: 이 파스텔 단색 아이콘은 MVP용 placeholder이며, 추후 실제 픽셀아트 아이콘으로 교체 가능)

- [ ] **Step 3: vite.config.ts에 vite-plugin-pwa 설정 추가**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: '명예 외국인',
        short_name: '영단어',
        description: '매일 일상 영단어를 픽셀아트로 만나보세요',
        theme_color: '#b8d8e8',
        background_color: '#b8d8e8',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/data\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'word-data-cache' },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
```

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: `dist/manifest.webmanifest`와 `dist/sw.js`(또는 `registerSW.js`)가 생성됨

- [ ] **Step 5: 빌드 산출물에 PWA 파일이 존재하는지 확인**

Run: `ls dist | grep -E "manifest|sw.js"`
Expected: `manifest.webmanifest`, `sw.js` 두 파일명이 출력됨

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts scripts/generate-placeholder-icons.mjs public/pwa-192x192.png public/pwa-512x512.png
git commit -m "feat: integrate vite-plugin-pwa with manifest and offline caching"
```

---

### Task 13: 단어 생성 로직 (`wordGenerator.mjs`, OpenAI 모킹 테스트)

**Files:**
- Create: `scripts/wordGenerator.mjs`
- Test: `scripts/wordGenerator.test.mjs`
- Modify: `vite.config.ts` (Vitest가 `scripts/**` 테스트도 인식하도록 include 설정 추가)

**Interfaces:**
- Produces:
  - `buildPrompt(recentWords: string[]): string`
  - `parseWordResponse(raw: string): WordEntryWithoutDate` (필드: word, partOfSpeech, pronunciationKo, meaningKo, exampleEn, exampleKo)
  - `getRecentWords(archiveIndex: ArchiveIndexItem[], days?: number, now?: Date): string[]`
  - `generateWordEntry(client, recentWords: string[]): Promise<WordEntryWithoutDate>`
  Task 14의 `generate-word.mjs`가 이 4개 함수를 그대로 import해서 사용함

- [ ] **Step 1: vite.config.ts의 test.include에 scripts 디렉터리 추가**

```ts
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
  },
```

- [ ] **Step 2: 실패하는 테스트 작성**

```js
import { buildPrompt, parseWordResponse, getRecentWords, generateWordEntry } from './wordGenerator.mjs';

describe('buildPrompt', () => {
  it('includes an avoid-list when recentWords is non-empty', () => {
    const prompt = buildPrompt(['awesome', 'chill']);
    expect(prompt).toContain('awesome, chill');
  });

  it('omits the avoid-list section when recentWords is empty', () => {
    const prompt = buildPrompt([]);
    expect(prompt).not.toContain('최근에 이미 다뤘으니');
  });
});

describe('parseWordResponse', () => {
  const validJson = JSON.stringify({
    word: ' awesome ',
    partOfSpeech: 'adjective',
    pronunciationKo: '어섬',
    meaningKo: '정말 멋진',
    exampleEn: 'This place is awesome!',
    exampleKo: '이곳 정말 멋지다!',
  });

  it('returns a trimmed entry for valid JSON', () => {
    expect(parseWordResponse(validJson)).toEqual({
      word: 'awesome',
      partOfSpeech: 'adjective',
      pronunciationKo: '어섬',
      meaningKo: '정말 멋진',
      exampleEn: 'This place is awesome!',
      exampleKo: '이곳 정말 멋지다!',
    });
  });

  it('throws when a required field is missing', () => {
    const missingField = JSON.stringify({ word: 'awesome' });
    expect(() => parseWordResponse(missingField)).toThrow('Missing or invalid field');
  });

  it('throws when the response is not valid JSON', () => {
    expect(() => parseWordResponse('not json')).toThrow('not valid JSON');
  });
});

describe('getRecentWords', () => {
  it('filters out entries older than the cutoff', () => {
    const now = new Date('2026-07-23');
    const archiveIndex = [
      { date: '2026-07-20', word: 'recent', meaningKo: 'x' },
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
                    word: 'awesome',
                    partOfSpeech: 'adjective',
                    pronunciationKo: '어섬',
                    meaningKo: '정말 멋진',
                    exampleEn: 'This place is awesome!',
                    exampleKo: '이곳 정말 멋지다!',
                  }),
                },
              },
            ],
          }),
        },
      },
    };

    const result = await generateWordEntry(fakeClient, ['chill']);
    expect(result.word).toBe('awesome');
    expect(fakeClient.chat.completions.create).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: 테스트 실행하여 실패 확인**

Run: `npm test -- wordGenerator`
Expected: FAIL — `scripts/wordGenerator.mjs` 모듈이 존재하지 않음

- [ ] **Step 4: 구현 작성**

```js
const REQUIRED_FIELDS = ['word', 'partOfSpeech', 'pronunciationKo', 'meaningKo', 'exampleEn', 'exampleKo'];

export function buildPrompt(recentWords) {
  const avoidList =
    recentWords.length > 0
      ? `다음 단어/표현은 최근에 이미 다뤘으니 피해줘: ${recentWords.join(', ')}`
      : '';

  return [
    '너는 한국인 영어 학습자를 위한 "오늘의 단어" 콘텐츠를 만드는 도우미야.',
    '초중급 수준의 일상 회화체에서 자주 쓰이는 영단어 또는 짧은 표현 1개를 골라줘.',
    '반드시 아래 JSON 형식으로만 응답해: {"word": string, "partOfSpeech": string, "pronunciationKo": string, "meaningKo": string, "exampleEn": string, "exampleKo": string}',
    '- pronunciationKo는 한글 발음표기 (예: "어섬")',
    '- exampleEn은 실생활에서 쓸 법한 자연스러운 짧은 문장',
    '- exampleKo는 exampleEn의 자연스러운 한국어 번역',
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

- [ ] **Step 5: 테스트 실행하여 통과 확인**

Run: `npm test -- wordGenerator`
Expected: PASS — 7개 테스트 통과

- [ ] **Step 6: Commit**

```bash
git add scripts/wordGenerator.mjs scripts/wordGenerator.test.mjs vite.config.ts
git commit -m "feat: add word generation prompt/parsing logic with mocked OpenAI tests"
```

---

### Task 14: 단어 생성 메인 스크립트 & GitHub Actions 워크플로우

**Files:**
- Create: `scripts/generate-word.mjs`
- Create: `.github/workflows/generate-word.yml`

**Interfaces:**
- Consumes: `buildPrompt`, `parseWordResponse`, `getRecentWords`, `generateWordEntry` from `scripts/wordGenerator.mjs` (Task 13)

- [ ] **Step 1: 메인 스크립트 작성**

```js
import OpenAI from 'openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateWordEntry, getRecentWords } from './wordGenerator.mjs';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');
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
    console.log(`Word for ${today} already exists, skipping.`);
    return;
  }

  const recentWords = getRecentWords(archiveIndex);
  const client = new OpenAI({ apiKey });
  const entry = await generateWordEntry(client, recentWords);
  entry.date = today;

  await fs.writeFile(path.join(WORDS_DIR, `${today}.json`), JSON.stringify(entry, null, 2) + '\n');

  archiveIndex.unshift({ date: today, word: entry.word, meaningKo: entry.meaningKo });
  await fs.writeFile(INDEX_PATH, JSON.stringify(archiveIndex, null, 2) + '\n');

  console.log(`Generated word for ${today}: ${entry.word}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: OPENAI_API_KEY 없이 실행해 에러 처리 확인**

Run: `node scripts/generate-word.mjs`
Expected: `Error: OPENAI_API_KEY is not set` 출력 후 종료 코드 1

- [ ] **Step 3: (선택) 실제 키로 로컬 실행해 정상 동작 확인**

로컬에 `OPENAI_API_KEY` 환경변수를 설정한 뒤 실행:

Run: `OPENAI_API_KEY=sk-... node scripts/generate-word.mjs`
Expected: `Generated word for {오늘 날짜}: {단어}` 출력, `public/data/words/{오늘 날짜}.json` 생성, `public/data/archive-index.json`에 항목 추가됨

(주의: 실제 API 키를 셸 히스토리나 커밋에 남기지 않도록 주의)

- [ ] **Step 4: GitHub Actions 워크플로우 작성**

```yaml
name: Generate Daily Word

on:
  schedule:
    - cron: '0 15 * * *' # 매일 15:00 UTC = 00:00 KST (다음날)
  workflow_dispatch: {}

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: node scripts/generate-word.mjs
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      - name: Commit generated word
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/data
          git diff --cached --quiet || git commit -m "chore: add word of the day"
          git push
```

- [ ] **Step 5: YAML 문법 확인**

Run: `node -e "require('js-yaml') || true"` 대신, 간단히 아래로 문법 오류만 확인:

Run: `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/generate-word.yml'))" 2>&1 || echo "python/yaml 미설치 시 생략 가능 - GitHub Actions가 push 후 자체 검증"`

Expected: 오류 없이 종료 (python/yaml이 없는 환경이면 이 스텝은 생략하고 GitHub에 push 후 Actions 탭에서 워크플로우가 인식되는지로 확인)

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-word.mjs .github/workflows/generate-word.yml
git commit -m "feat: add daily word generation script and scheduled GitHub Action"
```

---

### Task 15: GitHub Pages 배포 워크플로우 & 최초 배포 설정

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `npm run build` (Task 1에서 정의된 스크립트), Task 12의 vite-plugin-pwa 빌드 산출물

- [ ] **Step 1: 기본 브랜치를 main으로 통일**

Run: `git branch -M main`
Expected: 현재 브랜치가 `main`으로 이름 변경됨 (`git branch` 실행 시 `* main` 출력)

- [ ] **Step 2: 배포 워크플로우 작성**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch: {}

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
        env:
          VITE_BASE_PATH: /${{ github.event.repository.name }}/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: README.md에 배포/운영 안내 작성**

```markdown
# 명예 외국인

매일 초중급 일상 회화체 영단어 1개를 픽셀아트 스타일로 보여주는 PWA입니다.

## 로컬 개발

\`\`\`bash
npm install
npm run dev
\`\`\`

## 테스트

\`\`\`bash
npm test
\`\`\`

## GitHub 저장소 최초 설정 (수동, 1회)

1. GitHub에 새 저장소를 만들고 이 프로젝트를 push합니다.
   \`\`\`bash
   git remote add origin <저장소 URL>
   git push -u origin main
   \`\`\`
2. 저장소 Settings > Secrets and variables > Actions 에서 `OPENAI_API_KEY` 시크릿을 등록합니다. (본인의 OpenAI API 키, 절대 커밋하지 않습니다)
3. 저장소 Settings > Pages 에서 Source를 "GitHub Actions"로 설정합니다.
4. Actions 탭에서 `Generate Daily Word` 워크플로우를 `workflow_dispatch`로 한 번 수동 실행해 정상 동작을 확인합니다.
5. main에 push되면 `Deploy to GitHub Pages` 워크플로우가 자동으로 사이트를 배포합니다.

## 매일 단어 생성 방식

GitHub Actions가 매일 정해진 시각(UTC 15:00 = KST 00:00)에 OpenAI API를 호출해 `public/data/words/YYYY-MM-DD.json`을 생성하고 커밋합니다. 브라우저는 이 정적 JSON만 읽으므로 OpenAI 키가 클라이언트에 노출되지 않습니다.
```

- [ ] **Step 4: 전체 테스트 & 빌드 최종 확인**

Run: `npm test && npm run build`
Expected: 모든 테스트 PASS, 빌드 성공

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "feat: add GitHub Pages deploy workflow and setup instructions"
```

- [ ] **Step 6: (사용자 수동 작업) GitHub 저장소 생성 및 push**

이 단계는 사용자 본인의 GitHub 계정/자격 증명이 필요하므로 에이전트가 대신 실행하지 않고, 사용자가 README의 "GitHub 저장소 최초 설정" 안내에 따라 직접 수행한다. 완료 후 GitHub Actions 탭에서 두 워크플로우가 정상 동작하는지 확인한다.

---

## 완료 후 검증 체크리스트

- [ ] `npm test` 전체 통과
- [ ] `npm run build` 성공
- [ ] `npm run dev`로 로컬에서 픽셀아트 테마가 의도대로 보임
- [ ] GitHub Pages 배포 후 Lighthouse PWA 감사에서 "설치 가능(Installable)" 통과
- [ ] `Generate Daily Word` 워크플로우를 수동 실행했을 때 새 날짜 JSON이 커밋됨
