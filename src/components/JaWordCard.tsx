import { JaWordEntry } from '../lib/wordTypes';
import { isSpeechSynthesisSupported, speakJapanese } from '../lib/speech';
import { PixelButton } from './PixelButton';

interface JaWordCardProps {
  entry: JaWordEntry;
  hideExampleJa?: boolean;
}

export function JaWordCard({ entry, hideExampleJa }: JaWordCardProps) {
  const speechSupported = isSpeechSynthesisSupported();

  return (
    <div className="word-card">
      <p className="word-card__date">{entry.date}</p>
      <h2 className="word-card__word">{entry.word}</h2>
      <p className="word-card__pronunciation">
        [{entry.reading}] {entry.readingKo}
      </p>
      <p className="word-card__meaning">{entry.meaningKo}</p>
      {!hideExampleJa && (
        <>
          <p className="word-card__example-en">{entry.exampleJa}</p>
          <p className="word-card__example-reading">{entry.exampleReadingKo}</p>
        </>
      )}
      <p className="word-card__example-ko">{entry.exampleKo}</p>
      {speechSupported && (
        <div className="word-card__speech-buttons">
          <PixelButton onClick={() => speakJapanese(entry.word)}>🔊 단어 발음</PixelButton>
          {!hideExampleJa && (
            <PixelButton onClick={() => speakJapanese(entry.exampleJa)}>🔊 예문 발음</PixelButton>
          )}
        </div>
      )}
    </div>
  );
}
