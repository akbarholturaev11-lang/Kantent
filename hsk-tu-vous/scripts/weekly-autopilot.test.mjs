import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scheduledFor, nextWeekStart, packageDir, postJson, voiceFallbackReady } from "./weekly-autopilot.mjs";

test("scheduledFor converts audience local time into the +08:00 calendar zone", () => {
  assert.equal(scheduledFor("2026-11-23", { localTime: "16:00", timezone: "Europe/Moscow" }), "2026-11-23T21:00:00+08:00");
  assert.equal(scheduledFor("2026-11-23", { localTime: "16:00", timezone: "Asia/Dushanbe" }), "2026-11-23T19:00:00+08:00");
  assert.equal(scheduledFor("2026-11-23", { localTime: "23:30", timezone: "Europe/Moscow" }), "2026-11-24T04:30:00+08:00");
});

test("nextWeekStart returns the following Monday, even from a Monday or Sunday", () => {
  assert.equal(nextWeekStart("2026-11-22"), "2026-11-23");
  assert.equal(nextWeekStart("2026-11-23"), "2026-11-30");
  assert.equal(nextWeekStart("2026-11-17"), "2026-11-23");
});

test("packageDir maps language and platform folders", () => {
  assert.equal(packageDir("/r", "x", "ru", "instagram"), path.join("/r", "review", "x"));
  assert.equal(packageDir("/r", "x", "tg", "youtube"), path.join("/r", "review", "x", "tg", "youtube"));
});

test("postJson strips the metadata footer and sets platform settings", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "autopilot-"));
  const write = (rel, data) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), typeof data === "string" ? data : JSON.stringify(data)); };
  write("content/calendar.json", { items: [{ id: "ep", date: "2026-11-23", topic: "T" }] });
  write("content/weekly-autopilot.json", { publishTimes: { default: { tg: { localTime: "16:00", timezone: "Asia/Dushanbe" } } } });
  write("review/ep/tg/youtube/post.md", "Caption line\n#hsk\n\nМавзӯъ: meta");
  write("review/ep/tg/youtube/episode.json", { title: "Ю".repeat(150) });
  write("review/ep/tg/tiktok/post.md", "Other\n\nМавзӯъ: x");
  write("review/ep/tg/tiktok/episode.json", {});
  const yt = postJson({ root, date: "2026-11-23", language: "tg", platform: "youtube" });
  assert.equal(yt.content, "Caption line\n#hsk");
  assert.equal(yt.title.length, 100);
  assert.equal(yt.containsSyntheticMedia, true);
  assert.equal(yt.scheduledFor, "2026-11-23T19:00:00+08:00");
  const tt = postJson({ root, date: "2026-11-23", language: "tg", platform: "tiktok" });
  assert.equal(tt.tiktokSettings.video_made_with_ai, true);
  assert.throws(() => postJson({ root, date: "2026-11-24", language: "tg", platform: "tiktok" }), /no calendar item/);
});

test("voiceFallbackReady reads flag and key presence from env or .env.local", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "autopilot-env-"));
  assert.deepEqual(voiceFallbackReady(root, {}), { fallbackEnabled: false, openRouterKey: false });
  fs.writeFileSync(path.join(root, ".env.local"), "HSK_AI_OPENROUTER_FALLBACK_ENABLED=true\nOPENROUTER_API_KEY=x\n");
  assert.deepEqual(voiceFallbackReady(root, {}), { fallbackEnabled: true, openRouterKey: true });
  assert.deepEqual(voiceFallbackReady(fs.mkdtempSync(path.join(os.tmpdir(), "e-")), { HSK_AI_OPENROUTER_FALLBACK_ENABLED: "false", OPENROUTER_API_KEY: "k" }),
    { fallbackEnabled: false, openRouterKey: true });
});
