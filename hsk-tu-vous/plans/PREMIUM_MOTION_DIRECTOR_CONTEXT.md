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
| M2 motion director schema | TODO | Next target: persistent IDs, camera/transition shot contract, exact cue validator |
| M3 persistent asset/camera engine | TODO | Not yet coded |
| M4 verified asset library | TODO | Not yet coded |
| M5 optional effects packages | TODO | Not yet evaluated |
| M6 visual QA automation | TODO | Not yet coded |
| M7 RU/TJ A/B owner pilot | TODO | Not rendered/approved |

## Handoff checklist

1. Read this file and the detailed implementation plan, then refresh current `main` and this branch HEAD.
2. Inspect current branch diff and CI before editing; only touch authorized feature branch.
3. Continue first unfinished milestone. For M1: unit-test helper, integrate renderer, add canonical transition token with owner policy reconciliation.
4. Test isolated helper: `node --test scripts/action-beat-continuity.test.mjs`; then `npm run check:consistency`, `npm run lint`, existing tests. Verify actual render only if authentic assets available.
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
