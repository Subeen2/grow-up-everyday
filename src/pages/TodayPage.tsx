import { useEffect, useState } from 'react';
import { fetchTodayWord } from '../lib/wordData';
import { WordEntry } from '../lib/wordTypes';
import { isNewDaySinceLastView, setLastViewedDate } from '../lib/reminder';
import { WordCard } from '../components/WordCard';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entry: WordEntry; isNew: boolean };

export function TodayPage() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    fetchTodayWord()
      .then((entry) => {
        const isNew = isNewDaySinceLastView(entry.date);
        setLastViewedDate(entry.date);
        setState({ status: 'ready', entry, isNew });
      })
      .catch((err: Error) => setState({ status: 'error', message: err.message }));
  }, []);

  if (state.status === 'loading') return <p>불러오는 중...</p>;
  if (state.status === 'error') return <p>오류: {state.message}</p>;

  return (
    <div>
      {state.isNew && <span className="new-badge">NEW</span>}
      <WordCard entry={state.entry} />
    </div>
  );
}
