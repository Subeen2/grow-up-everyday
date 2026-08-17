import { act, renderHook, waitFor } from '@testing-library/react';
import { useWordBlankGameState, WordBlankGameApi, WordBlankGameConfig } from './useWordBlankGameState';

interface Entry {
  date: string;
  word: string;
  sentence: string;
}

const config: WordBlankGameConfig<Entry> = {
  getWord: (entry) => entry.word,
  getSentencePool: (entry) => [entry.sentence],
};

function makeApi(entries: Entry[]): WordBlankGameApi<Entry, { date: string }> {
  return {
    fetchArchiveIndex: vi.fn().mockResolvedValue(entries.map((e) => ({ date: e.date }))),
    fetchWordByDate: vi.fn((date: string) => Promise.resolve(entries.find((e) => e.date === date) ?? null)),
  };
}

describe('useWordBlankGameState', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads a question built from a random archive entry', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const api = makeApi([{ date: '2026-07-23', word: 'awesome', sentence: 'This place is awesome!' }]);

    const { result } = renderHook(() => useWordBlankGameState(api, config));

    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'question',
        entry: { date: '2026-07-23', word: 'awesome', sentence: 'This place is awesome!' },
        challenge: { before: 'This place is ', after: '!', answer: 'awesome' },
        score: 0,
        streak: 0,
      })
    );
  });

  it("builds the question from a randomly picked sentence in the entry's sentence pool", async () => {
    // Only one archive entry, so this value affects sentence selection but not entry selection.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const poolConfig: WordBlankGameConfig<Entry & { extra: string[] }> = {
      getWord: (entry) => entry.word,
      getSentencePool: (entry) => [entry.sentence, ...entry.extra],
    };
    const entry = {
      date: '2026-07-23',
      word: 'awesome',
      sentence: 'This place is awesome!',
      extra: ['Awesome work today.'],
    };
    const api: WordBlankGameApi<typeof entry, { date: string }> = {
      fetchArchiveIndex: vi.fn().mockResolvedValue([{ date: entry.date }]),
      fetchWordByDate: vi.fn().mockResolvedValue(entry),
    };

    const { result } = renderHook(() => useWordBlankGameState(api, poolConfig));

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'question',
        challenge: { before: '', after: ' work today.', answer: 'Awesome' },
      })
    );
  });

  it('reports empty when the archive has no words', async () => {
    const api = makeApi([]);

    const { result } = renderHook(() => useWordBlankGameState(api, config));

    await waitFor(() => expect(result.current.state).toEqual({ status: 'empty', score: 0, streak: 0 }));
  });

  it('skips entries whose target word is not found in the sentence', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const api = makeApi([
      { date: '2026-07-20', word: 'missing', sentence: 'No match here.' },
      { date: '2026-07-23', word: 'awesome', sentence: 'This place is awesome!' },
    ]);

    const { result } = renderHook(() => useWordBlankGameState(api, config));

    await waitFor(() => {
      expect(result.current.state.status).toBe('question');
    });
    expect(result.current.state).toMatchObject({ entry: { date: '2026-07-23' } });
  });

  it('reports error when the archive index fetch fails', async () => {
    const api: WordBlankGameApi<Entry, { date: string }> = {
      fetchArchiveIndex: vi.fn().mockRejectedValue(new Error('네트워크 오류')),
      fetchWordByDate: vi.fn(),
    };

    const { result } = renderHook(() => useWordBlankGameState(api, config));

    await waitFor(() => expect(result.current.state).toEqual({ status: 'error', message: '네트워크 오류' }));
  });

  it('increments score and streak on a correct answer and advances to a different question', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const api = makeApi([
      { date: '2026-07-23', word: 'awesome', sentence: 'This place is awesome!' },
      { date: '2026-07-20', word: 'great', sentence: 'This is great!' },
    ]);

    const { result } = renderHook(() => useWordBlankGameState(api, config));
    await waitFor(() => expect(result.current.state.status).toBe('question'));

    randomSpy.mockReturnValue(0);
    await act(async () => result.current.handleCorrect());

    await waitFor(() =>
      expect(result.current.state).toMatchObject({ status: 'question', entry: { date: '2026-07-20' }, score: 1, streak: 1 })
    );
  });

  it('resets streak but keeps score on skip', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const api = makeApi([
      { date: '2026-07-23', word: 'awesome', sentence: 'This place is awesome!' },
      { date: '2026-07-20', word: 'great', sentence: 'This is great!' },
    ]);

    const { result } = renderHook(() => useWordBlankGameState(api, config));
    await waitFor(() => expect(result.current.state.status).toBe('question'));

    await act(async () => result.current.handleCorrect());
    await waitFor(() => expect(result.current.state).toMatchObject({ score: 1, streak: 1 }));

    await act(async () => result.current.handleSkip());
    await waitFor(() => expect(result.current.state).toMatchObject({ score: 1, streak: 0 }));
  });
});
