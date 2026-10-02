// Korean phonetic spelling of Japanese kana, built by rule instead of asking the LLM:
// the LLM used to leave kana in the output and spell long vowels inconsistently.

const BASE = {
  あ: '아', い: '이', う: '우', え: '에', お: '오',
  か: '카', き: '키', く: '쿠', け: '케', こ: '코',
  が: '가', ぎ: '기', ぐ: '구', げ: '게', ご: '고',
  さ: '사', し: '시', す: '스', せ: '세', そ: '소',
  ざ: '자', じ: '지', ず: '즈', ぜ: '제', ぞ: '조',
  た: '타', ち: '치', つ: '츠', て: '테', と: '토',
  だ: '다', ぢ: '지', づ: '즈', で: '데', ど: '도',
  な: '나', に: '니', ぬ: '누', ね: '네', の: '노',
  は: '하', ひ: '히', ふ: '후', へ: '헤', ほ: '호',
  ば: '바', び: '비', ぶ: '부', べ: '베', ぼ: '보',
  ぱ: '파', ぴ: '피', ぷ: '푸', ぺ: '페', ぽ: '포',
  ま: '마', み: '미', む: '무', め: '메', も: '모',
  や: '야', ゆ: '유', よ: '요',
  ら: '라', り: '리', る: '루', れ: '레', ろ: '로',
  わ: '와', を: '오', ゔ: '부',
  ぁ: '아', ぃ: '이', ぅ: '우', ぇ: '에', ぉ: '오', ゃ: '야', ゅ: '유', ょ: '요',
};

// Hangul medial (vowel) index used when a small kana glides onto the previous consonant: き+ゃ → 캬
const SMALL_MEDIAL = { ゃ: 2, ゅ: 17, ょ: 12, ぁ: 0, ぃ: 20, ぅ: 13, ぇ: 5, ぉ: 8 };
const W_GLIDE_MEDIAL = { ぃ: 16, ぇ: 15, ぉ: 14 }; // う+ぃ → 위

// Medial index → Japanese vowel, for long-vowel detection
const MEDIAL_VOWEL = {
  0: 'a', 2: 'a', 9: 'a', 5: 'e', 7: 'e', 15: 'e', 8: 'o', 12: 'o', 14: 'o',
  13: 'u', 17: 'u', 18: 'u', 16: 'i', 20: 'i',
};
const VOWEL_KANA = { あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o' };

const DROPPED = new Set(['。', '.', '「', '」', '『', '』']);
const KEPT_PUNCTUATION = { '、': ',', ',': ',', '！': '!', '!': '!', '？': '?', '?': '?' };

const HANGUL_START = 0xac00;
const JONG_N = 4;
const JONG_S = 19;

const initialOf = (syllable) => Math.floor((syllable.charCodeAt(0) - HANGUL_START) / 588);
const medialOf = (syllable) => Math.floor(((syllable.charCodeAt(0) - HANGUL_START) % 588) / 28);
const compose = (initial, medial) => String.fromCharCode(HANGUL_START + (initial * 21 + medial) * 28);

function isLongVowel(prevKana, prevVowel, kana) {
  const vowel = VOWEL_KANA[kana];
  if (!vowel || !prevVowel) return false;
  if (vowel === prevVowel) return true;
  if (prevVowel === 'o' && vowel === 'u') return true;
  // ています must stay テイマス, so えい after て/で is read as written
  return prevVowel === 'e' && vowel === 'i' && prevKana !== 'て' && prevKana !== 'で';
}

function convertPhrase(phrase) {
  const chars = [...phrase].map((ch) => (/[ァ-ヶ]/.test(ch) ? String.fromCharCode(ch.charCodeAt(0) - 0x60) : ch));
  const lastKanaIndex = chars.findLastIndex((ch) => !DROPPED.has(ch) && !(ch in KEPT_PUNCTUATION));
  const out = [];
  let prevKana = null;
  let prevVowel = null;

  const addFinal = (jong) => {
    const last = out[out.length - 1];
    const code = last?.charCodeAt(0) - HANGUL_START;
    if (code >= 0 && code < 11172 && code % 28 === 0) out[out.length - 1] = String.fromCharCode(last.charCodeAt(0) + jong);
  };

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];

    if (DROPPED.has(ch)) continue;
    if (ch in KEPT_PUNCTUATION) {
      out.push(KEPT_PUNCTUATION[ch]);
      prevVowel = null;
      continue;
    }
    if (ch === 'っ') {
      addFinal(JONG_S);
      continue;
    }
    if (ch === 'ん') {
      addFinal(JONG_N);
      prevVowel = null;
      continue;
    }
    if (ch === 'ー' || isLongVowel(prevKana, prevVowel, ch)) {
      out.push('-');
      continue;
    }
    if (i === lastKanaIndex && (ch === 'は' || ch === 'へ')) {
      out.push(ch === 'は' ? '와' : '에');
      prevKana = ch;
      prevVowel = ch === 'は' ? 'a' : 'e';
      continue;
    }
    if (!(ch in BASE)) throw new Error(`Cannot convert "${ch}" in "${phrase}" to Hangul`);

    let syllable = BASE[ch];
    if (next in SMALL_MEDIAL && !(ch in SMALL_MEDIAL) && (ch === 'う' || !(ch in VOWEL_KANA))) {
      const medial = ch === 'う' ? W_GLIDE_MEDIAL[next] ?? SMALL_MEDIAL[next] : SMALL_MEDIAL[next];
      syllable = compose(initialOf(syllable), medial);
      i++;
    }
    out.push(syllable);
    prevKana = ch;
    prevVowel = MEDIAL_VOWEL[medialOf(syllable)];
  }
  return out.join('');
}

export function kanaToHangul(kana) {
  return kana.trim().split(/[\s　]+/).map(convertPhrase).join(' ');
}
