import { ArchiveIndexItem } from './wordTypes';
import { pickRandomOtherWord } from './typingChallenge';

export interface OxQuestion {
  word: string;
  shownMeaning: string;
  isTrue: boolean;
}

export function buildOxQuestion(targetEntry: ArchiveIndexItem, archivePool: ArchiveIndexItem[]): OxQuestion {
  const wantsFalse = Math.random() < 0.5;
  const other = wantsFalse ? pickRandomOtherWord(archivePool, targetEntry.date) : null;

  return {
    word: targetEntry.word,
    shownMeaning: other ? other.meaningKo : targetEntry.meaningKo,
    isTrue: other === null,
  };
}
