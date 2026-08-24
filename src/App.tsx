import { useEffect, useState } from 'react';
import { TodayPage } from './pages/TodayPage';
import { ArchivePage } from './pages/ArchivePage';
import { GamePage } from './pages/GamePage';
import { JaTodayPage } from './pages/JaTodayPage';
import { JaArchivePage } from './pages/JaArchivePage';
import { PixelButton } from './components/PixelButton';
import { PullToRefresh } from './components/PullToRefresh';
import { requestNotificationPermissionAndSync } from './lib/reminder';
import { fetchArchiveIndex as fetchArchiveIndexEn } from './lib/wordData';
import { fetchArchiveIndex as fetchArchiveIndexJa } from './lib/jaWordData';

type Tab = 'today' | 'archive' | 'game';
type Language = 'en' | 'ja';

export function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [language, setLanguage] = useState<Language>('en');
  const [archiveCount, setArchiveCount] = useState<number | null>(null);

  useEffect(() => {
    setArchiveCount(null);
    const fetchIndex = language === 'en' ? fetchArchiveIndexEn : fetchArchiveIndexJa;
    fetchIndex()
      .then((items) => setArchiveCount(items.length))
      .catch(() => setArchiveCount(null));
  }, [language]);

  function handleLanguageChange(next: Language) {
    setLanguage(next);
    if (next === 'ja' && tab === 'game') {
      setTab('today');
    }
  }

  return (
    <PullToRefresh>
      <div className="app">
        <h1>명예 외국인</h1>
        <nav className="tab-bar">
          <PixelButton onClick={() => handleLanguageChange('en')} aria-pressed={language === 'en'}>
            영어
          </PixelButton>
          <PixelButton onClick={() => handleLanguageChange('ja')} aria-pressed={language === 'ja'}>
            일본어
          </PixelButton>
        </nav>
        <nav className="tab-bar">
          <PixelButton onClick={() => setTab('today')} aria-pressed={tab === 'today'}>
            오늘의 단어
          </PixelButton>
          <PixelButton onClick={() => setTab('archive')} aria-pressed={tab === 'archive'}>
            아카이브{archiveCount !== null ? ` (${archiveCount})` : ''}
          </PixelButton>
          {language === 'en' && (
            <PixelButton onClick={() => setTab('game')} aria-pressed={tab === 'game'}>
              🎮 빈칸 게임
            </PixelButton>
          )}
          <PixelButton onClick={() => requestNotificationPermissionAndSync()}>
            🔔 알림 켜기
          </PixelButton>
        </nav>
        {language === 'en' ? (
          tab === 'today' ? (
            <TodayPage />
          ) : tab === 'archive' ? (
            <ArchivePage />
          ) : (
            <GamePage />
          )
        ) : tab === 'today' ? (
          <JaTodayPage />
        ) : (
          <JaArchivePage />
        )}
      </div>
    </PullToRefresh>
  );
}
