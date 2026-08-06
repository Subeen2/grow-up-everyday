import { WordEntry } from '../lib/wordTypes';
import { isSpeechSynthesisSupported, speakEnglish } from '../lib/speech';
import { PixelButton } from './PixelButton';

interface WordCardProps {
  entry: WordEntry;
  hideExampleEn?: boolean;
}

export function WordCard({ entry, hideExampleEn }: WordCardProps) {
  const speechSupported = isSpeechSynthesisSupported();

  return (
    <div className="word-card">
      <p className="word-card__date">{entry.date}</p>
      <h2 className="word-card__word">{entry.word}</h2>
      <p className="word-card__pronunciation">[{entry.pronunciationKo}]</p>
      <p className="word-card__meaning">{entry.meaningKo}</p>
      {!hideExampleEn && <p className="word-card__example-en">{entry.exampleEn}</p>}
      <p className="word-card__example-ko">{entry.exampleKo}</p>
      {speechSupported && (
        <div className="word-card__speech-buttons">
          <PixelButton onClick={() => speakEnglish(entry.word)}>🔊 단어 발음</PixelButton>
          {!hideExampleEn && (
            <PixelButton onClick={() => speakEnglish(entry.exampleEn)}>🔊 예문 발음</PixelButton>
          )}
        </div>
      )}
    </div>
  );
}
