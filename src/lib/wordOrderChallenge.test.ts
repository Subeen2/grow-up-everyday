import { tokenize, shuffleTokens, isCorrectOrder } from './wordOrderChallenge';

describe('tokenize', () => {
  it('splits on spaces', () => {
    expect(tokenize('You should take it easy.')).toEqual(['You', 'should', 'take', 'it', 'easy.']);
  });

  it('filters out empty tokens from repeated spaces', () => {
    expect(tokenize('a  b')).toEqual(['a', 'b']);
  });
});

describe('shuffleTokens', () => {
  it('returns the same tokens as a set, possibly reordered', () => {
    const tokens = ['You', 'should', 'take', 'it', 'easy.'];

    const shuffled = shuffleTokens(tokens);

    expect([...shuffled].sort()).toEqual([...tokens].sort());
    expect(shuffled).not.toBe(tokens);
  });
});

describe('isCorrectOrder', () => {
  it('is true when submitted matches target exactly', () => {
    expect(isCorrectOrder(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
  });

  it('is false when the order differs', () => {
    expect(isCorrectOrder(['b', 'a', 'c'], ['a', 'b', 'c'])).toBe(false);
  });

  it('is false when the lengths differ', () => {
    expect(isCorrectOrder(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
  });
});
