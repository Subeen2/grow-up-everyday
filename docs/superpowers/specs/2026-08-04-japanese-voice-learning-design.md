# 일본어 학습 서비스 (음성인식 챌린지) 설계 문서

**작성일:** 2026-08-04
**상태:** 승인됨 (브레인스토밍 완료)

## 1. 배경 및 목적

기존 서비스는 매일 영단어 1개를 보여주고, 예문을 정확히 타이핑하면 다음 단어로 넘어가는 영어 전용 학습 PWA다 (`2026-07-23-daily-english-word-pwa-design.md`, `2026-07-27-typing-challenge-design.md`).

이번 기능은 같은 UX 골격(오늘의 단어 → 아카이브 → 예문 챌린지 통과 시 다음 단어)을 일본어에도 그대로 적용하되, 입력 방식만 다르게 한다:

- 화면 최상단에 **영어 | 일본어** 언어 토글을 추가해 화면 전체를 전환한다.
- 일본어 모드의 예문 챌린지는 **타이핑이 아니라 음성인식**으로 통과한다 — 예문을 소리 내어 그대로 말해야 한다.
- 일본어 단어도 영어와 동일하게 매일 OpenAI로 자동 생성된다.

## 2. 핵심 기능 범위

### 2.1 언어 토글 UX

- `App.tsx` 최상단, 기존 탭바(오늘의 단어/아카이브) 위에 `영어 | 일본어` 토글 버튼 추가 (`PixelButton`, `aria-pressed`로 현재 언어 표시).
- 언어를 바꾸면 화면 전체(오늘의 단어/아카이브 둘 다) 해당 언어 콘텐츠로 전환된다. 탭(오늘의 단어/아카이브) 선택 상태는 언어 전환과 무관하게 유지된다.
- 알림 버튼(🔔)은 언어와 무관하게 그대로 유지한다 (범위 밖, 변경 없음).

### 2.2 일본어 "오늘의 단어" 카드 구성

영어 카드(단어/품사/발음/뜻/예문/예문번역)와 달리 일본어는 품사 대신 훈리가나를 보여준다:

- `word`: 한자 표기 단어 (예: 大丈夫)
- `reading`: 단어 훈리가나 (예: だいじょうぶ)
- `meaningKo`: 한국어 뜻
- `exampleJa`: 한자+가나 예문 (예: 今日は大丈夫です。)
- `exampleReading`: `exampleJa` 전체를 히라가나로 읽은 것 — 화면에는 안 보이고 음성 매칭에만 쓰인다
- `exampleKo`: 예문 한국어 번역

### 2.3 일본어 예문 챌린지 (음성인식)

영어의 "다른 단어 보기 → 타이핑 → 정답 시 다음 단어로 교체" 흐름을 그대로 따르되, 입력 수단만 다르다:

1. "다른 단어 보기" 클릭 시 타이핑 입력창 대신 **🎤 말하기** 버튼이 나타난다.
2. 버튼을 누르면 브라우저 음성인식(Web Speech API, `lang: 'ja-JP'`, 1회 인식)이 시작된다.
3. 인식된 문장이 `exampleJa` 또는 `exampleReading`과 정규화 후 일치하면 정답 처리 → 영어와 동일하게 아카이브에서 무작위 다른 단어로 교체 + 축하 연출.
4. 불일치 시 "내가 말한 문장 / 정답 문장"을 나란히 보여주고 몇 번이든 재시도 가능 (진행 막지 않음, 영어 오답 UX와 동일).
5. **음성인식 미지원 브라우저** (Firefox, 일부 모바일 브라우저 등): 마이크 버튼 대신 안내 문구만 표시 — "이 브라우저는 음성인식을 지원하지 않아요. Chrome/Edge로 접속해주세요." 통과 자체가 불가능하며, 타이핑 대체 입력은 제공하지 않는다.
6. 마이크 권한 거부 등 인식 에러 발생 시 "다시 시도해주세요" 메시지를 보여주고 다시 마이크 버튼을 누를 수 있게 한다.

### 2.4 정답 판정 기준 (음성)

음성인식 결과는 한자 섞인 정식 표기로 나올 수도, 가나 위주로 나올 수도 있으므로 두 형태 다 정답으로 인정한다:

```ts
normalize(text) // 전각 가타카나 → 히라가나 변환, 구두점/공백 제거
isCorrectJaAnswer(spoken, entry) =
  normalize(spoken) === normalize(entry.exampleJa)
  || normalize(spoken) === normalize(entry.exampleReading)
```

- 오쿠리가나 차이, 다른 한자 이형태 등은 잡지 못한다. 이는 의도된 한계로 코드에 `ponytail:` 주석으로 명시한다 (업그레이드 경로: kuromoji 등 형태소 분석기 도입).

### 2.5 범위 밖

- 3번째 언어 확장을 염두에 둔 범용 플러그인 아키텍처 (언어는 영/일 2개로 고정)
- 음성인식 미지원 브라우저용 타이핑 폴백
- 음성 발음 정확도 채점 (정답/오답 판정만, 발음 점수 없음)
- 챌린지 결과 통계/기록 저장

## 3. 데이터/타입 설계

### 3.1 `src/lib/wordTypes.ts` 추가

```ts
export interface JaWordEntry {
  date: string; // YYYY-MM-DD
  word: string;
  reading: string;
  meaningKo: string;
  exampleJa: string;
  exampleReading: string;
  exampleKo: string;
}

export interface JaArchiveIndexItem {
  date: string; // YYYY-MM-DD
  word: string;
  meaningKo: string;
}
```

### 3.2 `src/lib/wordData.ts` 일반화

기존 3개 함수(`fetchWordByDate`, `fetchArchiveIndex`, `fetchTodayWord`)의 로직을 `basePath`를 받는 팩토리로 뽑아낸다:

```ts
export function createWordApi<TEntry extends { date: string }, TIndexItem extends { date: string }>(
  basePath: string
) {
  async function fetchWordByDate(date: string): Promise<TEntry | null> { ... }
  async function fetchArchiveIndex(): Promise<TIndexItem[]> { ... }
  async function fetchTodayWord(): Promise<TEntry> { ... }
  return { fetchWordByDate, fetchArchiveIndex, fetchTodayWord };
}
```

- 기존 export(`fetchWordByDate` 등)는 `createWordApi<WordEntry, ArchiveIndexItem>('data')`를 호출한 결과를 그대로 재노출한다 — 동작·시그니처 동일, 기존 테스트 무수정.
- `getLocalDateString`은 언어 무관 그대로 유지.
- 신규 `src/lib/jaWordData.ts`: `createWordApi<JaWordEntry, JaArchiveIndexItem>('data/ja')` 결과를 재노출.

### 3.3 데이터 파일 경로

```
public/data/
├── words/{date}.json          (기존, 영어)
├── archive-index.json         (기존, 영어)
└── ja/
    ├── words/{date}.json      (신규, 일본어)
    └── archive-index.json     (신규, 일본어)
```

### 3.4 localStorage 네임스페이스

언어 전환 시 EN/JA 상태가 서로 오염되지 않도록, 언어별로 분리해야 하는 기존 저장소에 namespace 인자를 추가한다:

- `src/lib/browsingState.ts`: `getPersistedDisplayedWordDate(today, namespace)` / `setPersistedDisplayedWordDate(date, today, namespace)` — 내부 키에 `namespace` 접두 (`displayedWordDate:en`, `displayedWordDate:ja`).
- `src/lib/reminder.ts`: `getLastViewedDate(namespace)` / `setLastViewedDate(date, namespace)` / `isNewDaySinceLastView(today, namespace)` — 동일 패턴. `requestNotificationPermissionAndSync`는 언어 무관이므로 변경 없음.
- 기존 EN 호출부는 `'en'`을 넘기도록 수정. 기존 테스트도 namespace 인자 추가에 맞춰 업데이트.

## 4. 컴포넌트/상태 로직 설계

### 4.1 `useWordOfDayState` 훅 (신규, `src/lib/useWordOfDayState.ts`)

`TodayPage`에 있던 상태 머신(로딩/에러/오늘단어/표시중단어/아카이브풀/isNew/챌린지visible/축하, "다른 단어 보기" 전환, "오늘의 단어로" 복귀)을 제네릭 훅으로 추출해 EN/JA가 공유한다:

```ts
function useWordOfDayState<TEntry extends { date: string }, TIndexItem extends { date: string }>(
  api: { fetchTodayWord; fetchArchiveIndex; fetchWordByDate },
  namespace: string
) {
  // 기존 TodayPage.tsx의 useEffect + state + handleChallengeSuccess + handleBackToToday 로직 그대로 이전
  // 반환: { state, celebrating, setCelebrating, hasOtherWord, isShowingToday,
  //          startChallenge, handleChallengeSuccess, handleBackToToday }
}
```

- 챌린지 성공 시 다음 단어를 고르는 `pickRandomOtherWord`/정답 판정 로직 자체는 훅 밖(각 챌린지 컴포넌트)에 남긴다 — 훅은 "성공 콜백을 받으면 다음 단어로 교체한다"는 흐름만 책임진다 (기존 `TypingChallenge`와 동일 책임 분리 원칙).

### 4.2 페이지 컴포넌트

- `TodayPage.tsx` (기존, 최소 수정): `useWordOfDayState(enApi, 'en')` 호출로 전환, JSX는 `WordCard` + `TypingChallenge` 그대로 유지.
- `JaTodayPage.tsx` (신규): `useWordOfDayState(jaApi, 'ja')` 호출, JSX는 `JaWordCard` + `VoiceChallenge` 렌더.
- `ArchivePage.tsx`(기존)/`JaArchivePage.tsx`(신규): 로직이 단순(목록 조회 + 선택)해서 훅 추출 없이 `ArchivePage.tsx`를 그대로 복제해 fetch 함수와 카드 컴포넌트만 교체.

### 4.3 `JaWordCard` (신규, `src/components/JaWordCard.tsx`)

`WordCard`와 동일 구조, 필드만 §2.2 기준으로 렌더. `hideExampleJa` prop으로 챌린지 진행 중 예문 숨김 (`WordCard`의 `hideExampleEn`과 동일 패턴).

### 4.4 `VoiceChallenge` (신규, `src/components/VoiceChallenge.tsx`)

- Props: `targetEntry: { exampleJa: string; exampleReading: string }`, `onSuccess: () => void` (`TypingChallenge`와 대칭되는 인터페이스, 다만 정답 판정에 두 필드가 필요해 문자열 대신 엔트리 일부를 받음)
- 내부 상태: `idle | listening | incorrect(submitted) | unsupported | error`
- 마운트 시 `window.SpeechRecognition || window.webkitSpeechRecognition` 존재 확인 → 없으면 `unsupported` 고정.
- `🎤 말하기` 클릭 → `listening`, `recognition.start()` (`lang:'ja-JP'`, `continuous:false`, `interimResults:false`).
- `onresult`: 첫 대안 transcript로 `isCorrectJaAnswer` 판정 → 성공 시 `onSuccess()`, 실패 시 `incorrect(transcript)`.
- `onerror`: `error` 상태로 전환, 재시도 버튼 제공.

### 4.5 `src/lib/voiceChallenge.ts` (신규)

```ts
export function normalizeJaForComparison(text: string): string {
  // 가타카나(U+30A1–U+30F6) → 히라가나 변환 (-0x60), 구두점/공백 제거, trim
}

export function isCorrectJaAnswer(spoken: string, entry: { exampleJa: string; exampleReading: string }): boolean {
  const normalized = normalizeJaForComparison(spoken);
  return normalized === normalizeJaForComparison(entry.exampleJa)
    || normalized === normalizeJaForComparison(entry.exampleReading);
}
```

## 5. 데이터 생성 파이프라인

### 5.1 `scripts/wordGeneratorJa.mjs` (신규)

`wordGenerator.mjs`와 동일 구조로 미러링:

- `REQUIRED_FIELDS = ['word', 'reading', 'meaningKo', 'exampleJa', 'exampleReading', 'exampleKo']`
- 프롬프트: 한국인 일본어 학습자용, 중급 일상회화 한자어/표현 1개, JSON 강제 응답. `exampleReading`은 음성 인식 매칭에 쓰이므로 정확한 히라가나 표기를 요구하는 지시문을 명시적으로 포함한다.
- `getRecentWords`, `generateWordEntry` 패턴 동일 재사용 (최근 90일 중복 회피).

### 5.2 `scripts/generate-word-ja.mjs` (신규)

`generate-word.mjs`와 동일 구조, 경로만 교체:

- `WORDS_DIR = public/data/ja/words`
- `INDEX_PATH = public/data/ja/archive-index.json`
- 오늘 날짜 항목이 이미 있으면 스킵하는 로직 동일.

### 5.3 `package.json`

```json
"generate:word:ja": "node scripts/generate-word-ja.mjs"
```

### 5.4 `.github/workflows/generate-word.yml`

기존 EN 생성 스텝 뒤에 JA 생성 스텝을 추가한다 (하나의 job, 하나의 커밋):

```yaml
- run: node scripts/generate-word.mjs
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    TZ: Asia/Seoul
- run: node scripts/generate-word-ja.mjs
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    TZ: Asia/Seoul
```

커밋 스텝의 `git add public/data`는 경로 변경 없이 EN/JA 양쪽 변경분을 그대로 포함한다.

## 6. 에러 처리

- 일본어 아카이브/오늘의 단어 fetch 실패 시: 영어와 동일하게 에러 메시지 표시, 언어 토글로 영어 모드로 전환은 계속 가능해야 한다 (한쪽 언어 데이터 문제가 다른 언어 사용을 막지 않음).
- 음성인식 미지원/권한 거부/인식 실패는 §2.3, §4.4에 정의된 대로 각각 별도 상태로 처리하며 앱 전체를 막지 않는다.
- `exampleReading` 필드가 비어있거나 생성 실패로 누락된 경우는 `wordGeneratorJa.mjs`의 `REQUIRED_FIELDS` 검증에서 이미 걸러지므로 런타임에서 별도 방어 코드는 두지 않는다.

## 7. 테스트 전략

- **`wordData.test.ts`**: `createWordApi` 팩토리 기준으로 기존 케이스 유지 + `basePath` 다르게 줬을 때 URL 경로 검증 케이스 추가.
- **`jaWordData.test.ts`** (신규): `createWordApi<JaWordEntry, JaArchiveIndexItem>('data/ja')` 결과가 올바른 경로를 호출하는지.
- **`browsingState.test.ts` / `reminder.test.ts`**: namespace 인자 추가에 맞춰 케이스 확장 (en/ja 키가 서로 간섭하지 않는지).
- **`voiceChallenge.test.ts`** (신규): `normalizeJaForComparison`(가타카나→히라가나, 구두점 제거) / `isCorrectJaAnswer`(한자 표기 일치, 가나 표기 일치, 둘 다 불일치)
- **`VoiceChallenge.test.tsx`** (신규): `SpeechRecognition` 미정의 시 안내 문구 렌더 / mock `SpeechRecognition`으로 정답·오답·에러 시나리오
- **`JaTodayPage.test.tsx`** (신규): 기존 `TodayPage.test.tsx`와 동일한 케이스를 JA 데이터로 (다른 단어 보기 비활성화, 챌린지 노출, 성공 시 카드 교체, 오늘의 단어로 복귀)
- **`wordGeneratorJa.test.mjs`** (신규): prompt 빌드 + response 파싱 (`wordGenerator.test.mjs` 패턴)
- **`App.test.tsx` 확장**: 언어 토글 클릭 시 화면 전환, 탭 선택 상태가 언어 전환에 영향받지 않는지

## 8. 저장소 구조 변경 (예상)

```
src/
├── lib/
│   ├── wordData.ts              (수정 — createWordApi 팩토리로 일반화)
│   ├── jaWordData.ts            (신규)
│   ├── wordTypes.ts             (수정 — JaWordEntry/JaArchiveIndexItem 추가)
│   ├── browsingState.ts         (수정 — namespace 인자 추가)
│   ├── reminder.ts              (수정 — namespace 인자 추가)
│   ├── useWordOfDayState.ts     (신규)
│   └── voiceChallenge.ts        (신규)
├── components/
│   ├── JaWordCard.tsx           (신규)
│   └── VoiceChallenge.tsx       (신규)
├── pages/
│   ├── TodayPage.tsx            (수정 — 훅 사용으로 전환)
│   ├── JaTodayPage.tsx          (신규)
│   └── JaArchivePage.tsx        (신규)
└── App.tsx                      (수정 — 언어 토글 추가)

scripts/
├── wordGeneratorJa.mjs          (신규)
└── generate-word-ja.mjs         (신규)

public/data/ja/
├── words/                       (신규)
└── archive-index.json           (신규, 최초 생성 시 빈 배열)

.github/workflows/generate-word.yml  (수정 — JA 생성 스텝 추가)
package.json                         (수정 — generate:word:ja 스크립트 추가)
```
