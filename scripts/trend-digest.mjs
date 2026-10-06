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
