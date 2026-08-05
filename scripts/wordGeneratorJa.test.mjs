import { buildPrompt, parseWordResponse, getRecentWords, generateWordEntry } from './wordGeneratorJa.mjs';

describe('buildPrompt', () => {
  it('includes an avoid-list when recentWords is non-empty', () => {
    const prompt = buildPrompt(['大丈夫', '頑張って']);
    expect(prompt).toContain('大丈夫, 頑張って');
  });

  it('omits the avoid-list section when recentWords is empty', () => {
    const prompt = buildPrompt([]);
    expect(prompt).not.toContain('최근에 이미 다뤘으니');
  });
});

describe('parseWordResponse', () => {
  const validJson = JSON.stringify({
    word: ' 大丈夫 ',
    reading: 'だいじょうぶ',
    meaningKo: '괜찮아',
    exampleJa: '今日は大丈夫です。',
    exampleReading: 'きょうはだいじょうぶです',
    exampleKo: '오늘은 괜찮아요.',
  });

  it('returns a trimmed entry for valid JSON', () => {
    expect(parseWordResponse(validJson)).toEqual({
      word: '大丈夫',
      reading: 'だいじょうぶ',
      meaningKo: '괜찮아',
      exampleJa: '今日は大丈夫です。',
      exampleReading: 'きょうはだいじょうぶです',
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
                    exampleReading: 'きょうはだいじょうぶです',
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
