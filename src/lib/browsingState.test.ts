import { getPersistedDisplayedWordDate, setPersistedDisplayedWordDate } from './browsingState';

describe('browsingState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing stored', () => {
    expect(getPersistedDisplayedWordDate('2026-07-23')).toBeNull();
  });

  it('returns the stored date when it was recorded on the same "today"', () => {
    setPersistedDisplayedWordDate('2026-07-20', '2026-07-23');
    expect(getPersistedDisplayedWordDate('2026-07-23')).toBe('2026-07-20');
  });

  it('overwrites the previously stored date', () => {
    setPersistedDisplayedWordDate('2026-07-20', '2026-07-23');
    setPersistedDisplayedWordDate('2026-07-22', '2026-07-23');
    expect(getPersistedDisplayedWordDate('2026-07-23')).toBe('2026-07-22');
  });

  it('returns null once a new day has started, even if a date is still stored', () => {
    setPersistedDisplayedWordDate('2026-07-20', '2026-07-23');
    expect(getPersistedDisplayedWordDate('2026-07-24')).toBeNull();
  });
});
