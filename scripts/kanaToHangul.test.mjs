import { kanaToHangul } from './kanaToHangul.mjs';

describe('kanaToHangul', () => {
  it.each([
    ['てつだう', '테츠다우'],
    ['かんしゃ', '칸샤'],
    ['りかい', '리카이'],
    ['いっしょ', '잇쇼'],
    ['ちゃんと', '챤토'],
  ])('converts basic kana, small ya/yu/yo, っ and ん: %s', (kana, hangul) => {
    expect(kanaToHangul(kana)).toBe(hangul);
  });

  it.each([
    ['せいちょう', '세-쵸-'],
    ['けいけん', '케-켄'],
    ['きぼう', '키보-'],
    ['おおく', '오-쿠'],
    ['だいじょうぶ', '다이죠-부'],
    ['ゆうき', '유-키'],
    ['いい', '이-'],
    ['こーひー', '코-히-'],
  ])('marks long vowels with "-": %s', (kana, hangul) => {
    expect(kanaToHangul(kana)).toBe(hangul);
  });

  it('does not treat the い of ている as a long vowel', () => {
    expect(kanaToHangul('もっています')).toBe('못테이마스');
  });

  it('reads phrase-final は/へ as particles and を as 오', () => {
    expect(kanaToHangul('きょうは がっこうへ いきます')).toBe('쿄-와 갓코-에 이키마스');
    expect(kanaToHangul('ほんを よむ')).toBe('혼오 요무');
    expect(kanaToHangul('はな')).toBe('하나');
  });

  it('does not join long vowels across phrase boundaries', () => {
    expect(kanaToHangul('これを おおく')).toBe('코레오 오-쿠');
  });

  it('accepts katakana and drops sentence-ending punctuation', () => {
    expect(kanaToHangul('テレビを みます。')).toBe('테레비오 미마스');
    expect(kanaToHangul('ほんとうに？')).toBe('혼토-니?');
  });

  it('throws on characters it cannot read, such as kanji left in a reading', () => {
    expect(() => kanaToHangul('かれは多く')).toThrow('Cannot convert');
  });
});
