export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function speak(text: string, lang: string): void {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

export function speakEnglish(text: string): void {
  speak(text, 'en-US');
}

export function speakJapanese(text: string): void {
  speak(text, 'ja-JP');
}
