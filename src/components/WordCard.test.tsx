import { render, screen } from '@testing-library/react';
import { WordCard } from './WordCard';

const sampleEntry = {
  date: '2026-07-23',
  word: 'awesome',
  partOfSpeech: 'adjective',
  pronunciationKo: '어썸',
  meaningKo: '정말 멋진, 굉장한',
  exampleEn: 'This place is awesome!',
  exampleKo: '이곳 정말 멋지다!',
};

describe('WordCard', () => {
  it('renders all fields of the entry', () => {
    render(<WordCard entry={sampleEntry} />);
    expect(screen.getByText('awesome')).toBeInTheDocument();
    expect(screen.getByText('adjective')).toBeInTheDocument();
    expect(screen.getByText('[어썸]')).toBeInTheDocument();
    expect(screen.getByText('정말 멋진, 굉장한')).toBeInTheDocument();
    expect(screen.getByText('This place is awesome!')).toBeInTheDocument();
    expect(screen.getByText('이곳 정말 멋지다!')).toBeInTheDocument();
  });
});
