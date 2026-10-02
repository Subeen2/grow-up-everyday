import { isEnProfile, isJaProfile } from '../../src/lib/learnerProfile';
import {
  ASSISTANT_MAX_LENGTH,
  ENTRY_FIELD_MAX_LENGTH,
  ExplainRequest,
  MAX_FOLLOW_UPS,
  MAX_RELATED_WORDS,
  QUESTION_MAX_LENGTH,
} from '../../src/lib/explainContract';

const JA_ENTRY_FIELDS = [
  'date',
  'word',
  'reading',
  'readingKo',
  'meaningKo',
  'exampleJa',
  'exampleReading',
  'exampleReadingKo',
  'exampleKo',
];
const EN_ENTRY_FIELDS = ['date', 'word', 'partOfSpeech', 'pronunciationKo', 'meaningKo', 'exampleEn', 'exampleKo'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isText(value: unknown, maxLength: number): boolean {
  return typeof value === 'string' && value.trim() !== '' && value.length <= maxLength;
}

function hasEntryFields(entry: unknown, fields: string[]): boolean {
  return isRecord(entry) && fields.every((field) => isText(entry[field], ENTRY_FIELD_MAX_LENGTH));
}

function isRelatedWords(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length <= MAX_RELATED_WORDS &&
    value.every(
      (item) => isRecord(item) && isText(item.word, ENTRY_FIELD_MAX_LENGTH) && isText(item.meaningKo, ENTRY_FIELD_MAX_LENGTH)
    )
  );
}

// 첫 설명은 Worker가 user 요청을 붙여서 만들기 때문에, 클라이언트 대화는 assistant로 시작해 user로 끝난다
function isConversation(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  if (value.length % 2 !== 0 || value.length / 2 > MAX_FOLLOW_UPS) return false;
  return value.every((message, i) => {
    const role = i % 2 === 0 ? 'assistant' : 'user';
    const maxLength = role === 'user' ? QUESTION_MAX_LENGTH : ASSISTANT_MAX_LENGTH;
    return isRecord(message) && message.role === role && isText(message.content, maxLength);
  });
}

export function validateExplainRequest(body: unknown): ExplainRequest | null {
  if (!isRecord(body)) return null;
  const { language, profile, entry, relatedWords, messages } = body;

  const languageOk =
    (language === 'ja' && isJaProfile(profile) && hasEntryFields(entry, JA_ENTRY_FIELDS)) ||
    (language === 'en' && isEnProfile(profile) && hasEntryFields(entry, EN_ENTRY_FIELDS));

  if (!languageOk || !isRelatedWords(relatedWords) || !isConversation(messages)) return null;
  return body as unknown as ExplainRequest;
}
