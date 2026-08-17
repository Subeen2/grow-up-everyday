import 'dotenv/config';
import OpenAI from 'openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateGameExamples } from './wordGenerator.mjs';

const WORDS_DIR = path.join(process.cwd(), 'public', 'data', 'words');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const client = new OpenAI({ apiKey });
  const files = (await fs.readdir(WORDS_DIR)).filter((f) => f.endsWith('.json'));

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(WORDS_DIR, file);
    const entry = JSON.parse(await fs.readFile(filePath, 'utf-8'));

    if (Array.isArray(entry.gameExamples) && entry.gameExamples.length > 0) {
      skipped++;
      continue;
    }

    try {
      entry.gameExamples = await generateGameExamples(client, {
        word: entry.word,
        meaningKo: entry.meaningKo,
        existingExample: entry.exampleEn,
      });
      await fs.writeFile(filePath, JSON.stringify(entry, null, 2) + '\n');
      updated++;
      console.log(`Backfilled game examples for ${entry.date} (${entry.word})`);
    } catch (err) {
      failed++;
      console.warn(`Failed to backfill ${entry.date} (${entry.word}):`, err.message);
    }

    await delay(500);
  }

  console.log(`Done. updated=${updated} skipped=${skipped} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
