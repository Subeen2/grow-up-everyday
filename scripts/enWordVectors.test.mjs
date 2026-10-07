import { buildEmbeddingText, loadEnEntries, buildRecords, toNdjson, assertUpsertOk } from './enWordVectors.mjs';

const entry = {
  date: '2026-10-06',
  word: 'get in touch',
  partOfSpeech: 'phrasal verb',
  meaningKo: '연락하다, 접촉하다',
  exampleEn: 'I need to get in touch with my professor.',
};

describe('buildEmbeddingText', () => {
  it('combines word, part of speech, meaning and example', () => {
    expect(buildEmbeddingText(entry)).toBe(
      'get in touch (phrasal verb): 연락하다, 접촉하다. I need to get in touch with my professor.',
    );
  });
});

describe('loadEnEntries', () => {
  it('reads each archive date and keeps the date on the entry', async () => {
    const readEntry = async (date) => ({ ...entry, date: undefined, word: `w-${date}` });
    const result = await loadEnEntries([{ date: '2026-10-06' }, { date: '2026-10-05' }], readEntry);
    expect(result.map((e) => [e.date, e.word])).toEqual([
      ['2026-10-06', 'w-2026-10-06'],
      ['2026-10-05', 'w-2026-10-05'],
    ]);
  });

  it('skips dates whose word file cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const readEntry = async (date) => {
      if (date === '2026-10-05') throw new Error('ENOENT');
      return entry;
    };
    const result = await loadEnEntries([{ date: '2026-10-06' }, { date: '2026-10-05' }], readEntry);
    expect(result.map((e) => e.date)).toEqual(['2026-10-06']);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe('buildRecords', () => {
  it('pairs entries with embeddings using date as id', () => {
    expect(buildRecords([entry], [[0.1, 0.2]])).toEqual([
      { id: '2026-10-06', values: [0.1, 0.2], metadata: { word: 'get in touch', meaningKo: '연락하다, 접촉하다' } },
    ]);
  });

  it('throws when embedding count does not match entries', () => {
    expect(() => buildRecords([entry], [])).toThrow();
  });
});

describe('toNdjson', () => {
  it('writes one JSON object per line with trailing newline', () => {
    const records = buildRecords([entry, { ...entry, date: '2026-10-05' }], [[1], [2]]);
    const out = toNdjson(records);
    expect(out.endsWith('\n')).toBe(true);
    const lines = out.trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1]).id).toBe('2026-10-05');
  });
});

describe('assertUpsertOk', () => {
  it('passes on 200 with success true', () => {
    expect(() => assertUpsertOk(200, { success: true, result: { mutationId: 'm' } })).not.toThrow();
  });

  it('throws on 200 with success false', () => {
    expect(() => assertUpsertOk(200, { success: false, errors: [{ message: 'bad' }] })).toThrow(/bad/);
  });

  it('throws on non-2xx status', () => {
    expect(() => assertUpsertOk(403, { success: false, errors: [] })).toThrow(/403/);
  });
});
