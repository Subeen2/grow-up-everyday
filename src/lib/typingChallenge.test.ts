import { normalizeForComparison, isCorrectAnswer, pickRandomOtherWord } from './typingChallenge';
import { ArchiveIndexItem } from './wordTypes';

describe('normalizeForComparison', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalizeForComparison('  Hello World.  ')).toBe('hello world.');
  });
});

describe('isCorrectAnswer', () => {
  it('matches ignoring case and surrounding whitespace', () => {
    expect(isCorrectAnswer('  You Should TAKE it easy.  ', 'You should take it easy.')).toBe(true);
  });

  it('does not match when punctuation differs', () => {
    expect(isCorrectAnswer('You should take it easy', 'You should take it easy.')).toBe(false);
  });

  it('does not match when the wording differs', () => {
    expect(isCorrectAnswer('You should take it slow.', 'You should take it easy.')).toBe(false);
  });
});

describe('pickRandomOtherWord', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('excludes the given date from candidates', () => {
    const archive: ArchiveIndexItem[] = [
      { date: '2026-07-27', word: 'take it easy', meaningKo: '편하게 하다' },
      { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' },
    ];
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = pickRandomOtherWord(archive, '2026-07-27');

    expect(result).toEqual({ date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' });
  });

  it('returns null when no other candidates exist', () => {
    const single: ArchiveIndexItem[] = [
      { date: '2026-07-27', word: 'take it easy', meaningKo: '편하게 하다' },
    ];

    expect(pickRandomOtherWord(single, '2026-07-27')).toBeNull();
  });

  it('picks among multiple remaining candidates based on Math.random', () => {
    const three: ArchiveIndexItem[] = [
      { date: '2026-07-27', word: 'take it easy', meaningKo: 'a' },
      { date: '2026-07-23', word: 'awesome', meaningKo: 'b' },
      { date: '2026-07-20', word: 'figure out', meaningKo: 'c' },
    ];
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const result = pickRandomOtherWord(three, '2026-07-27');

    expect(result).toEqual({ date: '2026-07-20', word: 'figure out', meaningKo: 'c' });
  });
});
