const DISPLAYED_WORD_DATE_KEY = 'displayedWordDate';
const DISPLAYED_WORD_AS_OF_TODAY_KEY = 'displayedWordAsOfToday';

export function getPersistedDisplayedWordDate(today: string): string | null {
  const asOfToday = localStorage.getItem(DISPLAYED_WORD_AS_OF_TODAY_KEY);
  if (asOfToday !== today) return null;
  return localStorage.getItem(DISPLAYED_WORD_DATE_KEY);
}

export function setPersistedDisplayedWordDate(date: string, today: string): void {
  localStorage.setItem(DISPLAYED_WORD_DATE_KEY, date);
  localStorage.setItem(DISPLAYED_WORD_AS_OF_TODAY_KEY, today);
}
