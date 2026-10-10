# Episode and review schema

The calendar is the index. Each calendar item points to one CTA-free planned JSON lesson in `content/episodes/` for new dates. CTA text and cue-synced visuals live **only** in the canonical CTA Lab. The assembly of an active *review copy* happens in `scripts/episode-cta-assembly.mjs` when the agent opens or creates the dated production plan. Older historical source files may retain previously registered CTA snapshots; do not rewrite published or approved history.

## Cinematic storyboard treatment (optional)

Unapproved future *lesson* scenes may opt in through `scene.storyboard = {formatId, setting, character, mood, sign?}`. Allowed `formatId` values are owned by `content/creative-formats.json`, not by CTA Lab. `setting` supports `street`, `cafe`, `campus`, `home`; `character` supports `student`, `shopkeeper`; and `mood` supports `question`, `mistake`, `answer`, `practice`. For `speed-quiz`, include 2–3 short `options`. Only source-supported or harmless general context labels are allowed. The 12 October `zai-location` episode is the first visual-only pilot; its existing narrator text, hook experiment and approved voice provider must stay unchanged.

The Remotion renderer uses `CinematicStoryScene` only when `scene.storyboard` is set. Otherwise the existing visual stays unchanged; CTA never accepts storyboard and is always taken from the central CTA Lab. The style does **not** create real footage, a verified real location, a valid TTS export, or publication approval. Preview frames can be tested independently; production MP4 still requires approved MP3 and timed word cues, language-source checks, and exact publication preview review.

## Canonical episode record

- `id`, `date`, `timezone`, `languageCode`: identity; ISO date and Asia/Shanghai.
- `voiceProvider`, `voiceProfileId`: production provider key and the one fixed profile in voice-profile.json.
- `title`, `level`, `topic`, `durationTargetSec`, `caption`, `hashtags`, `cta`: packaging and learning context. **`cta` is an immutable-per-registration draft/render snapshot** resolved from the central `content/cta-lab.json`, NOT a second editable CTA policy. `audienceProblem` names one concrete beginner pain point; `learningOutcome` states the single useful result the viewer should get from the lesson.
- `learningFacts`, `examples`: the intended lesson point and Chinese examples. These are planning notes until checked.
- `learningFactSources`: evidence receipts, one per source: `{ title, url, checkedAt, supports }`. `checkedAt` is YYYY-MM-DD and `supports` names the specific fact(s) the source supports. Empty means language-source review has not been recorded.
- `hookExperiment`: required preregistration `{ id, formatId, hypothesis, primaryMetric, fallbackMetric, registeredAt }`. `formatId` is `question`, `contrast`, or `scenario`; metrics are `three-second-hold-rate`, `average-watch-ratio`, or YouTube Shorts’ `chose-to-view-rate`. Register the hypothesis before publishing so results are not explained after the fact.
- `ctaExperiment`: required immutable registration metadata after a CTA edit: `{ id, formatId, ruleVersion, offerId, keyword, hypothesis, changedVariable, comparisonGroupId, registeredAt, copyHash, acknowledgedCorrectionIds }`. `content/cta-lab.json` is the separate source of mandatory owner corrections and CTA learning; read it in every chat before CTA work. Each registration snapshots CTA wording, visual beats/transitions/placement, and current lesson, hook, and voice context. A script, visual, context, or placement change requires a new CTA version before voice preparation or render.
- `scenes[]`: ordered scene records with `id`, `kind`, `headline`, `narration`, optional concise `screenCaption`, `captionStyleId`, `editPlan`, optional `durationSec`/`durationFrames`, `visualBeats[]`, and Chinese `cards[]`. Scene edit directions must follow `content/EDITING_SPEC.md`; screenCaption is a scene label/takeaway, not a duplicate transcript. Imported review scenes also carry audio-aligned `startMs`/`endMs`.
- A visual beat may declare `visualFocus` (`friend`, `teacher`, `elder`, `shopkeeper`, `group`, `single-person`, `book`, `person-with-book`, `coffee`, `empty-cup`, `apple-near`, `apple-far`, or `apple-pair`) and `syncCueText` to switch a matching contextual illustration when that spoken word starts. Use only visuals supported by that scene's Russian narration. CTA beats may also use `actionIcon` (`comment`, `app-download`, `direct-message`) and `transitionStyle` (`type-reveal`, `slide-match`, `mask-reveal`) inside the same central stage; keep them matched to the exact spoken word.
- Screenshot `screenHighlight` percentages refer to the intrinsic screenshot dimensions (`screenImageWidthPx` / `screenImageHeightPx`). The overlay follows the same contained image aspect ratio, including letterboxing; it must not target percentages of the surrounding padded card.
- Caption style IDs are `headline`, `pill`, or `highlight`. Choose two or three styles per episode, one style at a time per scene; default styles depend on scene kind.
- `captions[]`: timed cue records `{ text, startMs, endMs, timestampMs, confidence }`, imported from word-level VTT/SRT.
- `captionSource`: only `pending-tts-export`, `online-tts-srt`, or `online-tts-vtt` is used by production.
- `audioSrc`, `voiceTextHash`, `voiceProfileId`: identify the imported audio and exact narration/profile version it belongs to. If narration changes, remove the hash/audio/captions and import a fresh pair.
- `audioTrimAfterFrames`, when present on an imported review episode, is Remotion's absolute source-frame endpoint (`Audio.trimAfter`), not a count of frames to remove from the tail. The importer sets it after the last timed word plus a short natural pause.
- `publishingStatus`: records pending confirmation, owner-approved Zernio publication, or the per-version outcome (`published`, `scheduled`, `processing`, `partial`, or `failed`).

## Platform CTA variants

For new lesson plans, omit top-level `cta`, `ctaExperiment` and the CTA scene. `scripts/episode-cta-assembly.mjs` can join a selected approved CTA ending to the shared lesson scenes; the normal production loader currently defaults to Instagram. Instagram and YouTube read the same canonical wording through `offer.canonicalRussian`; YouTube replaces only the two supplied screenshot frames in the final CTA scene. This is one shared lesson, not separately authored/generated lesson videos.

TikTok is not an authorized publishing destination. The normal make/render/MCP flow automatically creates a YouTube package from the shared working lesson and its approved ending. The shared lesson frames are rendered once; continuous audio is reused in both final exports. YouTube publishing is authorized after exact-preview approval. Each YouTube preview must capture title, visibility, made-for-kids selection, and synthetic-media disclosure. `scripts/platform-cta.mjs` prepares the selected CTA ending; `scripts/platform-exports.mjs` verifies the identical shared lesson/narration/timing and binds a matching immutable registration. A derived baseline inherits only the base’s explicitly acknowledged current corrections. Changed narration or an unacknowledged correction blocks automatic reuse. A visual-only CTA change still needs its own immutable CTA registration and final render/review; when spoken text and cue timing are unchanged, reuse the shared voice and word-level captions. No unapproved draft may render. Do not rewrite legacy approved or published snapshots.

## Hook measurement record

- `content/hook-lab.json` stores the initial comparison rules and owner-entered 24h/7d platform analytics snapshots. YouTube’s `chose-to-view-rate` readback uses the dashboard’s “How many chose to view” percentage.
- Readbacks are grouped by hook version, platform, time window, and the same primary metric. Do not compare platform totals as if their view definitions were identical.
- The 28 September package is a baseline candidate and has no platform result until the owner posts it and enters dashboard metrics.
- Hook rules are recommendations until enough comparable readbacks exist and the owner chooses to promote a pattern.

## Review package

Each date writes to review/<id>/:

- `episode.json` — mutable working copy of the canonical scenario.
- `tts-input.txt`, `incoming/` — exact narration text and source MP3 plus word-level captions downloaded by the agent from the approved speech site.
- `video.mp4` — 1080×1920 Remotion export with captions burned in.
- `captions.srt` — sidecar made from the same timed cues.
- `post.md` — Russian post copy and CTA.
- `status.json` — current package stage, duration, voice profile, subtitle source and `platformPackages` map. Each platform entry stores exact episode/video/SRT/post paths, `baseContentHash`, platform `contentHash`, `videoSha256`, `ctaExperimentId`, `ctaCopyHash` and `ctaRuleVersion`.
- `youtube/episode.json`, `youtube/video.mp4`, `youtube/captions.srt`, `youtube/post.md` — derived YouTube review output with its approved final CTA; the common lesson and imported speech/cues remain identical. The root `video.mp4` is the Instagram export.
- `.render-work/` — temporary shared lesson, CTA segments and continuous audio mix; removed after successful exports.
- `status.json` also stores the preregistered hook format/version and its honest performance state (`unmeasured` until dashboard data is logged).
- `approval.json` — approval of the exact Zernio preview: content hash, platform accounts, captions, platform settings, and immediate/scheduled time. Its `platformPackages` map binds each selected target to the exact exported file, media hash, content hash and CTA version. Exact-version approval archives are written separately for each selected CTA. Approval records consent; it does not upload or publish by itself.
- `publications.json` — per-content-version record of Zernio post IDs, platforms/accounts, status, scheduled time, and returned links. Each platform result also preserves its approved video/media hash, content hash and CTA experiment ID. Per-post status is updated as Zernio moves a post from scheduled or processing to published; records are retained across re-renders.

## Edit and invalidation rules

- Edit dated working copies, never the canonical plan, unless the owner asks to change future plans.
- A narration edit changes the narration fingerprint. The old audio, timestamps, MP4, SRT, post, and package approval are invalid.
- A visual or packaging edit can reuse audio and timestamps, but invalidates both current platform exports and package approval until re-rendered. Immutable approval archives and publication records remain intact.
- Motion, sound, caption grouping, typography, and safe-area defaults come from `content/visual-system.json` and `content/EDITING_SPEC.md`. Any renderer-level change requires rebuilding and reviewing the dated package.
- Source receipts may be added through MCP plan edits. They do not replace a human check of the claims.
