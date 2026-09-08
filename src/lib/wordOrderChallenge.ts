export function tokenize(sentence: string): string[] {
  return sentence.split(' ').filter((token) => token.length > 0);
}

export function shuffleTokens(tokens: string[]): string[] {
  const result = [...tokens];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function isCorrectOrder(submitted: string[], target: string[]): boolean {
  return submitted.length === target.length && submitted.every((token, i) => token === target[i]);
}
