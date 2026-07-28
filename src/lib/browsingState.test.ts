import { getPersistedDisplayedWordDate, setPersistedDisplayedWordDate } from './browsingState';

describe('browsingState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing stored', () => {
    expect(getPersistedDisplayedWordDate()).toBeNull();
  });

  it('stores and retrieves the displayed word date', () => {
    setPersistedDisplayedWordDate('2026-07-20');
    expect(getPersistedDisplayedWordDate()).toBe('2026-07-20');
  });

  it('overwrites the previously stored date', () => {
    setPersistedDisplayedWordDate('2026-07-20');
    setPersistedDisplayedWordDate('2026-07-23');
    expect(getPersistedDisplayedWordDate()).toBe('2026-07-23');
  });
});
