import { fetchTodayWord, fetchArchiveIndex, fetchWordByDate } from '../lib/jaWordData';
import { useWordOfDayState } from '../lib/useWordOfDayState';
import { JaWordCard } from '../components/JaWordCard';
import { PixelButton } from '../components/PixelButton';
import { VoiceChallenge } from '../components/VoiceChallenge';
import { Celebration } from '../components/Celebration';

export function JaTodayPage() {
  const { state, celebrating, setCelebrating, showChallenge, handleChallengeSuccess, handleBackToToday } =
    useWordOfDayState({ fetchTodayWord, fetchArchiveIndex, fetchWordByDate }, 'ja');

  if (state.status === 'loading') return <p>불러오는 중...</p>;
  if (state.status === 'error') return <p>오류: {state.message}</p>;

  const { todayEntry, displayedEntry, archivePool, isNew, challengeVisible } = state;
  const hasOtherWord = archivePool.some((item) => item.date !== displayedEntry.date);
  const isShowingToday = displayedEntry.date === todayEntry.date;

  return (
    <div>
      {isNew && isShowingToday && <span className="new-badge">NEW</span>}
      <JaWordCard entry={displayedEntry} hideExampleJa={challengeVisible} />
      {!isShowingToday && <PixelButton onClick={handleBackToToday}>오늘의 단어로</PixelButton>}
      {!challengeVisible && (
        <>
          <PixelButton onClick={showChallenge} disabled={!hasOtherWord}>
            다른 단어 보기
          </PixelButton>
          {!hasOtherWord && <p className="typing-challenge__empty">아직 연습할 다른 단어가 없어요</p>}
        </>
      )}
      {challengeVisible && <VoiceChallenge targetEntry={displayedEntry} onSuccess={handleChallengeSuccess} />}
      {celebrating && <Celebration onDone={() => setCelebrating(false)} />}
    </div>
  );
}
