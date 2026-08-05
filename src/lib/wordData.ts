import { ArchiveIndexItem, WordEntry } from './wordTypes';

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createWordApi<TEntry extends { date: string }, TIndexItem extends { date: string }>(
  basePath: string
) {
  async function fetchWordByDate(date: string): Promise<TEntry | null> {
    const res = await fetch(`${import.meta.env.BASE_URL}${basePath}/words/${date}.json`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to fetch word for ${date}: ${res.status}`);
    return (await res.json()) as TEntry;
  }

  async function fetchArchiveIndex(): Promise<TIndexItem[]> {
    const res = await fetch(`${import.meta.env.BASE_URL}${basePath}/archive-index.json`);
    if (!res.ok) throw new Error(`Failed to fetch archive index: ${res.status}`);
    const items = (await res.json()) as TIndexItem[];
    return [...items].sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  async function fetchTodayWord(): Promise<TEntry> {
    const today = getLocalDateString();
    const todayEntry = await fetchWordByDate(today);
    if (todayEntry) return todayEntry;

    const archive = await fetchArchiveIndex();
    if (archive.length === 0) {
      throw new Error('No word data available yet');
    }

    const latest = await fetchWordByDate(archive[0].date);
    if (!latest) {
      throw new Error(`Archive index references missing file for ${archive[0].date}`);
    }
    return latest;
  }

  return { fetchWordByDate, fetchArchiveIndex, fetchTodayWord };
}

const enApi = createWordApi<WordEntry, ArchiveIndexItem>('data');

export const fetchWordByDate = enApi.fetchWordByDate;
export const fetchArchiveIndex = enApi.fetchArchiveIndex;
export const fetchTodayWord = enApi.fetchTodayWord;
