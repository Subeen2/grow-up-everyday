import {
  buildPrompt,
  parseWordResponse,
  getRecentWords,
  generateWordEntry,
  buildGameExamplesPrompt,
  parseGameExamplesResponse,
  generateGameExamples,
} from './wordGeneratorJa.mjs';

describe('buildPrompt', () => {
  it('includes an avoid-list when recentWords is non-empty', () => {
    const prompt = buildPrompt(['大丈夫', '頑張って']);
    expect(prompt).toContain('大丈夫, 頑張って');
  });

  it('omits the avoid-list section when recentWords is empty', () => {
    const prompt = buildPrompt([]);
    expect(prompt).not.toContain('최근에 이미 다뤘으니');
  });

  it('asks for exampleReading split into phrases so particles can be read correctly', () => {
    expect(buildPrompt([])).toContain('어절');
  });
});

describe('parseWordResponse', () => {
  const validJson = JSON.stringify({
    word: ' 大丈夫 ',
    reading: 'だいじょうぶ',
    meaningKo: '괜찮아',
    exampleJa: '今日は大丈夫です。',
    exampleReading: 'きょうは だいじょうぶです。',
    exampleKo: '오늘은 괜찮아요.',
  });

  it('returns a trimmed entry with Korean readings derived from the kana readings', () => {
    expect(parseWordResponse(validJson)).toEqual({
      word: '大丈夫',
      reading: 'だいじょうぶ',
      readingKo: '다이죠-부',
      meaningKo: '괜찮아',
      exampleJa: '今日は大丈夫です。',
      exampleReading: 'きょうは だいじょうぶです。',
      exampleReadingKo: '쿄-와 다이죠-부데스',
      exampleKo: '오늘은 괜찮아요.',
    });
  });

  it('throws when a required field is missing', () => {
    const missingField = JSON.stringify({ word: '大丈夫' });
    expect(() => parseWordResponse(missingField)).toThrow('Missing or invalid field');
  });

  it('throws when the response is not valid JSON', () => {
    expect(() => parseWordResponse('not json')).toThrow('not valid JSON');
  });

  it('throws when exampleReading still contains kanji', () => {
    const badJson = JSON.stringify({ ...JSON.parse(validJson), exampleReading: 'きょうは 大丈夫です。' });
    expect(() => parseWordResponse(badJson)).toThrow('Cannot convert');
  });
});

describe('getRecentWords', () => {
  it('filters out entries older than the cutoff', () => {
    const now = new Date('2026-08-04');
    const archiveIndex = [
      { date: '2026-08-01', word: 'recent', meaningKo: 'x' },
      { date: '2025-01-01', word: 'old', meaningKo: 'x' },
    ];
    expect(getRecentWords(archiveIndex, 90, now)).toEqual(['recent']);
  });
});

describe('generateWordEntry', () => {
  it('calls the OpenAI client and parses its response', async () => {
    const fakeClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    word: '大丈夫',
                    reading: 'だいじょうぶ',
                    meaningKo: '괜찮아',
                    exampleJa: '今日は大丈夫です。',
                    exampleReading: 'きょうは だいじょうぶです',
                    exampleKo: '오늘은 괜찮아요.',
                  }),
                },
              },
            ],
          }),
        },
      },
    };

    const result = await generateWordEntry(fakeClient, ['頑張って']);
    expect(result.word).toBe('大丈夫');
    expect(fakeClient.chat.completions.create).toHaveBeenCalledOnce();
  });
});

describe('buildGameExamplesPrompt', () => {
  it('includes the word, reading, meaning, and existing example', () => {
    const prompt = buildGameExamplesPrompt('大丈夫', 'だいじょうぶ', '괜찮아', '今日は大丈夫です。');
    expect(prompt).toContain('大丈夫');
    expect(prompt).toContain('だいじょうぶ');
    expect(prompt).toContain('괜찮아');
    expect(prompt).toContain('今日は大丈夫です。');
  });
});

describe('parseGameExamplesResponse', () => {
  it('keeps sentences that contain the kanji word and are not the existing example', () => {
    const raw = JSON.stringify({
      examples: ['彼は大丈夫だと言った。', '今日は大丈夫です。', '関係ない文章。', '  '],
    });

    expect(parseGameExamplesResponse(raw, '大丈夫', '今日は大丈夫です。')).toEqual([
      '彼は大丈夫だと言った。',
    ]);
  });

  it('throws when examples is missing or not an array', () => {
    expect(() => parseGameExamplesResponse(JSON.stringify({}), '大丈夫', 'x')).toThrow(
      'Missing or invalid field'
    );
  });

  it('throws when the response is not valid JSON', () => {
    expect(() => parseGameExamplesResponse('not json', '大丈夫', 'x')).toThrow('not valid JSON');
  });
});

describe('generateGameExamples', () => {
  it('calls the OpenAI client and parses its response', async () => {
    const fakeClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({ examples: ['彼は大丈夫だと言った。'] }) } }],
          }),
        },
      },
    };

    const result = await generateGameExamples(fakeClient, {
      word: '大丈夫',
      reading: 'だいじょうぶ',
      meaningKo: '괜찮아',
      existingExample: '今日は大丈夫です。',
    });

    expect(result).toEqual(['彼は大丈夫だと言った。']);
    expect(fakeClient.chat.completions.create).toHaveBeenCalledOnce();
  });
});
