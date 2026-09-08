import { useState } from 'react';
import { buildOxQuestion, OxQuestion } from '../lib/oxChallenge';
import { ArchiveIndexItem } from '../lib/wordTypes';
import { PixelButton } from './PixelButton';

interface OxChallengeProps {
  targetEntry: ArchiveIndexItem;
  archivePool: ArchiveIndexItem[];
  onSuccess: () => void;
}

export function OxChallenge({ targetEntry, archivePool, onSuccess }: OxChallengeProps) {
  const [question] = useState<OxQuestion>(() => buildOxQuestion(targetEntry, archivePool));
  const [incorrect, setIncorrect] = useState(false);

  function handleAnswer(answer: boolean) {
    if (answer === question.isTrue) {
      onSuccess();
      return;
    }
    setIncorrect(true);
  }

  return (
    <div className="ox-challenge">
      <p className="ox-challenge__prompt">
        {question.word} - {question.shownMeaning}
      </p>
      <div className="ox-challenge__buttons">
        <PixelButton onClick={() => handleAnswer(true)}>O</PixelButton>
        <PixelButton onClick={() => handleAnswer(false)}>X</PixelButton>
      </div>
      {incorrect && <p className="ox-challenge__wrong">땡! 다시 골라보세요</p>}
    </div>
  );
}
