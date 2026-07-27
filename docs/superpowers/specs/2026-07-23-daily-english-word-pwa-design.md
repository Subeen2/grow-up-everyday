# 명예 외국인 PWA — 설계 문서

**작성일:** 2026-07-23
**상태:** 승인됨 (브레인스토밍 완료)

## 1. 배경 및 목적

영어 회화 실력 향상을 위해 일상에서 자주 쓰이는 단어/표현에 매일 노출되는 습관을 만들고 싶다. 이를 위해:

- GitHub Pages로 배포되는 정적 웹 서비스를 만든다
- PWA로 감싸서 핸드폰에서 앱처럼 설치/사용할 수 있게 한다
- 서버 없이(있어도 완전 무료 범위) 동작해야 한다
- OpenAI API를 활용해 다양한 단어 데이터를 생성한다
- 디자인은 픽셀아트(파스텔 코지 톤) 컨셉으로 한다

## 2. 핵심 기능 범위

### 2.1 오늘의 단어 (Today)
- 하루에 단어/표현 **1개**만 심플하게 보여준다 (여러 개 리스트나 퀴즈 형태 아님)
- 대상 난이도: **중급~중고급 일상 회화체** (관용표현/구동사/연어 위주, 원어민이 실제로 자주 쓰는 톤). 여행/비즈니스 등 특정 토픽 한정 아님. (2026-07-27 업데이트: 최초 스펙은 초중급이었으나 난이도 상향 결정)
- 탭해서 뜻을 가리거나 맞히는 퀴즈 인터랙션은 넣지 않는다 (범위 밖, YAGNI)

### 2.2 아카이브
- 지난 날짜의 단어들을 리스트로 볼 수 있다
- 리스트는 가벼운 인덱스 파일에서 렌더링하고, 항목을 탭하면 해당 날짜의 상세 카드를 본다 (Today와 동일한 카드 컴포넌트 재사용)

### 2.3 PWA / 알림
- 홈 화면에 설치 가능한 PWA (manifest + 서비스워커)
- 오프라인에서도 앱 셸과 이미 받아온 단어 데이터는 볼 수 있다
- **알림은 best-effort 로컬 알림 수준으로 제한한다.** 서버(Web Push) 없이는 앱이 완전히 종료된 상태에서 매일 정해진 시각에 알림이 울리는 것을 보장할 수 없다는 제약을 명시적으로 인정하고, 다음으로 대체한다:
  - 앱을 열 때마다 마지막 확인 날짜를 체크해 새 날짜면 카드에 강조 표시
  - Android Chrome 설치형 PWA에 한해 실험적 Periodic Background Sync API로 시도 (지원 안 되면 조용히 무시)
  - iOS는 이런 백그라운드 알림이 사실상 불가능하다는 점을 사용자가 이미 인지하고 동의함

## 3. 아키텍처

서버 없이, OpenAI API 키를 클라이언트에 절대 노출하지 않기 위해 **빌드 타임 사전 생성** 방식을 사용한다.

```
[GitHub Actions: generate-word.yml]  (매일 1회, cron 스케줄 — KST 새벽 기준 UTC 환산)
   1. archive-index.json을 읽어 최근 90일 내 사용된 단어 목록 확보
   2. OpenAI API 호출 (API 키는 GitHub Secrets의 OPENAI_API_KEY, 저장소 외부로 노출 안 됨)
      - 프롬프트: 초중급 일상 회화체 단어/표현 1개 생성, 최근 90일 목록과 중복 금지 지시 포함
   3. public/data/words/YYYY-MM-DD.json 생성
   4. public/data/archive-index.json 에 항목 추가
   5. 변경사항을 main 브랜치에 커밋

[GitHub Actions: deploy.yml]  (main에 push되면 트리거 — 위 커밋 포함)
   1. React + Vite 앱 빌드 (vite-plugin-pwa로 manifest/서비스워커 생성)
   2. GitHub Pages로 배포

[브라우저 / 설치된 PWA]
   - 정적 JSON만 fetch (OpenAI 호출 없음, API 키 없음)
   - 서비스워커가 앱 셸 + 단어 JSON 캐싱 → 오프라인 지원
```

이 구조의 장점:
- OpenAI 호출이 하루 1번뿐이라 비용이 사실상 없음
- API 키가 브라우저 네트워크 탭에 절대 노출되지 않음
- GitHub Actions(퍼블릭 저장소 기준) + GitHub Pages 모두 무료

## 4. 데이터 스키마

### 4.1 일별 단어 파일: `public/data/words/YYYY-MM-DD.json`

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

필드 설명:
- `pronunciationKo`: IPA가 아닌 한글 발음표기 (한국어 사용자가 바로 읽을 수 있도록 캐주얼하게 — 정밀도보다 접근성 우선)
- `partOfSpeech`: 품사 (영문 표기, 예: adjective/verb/noun/phrase)

### 4.2 아카이브 인덱스: `public/data/archive-index.json`

```json
[
  { "date": "2026-07-23", "word": "awesome", "meaningKo": "정말 멋진, 굉장한" },
  { "date": "2026-07-22", "word": "figure out", "meaningKo": "알아내다, 이해하다" }
]
```

- 아카이브 리스트 화면은 이 파일 하나만 fetch (각 날짜별 상세 JSON을 전부 받지 않아 가벼움)
- 상세 카드를 열 때만 해당 날짜의 `words/YYYY-MM-DD.json`을 fetch

### 4.3 "오늘의 단어" 판별 로직

1. 클라이언트 기기의 로컬 날짜(YYYY-MM-DD)를 구한다
2. `public/data/words/{로컬날짜}.json`을 fetch 시도
3. 404면 (액션이 아직 안 돌았거나 타임존 차이) `archive-index.json`의 가장 최근 날짜 항목으로 폴백

## 5. 프론트엔드 (React + Vite)

### 5.1 페이지 구조
- **Today** (홈): 오늘의 단어를 `WordCard`로 표시
- **Archive**: `archive-index.json`을 리스트로 표시(`ArchiveListItem` 반복), 항목 탭 시 해당 날짜의 `WordCard` 상세 뷰로 이동

### 5.2 공용 컴포넌트
- `WordCard`: 단어 전체 필드를 픽셀 TV 액자 프레임 스타일로 표시. Today/Archive 상세 양쪽에서 재사용
- `ArchiveListItem`: 날짜 + 단어 + 한글 뜻 한 줄 요약
- `PixelButton`: 눌림 인터랙션(translate + 하드섀도우 이동)이 있는 공용 버튼

### 5.3 라우팅
- 클라이언트 사이드 라우팅 없이 두 탭을 간단한 상태 전환(하단 탭바 or 상단 탭)으로 구현. 별도 라우터 라이브러리 불필요 (YAGNI).

## 6. PWA 세부사항

- `vite-plugin-pwa`로 manifest.json 및 서비스워커 자동 생성
- 캐싱 대상: 앱 셸(JS/CSS/이미지) + `public/data/**` JSON
- 캐싱 전략: 앱 셸은 precache, 단어 JSON은 stale-while-revalidate (오프라인에서도 마지막으로 받은 데이터를 보여주되, 온라인이면 최신화)
- 알림: `Notification` API로 권한 요청 후, 가능한 환경(Android Chrome 설치형)에서는 Periodic Background Sync 등록 시도. 미지원 환경에서는 조용히 무시하고 인앱 리마인드 배지로만 대체.

## 7. 픽셀아트 디자인 시스템

참고 이미지(파스텔톤의 아늑한 픽셀 방 — 레트로 TV, 식물, 별, 인형 소품)를 기준으로:

- **팔레트:** 하늘색/민트 배경 + 우드톤 갈색 프레임 + 파스텔 포인트(연분홍, 라벤더). 채도 낮은 코지(cozy) 톤. 원색 위주의 딱딱한 8비트 느낌은 지양.
- **폰트:** 한글을 지원하는 픽셀 폰트(예: Galmuri, 둥근모 계열)를 타이틀/포인트에 사용. 예문처럼 긴 텍스트는 가독성을 위해 일반 서체 사용.
- **모티프:** `WordCard`는 레트로 TV/액자 프레임처럼 두꺼운 픽셀 테두리 + 하드 섀도우(블러 없는 픽셀식 그림자)로 디자인. 별·식물·구름 같은 작은 장식 스프라이트를 여백에 배치.
- **인터랙션:** 버튼은 눌렀을 때 살짝 눌리는 느낌(translate + 그림자 이동)으로 픽셀 게임 느낌을 살림.

## 8. 저장소 구조 (예상)

```
/
├── src/
│   ├── components/ (WordCard, ArchiveListItem, PixelButton)
│   ├── pages/ (TodayPage, ArchivePage)
│   └── App.tsx
├── public/
│   ├── data/
│   │   ├── words/YYYY-MM-DD.json
│   │   └── archive-index.json
│   └── manifest 관련 아이콘 등
├── scripts/
│   └── generate-word.mjs   (OpenAI 호출 + JSON 생성 Node 스크립트)
├── .github/workflows/
│   ├── generate-word.yml
│   └── deploy.yml
└── docs/superpowers/specs/ (이 문서)
```

## 9. 테스트 전략

- **프론트엔드:** Vitest + React Testing Library
  - `WordCard`가 주어진 데이터를 올바르게 렌더링하는지
  - 오늘 날짜 파일이 없을 때 최신 아카이브 항목으로 폴백하는지
  - `ArchivePage`가 인덱스 리스트를 올바르게 렌더링하는지
- **단어 생성 스크립트 (`generate-word.mjs`):** OpenAI 응답을 모킹하여 프롬프트 구성 로직과 응답 파싱 로직을 단위 테스트 (실제 API 호출 없이, 비용/네트워크 의존 없이 검증)
- **배포 후 수동 확인:** Lighthouse PWA 감사로 설치 가능 여부 및 오프라인 캐싱 동작 확인

## 10. 범위 밖 (Out of Scope)

- 퀴즈/플래시카드 암기 모드
- 사용자 계정/로그인, 서버 DB
- 완전히 보장되는 푸시 알림 (서버 필요, 이번 범위 밖)
- 토픽별(여행/비즈니스 등) 단어 카테고리 분류
