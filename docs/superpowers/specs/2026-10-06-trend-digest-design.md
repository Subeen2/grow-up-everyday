# Claude Cowork·Code 주간 트렌드 다이제스트 설계 문서

**작성일:** 2026-10-06
**상태:** 리뷰 대기 (브레인스토밍 완료)

## 1. 배경 및 목적

Claude Cowork와 Claude Code는 업데이트가 잦아서 블로그와 CHANGELOG를 직접 챙겨 보기 어렵다. 매주 한 번 새 소식을 모아 **한국어 요약 + 트렌드 해석**을 이메일로 받는다.

- 대상: **Claude Cowork + Claude Code** 관련 소식만
- 수신자: 본인 1명 (주소는 GitHub secret)
- 앱(PWA)과는 독립된 기능이지만, 같은 repo의 "GitHub Actions cron + Node 스크립트 + OpenAI" 패턴(`generate-word.yml`)을 그대로 재사용한다.

## 2. 결정 사항 요약

| 항목 | 결정 | 이유 |
|---|---|---|
| 소스 | `claude.com/ko/blog` + `anthropics/claude-code` CHANGELOG | 공식 소스라 안정적. 블로그만으로는 작은 기능 업데이트를 놓침 |
| 주기 | 주 1회, 월요일 08:00 KST | 개별 뉴스가 아니라 트렌드를 보려면 일주일 단위가 적당 |
| 새 소식 없음 | 메일 보내지 않음 | 빈 메일은 노이즈 |
| 실행 환경 | GitHub Actions cron | 기존 패턴과 동일, 인프라 추가 없음 |
| 요약 모델 | OpenAI `gpt-4o-mini` | 기존 스크립트와 같은 키·비용 구조 |
| 메일 발송 | Resend API (`fetch` 직접 호출) | 무료 플랜, 의존성 추가 없음 |
| 중복 방지 | state 파일 커밋 | 블로그 목록에는 연도가 없고 CHANGELOG에는 날짜가 없어서, 날짜 비교보다 "이미 본 항목" 비교가 정확함 |
| 새 의존성 | 없음 | Node 20 내장 `fetch` + 기존 `openai` 패키지 |

## 3. 전체 구조

```
.github/workflows/trend-digest.yml   (매주 월 08:00 KST + 수동 실행)
  └ node scripts/trend-digest.mjs
       ├ scripts/trendSources.mjs   파싱용 순수 함수 (테스트 대상)
       ├ data/trend-state.json      이미 본 항목 기록
       ├ OpenAI                     관련 글 선별 + 한국어 요약 (1회 호출)
       └ Resend                     HTML 메일 발송
  └ state 변경 시 커밋·푸시
```

`data/`는 `public/` 밖이라 PWA 빌드·배포에 포함되지 않는다.

## 4. 데이터 흐름

1. **state 읽기**: `data/trend-state.json`
   ```json
   { "seenBlogSlugs": ["cowork-is-now-claude"], "lastChangelogVersion": "2.1.290" }
   ```
2. **블로그 수집**
   - `https://claude.com/ko/blog` HTML에서 `href="/ko/blog/<slug>"`를 중복 없이 추출한다 (등장 순서 유지).
   - `seenBlogSlugs`에 없는 slug만 골라, 각 글 페이지에서 `og:title`, `og:description`, `datePublished`를 추출한다.
   - `og:title` 끝의 ` | Claude by Anthropic`은 제거한다.
3. **CHANGELOG 수집**
   - `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`를 받는다.
   - 맨 위부터 `## <version>` 섹션을 읽다가 `lastChangelogVersion`을 만나면 멈춘다.
   - 최대 **10개 버전**까지만 사용한다 (토큰 상한).
4. **요약 (OpenAI 1회 호출, JSON 응답)**
   - 입력: 새 블로그 글 목록(id, 제목, 설명, 날짜) + 새 CHANGELOG 섹션들
   - 블로그 글 중 Cowork/Code와 관련 없는 글은 LLM이 제외한다.
   - 출력 형식:
     ```json
     {
       "headline": ["핵심 1", "핵심 2", "핵심 3"],
       "cowork": [{ "blogId": 0, "summary": "..." }],
       "code": [{ "blogId": 2, "summary": "..." }, { "changelogVersion": "2.1.290", "summary": "..." }],
       "trend": "이번 주 흐름 해석 (2~4문장)"
     }
     ```
   - **링크는 LLM이 만들지 않는다.** LLM은 `blogId`/`changelogVersion`만 돌려주고, URL은 수집 데이터로 조립한다 (URL 환각 방지). 존재하지 않는 id는 버린다.
5. **발송 판단**: `cowork`와 `code`가 모두 비어 있으면 메일을 보내지 않는다.
6. **메일 렌더링·발송**
   - 제목: `[Claude 주간 트렌드] YYYY-MM-DD`
   - 본문 순서: 이번 주 핵심 3줄 → Cowork 소식 → Claude Code 소식 → 트렌드 해석
   - 인라인 스타일만 쓴 단순 HTML (메일 클라이언트 호환). LLM 텍스트는 HTML escape 처리한다.
   - 블로그 링크: `https://claude.com/ko/blog/<slug>`
   - CHANGELOG 링크: `https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md`
   - `POST https://api.resend.com/emails`, 보내는 주소는 `onboarding@resend.dev`
7. **state 갱신**: 발송에 성공했거나 보낼 소식이 없을 때만 갱신한다. 새로 본 slug를 모두 추가하고(관련 없는 글 포함, 다시 판단하지 않도록), CHANGELOG 최상단 버전을 기록한다. 워크플로가 커밋·푸시한다.

## 5. 엣지 케이스 및 에러 처리

| 상황 | 동작 |
|---|---|
| 첫 실행 (state 파일 없음) | 블로그 최신 5개 + CHANGELOG 최신 3개 버전만 대상으로 처리 (과거 전체 발송 방지) |
| 새 항목 0건 | OpenAI 호출 없이 종료, 메일 없음 |
| 관련 소식 0건 | 메일 없음, state만 갱신 |
| 블로그·CHANGELOG fetch 실패, HTTP 비정상 | 예외 → job 실패, state 유지 → 다음 주 재시도. GitHub 실패 알림으로 인지 |
| 개별 블로그 글 meta 파싱 실패 | 해당 글은 제목만(slug) 사용하고 계속 진행 |
| OpenAI 실패·JSON 파싱 실패 | 예외 → job 실패, state 유지 |
| Resend 실패 | 예외 → job 실패, state 유지 (메일 유실 방지를 위해 발송 성공 후에만 state 갱신) |
| 블로그 HTML 구조 변경으로 slug 0개 | 예외 → job 실패 (조용히 "새 소식 없음"으로 처리하지 않음) |
| 필수 환경변수 누락 | 시작 시 즉시 에러 |

`DRY_RUN=1`이면 메일 대신 렌더링된 HTML을 콘솔에 출력하고 state를 갱신하지 않는다 (로컬 확인용).

## 6. 설정

| 이름 | 위치 | 용도 |
|---|---|---|
| `OPENAI_API_KEY` | 기존 secret | 요약 |
| `RESEND_API_KEY` | 새 secret | 메일 발송 |
| `DIGEST_TO_EMAIL` | 새 secret | 수신 주소 (repo에 하드코딩하지 않음) |

로컬 실행은 `.env`에 같은 키를 넣고 `npm run trend:digest`.

**사전 준비 (사용자):** Resend에 수신 주소와 같은 메일로 가입한다. 도메인 인증 없이 `onboarding@resend.dev`로 보낼 때는 가입 계정 메일로만 발송된다. 이후 API 키를 발급해 GitHub secrets에 등록한다.

## 7. 테스트

`scripts/trendSources.test.mjs` (vitest, 기존 `scripts/**/*.test.mjs` 패턴):

- 블로그 목록 HTML에서 slug 추출: 중복 제거, 순서 유지, 다른 링크 무시
- 글 HTML에서 제목·설명·날짜 추출, 접미사 제거, 누락 시 처리
- CHANGELOG 새 섹션 자르기: 마지막 버전 이전까지, 상한 적용, 버전 없을 때(첫 실행) 처리
- LLM 응답 → 링크 조립: 없는 id 버림
- 메일 HTML escape

네트워크·OpenAI·Resend 호출은 `DRY_RUN=1` 로컬 실행과 `workflow_dispatch` 수동 실행으로 확인한다.

## 8. 범위 밖

- 커뮤니티 소스(Reddit, HN 등)
- 여러 수신자, 구독 관리
- 이력 웹 페이지나 PWA 화면 노출
