import { isSpeechSynthesisSupported, speakEnglish } from './speech';

describe('isSpeechSynthesisSupported', () => {
  it('returns true when window.speechSynthesis exists', () => {
    vi.stubGlobal('speechSynthesis', {});
    expect(isSpeechSynthesisSupported()).toBe(true);
  });

  it('returns false when window.speechSynthesis is missing', () => {
    vi.unstubAllGlobals();
    expect(isSpeechSynthesisSupported()).toBe(false);
  });
});

class FakeUtterance {
  text: string;
  lang = '';
  constructor(text: string) {
    this.text = text;
  }
}

describe('speakEnglish', () => {
  it('cancels any current utterance and speaks the given text in English', () => {
    const cancel = vi.fn();
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { cancel, speak });
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);

    speakEnglish('awesome');

    expect(cancel).toHaveBeenCalledOnce();
    expect(speak).toHaveBeenCalledOnce();
    const utterance = speak.mock.calls[0][0];
    expect(utterance.text).toBe('awesome');
    expect(utterance.lang).toBe('en-US');
  });
});
