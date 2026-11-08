/**
 * Spoken-token equivalence for the exact word-timestamp gate (audit V-10/V-11).
 *
 * Real 2026-11-08 run: the Tajik audio was correct, but STT wrote "У" for
 * "Ӯ", "чи" for "чӣ", "қад баландтар" for "қадбаландтар" and the Mandarin
 * 比/很 as Cyrillic "би"/"ҳен", so the strict gate rejected a good take.
 *
 * Only POSITION-ALIGNED equivalences of the SAME spoken word are accepted:
 *  - Tajik long-vowel marks ӣ/и and ӯ/у (as Russian ё/е is already folded);
 *  - 2–3 consecutive recognized tokens whose concatenation is the expected
 *    word (a compound the recognizer split);
 *  - a Hanzi syllable written in Cyrillic or toneless pinyin, ONLY when that
 *    character's reading comes from an author-verified Hanzi/pinyin pair.
 * Captions always display the source narration; nothing is invented.
 */

const TAJIK_FOLD = [["ӣ", "и"], ["ӯ", "у"]];

export function foldLocaleToken(text, locale) {
  let value = String(text).toLocaleLowerCase("und");
  if (locale === "ru-RU") value = value.replaceAll("ё", "е");
  if (locale === "tg-TJ") for (const [from, to] of TAJIK_FOLD) value = value.replaceAll(from, to);
  return value;
}

// Cyrillic renderings of one syllable differ in soft signs, э/е and the
// Tajik letters for the same sounds; compare a phonetic skeleton.
export function phoneticFold(text) {
  return String(text).toLocaleLowerCase("und")
    .replace(/[ьъ]/gu, "").replace(/[эё]/gu, "е").replaceAll("ҳ", "х").replaceAll("қ", "к")
    .replaceAll("ғ", "г").replaceAll("ҷ", "ч").replaceAll("ӣ", "и").replaceAll("ӯ", "у");
}

export function tonelessPinyin(syllable) {
  return String(syllable).normalize("NFD").toLocaleLowerCase("und")
    .replace(/ü/gu, "v").replace(/ü/gu, "v")
    .replace(/[̀-ͯ]/gu, "").replace(/[^a-z]/gu, "");
}

const INITIALS = {
  b: ["б"], p: ["п"], m: ["м"], f: ["ф"], d: ["д"], t: ["т"], n: ["н"], l: ["л"],
  g: ["г"], k: ["к"], h: ["х"], j: ["цз", "дж", "ҷ"], q: ["ц", "ч"], x: ["с", "ш"],
  zh: ["чж", "дж", "ҷ"], ch: ["ч"], sh: ["ш"], r: ["ж", "р"], z: ["цз", "з"], c: ["ц"], s: ["с"],
};
// Palladius finals after an initial (with common alternative spellings).
const FINALS = {
  a: ["а"], o: ["о"], e: ["э"], ai: ["ай"], ei: ["эй"], ao: ["ао"], ou: ["оу"],
  an: ["ань"], en: ["энь"], ang: ["ан"], eng: ["эн"], ong: ["ун"], er: ["эр"],
  i: ["и"], ia: ["я"], ie: ["е"], iao: ["яо"], iu: ["ю"], ian: ["янь"], in: ["инь"],
  iang: ["ян"], ing: ["ин"], iong: ["юн"],
  u: ["у"], ua: ["уа"], uo: ["о", "уо"], uai: ["уай"], ui: ["уй", "уэй"], uan: ["уань"],
  un: ["унь"], uang: ["уан"], v: ["юй"], ve: ["юэ"], van: ["юань"], vn: ["юнь"],
};
const ZERO_INITIAL = {
  a: ["а"], o: ["о"], e: ["э"], ai: ["ай"], ei: ["эй"], ao: ["ао"], ou: ["оу"], an: ["ань"],
  en: ["энь"], ang: ["ан"], eng: ["эн"], er: ["эр"],
  yi: ["и"], ya: ["я"], ye: ["е"], yao: ["яо"], you: ["ю"], yan: ["янь"], yin: ["инь"],
  yang: ["ян"], ying: ["ин"], yong: ["юн"], yu: ["юй"], yue: ["юэ"], yuan: ["юань"], yun: ["юнь"],
  wu: ["у"], wa: ["ва"], wo: ["во"], wai: ["вай"], wei: ["вэй"], wan: ["вань"], wen: ["вэнь"],
  wang: ["ван"], weng: ["вэн"],
};

/** Phonetically folded Cyrillic spellings of one toneless pinyin syllable. */
export function pinyinCyrillicCandidates(syllable) {
  const plain = tonelessPinyin(syllable);
  if (!plain) return new Set();
  let spellings = ZERO_INITIAL[plain];
  if (!spellings) {
    const initial = ["zh", "ch", "sh"].find((value) => plain.startsWith(value)) ??
      (INITIALS[plain[0]] ? plain[0] : null);
    if (!initial) return new Set();
    let final = plain.slice(initial.length);
    if (["j", "q", "x"].includes(initial) && final.startsWith("u")) final = "v" + final.slice(1);
    if (["l", "n"].includes(initial) && final === "ue") final = "ve";
    let finals = FINALS[final];
    if (final === "i" && ["z", "c", "s"].includes(initial)) finals = ["ы"];
    if (!finals) return new Set();
    spellings = INITIALS[initial].flatMap((head) => finals.map((tail) => head + tail));
  }
  return new Set(spellings.map(phoneticFold));
}

/** Author-verified Hanzi → toneless syllables, only from count-matched pairs. */
export function buildHanziReadings(pairs) {
  const readings = new Map();
  for (const { hanzi, pinyin } of pairs) {
    if (typeof hanzi !== "string" || typeof pinyin !== "string") continue;
    const characters = hanzi.match(/\p{Script=Han}/gu) ?? [];
    const syllables = pinyin.split(/[\s·'’\-–—/≠≈+…,.!?;:，。！？、]+/u).map(tonelessPinyin).filter(Boolean);
    if (!characters.length || characters.length !== syllables.length) continue;
    characters.forEach((character, index) => {
      if (!readings.has(character)) readings.set(character, new Set());
      readings.get(character).add(syllables[index]);
    });
  }
  return readings;
}

/** Every {hanzi, pinyin} pair anywhere inside lesson/episode JSON. */
export function collectHanziPinyinPairs(value, pairs = []) {
  if (Array.isArray(value)) value.forEach((item) => collectHanziPinyinPairs(item, pairs));
  else if (value && typeof value === "object") {
    if (typeof value.hanzi === "string" && typeof value.pinyin === "string")
      pairs.push({ hanzi: value.hanzi, pinyin: value.pinyin });
    for (const item of Object.values(value)) collectHanziPinyinPairs(item, pairs);
  }
  return pairs;
}

export function createSpokenMatcher({ locale, readings = new Map() }) {
  return (expected, recognized) => {
    if (expected === recognized) return true;
    if (foldLocaleToken(expected, locale) === foldLocaleToken(recognized, locale)) return true;
    if (!/^\p{Script=Han}$/u.test(expected) || !readings.has(expected)) return false;
    const heard = String(recognized);
    for (const syllable of readings.get(expected)) {
      if (/^[a-zÀ-ɏ]+$/iu.test(heard) && tonelessPinyin(heard) === syllable) return true;
      if (pinyinCyrillicCandidates(syllable).has(phoneticFold(heard))) return true;
    }
    return false;
  };
}

/**
 * Align expected tokens 1:1 with recognized timed tokens. A recognized
 * compound split into 2–3 parts becomes one part spanning their timestamps.
 * Returns {aligned} (same length as expected) or {failedAt}.
 */
export function alignSpokenTokens(expected, recognized, match, { maxMergeParts = 3 } = {}) {
  const aligned = [];
  let cursor = 0;
  for (let index = 0; index < expected.length; index += 1) {
    const wanted = expected[index].text;
    if (cursor < recognized.length && match(wanted, recognized[cursor].text)) {
      aligned.push(recognized[cursor]);
      cursor += 1;
      continue;
    }
    let merged = null;
    for (let parts = 2; parts <= maxMergeParts && cursor + parts <= recognized.length; parts += 1) {
      const span = recognized.slice(cursor, cursor + parts);
      if (match(wanted, span.map((part) => part.text).join(""))) {
        merged = { ...span[0], text: span.map((part) => part.text).join(""),
          endMs: Math.max(...span.map((part) => part.endMs)), mergedParts: parts };
        cursor += parts;
        break;
      }
    }
    if (!merged) return { failedAt: index };
    aligned.push(merged);
  }
  return cursor === recognized.length ? { aligned } : { failedAt: expected.length };
}
