# 오늘의 단어 — 타이핑 연습 기능 설계 문서

**작성일:** 2026-07-27
**상태:** 승인됨 (브레인스토밍 완료)

## 1. 배경 및 목적

기존 설계는 "오늘의 단어"를 하루 1개만 심플하게 보여주고, 퀴즈/암기 인터랙션은 명시적으로 범위 밖(YAGNI)으로 뒀다 (`2026-07-23-daily-english-word-pwa-design.md` §2.1, §10). 이번 기능은 그 결정을 일부 뒤집는 제품 방향 변경으로, 다음을 추가한다:

- 오늘의 단어 페이지에서, 표시 중인 단어의 예문을 정확히 타이핑하면 아카이브의 다른 단어로 넘어가며 계속 연습할 수 있는 흐름
- 목적: 단순 열람을 넘어 능동적인 타이핑 연습을 통해 표현을 체화하도록 유도

## 2. 핵심 기능 범위

### 2.1 UX 흐름

1. Today 페이지는 기존과 동일하게 오늘의 단어 카드(`WordCard`)를 보여준다.
2. 카드 아래 **"다른 단어 보기"** 버튼을 추가한다.
   - 아카이브에 현재 표시 중인 단어를 제외한 다른 단어가 없으면 버튼을 비활성화하고 안내 문구("아직 연습할 다른 단어가 없어요")를 보여준다.
3. 버튼을 누르면 현재 표시 중인 단어의 영어 예문(`exampleEn`)을 타이핑하는 입력창과 제출 버튼이 나타난다.
4. 제출 시 판정:
   - **정답** (공백 트림 + 대소문자 무시, 문장부호는 정확히 일치해야 함): 아카이브에서 현재 단어를 제외한 항목 중 무작위로 하나를 골라 카드 내용을 교체한다. 새 단어에도 동일하게 "다른 단어 보기" 버튼이 있어 반복 연습이 가능하다.
   - **오답**: 입력한 문장과 정답 문장을 나란히 비교해서 보여주고, 재입력해서 몇 번이든 다시 시도할 수 있다 (진행을 막지 않음).
5. 현재 표시 중인 단어가 실제 오늘의 단어가 아닐 때(다른 단어로 넘어간 상태)만 **"오늘의 단어로"** 버튼이 나타나며, 클릭 시 언제든 원래 오늘의 단어로 복귀한다.
6. NEW 배지 및 마지막 열람일(`isNewDaySinceLastView`/`setLastViewedDate`) 로직은 실제 오늘의 단어 최초 로딩 시점에만 연동되며, 연습용으로 다른 단어를 보는 동작에는 영향받지 않는다.

### 2.2 정답 판정 기준

- 앞뒤 공백은 무시한다.
- 대소문자는 구분하지 않는다.
- 문장부호(마침표, 느낌표 등)는 예문과 정확히 일치해야 한다.

### 2.3 범위 밖

- 실시간 글자별 하이라이트 (제출 버튼 기반 판정만 지원)
- 오답 시 정답 자동 공개나 스킵 기능 (비교 표시 + 재시도만 지원)
- 타이핑 연습 결과의 통계/기록 저장 (연속 정답 수, 히스토리 등)
- 한글 예문(`exampleKo`) 타이핑 — 영어 예문(`exampleEn`)만 대상

## 3. 데이터/로직 설계

### 3.1 `src/lib/typingChallenge.ts` (신규)

```ts
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

- `pickRandomOtherWord`는 `Math.random`을 직접 사용한다. 테스트는 무작위성 자체가 아니라 "제외 대상이 후보에서 빠지는지", "후보가 하나뿐이면 그것만 나오는지", "후보가 없으면 `null`을 반환하는지"를 검증한다.

### 3.2 `src/components/TypingChallenge.tsx` (신규)

- Props: `targetSentence: string`, `onSuccess: () => void`
- 내부 상태: 입력값(`input`), 판정 상태(`idle | incorrect`)
- 오답 제출 시: 판정 상태를 `incorrect`로 바꾸고 입력값은 유지, 화면에 "입력한 문장"과 "정답 문장"을 나란히 보여준다. 이후 입력을 수정하고 다시 제출하면 재판정한다.
- 정답 제출 시: `onSuccess()` 콜백만 호출한다. 다음 단어를 고르는 책임은 부모(`TodayPage`)에 있다 — 이 컴포넌트는 "이 문장이 맞았는가"만 책임진다.

### 3.3 `TodayPage` 변경

- 상태 모델을 확장한다:

```ts
type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      todayEntry: WordEntry;       // 고정된 실제 오늘의 단어
      displayedEntry: WordEntry;   // 현재 화면에 보여주는 단어 (초기값 = todayEntry)
      archivePool: ArchiveIndexItem[]; // 다른 단어 선택용 아카이브 목록
      isNew: boolean;
      challengeVisible: boolean;   // "다른 단어 보기" 눌러서 타이핑 입력창이 보이는 상태인지
    };
```

- 마운트 시 `fetchTodayWord()`와 `fetchArchiveIndex()`를 함께 호출한다 (`Promise.all`).
- "다른 단어 보기" 클릭 → `challengeVisible: true`로 전환, `TypingChallenge`에 `displayedEntry.exampleEn`을 전달.
- `TypingChallenge`의 `onSuccess` 콜백:
  1. `pickRandomOtherWord(archivePool, displayedEntry.date)` 호출
  2. 결과가 있으면 `fetchWordByDate(그 날짜)`로 전체 데이터를 가져와 `displayedEntry` 교체
  3. `challengeVisible: false`로 되돌림 (새 단어를 먼저 보여주고, 다시 버튼을 눌러야 다음 타이핑 시작)
- "오늘의 단어로" 버튼: `displayedEntry.date !== todayEntry.date`일 때만 렌더링. 클릭 시 `displayedEntry = todayEntry`, `challengeVisible: false`.
- NEW 배지/`setLastViewedDate` 호출은 최초 `fetchTodayWord()` 성공 시 **한 번만** 일어나며, `displayedEntry`가 바뀌어도 다시 호출되지 않는다.
- "다른 단어 보기" 버튼은 `archivePool`에서 `displayedEntry.date`를 제외한 항목이 하나도 없으면 `disabled` 처리하고 안내 문구를 보여준다.

## 4. 에러 처리

- `fetchWordByDate`가 `null`을 반환하는 경우(아카이브 인덱스와 실제 파일이 어긋난 데이터 무결성 문제): `displayedEntry`를 교체하지 않고 기존 화면을 유지하며, 콘솔에 경고만 남긴다 (사용자 플로우를 막지 않음).
- 아카이브 인덱스 fetch 자체가 실패하는 경우: "다른 단어 보기" 버튼을 비활성화 처리한다 (오늘의 단어 표시 자체는 정상 동작 유지).

## 5. 테스트 전략

- **`typingChallenge.test.ts`**
  - `isCorrectAnswer`: 공백/대소문자 무시, 문장부호 불일치 시 오답 처리
  - `pickRandomOtherWord`: 현재 날짜 제외, 후보 1개일 때 그것만 선택, 후보 없을 때 `null`
- **`TypingChallenge.test.tsx`**
  - 정답 입력 → `onSuccess` 호출
  - 오답 입력 → 비교 화면 표시, `onSuccess` 미호출, 재시도로 정답 제출 시 성공
- **`TodayPage.test.tsx` 확장**
  - 아카이브 풀에 다른 단어가 없을 때 버튼 비활성화
  - "다른 단어 보기" 클릭 → 타이핑 입력창 노출
  - 정답 제출 → 카드 내용 교체, "오늘의 단어로" 버튼 등장
  - "오늘의 단어로" 클릭 → 원래 오늘의 단어로 복귀, 버튼 사라짐

## 6. 저장소 구조 변경 (예상)

```
src/
├── lib/
│   └── typingChallenge.ts       (신규)
├── components/
│   └── TypingChallenge.tsx      (신규)
└── pages/
    └── TodayPage.tsx            (수정)
```
