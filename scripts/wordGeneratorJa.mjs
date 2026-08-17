const REQUIRED_FIELDS = [
  'word',
  'reading',
  'readingKo',
  'meaningKo',
  'exampleJa',
  'exampleReading',
  'exampleReadingKo',
  'exampleKo',
];

export function buildPrompt(recentWords) {
  const avoidList =
    recentWords.length > 0
      ? `다음 단어/표현은 최근에 이미 다뤘으니 피해줘: ${recentWords.join(', ')}`
      : '';

  return [
    '너는 한국인 일본어 학습자를 위한 "오늘의 단어" 콘텐츠를 만드는 도우미야.',
    '중급 수준의 일상 회화체 한자어 또는 표현 1개를 골라줘.',
    '반드시 아래 JSON 형식으로만 응답해: {"word": string, "reading": string, "readingKo": string, "meaningKo": string, "exampleJa": string, "exampleReading": string, "exampleReadingKo": string, "exampleKo": string}',
    '- word는 한자를 포함한 단어 표기 (예: "大丈夫")',
    '- reading은 word의 훈리가나, 히라가나로만 표기 (예: "だいじょうぶ")',
    '- readingKo는 word의 한글 발음표기. 이것은 번역이 아니라 발음이다 — meaningKo(뜻)와 절대 같은 내용이면 안 되고, 소리 나는 대로 한글로 옮긴 것이어야 한다 (예: word가 "大丈夫"면 readingKo는 "다이죠부", meaningKo인 "괜찮아"가 아니다)',
    '- exampleJa는 실생활에서 쓸 법한 자연스러운 짧은 문장 (한자+가나 혼용)',
    '- exampleReading은 exampleJa 문장 전체를 히라가나로만 정확하게 읽은 것 (음성 인식 정답 비교에 그대로 쓰이므로 한 글자도 틀리면 안 됨, 한자/가타카나 없이 히라가나만)',
    '- exampleReadingKo는 exampleJa 문장을 소리 나는 대로 한글로 옮긴 발음표기. 이것은 번역이 아니라 발음이다 — exampleKo(번역)와 절대 같은 내용이면 안 되고, 실제 한국어 문장처럼 읽혀서는 안 된다 (예: exampleJa가 "今日は大丈夫です。"면 exampleReadingKo는 "쿄-와 다이죠-부데스", exampleKo인 "오늘은 괜찮아요"가 아니다)',
    '- exampleKo는 exampleJa의 자연스러운 한국어 번역',
    avoidList,
  ]
    .filter(Boolean)
    .join('\n');
}

function sharesTooManyWords(readingKoText, translationText, threshold = 0.5) {
  const tokenize = (text) =>
    text
      .replace(/[.,!?~]/g, '')
      .split(/\s+/)
      .filter(Boolean);

  const readingTokens = tokenize(readingKoText);
  if (readingTokens.length === 0) return false;

  const translationTokens = new Set(tokenize(translationText));
  const shared = readingTokens.filter((token) => translationTokens.has(token)).length;
  return shared / readingTokens.length >= threshold;
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

  if (sharesTooManyWords(entry.readingKo, entry.meaningKo)) {
    throw new Error('readingKo looks like a translation, not a phonetic reading');
  }
  if (sharesTooManyWords(entry.exampleReadingKo, entry.exampleKo)) {
    throw new Error('exampleReadingKo looks like a translation, not a phonetic reading');
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

const GAME_EXAMPLES_COUNT = 3;

export function buildGameExamplesPrompt(word, reading, meaningKo, existingExample) {
  return [
    '너는 한국인 일본어 학습자를 위한 "빈칸 채우기 연습" 예문을 만드는 도우미야.',
    `아래 단어를 사용한 자연스러운 짧은 일본어 문장(한자+가나 혼용)을 정확히 ${GAME_EXAMPLES_COUNT}개 만들어줘.`,
    `단어: "${word}" (읽기: ${reading}, 뜻: ${meaningKo})`,
    `이미 사용 중인 예문과는 다르고, 서로도 다른 새로운 문장이어야 해: "${existingExample}"`,
    `각 문장은 반드시 "${word}"라는 한자 표기를 정확히 그대로 포함해야 해.`,
    '반드시 아래 JSON 형식으로만 응답해: {"examples": string[]}',
  ].join('\n');
}

export function parseGameExamplesResponse(raw, word, existingExample) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('OpenAI response is not valid JSON');
  }
  if (!Array.isArray(data.examples)) {
    throw new Error('Missing or invalid field: examples');
  }

  const seen = new Set([existingExample.trim()]);
  const examples = [];
  for (const item of data.examples) {
    if (typeof item !== 'string') continue;
    const sentence = item.trim();
    if (!sentence) continue;
    if (seen.has(sentence) || !sentence.includes(word)) continue;
    seen.add(sentence);
    examples.push(sentence);
  }
  return examples;
}

export async function generateGameExamples(client, { word, reading, meaningKo, existingExample }) {
  const prompt = buildGameExamplesPrompt(word, reading, meaningKo, existingExample);
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You output strict JSON and nothing else.' },
      { role: 'user', content: prompt },
    ],
  });
  const raw = completion.choices[0].message.content;
  return parseGameExamplesResponse(raw, word, existingExample);
}
