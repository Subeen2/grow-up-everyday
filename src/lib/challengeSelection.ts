export type ChallengeType = 'typing' | 'ox' | 'order';

const CHALLENGE_TYPES: ChallengeType[] = ['typing', 'ox', 'order'];

export function pickRandomChallengeType(): ChallengeType {
  return CHALLENGE_TYPES[Math.floor(Math.random() * CHALLENGE_TYPES.length)];
}
