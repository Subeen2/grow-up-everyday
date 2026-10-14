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
- **내 수준 맞춤 설명**: 단어 카드의 💡 버튼으로 내가 아는 수준(예: 히라가나만 앎)을 입력하면, 그 수준에 맞춘 설명을 받고 채팅으로 추가 질문할 수 있습니다 (단어당 5회).
- **관련 단어 연결**: 맞춤 설명이 전에 배운 비슷한 단어와 연결해 설명합니다. 영어는 임베딩 + Cloudflare Vectorize로 뜻이 비슷한 단어를, 일본어는 같은 한자를 쓰는 단어를 찾습니다.
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

## 맞춤 설명(💡) 기능 설정 (수동, 1회)

단어 카드의 "💡 내 수준에 맞게 설명"은 Cloudflare Worker(`worker/`)를 통해 OpenAI를 호출합니다. Worker 주소가 설정되지 않으면 버튼이 보이지 않습니다.

1. Cloudflare 가입 후 이메일 인증까지 마치고 로그인합니다 (인증 전에는 Worker 배포가 거부됩니다).
   ```bash
   cd worker
   npx wrangler login
   ```
2. 횟수 제한용 KV를 만듭니다. 이 저장소의 `worker/wrangler.toml`에는 이미 id가 들어 있으므로, 다른 계정에 새로 배포할 때만 출력된 id로 `[[kv_namespaces]]`의 `id`를 바꿉니다.
   ```bash
   npx wrangler kv namespace create RATE_LIMIT
   ```
3. 영어 관련 단어 검색용 Vectorize 인덱스를 만듭니다. `wrangler.toml`이 이 인덱스를 바인딩하므로 **배포 전에** 만들어야 합니다.
   ```bash
   npx wrangler vectorize create en-words --dimensions=1536 --metric=cosine
   ```
4. OpenAI 키 등록 (단어 생성용과 같은 키, 절대 커밋하지 않습니다)
   ```bash
   npx wrangler secret put OPENAI_API_KEY
   ```
5. 배포합니다. 계정에 workers.dev 서브도메인이 없으면 Cloudflare 대시보드(Workers & Pages)에서 먼저 등록하라는 오류가 납니다. 등록 후 다시 배포하고, 출력된 Worker 주소(`https://....workers.dev`)를 확인합니다. 새 서브도메인은 인증서 발급까지 1분 정도 접속이 안 될 수 있습니다.
   ```bash
   npx wrangler deploy
   ```
6. GitHub 저장소 Settings > Secrets and variables > Actions > **Variables**에 `VITE_EXPLAIN_API_URL` = Worker 주소를 등록하고, Deploy 워크플로를 다시 실행합니다.
7. OpenAI 대시보드에서 월 사용 한도를 설정합니다 (권장 $5). Worker는 IP당 하루 30회로 제한하지만, 최종 비용 상한은 이 한도입니다.
8. 매일 단어 생성 워크플로가 영어 단어를 Vectorize에 색인하도록 GitHub Actions **Secrets**에 두 값을 등록합니다. 값은 채팅이나 커맨드 인자에 붙여넣지 말고, 별도 터미널에서 프롬프트로 입력합니다.
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 대시보드 Workers & Pages 우측의 Account ID
   - `CLOUDFLARE_API_TOKEN`: My Profile > API Tokens > Create Custom Token에서 **Account > Vectorize > Edit** 권한만 준 토큰
   ```bash
   gh secret set CLOUDFLARE_ACCOUNT_ID
   gh secret set CLOUDFLARE_API_TOKEN
   ```
   등록 후 `Generate Daily Word`를 수동 실행하면 로그에 `Indexed N English words`가 나옵니다. 색인이 실패해도 단어 생성은 계속되고, 그동안 Worker는 클라이언트가 보낸 관련 단어로 대체합니다.

로컬에서 확인하려면 `.env`에 `VITE_EXPLAIN_API_URL=<Worker 주소>`를 추가하고 `npm run dev` (Worker의 `ALLOWED_ORIGINS`에 `http://localhost:5173`이 포함되어 있어야 합니다).

## 주간 Claude 트렌드 메일 (현재 중단)

`scripts/trend-digest.mjs`는 Claude 블로그와 Claude Code CHANGELOG의 새 글을 모아 한국어로 요약해 메일로 보냅니다. 앱과는 별개인 운영 자동화이며, 지금은 예약 실행을 꺼두었습니다. 다시 쓰려면 아래 설정 후 `.github/workflows/trend-digest.yml`의 `schedule` 주석을 풉니다 (매주 월요일 08:00 KST).

1. [Resend](https://resend.com)에 가입하고 API 키를 만듭니다. 발신 주소는 `onboarding@resend.dev`를 쓰므로 **Resend 가입 이메일로만** 받을 수 있습니다.
2. GitHub Actions **Secrets**에 등록합니다 (별도 터미널에서 프롬프트로 입력). 수신 주소도 저장소에 커밋하지 않습니다.
   ```bash
   gh secret set RESEND_API_KEY
   gh secret set DIGEST_TO_EMAIL
   ```
3. Actions 탭에서 `Weekly Claude Trend Digest`를 수동 실행해 메일 수신을 확인합니다. 발송에 성공한 경우에만 `data/trend-state.json`이 갱신되어, 다음 주에는 새 항목만 보냅니다.

로컬에서 메일을 보내지 않고 내용만 확인하려면 `.env`에 `OPENAI_API_KEY`를 넣고:
```bash
DRY_RUN=1 npm run trend:digest
```

## 매일 단어 생성 방식

GitHub Actions가 매일 정해진 시각(UTC 15:00 = KST 00:00)에 OpenAI API를 호출해 영어 단어(`public/data/words/YYYY-MM-DD.json`)와 일본어 단어(`public/data/ja/words/YYYY-MM-DD.json`)를 순서대로 생성하고 한 커밋으로 저장합니다. 한쪽 언어 생성이 실패해도 다른 쪽 결과는 커밋되도록 `continue-on-error`로 처리되어 있습니다. 브라우저는 이 정적 JSON만 읽으므로 OpenAI 키가 클라이언트에 노출되지 않습니다.
