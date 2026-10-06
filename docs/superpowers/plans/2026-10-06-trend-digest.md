# Claude 주간 트렌드 다이제스트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매주 월요일 Claude Cowork·Code 새 소식(블로그 + CHANGELOG)을 한국어로 요약해 이메일로 보낸다.

**Architecture:** GitHub Actions 주간 cron이 `scripts/trend-digest.mjs`를 실행한다. 파싱·조립·렌더링은 순수 함수 모듈 `scripts/trendSources.mjs`에 두고 vitest로 테스트한다. 이미 본 항목은 `data/trend-state.json`에 기록하고, 메일 발송에 성공한 뒤에만 갱신·커밋한다.

**Tech Stack:** Node 20 (내장 `fetch`), `openai` 패키지(기존, `gpt-4o-mini`), Resend REST API, vitest(globals 사용, 기존 설정)

**Spec:** `docs/superpowers/specs/2026-10-06-trend-digest-design.md`

## Global Constraints

- 새 npm 의존성 추가 금지. HTTP는 Node 내장 `fetch`.
- 모델은 `gpt-4o-mini`, `response_format: { type: 'json_object' }` (기존 `scripts/wordGenerator.mjs`와 동일).
- 블로그 목록: `https://claude.com/ko/blog`, 글 URL: `https://claude.com/ko/blog/<slug>`
- CHANGELOG 원문: `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`, 메일 링크: `https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md`
- 첫 실행(state 없음): 블로그 최신 5개 + CHANGELOG 최신 3개 버전. 평소: CHANGELOG 최대 10개 버전.
- 메일 제목 `[Claude 주간 트렌드] YYYY-MM-DD`, 발신 `onboarding@resend.dev`.
- 수신 주소는 `DIGEST_TO_EMAIL` 환경변수로만 받는다. repo에 하드코딩 금지.
- 링크는 LLM 출력이 아니라 수집 데이터로 조립한다.
- state는 발송 성공 또는 "보낼 소식 없음"일 때만 저장. `DRY_RUN=1`이면 메일 대신 HTML 출력, state 저장 안 함.
- 스크립트 파일은 기존 `scripts/*.mjs` 스타일(ESM, `import 'dotenv/config'`, `main().catch(... process.exit(1))`)을 따른다.

## Review Focus

- 첫 실행에서 5개만 처리해도 목록의 **모든** slug를 seen으로 기록해야 한다. 아니면 다음 주에 옛 글이 새 글로 쏟아진다 → Task 2 `nextState` 테스트.
- state의 `lastChangelogVersion`이 CHANGELOG에서 사라진 경우(버전 표기 변경 등) 전체를 다시 보내지 않고 상한 10개로 멈춰야 한다 → Task 1 `selectNewSections` 테스트.
- LLM이 없는 `blogId`·버전, 문자열 아닌 summary, 배열 아닌 필드를 돌려줘도 크래시 없이 해당 항목만 버려야 한다 → Task 2 `buildDigest` 테스트.
- `og:title`에 `&amp;`, `&#x27;` 같은 HTML 엔티티가 있으면 메일에 사람이 읽는 문자로 나와야 한다 → Task 1 `parsePostMeta` 테스트.
- LLM 텍스트에 `<`, `&`, 따옴표가 있어도 메일 HTML이 깨지거나 태그가 주입되지 않아야 한다 → Task 2 `renderDigestHtml` 테스트.

---

### Task 1: 블로그·CHANGELOG 파싱

**Files:**
- Create: `scripts/trendSources.mjs`
- Test: `scripts/trendSources.test.mjs`

**Interfaces:**
- Produces:
  - `BLOG_BASE: string` = `'https://claude.com/ko/blog'`
  - `extractBlogSlugs(html: string): string[]` — 등장 순서 유지, 중복 제거
  - `parsePostMeta(html: string, slug: string): { slug, title, description, date }` — 모두 string, 없으면 title은 slug, 나머지는 `''`
  - `parseChangelogSections(md: string): { version: string, body: string }[]` — 파일 위에서부터 순서대로
  - `selectNewSections(sections, lastVersion: string, limit: number): sections` — `lastVersion` 직전까지, 최대 `limit`개

- [ ] **Step 1: Write the failing test**

`scripts/trendSources.test.mjs`:

```js
import {
  extractBlogSlugs,
  parsePostMeta,
  parseChangelogSections,
  selectNewSections,
} from './trendSources.mjs';

describe('extractBlogSlugs', () => {
  it('returns unique blog slugs in order of appearance', () => {
    const html = `
      <a href="/ko/blog/cowork-is-now-claude">A</a>
      <a href="/ko/blog/build-plugins-for-claude">B</a>
      <a href="/ko/blog/cowork-is-now-claude">A again</a>`;
    expect(extractBlogSlugs(html)).toEqual(['cowork-is-now-claude', 'build-plugins-for-claude']);
  });

  it('ignores non-post links', () => {
    const html = `
      <a href="/ko/blog">list</a>
      <a href="/ko/blog/category/product">category</a>
      <a href="/en/blog/other-lang">en</a>
      <a href="https://example.com/ko/blog/x">external</a>`;
    expect(extractBlogSlugs(html)).toEqual([]);
  });
});

describe('parsePostMeta', () => {
  const html = `
    <meta content="Claude Cowork와 채팅이 하나로 &amp; 더 빠르게 | Claude by Anthropic" property="og:title"/>
    <meta content="오늘부터 &#x27;하나의 Claude&#39;로 통합됩니다." property="og:description"/>
    <script type="application/ld+json">{"datePublished": "Sep 16, 2026"}</script>`;

  it('extracts title without site suffix, description and date', () => {
    expect(parsePostMeta(html, 'cowork-is-now-claude')).toEqual({
      slug: 'cowork-is-now-claude',
      title: 'Claude Cowork와 채팅이 하나로 & 더 빠르게',
      description: "오늘부터 '하나의 Claude'로 통합됩니다.",
      date: 'Sep 16, 2026',
    });
  });

  it('falls back to slug and empty strings when meta is missing', () => {
    expect(parsePostMeta('<html></html>', 'some-post')).toEqual({
      slug: 'some-post',
      title: 'some-post',
      description: '',
      date: '',
    });
  });
});

describe('parseChangelogSections', () => {
  it('splits sections by version heading in file order', () => {
    const md = '# Changelog\n\n## 2.1.290\n\n- Added A\n- Fixed B\n\n## 2.1.289\n\n- Added C\n';
    expect(parseChangelogSections(md)).toEqual([
      { version: '2.1.290', body: '- Added A\n- Fixed B' },
      { version: '2.1.289', body: '- Added C' },
    ]);
  });

  it('returns empty array when no version headings', () => {
    expect(parseChangelogSections('# Changelog\n')).toEqual([]);
  });
});

describe('selectNewSections', () => {
  const sections = ['5', '4', '3', '2', '1'].map((v) => ({ version: v, body: `- ${v}` }));

  it('returns sections above the last seen version', () => {
    expect(selectNewSections(sections, '3', 10).map((s) => s.version)).toEqual(['5', '4']);
  });

  it('returns nothing when last seen version is the latest', () => {
    expect(selectNewSections(sections, '5', 10)).toEqual([]);
  });

  it('caps at limit when last seen version no longer exists', () => {
    expect(selectNewSections(sections, '0.9', 2).map((s) => s.version)).toEqual(['5', '4']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/trendSources.test.mjs`
Expected: FAIL — `Failed to resolve import "./trendSources.mjs"`

- [ ] **Step 3: Write minimal implementation**

`scripts/trendSources.mjs`:

```js
export const BLOG_BASE = 'https://claude.com/ko/blog';

const TITLE_SUFFIX = / \| Claude by Anthropic$/;

export function extractBlogSlugs(html) {
  const slugs = [];
  for (const match of html.matchAll(/href="\/ko\/blog\/([a-z0-9-]+)"/g)) {
    if (!slugs.includes(match[1])) slugs.push(match[1]);
  }
  return slugs;
}

function decodeEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function readMeta(html, property) {
  const tag = html.match(new RegExp(`<meta[^>]*property="${property}"[^>]*>`));
  const content = tag?.[0].match(/content="([^"]*)"/);
  return content ? decodeEntities(content[1]).trim() : '';
}

export function parsePostMeta(html, slug) {
  const title = readMeta(html, 'og:title').replace(TITLE_SUFFIX, '');
  const date = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
  return {
    slug,
    title: title || slug,
    description: readMeta(html, 'og:description'),
    date: date ? date[1] : '',
  };
}

export function parseChangelogSections(md) {
  return md
    .split(/^## /m)
    .slice(1)
    .map((chunk) => {
      const [heading, ...rest] = chunk.split('\n');
      return { version: heading.trim(), body: rest.join('\n').trim() };
    });
}

export function selectNewSections(sections, lastVersion, limit) {
  const end = sections.findIndex((s) => s.version === lastVersion);
  return sections.slice(0, end === -1 ? limit : Math.min(end, limit));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/trendSources.test.mjs`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/trendSources.mjs scripts/trendSources.test.mjs
git commit -m "feat(trend-digest): parse blog posts and changelog sections"
```

---

### Task 2: 프롬프트·다이제스트 조립·메일 렌더링·state 갱신

**Files:**
- Modify: `scripts/trendSources.mjs` (함수 추가)
- Test: `scripts/trendSources.test.mjs` (describe 추가)

**Interfaces:**
- Consumes: `BLOG_BASE`, Task 1의 `{ slug, title, description, date }` post, `{ version, body }` section
- Produces:
  - `CHANGELOG_PAGE_URL: string` = `'https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md'`
  - `buildDigestPrompt(posts, sections): string`
  - `buildDigest(raw: string, posts, sections): { headline: string[], cowork: Item[], code: Item[], trend: string }`, `Item = { title, url, summary }`. `raw`가 JSON이 아니면 throw.
  - `renderDigestHtml(digest, dateStr: string): string`
  - `nextState(prev: State | null, listingSlugs: string[], latestVersion: string): State`, `State = { seenBlogSlugs: string[], lastChangelogVersion: string }`

- [ ] **Step 1: Write the failing test**

`scripts/trendSources.test.mjs` 상단 import를 아래로 교체하고, 파일 끝에 describe 블록을 추가한다:

```js
import {
  BLOG_BASE,
  CHANGELOG_PAGE_URL,
  extractBlogSlugs,
  parsePostMeta,
  parseChangelogSections,
  selectNewSections,
  buildDigestPrompt,
  buildDigest,
  renderDigestHtml,
  nextState,
} from './trendSources.mjs';
```

```js
const posts = [
  { slug: 'cowork-is-now-claude', title: 'Cowork 통합', description: '설명 A', date: 'Sep 16, 2026' },
  { slug: 'claude-for-financial-advisors', title: '금융 자문', description: '설명 B', date: '' },
];
const sections = [{ version: '2.1.290', body: '- Added X' }];

describe('buildDigestPrompt', () => {
  it('lists posts with ids and changelog versions', () => {
    const prompt = buildDigestPrompt(posts, sections);
    expect(prompt).toContain('[0] Cowork 통합 — 설명 A (Sep 16, 2026)');
    expect(prompt).toContain('[1] 금융 자문 — 설명 B');
    expect(prompt).toContain('### 2.1.290\n- Added X');
  });

  it('marks empty sources', () => {
    const prompt = buildDigestPrompt([], []);
    expect(prompt.match(/\(없음\)/g)).toHaveLength(2);
  });
});

describe('buildDigest', () => {
  it('resolves blog ids and changelog versions to links from collected data', () => {
    const raw = JSON.stringify({
      headline: ['핵심1', '핵심2', '핵심3'],
      cowork: [{ blogId: 0, summary: ' 코워크 요약 ' }],
      code: [{ changelogVersion: '2.1.290', summary: '코드 요약' }],
      trend: '흐름',
    });
    expect(buildDigest(raw, posts, sections)).toEqual({
      headline: ['핵심1', '핵심2', '핵심3'],
      cowork: [{ title: 'Cowork 통합', url: `${BLOG_BASE}/cowork-is-now-claude`, summary: '코워크 요약' }],
      code: [{ title: 'Claude Code 2.1.290', url: CHANGELOG_PAGE_URL, summary: '코드 요약' }],
      trend: '흐름',
    });
  });

  it('drops unknown ids, invalid summaries and non-array fields without crashing', () => {
    const raw = JSON.stringify({
      headline: 'not an array',
      cowork: [{ blogId: 9, summary: 'x' }, { blogId: 0, summary: 42 }, { blogId: '0', summary: 'y' }],
      code: { changelogVersion: '2.1.290', summary: 'z' },
      trend: null,
    });
    expect(buildDigest(raw, posts, sections)).toEqual({ headline: [], cowork: [], code: [], trend: '' });
  });

  it('throws on non-JSON response', () => {
    expect(() => buildDigest('not json', posts, sections)).toThrow();
  });
});

describe('renderDigestHtml', () => {
  const digest = {
    headline: ['<b>핵심</b> & "강조"'],
    cowork: [{ title: 'T<1>', url: `${BLOG_BASE}/a`, summary: '<script>alert(1)</script>' }],
    code: [],
    trend: '흐름',
  };

  it('escapes LLM text and includes links', () => {
    const html = renderDigestHtml(digest, '2026-10-12');
    expect(html).toContain('&lt;b&gt;핵심&lt;/b&gt; &amp; &quot;강조&quot;');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain(`href="${BLOG_BASE}/a"`);
    expect(html).toContain('2026-10-12');
  });

  it('omits empty sections', () => {
    const html = renderDigestHtml(digest, '2026-10-12');
    expect(html).toContain('Cowork 소식');
    expect(html).not.toContain('Claude Code 소식');
  });
});

describe('nextState', () => {
  it('marks every listing slug as seen, not only processed ones (first run)', () => {
    expect(nextState(null, ['a', 'b', 'c', 'd', 'e', 'f'], '2.1.290')).toEqual({
      seenBlogSlugs: ['a', 'b', 'c', 'd', 'e', 'f'],
      lastChangelogVersion: '2.1.290',
    });
  });

  it('keeps previously seen slugs and adds new ones', () => {
    const prev = { seenBlogSlugs: ['old', 'a'], lastChangelogVersion: '2.1.280' };
    expect(nextState(prev, ['new', 'a'], '2.1.290')).toEqual({
      seenBlogSlugs: ['old', 'a', 'new'],
      lastChangelogVersion: '2.1.290',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/trendSources.test.mjs`
Expected: FAIL — `buildDigestPrompt is not a function` 등 (Task 1 테스트는 PASS)

- [ ] **Step 3: Write minimal implementation**

`scripts/trendSources.mjs` 끝에 추가:

```js
export const CHANGELOG_PAGE_URL = 'https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md';

export function buildDigestPrompt(posts, sections) {
  const postLines = posts.length
    ? posts.map((p, i) => `[${i}] ${p.title} — ${p.description}${p.date ? ` (${p.date})` : ''}`).join('\n')
    : '(없음)';
  const changelog = sections.length
    ? sections.map((s) => `### ${s.version}\n${s.body}`).join('\n\n')
    : '(없음)';
  return [
    '너는 Claude Cowork와 Claude Code 소식을 정리하는 한국어 주간 뉴스레터 편집자야.',
    '아래는 이번 주 새로 올라온 Anthropic 블로그 글과 Claude Code CHANGELOG야.',
    '1. 블로그 글 중 Claude Cowork 또는 Claude Code와 직접 관련된 글만 골라. 관련 없는 글은 넣지 마.',
    '2. CHANGELOG는 사용자에게 의미 있는 새 기능·변화가 있는 버전만 골라 요약해. 사소한 버그 수정만 있는 버전은 생략해.',
    '3. 각 summary는 한국어 1~2문장. headline은 이번 주 가장 중요한 소식 3개를 한 줄씩. trend는 이번 주 흐름 해석 2~4문장.',
    '4. 블로그 글은 대괄호 안 번호를 blogId로, CHANGELOG는 버전 문자열을 changelogVersion으로 써. URL은 쓰지 마.',
    '반드시 아래 JSON 형식으로만 응답해:',
    '{"headline": string[], "cowork": [{"blogId": number, "summary": string}], "code": [{"blogId": number, "summary": string} 또는 {"changelogVersion": string, "summary": string}], "trend": string}',
    '',
    '## 블로그 글',
    postLines,
    '',
    '## Claude Code CHANGELOG',
    changelog,
  ].join('\n');
}

export function buildDigest(raw, posts, sections) {
  const data = JSON.parse(raw);
  const resolve = (item) => {
    const summary = typeof item?.summary === 'string' ? item.summary.trim() : '';
    if (!summary) return null;
    const post = Number.isInteger(item.blogId) ? posts[item.blogId] : undefined;
    if (post) return { title: post.title, url: `${BLOG_BASE}/${post.slug}`, summary };
    if (sections.some((s) => s.version === item.changelogVersion)) {
      return { title: `Claude Code ${item.changelogVersion}`, url: CHANGELOG_PAGE_URL, summary };
    }
    return null;
  };
  const items = (value) => (Array.isArray(value) ? value.map(resolve).filter(Boolean) : []);
  return {
    headline: Array.isArray(data.headline)
      ? data.headline.filter((h) => typeof h === 'string' && h.trim()).map((h) => h.trim()).slice(0, 3)
      : [],
    cowork: items(data.cowork),
    code: items(data.code),
    trend: typeof data.trend === 'string' ? data.trend.trim() : '',
  };
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const H2 = 'style="font-size:18px;margin:28px 0 12px;color:#111"';

function renderItems(heading, items) {
  if (items.length === 0) return '';
  const rows = items
    .map(
      (item) => `<li style="margin-bottom:12px">
  <a href="${escapeHtml(item.url)}" style="color:#c15f3c;font-weight:600">${escapeHtml(item.title)}</a>
  <div style="color:#333">${escapeHtml(item.summary)}</div>
</li>`,
    )
    .join('\n');
  return `<h2 ${H2}>${heading}</h2>\n<ul style="padding-left:20px;margin:0">\n${rows}\n</ul>`;
}

// 메일 클라이언트는 <style>/외부 CSS를 자주 무시하므로 인라인 스타일만 사용한다.
export function renderDigestHtml(digest, dateStr) {
  const headline = digest.headline.length
    ? `<h2 ${H2}>이번 주 핵심</h2>\n<ol style="padding-left:20px;margin:0">${digest.headline
        .map((h) => `<li style="margin-bottom:6px">${escapeHtml(h)}</li>`)
        .join('')}</ol>`
    : '';
  const trend = digest.trend ? `<h2 ${H2}>트렌드 해석</h2>\n<p style="color:#333">${escapeHtml(digest.trend)}</p>` : '';
  return `<div style="font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.6;max-width:640px;margin:0 auto;padding:16px">
<h1 style="font-size:22px;margin:0 0 4px">Claude 주간 트렌드</h1>
<div style="color:#666;font-size:14px">${escapeHtml(dateStr)}</div>
${[headline, renderItems('Cowork 소식', digest.cowork), renderItems('Claude Code 소식', digest.code), trend]
  .filter(Boolean)
  .join('\n')}
</div>`;
}

// 처리하지 않은 글(첫 실행에서 5개 밖, 관련 없는 글)도 seen에 넣어야 다음 주에 다시 새 글로 잡히지 않는다.
export function nextState(prev, listingSlugs, latestVersion) {
  const seen = new Set(prev?.seenBlogSlugs ?? []);
  listingSlugs.forEach((slug) => seen.add(slug));
  return { seenBlogSlugs: [...seen], lastChangelogVersion: latestVersion };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/trendSources.test.mjs`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/trendSources.mjs scripts/trendSources.test.mjs
git commit -m "feat(trend-digest): build digest from LLM output and render email html"
```

---

### Task 3: 실행 스크립트·워크플로·npm script

**Files:**
- Create: `scripts/trend-digest.mjs`
- Create: `.github/workflows/trend-digest.yml`
- Modify: `package.json` (`scripts`에 `trend:digest` 추가)

**Interfaces:**
- Consumes: Task 1·2의 모든 export
- Produces: `npm run trend:digest` (env: `OPENAI_API_KEY`, `RESEND_API_KEY`, `DIGEST_TO_EMAIL`, 선택 `DRY_RUN=1`), 파일 `data/trend-state.json`

- [ ] **Step 1: Write the script**

`scripts/trend-digest.mjs`:

```js
import 'dotenv/config';
import OpenAI from 'openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  BLOG_BASE,
  extractBlogSlugs,
  parsePostMeta,
  parseChangelogSections,
  selectNewSections,
  buildDigestPrompt,
  buildDigest,
  renderDigestHtml,
  nextState,
} from './trendSources.mjs';

const STATE_PATH = path.join(process.cwd(), 'data', 'trend-state.json');
const CHANGELOG_RAW_URL = 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';
const FIRST_RUN_POSTS = 5;
const FIRST_RUN_VERSIONS = 3;
const MAX_VERSIONS = 10;
const DRY_RUN = process.env.DRY_RUN === '1';

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (grow-up-everyday trend digest)' } });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.text();
}

async function readState() {
  try {
    return JSON.parse(await fs.readFile(STATE_PATH, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function saveState(state) {
  if (DRY_RUN) return;
  await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

async function fetchPost(slug) {
  try {
    return parsePostMeta(await fetchText(`${BLOG_BASE}/${slug}`), slug);
  } catch (err) {
    console.warn(`Failed to fetch post ${slug}, using slug only:`, err.message);
    return { slug, title: slug, description: '', date: '' };
  }
}

async function sendEmail({ apiKey, to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Claude 주간 트렌드 <onboarding@resend.dev>', to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const openaiKey = requireEnv('OPENAI_API_KEY');
  const resendKey = DRY_RUN ? '' : requireEnv('RESEND_API_KEY');
  const to = DRY_RUN ? '' : requireEnv('DIGEST_TO_EMAIL');

  const state = await readState();

  const listingSlugs = extractBlogSlugs(await fetchText(BLOG_BASE));
  // 0개면 블로그 HTML 구조가 바뀐 것. "새 소식 없음"으로 넘기면 메일이 조용히 끊기므로 실패시킨다.
  if (listingSlugs.length === 0) throw new Error('No blog posts found on listing page; HTML structure may have changed');

  const allSections = parseChangelogSections(await fetchText(CHANGELOG_RAW_URL));
  if (allSections.length === 0) throw new Error('No versions found in CHANGELOG; format may have changed');

  const newSlugs = state
    ? listingSlugs.filter((slug) => !state.seenBlogSlugs.includes(slug))
    : listingSlugs.slice(0, FIRST_RUN_POSTS);
  const sections = state
    ? selectNewSections(allSections, state.lastChangelogVersion, MAX_VERSIONS)
    : allSections.slice(0, FIRST_RUN_VERSIONS);
  const updatedState = nextState(state, listingSlugs, allSections[0].version);

  if (newSlugs.length === 0 && sections.length === 0) {
    console.log('No new posts or changelog versions.');
    await saveState(updatedState);
    return;
  }

  const posts = await Promise.all(newSlugs.map(fetchPost));
  const client = new OpenAI({ apiKey: openaiKey });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You output strict JSON and nothing else.' },
      { role: 'user', content: buildDigestPrompt(posts, sections) },
    ],
  });
  const digest = buildDigest(completion.choices[0].message.content, posts, sections);

  if (digest.cowork.length === 0 && digest.code.length === 0) {
    console.log(`No Cowork/Code related items among ${posts.length} posts and ${sections.length} versions.`);
    await saveState(updatedState);
    return;
  }

  const today = getTodayDateString();
  const html = renderDigestHtml(digest, today);
  if (DRY_RUN) {
    console.log(html);
    return;
  }

  await sendEmail({ apiKey: resendKey, to, subject: `[Claude 주간 트렌드] ${today}`, html });
  await saveState(updatedState);
  console.log(`Sent digest: ${digest.cowork.length} Cowork, ${digest.code.length} Code items.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script**

`package.json`의 `"scripts"`에서 `"generate:word:ja"` 줄 아래에 추가:

```json
    "trend:digest": "node scripts/trend-digest.mjs",
```

- [ ] **Step 3: Add workflow**

`.github/workflows/trend-digest.yml`:

```yaml
name: Weekly Claude Trend Digest

on:
  schedule:
    - cron: '0 23 * * 0' # 매주 일 23:00 UTC = 월 08:00 KST
  workflow_dispatch: {}

permissions:
  contents: write

jobs:
  digest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: node scripts/trend-digest.mjs
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          DIGEST_TO_EMAIL: ${{ secrets.DIGEST_TO_EMAIL }}
          TZ: Asia/Seoul
      - name: Commit digest state
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/trend-state.json
          git diff --cached --quiet || git commit -m "chore: update trend digest state"
          git push
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS (기존 테스트 포함 전부)

- [ ] **Step 5: Dry run against live sources**

Run (`.env`에 `OPENAI_API_KEY` 필요): `DRY_RUN=1 npm run trend:digest`
Expected: 첫 실행 경로(state 없음) — 콘솔에 `<div style=...><h1 ...>Claude 주간 트렌드</h1>` HTML 출력, `data/trend-state.json` 생성되지 않음. 링크가 `https://claude.com/ko/blog/...` 또는 CHANGELOG URL인지 눈으로 확인.

- [ ] **Step 6: Commit**

```bash
git add scripts/trend-digest.mjs .github/workflows/trend-digest.yml package.json
git commit -m "feat(trend-digest): weekly digest script and workflow"
```

- [ ] **Step 7: 사용자 작업 안내 (코드 아님)**

push 후 사용자가 할 일: Resend 가입(수신 주소와 같은 메일) → API 키 발급 → GitHub repo secrets에 `RESEND_API_KEY`, `DIGEST_TO_EMAIL` 등록 → Actions 탭에서 "Weekly Claude Trend Digest" `Run workflow`로 첫 메일 확인.
