import { useState } from 'react';
import { TodayPage } from './pages/TodayPage';
import { ArchivePage } from './pages/ArchivePage';
import { JaTodayPage } from './pages/JaTodayPage';
import { JaArchivePage } from './pages/JaArchivePage';
import { PixelButton } from './components/PixelButton';
import { PullToRefresh } from './components/PullToRefresh';
import { requestNotificationPermissionAndSync } from './lib/reminder';

type Tab = 'today' | 'archive';
type Language = 'en' | 'ja';

export function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [language, setLanguage] = useState<Language>('en');

  return (
    <PullToRefresh>
      <div className="app">
        <h1>명예 외국인</h1>
        <nav className="tab-bar">
          <PixelButton onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>
            영어
          </PixelButton>
          <PixelButton onClick={() => setLanguage('ja')} aria-pressed={language === 'ja'}>
            일본어
          </PixelButton>
        </nav>
        <nav className="tab-bar">
          <PixelButton onClick={() => setTab('today')} aria-pressed={tab === 'today'}>
            오늘의 단어
          </PixelButton>
          <PixelButton onClick={() => setTab('archive')} aria-pressed={tab === 'archive'}>
            아카이브
          </PixelButton>
          <PixelButton onClick={() => requestNotificationPermissionAndSync()}>
            🔔 알림 켜기
          </PixelButton>
        </nav>
        {language === 'en' ? (
          tab === 'today' ? (
            <TodayPage />
          ) : (
            <ArchivePage />
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
