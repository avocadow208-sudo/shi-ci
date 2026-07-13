const POS_TAIL = /(?:\s|^)(?:n|v|vi|vt|adj|adv|prep|pron|conj|num|art|aux|modal|interj)\.?\s*(?:&\s*(?:n|v|vi|vt|adj|adv)\.?)?\s*$/i;
const BAD_HEADINGS = /^(?:unit|words? and expressions?|vocabulary|page|contents?|notes?|appendix|高中英语|人民教育出版社)$/i;

export function cleanEnglish(value) {
  return value
    .replace(/^\s*(?:\d+[.)、]\s*)?/, '')
    .replace(/[|]/g, 'I')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(POS_TAIL, '')
    .replace(/[,:;，；。]+$/g, '')
    .trim();
}

export function cleanChinese(value) {
  return value
    .replace(/;/g, '；')
    .replace(/,/g, '，')
    .replace(/\(/g, '（')
    .replace(/\)/g, '）')
    .replace(/\s+/g, ' ')
    .replace(/[|]/g, '')
    .replace(/\s*\d{2,4}\s*$/g, '')
    .replace(/^[，；、:：.。\s]+|[\s]+$/g, '')
    .trim();
}

function keyOf(english, chinese) {
  return `${english.toLowerCase().replace(/\s+/g, ' ')}|${chinese.replace(/[，；、。\s]/g, '')}`;
}

function parseLine(line) {
  let normalized = line
    .normalize('NFKC')
    .replace(/[•·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized || /^\d+$/.test(normalized) || BAD_HEADINGS.test(normalized)) return null;

  const chineseIndex = normalized.search(/[\u3400-\u9fff]/);
  if (chineseIndex < 0 || !/[A-Za-z]/.test(normalized.slice(0, chineseIndex))) return null;

  const beforeChinese = normalized.slice(0, chineseIndex).trim();
  let englishPart = beforeChinese;

  const phoneticSlash = beforeChinese.search(/\s\/[\s\S]*$/);
  if (phoneticSlash > 0) englishPart = beforeChinese.slice(0, phoneticSlash);
  else {
    const posIndex = beforeChinese.search(/\s(?:n|v|vi|vt|adj|adv|prep|pron|conj|num|art)\.?\s/i);
    if (posIndex > 0) englishPart = beforeChinese.slice(0, posIndex);
  }

  let english = cleanEnglish(englishPart);
  const chinese = cleanChinese(normalized.slice(chineseIndex));

  if (
    english.length < 2 ||
    english.length > 72 ||
    chinese.length < 1 ||
    chinese.length > 120 ||
    BAD_HEADINGS.test(english) ||
    /^(?:n|v|vi|vt|adj|adv|prep|pron|conj|num|art)\./i.test(english) ||
    !/^[A-Za-z][A-Za-z0-9'().,\-\s…/]*$/.test(english)
  ) return null;

  if ((english.match(/[A-Za-z]+/g) || []).length > 9) return null;
  return { english, chinese };
}

export function parseVocabularyText(text) {
  const entries = [];
  const seen = new Set();
  let pendingEnglish = '';
  const lines = text
    .replace(/\r/g, '\n')
    .replace(/\u00ad/g, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const entry = parseLine(line);
    if (entry) {
      const key = keyOf(entry.english, entry.chinese);
      pendingEnglish = '';
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ id: `entry-${entries.length + 1}`, ...entry });
      continue;
    }

    const chineseIndex = line.search(/[\u3400-\u9fff]/);
    if (pendingEnglish && chineseIndex >= 0) {
      const prefix = line.slice(0, chineseIndex).replace(/[^A-Za-z.&]/g, '').toLowerCase();
      if (!prefix || /^(?:(?:n|v|vi|vt|adj|adv|prep|pron|conj|num|art)\.?|&)+$/.test(prefix)) {
        const chinese = cleanChinese(line.slice(chineseIndex));
        const key = keyOf(pendingEnglish, chinese);
        if (chinese && !seen.has(key)) {
          seen.add(key);
          entries.push({ id: `entry-${entries.length + 1}`, english: pendingEnglish, chinese });
        }
        pendingEnglish = '';
        continue;
      }
    }

    const slashIndex = line.search(/\s\//);
    if (slashIndex > 0 && chineseIndex < 0) {
      const candidate = cleanEnglish(line.slice(0, slashIndex));
      pendingEnglish = /^[A-Za-z][A-Za-z'().,\-\s…]*$/.test(candidate) && candidate.length <= 72 ? candidate : '';
    } else {
      pendingEnglish = '';
    }
  }
  return entries;
}

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeExercises(entries, chineseBlankPercent = 50, seed = Date.now()) {
  const random = mulberry32(Number(seed) || 1);
  const shuffled = entries.map((entry) => ({ ...entry }));
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const chineseBlankCount = Math.round(shuffled.length * (chineseBlankPercent / 100));
  const blankTypes = shuffled.map((_, index) => index < chineseBlankCount ? 'chinese' : 'english');
  for (let i = blankTypes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [blankTypes[i], blankTypes[j]] = [blankTypes[j], blankTypes[i]];
  }

  return shuffled.map((entry, index) => ({
    ...entry,
    blank: blankTypes[index],
  }));
}

export function exercisePrompt(item) {
  return item.blank === 'chinese'
    ? `${item.english}（　　　　　　）`
    : `（　　　　　　）${item.chinese}`;
}

export function exerciseAnswer(item) {
  return `${item.english}　${item.chinese}`;
}
