import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JaArchivePage } from './JaArchivePage';
import * as jaWordData from '../lib/jaWordData';

describe('JaArchivePage', () => {
  it('lists archive items and shows detail on click', async () => {
    vi.spyOn(jaWordData, 'fetchArchiveIndex').mockResolvedValue([
      { date: '2026-08-04', word: '大丈夫', meaningKo: '괜찮아' },
    ]);
    vi.spyOn(jaWordData, 'fetchWordByDate').mockResolvedValue({
      date: '2026-08-04',
      word: '大丈夫',
      reading: 'だいじょうぶ',
      readingKo: '다이죠부',
      meaningKo: '괜찮아',
      exampleJa: '今日は大丈夫です。',
      exampleReading: 'きょうはだいじょうぶです',
      exampleReadingKo: '쿄와 다이죠부데스',
      exampleKo: '오늘은 괜찮아요.',
    });

    render(<JaArchivePage />);

    await waitFor(() => expect(screen.getByText('大丈夫')).toBeInTheDocument());
    await userEvent.click(screen.getByText('大丈夫'));

    await waitFor(() => expect(screen.getByText('今日は大丈夫です。')).toBeInTheDocument());
    expect(screen.getByText('← 목록으로')).toBeInTheDocument();
  });
});
