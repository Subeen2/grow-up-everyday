// @vitest-environment node
import { findSimilarEnWords, VectorIndex } from './similarWords';

const DATE = '2026-09-07';

function match(id: string, word: string, meaningKo: string) {
  return { id, metadata: { word, meaningKo } };
}

function makeIndex(
  matches: { id: string; metadata?: Record<string, unknown> }[],
  stored: { id: string; values: number[] }[] = [{ id: DATE, values: [0.1, 0.2] }],
) {
  return {
    getByIds: vi.fn(async () => stored),
    query: vi.fn(async () => ({ matches })),
  } satisfies VectorIndex;
}

describe('findSimilarEnWords', () => {
  it('queries with the stored vector of the given date', async () => {
    const index = makeIndex([match('2026-08-01', 'relax', '긴장을 풀다')]);
    await findSimilarEnWords(index, DATE);
    expect(index.getByIds).toHaveBeenCalledWith([DATE]);
    expect(index.query).toHaveBeenCalledWith([0.1, 0.2], { topK: 6, returnMetadata: 'all' });
  });

  it('excludes the word itself wherever it appears and keeps order', async () => {
    const index = makeIndex([
      match('2026-08-01', 'relax', '긴장을 풀다'),
      match(DATE, 'figure out', '알아내다'),
      match('2026-08-02', 'laid-back', '느긋한'),
    ]);
    expect(await findSimilarEnWords(index, DATE)).toEqual([
      { word: 'relax', meaningKo: '긴장을 풀다' },
      { word: 'laid-back', meaningKo: '느긋한' },
    ]);
  });

  it('returns at most 5 words', async () => {
    const index = makeIndex(['1', '2', '3', '4', '5', '6'].map((n) => match(`2026-08-0${n}`, `w${n}`, `뜻${n}`)));
    expect(await findSimilarEnWords(index, DATE)).toHaveLength(5);
  });

  it('drops matches with missing or invalid metadata', async () => {
    const index = makeIndex([
      { id: '2026-08-01' },
      { id: '2026-08-02', metadata: { word: 42, meaningKo: '뜻' } },
      { id: '2026-08-03', metadata: { word: '  ', meaningKo: '뜻' } },
      match('2026-08-04', 'relax', '긴장을 풀다'),
    ]);
    expect(await findSimilarEnWords(index, DATE)).toEqual([{ word: 'relax', meaningKo: '긴장을 풀다' }]);
  });

  it('returns null when the date has no stored vector', async () => {
    const index = makeIndex([match('2026-08-01', 'relax', '긴장을 풀다')], []);
    expect(await findSimilarEnWords(index, DATE)).toBeNull();
    expect(index.query).not.toHaveBeenCalled();
  });

  it('returns null when only the word itself matches', async () => {
    expect(await findSimilarEnWords(makeIndex([match(DATE, 'figure out', '알아내다')]), DATE)).toBeNull();
  });

  it('returns null when the index throws', async () => {
    const index = makeIndex([]);
    index.getByIds.mockRejectedValueOnce(new Error('vectorize down'));
    expect(await findSimilarEnWords(index, DATE)).toBeNull();
  });
});
