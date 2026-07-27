import { ArchiveIndexItem } from './wordTypes';

export function normalizeForComparison(text: string): string {
  return text.trim().toLowerCase();
}

export function isCorrectAnswer(input: string, target: string): boolean {
  return normalizeForComparison(input) === normalizeForComparison(target);
}

export function pickRandomOtherWord(
  archiveIndex: ArchiveIndexItem[],
  excludeDate: string
): ArchiveIndexItem | null {
  const candidates = archiveIndex.filter((item) => item.date !== excludeDate);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
