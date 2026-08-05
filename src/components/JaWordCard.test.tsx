import { render, screen } from '@testing-library/react';
import { JaWordCard } from './JaWordCard';

const sampleEntry = {
  date: '2026-08-04',
  word: '大丈夫',
  reading: 'だいじょうぶ',
  meaningKo: '괜찮아, 문제없어',
  exampleJa: '今日は大丈夫です。',
  exampleReading: 'きょうはだいじょうぶです',
  exampleKo: '오늘은 괜찮아요.',
};

describe('JaWordCard', () => {
  it('renders all fields of the entry', () => {
    render(<JaWordCard entry={sampleEntry} />);
    expect(screen.getByText('大丈夫')).toBeInTheDocument();
    expect(screen.getByText('[だいじょうぶ]')).toBeInTheDocument();
    expect(screen.getByText('괜찮아, 문제없어')).toBeInTheDocument();
    expect(screen.getByText('今日は大丈夫です。')).toBeInTheDocument();
    expect(screen.getByText('오늘은 괜찮아요.')).toBeInTheDocument();
  });

  it('hides only the Japanese example when hideExampleJa is true, keeping the Korean translation as a hint', () => {
    render(<JaWordCard entry={sampleEntry} hideExampleJa />);
    expect(screen.getByText('大丈夫')).toBeInTheDocument();
    expect(screen.queryByText('今日は大丈夫です。')).not.toBeInTheDocument();
    expect(screen.getByText('오늘은 괜찮아요.')).toBeInTheDocument();
  });
});
