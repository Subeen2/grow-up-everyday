# 영어 발음 듣기 버튼 설계 문서

**작성일:** 2026-08-05
**상태:** 승인됨 (브레인스토밍 완료)

## 1. 배경 및 목적

일본어 트랙에는 Web Speech API의 음성인식(STT)을 이용한 말하기 챌린지가 있다. 이번 기능은 그 자매 API인 음성합성(TTS)을 영어 트랙에 추가해, 사용자가 오늘의 단어/아카이브에서 단어와 예문의 실제 발음을 들어볼 수 있게 한다.

## 2. 기능 범위

### 2.1 UI

`WordCard` 컴포넌트에 버튼 2개 추가:
- `🔊 단어 발음`: `entry.word`를 읽어줌. 항상 노출.
- `🔊 예문 발음`: `entry.exampleEn`을 읽어줌. `hideExampleEn`이 true(타이핑 챌린지 진행 중)일 때는 렌더하지 않는다 — 정답을 음성으로 들려주면 챌린지 의미가 없어지기 때문.

`WordCard`는 `TodayPage`와 `ArchivePage` 양쪽에서 재사용되므로, 이 변경만으로 두 화면 모두에 적용된다.

### 2.2 재생 로직

- `window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))`, `utterance.lang = 'en-US'`.
- 새 npm 의존성 없음 — 브라우저 내장 API만 사용.
- `window.speechSynthesis`가 없는 환경(구형 브라우저)에서는 두 버튼 모두 렌더하지 않는다. SpeechSynthesis는 SpeechRecognition보다 지원 범위가 넓어 별도 안내 문구는 두지 않는다.
- 버튼을 다시 누르면 이전 재생을 취소하고 새로 읽는다 (`speechSynthesis.cancel()` 후 `speak()`).

### 2.3 범위 밖

- 일본어 트랙에는 적용하지 않음 (일본어는 이미 음성인식 챌린지가 있고, 이번 요청은 영어 한정)
- 재생 속도/음성 선택 등 커스터마이징 UI
- 재생 상태 표시(로딩/재생중 스피너) — 브라우저 TTS는 즉시 시작되므로 불필요

## 3. 구현 설계

### 3.1 `src/lib/speech.ts` (신규)

```ts
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakEnglish(text: string): void {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
}
```

### 3.2 `WordCard.tsx` 변경

- `isSpeechSynthesisSupported()`가 true일 때만 버튼 노출.
- `🔊 단어 발음` 버튼: `onClick={() => speakEnglish(entry.word)}`, 항상 노출.
- `🔊 예문 발음` 버튼: `onClick={() => speakEnglish(entry.exampleEn)}`, `!hideExampleEn`일 때만 노출.

## 4. 테스트 전략

- `speech.test.ts`: `speakEnglish`가 `cancel()` 호출 후 `speak()`을 올바른 텍스트/lang으로 호출하는지 (전역 `window.speechSynthesis`를 mock).
- `WordCard.test.tsx` 확장: 지원 환경에서 두 버튼 렌더 및 클릭 시 `speakEnglish` 호출 검증(모듈 mock), `hideExampleEn`일 때 예문 발음 버튼만 사라지는지, 미지원 환경(`speechSynthesis` 없음)에서 버튼 자체가 없는지.

## 5. 저장소 구조 변경 (예상)

```
src/
├── lib/
│   ├── speech.ts        (신규)
│   └── speech.test.ts   (신규)
└── components/
    ├── WordCard.tsx        (수정)
    └── WordCard.test.tsx   (수정)
```
