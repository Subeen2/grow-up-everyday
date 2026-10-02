import { MAX_RELATED_WORDS, RelatedWord } from './explainContract';
import type { ArchiveIndexItem, JaArchiveIndexItem } from './wordTypes';

const HAN = /\p{Script=Han}/u;

const toRelatedWord = (item: { word: string; meaningKo: string }): RelatedWord => ({
  word: item.word,
  meaningKo: item.meaningKo,
});

export function findRelatedJaWords(word: string, pool: JaArchiveIndexItem[], currentDate: string): RelatedWord[] {
  const kanji = new Set([...word].filter((ch) => HAN.test(ch)));
  if (kanji.size === 0) return [];

  return pool
    .filter((item) => item.date !== currentDate)
    .map((item) => ({ item, shared: new Set([...item.word].filter((ch) => kanji.has(ch))).size }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => b.shared - a.shared || b.item.date.localeCompare(a.item.date))
    .slice(0, MAX_RELATED_WORDS)
    .map(({ item }) => toRelatedWord(item));
}

// 영어엔 한자처럼 공유할 글자 단위가 없어서, 최근에 배운 단어를 "이미 아는 단어"로 넘긴다
export function recentEnWords(pool: ArchiveIndexItem[], currentDate: string): RelatedWord[] {
  return pool
    .filter((item) => item.date !== currentDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_RELATED_WORDS)
    .map(toRelatedWord);
}
