import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import * as wordData from './lib/wordData';
import * as reminder from './lib/reminder';
import * as jaWordData from './lib/jaWordData';

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

  it('switches to Japanese mode and shows the Japanese today page', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue({
      date: '2026-07-23',
      word: 'awesome',
      partOfSpeech: 'adjective',
      pronunciationKo: '어썸',
      meaningKo: '정말 멋진',
      exampleEn: 'x',
      exampleKo: 'y',
    });
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([]);
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});
    vi.spyOn(jaWordData, 'fetchTodayWord').mockResolvedValue({
      date: '2026-08-04',
      word: '大丈夫',
      reading: 'だいじょうぶ',
      meaningKo: '괜찮아',
      exampleJa: '今日は大丈夫です。',
      exampleReading: 'きょうはだいじょうぶです',
      exampleKo: '오늘은 괜찮아요.',
    });
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([]);

    render(<App />);
    await waitFor(() => expect(screen.getByText('awesome')).toBeInTheDocument());

    await userEvent.click(screen.getByText('일본어'));

    await waitFor(() => expect(screen.getByText('大丈夫')).toBeInTheDocument());
    expect(screen.queryByText('awesome')).not.toBeInTheDocument();
  });

  it('shows the archive count next to the 아카이브 label', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue({
      date: '2026-07-23',
      word: 'awesome',
      partOfSpeech: 'adjective',
      pronunciationKo: '어썸',
      meaningKo: '정말 멋진',
      exampleEn: 'x',
      exampleKo: 'y',
    });
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' },
      { date: '2026-07-20', word: 'chill', meaningKo: '느긋하게 쉬다' },
      { date: '2026-07-18', word: 'figure out', meaningKo: '알아내다' },
    ]);
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});

    render(<App />);

    await waitFor(() => expect(screen.getByText('아카이브 (3)')).toBeInTheDocument());
  });

  it('shows the Japanese archive count after switching language', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue({
      date: '2026-07-23',
      word: 'awesome',
      partOfSpeech: 'adjective',
      pronunciationKo: '어썸',
      meaningKo: '정말 멋진',
      exampleEn: 'x',
      exampleKo: 'y',
    });
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' },
    ]);
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});
    vi.spyOn(jaWordData, 'fetchTodayWord').mockResolvedValue({
      date: '2026-08-04',
      word: '大丈夫',
      reading: 'だいじょうぶ',
      meaningKo: '괜찮아',
      exampleJa: '今日は大丈夫です。',
      exampleReading: 'きょうはだいじょうぶです',
      exampleKo: '오늘은 괜찮아요.',
    });
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-08-04', word: '大丈夫', meaningKo: '괜찮아' },
      { date: '2026-08-01', word: '頑張って', meaningKo: '힘내' },
    ]);

    render(<App />);
    await waitFor(() => expect(screen.getByText('아카이브 (1)')).toBeInTheDocument());

    await userEvent.click(screen.getByText('일본어'));

    await waitFor(() => expect(screen.getByText('아카이브 (2)')).toBeInTheDocument());
  });
});
