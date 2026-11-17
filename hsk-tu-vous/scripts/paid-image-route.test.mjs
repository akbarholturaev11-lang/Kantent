import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { paidImageRouteAllowed } from "./generate-lesson-art.mjs";

// Owner 2026-11-17: Codex draws frames with its own free image generation; the
// paid image API is only for Claude Code, which cannot generate images itself.
test("the paid image route runs only inside Claude Code, never in a Codex environment", () => {
  assert.deepEqual(paidImageRouteAllowed({ CLAUDECODE: "1" }), { allowed: true });
  for (const env of [{}, { CODEX_SANDBOX: "seatbelt" }, { CLAUDECODE: "1", CODEX_MANAGED_BY_NPM: "1" }, { CLAUDECODE: "0" }]) {
    const route = paidImageRouteAllowed(env);
    assert.equal(route.allowed, false, JSON.stringify(env));
    assert.match(route.reason, /Claude Code only|only inside Claude Code/u);
  }
});

test("the paid branch checks the route before any key or request, and the Codex brief says it is free", () => {
  const source = readFileSync(new URL("./generate-lesson-art.mjs", import.meta.url), "utf8");
  const gate = source.indexOf("const route = paidImageRouteAllowed();");
  assert.ok(gate > 0 && gate < source.indexOf("const apiKey = process.env.OPENROUTER_API_KEY"));
  assert.match(source, /Codex's own image generation — it is free\. Codex never uses the paid image API/u);
  const review = readFileSync(new URL("./review-lesson-art.mjs", import.meta.url), "utf8");
  assert.match(review, /own free image generation \(never the paid --paid API/u);
});
