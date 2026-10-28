import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVED_PUBLICATION_PLATFORMS,
  publicationScheduledFor,
  validatePublicationSchedule,
  validatePublicationTarget,
} from "./publication-policy.mjs";

const instagram = {
  platform: "instagram",
  accountId: "ig-account",
  accountName: "HSK AI Instagram",
  caption: "Instagram caption",
  instagramSettings: { shareToFeed: true, isAiGenerated: false },
};

const youtube = {
  platform: "youtube",
  accountId: "yt-account",
  accountName: "HSK AI YouTube",
  caption: "YouTube description",
  youtubeSettings: {
    title: "HSK AI Chinese lesson",
    visibility: "public",
    madeForKids: false,
    containsSyntheticMedia: false,
  },
};

const facebook = {
  platform: "facebook",
  accountId: "fb-account",
  accountName: "Akbarholturaev",
  caption: "Facebook caption",
};

const clock = Date.parse("2026-10-23T00:00:00Z");
const igTime = "2026-10-24T20:00:00+08:00";
const ytTime = "2026-10-24T10:00:00+08:00";

test("separate account schedules preserve the exact approved instants", () => {
  const intent = { mode: "scheduled", platforms: [
    { ...instagram, scheduledFor: igTime },
    { ...youtube, scheduledFor: ytTime },
  ] };
  assert.deepEqual(validatePublicationSchedule(intent, clock), []);
  assert.equal(publicationScheduledFor(intent, "instagram"), igTime);
  assert.equal(publicationScheduledFor(intent, "youtube"), ytTime);
  assert.notEqual(Date.parse(publicationScheduledFor(intent, "instagram")), Date.parse(ytTime));
});

test("legacy shared schedules and explicit per-account overrides remain compatible", () => {
  const intent = { mode: "scheduled", scheduledFor: igTime, platforms: [instagram, youtube] };
  assert.deepEqual(validatePublicationSchedule(intent, clock), []);
  assert.equal(publicationScheduledFor(intent, "youtube"), igTime);
  intent.platforms = [instagram, { ...youtube, scheduledFor: ytTime }];
  assert.deepEqual(validatePublicationSchedule(intent, clock), []);
  assert.equal(publicationScheduledFor(intent, "youtube"), ytTime);
});

test("one missing or invalid account schedule blocks the whole preview", () => {
  for (const time of [undefined, "2026-10-24T10:00:00", "invalid", null, "2026-10-22T10:00:00Z"]) {
    assert.ok(validatePublicationSchedule({ mode: "scheduled", platforms: [
      { ...instagram, scheduledFor: igTime }, { ...youtube, scheduledFor: time },
    ] }, clock).length > 0);
  }
});

test("publish-now cannot carry a schedule at either level", () => {
  assert.deepEqual(validatePublicationSchedule({ mode: "now", platforms: [instagram] }, clock), []);
  assert.ok(validatePublicationSchedule({ mode: "now", scheduledFor: igTime, platforms: [instagram] }, clock).length);
  assert.ok(validatePublicationSchedule({ mode: "now", platforms: [{ ...youtube, scheduledFor: ytTime }] }, clock).length);
});

test("all language-mapped video destinations are authorized while Telegram stays excluded", () => {
  assert.deepEqual(APPROVED_PUBLICATION_PLATFORMS, ["instagram", "youtube", "tiktok", "facebook"]);
  assert.deepEqual(validatePublicationTarget(instagram), []);
  assert.deepEqual(validatePublicationTarget(youtube), []);
  assert.deepEqual(validatePublicationTarget(facebook), []);
  assert.ok(validatePublicationTarget({ ...instagram, platform: "telegram" })
    .some((error) => error.includes("not an authorized video destination")));
  assert.ok(validatePublicationTarget({ ...instagram, platform: "tiktok" })
    .some((error) => error.includes("TikTok preview must include")));
});

test("YouTube preview requires its title, visibility, audience and synthetic-media choices", () => {
  const { youtubeSettings: _settings, ...missing } = youtube;
  assert.equal(validatePublicationTarget(missing).length, 4);
  for (const title of ["", "a".repeat(101)])
    assert.ok(validatePublicationTarget({
      ...youtube,
      youtubeSettings: { ...youtube.youtubeSettings, title },
    }).some((error) => error.includes("title of 1–100 characters")));
  for (const value of [null, "public", 1])
    assert.ok(validatePublicationTarget({
      ...youtube,
      youtubeSettings: { ...youtube.youtubeSettings, madeForKids: value },
    }).some((error) => error.includes("made-for-kids")));
  assert.ok(validatePublicationTarget({
    ...youtube,
    youtubeSettings: { ...youtube.youtubeSettings, visibility: "friends" },
  }).some((error) => error.includes("visibility")));
  assert.ok(validatePublicationTarget({
    ...youtube,
    youtubeSettings: { ...youtube.youtubeSettings, containsSyntheticMedia: null },
  }).some((error) => error.includes("synthetic-media")));
});
