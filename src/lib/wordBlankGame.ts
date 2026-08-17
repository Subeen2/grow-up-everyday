import { normalizeForComparison } from './typingChallenge';

export interface BlankChallenge {
  before: string;
  after: string;
  answer: string;
}

export function buildBlankChallenge(sentence: string, targetWord: string): BlankChallenge | null {
  const idx = sentence.toLowerCase().indexOf(targetWord.toLowerCase());
  if (idx === -1) return null;
  return {
    before: sentence.slice(0, idx),
    after: sentence.slice(idx + targetWord.length),
    answer: sentence.slice(idx, idx + targetWord.length),
  };
}

export function isBlankAnswerCorrect(input: string, answer: string): boolean {
  return normalizeForComparison(input) === normalizeForComparison(answer);
}

export function pickRandomEntry<T extends { date: string }>(pool: T[], excludeDate?: string): T | null {
  const candidates = excludeDate ? pool.filter((item) => item.date !== excludeDate) : pool;
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

export function buildBlankChallengeFromPool(sentences: string[], targetWord: string): BlankChallenge | null {
  const candidates = sentences
    .map((sentence) => buildBlankChallenge(sentence, targetWord))
    .filter((challenge): challenge is BlankChallenge => challenge !== null);
  return pickRandom(candidates);
}
