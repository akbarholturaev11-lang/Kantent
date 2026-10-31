import test from "node:test";
import assert from "node:assert/strict";
import { createContinuousTtsChunks, MAX_CONTINUOUS_TTS_CHARACTERS } from "./continuous-tts-plan.mjs";

test("RU bilingual Chinese lesson produces one uninterrupted take", () => {
  const episode = { scenes: [
    {id:"hook", narration:"Представьте: рынок. 这个有点儿贵。"},
    {id:"example", narration:"便宜一点儿，可以吗？"},
    {id:"recap", narration:"Повторите: 有点儿贵."},
  ]};
  const expectedNarration = episode.scenes.map(s=>s.narration).join(" ");
  assert.deepEqual(createContinuousTtsChunks(episode,{expectedNarration}), [{
    text:expectedNarration,sceneIds:["hook","example","recap"],
  }]);
});
test("TG Mandarin switching preserves exact Chinese content and whitespace contract", () => {
  const episode={scenes:[
    {id:"hook",narration:"Дар бозор   这个有点儿贵。"},
    {id:"response",narration:"  Камтар? 便宜一点儿，可以吗？  "},
  ]};
  const expectedNarration="Дар бозор 这个有点儿贵。 Камтар? 便宜一点儿，可以吗？";
  assert.equal(createContinuousTtsChunks(episode,{expectedNarration})[0].text,expectedNarration);
});
test("TikTok CTA is exactly one independent continuous take", () => {
  const episode={scenes:[{id:"cta",narration:"Напиши HSK, и я пришлю ссылку."}]};
  assert.deepEqual(createContinuousTtsChunks(episode),[{
    text:"Напиши HSK, и я пришлю ссылку.",sceneIds:["cta"],
  }]);
});
test("long narration fails closed rather than silently creating extra TTS calls", () => {
  const episode={scenes:[{id:"hook",narration:"а".repeat(MAX_CONTINUOUS_TTS_CHARACTERS+1)}]};
  assert.throws(()=>createContinuousTtsChunks(episode),/refusing silent scene fallback/);
});
test("incomplete scenes and reused IDs never reach paid TTS", () => {
  assert.throws(()=>createContinuousTtsChunks({scenes:[]}),/at least one/);
  assert.throws(()=>createContinuousTtsChunks({scenes:[{id:"a",narration:"x"},{id:"a",narration:"y"}]}),/repeated/);
  assert.throws(()=>createContinuousTtsChunks({scenes:[{id:"a",narration:"  "}]}),/nonempty/);
});
test("unexpected narration changes abort before API billing", () => {
  const episode={scenes:[{id:"hook",narration:"Я здесь."}]};
  assert.throws(()=>createContinuousTtsChunks(episode,{expectedNarration:"Я там."}),/differs/);
});
