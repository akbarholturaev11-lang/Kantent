import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  alignSpokenTokens, buildHanziReadings, collectHanziPinyinPairs, createSpokenMatcher,
  foldLocaleToken, pinyinCyrillicCandidates,
} from "./spoken-token-match.mjs";

const words = (text, locale) => (text.match(/[\p{L}\p{N}]+/gu) ?? []).flatMap((word) =>
  /^\p{Script=Han}+$/u.test(word) ? Array.from(word) : [word.toLocaleLowerCase("und")]);
const ms = (value) => Math.round(Number.parseFloat(value) * 1000);
// Real Gemini Transcribe response, TG chunk 1, 2026-11-08 bi-comparison take.
const REAL_TG_STT = [["У","0.400s","0.500s"],["аз","0.500s","0.600s"],["ман","0.600s","1.200s"],["қад","1.200s","1.300s"],["баландтар","1.300s","1.900s"],["аст.","1.900s","2.400s"],["Ба","2.500s","2.600s"],["чини","2.600s","3s"],["чи","3s","3.100s"],["мегӯӣ?","3.100s","3.700s"],["Бо","4s","4.500s"],["би","4.500s","5s"],["ё","5.300s","5.500s"],["бо","5.500s","6s"],["ҳен?","6.100s","6.400s"],["Ду","7.100s","7.200s"],["одам","7.200s","7.500s"],["ро","7.500s","7.600s"],["муқоиса","7.600s","8.200s"],["кун.","8.200s","8.400s"]];
const TG_CHUNK_1 = "Ӯ аз ман қадбаландтар аст. Ба чинӣ чӣ мегӯӣ: бо 比 ё бо 很? Ду одамро муқоиса кун.";
const recognizedFrom = (rows) => rows.flatMap(([text, start, end]) =>
  words(text, "tg-TJ").map((token) => ({ text: token, startMs: ms(start), endMs: ms(end) })));
const expectedFrom = (text, locale) => words(text, locale).map((token) => ({ text: token }));

const corpusReadings = () => {
  const pairs = [];
  for (const dir of ["content/episodes", "content/locales/tg/episodes"])
    for (const file of fs.readdirSync(new URL("../" + dir, import.meta.url)))
      if (file.endsWith(".json"))
        collectHanziPinyinPairs(JSON.parse(fs.readFileSync(new URL(`../${dir}/${file}`, import.meta.url), "utf8")), pairs);
  return buildHanziReadings(pairs);
};

test("real TG take: correct speech with ASR spelling variants now aligns, captions keep the source", () => {
  const readings = corpusReadings();
  assert.deepEqual([...readings.get("比")], ["bi"]);
  assert.ok(readings.get("很").has("hen"), "很 is verified by 我很好 | Wǒ hěn hǎo");
  const match = createSpokenMatcher({ locale: "tg-TJ", readings });
  const expected = expectedFrom(TG_CHUNK_1, "tg-TJ");
  const recognized = recognizedFrom(REAL_TG_STT);
  assert.equal(expected.length, 18);
  assert.equal(recognized.length, 20);
  const result = alignSpokenTokens(expected, recognized, match);
  assert.ok(result.aligned, "aligned");
  assert.equal(result.aligned.length, expected.length);
  const compound = result.aligned[3];
  assert.deepEqual([compound.text, compound.startMs, compound.endMs, compound.mergedParts], ["қадбаландтар", 1200, 1900, 2]);
  assert.deepEqual([result.aligned[10].text, result.aligned[13].text], ["би", "ҳен"], "Hanzi matched by verified reading");
  assert.equal(result.aligned[15].text, "одамро");
});

test("the gate still rejects different words, wrong readings and unverified Hanzi", () => {
  const readings = buildHanziReadings([{ hanzi: "比", pinyin: "bǐ" }, { hanzi: "我很好", pinyin: "Wǒ hěn hǎo" }]);
  const match = createSpokenMatcher({ locale: "tg-TJ", readings });
  assert.equal(match("比", "хен"), false);
  assert.equal(match("很", "би"), false);
  assert.equal(match("冷", "лэн"), false, "no verified reading for 冷 → strict");
  assert.equal(match("чӣ", "чи"), true);
  assert.equal(match("чӣ", "чо"), false);
  assert.equal(match("ҳамин", "хамин"), false, "only long-vowel marks fold, not ҳ/х in Tajik words");
  assert.equal(match("比", "bi"), true, "toneless pinyin output is the same syllable");
  // A dropped word cannot be hidden by merging the next one.
  const expected = expectedFrom("Ду одамро муқоиса кун", "tg-TJ");
  const recognized = recognizedFrom([["Ду","0s","0.1s"],["одам","0.1s","0.3s"],["муқоиса","0.3s","0.8s"],["кун","0.8s","1s"]]);
  assert.deepEqual(alignSpokenTokens(expected, recognized, match), { failedAt: 1 });
  // Extra recognized speech is a mismatch too.
  const extra = recognizedFrom([["Ду","0s","0.1s"],["одамро","0.1s","0.3s"],["муқоиса","0.3s","0.8s"],["кун","0.8s","1s"],["рафт","1s","1.2s"]]);
  assert.deepEqual(alignSpokenTokens(expected, extra, match), { failedAt: 4 });
});

test("Palladius candidates cover the project's existing hand aliases", () => {
  const has = (pinyin, cyrillic) => pinyinCyrillicCandidates(pinyin).has(cyrillic.replace(/ь/g, "").replace(/э/g, "е"));
  for (const [pinyin, cyrillic] of [["zài", "цзай"], ["jiā", "цзя"], ["wǒ", "во"], ["xiǎng", "сян"], ["hē", "хэ"],
    ["chá", "ча"], ["yào", "яо"], ["yī", "и"], ["bēi", "бэй"], ["shuǐ", "шуй"], ["èr", "эр"], ["liǎng", "лян"],
    ["shí", "ши"], ["dì", "ди"], ["xué", "сюэ"], ["xiào", "сяо"], ["zì", "цзы"], ["rì", "жи"], ["guó", "го"],
    ["huì", "хуэй"], ["qù", "цюй"], ["nǚ", "нюй"], ["lüè", "люэ"], ["hěn", "хэнь"], ["zhōng", "чжун"]])
    assert.ok(has(pinyin, cyrillic), pinyin + " → " + cyrillic);
  assert.equal(pinyinCyrillicCandidates("xyz").size, 0);
});

test("readings come only from count-matched author pairs", () => {
  const readings = buildHanziReadings([
    { hanzi: "今天比昨天冷。", pinyin: "Jīntiān bǐ zuótiān lěng." },
    { hanzi: "他比我高。", pinyin: "Tā bǐ wǒ gāo." },
  ]);
  assert.equal(readings.has("冷"), false, "4 written words for 6 characters: skipped, never guessed");
  assert.deepEqual(Object.fromEntries([...readings].map(([k, v]) => [k, [...v]])), { 他: ["ta"], 比: ["bi"], 我: ["wo"], 高: ["gao"] });
  assert.equal(foldLocaleToken("Ещё", "ru-RU"), "еще");
});

test("real RU one-take probe: letter names, B for 比 and a joined word, still strict otherwise", () => {
  const readings = buildHanziReadings([{ hanzi: "他比我高", pinyin: "Tā bǐ wǒ gāo" }, { hanzi: "很", pinyin: "hěn" }]);
  const match = createSpokenMatcher({ locale: "ru-RU", readings });
  // 2026-11-08 Gemini Transcribe of the isolated 0.6 s "比" clip, both providers: "B".
  assert.equal(match("比", "B"), true);
  assert.equal(match("很", "B"), false, "B is bi, never hen");
  assert.equal(match("比", "D"), false);
  assert.equal(match("冷", "B"), false, "no verified reading → strict");
  // Window 5 (ru-RU hint): "A би би плюс признак" for "A 比 B плюс признак".
  const expected = ["a", "比", "b", "плюс", "признак"].map((text) => ({ text }));
  const heard = ["A", "би", "би", "плюс", "признак"].map((text, i) => ({ text: text.toLocaleLowerCase("und"), startMs: i * 100, endMs: i * 100 + 90 }));
  assert.equal(alignSpokenTokens(expected, heard, match).aligned.length, 5);
  assert.equal(match("a", "а"), true, "Cyrillic homoglyph of the variable A");
  assert.equal(match("b", "в"), false, "В is a different letter");
  // Gap 6: "Тоже" for "то же" — both written words get the one measured span.
  const joined = alignSpokenTokens([{ text: "то" }, { text: "же" }, { text: "правило" }],
    [{ text: "тоже", startMs: 0, endMs: 300 }, { text: "правило", startMs: 300, endMs: 700 }], match);
  assert.deepEqual(joined.aligned.map((w) => [w.text, w.startMs, w.endMs]), [["тоже", 0, 300], ["тоже", 0, 300], ["правило", 300, 700]]);
  assert.deepEqual(alignSpokenTokens([{ text: "то" }, { text: "же" }], [{ text: "тожи", startMs: 0, endMs: 300 }], match), { failedAt: 0 });
});
