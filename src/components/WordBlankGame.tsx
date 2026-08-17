import { useState } from 'react';
import { BlankChallenge, isBlankAnswerCorrect } from '../lib/wordBlankGame';
import { PixelButton } from './PixelButton';

interface WordBlankGameProps {
  challenge: BlankChallenge;
  meaningHint: string;
  onCorrect: () => void;
  onSkip: () => void;
}

type AnswerStatus = { kind: 'idle' } | { kind: 'correct' } | { kind: 'incorrect' };

export function WordBlankGame({ challenge, meaningHint, onCorrect, onSkip }: WordBlankGameProps) {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AnswerStatus>({ kind: 'idle' });

  function handleSubmit() {
    if (isBlankAnswerCorrect(input, challenge.answer)) {
      setStatus({ kind: 'correct' });
      return;
    }
    setStatus({ kind: 'incorrect' });
  }

  return (
    <div className="word-blank-game">
      <p className="word-blank-game__meaning">힌트: {meaningHint}</p>
      <p className="word-blank-game__sentence">
        {challenge.before}
        <span className="word-blank-game__blank">{'_'.repeat(Math.max(challenge.answer.length, 3))}</span>
        {challenge.after}
      </p>
      {status.kind === 'correct' ? (
        <>
          <p className="word-blank-game__feedback--correct">정답이에요! 🎉 ({challenge.answer})</p>
          <PixelButton onClick={onCorrect}>다음 문제 →</PixelButton>
        </>
      ) : (
        <>
          <div className="word-blank-game__input-row">
            <input
              type="text"
              className="word-blank-game__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="빈칸에 들어갈 단어를 입력하세요"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <PixelButton onClick={handleSubmit}>확인</PixelButton>
          </div>
          {status.kind === 'incorrect' && (
            <p className="word-blank-game__feedback--incorrect">다시 시도해보세요!</p>
          )}
          <div className="word-blank-game__actions">
            <PixelButton onClick={onSkip}>모르겠어요, 다음 문제</PixelButton>
          </div>
        </>
      )}
    </div>
  );
}
