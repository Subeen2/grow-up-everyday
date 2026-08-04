import { normalizeJaForComparison, isCorrectJaAnswer } from './voiceChallenge';

describe('normalizeJaForComparison', () => {
  it('converts full-width katakana to hiragana', () => {
    expect(normalizeJaForComparison('キョウ')).toBe('きょう');
  });

  it('strips punctuation and whitespace', () => {
    expect(normalizeJaForComparison('今日は、大丈夫です。')).toBe('今日は大丈夫です');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeJaForComparison('  だいじょうぶ  ')).toBe('だいじょうぶ');
  });
});

describe('isCorrectJaAnswer', () => {
  const entry = {
    exampleJa: '今日は大丈夫です。',
    exampleReading: 'きょうはだいじょうぶです',
  };

  it('accepts a spoken transcript matching the kanji example', () => {
    expect(isCorrectJaAnswer('今日は大丈夫です。', entry)).toBe(true);
  });

  it('accepts a spoken transcript matching the hiragana reading', () => {
    expect(isCorrectJaAnswer('きょうはだいじょうぶです', entry)).toBe(true);
  });

  it('rejects a mismatched transcript', () => {
    expect(isCorrectJaAnswer('明日は大丈夫です。', entry)).toBe(false);
  });
});
