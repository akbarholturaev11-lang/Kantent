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

## Local test and preview

From `hsk-tu-vous/` (Node 20+):

```sh
npm ci
node --test scripts/video-component-selector.test.mjs scripts/preview-video-component-plan.test.mjs
node scripts/preview-video-component-plan.mjs shop-shirt-size-20261117
node scripts/preview-video-component-plan.mjs ji-vs-duoshao-books-price-20261118
npm run lint
npx remotion still src/motion-kit-preview/index.tsx MotionKitPilot /tmp/motion-kit-0.png --frame=0
npx remotion still src/motion-kit-preview/index.tsx MotionKitPilot /tmp/motion-kit-80.png --frame=80
npx remotion render src/motion-kit-preview/index.tsx MotionKitPilot /tmp/motion-kit-pilot.mp4
```

**Not yet done:** Selected components have not been bound to imported real
word timestamps; no real lesson/audio/CTA/prod MP4 was modified. Never confuse
this silent pilot with a voice-synced result. For use in a real video, validate
the current content type, authored scene and exact word cues, preserve the HSK AI
cast and layout, confirm localized versions, compare an actual MP4 at phone
size with the unchanged original, and obtain exact owner approval before posting.

No new external npm dependencies and no paid source code are required.
