# Isolated frame-driven MotionKit pilot

These components are **new, original Remotion-safe adaptations**, inspired by the
licensed/reference catalog. They do not execute or depend on upstream BoardUI,
Beautiful UI, Bencho or Transitions.dev browser/Next.js modules.

## What exists

- `MotionKit.tsx`: seven seek-safe, frame-parametric React animations using Remotion
  `interpolate`, no CSS transitions, timers, browser events, non-seeded randomness or network.
- `MotionKitPilot.tsx`: synthetic 1080x1920, 30fps **silent technical demo**.
- `../motion-kit-preview/index.tsx`: separate Remotion entrypoint, with no change
  to the existing `src/index.ts` production entrypoint.
- `../../scripts/preview-video-component-plan.mjs`: read-only planning for a real `calendar.json` date or episode ID (includes promo beats, registered content type and transparent history exclusions).\n- `../../scripts/video-component-selector.mjs`: deterministic, per-episode
  advisory component selector. Does not invent voice cues or render a real video.
  It deliberately limits the current illustrated-glass lesson to artwork-only
  `art-dissolve` / `art-drift` and never edits a central CTA.

## Opt-in real-audio review integration (no auto-publication)

The existing `src/EpisodeComposition.tsx` may receive an optional
`motionKitPlan` in its Remotion props. The plan must be created by
`scripts/motion-kit-cue-plan.mjs` **from the same actual imported
`gemini-word-timestamps` and audio SHA-256 as the approved-voice working
episode**. At render time it is revalidated against the original canonical
`cueTimeline`, exact words, scene order, cue frames, episode ID and locale.
The CTA is never modified.

For an unapproved, voice-ready illustrated lesson in a local copy:

```sh
# Default: untouched current output
npm run content:render -- <existing-episode-id>
# Explicit opt-in review package only; it does NOT authorize publishing
HSK_AI_MOTION_KIT_REVIEW=1 npm run content:render -- <existing-episode-id>
```

The second command writes `review/<id>/motion-kit-cue-plan.json` and supplies the
validated plan to all same-audio platform variants. It refuses pending/guessed
word cues, missing audio SHA-256, incompatible lesson style, missing art beats,
stale narration, mismatched voice/locale or an approved/published snapshot.
**Do not run either command against an approved/published episode.** Compare
separate captured baseline/candidate MP4 hashes and visual contact sheets
before claiming a quality improvement.

This is not yet a default-per-video automatic production feature. Only the
illustrated-glass **lesson artwork** is voice-bound so far; product demo UI
cards and promotional animations are still synthetic concept demos.

## Local test and preview

From `hsk-tu-vous/` (Node 20+):

```sh
npm ci
node --test scripts/video-component-selector.test.mjs scripts/preview-video-component-plan.test.mjs scripts/motion-kit-cue-plan.test.mjs
node scripts/preview-video-component-plan.mjs shop-shirt-size-20261117
node scripts/preview-video-component-plan.mjs ji-vs-duoshao-books-price-20261118
npm run lint
npx remotion still src/motion-kit-preview/index.tsx MotionKitPilot /tmp/motion-kit-0.png --frame=0
npx remotion still src/motion-kit-preview/index.tsx MotionKitPilot /tmp/motion-kit-80.png --frame=80
npx remotion render src/motion-kit-preview/index.tsx MotionKitPilot /tmp/motion-kit-pilot.mp4
```

**Not yet done:** No actual imported Gemini voice episode has been rendered and visually approved with the new opt-in yet. The binder is implemented, but CI exercises only synthetic captions with fixed known art assets. No approved lesson/audio/CTA/prod MP4 was modified. Never confuse
this silent pilot with a voice-synced result. For use in a real video, validate
the current content type, authored scene and exact word cues, preserve the HSK AI
cast and layout, confirm localized versions, compare an actual MP4 at phone
size with the unchanged original, and obtain exact owner approval before posting.

No new external npm dependencies and no paid source code are required.
