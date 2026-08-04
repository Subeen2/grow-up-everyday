import { JaWordEntry } from '../lib/wordTypes';

interface JaWordCardProps {
  entry: JaWordEntry;
  hideExampleJa?: boolean;
}

export function JaWordCard({ entry, hideExampleJa }: JaWordCardProps) {
  return (
    <div className="word-card">
      <p className="word-card__date">{entry.date}</p>
      <h2 className="word-card__word">{entry.word}</h2>
      <p className="word-card__pronunciation">[{entry.reading}]</p>
      <p className="word-card__meaning">{entry.meaningKo}</p>
      {!hideExampleJa && <p className="word-card__example-en">{entry.exampleJa}</p>}
      <p className="word-card__example-ko">{entry.exampleKo}</p>
    </div>
  );
}
