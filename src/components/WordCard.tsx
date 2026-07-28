import { WordEntry } from '../lib/wordTypes';

interface WordCardProps {
  entry: WordEntry;
  hideExampleEn?: boolean;
}

export function WordCard({ entry, hideExampleEn }: WordCardProps) {
  return (
    <div className="word-card">
      <p className="word-card__date">{entry.date}</p>
      <h2 className="word-card__word">{entry.word}</h2>
      <p className="word-card__pos">{entry.partOfSpeech}</p>
      <p className="word-card__pronunciation">[{entry.pronunciationKo}]</p>
      <p className="word-card__meaning">{entry.meaningKo}</p>
      {!hideExampleEn && <p className="word-card__example-en">{entry.exampleEn}</p>}
      <p className="word-card__example-ko">{entry.exampleKo}</p>
    </div>
  );
}
