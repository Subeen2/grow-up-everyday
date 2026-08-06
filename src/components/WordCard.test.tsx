import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WordCard } from './WordCard';
import * as speech from '../lib/speech';

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
    expect(screen.queryByText('adjective')).not.toBeInTheDocument();
    expect(screen.getByText('[어썸]')).toBeInTheDocument();
    expect(screen.getByText('정말 멋진, 굉장한')).toBeInTheDocument();
    expect(screen.getByText('This place is awesome!')).toBeInTheDocument();
    expect(screen.getByText('이곳 정말 멋지다!')).toBeInTheDocument();
  });

  it('hides only the English example when hideExampleEn is true, keeping the Korean translation as a hint', () => {
    render(<WordCard entry={sampleEntry} hideExampleEn />);
    expect(screen.getByText('awesome')).toBeInTheDocument();
    expect(screen.getByText('정말 멋진, 굉장한')).toBeInTheDocument();
    expect(screen.queryByText('This place is awesome!')).not.toBeInTheDocument();
    expect(screen.getByText('이곳 정말 멋지다!')).toBeInTheDocument();
  });

  describe('pronunciation buttons', () => {
    beforeEach(() => {
      vi.spyOn(speech, 'isSpeechSynthesisSupported').mockReturnValue(true);
      vi.spyOn(speech, 'speakEnglish').mockImplementation(() => {});
    });

    it('speaks the word when the word pronunciation button is clicked', async () => {
      render(<WordCard entry={sampleEntry} />);
      await userEvent.click(screen.getByText('🔊 단어 발음'));
      expect(speech.speakEnglish).toHaveBeenCalledWith('awesome');
    });

    it('speaks the example sentence when the example pronunciation button is clicked', async () => {
      render(<WordCard entry={sampleEntry} />);
      await userEvent.click(screen.getByText('🔊 예문 발음'));
      expect(speech.speakEnglish).toHaveBeenCalledWith('This place is awesome!');
    });

    it('hides only the example pronunciation button while the typing challenge is open', () => {
      render(<WordCard entry={sampleEntry} hideExampleEn />);
      expect(screen.getByText('🔊 단어 발음')).toBeInTheDocument();
      expect(screen.queryByText('🔊 예문 발음')).not.toBeInTheDocument();
    });

    it('renders no pronunciation buttons when speech synthesis is unsupported', () => {
      vi.spyOn(speech, 'isSpeechSynthesisSupported').mockReturnValue(false);
      render(<WordCard entry={sampleEntry} />);
      expect(screen.queryByText('🔊 단어 발음')).not.toBeInTheDocument();
      expect(screen.queryByText('🔊 예문 발음')).not.toBeInTheDocument();
    });
  });
});
