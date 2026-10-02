import type { ExplainRequest } from './explainContract';

export type ExplainErrorKind = 'rate_limited' | 'server' | 'network' | 'invalid';

export class ExplainError extends Error {
  readonly kind: ExplainErrorKind;

  constructor(kind: ExplainErrorKind) {
    super(kind);
    this.kind = kind;
  }
}

export const EXPLAIN_ERROR_MESSAGES: Record<ExplainErrorKind, string> = {
  rate_limited: '오늘 질문을 다 썼어요. 내일 다시 와주세요',
  server: '잠깐 문제가 생겼어요',
  network: '인터넷 연결이 필요해요',
  invalid: '요청을 처리할 수 없어요',
};

export function getExplainApiUrl(): string | undefined {
  return import.meta.env.VITE_EXPLAIN_API_URL || undefined;
}

export function toExplainEntry<T extends { gameExamples?: string[] }>(entry: T): Omit<T, 'gameExamples'> {
  const { gameExamples: _unused, ...rest } = entry;
  return rest;
}

export async function requestExplanation(payload: ExplainRequest): Promise<string> {
  const url = getExplainApiUrl();
  if (!url) throw new ExplainError('invalid');

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ExplainError('network');
  }

  if (res.status === 429) throw new ExplainError('rate_limited');
  if (res.status >= 500) throw new ExplainError('server');
  if (!res.ok) throw new ExplainError('invalid');

  const data = await res.json().catch(() => null);
  if (typeof data?.reply !== 'string') throw new ExplainError('server');
  return data.reply;
}
