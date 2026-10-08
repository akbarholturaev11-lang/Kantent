import test from "node:test";
import assert from "node:assert/strict";
import { recommendSkills, registeredSkills } from "./skill-router.mjs";

test("canonical skill registry is loaded as routing source", () => {
  const skills = registeredSkills();
  assert.ok(skills.size >= 2);
  assert.equal(skills.get("remotion-best-practices"), "remotion-default");
  assert.equal(skills.get("hyperframes"), "hyperframes-only");
});

const cases = [
  ["Chinese HSK lesson", "Сделай HSK 1 урок: слова, пиньинь, субтитры", "remotion", "remotion-best-practices"],
  ["Uzbek dated lesson", "Бугунги HSK3 дарс видеосини ясаб бер", "remotion", "remotion-best-practices"],
  ["premium brand promo", "Сделай премиум рекламу HSK AI с UI анимацией", "hyperframes", "product-launch-video"],
  ["cinematic commercial", "Create cinematic HSK AI product launch video", "hyperframes", "hyperframes"],
  ["ordinary promo", "Создай обычную рекламу приложения", "remotion", "remotion-best-practices"],
  ["existing Remotion edit", "Исправь существующий Remotion ролик и субтитры", "remotion", "remotion-best-practices"],
  ["Remotion to HyperFrames migration", "Перенеси Remotion в HyperFrames", "approval-required", "remotion-to-hyperframes"],
  ["explicit independent HyperFrames promo", "Build HyperFrames product launch video", "hyperframes", "product-launch-video"],
  ["vertical export", "Export 16:9 to 9:16 Reels version", "postprocess", "reel-export"],
  ["voice policy question", "Овоз профилини ўзгартириш ҳақида савол", "none", null],
  ["undetermined general video", "Видео ясаб бер", "clarify", null],
  ["HyperFrames HSK lesson guard", "Сделай HSK2 урок через HyperFrames", "approval-required", null],
];

for (const [label, task, engine, requiredSkill] of cases) {
  test(label, () => {
    const result = recommendSkills(task);
    assert.equal(result.engine, engine, task + " :: " + JSON.stringify(result));
    if (requiredSkill) assert.ok(result.skills.some((s) => s.name === requiredSkill));
    if (engine === "remotion") {
      assert.ok(result.skills.every((s) => s.route !== "hyperframes-only"));
    }
  });
}

test("explicit HyperFrames for existing Remotion requires approval", () => {
  const result = recommendSkills("Create cinematic HyperFrames promo", { existingEngine: "remotion" });
  assert.equal(result.engine, "approval-required");
  assert.equal(result.needsClarification, true);
});

test("every returned skill has an actual registered entry", () => {
  for (const task of cases.map((x) => x[1])) {
    for (const skill of recommendSkills(task).skills) {
      assert.equal(typeof skill.instructions, "string");
      assert.ok(registeredSkills().has(skill.name));
    }
  }
});
