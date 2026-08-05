# 일본어 발음 듣기 + 한글 발음 표기 설계 문서

**작성일:** 2026-08-05
**상태:** 승인됨 (브레인스토밍 완료)

## 배경 및 범위

영어 트랙에 추가한 발음 듣기 버튼(`2026-08-05-pronunciation-button-design.md`)을 일본어 트랙에도 추가한다. 추가로, 일본어는 한자/히라가나만으로는 읽는 법을 바로 알기 어려우므로 단어와 예문 아래에 한글 발음 표기를 새로 넣는다.

## 데이터 모델 변경

`src/lib/wordTypes.ts`의 `JaWordEntry`에 필드 2개 추가:

```ts
export interface JaWordEntry {
  date: string;
  word: string;
  reading: string;
  readingKo: string;        // 신규 — word의 한글 발음표기 (예: "안신")
  meaningKo: string;
  exampleJa: string;
  exampleReading: string;
  exampleReadingKo: string; // 신규 — exampleJa 문장 전체의 한글 발음표기
  exampleKo: string;
}
```

`scripts/wordGeneratorJa.mjs`의 `REQUIRED_FIELDS`와 프롬프트에 `readingKo`, `exampleReadingKo` 생성 지시를 추가한다 (영어 생성기의 `pronunciationKo` 지시문과 동일한 스타일).

## UI 변경

### `JaWordCard.tsx`

- 발음 줄을 `[{reading}] {readingKo}` 형태로 변경 (예: `[あんしん] 안신`).
- `exampleJa` 아래, `exampleKo` 위에 `exampleReadingKo`를 새 줄로 추가한다.
- `exampleReadingKo`도 `hideExampleJa`가 true일 때 `exampleJa`와 함께 숨긴다 (챌린지 중 정답 노출 방지 규칙 동일 적용).
- 영어 `WordCard`와 동일한 패턴으로 발음 듣기 버튼 2개 추가: `🔊 단어 발음`(`entry.word`), `🔊 예문 발음`(`entry.exampleJa`, `hideExampleJa`일 때 숨김). `isSpeechSynthesisSupported()`가 false면 버튼 자체를 렌더하지 않음(기존 영어 버튼과 공통 로직 재사용).

### `src/lib/speech.ts`

기존 `speakEnglish(text)`를 내부적으로 `speak(text, lang)`로 일반화하고, `speakJapanese(text)`(`lang: 'ja-JP'`)를 추가한다. `isSpeechSynthesisSupported`는 언어 무관이므로 그대로 재사용.

## 기존 데이터 처리

오늘(2026-08-05) 이미 생성된 `安心` 항목은 새 필드가 없다. 구현을 병합·배포한 뒤 해당 날짜의 `public/data/ja/words/2026-08-05.json`과 `archive-index.json` 항목을 삭제하고, "Generate Daily Word" 워크플로를 다시 수동 실행해 새 필드를 포함한 항목으로 교체한다.

## 범위 밖

- 영어 트랙 변경 없음
- 발음 속도/음성 선택 등 커스터마이징 UI

## 테스트

- `speech.test.ts`: `speakJapanese`가 올바른 텍스트/lang(`ja-JP`)으로 호출되는지.
- `JaWordCard.test.tsx` 확장: `readingKo`/`exampleReadingKo` 렌더, `hideExampleJa`일 때 `exampleReadingKo`도 숨겨지는지, 발음 버튼 클릭 시 `speakJapanese` 호출, 미지원 환경에서 버튼 미노출.
- `wordGeneratorJa.test.mjs` 확장: `REQUIRED_FIELDS`에 새 필드 포함, `parseWordResponse`가 새 필드 트리밍/검증하는지.
