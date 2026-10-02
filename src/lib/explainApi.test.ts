import { requestExplanation, ExplainError, toExplainEntry, getExplainApiUrl } from './explainApi';
import type { ExplainRequest } from './explainContract';

const payload: ExplainRequest = {
  language: 'en',
  profile: { level: 'everyday', readsIpa: false, memo: '' },
  entry: {
    date: '2026-09-08',
    word: 'figure out',
    partOfSpeech: 'phrasal verb',
    pronunciationKo: '피겨 아웃',
    meaningKo: '알아내다',
    exampleEn: 'I finally figured it out.',
    exampleKo: '드디어 알아냈어.',
  },
  relatedWords: [],
  messages: [],
};

async function expectKind(promise: Promise<unknown>, kind: string) {
  await expect(promise).rejects.toBeInstanceOf(ExplainError);
  await expect(promise).rejects.toMatchObject({ kind });
}

describe('explainApi', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_EXPLAIN_API_URL', 'https://explain.test');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('reads the API URL at call time', () => {
    expect(getExplainApiUrl()).toBe('https://explain.test');
    vi.stubEnv('VITE_EXPLAIN_API_URL', '');
    expect(getExplainApiUrl()).toBeUndefined();
  });

  it('posts the payload as JSON and returns the reply', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ reply: '설명이에요' }) });

    await expect(requestExplanation(payload)).resolves.toBe('설명이에요');
    expect(fetch).toHaveBeenCalledWith('https://explain.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  });

  it('maps 429 to rate_limited', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    await expectKind(requestExplanation(payload), 'rate_limited');
  });

  it('maps 5xx to server', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });
    await expectKind(requestExplanation(payload), 'server');
  });

  it('maps 400 and 403 to invalid', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    await expectKind(requestExplanation(payload), 'invalid');
  });

  it('maps a rejected fetch to network', async () => {
    (fetch as any).mockRejectedValue(new TypeError('Failed to fetch'));
    await expectKind(requestExplanation(payload), 'network');
  });

  it('treats a 200 without a string reply as a server error', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await expectKind(requestExplanation(payload), 'server');
  });

  it('strips gameExamples before sending an entry', () => {
    expect(toExplainEntry({ date: 'd', word: 'w', gameExamples: ['x'] })).toEqual({ date: 'd', word: 'w' });
  });
});
