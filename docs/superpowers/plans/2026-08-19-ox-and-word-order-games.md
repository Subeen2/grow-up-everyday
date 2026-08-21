# OX 퀴즈 / 단어 순서배치 게임 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 영어 트랙 `TodayPage`의 "다른 단어 보기" 챌린지에 타이핑 외 OX 퀴즈, 단어 순서배치 게임을 추가하고, 챌린지 진입 시마다 셋 중 하나를 무작위로 보여준다.

**Architecture:** 순수 로직(문제 구성, 정답 판정, 타입 무작위 선택)을 `src/lib/challengeSelection.ts`, `src/lib/oxChallenge.ts`, `src/lib/wordOrderChallenge.ts`로 분리하고, 각각의 판정 UI를 `OxChallenge`, `WordOrderChallenge` 컴포넌트로 구현한다. 세 챌린지 컴포넌트는 모두 `onSuccess: () => void`만 호출하는 동일 계약을 따르며, 어떤 챌린지를 보여줄지 고르는 책임과 "정답 시 다음 단어로 교체" 책임은 기존과 동일하게 `TodayPage`/`useWordOfDayState`가 갖는다.

**Tech Stack:** React 18 + TypeScript, Vitest + React Testing Library (기존 스택 그대로, 신규 의존성 없음).

**Spec:** `docs/superpowers/specs/2026-08-19-ox-and-word-order-games-design.md`

## Global Constraints

- 영어 트랙(`TodayPage.tsx`)만 대상. 일본어 트랙(`JaTodayPage.tsx`, `VoiceChallenge`)은 변경하지 않는다
- `useWordOfDayState` 훅(언어 무관 제네릭)은 수정하지 않는다 — 챌린지 종류 선택은 `TodayPage`의 로컬 상태로만 처리
- "다른 단어 보기" 클릭마다 타이핑/OX/순서배치 중 하나를 무작위로 뽑아 보여준다 (`pickRandomChallengeType`)
- OX 퀴즈: 단어+뜻 조합을 보여주고 50% 확률로 다른 단어의 뜻으로 치환. 후보(다른 아카이브 단어)가 없으면 항상 참 문제로 대체한다
- 순서배치 게임: `exampleEn`을 공백 기준으로 토큰화해 셔플, 탭한 순서대로 조립. 마지막 토큰 탭 시 자동 채점하고, 오답이면 셔플을 리셋해 재시도시킨다 (드래그앤드롭 없음, 탭 방식만)
- 세 챌린지 컴포넌트 모두 `onSuccess()` 호출만 책임지고, 다음 단어 선택/카드 교체는 `TodayPage`가 담당 (기존 `TypingChallenge` 계약과 동일)
- 프론트엔드 테스트는 Vitest + React Testing Library, `vi.spyOn(Math, 'random')`로 무작위성을 확정적으로 재현 (기존 `typingChallenge.test.ts` 패턴 따름)
- 이 저장소에는 이 계획과 무관한 신규 기능(빈칸 채우기 게임 `GamePage`/`JaGamePage`/`WordBlankGame`)이 별도 탭으로 이미 존재한다 — 이 플랜은 그 파일들을 건드리지 않으며 참고할 필요도 없다
- 참고 spec: `docs/superpowers/specs/2026-08-19-ox-and-word-order-games-design.md`

---

### Task 1: 챌린지 타입 무작위 선택 로직 (`challengeSelection.ts`)

**Files:**
- Create: `src/lib/challengeSelection.ts`
- Test: `src/lib/challengeSelection.test.ts`

**Interfaces:**
- Produces:
  - `export type ChallengeType = 'typing' | 'ox' | 'order'`
  - `pickRandomChallengeType(): ChallengeType`
  이 타입과 함수는 Task 6(`TodayPage`)이 import해서 사용함

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { pickRandomChallengeType } from './challengeSelection';

describe('pickRandomChallengeType', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "typing" when Math.random is at the low end', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickRandomChallengeType()).toBe('typing');
  });

  it('returns "ox" for the middle third', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.34);
    expect(pickRandomChallengeType()).toBe('ox');
  });

  it('returns "order" for the high third', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.67);
    expect(pickRandomChallengeType()).toBe('order');
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- challengeSelection`
Expected: FAIL — `src/lib/challengeSelection.ts` 모듈이 존재하지 않음

- [ ] **Step 3: 구현 작성**

```ts
export type ChallengeType = 'typing' | 'ox' | 'order';

const CHALLENGE_TYPES: ChallengeType[] = ['typing', 'ox', 'order'];

export function pickRandomChallengeType(): ChallengeType {
  return CHALLENGE_TYPES[Math.floor(Math.random() * CHALLENGE_TYPES.length)];
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- challengeSelection`
Expected: PASS — 3개 테스트 통과

- [ ] **Step 5: Commit**

```bash
git add src/lib/challengeSelection.ts src/lib/challengeSelection.test.ts
git commit -m "feat: add random challenge-type selection"
```

---

### Task 2: OX 문제 구성 로직 (`oxChallenge.ts`)

**Files:**
- Create: `src/lib/oxChallenge.ts`
- Test: `src/lib/oxChallenge.test.ts`

**Interfaces:**
- Consumes: `ArchiveIndexItem` from `src/lib/wordTypes.ts` (기존), `pickRandomOtherWord` from `src/lib/typingChallenge.ts` (기존)
- Produces:
  - `export interface OxQuestion { word: string; shownMeaning: string; isTrue: boolean }`
  - `buildOxQuestion(targetEntry: ArchiveIndexItem, archivePool: ArchiveIndexItem[]): OxQuestion`
  이 타입과 함수는 Task 3(`OxChallenge`)이 사용함

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { buildOxQuestion } from './oxChallenge';
import { ArchiveIndexItem } from './wordTypes';

const target: ArchiveIndexItem = { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' };
const other: ArchiveIndexItem = { date: '2026-07-20', word: 'figure out', meaningKo: '알아내다' };

describe('buildOxQuestion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the real meaning and isTrue: true when the coin flip lands on true', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9); // wantsFalse = false

    const question = buildOxQuestion(target, [target, other]);

    expect(question).toEqual({ word: 'awesome', shownMeaning: '정말 멋진', isTrue: true });
  });

  it('falls back to the real meaning when there is no other candidate, even if the coin flip wants false', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1); // wantsFalse = true

    const question = buildOxQuestion(target, [target]);

    expect(question).toEqual({ word: 'awesome', shownMeaning: '정말 멋진', isTrue: true });
  });

  it('substitutes another entry\'s meaning and isTrue: false when the coin flip wants false and a candidate exists', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1) // wantsFalse = true
      .mockReturnValueOnce(0); // pickRandomOtherWord picks the first candidate

    const question = buildOxQuestion(target, [target, other]);

    expect(question).toEqual({ word: 'awesome', shownMeaning: '알아내다', isTrue: false });
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- oxChallenge`
Expected: FAIL — `src/lib/oxChallenge.ts` 모듈이 존재하지 않음

- [ ] **Step 3: 구현 작성**

```ts
import { ArchiveIndexItem } from './wordTypes';
import { pickRandomOtherWord } from './typingChallenge';

export interface OxQuestion {
  word: string;
  shownMeaning: string;
  isTrue: boolean;
}

export function buildOxQuestion(targetEntry: ArchiveIndexItem, archivePool: ArchiveIndexItem[]): OxQuestion {
  const wantsFalse = Math.random() < 0.5;
  const other = wantsFalse ? pickRandomOtherWord(archivePool, targetEntry.date) : null;

  return {
    word: targetEntry.word,
    shownMeaning: other ? other.meaningKo : targetEntry.meaningKo,
    isTrue: other === null,
  };
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- oxChallenge`
Expected: PASS — 3개 테스트 통과

- [ ] **Step 5: Commit**

```bash
git add src/lib/oxChallenge.ts src/lib/oxChallenge.test.ts
git commit -m "feat: add OX question builder"
```

---

### Task 3: `OxChallenge` 컴포넌트

**Files:**
- Create: `src/components/OxChallenge.tsx`
- Test: `src/components/OxChallenge.test.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `buildOxQuestion`, `OxQuestion` from `src/lib/oxChallenge.ts` (Task 2), `ArchiveIndexItem` from `src/lib/wordTypes.ts` (기존), `PixelButton` (기존)
- Produces: `OxChallenge({ targetEntry: ArchiveIndexItem, archivePool: ArchiveIndexItem[], onSuccess: () => void })` — Task 6(`TodayPage`)이 사용

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OxChallenge } from './OxChallenge';

const target = { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' };
const other = { date: '2026-07-20', word: 'figure out', meaningKo: '알아내다' };

describe('OxChallenge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the word and a meaning, and calls onSuccess when "O" is picked for a true question', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9); // wantsFalse = false
    const onSuccess = vi.fn();

    render(<OxChallenge targetEntry={target} archivePool={[target, other]} onSuccess={onSuccess} />);

    expect(screen.getByText('awesome - 정말 멋진')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'O' }));

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('shows a wrong-answer message and does not call onSuccess when the wrong button is picked', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9); // wantsFalse = false, so this is a true question
    const onSuccess = vi.fn();

    render(<OxChallenge targetEntry={target} archivePool={[target, other]} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole('button', { name: 'X' }));

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('땡! 다시 골라보세요')).toBeInTheDocument();
  });

  it('allows retrying after a wrong answer', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9); // wantsFalse = false, so this is a true question
    const onSuccess = vi.fn();

    render(<OxChallenge targetEntry={target} archivePool={[target, other]} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole('button', { name: 'X' }));
    expect(onSuccess).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'O' }));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('substitutes another meaning and calls onSuccess when "X" is picked for a false question', async () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1) // wantsFalse = true
      .mockReturnValueOnce(0); // pickRandomOtherWord picks the first candidate
    const onSuccess = vi.fn();

    render(<OxChallenge targetEntry={target} archivePool={[target, other]} onSuccess={onSuccess} />);

    expect(screen.getByText('awesome - 알아내다')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'X' }));

    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- OxChallenge`
Expected: FAIL — `src/components/OxChallenge.tsx` 모듈이 존재하지 않음

- [ ] **Step 3: 구현 작성**

```tsx
import { useState } from 'react';
import { buildOxQuestion, OxQuestion } from '../lib/oxChallenge';
import { ArchiveIndexItem } from '../lib/wordTypes';
import { PixelButton } from './PixelButton';

interface OxChallengeProps {
  targetEntry: ArchiveIndexItem;
  archivePool: ArchiveIndexItem[];
  onSuccess: () => void;
}

export function OxChallenge({ targetEntry, archivePool, onSuccess }: OxChallengeProps) {
  const [question] = useState<OxQuestion>(() => buildOxQuestion(targetEntry, archivePool));
  const [incorrect, setIncorrect] = useState(false);

  function handleAnswer(answer: boolean) {
    if (answer === question.isTrue) {
      onSuccess();
      return;
    }
    setIncorrect(true);
  }

  return (
    <div className="ox-challenge">
      <p className="ox-challenge__prompt">
        {question.word} - {question.shownMeaning}
      </p>
      <div className="ox-challenge__buttons">
        <PixelButton onClick={() => handleAnswer(true)}>O</PixelButton>
        <PixelButton onClick={() => handleAnswer(false)}>X</PixelButton>
      </div>
      {incorrect && <p className="ox-challenge__wrong">땡! 다시 골라보세요</p>}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- OxChallenge`
Expected: PASS — 4개 테스트 통과

- [ ] **Step 5: `theme.css`에 스타일 추가**

`src/styles/theme.css`의 `.typing-challenge__empty` 규칙 뒤에 추가:

```css
.ox-challenge {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ox-challenge__prompt {
  background: #fff;
  border: 2px solid var(--color-wood-dark);
  padding: 12px;
  text-align: center;
}

.ox-challenge__buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.ox-challenge__wrong {
  color: #b23b3b;
  font-size: 0.9rem;
  text-align: center;
}
```

- [ ] **Step 6: 빌드 확인**

Run: `npm run build`
Expected: 오류 없이 빌드 성공

- [ ] **Step 7: Commit**

```bash
git add src/components/OxChallenge.tsx src/components/OxChallenge.test.tsx src/styles/theme.css
git commit -m "feat: add OxChallenge component with pixel-art styling"
```

---

### Task 4: 순서배치 판정 로직 (`wordOrderChallenge.ts`)

**Files:**
- Create: `src/lib/wordOrderChallenge.ts`
- Test: `src/lib/wordOrderChallenge.test.ts`

**Interfaces:**
- Produces:
  - `tokenize(sentence: string): string[]`
  - `shuffleTokens(tokens: string[]): string[]`
  - `isCorrectOrder(submitted: string[], target: string[]): boolean`
  이 3개 함수는 Task 5(`WordOrderChallenge`)가 사용함

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { tokenize, shuffleTokens, isCorrectOrder } from './wordOrderChallenge';

describe('tokenize', () => {
  it('splits on spaces', () => {
    expect(tokenize('You should take it easy.')).toEqual(['You', 'should', 'take', 'it', 'easy.']);
  });

  it('filters out empty tokens from repeated spaces', () => {
    expect(tokenize('a  b')).toEqual(['a', 'b']);
  });
});

describe('shuffleTokens', () => {
  it('returns the same tokens as a set, possibly reordered', () => {
    const tokens = ['You', 'should', 'take', 'it', 'easy.'];

    const shuffled = shuffleTokens(tokens);

    expect([...shuffled].sort()).toEqual([...tokens].sort());
    expect(shuffled).not.toBe(tokens);
  });
});

describe('isCorrectOrder', () => {
  it('is true when submitted matches target exactly', () => {
    expect(isCorrectOrder(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
  });

  it('is false when the order differs', () => {
    expect(isCorrectOrder(['b', 'a', 'c'], ['a', 'b', 'c'])).toBe(false);
  });

  it('is false when the lengths differ', () => {
    expect(isCorrectOrder(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- wordOrderChallenge`
Expected: FAIL — `src/lib/wordOrderChallenge.ts` 모듈이 존재하지 않음

- [ ] **Step 3: 구현 작성**

```ts
export function tokenize(sentence: string): string[] {
  return sentence.split(' ').filter((token) => token.length > 0);
}

export function shuffleTokens(tokens: string[]): string[] {
  const result = [...tokens];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function isCorrectOrder(submitted: string[], target: string[]): boolean {
  return submitted.length === target.length && submitted.every((token, i) => token === target[i]);
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- wordOrderChallenge`
Expected: PASS — 6개 테스트 통과

- [ ] **Step 5: Commit**

```bash
git add src/lib/wordOrderChallenge.ts src/lib/wordOrderChallenge.test.ts
git commit -m "feat: add tokenize/shuffle/order-check logic for word-order challenge"
```

---

### Task 5: `WordOrderChallenge` 컴포넌트

**Files:**
- Create: `src/components/WordOrderChallenge.tsx`
- Test: `src/components/WordOrderChallenge.test.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `tokenize`, `shuffleTokens`, `isCorrectOrder` from `src/lib/wordOrderChallenge.ts` (Task 4), `PixelButton` (기존)
- Produces: `WordOrderChallenge({ targetSentence: string, onSuccess: () => void })` — Task 6(`TodayPage`)이 사용

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WordOrderChallenge } from './WordOrderChallenge';

describe('WordOrderChallenge', () => {
  it('assembles the sentence and calls onSuccess when tapped in the correct order', async () => {
    const onSuccess = vi.fn();
    render(<WordOrderChallenge targetSentence="You should take it easy." onSuccess={onSuccess} />);

    for (const word of ['You', 'should', 'take', 'it', 'easy.']) {
      await userEvent.click(screen.getByRole('button', { name: word }));
    }

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('shows the assembled sentence as tokens are tapped', async () => {
    const onSuccess = vi.fn();
    render(<WordOrderChallenge targetSentence="You should take it easy." onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole('button', { name: 'You' }));
    await userEvent.click(screen.getByRole('button', { name: 'should' }));

    expect(screen.getByText('You should')).toBeInTheDocument();
  });

  it('shows a wrong-order message, does not call onSuccess, and resets so it can be retried', async () => {
    const onSuccess = vi.fn();
    render(<WordOrderChallenge targetSentence="You should take it easy." onSuccess={onSuccess} />);

    for (const word of ['should', 'You', 'take', 'it', 'easy.']) {
      await userEvent.click(screen.getByRole('button', { name: word }));
    }

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('순서가 달라요! 다시 시도해보세요')).toBeInTheDocument();

    for (const word of ['You', 'should', 'take', 'it', 'easy.']) {
      await userEvent.click(screen.getByRole('button', { name: word }));
    }

    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- WordOrderChallenge`
Expected: FAIL — `src/components/WordOrderChallenge.tsx` 모듈이 존재하지 않음

- [ ] **Step 3: 구현 작성**

```tsx
import { useState } from 'react';
import { tokenize, shuffleTokens, isCorrectOrder } from '../lib/wordOrderChallenge';
import { PixelButton } from './PixelButton';

interface WordOrderChallengeProps {
  targetSentence: string;
  onSuccess: () => void;
}

export function WordOrderChallenge({ targetSentence, onSuccess }: WordOrderChallengeProps) {
  const targetTokens = tokenize(targetSentence);
  const [remaining, setRemaining] = useState<string[]>(() => shuffleTokens(targetTokens));
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [incorrect, setIncorrect] = useState(false);

  function handlePick(index: number) {
    const token = remaining[index];
    const nextSubmitted = [...submitted, token];
    const nextRemaining = remaining.filter((_, i) => i !== index);

    if (nextRemaining.length === 0) {
      if (isCorrectOrder(nextSubmitted, targetTokens)) {
        onSuccess();
        return;
      }
      setIncorrect(true);
      setSubmitted([]);
      setRemaining(shuffleTokens(targetTokens));
      return;
    }

    setSubmitted(nextSubmitted);
    setRemaining(nextRemaining);
  }

  return (
    <div className="word-order-challenge">
      <p className="word-order-challenge__assembled">{submitted.join(' ')}</p>
      <div className="word-order-challenge__tokens">
        {remaining.map((token, index) => (
          <PixelButton key={`${token}-${index}`} onClick={() => handlePick(index)}>
            {token}
          </PixelButton>
        ))}
      </div>
      {incorrect && <p className="word-order-challenge__wrong">순서가 달라요! 다시 시도해보세요</p>}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- WordOrderChallenge`
Expected: PASS — 3개 테스트 통과

- [ ] **Step 5: `theme.css`에 스타일 추가**

`src/styles/theme.css`의 `.ox-challenge__wrong` 규칙 뒤에 추가:

```css
.word-order-challenge {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.word-order-challenge__assembled {
  background: #fff;
  border: 2px solid var(--color-wood-dark);
  padding: 12px;
  min-height: 1.5em;
}

.word-order-challenge__tokens {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.word-order-challenge__wrong {
  color: #b23b3b;
  font-size: 0.9rem;
}
```

- [ ] **Step 6: 빌드 확인**

Run: `npm run build`
Expected: 오류 없이 빌드 성공

- [ ] **Step 7: Commit**

```bash
git add src/components/WordOrderChallenge.tsx src/components/WordOrderChallenge.test.tsx src/styles/theme.css
git commit -m "feat: add WordOrderChallenge component with pixel-art styling"
```

---

### Task 6: `TodayPage`에 세 챌린지 무작위 통합

**Files:**
- Modify: `src/pages/TodayPage.tsx`
- Modify: `src/pages/TodayPage.test.tsx`

**Interfaces:**
- Consumes: `pickRandomChallengeType`, `ChallengeType` from `src/lib/challengeSelection.ts` (Task 1), `OxChallenge` from `src/components/OxChallenge.tsx` (Task 3), `WordOrderChallenge` from `src/components/WordOrderChallenge.tsx` (Task 5), 나머지는 기존 그대로

- [ ] **Step 1: 기존 테스트 파일에 새 챌린지 타입 테스트 2개 추가 + 타이핑 테스트에 타입 고정 추가 (실패 상태로 만듦)**

`src/pages/TodayPage.test.tsx`의 import 목록에 다음을 추가한다:

```tsx
import * as challengeSelection from '../lib/challengeSelection';
```

`describe('TodayPage', () => {` 바로 다음의 `beforeEach`를 다음으로 교체한다:

```tsx
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
```

`'shows the typing challenge after clicking "다른 단어 보기", swaps the word on a correct answer, and returns to today on request'` 테스트의 첫 줄(맨 위)에 다음을 추가한다:

```tsx
    vi.spyOn(challengeSelection, 'pickRandomChallengeType').mockReturnValue('typing');
```

파일 맨 끝, 마지막 `it(...)` 블록과 닫는 `});` 사이에 다음 두 테스트를 추가한다:

```tsx
  it('shows the OX challenge when that type is picked, and swaps the word on a correct answer', async () => {
    const otherEntry = {
      ...todayEntry,
      date: '2026-07-20',
      word: 'figure out',
      meaningKo: '알아내다',
      exampleEn: 'Let me figure it out.',
      exampleKo: '내가 알아낼게.',
    };

    vi.spyOn(challengeSelection, 'pickRandomChallengeType').mockReturnValue('ox');
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // wantsFalse = false -> true question
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
    expect(screen.getByRole('button', { name: 'O' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'O' }));

    await waitFor(() => expect(screen.getByText('figure out')).toBeInTheDocument());
  });

  it('shows the word-order challenge when that type is picked, and swaps the word when tapped in the correct order', async () => {
    const otherEntry = {
      ...todayEntry,
      date: '2026-07-20',
      word: 'figure out',
      meaningKo: '알아내다',
      exampleEn: 'Let me figure it out.',
      exampleKo: '내가 알아낼게.',
    };

    vi.spyOn(challengeSelection, 'pickRandomChallengeType').mockReturnValue('order');
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue({ ...todayEntry, exampleEn: 'Take it easy.' });
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

    for (const word of ['Take', 'it', 'easy.']) {
      await userEvent.click(screen.getByRole('button', { name: word }));
    }

    await waitFor(() => expect(screen.getByText('figure out')).toBeInTheDocument());
  });
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- TodayPage`
Expected: FAIL — `TodayPage`가 항상 `TypingChallenge`만 렌더링하므로 새 두 테스트가 실패함 (`O` 버튼, `Take` 버튼을 찾지 못함)

- [ ] **Step 3: `TodayPage.tsx` 수정**

```tsx
import { useState } from 'react';
import { fetchTodayWord, fetchArchiveIndex, fetchWordByDate } from '../lib/wordData';
import { useWordOfDayState } from '../lib/useWordOfDayState';
import { pickRandomChallengeType, ChallengeType } from '../lib/challengeSelection';
import { WordCard } from '../components/WordCard';
import { PixelButton } from '../components/PixelButton';
import { TypingChallenge } from '../components/TypingChallenge';
import { OxChallenge } from '../components/OxChallenge';
import { WordOrderChallenge } from '../components/WordOrderChallenge';
import { Celebration } from '../components/Celebration';

export function TodayPage() {
  const { state, celebrating, setCelebrating, showChallenge, handleChallengeSuccess, handleBackToToday } =
    useWordOfDayState({ fetchTodayWord, fetchArchiveIndex, fetchWordByDate }, 'en');
  const [challengeType, setChallengeType] = useState<ChallengeType>('typing');

  if (state.status === 'loading') return <p>불러오는 중...</p>;
  if (state.status === 'error') return <p>오류: {state.message}</p>;

  const { todayEntry, displayedEntry, archivePool, isNew, challengeVisible } = state;
  const hasOtherWord = archivePool.some((item) => item.date !== displayedEntry.date);
  const isShowingToday = displayedEntry.date === todayEntry.date;

  function handleShowChallenge() {
    setChallengeType(pickRandomChallengeType());
    showChallenge();
  }

  return (
    <div>
      {isNew && isShowingToday && <span className="new-badge">NEW</span>}
      <WordCard entry={displayedEntry} hideExampleEn={challengeVisible} />
      {!isShowingToday && <PixelButton onClick={handleBackToToday}>오늘의 단어로</PixelButton>}
      {!challengeVisible && (
        <>
          <PixelButton onClick={handleShowChallenge} disabled={!hasOtherWord}>
            다른 단어 보기
          </PixelButton>
          {!hasOtherWord && <p className="typing-challenge__empty">아직 연습할 다른 단어가 없어요</p>}
        </>
      )}
      {challengeVisible && challengeType === 'typing' && (
        <TypingChallenge targetSentence={displayedEntry.exampleEn} onSuccess={handleChallengeSuccess} />
      )}
      {challengeVisible && challengeType === 'ox' && (
        <OxChallenge targetEntry={displayedEntry} archivePool={archivePool} onSuccess={handleChallengeSuccess} />
      )}
      {challengeVisible && challengeType === 'order' && (
        <WordOrderChallenge targetSentence={displayedEntry.exampleEn} onSuccess={handleChallengeSuccess} />
      )}
      {celebrating && <Celebration onDone={() => setCelebrating(false)} />}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test -- TodayPage`
Expected: PASS — 9개 테스트 통과

- [ ] **Step 5: 전체 테스트 스위트 & 빌드 실행**

Run: `npm test && npm run build`
Expected: 모든 테스트 PASS, 빌드 성공

- [ ] **Step 6: Commit**

```bash
git add src/pages/TodayPage.tsx src/pages/TodayPage.test.tsx
git commit -m "feat: randomly choose typing/OX/word-order challenge on TodayPage"
```

---

## 완료 후 검증 체크리스트

- [ ] `npm test` 전체 통과
- [ ] `npm run build` 성공
- [ ] `npm run dev`로 로컬에서 "다른 단어 보기"를 여러 번 눌러 타이핑/OX/순서배치 세 화면이 모두 나타나는지, 각각 정답 시 카드가 교체되는지 육안으로 확인
