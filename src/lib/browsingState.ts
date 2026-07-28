const DISPLAYED_WORD_DATE_KEY = 'displayedWordDate';

export function getPersistedDisplayedWordDate(): string | null {
  return localStorage.getItem(DISPLAYED_WORD_DATE_KEY);
}

export function setPersistedDisplayedWordDate(date: string): void {
  localStorage.setItem(DISPLAYED_WORD_DATE_KEY, date);
}
