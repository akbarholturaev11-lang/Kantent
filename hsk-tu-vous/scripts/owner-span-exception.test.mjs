import test from "node:test";
import assert from "node:assert/strict";
import { ownerSpanException, validateOwnerSpanExceptions } from "./owner-span-exception.mjs";

const SHA = "a".repeat(64);
const record = validateOwnerSpanExceptions({
  approvedBy: "owner", approvedAt: "2026-11-16", ownerWords: "коидани узгартирма факат шу 2 сига куз юм утказ",
  exceptions: [
    { chunk: 1, audioSha256: SHA, startMs: 16700, endMs: 17400, expected: "баъд", timing: "provider-heard", heard: "бад" },
    { chunk: 1, audioSha256: SHA, startMs: 23275, endMs: 23775, expected: "比", timing: "measured-gap" },
  ],
});

test("provider-heard uses the provider's own timed word, shown as the narration word", () => {
  const result = ownerSpanException({ record, chunk: 1, audioSha256: SHA,
    gap: { startMs: 16700, endMs: 17400, tokens: ["баъд"] },
    gapBlocks: [{ text: "Бад", startMs: 16900, endMs: 17000 }, { text: "бад,", startMs: 16900, endMs: 17200 }] });
  assert.deepEqual(result.block, { text: "баъд", tokens: ["баъд"], startMs: 16900, endMs: 17200, ownerException: "provider-heard" });
  assert.equal(result.applied.heard, "бад");
});

test("measured-gap uses only the verified neighbours' provider edges", () => {
  const result = ownerSpanException({ record, chunk: 1, audioSha256: SHA,
    gap: { startMs: 23275, endMs: 23775, tokens: ["比"] } });
  assert.deepEqual([result.block.startMs, result.block.endMs, result.block.text], [23275, 23775, "比"]);
});

test("nothing applies to another take, span, word, chunk or a multi-word gap", () => {
  const gap = { startMs: 23275, endMs: 23775, tokens: ["比"] };
  assert.equal(ownerSpanException({ record, chunk: 1, audioSha256: "b".repeat(64), gap }), null);
  assert.equal(ownerSpanException({ record, chunk: 2, audioSha256: SHA, gap }), null);
  assert.equal(ownerSpanException({ record, chunk: 1, audioSha256: SHA, gap: { ...gap, startMs: 23200 } }), null);
  assert.equal(ownerSpanException({ record, chunk: 1, audioSha256: SHA, gap: { ...gap, tokens: ["很"] } }), null);
  assert.equal(ownerSpanException({ record, chunk: 1, audioSha256: SHA, gap: { ...gap, tokens: ["比", "很"] } }), null);
  assert.equal(ownerSpanException({ record: null, chunk: 1, audioSha256: SHA, gap }), null);
});

test("provider-heard never invents timing when the named spelling was not heard in the gap", () => {
  const gap = { startMs: 16700, endMs: 17400, tokens: ["баъд"] };
  assert.equal(ownerSpanException({ record, chunk: 1, audioSha256: SHA, gap, gapBlocks: [] }), null);
  assert.equal(ownerSpanException({ record, chunk: 1, audioSha256: SHA, gap,
    gapBlocks: [{ text: "бад", startMs: 18000, endMs: 18100 }, { text: "бас", startMs: 16900, endMs: 17000 }] }), null);
});

test("the file must carry the owner's approval and exact bindings", () => {
  assert.throws(() => validateOwnerSpanExceptions({ ...record, approvedBy: "agent" }), /approvedBy=owner/);
  assert.throws(() => validateOwnerSpanExceptions({ ...record, ownerWords: "" }), /owner's words/);
  for (const bad of [{ audioSha256: "x" }, { expected: "с 比" }, { timing: "estimated" }, { timing: "provider-heard", heard: "" }])
    assert.throws(() => validateOwnerSpanExceptions({ ...record, exceptions: [{ ...record.exceptions[1], ...bad }] }), /Invalid owner span/);
});

test("provider-heard-span (owner 2026-11-17): a listened multi-word gap keeps the provider's own first/last word edges", () => {
  const span = validateOwnerSpanExceptions({ approvedBy: "owner", approvedAt: "2026-11-17", ownerWords: "тугри 2 ласихам",
    exceptions: [{ chunk: 1, audioSha256: SHA, startMs: 24317, endMs: 26917, expected: "这 个 多 少 钱",
      timing: "provider-heard-span", heard: "Этот сколько денег" }] });
  const gap = { startMs: 24317, endMs: 26917, tokens: ["这", "个", "多", "少", "钱"] };
  const blocks = [{ text: "так.", startMs: 24000, endMs: 24300 }, { text: "Этот", startMs: 24500, endMs: 24800 },
    { text: "сколько", startMs: 24900, endMs: 25600 }, { text: "денег?", startMs: 25700, endMs: 26400 },
    { text: "Этот", startMs: 24450, endMs: 24790 }];
  const result = ownerSpanException({ record: span, chunk: 1, audioSha256: SHA, gap, gapBlocks: blocks });
  assert.deepEqual(result.block, { text: "这个多少钱", tokens: ["这", "个", "多", "少", "钱"], startMs: 24450, endMs: 26400,
    ownerException: "provider-heard-span" });
  // a heard word missing from the gap → no timing is invented
  assert.equal(ownerSpanException({ record: span, chunk: 1, audioSha256: SHA, gap, gapBlocks: blocks.slice(0, 3) }), null);
  // different words in the gap → no match
  assert.equal(ownerSpanException({ record: span, chunk: 1, audioSha256: SHA, gap: { ...gap, tokens: ["多", "少"] }, gapBlocks: blocks }), null);
  assert.throws(() => validateOwnerSpanExceptions({ ...span, exceptions: [{ ...span.exceptions[0], heard: "" }] }), /Invalid owner span/);
});
