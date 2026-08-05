import 'dotenv/config';
import OpenAI from 'openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateWordEntry, getRecentWords } from './wordGeneratorJa.mjs';

const DATA_DIR = path.join(process.cwd(), 'public', 'data', 'ja');
const WORDS_DIR = path.join(DATA_DIR, 'words');
const INDEX_PATH = path.join(DATA_DIR, 'archive-index.json');

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function readArchiveIndex() {
  try {
    const raw = await fs.readFile(INDEX_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  await fs.mkdir(WORDS_DIR, { recursive: true });

  const archiveIndex = await readArchiveIndex();
  const today = getTodayDateString();

  if (archiveIndex.some((item) => item.date === today)) {
    console.log(`Japanese word for ${today} already exists, skipping.`);
    return;
  }

  const recentWords = getRecentWords(archiveIndex);
  const client = new OpenAI({ apiKey });
  const entry = await generateWordEntry(client, recentWords);
  entry.date = today;

  await fs.writeFile(path.join(WORDS_DIR, `${today}.json`), JSON.stringify(entry, null, 2) + '\n');

  archiveIndex.unshift({ date: today, word: entry.word, meaningKo: entry.meaningKo });
  await fs.writeFile(INDEX_PATH, JSON.stringify(archiveIndex, null, 2) + '\n');

  console.log(`Generated Japanese word for ${today}: ${entry.word}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
