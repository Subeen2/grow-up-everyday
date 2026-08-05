import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JaWordCard } from './JaWordCard';
import * as speech from '../lib/speech';

const sampleEntry = {
  date: '2026-08-04',
  word: '大丈夫',
  reading: 'だいじょうぶ',
  readingKo: '다이죠부',
  meaningKo: '괜찮아, 문제없어',
  exampleJa: '今日は大丈夫です。',
  exampleReading: 'きょうはだいじょうぶです',
  exampleReadingKo: '쿄와 다이죠부데스',
  exampleKo: '오늘은 괜찮아요.',
};

describe('JaWordCard', () => {
  it('renders all fields of the entry', () => {
    render(<JaWordCard entry={sampleEntry} />);
    expect(screen.getByText('大丈夫')).toBeInTheDocument();
    expect(screen.getByText('[だいじょうぶ] 다이죠부')).toBeInTheDocument();
    expect(screen.getByText('괜찮아, 문제없어')).toBeInTheDocument();
    expect(screen.getByText('今日は大丈夫です。')).toBeInTheDocument();
    expect(screen.getByText('쿄와 다이죠부데스')).toBeInTheDocument();
    expect(screen.getByText('오늘은 괜찮아요.')).toBeInTheDocument();
  });

  it('hides the Japanese example and its Korean reading when hideExampleJa is true, keeping the translation as a hint', () => {
    render(<JaWordCard entry={sampleEntry} hideExampleJa />);
    expect(screen.getByText('大丈夫')).toBeInTheDocument();
    expect(screen.queryByText('今日は大丈夫です。')).not.toBeInTheDocument();
    expect(screen.queryByText('쿄와 다이죠부데스')).not.toBeInTheDocument();
    expect(screen.getByText('오늘은 괜찮아요.')).toBeInTheDocument();
  });

  describe('pronunciation buttons', () => {
    beforeEach(() => {
      vi.spyOn(speech, 'isSpeechSynthesisSupported').mockReturnValue(true);
      vi.spyOn(speech, 'speakJapanese').mockImplementation(() => {});
    });

    it('speaks the word when the word pronunciation button is clicked', async () => {
      render(<JaWordCard entry={sampleEntry} />);
      await userEvent.click(screen.getByText('🔊 단어 발음'));
      expect(speech.speakJapanese).toHaveBeenCalledWith('大丈夫');
    });

    it('speaks the example sentence when the example pronunciation button is clicked', async () => {
      render(<JaWordCard entry={sampleEntry} />);
      await userEvent.click(screen.getByText('🔊 예문 발음'));
      expect(speech.speakJapanese).toHaveBeenCalledWith('今日は大丈夫です。');
    });

    it('hides only the example pronunciation button while the voice challenge is open', () => {
      render(<JaWordCard entry={sampleEntry} hideExampleJa />);
      expect(screen.getByText('🔊 단어 발음')).toBeInTheDocument();
      expect(screen.queryByText('🔊 예문 발음')).not.toBeInTheDocument();
    });

    it('renders no pronunciation buttons when speech synthesis is unsupported', () => {
      vi.spyOn(speech, 'isSpeechSynthesisSupported').mockReturnValue(false);
      render(<JaWordCard entry={sampleEntry} />);
      expect(screen.queryByText('🔊 단어 발음')).not.toBeInTheDocument();
      expect(screen.queryByText('🔊 예문 발음')).not.toBeInTheDocument();
    });
  });
});
