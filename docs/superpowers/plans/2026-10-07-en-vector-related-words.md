# 영어 벡터 검색 관련 단어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 영어 맞춤 설명의 `<관련 단어>`를 "최근 5개" 대신 Cloudflare Vectorize 의미 검색 결과 5개로 바꾼다.

**Architecture:** 매일 단어 생성 워크플로가 영어 아카이브 전체를 OpenAI로 임베딩해 Vectorize에 upsert한다(id=날짜). Worker는 영어 요청 시 `entry.date`로 저장된 벡터를 꺼내 유사 단어를 검색하고, 실패하면 클라이언트가 보낸 목록을 그대로 쓴다. 클라이언트·요청 계약은 바꾸지 않는다.

**Tech Stack:** Node 20 ESM 스크립트 + `openai` 패키지(기존), Cloudflare Vectorize REST API(v2), Cloudflare Worker(TypeScript), vitest(globals)

**Spec:** `docs/superpowers/specs/2026-10-07-en-vector-related-words-design.md`

## Global Constraints

- 새 npm 의존성 추가 금지. `@cloudflare/workers-types`도 추가하지 않는다 — 기존 `KvStore`처럼 필요한 메서드만 가진 최소 인터페이스를 직접 정의한다.
- 임베딩 모델 `text-embedding-3-small`, Vectorize 인덱스 `en-words`(1536차원, cosine), Worker 바인딩 이름 `EN_WORDS`.
- 벡터 id = 단어 날짜(`YYYY-MM-DD`), metadata = `{ word, meaningKo }`.
- 임베딩 텍스트 형식: `<word> (<partOfSpeech>): <meaningKo>. <exampleEn>`
- 관련 단어 최대 개수는 기존 `MAX_RELATED_WORDS`(5)를 import해서 쓴다.
- 요청 계약(`src/lib/explainContract.ts`)과 클라이언트 코드는 변경 금지.
- 일본어 요청은 Vectorize를 호출하지 않는다.
- 색인 실패가 단어 생성·커밋을 막으면 안 된다 (`continue-on-error: true`).
- Upsert: `POST https://api.cloudflare.com/client/v4/accounts/<CLOUDFLARE_ACCOUNT_ID>/vectorize/v2/indexes/en-words/upsert`, `Authorization: Bearer <CLOUDFLARE_API_TOKEN>`, `Content-Type: application/x-ndjson`, raw NDJSON 본문.

## Review Focus

- 오늘 단어 벡터가 아직 없을 때(어제 색인 실패, 오늘 색인 전) 설명이 깨지지 않고 클라이언트의 최근 5개로 동작해야 한다 → Task 3 `null` 테스트 + Task 4 fallback 테스트.
- Vectorize가 자기 자신을 첫 결과가 아닌 위치에 돌려주거나 아예 빼고 돌려줘도 자기 자신은 절대 관련 단어에 들어가면 안 되고, 5개를 넘으면 안 된다 → Task 3 테스트.
- metadata가 비었거나 타입이 틀린 벡터(수동 조작, 구버전 색인)는 버리고 나머지로 동작해야 한다 → Task 3 테스트.
- 아카이브에는 있는데 단어 파일이 없는 날짜가 있어도 나머지 전체 색인은 진행돼야 한다 → Task 1 `loadEnEntries` 테스트.
- Cloudflare가 HTTP 200에 `success: false`를 돌려주면 성공으로 착각하지 말고 실패로 끝나야 한다 → Task 1 `assertUpsertOk` 테스트.

---

### Task 1: 색인용 순수 함수

**Files:**
- Create: `scripts/enWordVectors.mjs`
- Test: `scripts/enWordVectors.test.mjs`

**Interfaces:**
- Produces:
  - `buildEmbeddingText(entry): string` — entry는 `{ word, partOfSpeech, meaningKo, exampleEn }`
  - `loadEnEntries(archiveIndex: {date}[], readEntry: (date) => Promise<entry>): Promise<entry[]>` — 읽기 실패한 날짜는 건너뜀, 반환 entry는 `date` 포함
  - `buildRecords(entries, embeddings: number[][]): { id, values, metadata: { word, meaningKo } }[]` — 길이 불일치 시 throw
  - `toNdjson(records): string` — 레코드마다 한 줄, 끝에 줄바꿈
  - `assertUpsertOk(status: number, body: unknown): void` — 실패 시 throw

- [ ] **Step 1: Write the failing test**

`scripts/enWordVectors.test.mjs`:

```js
import { buildEmbeddingText, loadEnEntries, buildRecords, toNdjson, assertUpsertOk } from './enWordVectors.mjs';

const entry = {
  date: '2026-10-06',
  word: 'get in touch',
  partOfSpeech: 'phrasal verb',
  meaningKo: '연락하다, 접촉하다',
  exampleEn: 'I need to get in touch with my professor.',
};

describe('buildEmbeddingText', () => {
  it('combines word, part of speech, meaning and example', () => {
    expect(buildEmbeddingText(entry)).toBe(
      'get in touch (phrasal verb): 연락하다, 접촉하다. I need to get in touch with my professor.',
    );
  });
});

describe('loadEnEntries', () => {
  it('reads each archive date and keeps the date on the entry', async () => {
    const readEntry = async (date) => ({ ...entry, date: undefined, word: `w-${date}` });
    const result = await loadEnEntries([{ date: '2026-10-06' }, { date: '2026-10-05' }], readEntry);
    expect(result.map((e) => [e.date, e.word])).toEqual([
      ['2026-10-06', 'w-2026-10-06'],
      ['2026-10-05', 'w-2026-10-05'],
    ]);
  });

  it('skips dates whose word file cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const readEntry = async (date) => {
      if (date === '2026-10-05') throw new Error('ENOENT');
      return entry;
    };
    const result = await loadEnEntries([{ date: '2026-10-06' }, { date: '2026-10-05' }], readEntry);
    expect(result.map((e) => e.date)).toEqual(['2026-10-06']);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe('buildRecords', () => {
  it('pairs entries with embeddings using date as id', () => {
    expect(buildRecords([entry], [[0.1, 0.2]])).toEqual([
      { id: '2026-10-06', values: [0.1, 0.2], metadata: { word: 'get in touch', meaningKo: '연락하다, 접촉하다' } },
    ]);
  });

  it('throws when embedding count does not match entries', () => {
    expect(() => buildRecords([entry], [])).toThrow();
  });
});

describe('toNdjson', () => {
  it('writes one JSON object per line with trailing newline', () => {
    const records = buildRecords([entry, { ...entry, date: '2026-10-05' }], [[1], [2]]);
    const out = toNdjson(records);
    expect(out.endsWith('\n')).toBe(true);
    const lines = out.trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1]).id).toBe('2026-10-05');
  });
});

describe('assertUpsertOk', () => {
  it('passes on 200 with success true', () => {
    expect(() => assertUpsertOk(200, { success: true, result: { mutationId: 'm' } })).not.toThrow();
  });

  it('throws on 200 with success false', () => {
    expect(() => assertUpsertOk(200, { success: false, errors: [{ message: 'bad' }] })).toThrow(/bad/);
  });

  it('throws on non-2xx status', () => {
    expect(() => assertUpsertOk(403, { success: false, errors: [] })).toThrow(/403/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/enWordVectors.test.mjs`
Expected: FAIL — `Failed to resolve import "./enWordVectors.mjs"`

- [ ] **Step 3: Write minimal implementation**

`scripts/enWordVectors.mjs`:

```js
export function buildEmbeddingText(entry) {
  return `${entry.word} (${entry.partOfSpeech}): ${entry.meaningKo}. ${entry.exampleEn}`;
}

export async function loadEnEntries(archiveIndex, readEntry) {
  const entries = [];
  for (const { date } of archiveIndex) {
    try {
      entries.push({ ...(await readEntry(date)), date });
    } catch (err) {
      console.warn(`Skipping ${date}: ${err.message}`);
    }
  }
  return entries;
}

export function buildRecords(entries, embeddings) {
  if (entries.length !== embeddings.length) {
    throw new Error(`Got ${embeddings.length} embeddings for ${entries.length} entries`);
  }
  return entries.map((entry, i) => ({
    id: entry.date,
    values: embeddings[i],
    metadata: { word: entry.word, meaningKo: entry.meaningKo },
  }));
}

export function toNdjson(records) {
  return records.map((record) => JSON.stringify(record)).join('\n') + '\n';
}

// Cloudflare API는 HTTP 200이어도 본문 success가 false일 수 있어 둘 다 확인한다.
export function assertUpsertOk(status, body) {
  if (status >= 200 && status < 300 && body?.success === true) return;
  const messages = (body?.errors ?? []).map((e) => e.message).join(', ');
  throw new Error(`Vectorize upsert failed: ${status} ${messages}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/enWordVectors.test.mjs`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/enWordVectors.mjs scripts/enWordVectors.test.mjs
git commit -m "feat(vector): add English word embedding record helpers"
```

---

### Task 2: 색인 스크립트·워크플로 연결

**Files:**
- Create: `scripts/index-en-words.mjs`
- Modify: `package.json` (`scripts`에 `index:en-words`)
- Modify: `.github/workflows/generate-word.yml` (일본어 생성 step 뒤, 커밋 step 앞에 step 추가)
- Modify: `.env.example`

**Interfaces:**
- Consumes: Task 1의 `loadEnEntries`, `buildEmbeddingText`, `buildRecords`, `toNdjson`, `assertUpsertOk`
- Produces: `npm run index:en-words` (env: `OPENAI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`)

- [ ] **Step 1: Write the script**

`scripts/index-en-words.mjs`:

```js
import 'dotenv/config';
import OpenAI from 'openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildEmbeddingText, loadEnEntries, buildRecords, toNdjson, assertUpsertOk } from './enWordVectors.mjs';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const INDEX_NAME = 'en-words';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf-8'));
}

// ponytail: 매일 아카이브 전체를 다시 임베딩·upsert한다(멱등, 실패한 날도 다음 날 자동 복구). 단어가 수천 개가 되면 새 단어만 색인하도록 바꾼다.
async function main() {
  const openaiKey = requireEnv('OPENAI_API_KEY');
  const accountId = requireEnv('CLOUDFLARE_ACCOUNT_ID');
  const apiToken = requireEnv('CLOUDFLARE_API_TOKEN');

  const archiveIndex = await readJson(path.join(DATA_DIR, 'archive-index.json'));
  const entries = await loadEnEntries(archiveIndex, (date) => readJson(path.join(DATA_DIR, 'words', `${date}.json`)));
  if (entries.length === 0) throw new Error('No English words to index');

  const client = new OpenAI({ apiKey: openaiKey });
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: entries.map(buildEmbeddingText),
  });
  const records = buildRecords(
    entries,
    response.data.map((d) => d.embedding),
  );

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${INDEX_NAME}/upsert`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/x-ndjson' },
      body: toNdjson(records),
    },
  );
  assertUpsertOk(res.status, await res.json().catch(() => null));

  console.log(`Indexed ${records.length} English words into ${INDEX_NAME}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script**

`package.json`의 `"scripts"`에서 `"trend:digest"` 줄 아래에 추가:

```json
    "index:en-words": "node scripts/index-en-words.mjs",
```

- [ ] **Step 3: Add workflow step**

`.github/workflows/generate-word.yml`에서 `node scripts/generate-word-ja.mjs` step 블록 바로 뒤, `- name: Commit generated word` 앞에 추가:

```yaml
      - run: node scripts/index-en-words.mjs
        continue-on-error: true
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

- [ ] **Step 4: Update `.env.example`**

파일 끝에 추가:

```
# 영어 단어 벡터 색인 (scripts/index-en-words.mjs)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

- [ ] **Step 5: Verify missing-env path**

Run: `CLOUDFLARE_ACCOUNT_ID= CLOUDFLARE_API_TOKEN= node scripts/index-en-words.mjs; echo exit=$?`
Expected: `Error: CLOUDFLARE_ACCOUNT_ID is not set`, `exit=1`. (실제 업로드 확인은 배포 체크리스트 7번 — Cloudflare 자격 증명이 있어야 함.)

- [ ] **Step 6: Validate workflow YAML and run suite**

Run: `python -c "import yaml;yaml.safe_load(open('.github/workflows/generate-word.yml',encoding='utf-8'));print('ok')" && npm test`
Expected: `ok`, 전체 테스트 PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/index-en-words.mjs package.json .github/workflows/generate-word.yml .env.example
git commit -m "feat(vector): index English words into Vectorize after daily generation"
```

---

### Task 3: Worker 유사 단어 검색 함수

**Files:**
- Create: `worker/src/similarWords.ts`
- Test: `worker/src/similarWords.test.ts`

**Interfaces:**
- Consumes: `MAX_RELATED_WORDS`, `RelatedWord` from `../../src/lib/explainContract`
- Produces:
  - `interface VectorIndex { getByIds(ids: string[]): Promise<{ id: string; values: number[] | Float32Array }[]>; query(vector: number[] | Float32Array, options: { topK: number; returnMetadata: 'all' }): Promise<{ matches: { id: string; metadata?: Record<string, unknown> }[] }> }`
  - `findSimilarEnWords(index: VectorIndex, date: string): Promise<RelatedWord[] | null>`

- [ ] **Step 1: Write the failing test**

`worker/src/similarWords.test.ts`:

```ts
// @vitest-environment node
import { findSimilarEnWords, VectorIndex } from './similarWords';

const DATE = '2026-09-07';

function match(id: string, word: string, meaningKo: string) {
  return { id, metadata: { word, meaningKo } };
}

function makeIndex(
  matches: { id: string; metadata?: Record<string, unknown> }[],
  stored: { id: string; values: number[] }[] = [{ id: DATE, values: [0.1, 0.2] }],
) {
  return {
    getByIds: vi.fn(async () => stored),
    query: vi.fn(async () => ({ matches })),
  } satisfies VectorIndex;
}

describe('findSimilarEnWords', () => {
  it('queries with the stored vector of the given date', async () => {
    const index = makeIndex([match('2026-08-01', 'relax', '긴장을 풀다')]);
    await findSimilarEnWords(index, DATE);
    expect(index.getByIds).toHaveBeenCalledWith([DATE]);
    expect(index.query).toHaveBeenCalledWith([0.1, 0.2], { topK: 6, returnMetadata: 'all' });
  });

  it('excludes the word itself wherever it appears and keeps order', async () => {
    const index = makeIndex([
      match('2026-08-01', 'relax', '긴장을 풀다'),
      match(DATE, 'figure out', '알아내다'),
      match('2026-08-02', 'laid-back', '느긋한'),
    ]);
    expect(await findSimilarEnWords(index, DATE)).toEqual([
      { word: 'relax', meaningKo: '긴장을 풀다' },
      { word: 'laid-back', meaningKo: '느긋한' },
    ]);
  });

  it('returns at most 5 words', async () => {
    const index = makeIndex(['1', '2', '3', '4', '5', '6'].map((n) => match(`2026-08-0${n}`, `w${n}`, `뜻${n}`)));
    expect(await findSimilarEnWords(index, DATE)).toHaveLength(5);
  });

  it('drops matches with missing or invalid metadata', async () => {
    const index = makeIndex([
      { id: '2026-08-01' },
      { id: '2026-08-02', metadata: { word: 42, meaningKo: '뜻' } },
      { id: '2026-08-03', metadata: { word: '  ', meaningKo: '뜻' } },
      match('2026-08-04', 'relax', '긴장을 풀다'),
    ]);
    expect(await findSimilarEnWords(index, DATE)).toEqual([{ word: 'relax', meaningKo: '긴장을 풀다' }]);
  });

  it('returns null when the date has no stored vector', async () => {
    const index = makeIndex([match('2026-08-01', 'relax', '긴장을 풀다')], []);
    expect(await findSimilarEnWords(index, DATE)).toBeNull();
    expect(index.query).not.toHaveBeenCalled();
  });

  it('returns null when only the word itself matches', async () => {
    expect(await findSimilarEnWords(makeIndex([match(DATE, 'figure out', '알아내다')]), DATE)).toBeNull();
  });

  it('returns null when the index throws', async () => {
    const index = makeIndex([]);
    index.getByIds.mockRejectedValueOnce(new Error('vectorize down'));
    expect(await findSimilarEnWords(index, DATE)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run worker/src/similarWords.test.ts`
Expected: FAIL — `Failed to resolve import "./similarWords"`

- [ ] **Step 3: Write minimal implementation**

`worker/src/similarWords.ts`:

```ts
import { MAX_RELATED_WORDS, RelatedWord } from '../../src/lib/explainContract';

// @cloudflare/workers-types를 추가하지 않으려고 Vectorize 바인딩에서 쓰는 메서드만 정의한다 (KvStore와 같은 방식).
export interface VectorIndex {
  getByIds(ids: string[]): Promise<{ id: string; values: number[] | Float32Array }[]>;
  query(
    vector: number[] | Float32Array,
    options: { topK: number; returnMetadata: 'all' },
  ): Promise<{ matches: { id: string; metadata?: Record<string, unknown> }[] }>;
}

function toRelatedWord(metadata: Record<string, unknown> | undefined): RelatedWord | null {
  const word = metadata?.word;
  const meaningKo = metadata?.meaningKo;
  if (typeof word !== 'string' || !word.trim() || typeof meaningKo !== 'string' || !meaningKo.trim()) return null;
  return { word, meaningKo };
}

// null이면 호출부가 클라이언트가 보낸 목록을 그대로 쓴다. 검색 실패가 설명 기능을 막으면 안 되므로 예외도 null로 바꾼다.
export async function findSimilarEnWords(index: VectorIndex, date: string): Promise<RelatedWord[] | null> {
  try {
    const [self] = await index.getByIds([date]);
    if (!self) return null;

    // 결과에 자기 자신이 섞여 오므로 1개 더 받는다.
    const { matches } = await index.query(self.values, { topK: MAX_RELATED_WORDS + 1, returnMetadata: 'all' });
    const words = matches
      .filter((m) => m.id !== date)
      .map((m) => toRelatedWord(m.metadata))
      .filter((w): w is RelatedWord => w !== null)
      .slice(0, MAX_RELATED_WORDS);
    return words.length > 0 ? words : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run worker/src/similarWords.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add worker/src/similarWords.ts worker/src/similarWords.test.ts
git commit -m "feat(worker): find semantically similar English words via Vectorize"
```

---

### Task 4: Worker 연결·바인딩 설정

**Files:**
- Modify: `worker/src/index.ts` (`Env`, rate limit 뒤 OpenAI 호출 앞)
- Modify: `worker/wrangler.toml`
- Test: `worker/src/index.test.ts`

**Interfaces:**
- Consumes: Task 3의 `VectorIndex`, `findSimilarEnWords`; 기존 `enRequest`, `jaRequest` fixture
- Produces: `Env.EN_WORDS?: VectorIndex`

- [ ] **Step 1: Write the failing test**

`worker/src/index.test.ts` 상단 import를 아래로 교체:

```ts
import worker, { Env } from './index';
import { enRequest, jaRequest } from './testFixtures';
import type { VectorIndex } from './similarWords';
```

`makeEnv`를 아래로 교체 (기존 호출은 인자 그대로 동작):

```ts
function makeEnv(kv = makeKv(), enWords?: VectorIndex): Env {
  return { OPENAI_API_KEY: 'sk-test', ALLOWED_ORIGINS: `${ORIGIN}, http://localhost:5173`, RATE_LIMIT: kv, EN_WORDS: enWords };
}
```

`describe('worker fetch', ...)` 블록 끝(마지막 `});` 바로 앞)에 추가:

```ts
  describe('English related words', () => {
    const clientRequest = { ...enRequest, relatedWords: [{ word: 'recent', meaningKo: '최근' }] };

    function makeIndex(): VectorIndex & { getByIds: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> } {
      return {
        getByIds: vi.fn(async () => [{ id: enRequest.entry.date, values: [0.1] }]),
        query: vi.fn(async () => ({
          matches: [{ id: '2026-08-01', metadata: { word: 'relax', meaningKo: '긴장을 풀다' } }],
        })),
      };
    }

    const systemPrompt = () => JSON.parse((fetch as any).mock.calls[0][1].body).messages[0].content as string;

    it('uses vector search results for English requests', async () => {
      const res = await worker.fetch(post(clientRequest), makeEnv(makeKv(), makeIndex()));
      expect(res.status).toBe(200);
      expect(systemPrompt()).toContain('<관련 단어> relax(긴장을 풀다) </관련 단어>');
    });

    it('falls back to client related words when vector search fails', async () => {
      const index = makeIndex();
      index.getByIds.mockRejectedValueOnce(new Error('down'));
      const res = await worker.fetch(post(clientRequest), makeEnv(makeKv(), index));
      expect(res.status).toBe(200);
      expect(systemPrompt()).toContain('<관련 단어> recent(최근) </관련 단어>');
    });

    it('does not query the index for Japanese requests', async () => {
      const index = makeIndex();
      await worker.fetch(post(jaRequest), makeEnv(makeKv(), index));
      expect(index.getByIds).not.toHaveBeenCalled();
      expect(systemPrompt()).toContain('試験(시험)');
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run worker/src/index.test.ts`
Expected: FAIL — `uses vector search results for English requests`가 `recent(최근)`을 받아 실패 (나머지 2개는 현재 동작과 같아 PASS)

- [ ] **Step 3: Write minimal implementation**

`worker/src/index.ts` 상단 import에 추가:

```ts
import { findSimilarEnWords, VectorIndex } from './similarWords';
```

`Env`에 필드 추가:

```ts
export interface Env {
  OPENAI_API_KEY: string;
  ALLOWED_ORIGINS: string; // 쉼표 구분
  RATE_LIMIT: KvStore;
  EN_WORDS?: VectorIndex; // 없으면 클라이언트가 보낸 관련 단어를 그대로 쓴다
}
```

rate limit `put` 다음, `try { const reply = await callOpenAi(...` 앞을 아래로 교체:

```ts
    let promptReq = req;
    if (req.language === 'en' && env.EN_WORDS) {
      const similar = await findSimilarEnWords(env.EN_WORDS, req.entry.date);
      if (similar) promptReq = { ...req, relatedWords: similar };
    }

    try {
      const reply = await callOpenAi(env.OPENAI_API_KEY, buildOpenAiMessages(promptReq));
```

`worker/wrangler.toml` 끝에 추가:

```toml

# `npx wrangler vectorize create en-words --dimensions=1536 --metric=cosine`로 먼저 생성
[[vectorize]]
binding = "EN_WORDS"
index_name = "en-words"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run worker/src/index.test.ts`
Expected: PASS (기존 테스트 + 새 3개)

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: 전체 PASS

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.ts worker/src/index.test.ts worker/wrangler.toml
git commit -m "feat(worker): use Vectorize similar words for English explain requests"
```

---

## 배포 체크리스트 (코드 작업 아님 — 사용자가 계정으로 직접)

spec 7장 그대로. 구현 완료 후 사용자에게 안내만 한다.

1. `cd worker && npx wrangler login`
2. `npx wrangler kv namespace create RATE_LIMIT` → 출력 id를 `worker/wrangler.toml`의 `REPLACE_WITH_KV_NAMESPACE_ID`에 반영·커밋
3. `npx wrangler vectorize create en-words --dimensions=1536 --metric=cosine`
4. `npx wrangler secret put OPENAI_API_KEY`
5. `npx wrangler deploy` → Worker URL을 GitHub repo variable `VITE_EXPLAIN_API_URL`에 등록
6. Cloudflare API 토큰 발급(Account › Vectorize › Edit) → GitHub secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
7. Actions "Generate Daily Word" 수동 실행 → `Indexed N English words into en-words.` 로그 확인. upsert 형식 오류면 multipart로 수정(spec 4.3)
8. 앱에서 영어 단어 설명 열어 관련 단어가 의미상 비슷한지 확인
