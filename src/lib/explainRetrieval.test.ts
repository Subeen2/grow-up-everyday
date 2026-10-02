import { findRelatedJaWords, recentEnWords } from './explainRetrieval';

describe('findRelatedJaWords', () => {
  const pool = [
    { date: '2026-09-08', word: '経験', meaningKo: '경험' },
    { date: '2026-08-06', word: '試験', meaningKo: '시험' },
    { date: '2026-09-01', word: '経済', meaningKo: '경제' },
    { date: '2026-07-01', word: '経験談', meaningKo: '경험담' },
    { date: '2026-08-30', word: '自信', meaningKo: '자신감' },
  ];

  it('returns words sharing kanji, most shared first, then newest, excluding the current word', () => {
    expect(findRelatedJaWords('経験', pool, '2026-09-08')).toEqual([
      { word: '経験談', meaningKo: '경험담' },
      { word: '経済', meaningKo: '경제' },
      { word: '試験', meaningKo: '시험' },
    ]);
  });

  it('returns an empty list for a kana-only word', () => {
    expect(findRelatedJaWords('おもしろい', pool, '2026-08-05')).toEqual([]);
  });

  it('returns at most 5 words', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      date: `2026-08-${String(i + 10).padStart(2, '0')}`,
      word: `験${i}`,
      meaningKo: `뜻${i}`,
    }));
    expect(findRelatedJaWords('試験', many, '2026-09-30')).toHaveLength(5);
  });
});

describe('recentEnWords', () => {
  it('returns the 5 newest words excluding the current one', () => {
    const pool = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-09-0${i + 1}`,
      word: `word${i + 1}`,
      meaningKo: `뜻${i + 1}`,
    }));

    expect(recentEnWords(pool, '2026-09-07').map((w) => w.word)).toEqual([
      'word6',
      'word5',
      'word4',
      'word3',
      'word2',
    ]);
  });
});
