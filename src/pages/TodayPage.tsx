import { useEffect, useState } from 'react';
import { fetchTodayWord, fetchArchiveIndex, fetchWordByDate } from '../lib/wordData';
import { ArchiveIndexItem, WordEntry } from '../lib/wordTypes';
import { isNewDaySinceLastView, setLastViewedDate } from '../lib/reminder';
import { pickRandomOtherWord } from '../lib/typingChallenge';
import { WordCard } from '../components/WordCard';
import { PixelButton } from '../components/PixelButton';
import { TypingChallenge } from '../components/TypingChallenge';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      todayEntry: WordEntry;
      displayedEntry: WordEntry;
      archivePool: ArchiveIndexItem[];
      isNew: boolean;
      challengeVisible: boolean;
    };

export function TodayPage() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    fetchTodayWord()
      .then(async (entry) => {
        const isNew = isNewDaySinceLastView(entry.date);
        setLastViewedDate(entry.date);

        let archivePool: ArchiveIndexItem[] = [];
        try {
          archivePool = await fetchArchiveIndex();
        } catch (err) {
          console.warn('Failed to fetch archive index for the typing challenge pool:', err);
        }

        setState({
          status: 'ready',
          todayEntry: entry,
          displayedEntry: entry,
          archivePool,
          isNew,
          challengeVisible: false,
        });
      })
      .catch((err: Error) => setState({ status: 'error', message: err.message }));
  }, []);

  if (state.status === 'loading') return <p>불러오는 중...</p>;
  if (state.status === 'error') return <p>오류: {state.message}</p>;

  const { todayEntry, displayedEntry, archivePool, isNew, challengeVisible } = state;
  const hasOtherWord = archivePool.some((item) => item.date !== displayedEntry.date);
  const isShowingToday = displayedEntry.date === todayEntry.date;

  async function handleChallengeSuccess() {
    const next = pickRandomOtherWord(archivePool, displayedEntry.date);
    if (!next) return;
    const entry = await fetchWordByDate(next.date);
    if (!entry) {
      console.warn(`Archive index references missing file for ${next.date}`);
      return;
    }
    setState({
      status: 'ready',
      todayEntry,
      displayedEntry: entry,
      archivePool,
      isNew,
      challengeVisible: false,
    });
  }

  function handleBackToToday() {
    setState({
      status: 'ready',
      todayEntry,
      displayedEntry: todayEntry,
      archivePool,
      isNew,
      challengeVisible: false,
    });
  }

  return (
    <div>
      {isNew && <span className="new-badge">NEW</span>}
      <WordCard entry={displayedEntry} />
      {!isShowingToday && <PixelButton onClick={handleBackToToday}>오늘의 단어로</PixelButton>}
      {!challengeVisible && (
        <>
          <PixelButton
            onClick={() =>
              setState({
                status: 'ready',
                todayEntry,
                displayedEntry,
                archivePool,
                isNew,
                challengeVisible: true,
              })
            }
            disabled={!hasOtherWord}
          >
            다른 단어 보기
          </PixelButton>
          {!hasOtherWord && <p className="typing-challenge__empty">아직 연습할 다른 단어가 없어요</p>}
        </>
      )}
      {challengeVisible && (
        <TypingChallenge targetSentence={displayedEntry.exampleEn} onSuccess={handleChallengeSuccess} />
      )}
    </div>
  );
}
