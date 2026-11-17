import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { planVideoCover } from "./video-cover.mjs";

const id = "haishi-vs-huozhe-tea-20261113";
const lesson = async prefix => JSON.parse(await fs.readFile(
  new URL(`../content/${prefix}episodes/${id}.json`, import.meta.url),
));

test("the café cover uses the taught contrast, matching pictures and an original panda pose in both languages", async () => {
  const ru = planVideoCover(await lesson(""));
  const tg = planVideoCover(await lesson("locales/tg/"));
  assert.equal(ru.title, "ЧАЙ ИЛИ КОФЕ?");
  assert.match(tg.title, /чой.*қаҳва/iu);
  for (const plan of [ru, tg]) {
    assert.deepEqual(plan.terms, ["还是", "或者"]);
    assert.deepEqual(plan.images.map(src => src.split("/").at(-1)), ["tea-choice.jpg", "coffee-choice.jpg"]);
    assert.equal(plan.pandaMood, "dismissive");
  }
});

test("a promo uses its own art and copy, with no inferred panda or teaching labels", () => {
  assert.deepEqual(planVideoCover({
    id: "sample-promo", kind: "advertisement", title: "Репетиция перед разговором",
    scenes: [
      { kind: "hook", headline: "Internal visual direction", promoVisual: { assetPath: "public/promo-art/sample-promo/cafe.jpg" } },
      { kind: "cta", cards: [{ hanzi: "中文" }] },
    ],
  }), { title: "Репетиция перед разговором", terms: [], images: [], background: "promo-art/sample-promo/cafe.jpg", pandaMood: null });
});
