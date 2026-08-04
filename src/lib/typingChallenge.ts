export function normalizeForComparison(text: string): string {
  return text.trim().toLowerCase();
}

export function isCorrectAnswer(input: string, target: string): boolean {
  return normalizeForComparison(input) === normalizeForComparison(target);
}

export function pickRandomOtherWord<T extends { date: string }>(archiveIndex: T[], excludeDate: string): T | null {
  const candidates = archiveIndex.filter((item) => item.date !== excludeDate);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
