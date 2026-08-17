import { fetchArchiveIndex, fetchWordByDate } from '../lib/jaWordData';
import { useWordBlankGameState } from '../lib/useWordBlankGameState';
import { JaWordEntry } from '../lib/wordTypes';
import { WordBlankGame } from '../components/WordBlankGame';
import { Celebration } from '../components/Celebration';
import { useCelebrateOnCorrect } from '../lib/useCelebrateOnCorrect';

const config = {
  getWord: (entry: JaWordEntry) => entry.word,
  getSentencePool: (entry: JaWordEntry) => [entry.exampleJa, ...(entry.gameExamples ?? [])],
};

export function JaGamePage() {
  const { state, handleCorrect, handleSkip } = useWordBlankGameState({ fetchArchiveIndex, fetchWordByDate }, config);
  const { celebrating, setCelebrating, celebrateAndAdvance } = useCelebrateOnCorrect(handleCorrect);

  return (
    <>
      {state.status === 'loading' && <p>불러오는 중...</p>}
      {state.status === 'error' && <p>오류: {state.message}</p>}
      {state.status === 'empty' && (
        <div className="word-blank-game__end">
          <p>게임할 단어가 부족해요. 단어가 더 쌓이면 다시 도전해보세요!</p>
          {state.score > 0 && <p className="word-blank-game__final-score">최종 점수: {state.score}</p>}
        </div>
      )}
      {state.status === 'question' && (
        <div>
          <div className="word-blank-game__scoreboard">
            <span>점수 {state.score}</span>
            <span>연속 정답 {state.streak}🔥</span>
          </div>
          <WordBlankGame
            key={state.entry.date}
            challenge={state.challenge}
            meaningHint={state.entry.meaningKo}
            onCorrect={celebrateAndAdvance}
            onSkip={handleSkip}
          />
        </div>
      )}
      {celebrating && <Celebration onDone={() => setCelebrating(false)} />}
    </>
  );
}
