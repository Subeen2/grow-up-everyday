import type { EnProfile, JaProfile } from './learnerProfile';
import type { JaWordEntry, WordEntry } from './wordTypes';

// 앱과 Cloudflare Worker가 함께 쓰는 요청 계약. Worker는 이 파일을 import해서 같은 한도로 검증한다.

export interface RelatedWord {
  word: string;
  meaningKo: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type JaExplainEntry = Omit<JaWordEntry, 'gameExamples'>;
export type EnExplainEntry = Omit<WordEntry, 'gameExamples'>;

interface ExplainRequestBase {
  relatedWords: RelatedWord[];
  messages: ChatMessage[]; // 첫 설명 요청은 빈 배열, 이후엔 assistant로 시작해 user로 끝남
}

export type ExplainRequest =
  | (ExplainRequestBase & { language: 'ja'; profile: JaProfile; entry: JaExplainEntry })
  | (ExplainRequestBase & { language: 'en'; profile: EnProfile; entry: EnExplainEntry });

export const MAX_RELATED_WORDS = 5;
export const MAX_FOLLOW_UPS = 5;
export const QUESTION_MAX_LENGTH = 200;
export const ASSISTANT_MAX_LENGTH = 2000;
export const ENTRY_FIELD_MAX_LENGTH = 200;
