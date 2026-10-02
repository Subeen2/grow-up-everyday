import { validateExplainRequest } from './validate';
import { buildOpenAiMessages } from './prompt';

export interface KvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface Env {
  OPENAI_API_KEY: string;
  ALLOWED_ORIGINS: string; // 쉼표 구분
  RATE_LIMIT: KvStore;
}

const BODY_MAX_BYTES = 8192;
const DAILY_LIMIT_PER_IP = 30;
const OPENAI_TIMEOUT_MS = 15000;
const ONE_DAY_SECONDS = 86400;

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function callOpenAi(apiKey: string, messages: ReturnType<typeof buildOpenAiMessages>): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 500, messages }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OpenAI responded ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const reply = data.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || reply.trim() === '') throw new Error('OpenAI returned empty content');
  return reply.trim();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    if (!allowedOrigins.includes(origin)) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
    }

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);

    const text = await request.text();
    if (new TextEncoder().encode(text).length > BODY_MAX_BYTES) return json({ error: 'too_large' }, 400, origin);

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: 'invalid' }, 400, origin);
    }
    const req = validateExplainRequest(body);
    if (!req) return json({ error: 'invalid' }, 400, origin);

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const key = `rate:${ip}:${new Date().toISOString().slice(0, 10)}`;
    const used = Number((await env.RATE_LIMIT.get(key)) ?? 0);
    if (used >= DAILY_LIMIT_PER_IP) return json({ error: 'rate_limited' }, 429, origin);
    // ponytail: KV get→put is not atomic, so concurrent requests can slip a few past the limit; move to Durable Objects if the limit must be exact
    await env.RATE_LIMIT.put(key, String(used + 1), { expirationTtl: ONE_DAY_SECONDS });

    try {
      const reply = await callOpenAi(env.OPENAI_API_KEY, buildOpenAiMessages(req));
      return json({ reply }, 200, origin);
    } catch {
      return json({ error: 'upstream' }, 502, origin);
    }
  },
};
