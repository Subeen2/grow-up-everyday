import { useEffect, useState } from 'react';
import { isNewDaySinceLastView, setLastViewedDate } from './reminder';
import { getPersistedDisplayedWordDate, setPersistedDisplayedWordDate } from './browsingState';
import { pickRandomOtherWord } from './typingChallenge';

export interface WordOfDayApi<TEntry extends { date: string }, TIndexItem extends { date: string }> {
  fetchTodayWord(): Promise<TEntry>;
  fetchArchiveIndex(): Promise<TIndexItem[]>;
  fetchWordByDate(date: string): Promise<TEntry | null>;
}

export type WordOfDayState<TEntry, TIndexItem> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      todayEntry: TEntry;
      displayedEntry: TEntry;
      archivePool: TIndexItem[];
      isNew: boolean;
      challengeVisible: boolean;
    };

export function useWordOfDayState<TEntry extends { date: string }, TIndexItem extends { date: string }>(
  api: WordOfDayApi<TEntry, TIndexItem>,
  namespace: string
) {
  const [state, setState] = useState<WordOfDayState<TEntry, TIndexItem>>({ status: 'loading' });
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    api
      .fetchTodayWord()
      .then(async (entry) => {
        const isNew = isNewDaySinceLastView(entry.date, namespace);
        setLastViewedDate(entry.date, namespace);

        let archivePool: TIndexItem[] = [];
        try {
          archivePool = await api.fetchArchiveIndex();
        } catch (err) {
          console.warn('Failed to fetch archive index for the challenge pool:', err);
        }

        let displayedEntry = entry;
        const persistedDate = getPersistedDisplayedWordDate(entry.date, namespace);
        if (persistedDate && persistedDate !== entry.date) {
          try {
            const persistedEntry = await api.fetchWordByDate(persistedDate);
            if (persistedEntry) {
              displayedEntry = persistedEntry;
            }
          } catch (err) {
            console.warn(`Failed to resume previously displayed word for ${persistedDate}:`, err);
          }
        }

        setState({
          status: 'ready',
          todayEntry: entry,
          displayedEntry,
          archivePool,
          isNew,
          challengeVisible: false,
        });
      })
      .catch((err: Error) => setState({ status: 'error', message: err.message }));
    // Intentionally runs once on mount only, matching the original TodayPage effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showChallenge() {
    if (state.status !== 'ready') return;
    setState({ ...state, challengeVisible: true });
  }

  async function handleChallengeSuccess() {
    if (state.status !== 'ready') return;
    const next = pickRandomOtherWord(state.archivePool, state.displayedEntry.date);
    if (!next) return;

    let entry: TEntry | null;
    try {
      entry = await api.fetchWordByDate(next.date);
    } catch (err) {
      console.warn(`Failed to fetch word for ${next.date}:`, err);
      return;
    }
    if (!entry) {
      console.warn(`Archive index references missing file for ${next.date}`);
      return;
    }
    setState({ ...state, displayedEntry: entry, challengeVisible: false });
    setPersistedDisplayedWordDate(entry.date, state.todayEntry.date, namespace);
    setCelebrating(true);
  }

  function handleBackToToday() {
    if (state.status !== 'ready') return;
    setState({ ...state, displayedEntry: state.todayEntry, challengeVisible: false });
    setPersistedDisplayedWordDate(state.todayEntry.date, state.todayEntry.date, namespace);
  }

  return { state, celebrating, setCelebrating, showChallenge, handleChallengeSuccess, handleBackToToday };
}
