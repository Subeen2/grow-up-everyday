import { useEffect, useState } from 'react';
import { fetchArchiveIndex, fetchWordByDate } from '../lib/jaWordData';
import { JaArchiveIndexItem, JaWordEntry } from '../lib/wordTypes';
import { ArchiveListItem } from '../components/ArchiveListItem';
import { JaWordCard } from '../components/JaWordCard';
import { PixelButton } from '../components/PixelButton';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'list'; items: JaArchiveIndexItem[] };

export function JaArchivePage() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [selected, setSelected] = useState<JaWordEntry | null>(null);

  useEffect(() => {
    fetchArchiveIndex()
      .then((items) => setState({ status: 'list', items }))
      .catch((err: Error) => setState({ status: 'error', message: err.message }));
  }, []);

  async function handleSelect(date: string) {
    const entry = await fetchWordByDate(date);
    if (entry) setSelected(entry);
  }

  if (selected) {
    return (
      <div>
        <PixelButton onClick={() => setSelected(null)}>← 목록으로</PixelButton>
        <JaWordCard entry={selected} />
      </div>
    );
  }

  if (state.status === 'loading') return <p>불러오는 중...</p>;
  if (state.status === 'error') return <p>오류: {state.message}</p>;

  return (
    <ul className="archive-list">
      {state.items.map((item) => (
        <ArchiveListItem key={item.date} item={item} onSelect={handleSelect} />
      ))}
    </ul>
  );
}
