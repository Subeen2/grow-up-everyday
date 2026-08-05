const DISPLAYED_WORD_DATE_KEY = 'displayedWordDate';
const DISPLAYED_WORD_AS_OF_TODAY_KEY = 'displayedWordAsOfToday';

export function getPersistedDisplayedWordDate(today: string, namespace: string): string | null {
  const asOfToday = localStorage.getItem(`${DISPLAYED_WORD_AS_OF_TODAY_KEY}:${namespace}`);
  if (asOfToday !== today) return null;
  return localStorage.getItem(`${DISPLAYED_WORD_DATE_KEY}:${namespace}`);
}

export function setPersistedDisplayedWordDate(date: string, today: string, namespace: string): void {
  localStorage.setItem(`${DISPLAYED_WORD_DATE_KEY}:${namespace}`, date);
  localStorage.setItem(`${DISPLAYED_WORD_AS_OF_TODAY_KEY}:${namespace}`, today);
}
