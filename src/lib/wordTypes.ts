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

export interface JaWordEntry {
  date: string; // YYYY-MM-DD
  word: string; // 한자 표기 단어, 예: 大丈夫
  reading: string; // 단어 훈리가나, 예: だいじょうぶ
  meaningKo: string;
  exampleJa: string; // 한자+가나 예문
  exampleReading: string; // exampleJa 전체를 히라가나로 읽은 것 (음성 매칭용)
  exampleKo: string;
}

export interface JaArchiveIndexItem {
  date: string; // YYYY-MM-DD
  word: string;
  meaningKo: string;
}
