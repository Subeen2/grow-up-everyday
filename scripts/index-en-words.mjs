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
