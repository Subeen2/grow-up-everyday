import { useState } from 'react';
import { isCorrectAnswer } from '../lib/typingChallenge';
import { PixelButton } from './PixelButton';

interface TypingChallengeProps {
  targetSentence: string;
  onSuccess: () => void;
}

type ChallengeStatus = { kind: 'idle' } | { kind: 'incorrect'; submitted: string };

export function TypingChallenge({ targetSentence, onSuccess }: TypingChallengeProps) {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ChallengeStatus>({ kind: 'idle' });

  function handleSubmit() {
    if (isCorrectAnswer(input, targetSentence)) {
      onSuccess();
      return;
    }
    setStatus({ kind: 'incorrect', submitted: input });
  }

  return (
    <div className="typing-challenge">
      <input
        type="text"
        className="typing-challenge__input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="예문을 그대로 입력해보세요"
      />
      <PixelButton onClick={handleSubmit}>제출</PixelButton>
      {status.kind === 'incorrect' && (
        <div className="typing-challenge__comparison">
          <p className="typing-challenge__submitted">내 입력: {status.submitted}</p>
          <p className="typing-challenge__target">정답: {targetSentence}</p>
        </div>
      )}
    </div>
  );
}
