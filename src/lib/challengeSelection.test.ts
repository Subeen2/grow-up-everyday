import { pickRandomChallengeType } from './challengeSelection';

describe('pickRandomChallengeType', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "typing" when Math.random is at the low end', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickRandomChallengeType()).toBe('typing');
  });

  it('returns "ox" for the middle third', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.34);
    expect(pickRandomChallengeType()).toBe('ox');
  });

  it('returns "order" for the high third', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.67);
    expect(pickRandomChallengeType()).toBe('order');
  });
});
