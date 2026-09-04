import { useState } from 'react';
import { fetchTodayWord, fetchArchiveIndex, fetchWordByDate } from '../lib/wordData';
import { useWordOfDayState } from '../lib/useWordOfDayState';
import { pickRandomChallengeType, ChallengeType } from '../lib/challengeSelection';
import { WordCard } from '../components/WordCard';
import { PixelButton } from '../components/PixelButton';
import { TypingChallenge } from '../components/TypingChallenge';
import { OxChallenge } from '../components/OxChallenge';
import { WordOrderChallenge } from '../components/WordOrderChallenge';
import { Celebration } from '../components/Celebration';

export function TodayPage() {
  const { state, celebrating, setCelebrating, showChallenge, handleChallengeSuccess, handleBackToToday } =
    useWordOfDayState({ fetchTodayWord, fetchArchiveIndex, fetchWordByDate }, 'en');
  const [challengeType, setChallengeType] = useState<ChallengeType>('typing');

  if (state.status === 'loading') return <p>불러오는 중...</p>;
  if (state.status === 'error') return <p>오류: {state.message}</p>;

  const { todayEntry, displayedEntry, archivePool, isNew, challengeVisible } = state;
  const hasOtherWord = archivePool.some((item) => item.date !== displayedEntry.date);
  const isShowingToday = displayedEntry.date === todayEntry.date;

  function handleShowChallenge() {
    setChallengeType(pickRandomChallengeType());
    showChallenge();
  }

  return (
    <div>
      {isNew && isShowingToday && <span className="new-badge">NEW</span>}
      <WordCard entry={displayedEntry} hideExampleEn={challengeVisible} />
      {!isShowingToday && <PixelButton onClick={handleBackToToday}>오늘의 단어로</PixelButton>}
      {!challengeVisible && (
        <>
          <PixelButton onClick={handleShowChallenge} disabled={!hasOtherWord}>
            다른 단어 보기
          </PixelButton>
          {!hasOtherWord && <p className="typing-challenge__empty">아직 연습할 다른 단어가 없어요</p>}
        </>
      )}
      {challengeVisible && challengeType === 'typing' && (
        <TypingChallenge targetSentence={displayedEntry.exampleEn} onSuccess={handleChallengeSuccess} />
      )}
      {challengeVisible && challengeType === 'ox' && (
        <OxChallenge targetEntry={displayedEntry} archivePool={archivePool} onSuccess={handleChallengeSuccess} />
      )}
      {challengeVisible && challengeType === 'order' && (
        <WordOrderChallenge targetSentence={displayedEntry.exampleEn} onSuccess={handleChallengeSuccess} />
      )}
      {celebrating && <Celebration onDone={() => setCelebrating(false)} />}
    </div>
  );
}
