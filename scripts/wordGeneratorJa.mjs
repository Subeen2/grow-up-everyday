const REQUIRED_FIELDS = ['word', 'reading', 'meaningKo', 'exampleJa', 'exampleReading', 'exampleKo'];

export function buildPrompt(recentWords) {
  const avoidList =
    recentWords.length > 0
      ? `다음 단어/표현은 최근에 이미 다뤘으니 피해줘: ${recentWords.join(', ')}`
      : '';

  return [
    '너는 한국인 일본어 학습자를 위한 "오늘의 단어" 콘텐츠를 만드는 도우미야.',
    '중급 수준의 일상 회화체 한자어 또는 표현 1개를 골라줘.',
    '반드시 아래 JSON 형식으로만 응답해: {"word": string, "reading": string, "meaningKo": string, "exampleJa": string, "exampleReading": string, "exampleKo": string}',
    '- word는 한자를 포함한 단어 표기 (예: "大丈夫")',
    '- reading은 word의 훈리가나, 히라가나로만 표기 (예: "だいじょうぶ")',
    '- exampleJa는 실생활에서 쓸 법한 자연스러운 짧은 문장 (한자+가나 혼용)',
    '- exampleReading은 exampleJa 문장 전체를 히라가나로만 정확하게 읽은 것 (음성 인식 정답 비교에 그대로 쓰이므로 한 글자도 틀리면 안 됨, 한자/가타카나 없이 히라가나만)',
    '- exampleKo는 exampleJa의 자연스러운 한국어 번역',
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
