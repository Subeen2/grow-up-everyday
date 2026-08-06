# 명예 외국인

매일 초중급 일상 회화체 영단어(영어)/한자 표현(일본어)을 1개씩 픽셀아트 스타일로 보여주는 PWA입니다. 화면 상단 언어 토글로 영어/일본어 모드를 전환합니다.

## 주요 기능

- **오늘의 단어**: 매일 자동 생성된 영어 또는 일본어 단어/표현 1개와 예문을 보여줍니다.
- **아카이브**: 지금까지 생성된 단어 목록(언어별 개수 표시)을 볼 수 있고, 항목을 눌러 상세를 다시 볼 수 있습니다.
- **예문 챌린지**: "다른 단어 보기"를 누르면 표시 중인 예문을 맞혀야 다음 단어로 넘어갑니다.
  - 영어: 예문을 그대로 타이핑해서 정답 판정
  - 일본어: 브라우저 음성인식(Web Speech API)으로 예문을 소리 내어 말해서 정답 판정 (Chrome/Edge 필요)
- **발음 듣기**: 단어/예문 옆 🔊 버튼으로 브라우저 내장 음성합성(TTS)으로 발음을 들을 수 있습니다 (영어/일본어 모두 지원).
- **일본어 한글 발음 표기**: 단어와 예문 아래에 히라가나 표기와 함께 한글 발음표기를 같이 보여줍니다.
- 신규 단어 알림(🔔), pull-to-refresh 등 부가 기능 포함.

## 로컬 개발

```bash
npm install
npm run dev
```

## 테스트

```bash
npm test
```

## 단어 생성 스크립트 로컬 실행

`scripts/generate-word.mjs`는 OpenAI API를 호출해 오늘의 단어를 생성합니다. 로컬에서 직접 실행해보려면:

1. `.env.example`을 복사해 `.env` 파일을 만들고, 본인의 OpenAI API 키를 채웁니다. `.env`는 `.gitignore`에 등록되어 있어 절대 커밋되지 않습니다.
   ```bash
   cp .env.example .env
   ```
   ```
   # .env
   OPENAI_API_KEY=sk-...
   ```
2. 스크립트를 실행합니다.
   ```bash
   npm run generate:word
   ```
   성공하면 `public/data/words/오늘날짜.json`이 생성되고 `public/data/archive-index.json`에 항목이 추가됩니다.

일본어 단어를 로컬에서 생성해보려면 동일한 `.env` 설정 후:
```bash
npm run generate:word:ja
```
성공하면 `public/data/ja/words/오늘날짜.json`이 생성되고 `public/data/ja/archive-index.json`에 항목이 추가됩니다.

## GitHub 저장소 최초 설정 (수동, 1회)

1. GitHub에 새 저장소를 만들고 이 프로젝트를 push합니다.
   ```bash
   git remote add origin <저장소 URL>
   git push -u origin main
   ```
2. 저장소 Settings > Secrets and variables > Actions 에서 `OPENAI_API_KEY` 시크릿을 등록합니다. (본인의 OpenAI API 키, 절대 커밋하지 않습니다)
3. 저장소 Settings > Pages 에서 Source를 "GitHub Actions"로 설정합니다.
4. Actions 탭에서 `Generate Daily Word` 워크플로우를 `workflow_dispatch`로 한 번 수동 실행해 정상 동작을 확인합니다.
5. main에 push되면 `Deploy to GitHub Pages` 워크플로우가 자동으로 사이트를 배포합니다.

## 매일 단어 생성 방식

GitHub Actions가 매일 정해진 시각(UTC 15:00 = KST 00:00)에 OpenAI API를 호출해 영어 단어(`public/data/words/YYYY-MM-DD.json`)와 일본어 단어(`public/data/ja/words/YYYY-MM-DD.json`)를 순서대로 생성하고 한 커밋으로 저장합니다. 한쪽 언어 생성이 실패해도 다른 쪽 결과는 커밋되도록 `continue-on-error`로 처리되어 있습니다. 브라우저는 이 정적 JSON만 읽으므로 OpenAI 키가 클라이언트에 노출되지 않습니다.
