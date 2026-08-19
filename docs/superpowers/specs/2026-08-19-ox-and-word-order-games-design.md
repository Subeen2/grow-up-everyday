# 오늘의 단어 — OX 퀴즈 / 단어 순서배치 게임 추가 설계 문서

**작성일:** 2026-08-19
**상태:** 승인됨 (브레인스토밍 완료)

## 1. 배경 및 목적

영어 트랙의 "다른 단어 보기" 챌린지는 현재 타이핑(`TypingChallenge`) 한 종류뿐이다. 매번 같은 유형을 반복하면 지루해지므로, OX 퀴즈와 단어 순서배치 게임 두 종류를 추가하고 챌린지 진입 시마다 셋 중 하나를 무작위로 보여준다.

- 범위: **영어 트랙만** (`TodayPage.tsx`). 일본어 트랙(`JaTodayPage.tsx`, `VoiceChallenge`)은 이번 변경 대상이 아니다.
- 기존 `TypingChallenge`와 `useWordOfDayState` 훅의 판정/전환 로직(정답 시 다음 단어로 교체, `challengeVisible` 리셋 등)은 그대로 재사용한다. 이 훅은 언어에 무관한 제네릭 훅이라 수정하지 않는다.

## 2. 핵심 기능 범위

### 2.1 챌린지 종류 무작위 선택

- `TodayPage`에 로컬 상태 `challengeType: 'typing' | 'ox' | 'order'`를 추가한다.
- "다른 단어 보기" 클릭 시: `showChallenge()` 호출과 함께 `pickRandomChallengeType()`으로 새 타입을 뽑아 저장한다.
- `challengeVisible`이 `true`인 동안 `challengeType`에 따라 `TypingChallenge` / `OxChallenge` / `WordOrderChallenge` 중 하나만 렌더링한다.
- 세 컴포넌트 모두 동일한 계약을 따른다: `onSuccess: () => void`만 호출하면 되고, 다음 단어로 넘어가는 책임은 기존과 동일하게 `TodayPage`/`useWordOfDayState`에 있다.

### 2.2 OX 퀴즈 (`OxChallenge`)

- Props: `targetEntry: { word: string; meaningKo: string }`, `archivePool: ArchiveIndexItem[]`, `onSuccess: () => void`
- 마운트 시 1회, 50% 확률로 문제를 구성한다:
  - **참 문제**: `targetEntry.word` + `targetEntry.meaningKo` 그대로 표시
  - **거짓 문제**: `targetEntry.word` + `pickRandomOtherWord(archivePool, targetEntry.date)`로 고른 다른 항목의 `meaningKo`로 치환
    - 후보가 없으면(아카이브에 다른 단어가 없으면) 항상 참 문제로 대체한다 — "다른 단어 보기" 버튼이 이미 이 경우 비활성화되어 있어 실제로는 발생하지 않지만 방어적으로 처리한다.
- "O" / "X" 두 버튼을 보여준다. 사용자가 실제 참/거짓과 일치하는 버튼을 누르면 `onSuccess()` 호출.
- 오답이면 "땡!" 같은 짧은 안내 문구를 보여주고, 같은 문제를 계속 시도할 수 있게 둔다 (재구성하지 않음, 진행을 막지 않음 — 타이핑 챌린지의 오답 재시도 정책과 동일한 원칙).

### 2.3 단어 순서배치 게임 (`WordOrderChallenge`)

- Props: `targetSentence: string` (= `exampleEn`), `onSuccess: () => void`
- 마운트 시 1회: `targetSentence.split(' ')`로 토큰화 후 셔플한 목록을 버튼으로 보여준다.
  - 토큰이 1개 이하면(공백 없는 문장) 즉시 정답 처리하지 않고, 그 토큰 하나만 탭하면 바로 성공 처리된다 (자연스러운 퇴화 케이스, 별도 분기 불필요).
- 사용자가 토큰 버튼을 순서대로 탭하면, 탭한 토큰은 상단 "조립된 문장" 영역에 순서대로 쌓이고 하단 후보 목록에서는 사라진다(이미 사용한 토큰 재탭 방지).
- 마지막 토큰을 탭한 시점에 자동 채점한다:
  - 조립된 순서가 원본 토큰 순서와 정확히 일치하면 `onSuccess()` 호출.
  - 불일치하면 오답 문구를 보여주고 셔플된 토큰 목록을 초기 상태로 리셋해서 다시 시도하게 한다 (부분 점수/힌트 없음).

### 2.4 범위 밖

- 챌린지 유형별 통계/기록 저장
- OX/순서배치 게임의 일본어 트랙 지원 (추후 별도 브레인스토밍)
- 순서배치 게임의 드래그앤드롭 조작 (탭 방식만 지원)
- 문장부호 별도 토큰 분리 (공백 기준 split만 사용 — 마침표는 마지막 단어에 붙어서 하나의 토큰으로 취급됨)

## 3. 데이터/로직 설계

### 3.1 `src/lib/challengeSelection.ts` (신규)

```ts
export type ChallengeType = 'typing' | 'ox' | 'order';

export function pickRandomChallengeType(): ChallengeType {
  const types: ChallengeType[] = ['typing', 'ox', 'order'];
  return types[Math.floor(Math.random() * types.length)];
}
```

### 3.2 `src/lib/oxChallenge.ts` (신규)

```ts
export interface OxQuestion {
  word: string;
  shownMeaning: string;
  isTrue: boolean;
}

export function buildOxQuestion(
  targetEntry: { date: string; word: string; meaningKo: string },
  archivePool: ArchiveIndexItem[]
): OxQuestion {
  const other = pickRandomOtherWord(archivePool, targetEntry.date); // typingChallenge.ts에서 재사용
  const showFalse = other !== null && Math.random() < 0.5;
  return {
    word: targetEntry.word,
    shownMeaning: showFalse ? other!.meaningKo : targetEntry.meaningKo,
    isTrue: !showFalse,
  };
}
```

- 테스트는 무작위성 자체가 아니라 "후보가 없으면 항상 `isTrue: true`", "`other`가 선택되면 `shownMeaning`이 `other.meaningKo`와 일치"를 검증한다. `Math.random`을 모킹해서 참/거짓 분기를 각각 확정적으로 재현한다.

### 3.3 `src/components/OxChallenge.tsx` (신규)

- `useState`로 `buildOxQuestion` 결과를 마운트 시 1회 생성해 보관(useState 초기화 함수로).
- 내부 상태: 판정 상태(`idle | incorrect`).
- O/X 버튼 클릭 → 클릭한 값이 `question.isTrue`와 일치하면 `onSuccess()`, 아니면 `incorrect` 상태로 전환해 오답 문구만 보여줌 (문제는 그대로 유지).

### 3.4 `src/lib/wordOrderChallenge.ts` (신규)

```ts
export function tokenize(sentence: string): string[] {
  return sentence.split(' ').filter((t) => t.length > 0);
}

export function shuffleTokens(tokens: string[]): string[] {
  // Fisher-Yates
}

export function isCorrectOrder(submitted: string[], target: string[]): boolean {
  return submitted.length === target.length && submitted.every((t, i) => t === target[i]);
}
```

- 테스트는 `isCorrectOrder`(정확 일치/불일치)와 `tokenize`(빈 문자열 필터링)를 확정적으로 검증한다. `shuffleTokens`는 "같은 원소 집합을 반환하는지"만 검증한다(순서 자체는 무작위이므로).

### 3.5 `src/components/WordOrderChallenge.tsx` (신규)

- 마운트 시 1회 `tokenize` + `shuffleTokens`로 후보 토큰 목록을 초기화(useState 초기화 함수).
- 내부 상태: `submitted: string[]`(조립된 순서), `remaining: string[]`(남은 후보), 오답 상태(`idle | incorrect`).
- 후보 토큰 탭 → `submitted`에 추가, `remaining`에서 제거. `remaining`이 빈 배열이 되는 시점에 `isCorrectOrder(submitted + 방금탭한토큰, target)` 채점.
  - 정답: `onSuccess()`.
  - 오답: `incorrect` 상태로 전환, 안내 문구 표시 후 `submitted`/`remaining`을 초기 셔플 상태로 리셋.

### 3.6 `TodayPage` 변경

```ts
const [challengeType, setChallengeType] = useState<ChallengeType>('typing');

function handleShowChallenge() {
  setChallengeType(pickRandomChallengeType());
  showChallenge();
}
```

- "다른 단어 보기" 버튼의 `onClick`을 `showChallenge` → `handleShowChallenge`로 교체.
- `challengeVisible`일 때 `challengeType`에 따라 세 컴포넌트 중 하나만 렌더링:

```tsx
{challengeVisible && challengeType === 'typing' && (
  <TypingChallenge targetSentence={displayedEntry.exampleEn} onSuccess={handleChallengeSuccess} />
)}
{challengeVisible && challengeType === 'ox' && (
  <OxChallenge targetEntry={displayedEntry} archivePool={archivePool} onSuccess={handleChallengeSuccess} />
)}
{challengeVisible && challengeType === 'order' && (
  <WordOrderChallenge targetSentence={displayedEntry.exampleEn} onSuccess={handleChallengeSuccess} />
)}
```

## 4. 에러 처리

- 기존 `useWordOfDayState`/`TodayPage`의 에러 처리(아카이브 fetch 실패, `fetchWordByDate` null 반환 등)는 변경 없이 그대로 적용된다 — 세 챌린지 컴포넌트 모두 `onSuccess`만 호출하는 순수 UI라 별도 에러 경로가 없다.
- OX 퀴즈에서 후보가 없어 항상 참 문제가 되는 경우는 정상 동작으로 취급하며 별도 에러 처리 없음(§2.2 참고).

## 5. 테스트 전략

- **`challengeSelection.test.ts`**: `pickRandomChallengeType`이 세 값 중 하나만 반환하는지 (여러 번 호출해 집합 검증)
- **`oxChallenge.test.ts`**: `buildOxQuestion` — 후보 없을 때 항상 `isTrue: true`, `Math.random` 모킹으로 참/거짓 분기 각각 검증
- **`OxChallenge.test.tsx`**: 정답 버튼 클릭 → `onSuccess` 호출 / 오답 버튼 클릭 → 오답 문구 표시, `onSuccess` 미호출
- **`wordOrderChallenge.test.ts`**: `tokenize`, `isCorrectOrder`, `shuffleTokens`(원소 집합 동일성)
- **`WordOrderChallenge.test.tsx`**: 정답 순서로 탭 → `onSuccess` 호출 / 오답 순서로 탭 → 오답 문구 표시 후 리셋, `onSuccess` 미호출
- **`TodayPage.test.tsx` 확장**: `pickRandomChallengeType`을 모킹해 세 타입 각각에서 해당 컴포넌트가 렌더링되는지 확인

## 6. 저장소 구조 변경 (예상)

```
src/
├── lib/
│   ├── challengeSelection.ts    (신규)
│   ├── oxChallenge.ts           (신규)
│   └── wordOrderChallenge.ts    (신규)
├── components/
│   ├── OxChallenge.tsx          (신규)
│   └── WordOrderChallenge.tsx   (신규)
└── pages/
    └── TodayPage.tsx            (수정)
```
