export type Language = 'en' | 'ja';

export interface JaProfile {
  knowsHiragana: boolean;
  knowsKatakana: boolean;
  knowsKanji: boolean;
  memo: string;
}

export interface EnProfile {
  level: 'beginner' | 'everyday' | 'fluent';
  readsIpa: boolean;
  memo: string;
}

export type ProfileOf<L extends Language> = L extends 'ja' ? JaProfile : EnProfile;

export const MEMO_MAX_LENGTH = 100;

export const EN_LEVEL_LABELS: Record<EnProfile['level'], string> = {
  beginner: '기초 단어도 어려워요',
  everyday: '일상 표현은 조금 알아요',
  fluent: '여행·업무 대화 가능해요',
};

const STORAGE_KEY = 'learnerProfile';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMemo(value: unknown): boolean {
  return typeof value === 'string' && value.length <= MEMO_MAX_LENGTH;
}

export function isJaProfile(value: unknown): value is JaProfile {
  return (
    isRecord(value) &&
    typeof value.knowsHiragana === 'boolean' &&
    typeof value.knowsKatakana === 'boolean' &&
    typeof value.knowsKanji === 'boolean' &&
    isMemo(value.memo)
  );
}

export function isEnProfile(value: unknown): value is EnProfile {
  return (
    isRecord(value) &&
    typeof value.level === 'string' &&
    value.level in EN_LEVEL_LABELS &&
    typeof value.readsIpa === 'boolean' &&
    isMemo(value.memo)
  );
}

export function loadProfile<L extends Language>(language: L): ProfileOf<L> | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${language}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const isValid = language === 'ja' ? isJaProfile(parsed) : isEnProfile(parsed);
    return isValid ? (parsed as ProfileOf<L>) : null;
  } catch {
    return null;
  }
}

export function saveProfile<L extends Language>(language: L, profile: ProfileOf<L>): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${language}`, JSON.stringify(profile));
  } catch {
    // 저장이 막혀도(사생활 보호 모드 등) 이번 화면의 대화는 계속할 수 있게 조용히 넘어간다
  }
}

export function describeProfile(profile: JaProfile | EnProfile): string {
  if ('level' in profile) return EN_LEVEL_LABELS[profile.level];
  const known = [
    profile.knowsHiragana && '히라가나',
    profile.knowsKatakana && '가타카나',
    profile.knowsKanji && '한자',
  ].filter(Boolean);
  return known.length > 0 ? known.join(' · ') : '처음 배워요';
}
