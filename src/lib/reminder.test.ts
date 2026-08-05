import { getLastViewedDate, setLastViewedDate, isNewDaySinceLastView } from './reminder';

describe('reminder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing stored', () => {
    expect(getLastViewedDate('en')).toBeNull();
  });

  it('stores and retrieves the last viewed date', () => {
    setLastViewedDate('2026-07-23', 'en');
    expect(getLastViewedDate('en')).toBe('2026-07-23');
  });

  it('is a new day when nothing was stored before', () => {
    expect(isNewDaySinceLastView('2026-07-23', 'en')).toBe(true);
  });

  it('is not a new day when the same date was already viewed', () => {
    setLastViewedDate('2026-07-23', 'en');
    expect(isNewDaySinceLastView('2026-07-23', 'en')).toBe(false);
  });

  it('is a new day when a different date was last viewed', () => {
    setLastViewedDate('2026-07-22', 'en');
    expect(isNewDaySinceLastView('2026-07-23', 'en')).toBe(true);
  });

  it('keeps English and Japanese namespaces independent', () => {
    setLastViewedDate('2026-07-23', 'en');
    expect(isNewDaySinceLastView('2026-07-23', 'ja')).toBe(true);
  });
});
