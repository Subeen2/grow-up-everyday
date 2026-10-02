import type { ChatMessage, ExplainRequest } from '../../src/lib/explainContract';

export const jaRequest: ExplainRequest = {
  language: 'ja',
  profile: { knowsHiragana: true, knowsKatakana: false, knowsKanji: false, memo: '' },
  entry: {
    date: '2026-09-08',
    word: '経験',
    reading: 'けいけん',
    readingKo: '케-켄',
    meaningKo: '경험',
    exampleJa: '彼は多くの経験を持っています。',
    exampleReading: 'かれは おおくの けいけんを もって います。',
    exampleReadingKo: '카레와 오-쿠노 케-켄오 못테 이마스',
    exampleKo: '그는 많은 경험을 가지고 있습니다.',
  },
  relatedWords: [{ word: '試験', meaningKo: '시험' }],
  messages: [],
};

export const enRequest: ExplainRequest = {
  language: 'en',
  profile: { level: 'beginner', readsIpa: false, memo: '' },
  entry: {
    date: '2026-09-07',
    word: 'figure out',
    partOfSpeech: 'phrasal verb',
    pronunciationKo: '피겨 아웃',
    meaningKo: '알아내다',
    exampleEn: 'I finally figured it out.',
    exampleKo: '드디어 알아냈어.',
  },
  relatedWords: [],
  messages: [],
};

// 첫 설명(assistant) 뒤에 후속 질문/답변 쌍을 붙이고, 마지막 user 질문으로 끝나는 대화
export function conversation(followUps: number): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (let i = 0; i < followUps; i++) {
    messages.push({ role: 'assistant', content: `답변 ${i}` }, { role: 'user', content: `질문 ${i}` });
  }
  return messages;
}
