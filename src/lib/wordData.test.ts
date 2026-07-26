import { getLocalDateString, fetchWordByDate, fetchArchiveIndex, fetchTodayWord } from './wordData';

describe('getLocalDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(getLocalDateString(new Date(2026, 6, 23))).toBe('2026-07-23');
  });

  it('pads single-digit month and day', () => {
    expect(getLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('fetchWordByDate', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  const sample = {
    date: '2026-07-23',
    word: 'awesome',
    partOfSpeech: 'adjective',
    pronunciationKo: '어섬',
    meaningKo: '정말 멋진',
    exampleEn: 'x',
    exampleKo: 'y',
  };

  it('returns the parsed entry when found', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => sample });
    expect(await fetchWordByDate('2026-07-23')).toEqual(sample);
  });

  it('returns null on 404', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 404 });
    expect(await fetchWordByDate('2099-01-01')).toBeNull();
  });

  it('throws on other non-ok statuses', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchWordByDate('2026-07-23')).rejects.toThrow();
  });
});

describe('fetchArchiveIndex', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sorts items by date descending', async () => {
    const items = [
      { date: '2026-07-20', word: 'a', meaningKo: 'a' },
      { date: '2026-07-23', word: 'c', meaningKo: 'c' },
      { date: '2026-07-21', word: 'b', meaningKo: 'b' },
    ];
    (fetch as any).mockResolvedValue({ ok: true, json: async () => items });
    const result = await fetchArchiveIndex();
    expect(result.map((i) => i.date)).toEqual(['2026-07-23', '2026-07-21', '2026-07-20']);
  });
});

describe('fetchTodayWord', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it("returns today's entry when it exists", async () => {
    const todayStr = getLocalDateString();
    const entry = { date: todayStr, word: 'awesome', partOfSpeech: 'adjective', pronunciationKo: '어섬', meaningKo: '정말 멋진', exampleEn: 'x', exampleKo: 'y' };
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => entry });
    expect(await fetchTodayWord()).toEqual(entry);
  });

  it('falls back to the latest archive entry when today is missing', async () => {
    const latest = { date: '2026-07-20', word: 'chill', partOfSpeech: 'verb', pronunciationKo: '칠', meaningKo: '느긋하게 쉬다', exampleEn: 'x', exampleKo: 'y' };
    (fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ date: '2026-07-20', word: 'chill', meaningKo: '느긋하게 쉬다' }] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => latest });
    expect(await fetchTodayWord()).toEqual(latest);
  });

  it('throws when no data exists at all', async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    await expect(fetchTodayWord()).rejects.toThrow('No word data available yet');
  });
});
