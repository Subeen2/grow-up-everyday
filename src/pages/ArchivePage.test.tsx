import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArchivePage } from './ArchivePage';
import * as wordData from '../lib/wordData';

describe('ArchivePage', () => {
  it('lists archive items and shows detail on click', async () => {
    vi.spyOn(wordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-07-23', word: 'awesome', meaningKo: '정말 멋진' },
    ]);
    vi.spyOn(wordData, 'fetchWordByDate').mockResolvedValue({
      date: '2026-07-23',
      word: 'awesome',
      partOfSpeech: 'adjective',
      pronunciationKo: '어썸',
      meaningKo: '정말 멋진',
      exampleEn: 'x',
      exampleKo: 'y',
    });

    render(<ArchivePage />);

    await waitFor(() => expect(screen.getByText('awesome')).toBeInTheDocument());
    await userEvent.click(screen.getByText('awesome'));

    await waitFor(() => expect(screen.getByText('x')).toBeInTheDocument());
    expect(screen.getByText('← 목록으로')).toBeInTheDocument();
  });
});
