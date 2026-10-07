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
