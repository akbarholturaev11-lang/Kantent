import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVED_PUBLICATION_PLATFORMS,
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

test("only Instagram Reels and YouTube Shorts are authorized publication targets", () => {
  assert.deepEqual(APPROVED_PUBLICATION_PLATFORMS, ["instagram", "youtube"]);
  assert.deepEqual(validatePublicationTarget(instagram), []);
  assert.deepEqual(validatePublicationTarget(youtube), []);
  assert.ok(validatePublicationTarget({ ...instagram, platform: "tiktok" })
    .some((error) => error.includes("Only Instagram Reels and YouTube Shorts")));
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
