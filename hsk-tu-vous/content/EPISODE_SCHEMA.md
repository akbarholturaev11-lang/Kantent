# Episode and review schema

The calendar is the index. Each calendar item points to one CTA-free planned JSON lesson in `content/episodes/` for new dates. CTA text and cue-synced visuals live **only** in the canonical CTA Lab. The assembly of an active *review copy* happens in `scripts/episode-cta-assembly.mjs` when the agent opens or creates the dated production plan. Older historical source files may retain previously registered CTA snapshots; do not rewrite published or approved history.

## Canonical episode record

- `id`, `date`, `timezone`, `languageCode`: identity; ISO date and Asia/Shanghai.
- `voiceProvider`, `voiceProfileId`: production provider key and the one fixed profile in voice-profile.json.
- `title`, `level`, `topic`, `durationTargetSec`, `caption`, `hashtags`, `cta`: packaging and learning context. **`cta` is an immutable-per-registration draft/render snapshot** resolved from the central `content/cta-lab.json`, NOT a second editable CTA policy. `audienceProblem` names one concrete beginner pain point; `learningOutcome` states the single useful result the viewer should get from the lesson.
- `learningFacts`, `examples`: the intended lesson point and Chinese examples. These are planning notes until checked.
- `learningFactSources`: evidence receipts, one per source: `{ title, url, checkedAt, supports }`. `checkedAt` is YYYY-MM-DD and `supports` names the specific fact(s) the source supports. Empty means language-source review has not been recorded.
- `hookExperiment`: required preregistration `{ id, formatId, hypothesis, primaryMetric, fallbackMetric, registeredAt }`. `formatId` is `question`, `contrast`, or `scenario`; metrics are `three-second-hold-rate`, `average-watch-ratio`, or YouTube Shorts’ `chose-to-view-rate`. Register the hypothesis before publishing so results are not explained after the fact.
- `ctaExperiment`: required immutable registration metadata after a CTA edit: `{ id, formatId, ruleVersion, offerId, keyword, hypothesis, changedVariable, comparisonGroupId, registeredAt, copyHash, acknowledgedCorrectionIds }`. `content/cta-lab.json` is the separate source of mandatory owner corrections and CTA learning; read it in every chat before CTA work. Each registration snapshots CTA wording, visual beats/transitions/placement, and current lesson, hook, and voice context. A script, visual, context, or placement change requires a new CTA version before voice preparation or render.
- `scenes[]`: ordered scene records with `id`, `kind`, `headline`, `narration`, optional concise `screenCaption`, `captionStyleId`, `editPlan`, optional `durationSec`/`durationFrames`, `visualBeats[]`, and Chinese `cards[]`. Scene edit directions must follow `content/EDITING_SPEC.md`; screenCaption is a scene label/takeaway, not a duplicate transcript. Imported review scenes also carry audio-aligned `startMs`/`endMs`.
- A visual beat may declare `visualFocus` (`friend`, `teacher`, `elder`, `shopkeeper`, `group`, or `single-person`) and `syncCueText` to switch a matching contextual illustration when that spoken word starts. Use only visuals supported by that scene's Russian narration. CTA beats may also use `actionIcon` (`comment`, `app-download`, `direct-message`) and `transitionStyle` (`type-reveal`, `slide-match`, `mask-reveal`) inside the same central stage; keep them matched to the exact spoken word.
- Caption style IDs are `headline`, `pill`, or `highlight`. Choose two or three styles per episode, one style at a time per scene; default styles depend on scene kind.
- `captions[]`: timed cue records `{ text, startMs, endMs, timestampMs, confidence }`, imported from word-level VTT/SRT.
- `captionSource`: only `pending-tts-export`, `online-tts-srt`, or `online-tts-vtt` is used by production.
- `audioSrc`, `voiceTextHash`, `voiceProfileId`: identify the imported audio and exact narration/profile version it belongs to. If narration changes, remove the hash/audio/captions and import a fresh pair.
- `audioTrimAfterFrames`, when present on an imported review episode, is Remotion's absolute source-frame endpoint (`Audio.trimAfter`), not a count of frames to remove from the tail. The importer sets it after the last timed word plus a short natural pause.
- `publishingStatus`: records pending confirmation, owner-approved Zernio publication, or the per-version outcome (`published`, `scheduled`, `processing`, `partial`, or `failed`).

## Platform CTA variants\n\nFor new lesson plans, omit top-level `cta`, `ctaExperiment` and the CTA scene. The `lib.mjs` plan/draft loader joins the current approved CTA scene template with the working copy, using the offer text once. When the joined version matches an existing immutable experiment it reuses its metadata; otherwise it requires a new registration before audio or render.\n\n`content/cta-lab.json` defines a single platform variant map (`instagram`, `tiktok`, `youtube`). The existing approved Instagram text is read through `offer.canonicalRussian` without a duplicate editable value. TikTok/YouTube copy and assets are currently unapproved placeholders. `scripts/platform-cta.mjs` returns readiness and can prepare an isolated **in-memory draft** with the same teaching scenes, fresh CTA scene and invalidated audio/approval/CTA registration; it does not independently render three files. Each eventual platform MP4 needs its own synchronized CTA voice/subtitle timings, new registration and separate review output. No unapproved draft may render. YouTube publishing additionally needs a separate owner authorization. Do not rewrite legacy approved or published snapshots.\n\n## Hook measurement record

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
- `status.json` — current package stage, duration, voice profile, and subtitle source.
- `status.json` also stores the preregistered hook format/version and its honest performance state (`unmeasured` until dashboard data is logged).
- `approval.json` — approval of the exact Zernio preview: content hash, platform accounts, captions, platform settings, and immediate/scheduled time. Approval records consent; it does not upload or publish by itself.
- `publications.json` — per-content-version record of Zernio post IDs, platforms/accounts, status, scheduled time, and returned links. Per-post status is updated as Zernio moves a post from scheduled or processing to published; records are retained across re-renders.

## Edit and invalidation rules

- Edit dated working copies, never the canonical plan, unless the owner asks to change future plans.
- A narration edit changes the narration fingerprint. The old audio, timestamps, MP4, SRT, post, and package approval are invalid.
- A visual or packaging edit can reuse audio and timestamps, but still invalidates MP4, SRT, post, and package approval until they are rendered again.
- Motion, sound, caption grouping, typography, and safe-area defaults come from `content/visual-system.json` and `content/EDITING_SPEC.md`. Any renderer-level change requires rebuilding and reviewing the dated package.
- Source receipts may be added through MCP plan edits. They do not replace a human check of the claims.
