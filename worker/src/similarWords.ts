import { MAX_RELATED_WORDS, RelatedWord } from '../../src/lib/explainContract';

// @cloudflare/workers-types를 추가하지 않으려고 Vectorize 바인딩에서 쓰는 메서드만 정의한다 (KvStore와 같은 방식).
export interface VectorIndex {
  getByIds(ids: string[]): Promise<{ id: string; values: number[] | Float32Array }[]>;
  query(
    vector: number[] | Float32Array,
    options: { topK: number; returnMetadata: 'all' },
  ): Promise<{ matches: { id: string; metadata?: Record<string, unknown> }[] }>;
}

function toRelatedWord(metadata: Record<string, unknown> | undefined): RelatedWord | null {
  const word = metadata?.word;
  const meaningKo = metadata?.meaningKo;
  if (typeof word !== 'string' || !word.trim() || typeof meaningKo !== 'string' || !meaningKo.trim()) return null;
  return { word, meaningKo };
}

const LOOKUP_TIMEOUT_MS = 1500;

// null이면 호출부가 클라이언트가 보낸 목록을 그대로 쓴다. 검색 실패·지연이 설명 기능을 막으면 안 되므로
// 예외와 시간 초과도 null로 바꾼다.
export async function findSimilarEnWords(index: VectorIndex, date: string): Promise<RelatedWord[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), LOOKUP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([lookup(index, date), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function lookup(index: VectorIndex, date: string): Promise<RelatedWord[] | null> {
  try {
    const [self] = await index.getByIds([date]);
    if (!self) return null;

    // 결과에 자기 자신이 섞여 오므로 1개 더 받는다.
    const { matches } = await index.query(self.values, { topK: MAX_RELATED_WORDS + 1, returnMetadata: 'all' });
    const words = matches
      .filter((m) => m.id !== date)
      .map((m) => toRelatedWord(m.metadata))
      .filter((w): w is RelatedWord => w !== null)
      .slice(0, MAX_RELATED_WORDS);
    return words.length > 0 ? words : null;
  } catch {
    return null;
  }
}
