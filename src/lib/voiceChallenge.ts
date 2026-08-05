const PUNCTUATION_AND_SPACE = /[\s。、！？!?.,]/g;

export function normalizeJaForComparison(text: string): string {
  return text
    .trim()
    .replace(PUNCTUATION_AND_SPACE, '')
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

// ponytail: accepts the kanji form or the pure-hiragana reading, but not other
// valid orthographic variants (different kanji for the same word, okurigana
// differences). Upgrade path if false negatives become common: run recognized
// text through a morphological reading converter (e.g. kuromoji) before compare.
export function isCorrectJaAnswer(spoken: string, entry: { exampleJa: string; exampleReading: string }): boolean {
  const normalizedSpoken = normalizeJaForComparison(spoken);
  return (
    normalizedSpoken === normalizeJaForComparison(entry.exampleJa) ||
    normalizedSpoken === normalizeJaForComparison(entry.exampleReading)
  );
}
