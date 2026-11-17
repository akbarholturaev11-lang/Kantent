import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MEANING_COMPARISON_COMPONENTS, MEANING_ICON_KINDS, comparisonRole, meaningCoverage, meaningIcon, objectIn, sentenceMeaning, slideIcon,
} from "./meaning-visual-plan.mjs";

const lexicon = JSON.parse(fs.readFileSync(new URL("../content/meaning-visuals.json", import.meta.url), "utf8"));
const meaning = (hanzi, pinyin = "") => sentenceMeaning({ hanzi, pinyin }, lexicon);

test("the lexicon names only icons, components and cast members the renderer can draw", () => {
  for (const [word, icon] of Object.entries({ ...lexicon.icons, ...lexicon.objects, ...lexicon.times }))
    assert.ok(MEANING_ICON_KINDS.includes(icon), `${word} → ${icon} has no drawing`);
  for (const [word, spec] of Object.entries(lexicon.comparisons)) {
    assert.ok(MEANING_COMPARISON_COMPONENTS.includes(spec.component), word);
    assert.ok(Number.isFinite(spec.more) && Number.isFinite(spec.less) && spec.more !== spec.less, word);
  }
  const cast = JSON.parse(fs.readFileSync(new URL("../content/characters/hsk-ai-characters.json", import.meta.url), "utf8")).characters.map((c) => c.id);
  for (const id of [...Object.values(lexicon.roles), ...Object.values(lexicon.groups).flat()]) assert.ok(cast.includes(id), id + " is not HSK AI cast");
});

test("比: A takes the 'more' value, person pronouns become HSK AI cast, the narration's word lights its part", () => {
  const m = meaning("他比我高。", "Tā bǐ wǒ gāo.");
  assert.equal(m.pattern, "comparison");
  assert.deepEqual([m.component, m.a.hanzi, m.a.cast, m.b.hanzi, m.b.cast], ["height", "他", "crane", "我", "panda"]);
  assert.ok(m.a.value > m.b.value);
  assert.deepEqual(["他", "我", "比", "高", "很"].map((word) => comparisonRole(m, word)), ["a", "b", "sign", "adj", null]);
  const cold = meaning("今天比昨天冷。", "Jīntiān bǐ zuótiān lěng.");
  assert.equal(cold.component, "thermometer");
  assert.ok(cold.a.value < cold.b.value, "colder means a lower temperature");
  assert.equal(meaning("他比我很高。").pattern, "comparison", "the adverb is skipped, the wrong-form stamp is the slide's job");
  assert.equal(meaning("他比我大三岁。").relation, "more", "a stated difference after the adjective");
  const less = meaning("我没有他高。");
  assert.deepEqual([less.relation, less.marker, less.a.hanzi, less.b.hanzi], ["less", "没有", "我", "他"]);
  assert.ok(less.a.value < less.b.value, "没有: A is less ADJ than B");
  assert.equal(comparisonRole(less, "没有"), "sign");
  const same = meaning("我跟他一样高。");
  assert.deepEqual([same.relation, same.a.value === same.b.value], ["equal", true]);
});

test("every lesson pattern is recognised with its parts", () => {
  const cases = {
    "桌子上有一本书。": { pattern: "location", form: "exists", position: "on", count: 1, measure: "本" },
    "那本书在桌子上。": { pattern: "location", form: "placed", position: "on" },
    "你喝茶还是喝咖啡？": { pattern: "choice", kind: "question" },
    "茶或者咖啡都行。": { pattern: "choice", kind: "either" },
    "我会游泳。": { pattern: "modal", modal: "skill" },
    "我今天不能游泳。": { pattern: "modal", modal: "cannot", time: "今天" },
    "我也是学生。": { pattern: "inclusion", kind: "also" },
    "我们都是学生。": { pattern: "inclusion", kind: "all" },
    "我是学生。": { pattern: "inclusion", kind: "identity" },
    "这个有点儿贵。": { pattern: "degree", degreeHanzi: "有点儿", after: false },
    "便宜一点儿，可以吗？": { pattern: "degree", degreeHanzi: "一点儿", after: true },
    "你有几本书？": { pattern: "quantity", question: "几", price: false, measure: "本" },
    "这个多少钱？": { pattern: "quantity", question: "多少", price: true },
    "我想喝水。": { pattern: "want", kind: "want" },
    "你叫什么名字？": { pattern: "question", word: "什么" },
    "桌子上": { pattern: "location", form: "place", position: "on", item: null },
    "茶 / 咖啡": { pattern: "choice", kind: "pair", marker: null },
    "你几点睡觉？": { pattern: "question", word: "几点" },
    "我明天去学校。": { pattern: "action", time: "明天", negated: false, done: false },
    "我不喝咖啡。": { pattern: "action", negated: true },
    "我吃了饭。": { pattern: "action", done: true },
    "这件衣服多少钱？": { pattern: "quantity", price: true, question: "多少" },
    "一杯咖啡十五块。": { pattern: "quantity", price: true, count: 15, measure: "块" },
  };
  for (const [hanzi, expected] of Object.entries(cases)) {
    const m = meaning(hanzi);
    for (const [key, value] of Object.entries(expected)) assert.equal(m?.[key], value, `${hanzi} ${key}`);
  }
  assert.deepEqual(meaning("桌子上有一本书。").item, { hanzi: "书", icon: "book" });
  assert.deepEqual(meaning("你喝茶还是喝咖啡？").options.map((option) => option.icon), ["tea", "coffee"]);
  assert.deepEqual(meaning("我们都是学生。").subject.cast, lexicon.groups["我们"]);
  assert.deepEqual(meaning("这件衣服多少钱？").priced, { hanzi: "衣服", icon: "shirt" }, "the priced thing is shown with its tag");
  assert.equal(meaning("我和朋友一起看电影。").together.hanzi, "朋友", "一起 is not the numeral 一");
  assert.equal(meaning("好的"), null, "no pattern → the slide falls back to the beat's art");
});

test("word icons and objects resolve; coverage reports what falls back to art", () => {
  assert.equal(meaningIcon("很", lexicon), "intensity");
  assert.equal(meaningIcon("书", lexicon), "book");
  assert.deepEqual(objectIn("你喝茶", lexicon), { hanzi: "茶", icon: "tea" }, "the object named last wins");
  const beat = (id, hanzi, layout = "board") => ({ id, visual: { hanzi, illustration: { layout, images: ["x"], label: "比" } } });
  assert.equal(slideIcon("桌子上", lexicon), "on", "a place phrase shows its position");
  assert.equal(slideIcon("他比我高。", lexicon), "height", "a sentence row shows its pattern's lead icon");
  const report = meaningCoverage([{ id: "s", beats: [beat("a", "比"), beat("b", "他比我高。"), beat("c", "护照")] }], lexicon);
  assert.deepEqual(report.covered.map((entry) => entry.visual), ["icon:compare", "comparison:height", "icon:height"],
    "the stacked sentence row is covered by its pattern's icon");
  assert.deepEqual(report.missing.map((entry) => entry.text), ["护照"]);
});
