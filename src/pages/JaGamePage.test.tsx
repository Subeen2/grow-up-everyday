import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JaGamePage } from './JaGamePage';
import * as jaWordData from '../lib/jaWordData';

const entryA = {
  date: '2026-08-05',
  word: '面白い',
  reading: 'おもしろい',
  readingKo: '오모시로이',
  meaningKo: '재미있는',
  exampleJa: 'この本は面白いです。',
  exampleReading: 'このほんはおもしろいです。',
  exampleReadingKo: '코노 혼은 오모시로이데스.',
  exampleKo: '이 책은 재미있습니다.',
};

describe('JaGamePage', () => {
  it('shows a fill-in-the-blank question built from a random archive word', async () => {
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([{ date: '2026-08-05', word: '面白い', meaningKo: '재미있는' }]);
    vi.spyOn(jaWordData, 'fetchWordByDate').mockResolvedValue(entryA);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(<JaGamePage />);

    await waitFor(() => expect(screen.getByText(/この本は/)).toBeInTheDocument());
    expect(screen.getByText('힌트: 재미있는')).toBeInTheDocument();
  });

  it('increments the score on a correct answer', async () => {
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([{ date: '2026-08-05', word: '面白い', meaningKo: '재미있는' }]);
    vi.spyOn(jaWordData, 'fetchWordByDate').mockResolvedValue(entryA);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(<JaGamePage />);

    await waitFor(() => expect(screen.getByText(/この本は/)).toBeInTheDocument());

    await userEvent.type(screen.getByRole('textbox'), '面白い');
    await userEvent.click(screen.getByRole('button', { name: '확인' }));

    expect(screen.getByText(/정답이에요/)).toBeInTheDocument();
  });
});
