import { useState } from 'react';
import { tokenize, shuffleTokens, isCorrectOrder } from '../lib/wordOrderChallenge';
import { PixelButton } from './PixelButton';

interface WordOrderChallengeProps {
  targetSentence: string;
  onSuccess: () => void;
}

export function WordOrderChallenge({ targetSentence, onSuccess }: WordOrderChallengeProps) {
  const targetTokens = tokenize(targetSentence);
  const [remaining, setRemaining] = useState<string[]>(() => shuffleTokens(targetTokens));
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [incorrect, setIncorrect] = useState(false);

  function handlePick(index: number) {
    const token = remaining[index];
    const nextSubmitted = [...submitted, token];
    const nextRemaining = remaining.filter((_, i) => i !== index);

    if (nextRemaining.length === 0) {
      if (isCorrectOrder(nextSubmitted, targetTokens)) {
        onSuccess();
        return;
      }
      setIncorrect(true);
      setSubmitted([]);
      setRemaining(shuffleTokens(targetTokens));
      return;
    }

    setSubmitted(nextSubmitted);
    setRemaining(nextRemaining);
  }

  return (
    <div className="word-order-challenge">
      <p className="word-order-challenge__assembled">{submitted.join(' ')}</p>
      <div className="word-order-challenge__tokens">
        {remaining.map((token, index) => (
          <PixelButton key={`${token}-${index}`} onClick={() => handlePick(index)}>
            {token}
          </PixelButton>
        ))}
      </div>
      {incorrect && <p className="word-order-challenge__wrong">순서가 달라요! 다시 시도해보세요</p>}
    </div>
  );
}
