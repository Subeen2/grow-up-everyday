import { fetchTodayWord, fetchArchiveIndex, fetchWordByDate } from '../lib/wordData';
import { useWordOfDayState } from '../lib/useWordOfDayState';
import { WordCard } from '../components/WordCard';
import { PixelButton } from '../components/PixelButton';
import { TypingChallenge } from '../components/TypingChallenge';
import { Celebration } from '../components/Celebration';

export function TodayPage() {
  const { state, celebrating, setCelebrating, showChallenge, handleChallengeSuccess, handleBackToToday } =
    useWordOfDayState({ fetchTodayWord, fetchArchiveIndex, fetchWordByDate }, 'en');

  if (state.status === 'loading') return <p>불러오는 중...</p>;
  if (state.status === 'error') return <p>오류: {state.message}</p>;

  const { todayEntry, displayedEntry, archivePool, isNew, challengeVisible } = state;
  const hasOtherWord = archivePool.some((item) => item.date !== displayedEntry.date);
  const isShowingToday = displayedEntry.date === todayEntry.date;

  return (
    <div>
      {isNew && isShowingToday && <span className="new-badge">NEW</span>}
      <WordCard entry={displayedEntry} hideExampleEn={challengeVisible} />
      {!isShowingToday && <PixelButton onClick={handleBackToToday}>오늘의 단어로</PixelButton>}
      {!challengeVisible && (
        <>
          <PixelButton onClick={showChallenge} disabled={!hasOtherWord}>
            다른 단어 보기
          </PixelButton>
          {!hasOtherWord && <p className="typing-challenge__empty">아직 연습할 다른 단어가 없어요</p>}
        </>
      )}
      {challengeVisible && (
        <TypingChallenge targetSentence={displayedEntry.exampleEn} onSuccess={handleChallengeSuccess} />
      )}
      {celebrating && <Celebration onDone={() => setCelebrating(false)} />}
    </div>
  );
}
