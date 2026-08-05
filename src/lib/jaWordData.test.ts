import { getLocalDateString } from './wordData';
import { fetchWordByDate, fetchArchiveIndex, fetchTodayWord } from './jaWordData';

describe('jaWordData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  const sample = {
    date: '2026-08-04',
    word: '大丈夫',
    reading: 'だいじょうぶ',
    meaningKo: '괜찮아',
    exampleJa: '今日は大丈夫です。',
    exampleReading: 'きょうはだいじょうぶです',
    exampleKo: '오늘은 괜찮아요.',
  };

  it('fetchWordByDate reads from the ja data path', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => sample });

    const result = await fetchWordByDate('2026-08-04');

    expect(result).toEqual(sample);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('data/ja/words/2026-08-04.json'));
  });

  it('fetchArchiveIndex reads from the ja archive index path', async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => [] });

    await fetchArchiveIndex();

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('data/ja/archive-index.json'));
  });

  it("fetchTodayWord returns today's ja entry when it exists", async () => {
    const todayStr = getLocalDateString();
    const entry = { ...sample, date: todayStr };
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => entry });

    expect(await fetchTodayWord()).toEqual(entry);
  });
});
