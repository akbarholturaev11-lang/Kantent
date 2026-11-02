# Premium Motion Director — living implementation context

**Read this first on every resumed turn.** Canonical detailed tasks: [PREMIUM_MOTION_DIRECTOR_IMPLEMENTATION.md](./PREMIUM_MOTION_DIRECTOR_IMPLEMENTATION.md).  
**Updated:** 2026-11-02 (Asia/Shanghai). **Branch:** `feature/premium-motion-director`.  
**Draft PR:** [#51](https://github.com/akbarholturaev11-lang/Kantent/pull/51) — no merge.
**Starting main HEAD:** `b39b4a9b691fdd079be020ff8bc4b7448fa8492f`.  
**Mission:** transform current meaning-linked Remotion action lessons into a professional, voice-directed, continuity-preserving motion graphic system. No main merge without owner viewing an actual pilot.

## Critical context not to lose

- Owner reference uploaded in 2026-11-02 ChatGPT request: 82.8s vertical narrative explainer. It uses voice-linked portraits, timelines, moving people/cards/maps and smooth transitions. Do not copy artwork/layout. GitHub context cannot assume a directly mountable reference clip.
- Baseline renderer: `src/NarratedActionScene.tsx` selects last active beat and fully swaps `active.visual`; local animation clock resets. `src/GraphicScene.tsx` draws authored SVG nodes with individually timed tracks but no semantic object lifecycle across beats.
- Baseline strict cues: `scripts/motion-design-plan.mjs` exact Gemini word-to-frame match. Do not weaken this validation to make visuals easier.
- Production voice RU/TJ, CTA, social routes, aspect ratio, learning-presentation and review gates are pre-existing and must stay intact. `content/EDITING_SPEC.md` dictates one subtitle, relevant graphics and no decorative clutter. `content/SKILLS.md` ordinary lessons = Remotion, premium ad = possible HyperFrames separate.
- Current canonical examples include `content/episodes/haishi-vs-huozhe-tea-20261102.json`, `zhuozi-you-book-20261031.json`. These use `motionDesign:true`, `explain-actions-v1` with authored `graphic` beats.
- Prior 2026-11-02 scheduled GitHub Actions video-review run `41389286263`: safe synthetic CI passed but real Gemini → Remotion job SKIPPED; this is NOT an actual quality pass.
- Repo reference currently contains many third-party skills, but `package.json` includes only core Remotion 4.0.529/React and no `@remotion/transitions`, Lottie, motion-blur. Do not equate a skill file with working production code.

## Decisions

1. Isolated branch; no auto-merge or auto-video-publishing.
2. M1 uses existing Remotion and **no additional dependency**; add a deterministic action-beat crossfade with previous-frame hold, instead of arbitrary FX.
3. Add typed pure frame helper + tests before touching full camera/asset systems; preserve old timelines.
4. M2+ add asset identity, camera and shared-element transition with strict cue/meaning proof. Keep non-action legacy, voice and CTA unchanged.
5. Technical tests are required but cannot replace a real audio+video viewing gate.

## Status ledger (update after verified actions)

| Stage | State | Evidence / blocker |
|---|---|---|
| M0 architecture review | TESTED | Existing code/docs inspected from source; baseline identified |
| M0 original video baseline render | TODO | Need actual real MP4 and accessible approved audio/captions |
| M1 pure continuity helper | TESTED | Cue-safe selector + declaration; CI Node tests passed in run 41415222269 |
| M1 action scene renderer | TESTED | Dual artwork layers, prior pose frozen, first incoming cue; CI lint + synthetic still passed |
| M1 local unit tests | TESTED | Strict cues, seek repeatability, invalid plans, immutability; PR CI completed stage |
| M1 lint/consistency/action-still smoke | TESTED | Synthetic-only stage passed; real RU/TJ voice-linked MP4 A/B remains TODO |
| M2 motion director schema | TESTED | Exact voice cue and asset contract, bounded camera, review trace; passed CI run 41416786473 (synthetic) |
| M3 persistent asset/camera engine | IN_PROGRESS | 12-frame cue-safe shared SVG + camera rendered in real 57-frame silent MP4; CI 41418252599 green; broader assets/real RU+TJ QA remain |
| M4 verified asset library | IN_PROGRESS | 3 SHA-256 verified original review-only SVGs, explicit `asset` beats, production/TTS/TikTok gates; first 2-asset CI 41420018646 passed, full 3-asset silent MP4 check pending |
| M5 optional effects packages | TODO | Not yet evaluated |
| M6 visual QA automation | TODO | Not yet coded |
| M7 RU/TJ A/B owner pilot | TODO | Not rendered/approved |

## Handoff checklist

1. Read this file and the detailed implementation plan, then refresh current `main` and this branch HEAD.
2. Inspect current branch diff and CI before editing; only touch authorized feature branch.
3. Continue M4: verify all three curated assets in CI and real RU/TJ visual review; next add licensed real contextual portraits/verified product captures only after a provenance gate and owner's preview. Preserve M1–M3.
4. Test isolated helper and M2/M3: `node --test scripts/action-beat-continuity.test.mjs scripts/motion-director-plan.test.mjs`; run `npm run check:consistency`, `npm run lint`, full CI synthetic still + silent MP4 stages. Verify actual RU+TJ full review only if authentic matching voice assets exist.
5. Record exact commit SHA, changed paths and results here after each meaningful stage. A skipped render means real QA is still TODO.
6. Open/update draft PR for owner review and **do not merge** or publish.

## Risk register

- **R1:** Transition at exact word start hides the spoken object for several frames. Mitigation: test first cue, visual lead/clip truthfulness, 270x480 inspection; avoid obscuring actual teaching action.
- **R2:** Crossfade briefly overlays unrelated objects. Mitigation: first M1 safe fade, then M2/3 semantic transition types; reject incompatible morphs.
- **R3:** Remotion TransitionSeries alters duration if used naively. Mitigation: no M1 dependency; later verify exact frame counts/audio.
- **R4:** Unavailable real approved audio/captions in CI. Mitigation: synthetic fixture is technical only, no misleading real QA labels.
- **R5:** Asset copyright/licensing. Mitigation: manifest provenance and explicit permitted use; no fetched reference frames.
- **R6:** Regression in CTA/TikTok/localizations. Mitigation: preserve shared non-action branches and test all per-platform packages before merge.

## Append-only progress log

- **2026-11-02 — INIT:** Owner approved detailed plan, context file and work start. Identified M1 first safe incremental change. Feature branch created from main `b39b4a9`. No main edit or video publication authorized.

- **2026-11-02 — M1 CODE:** Added `scripts/action-beat-continuity.mjs` / `.d.mts` / `.test.mjs`, and refactored `src/NarratedActionScene.tsx` to crossfade only visual artwork (not logo/voice/captions). Added canonical `visual-system.json#motion.actionBeatCrossfadeFrames=8`; aligned `EDITING_SPEC.md`.
- **2026-11-02 — M1 TECHNICAL PROOF:** Added `scripts/action-continuity-render-fixture.mjs`, 65/66/69/74 frame still-render CI and duplicate-image guard. PR run `41414893909`: both jobs success. PR run `41415222269`: continuity Node test, lint, consistency and synthetic action still stage passed; remaining unrelated/general semantic MP4 smoke in progress when this entry was written. Synthetic test timing is NOT real Gemini proof and no real user-facing video was produced.
- **2026-11-02 — NEXT:** Finish PR CI check; inspect generated action stills and create real valid RU/TJ pilot with original voice assets; design M2 director schema + persistent element IDs; do not merge or post.
- **2026-11-02 — CI COMPLETED:** PR run [41415222269](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41415222269) finished **SUCCESS** in both `semantic-foundation` and `consistency`. The 4 synthetic Remotion cue-frame stills, strict selector tests, TypeScript lint, existing consistency and synthetic semantic MP4 smoke passed. This is code/technical validation, NOT real RU/TJ narration or professional visual acceptance. New context-only commits can trigger a fresh CI run, but do not change renderer behavior.

- **2026-11-02 — M2/M3 CODE:** Added `scripts/motion-director-plan.mjs`, typed interface and unit tests; routed optional authored camera direction through `motion-design-plan.mjs`, `EpisodeComposition.tsx` and `NarratedActionScene.tsx`. Reject unknown asset IDs, fake/mismatched cue text, unsafe camera and incompatible persistent geometry. Render preflight can output `motion-director-timeline.json`. GraphicScene supports selective root rendering and pose overrides; one SVG root group is carried across adjacent graphic beats while narration cues and other art remain unchanged.
- **2026-11-02 — SYNTHETIC VISUAL QA:** [CI run 41416786473](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41416786473) completed both jobs SUCCESS. The `motion-director-synthetic-stills` artifact (ID `13128515355`) contains exact cue frames 65/66/69/74. Frames were downloaded and inspected; pixel-tracked book green-shape midpoint x values increased approximately 399 → 413 → 555 → 719 across frames. That proves spatial motion, NOT professional visual quality. The book occupied only ~160 pixels wide in a 1080px video (too small at phone size), and the screenshot exposed an existing cream subtitle backing pill in a reusable action scene, contradicting current editorial rules.
- **2026-11-02 — QUALITY REPAIR:** Enlarged the synthetic hero book for the next render; restricted true shared-group persistence to matching SVG geometry + equal canvas dimensions; changed reusable-action subtitle styling to transparent high-contrast foreground, keeping unrelated CTA/legacy captions untouched. Still need next CI/visual review before calling this repair TESTED.
- **2026-11-02 — NEXT:** Verify latest CI including enlarged-hero and clean-subtitle stills; inspect actual frame images at 270×480. Finish M3 camera/scale & asset fidelity, then M4 asset catalog. Real RU/TJ final voice-linked video is still NOT produced or approved.

- **2026-11-02 — FIRST FULL MOTION VIDEO:** PR CI [41417703808](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41417703808) passed both jobs and uploaded synthetic `motion-director-technical.mp4`; locally verified H.264 1080×1920/30FPS/57 frames/1.90s, **silent**, 49 KB. Sampling all frames showed green-book centroid x ~406 before frame 66, then ~727 after; maximum consecutive movement ~59.1 pixels/frame (too rapid aesthetically). This proves only deterministic movement.
- **2026-11-02 — TIMING REFINEMENT:** Directed shots now control both action crossfade and camera motion through the *same* `transition.frames`; initial technical pilot moved from 8 to 12 frames, no change to scene/audio timing. New QA screenshot at 65/66/72/78, full silent MP4 frames 40–96. A transient CI run `41418085033` failed solely because a closing bracket was missing from the synthetic fixture (not renderer code); repaired the fixture and added `node --check` preflight.
- **2026-11-02 — VERIFIED CI / 12-FRAME QA:** Run [41418252599](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41418252599) finished SUCCESS in `semantic-foundation` and `consistency`. Downloaded 57-frame 1080×1920 30FPS 1.90s silent MP4 artifact `motion-director-synthetic-stills` (artifact ID `13128771466`). Green-book center sampled every video frame: x≈406 before cue, 412 at cue, 486 around 3 frames into move, 603 around 6 frames, 727 once settled; maximum observed step ≈39.9 pixels/frame vs ≈59.1 at 8 frames. Text is now backing-free and hero width enlarged (~280px of 1080). Correct frame timing and technical non-jump verified, **not** cinematic/reference-level visual acceptance. Actual RU/TJ audio and CTA, source authoring automation, asset sourcing and real MP4 A/B are still not completed.
- **2026-11-02 — NEXT SAFE MOVE:** M3 broader continuity, authoring director shots for a fresh unapproved pilot in both languages with exact imported Gemini cues; M4 build verified licensed/owned visuals for narrative portraits/location/UI without copying reference media. Do not silently amend canonical/published episode records, change model/voice or publish. Preserve this branch and draft PR #51; only merge after exact finished real owner-reviewed MP4.

- **2026-11-02 — M4 FOUNDATION:** Inspected current `main` (`b39b4a9b691fdd079be020ff8bc4b7448fa8492f`) and retained branch/PR #51 isolation. Original first-party vector files added to `public/motion-assets/`: `study-book.svg`, `tea-cup.svg`, `market-stall.svg`. `content/motion-assets.json` owns SHA-256 hashes, source/creator/license provenance, dimensions, safe bounds, RU/TJ applicability and the explicit `review-only` status. No third-party photo claimed or imported.
- **2026-11-02 — M4 SAFETY/CODE:** Browser-safe `scripts/motion-assets.mjs` validates registry fields and IDs. Node-only `scripts/verify-motion-assets.mjs` verifies exact file hash/path/dimensions, SVG safety, missing files and path traversal. `action-design-plan.mjs` adds **explicit** `kind:"asset"` with `visual.assetId`; `NarratedActionScene.tsx` uses local Remotion `Img + staticFile`; `motion-director-plan.mjs` allows only the actual authored `asset:<id>` with matched cue; it never claims cross-asset morph/shared identity. `render-episode.mjs`, `generate-voice-gemini.mjs` and `render-tiktok-review.mjs` reject `review-only` assets before full production media work. Publication approvals unchanged.
- **2026-11-02 — CI FAULT/REPAIR:** First asset verification run failed because SVG's mandatory official `xmlns="http://www.w3.org/2000/svg"` was accidentally flagged as an external media URL. Fixed validator to exempt only that standard namespace; script/external image/url injections remain rejected. [CI 41420018646](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41420018646) passed `semantic-foundation` + `consistency` and produced 4 original-asset stills (book, first tea cue, midpoint, settled). Inspected contact sheet: original illustration recognizable and crossfade visible; subtitles show grouped speech slightly early, so do not claim perfect phonetic caption alignment from stills. Synthetic captions only; real Gemini audio not reviewed.
- **2026-11-02 — FULL ASSET QA REQUEST:** Extended the visual-only synthetic fixture to 3 asset beats (`book` at frame 27, `tea` at frame 66, `market-stall` at frame 102). GitHub CI now renders five stills plus a silent 88-frame H.264 MP4 (frames 38–125). **Await result at the time of this log entry.** No owner-approved production asset, Lottie/PNG/WebP, photographic portrait or real RU+TJ A/B exists yet.
- **2026-11-02 — HANDOFF:** Next read this file, refresh CI on the latest HEAD, download `motion-asset-library-review` artifact, inspect phone-scale MP4 with all three objects, record test failures honestly, and keep PR #51 draft. M5 effects and full reference-grade creative direction must not be considered delivered by these vector assets.
- **2026-11-02 — M4 THREE-ASSET TECHNICAL VIDEO VERIFIED:** [CI run 41420856431](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41420856431) completed `semantic-foundation` and `consistency` with SUCCESS (source/head with all-three fixture, SVG security and TikTok gating). Its ancestor [run 41420762631](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41420762631) also succeeded and exposed artifact `motion-asset-library-review` ID `13130121367`. Downloaded actual artifact, inspected five original HSK AI asset stills and the **88-frame / 2.933333s / 30 FPS / 1080×1920 / 225473-byte silent H.264 MP4**. Verified book→cup→market cue sequence (frame 66 and frame 102) with no unexplained abrupt jump, and examined source frames 100/101/102/105/108/112/118 for the cup→market crossfade. Technical original SVG rendering works with no new dependency. **Critical remaining visual quality gap:** open-stage objects still occupy a relatively modest center portion, so the design is not yet reference-grade cinematic motion. Caption grouping can show the next word ahead of spoken cue, so true synchronized subtitle evaluation is pending a real voiced pilot. All asset statuses remain review-only; no publishing/merging permission or full RU/TJ spoken final video exists.
