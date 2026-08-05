import { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JaTodayPage } from './JaTodayPage';
import * as jaWordData from '../lib/jaWordData';

const todayEntry = {
  date: '2026-08-04',
  word: '大丈夫',
  reading: 'だいじょうぶ',
  meaningKo: '괜찮아',
  exampleJa: '今日は大丈夫です。',
  exampleReading: 'きょうはだいじょうぶです',
  exampleKo: '오늘은 괜찮아요.',
};

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: { results: { 0: { transcript: string } }[][] }) => void) | null = null;
  onerror: (() => void) | null = null;
  start() {
    FakeRecognition.instances.push(this);
  }
}

function resolveWithTranscript(text: string) {
  const instance = FakeRecognition.instances[FakeRecognition.instances.length - 1];
  act(() => {
    instance.onresult?.({ results: [[{ transcript: text }]] } as any);
  });
}

describe('JaTodayPage', () => {
  beforeEach(() => {
    localStorage.clear();
    (window as any).SpeechRecognition = FakeRecognition;
  });

  afterEach(() => {
    delete (window as any).SpeechRecognition;
    FakeRecognition.instances = [];
  });

  it('shows the word once loaded', async () => {
    vi.spyOn(jaWordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-08-04', word: '大丈夫', meaningKo: '괜찮아' },
    ]);

    render(<JaTodayPage />);

    expect(screen.getByText('불러오는 중...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('大丈夫')).toBeInTheDocument());
  });

  it('shows an error message when fetching fails', async () => {
    vi.spyOn(jaWordData, 'fetchTodayWord').mockRejectedValue(new Error('네트워크 오류'));
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([]);

    render(<JaTodayPage />);

    await waitFor(() => expect(screen.getByText(/오류: 네트워크 오류/)).toBeInTheDocument());
  });

  it('disables "다른 단어 보기" when the archive has no other word', async () => {
    vi.spyOn(jaWordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-08-04', word: '大丈夫', meaningKo: '괜찮아' },
    ]);

    render(<JaTodayPage />);

    await waitFor(() => expect(screen.getByText('다른 단어 보기')).toBeInTheDocument());
    expect(screen.getByText('다른 단어 보기').closest('button')).toBeDisabled();
    expect(screen.getByText('아직 연습할 다른 단어가 없어요')).toBeInTheDocument();
  });

  it('hides only the Japanese example while the voice challenge is open, keeping the Korean translation as a hint', async () => {
    vi.spyOn(jaWordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-08-04', word: '大丈夫', meaningKo: '괜찮아' },
      { date: '2026-08-01', word: '頑張って', meaningKo: '힘내' },
    ]);

    render(<JaTodayPage />);

    await waitFor(() => expect(screen.getByText('今日は大丈夫です。')).toBeInTheDocument());

    await userEvent.click(screen.getByText('다른 단어 보기'));

    expect(screen.queryByText('今日は大丈夫です。')).not.toBeInTheDocument();
    expect(screen.getByText('오늘은 괜찮아요.')).toBeInTheDocument();
  });

  it('shows the voice challenge after clicking "다른 단어 보기", swaps the word on a correct spoken answer, and returns to today on request', async () => {
    const otherEntry = {
      date: '2026-08-01',
      word: '頑張って',
      reading: 'がんばって',
      meaningKo: '힘내',
      exampleJa: '頑張ってください。',
      exampleReading: 'がんばってください',
      exampleKo: '힘내주세요.',
    };

    vi.spyOn(jaWordData, 'fetchTodayWord').mockResolvedValue(todayEntry);
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-08-04', word: '大丈夫', meaningKo: '괜찮아' },
      { date: '2026-08-01', word: '頑張って', meaningKo: '힘내' },
    ]);
    vi.spyOn(jaWordData, 'fetchWordByDate').mockResolvedValue(otherEntry);

    render(<JaTodayPage />);

    await waitFor(() => expect(screen.getByText('大丈夫')).toBeInTheDocument());

    await userEvent.click(screen.getByText('다른 단어 보기'));
    await userEvent.click(screen.getByText('🎤 말하기'));
    resolveWithTranscript('今日は大丈夫です。');

    await waitFor(() => expect(screen.getByText('頑張って')).toBeInTheDocument());
    expect(screen.getByText('오늘의 단어로')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();

    await userEvent.click(screen.getByText('오늘의 단어로'));

    await waitFor(() => expect(screen.getByText('大丈夫')).toBeInTheDocument());
    expect(screen.queryByText('오늘의 단어로')).not.toBeInTheDocument();
  });
});
