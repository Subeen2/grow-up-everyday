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
