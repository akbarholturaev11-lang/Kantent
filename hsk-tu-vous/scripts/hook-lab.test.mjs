import assert from "node:assert/strict";
import test from "node:test";
import { createHookReadback } from "./hook-lab.mjs";

test("records YouTube Shorts chose-to-view rate and shown-in-feed count", () => {
  const readback = createHookReadback({
    episode: {
      id: "sample-episode",
      date: "2026-10-01",
      hookExperiment: {
        id: "sample-hook-v1",
        formatId: "scenario",
        hypothesis: "A specific conversation scene will hold more beginners.",
      },
      scenes: [{ durationFrames: 900 }],
    },
    level: "HSK 1",
    topic: "daily conversation",
    platform: "youtube-shorts",
    window: "24h",
    publishedAt: "2026-10-01T00:00:00Z",
    capturedAt: "2026-10-02T00:00:00Z",
    primaryMetric: "chose-to-view-rate",
    views: 400,
    choseToViewRatePercent: 61.5,
    shownInFeed: 650,
    metricDefinition: "YouTube Studio: How many chose to view",
  });

  assert.equal(readback.primaryMetricValue, 61.5);
  assert.equal(readback.choseToViewRatePercent, 61.5);
  assert.equal(readback.shownInFeed, 650);
  assert.equal(readback.durationBand, "30-35s");
});
