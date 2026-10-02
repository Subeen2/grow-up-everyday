import {
  loadProfile,
  saveProfile,
  isJaProfile,
  isEnProfile,
  describeProfile,
  JaProfile,
  EnProfile,
} from './learnerProfile';

const jaProfile: JaProfile = { knowsHiragana: true, knowsKatakana: false, knowsKanji: false, memo: '' };
const enProfile: EnProfile = { level: 'everyday', readsIpa: false, memo: '문법 용어는 잘 몰라요' };

describe('learnerProfile', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(loadProfile('ja')).toBeNull();
    expect(loadProfile('en')).toBeNull();
  });

  it('saves and loads each language independently', () => {
    saveProfile('ja', jaProfile);
    saveProfile('en', enProfile);

    expect(loadProfile('ja')).toEqual(jaProfile);
    expect(loadProfile('en')).toEqual(enProfile);
    expect(localStorage.getItem('learnerProfile:ja')).not.toBeNull();
  });

  it('returns null for broken JSON', () => {
    localStorage.setItem('learnerProfile:ja', '{not json');
    expect(loadProfile('ja')).toBeNull();
  });

  it('returns null for a stored profile with an outdated shape', () => {
    localStorage.setItem('learnerProfile:ja', JSON.stringify({ knowsHiragana: true }));
    localStorage.setItem('learnerProfile:en', JSON.stringify({ level: 'expert', readsIpa: true, memo: '' }));

    expect(loadProfile('ja')).toBeNull();
    expect(loadProfile('en')).toBeNull();
  });

  it('returns null instead of throwing when localStorage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadProfile('ja')).toBeNull();
    spy.mockRestore();
  });

  it('validates profile shapes including the memo length limit', () => {
    expect(isJaProfile(jaProfile)).toBe(true);
    expect(isJaProfile({ ...jaProfile, memo: 'a'.repeat(101) })).toBe(false);
    expect(isJaProfile(null)).toBe(false);
    expect(isEnProfile(enProfile)).toBe(true);
    expect(isEnProfile({ ...enProfile, level: 'expert' })).toBe(false);
    expect(isEnProfile(jaProfile)).toBe(false);
  });

  it('describes a profile for the chat header', () => {
    expect(describeProfile(jaProfile)).toBe('히라가나');
    expect(describeProfile({ ...jaProfile, knowsKatakana: true })).toBe('히라가나 · 가타카나');
    expect(describeProfile({ ...jaProfile, knowsHiragana: false })).toBe('처음 배워요');
    expect(describeProfile(enProfile)).toBe('일상 표현은 조금 알아요');
  });
});
