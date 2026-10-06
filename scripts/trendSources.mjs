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
