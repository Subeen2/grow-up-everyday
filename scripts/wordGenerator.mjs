const REQUIRED_FIELDS = ['word', 'partOfSpeech', 'pronunciationKo', 'meaningKo', 'exampleEn', 'exampleKo'];

export function buildPrompt(recentWords) {
  const avoidList =
    recentWords.length > 0
      ? `다음 단어/표현은 최근에 이미 다뤘으니 피해줘: ${recentWords.join(', ')}`
      : '';

  return [
    '너는 한국인 영어 학습자를 위한 "오늘의 단어" 콘텐츠를 만드는 도우미야.',
    '중급~중고급 수준의 일상 회화체 단어 또는 표현 1개를 골라줘.',
    '원어민이 실제로 자주 쓰는 관용표현, 구동사(phrasal verb), 연어(collocation)를 적극적으로 포함해줘 — 단순한 기초 단어는 피해줘.',
    '반드시 아래 JSON 형식으로만 응답해: {"word": string, "partOfSpeech": string, "pronunciationKo": string, "meaningKo": string, "exampleEn": string, "exampleKo": string}',
    '- pronunciationKo는 한글 발음표기 (예: "어썸")',
    '- exampleEn은 실생활에서 쓸 법한 자연스러운 짧은 문장',
    '- exampleKo는 exampleEn의 자연스러운 한국어 번역',
    avoidList,
  ]
    .filter(Boolean)
    .join('\n');
}

export function parseWordResponse(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('OpenAI response is not valid JSON');
  }

  const entry = {};
  for (const field of REQUIRED_FIELDS) {
    const value = data[field];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Missing or invalid field: ${field}`);
    }
    entry[field] = value.trim();
  }
  return entry;
}

export function getRecentWords(archiveIndex, days = 90, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return archiveIndex.filter((item) => item.date >= cutoffStr).map((item) => item.word);
}

export async function generateWordEntry(client, recentWords) {
  const prompt = buildPrompt(recentWords);
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You output strict JSON and nothing else.' },
      { role: 'user', content: prompt },
    ],
  });
  const raw = completion.choices[0].message.content;
  return parseWordResponse(raw);
}
