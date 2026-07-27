import { useState } from 'react';
import { TodayPage } from './pages/TodayPage';
import { ArchivePage } from './pages/ArchivePage';
import { PixelButton } from './components/PixelButton';
import { requestNotificationPermissionAndSync } from './lib/reminder';

type Tab = 'today' | 'archive';

export function App() {
  const [tab, setTab] = useState<Tab>('today');

  return (
    <div className="app">
      <h1>명예 외국인</h1>
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
      {tab === 'today' ? <TodayPage /> : <ArchivePage />}
    </div>
  );
}
