import { buildPrompt, parseWordResponse, getRecentWords, generateWordEntry } from './wordGenerator.mjs';

describe('buildPrompt', () => {
  it('includes an avoid-list when recentWords is non-empty', () => {
    const prompt = buildPrompt(['awesome', 'chill']);
    expect(prompt).toContain('awesome, chill');
  });

  it('omits the avoid-list section when recentWords is empty', () => {
    const prompt = buildPrompt([]);
    expect(prompt).not.toContain('최근에 이미 다뤘으니');
  });
});

describe('parseWordResponse', () => {
  const validJson = JSON.stringify({
    word: ' awesome ',
    partOfSpeech: 'adjective',
    pronunciationKo: '어섬',
    meaningKo: '정말 멋진',
    exampleEn: 'This place is awesome!',
    exampleKo: '이곳 정말 멋지다!',
  });

  it('returns a trimmed entry for valid JSON', () => {
    expect(parseWordResponse(validJson)).toEqual({
      word: 'awesome',
      partOfSpeech: 'adjective',
      pronunciationKo: '어섬',
      meaningKo: '정말 멋진',
      exampleEn: 'This place is awesome!',
      exampleKo: '이곳 정말 멋지다!',
    });
  });

  it('throws when a required field is missing', () => {
    const missingField = JSON.stringify({ word: 'awesome' });
    expect(() => parseWordResponse(missingField)).toThrow('Missing or invalid field');
  });

  it('throws when the response is not valid JSON', () => {
    expect(() => parseWordResponse('not json')).toThrow('not valid JSON');
  });
});

describe('getRecentWords', () => {
  it('filters out entries older than the cutoff', () => {
    const now = new Date('2026-07-23');
    const archiveIndex = [
      { date: '2026-07-20', word: 'recent', meaningKo: 'x' },
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
                    word: 'awesome',
                    partOfSpeech: 'adjective',
                    pronunciationKo: '어섬',
                    meaningKo: '정말 멋진',
                    exampleEn: 'This place is awesome!',
                    exampleKo: '이곳 정말 멋지다!',
                  }),
                },
              },
            ],
          }),
        },
      },
    };

    const result = await generateWordEntry(fakeClient, ['chill']);
    expect(result.word).toBe('awesome');
    expect(fakeClient.chat.completions.create).toHaveBeenCalledOnce();
  });
});
