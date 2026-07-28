import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodayPage } from './TodayPage';
import * as wordData from '../lib/wordData';
import * as reminder from '../lib/reminder';

const todayEntry = {
  date: '2026-07-23',
  word: 'awesome',
  partOfSpeech: 'adjective',
  pronunciationKo: '어썸',
  meaningKo: '정말 멋진',
  exampleEn: 'x',
  exampleKo: 'y',
};

describe('TodayPage', () => {
  it('shows the word once loaded', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' },
    ]);
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});

    render(<TodayPage />);

    expect(screen.getByText('불러오는 중...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('awesome')).toBeInTheDocument());
  });

  it('shows an error message when fetching fails', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockRejectedValue(new Error('네트워크 오류'));
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([]);

    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText(/오류: 네트워크 오류/)).toBeInTheDocument());
  });

  it('still shows the word and disables "다른 단어 보기" when the archive index fetch fails', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(wordData, 'fetchArchiveIndex').mockRejectedValue(new Error('아카이브 오류'));
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText('awesome')).toBeInTheDocument());
    expect(screen.getByText('다른 단어 보기').closest('button')).toBeDisabled();
  });

  it('disables "다른 단어 보기" when the archive has no other word', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' },
    ]);
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});

    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText('다른 단어 보기')).toBeInTheDocument());
    expect(screen.getByText('다른 단어 보기').closest('button')).toBeDisabled();
    expect(screen.getByText('아직 연습할 다른 단어가 없어요')).toBeInTheDocument();
  });

  it('hides only the English example while the typing challenge is open, keeping the Korean translation as a hint', async () => {
    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue({
      ...todayEntry,
      exampleEn: 'This place is awesome!',
      exampleKo: '이곳 정말 멋지다!',
    });
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' },
      { date: '2026-07-20', word: 'figure out', meaningKo: '알아내다' },
    ]);
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});

    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText('This place is awesome!')).toBeInTheDocument());

    await userEvent.click(screen.getByText('다른 단어 보기'));

    expect(screen.queryByText('This place is awesome!')).not.toBeInTheDocument();
    expect(screen.getByText('이곳 정말 멋지다!')).toBeInTheDocument();
    expect(screen.getByText('awesome')).toBeInTheDocument();
  });

  it('shows the typing challenge after clicking "다른 단어 보기", swaps the word on a correct answer, and returns to today on request', async () => {
    const otherEntry = {
      date: '2026-07-20',
      word: 'figure out',
      partOfSpeech: 'phrase',
      pronunciationKo: '피겨 아웃',
      meaningKo: '알아내다',
      exampleEn: 'Let me figure it out.',
      exampleKo: '내가 알아낼게.',
    };

    vi.spyOn(wordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' },
      { date: '2026-07-20', word: 'figure out', meaningKo: '알아내다' },
    ]);
    vi.spyOn(wordData, 'fetchWordByDate').mockResolvedValue(otherEntry);
    vi.spyOn(reminder, 'isNewDaySinceLastView').mockReturnValue(false);
    vi.spyOn(reminder, 'setLastViewedDate').mockImplementation(() => {});

    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText('awesome')).toBeInTheDocument());

    await userEvent.click(screen.getByText('다른 단어 보기'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'x');
    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    await waitFor(() => expect(screen.getByText('figure out')).toBeInTheDocument());
    expect(screen.getByText('오늘의 단어로')).toBeInTheDocument();

    await userEvent.click(screen.getByText('오늘의 단어로'));

    await waitFor(() => expect(screen.getByText('awesome')).toBeInTheDocument());
    expect(screen.queryByText('오늘의 단어로')).not.toBeInTheDocument();
  });
});
