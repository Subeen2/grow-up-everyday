import { render, screen, waitFor } from '@testing-library/react';
import { TodayPage } from './TodayPage';
import * as wordData from '../lib/wordData';
import * as reminder from '../lib/reminder';

describe('TodayPage', () => {
  it('shows the word once loaded', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue({
      date: '2026-07-23',
      word: 'awesome',
      partOfSpeech: 'adjective',
      pronunciationKo: '어썸',
      meaningKo: '정말 멋진',
      exampleEn: 'x',
      exampleKo: 'y',
    });
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});

    render(<TodayPage />);

    expect(screen.getByText('불러오는 중...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('awesome')).toBeInTheDocument());
  });

  it('shows an error message when fetching fails', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockRejectedValue(new Error('네트워크 오류'));

    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText(/오류: 네트워크 오류/)).toBeInTheDocument());
  });
});
