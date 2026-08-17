import {
  buildBlankChallenge,
  buildBlankChallengeFromPool,
  isBlankAnswerCorrect,
  pickRandom,
  pickRandomEntry,
} from './wordBlankGame';

describe('buildBlankChallenge', () => {
  it('splits the sentence around the target word', () => {
    expect(buildBlankChallenge('This place is awesome!', 'awesome')).toEqual({
      before: 'This place is ',
      after: '!',
      answer: 'awesome',
    });
  });

  it('matches the target word case-insensitively but preserves original casing in the answer', () => {
    expect(buildBlankChallenge('Awesome work today.', 'awesome')).toEqual({
      before: '',
      after: ' work today.',
      answer: 'Awesome',
    });
  });

  it('returns null when the target word is not found in the sentence', () => {
    expect(buildBlankChallenge('This place is great!', 'awesome')).toBeNull();
  });
});

describe('isBlankAnswerCorrect', () => {
  it('matches ignoring case and surrounding whitespace', () => {
    expect(isBlankAnswerCorrect('  Awesome  ', 'awesome')).toBe(true);
  });

  it('does not match a different word', () => {
    expect(isBlankAnswerCorrect('great', 'awesome')).toBe(false);
  });
});

describe('pickRandomEntry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('picks among all candidates when no date is excluded', () => {
    const pool = [
      { date: '2026-07-23', word: 'awesome' },
      { date: '2026-07-20', word: 'figure out' },
    ];
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    expect(pickRandomEntry(pool)).toEqual({ date: '2026-07-20', word: 'figure out' });
  });

  it('excludes the given date from candidates', () => {
    const pool = [
      { date: '2026-07-27', word: 'take it easy' },
      { date: '2026-07-23', word: 'awesome' },
    ];
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(pickRandomEntry(pool, '2026-07-27')).toEqual({ date: '2026-07-23', word: 'awesome' });
  });

  it('returns null when no candidates remain', () => {
    const pool = [{ date: '2026-07-27', word: 'take it easy' }];

    expect(pickRandomEntry(pool, '2026-07-27')).toBeNull();
  });

  it('returns null for an empty pool', () => {
    expect(pickRandomEntry([])).toBeNull();
  });
});

describe('pickRandom', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('picks an item based on Math.random', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(pickRandom(['a', 'b', 'c', 'd'])).toBe('c');
  });

  it('returns null for an empty array', () => {
    expect(pickRandom([])).toBeNull();
  });
});

describe('buildBlankChallengeFromPool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a challenge from a randomly picked sentence that contains the word', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const result = buildBlankChallengeFromPool(
      ['This place is awesome!', 'Awesome work today.'],
      'awesome'
    );

    expect(result).toEqual({ before: '', after: ' work today.', answer: 'Awesome' });
  });

  it('skips sentences that do not contain the word', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = buildBlankChallengeFromPool(['No match here.', 'This place is awesome!'], 'awesome');

    expect(result).toEqual({ before: 'This place is ', after: '!', answer: 'awesome' });
  });

  it('returns null when no sentence in the pool contains the word', () => {
    expect(buildBlankChallengeFromPool(['No match here.'], 'awesome')).toBeNull();
  });

  it('returns null for an empty pool', () => {
    expect(buildBlankChallengeFromPool([], 'awesome')).toBeNull();
  });
});
