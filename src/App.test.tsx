import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import * as wordData from './lib/wordData';
import * as reminder from './lib/reminder';

describe('App', () => {
  it('switches between Today and Archive tabs', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue({
      date: '2026-07-23',
      word: 'awesome',
      partOfSpeech: 'adjective',
      pronunciationKo: '어썸',
      meaningKo: '정말 멋진',
      exampleEn: 'x',
      exampleKo: 'y',
    });
    let resolveArchiveIndex!: (items: []) => void;
    vi.spyOn(wordData, 'fetchArchiveIndex').mockImplementation(
      () => new Promise((resolve) => { resolveArchiveIndex = resolve; })
    );
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});

    render(<App />);
    expect(screen.getByText('오늘의 단어')).toBeInTheDocument();

    await userEvent.click(screen.getByText('아카이브'));
    expect(screen.getByText('불러오는 중...')).toBeInTheDocument();

    resolveArchiveIndex([]);
    await waitFor(() => expect(screen.queryByText('불러오는 중...')).not.toBeInTheDocument());
  });

  it('requests notification permission when the bell button is clicked', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue({
      date: '2026-07-23',
      word: 'awesome',
      partOfSpeech: 'adjective',
      pronunciationKo: '어썸',
      meaningKo: '정말 멋진',
      exampleEn: 'x',
      exampleKo: 'y',
    });
    const spy = vi.spyOn(reminder, 'requestNotificationPermissionAndSync').mockResolvedValue();

    render(<App />);
    await userEvent.click(screen.getByText('🔔 알림 켜기'));
    expect(spy).toHaveBeenCalledOnce();
  });
});
