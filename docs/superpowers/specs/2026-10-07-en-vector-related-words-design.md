# 영어 맞춤 설명 — 벡터 검색 기반 관련 단어 설계 문서

**작성일:** 2026-10-07
**상태:** 리뷰 대기 (브레인스토밍 완료)

## 1. 배경 및 목적

맞춤 설명 패널(`2026-10-02-personalized-explain-design.md`)은 프롬프트에 `<관련 단어>`를 넣는다. 일본어는 한자를 공유하는 과거 단어를 찾지만, 영어는 공유할 글자 단위가 없어서 **최근 단어 5개**를 그대로 넘긴다. 오늘 단어와 의미 관계가 없다.

영어 트랙에 **임베딩 + 벡터 DB(Cloudflare Vectorize)** 를 적용해, 의미가 비슷한 과거 단어 5개를 관련 단어로 쓴다.
예: 오늘 단어 `chill out` → 과거 단어 `relax`, `laid-back` → "전에 배운 relax와 비슷해요".

- 단어 수(현재 영어 72개)만 보면 벡터 DB는 오버스펙이다. **벡터 DB 운영 경험이 목적**이라 의도적으로 선택했다.
- 일본어는 기존 한자 매칭이 더 정확하므로 그대로 둔다.

## 2. 결정 사항 요약

| 항목 | 결정 | 이유 |
|---|---|---|
| 적용 범위 | 영어만 | 일본어는 글자 공유 조건이라 문자 매칭이 정확 |
| 벡터 DB | Cloudflare Vectorize | Worker가 이미 Cloudflare, 바인딩으로 바로 사용 |
| 임베딩 모델 | OpenAI `text-embedding-3-small` (1536차원) | 기존 OpenAI 키 재사용, 비용 사실상 0 |
| 색인 시점 | 매일 단어 생성 직후 GitHub Actions에서 | 요청 시 임베딩 호출 없음 → 빠르고 비용 0 |
| 색인 범위 | 매번 영어 아카이브 **전체** upsert | 멱등, 하루 실패해도 다음 날 자가 복구, state 불필요 |
| 검색 위치 | Worker | 바인딩이 Worker에만 있음 |
| 요청 계약 | 변경 없음 | `entry.date`를 벡터 id로 사용 |
| 실패 시 | 클라이언트가 보낸 "최근 5개"로 fallback | 설명 기능은 절대 깨지지 않음 |
| 유사도 하한 | 두지 않음 | 프롬프트 규칙상 LLM이 연결 여부 판단 |

## 3. 전체 구조

```
[GitHub Actions — generate-word.yml, 매일]
  generate-word.mjs (기존)
  index-en-words.mjs (신규, continue-on-error)
    ├ enWordVectors.mjs   순수 함수 (테스트 대상)
    ├ OpenAI embeddings   전체 단어 1회 배치 호출
    └ Vectorize REST      NDJSON upsert (id=날짜)

[Cloudflare Worker — worker/]
  index.ts
    └ language === 'en' → similarWords.ts
         ├ EN_WORDS.getByIds([entry.date])
         ├ EN_WORDS.query(vector, topK 6, metadata 포함)
         └ 실패/없음 → null → req.relatedWords 그대로
```

## 4. 색인

### 4.1 입력

- `public/data/archive-index.json`의 각 `date`에 대해 `public/data/words/<date>.json`을 읽는다 (`exampleEn` 필요).
- 단어 파일이 없거나 읽기 실패한 날짜는 건너뛰고 경고만 남긴다.

### 4.2 임베딩 텍스트

```
<word> (<partOfSpeech>): <meaningKo>. <exampleEn>
```

예: `get in touch (phrasal verb): 연락하다, 접촉하다. I need to get in touch with my professor about the project.`

- 뜻과 예문을 함께 넣어 표기만 비슷한 단어가 아니라 **의미가 비슷한 단어**가 가깝게 놓이게 한다.

### 4.3 업로드

- OpenAI `embeddings.create({ model: 'text-embedding-3-small', input: [...] })` 1회 호출.
- 벡터 레코드: `{ "id": "<date>", "values": [...], "metadata": { "word": "...", "meaningKo": "..." } }`
- `POST https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/vectorize/v2/indexes/en-words/upsert`
  - `Authorization: Bearer <CLOUDFLARE_API_TOKEN>`, `Content-Type: application/x-ndjson`, 본문은 레코드를 줄바꿈으로 이은 NDJSON
  - 응답 `success !== true`면 실패
- **확인 필요:** Cloudflare 문서가 본문 형식(raw NDJSON / multipart)을 모호하게 설명한다. raw NDJSON으로 구현하고 첫 실제 실행에서 확인, 거부되면 multipart로 바꾼다.

### 4.4 실행

- `generate-word.yml`에서 영어·일본어 생성 step 뒤, 커밋 step 앞에 실행. `continue-on-error: true` — 색인 실패가 단어 생성·커밋을 막지 않는다.
- 필요 env: `OPENAI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`. 없으면 즉시 에러(해당 step만 실패).
- npm script: `index:en-words`.
- 첫 배포 시 기존 72개도 이 스크립트 한 번으로 색인된다. 별도 backfill 없음.
- 한계: 단어가 수천 개가 되면 매일 전체 재색인이 낭비다. 그때 새 단어만 색인하도록 바꾼다 (`ponytail:` 주석으로 표시).

## 5. 검색 (Worker)

### 5.1 `findSimilarEnWords(index, date): Promise<RelatedWord[] | null>`

1. `index.getByIds([date])` → 결과 없으면 `null`
2. `index.query(values, { topK: 6, returnMetadata: 'all' })`
3. `id === date`(자기 자신) 제외
4. metadata의 `word`, `meaningKo`가 비어 있지 않은 문자열인 것만 남김
5. 최대 `MAX_RELATED_WORDS`(5)개. 0개면 `null`
6. 어떤 예외든 `null`

### 5.2 `index.ts` 변경

- `Env`에 `EN_WORDS?: VectorizeIndex` 추가 (없으면 기존 동작 — 로컬 개발·테스트 영향 없음).
- 검증·rate limit 통과 후, `req.language === 'en'`이고 `EN_WORDS`가 있으면 `findSimilarEnWords` 호출. 결과가 `null`이 아니면 `req.relatedWords`를 교체한 요청으로 프롬프트를 만든다.
- 일본어 요청은 변경 없음.
- 오늘보다 나중 날짜 단어가 섞일 수 있음(과거 단어를 아카이브에서 볼 때). 기존 `recentEnWords`도 같은 동작이라 그대로 둔다.

### 5.3 `wrangler.toml`

```toml
[[vectorize]]
binding = "EN_WORDS"
index_name = "en-words"
```

## 6. 실패 처리

| 상황 | 동작 |
|---|---|
| 오늘 단어 벡터 아직 없음 (색인 지연·실패) | 클라이언트의 최근 5개 사용 |
| Vectorize 에러, 바인딩 없음 | 클라이언트의 최근 5개 사용 |
| 검색 결과가 자기 자신뿐 / metadata 손상 | 클라이언트의 최근 5개 사용 |
| 색인 스크립트 실패 (OpenAI·Cloudflare) | 해당 step만 실패, 단어 생성·커밋 정상. 다음 날 전체 재색인으로 복구 |
| 개별 단어 파일 없음 | 그 날짜만 건너뜀 |
| 일본어 요청 | 기존 한자 매칭 |

## 7. 배포 순서

Worker가 아직 배포 전이라 기존 미완료 단계를 포함한다. (사용자) 표시는 계정 로그인·권한이 필요해 사용자가 직접 한다.

1. (사용자) `cd worker && npx wrangler login`
2. (사용자) `npx wrangler kv namespace create RATE_LIMIT` → 출력 id를 `wrangler.toml`에 반영
3. (사용자) `npx wrangler vectorize create en-words --dimensions=1536 --metric=cosine`
4. (사용자) `npx wrangler secret put OPENAI_API_KEY`
5. (사용자) `npx wrangler deploy` → Worker URL을 GitHub repo variable `VITE_EXPLAIN_API_URL`에 등록
6. (사용자) Cloudflare 대시보드에서 API 토큰 발급 (권한: Account › Vectorize › Edit) → GitHub secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
7. (사용자) Actions에서 "Generate Daily Word" 수동 실행 → 색인 step 로그 확인 (4.3 형식 확인 포함)
8. 앱에서 영어 단어 설명을 열어 관련 단어가 의미상 비슷한지 확인

## 8. 테스트

- `scripts/enWordVectors.test.mjs`
  - 임베딩 텍스트 형식
  - NDJSON: 줄마다 유효한 JSON, id/values/metadata 포함, 마지막 줄바꿈
  - 아카이브 + 단어 파일 → 레코드 입력 목록, 파일 없는 날짜 건너뜀
- `worker/src/similarWords.test.ts` (가짜 index 객체)
  - 자기 자신 제외, 최대 5개, 순서 유지
  - metadata 누락·타입 오류 항목 제외
  - 벡터 없음 / 결과 0개 / 예외 → `null`
- `worker/src/index.test.ts` 추가
  - 영어 요청: 검색 결과가 프롬프트 `<관련 단어>`에 들어감
  - 검색 실패: 클라이언트 `relatedWords` 사용
  - 일본어 요청: index 호출 안 함
- 실제 확인: 배포 순서 7~8

## 9. 범위 밖

- 일본어 벡터 검색
- 유사도 하한선, 재정렬(re-ranking)
- 새 단어만 증분 색인
- 클라이언트·요청 계약 변경
