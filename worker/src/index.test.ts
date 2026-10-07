// @vitest-environment node
import worker, { Env } from './index';
import { enRequest, jaRequest } from './testFixtures';
import type { VectorIndex } from './similarWords';

const ORIGIN = 'https://subeen2.github.io';

function makeKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

function makeEnv(kv = makeKv(), enWords?: VectorIndex): Env {
  return { OPENAI_API_KEY: 'sk-test', ALLOWED_ORIGINS: `${ORIGIN}, http://localhost:5173`, RATE_LIMIT: kv, EN_WORDS: enWords };
}

function post(body: unknown, origin = ORIGIN) {
  return new Request('https://worker.test', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const openAiReply = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

describe('worker fetch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-02T03:00:00Z'));
    vi.stubGlobal('fetch', vi.fn(async () => openAiReply('経는 지날 경이에요')));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('answers CORS preflight for an allowed origin', async () => {
    const res = await worker.fetch(new Request('https://worker.test', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), makeEnv());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('rejects other origins with 403 without calling OpenAI', async () => {
    const res = await worker.fetch(post(jaRequest, 'https://evil.example'), makeEnv());
    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects bodies over 48KB', async () => {
    const res = await worker.fetch(post('x'.repeat(49153)), makeEnv());
    expect(res.status).toBe(400);
  });

  it('accepts a conversation at the validator limits (Korean is 3 bytes per character)', async () => {
    const messages = [];
    for (let i = 0; i < 5; i++) {
      messages.push({ role: 'assistant', content: '가'.repeat(2000) }, { role: 'user', content: '나'.repeat(200) });
    }
    const res = await worker.fetch(post({ ...jaRequest, messages }), makeEnv());
    expect(res.status).toBe(200);
  });

  it('rejects invalid JSON and invalid requests without counting them', async () => {
    const kv = makeKv();
    expect((await worker.fetch(post('{bad'), makeEnv(kv))).status).toBe(400);
    expect((await worker.fetch(post({ ...jaRequest, language: 'fr' }), makeEnv(kv))).status).toBe(400);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('returns the reply, calls OpenAI with the expected options, and counts the request', async () => {
    const kv = makeKv();
    const res = await worker.fetch(post(jaRequest), makeEnv(kv));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: '経는 지날 경이에요' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);

    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe('gpt-4o-mini');
    expect(sent.max_tokens).toBe(500);
    expect(sent.messages[0].role).toBe('system');

    expect(kv.put).toHaveBeenCalledWith('rate:1.2.3.4:2026-10-02', '1', { expirationTtl: 86400 });
  });

  it('returns 429 once the IP has used 30 requests today', async () => {
    const kv = makeKv({ 'rate:1.2.3.4:2026-10-02': '30' });
    const res = await worker.fetch(post(jaRequest), makeEnv(kv));
    expect(res.status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 502 when OpenAI fails, times out, or returns empty content', async () => {
    (fetch as any).mockImplementationOnce(async () => new Response('err', { status: 500 }));
    expect((await worker.fetch(post(jaRequest), makeEnv())).status).toBe(502);

    (fetch as any).mockImplementationOnce(async () => {
      throw new DOMException('timed out', 'TimeoutError');
    });
    expect((await worker.fetch(post(jaRequest), makeEnv())).status).toBe(502);

    (fetch as any).mockImplementationOnce(async () => openAiReply('   '));
    expect((await worker.fetch(post(jaRequest), makeEnv())).status).toBe(502);
  });

  describe('English related words', () => {
    const clientRequest = { ...enRequest, relatedWords: [{ word: 'recent', meaningKo: '최근' }] };

    function makeIndex(): VectorIndex & { getByIds: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> } {
      return {
        getByIds: vi.fn(async () => [{ id: enRequest.entry.date, values: [0.1] }]),
        query: vi.fn(async () => ({
          matches: [{ id: '2026-08-01', metadata: { word: 'relax', meaningKo: '긴장을 풀다' } }],
        })),
      };
    }

    const systemPrompt = () => JSON.parse((fetch as any).mock.calls[0][1].body).messages[0].content as string;

    it('uses vector search results for English requests', async () => {
      const res = await worker.fetch(post(clientRequest), makeEnv(makeKv(), makeIndex()));
      expect(res.status).toBe(200);
      expect(systemPrompt()).toContain('<관련 단어> relax(긴장을 풀다) </관련 단어>');
    });

    it('falls back to client related words when vector search fails', async () => {
      const index = makeIndex();
      index.getByIds.mockRejectedValueOnce(new Error('down'));
      const res = await worker.fetch(post(clientRequest), makeEnv(makeKv(), index));
      expect(res.status).toBe(200);
      expect(systemPrompt()).toContain('<관련 단어> recent(최근) </관련 단어>');
    });

    it('does not query the index for Japanese requests', async () => {
      const index = makeIndex();
      await worker.fetch(post(jaRequest), makeEnv(makeKv(), index));
      expect(index.getByIds).not.toHaveBeenCalled();
      expect(systemPrompt()).toContain('試験(시험)');
    });
  });
});
