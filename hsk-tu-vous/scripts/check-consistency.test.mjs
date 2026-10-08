import test from "node:test";
import assert from "node:assert/strict";
import { findDuplicatedValues } from "./check-consistency.mjs";

const settings = {
  voice: {
    voiceName: "Example Voice",
    serviceName: "example.test",
    provider: "example-provider",
    site: "https://example.test/",
    locale: "xx-YY",
  },
  cta: { offer: { canonicalRussian: "Пример призыва к действию." } },
};

test("a reference to a canonical JSON source is allowed", () => {
  assert.deepEqual(
    findDuplicatedValues("Read content/voice-profile.json and content/cta-lab.json", settings),
    [],
  );
});

test("literal duplicate voice and CTA rules are rejected", () => {
  const result = findDuplicatedValues(
    "Voice is Example Voice. CTA: Пример призыва к действию.",
    settings,
  );
  assert.equal(result.length, 2);
  assert.ok(result.some((error) => error.includes("voice.voiceName")));
  assert.ok(result.some((error) => error.includes("cta.offer.canonicalRussian")));
});

test("hard-coded calendar counts are rejected", () => {
  assert.deepEqual(
    findDuplicatedValues("Plan contains 12 episodes.", settings),
    ["hard-coded episode count; read content/calendar.json instead"],
  );
});
