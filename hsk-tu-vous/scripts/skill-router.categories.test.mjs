import test from "node:test";
import assert from "node:assert/strict";
import { recommendSkills, loadSkillCatalog } from "./skill-router.mjs";

const catalog = loadSkillCatalog();

test("all 36 original skills plus 3 scoped Instagram advisors have one categorized owner", () => {
  const entries = Object.entries(catalog.skills);
  assert.equal(entries.length, 39);
  assert.ok(!catalog.skills["launch-video"], "generic launch skill must not reappear");
  assert.equal(new Set(entries.map(([name]) => name)).size, 39);
  for (const [name, item] of entries) {
    assert.ok(item.category && item.branch && item.route && item.purpose, name);
  }
});

const scenarios = [
  ["dated lesson", "Создай урок HSK 2: иероглифы и субтитры", "remotion", "lesson", ["remotion-best-practices"]],
  ["lesson visual fx", "Сделай эффект перехода для HSK3 дарса", "remotion", "lesson", ["remotion-best-practices"]],
  ["lesson screen layout", "HSK дарс экран жойлашуви ва шрифт", "remotion", "lesson", ["remotion-best-practices"]],
  ["lesson caption sync", "HSK урок субтитры синхронизация", "remotion", "lesson", ["remotion-best-practices"]],
  ["premium promo HSK3.0", "Создай премиум рекламу HSK 3.0 с эффектами", "hyperframes", "premium", ["hyperframes", "product-launch-video", "hyperframes-animation"]],
  ["premium layout", "Создай премиум UI анимацию для рекламы HSK AI", "hyperframes", "premium", ["hyperframes","hyperframes-studio"]],
  ["premium captions", "Create premium HyperFrames promo video with captions", "hyperframes", "premium", ["hyperframes", "hyperframes-studio"]],
  ["premium sound mix", "HyperFrames video audio mix", "hyperframes", "premium", ["hyperframes", "hyperframes-audio"]],
  ["premium motion", "Make advanced HyperFrames animation video", "hyperframes", "premium", ["hyperframes", "hyperframes-animation"]],
  ["special chart", "Create an animated chart video with real results", "standalone", "special", ["animated-chart"]],
  ["special milestone", "Create milestone video for 10k followers", "standalone", "special", ["milestone-reveal"]],
  ["model comparison", "Compare AI models same prompt model comparison video", "standalone", "special", ["model-showdown"]],
  ["newsletter", "Make newsletter promo video", "standalone", "special", ["newsletter-promo"]],
  ["PR feature video", "Make video about GitHub pull request", "hyperframes", "special", ["pr-to-video"]],
  ["gif cover", "Make a looping gif cover", "standalone", "special", ["loop-cover"]],
  ["interactive deck", "Create interactive slideshow", "hyperframes", "special", ["slideshow"]],
  ["music lead", "Make music-to-video from this track", "hyperframes", "special", ["music-to-video"]],
  ["documentary", "Create Vox-style documentary explainer video", "standalone", "special", ["vox-explainer"]],
  ["faceless explainer", "Create faceless explainer video", "hyperframes", "special", ["faceless-explainer"]],
  ["3D opener", "Create 3D intro video", "standalone", "special", ["title-sequence-3d"]],
  ["Apple ad", "Create Apple-style launch film video", "standalone", "special", ["apple-launch-film"]],
  ["owner brand reset", "Brand reset, update existing visual style", "standalone", "special", ["brand-intake"]],
  ["existing captions footage", "Add subtitles to existing talking-head video", "hyperframes", "special", ["embedded-captions"]],
  ["existing graphics footage", "Add graphic overlays over talking-head video", "hyperframes", "special", ["talking-head-recut"]],
  ["standalone motion effect", "Create glitch effect animation", "standalone", "special", ["motion-effects"]],
  ["vertical format", "Convert horizontal 16:9 video to 9:16 Reels version", "postprocess", "special", ["reel-export"]],
  ["basic promo", "Создай обычную рекламу приложения", "remotion", "lesson", ["remotion-best-practices"]],
];

for (const [label, prompt, engine, branch, required] of scenarios) {
  test(label, () => {
    const value = recommendSkills(prompt);
    assert.equal(value.engine, engine, prompt + ": " + JSON.stringify(value));
    assert.equal(value.branch, branch, prompt);
    for (const name of required) {
      assert.ok(value.skills.some((skill) => skill.name === name), label + " missing " + name);
    }
    if (value.engine === "remotion") {
      assert.ok(value.skills.every((skill) => skill.route !== "hyperframes-only"));
      assert.ok(value.selectedStages.every((stage) => stage.branch === "lesson"));
    }
  });
}

test("clear engine change still requires owner approval", () => {
  const result = recommendSkills("Создай HyperFrames рекламу", { existingEngine: "remotion" });
  assert.equal(result.engine, "approval-required");
  assert.equal(result.needsClarification, true);
});

test("explicit HSK lesson through HyperFrames is blocked", () => {
  const result = recommendSkills("Create HSK 4 урок with HyperFrames");
  assert.equal(result.engine, "approval-required");
});

test("recipe owners and stage references follow the requested branch", () => {
  const result = recommendSkills("Сделай HSK урок с эффектами и субтитрами");
  const stages = result.selectedStages;
  assert.ok(stages.some((step) => step.step === "effects" && step.references.includes("rules/effects.md")));
  assert.ok(stages.some((step) => step.step === "captions" && step.references.includes("rules/subtitles.md")));
  for (const step of stages) {
    assert.equal(step.branch, "lesson");
    if (step.owner) assert.notEqual(catalog.skills[step.owner].route, "hyperframes-only");
  }
});

test("Instagram preproduction and social copy/research route to their own stages", () => {
  const input = [
    ["Создай Instagram Reel HSK 2 урок про 来/去", "remotion", "lesson", "ig-reel-planning", "social_hook"],
    ["Напиши Instagram hook варианты для HSK 2", "none", "lesson", "ig-reel-planning", "social_hook"],
    ["Напиши Instagram caption для нового ролика", "none", "special", "ig-caption-quality", "social_caption"],
    ["Instagram конкурентов анализ Reels", "none", "special", "ig-competitor-research", "social_research"],
  ];
  for (const [task, engine, branch, skill, stage] of input) {
    const result = recommendSkills(task);
    assert.equal(result.engine, engine, task);
    assert.equal(result.branch, branch, task);
    assert.ok(result.skills.some((s) => s.name === skill), task);
    assert.ok(result.selectedStages.some((s) => s.step === stage), task);
  }
});

test("the Instagram copy advisor never replaces timed subtitles or exports", () => {
  const subtitle = recommendSkills("Сделай HSK2 урок Instagram Reels с субтитрами");
  assert.equal(subtitle.engine, "remotion");
  assert.ok(subtitle.skills.some((s) => s.name === "remotion-best-practices"));
  assert.ok(!subtitle.skills.some((s) => s.name === "ig-caption-quality"));
  assert.equal(recommendSkills("Добавь субтитры в HSK2 видео").engine, "remotion");
  assert.ok(!recommendSkills("Видео ясаб бер").skills.some((s) => s.category === "social"));
});

test("existing Instagram video edits do not load the Reel planning advisor", () => {
  const result = recommendSkills("Исправь существующий HSK2 Instagram Reel и субтитры", { existingEngine: "remotion" });
  assert.equal(result.engine, "remotion");
  assert.ok(result.skills.some((s) => s.name === "remotion-best-practices"));
  assert.ok(!result.skills.some((s) => s.name === "ig-reel-planning"));
});
