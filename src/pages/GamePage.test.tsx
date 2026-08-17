import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GamePage } from './GamePage';
import * as wordData from '../lib/wordData';

const entryA = {
  date: '2026-07-23',
  word: 'awesome',
  partOfSpeech: 'adjective',
  pronunciationKo: '어썸',
  meaningKo: '정말 멋진',
  exampleEn: 'This place is awesome!',
  exampleKo: '이곳 정말 멋지다!',
};

describe('GamePage', () => {
  it('shows a fill-in-the-blank question built from a random archive word', async () => {
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([{ date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' }]);
    vi.spyOn(wordData, 'fetchWordByDate').mockResolvedValue(entryA);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(<GamePage />);

    await waitFor(() => expect(screen.getByText(/This place is/)).toBeInTheDocument());
    expect(screen.getByText('힌트: 정말 멋진')).toBeInTheDocument();
    expect(screen.queryByText(/awesome!/)).not.toBeInTheDocument();
    expect(screen.getByText('점수 0')).toBeInTheDocument();
  });

  it('increments the score and shows a celebration on a correct answer', async () => {
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([{ date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' }]);
    vi.spyOn(wordData, 'fetchWordByDate').mockResolvedValue(entryA);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(<GamePage />);

    await waitFor(() => expect(screen.getByText(/This place is/)).toBeInTheDocument());

    await userEvent.type(screen.getByRole('textbox'), 'awesome');
    await userEvent.click(screen.getByRole('button', { name: '확인' }));

    expect(screen.getByText(/정답이에요/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '다음 문제 →' }));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an end message when the archive has no usable words', async () => {
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([]);

    render(<GamePage />);

    await waitFor(() =>
      expect(screen.getByText('게임할 단어가 부족해요. 단어가 더 쌓이면 다시 도전해보세요!')).toBeInTheDocument()
    );
  });
});
