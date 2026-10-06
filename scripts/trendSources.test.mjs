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
