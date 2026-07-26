export interface WordEntry {
  date: string; // YYYY-MM-DD
  word: string;
  partOfSpeech: string;
  pronunciationKo: string;
  meaningKo: string;
  exampleEn: string;
  exampleKo: string;
}

export interface ArchiveIndexItem {
  date: string; // YYYY-MM-DD
  word: string;
  meaningKo: string;
}
