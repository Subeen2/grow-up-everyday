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
