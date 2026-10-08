import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveTodayVideo } from "./resolve-production-date.mjs";

const calendar = JSON.parse(
  fs.readFileSync(new URL("../content/calendar.json", import.meta.url), "utf8"),
);

test("selects the actual video for the calendar date when it exists", () => {
  const result = resolveTodayVideo(calendar, new Date("2026-10-07T08:00:00Z"));
  assert.equal(result.requestedDate, "2026-10-07");
  assert.equal(result.selectedDate, "2026-10-07");
  assert.equal(result.selection, "today");
  assert.equal(result.episodeId, "you-mei-you");
});

test("next scheduled date is selected on an unscheduled day", () => {
  const result = resolveTodayVideo(calendar, new Date("2026-10-08T03:54:00Z"));
  assert.equal(result.requestedDate, "2026-10-08");
  assert.equal(result.selectedDate, "2026-10-09");
  assert.equal(result.episodeId, "zhe-na-ge");
  assert.equal(result.selection, "next-planned");
});

test("use the calendar timezone even when UTC is still the prior date", () => {
  const result = resolveTodayVideo(calendar, new Date("2026-10-07T17:00:00Z"));
  assert.equal(result.requestedDate, "2026-10-08");
  assert.equal(result.selectedDate, "2026-10-09");
});

test("does not silently return an older video after calendar ends", () => {
  assert.throws(
    () => resolveTodayVideo(calendar, new Date("2026-11-01T00:00:00Z")),
    /no upcoming planned video/i,
  );
});

test("does not pick a draft completed or cancelled future slot", () => {
  const list = {
    timezone: "Asia/Shanghai",
    items: [
      { date: "2026-10-09", id: "done", status: "published" },
      { date: "2026-10-11", id: "cancelled", status: "cancelled" },
      { date: "2026-10-12", id: "next", status: "planned" },
    ],
  };
  assert.equal(
    resolveTodayVideo(list, new Date("2026-10-08T03:00:00Z")).selectedDate,
    "2026-10-12",
  );
});

test("does not invent content if all remaining slots are closed", () => {
  assert.throws(
    () => resolveTodayVideo({
      timezone: "Asia/Shanghai",
      items: [{ date: "2026-10-09", id: "published", status: "published" }],
    }, new Date("2026-10-08T03:00:00Z")),
    /no upcoming planned video/i,
  );
});
