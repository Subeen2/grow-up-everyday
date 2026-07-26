import { getLastViewedDate, setLastViewedDate, isNewDaySinceLastView } from './reminder';

describe('reminder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing stored', () => {
    expect(getLastViewedDate()).toBeNull();
  });

  it('stores and retrieves the last viewed date', () => {
    setLastViewedDate('2026-07-23');
    expect(getLastViewedDate()).toBe('2026-07-23');
  });

  it('is a new day when nothing was stored before', () => {
    expect(isNewDaySinceLastView('2026-07-23')).toBe(true);
  });

  it('is not a new day when the same date was already viewed', () => {
    setLastViewedDate('2026-07-23');
    expect(isNewDaySinceLastView('2026-07-23')).toBe(false);
  });

  it('is a new day when a different date was last viewed', () => {
    setLastViewedDate('2026-07-22');
    expect(isNewDaySinceLastView('2026-07-23')).toBe(true);
  });
});
