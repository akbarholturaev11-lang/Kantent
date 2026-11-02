# Premium Motion Director — implementation plan (HSK AI Content Studio)

**Status:** ACTIVE / isolated feature branch. **Owner authorization:** 2026-11-02.  
**Branch:** `feature/premium-motion-director` (no direct main writes).  
**Baseline main:** `b39b4a9b691fdd079be020ff8bc4b7448fa8492f`.  
**Living handoff:** [PREMIUM_MOTION_DIRECTOR_CONTEXT.md](./PREMIUM_MOTION_DIRECTOR_CONTEXT.md).

## 0. Goal, evidence, scope

Build broadcast-quality, meaning-linked short-form motion graphics while retaining the current HSK lesson teaching rules, RU/TJ voices, full word-level timestamps, CTA snapshots, safe areas, 30 FPS and publication approval. This is *not* a promise that adding a visual library will automatically produce premium footage.

Owner reference: video supplied in ChatGPT 2026-11-02 (82.8s; inspect source/frames when accessible); reference is guidance on *transitions, narrative continuity and voice-directed shots*, not a design to copy. Baseline code evidence: `src/NarratedActionScene.tsx` discards the previous action model when a new beat becomes active; `src/GraphicScene.tsx` supports simple authored SVG geometry and per-node tracks; `scripts/motion-design-plan.mjs` resolves exact word cues but does not describe shot-to-shot continuity. `content/visual-system.json` has general fades and style values, but no robust shared-element transition or per-asset movement contract. The reference has portraits, timelines and moving contextual objects missing from the typical simple action scenes. Do not claim a full current MP4 side-by-side QA without rendering and watching it.

## 1. Invariants (every stage)

- Do not change `main` or prior approved/published episode snapshots, recorded histories, external social posts, calendars, pricing or CTA policy. All changes in branch; draft PR before merge.
- Retain Remotion as the ordinary HSK lesson renderer. HyperFrames premium branch requires explicit independent choice; do **not** migrate the runtime.
- Preserve `content/EDITING_SPEC.md` one narration-synced subtitle and one meaningful focal action; no redundant hero headline, duplicated translation, ungrounded B-roll or distracting FX.
- Gemini-approved voices and locale-specific full word-level timestamps remain canonical. No synthetic cue estimates or audio regeneration merely to make transitions work.
- Preserve `motionDesign:true` and `explain-actions-v1`, and production fallback for historical non-action/semantic scenes and CTA. Never alter voice, clip duration or scene timing as a visual convenience.
- Each transition is deterministic by absolute frame; no CSS transitions, timeouts, Math.random or non-seek-safe runtime.
- Source Chinese facts, voice/profile hashes and every production locale remain independently validated. No publishing without an exact owner-reviewed MP4/hash per destination.
- Maintain 1080x1920 30fps output, readable at 270x480, balanced palette, no flashes/strobes, low visual load; transitions should communicate actions, not decorate them.
- New dependencies are optional and pinned to the **same version** as installed `remotion` 4.0.529; add only after measuring capability, build impact, licenses and reproducible QA.

## 2. Implementation milestones and microtasks

### M0 — Baseline, guardrails, test matrix [P0]
- [x] Read `AGENTS.md`, `AI_RULES.md`, `WORKFLOW.md`, `EDITING_SPEC.md`, `GRAPHIC_SCENES.md`, `EPISODE_SCHEMA.md`, `SKILLS.md`, Remotion animation/transition skill.
- [x] Record existing `main` HEAD and relevant code files in the context file.
- [x] Create isolated `feature/premium-motion-director` branch.
- [ ] Establish baseline: `npm ci`, `npm run check:consistency`, `npm run lint`, `node --test scripts/*.test.mjs`; capture exact commands, failures and runner/environment.
- [ ] Choose two source-bound RU+TJ unapproved pilot lessons: `haishi-vs-huozhe-tea-20261102` for illustrated object transitions and another current eligible action lesson; use an existing review audio/captions if exact hashes exist. Do not overwrite published versions.
- [ ] If real voice assets absent, build a *synthetic visual-only* local fixture and mark it technical, never pass it as real-production evidence.
- [ ] Establish phone-sized before/after stills, full MP4 with audio, 30fps/1080x1920, SRT and baseline load/time/size metrics.

### M1 — Beat continuity V1 (first code stage; no new dependency) [P0]
- [ ] Implement pure `scripts/action-beat-continuity.mjs` selector taking monotonic resolved beat cues, scene-local frame and a configured transition window.
- [ ] Preserve previous visual's settled final state while new beat appears; avoid disappearing at the cue boundary. Smoothstep eased opacity; no early portrayal of the new spoken action.
- [ ] Expose typed `.d.mts` contract for TS renderer imports.
- [ ] Refactor `src/NarratedActionScene.tsx` so the same rendering of choice/comparison/graphic/quantity/phrase can appear as *incoming* and frozen *outgoing* layers; background, logo, subtitles are not doubled.
- [ ] Read transition length from one canonical `visual-system.json#motion` token; do not hard-code a second copy. Default only the newly selected action presentation.
- [ ] Tests: first beat, exact cue frame, mid-window, end-window, repeated same-cue rejection, zero/invalid window, before-first cue, seeking back/forth, deterministic floating-point sum = 1.
- [ ] Re-run full ordinary tests, a Remotion render smoke and inspect before/cue/settled frames for no dropped graphic/no accidental doubled caption.
- **Exit:** same audio/CTA/duration/caption data, smooth beat crossfade in action rendering, no regression in old non-action/CTA rendering.

### M2 — Motion Director data model and semantic storyboard [P0]
- [ ] Draft `motionDirection` optional schema v1, scene-scoped: `shotId`, `meaningCue`, `cueOccurrence`, `assetIds`, `persistentElementIds`, `camera`, `transition`, `durationFrames`, `easing`, `focalRole`, `zIndex` and safe-area limits.
- [ ] Enforce deterministic mapping from exact imported `motionBeats` to director cues; reject unknown assets, missing/multiple cue matches and cue-order reversal.
- [ ] Add compatible source parser/validator in `scripts/`, structured fixture and negative-case tests. Keep source without motionDirection valid and deterministic.
- [ ] Prevent jumps across distinct objects with reused IDs, unrecognized state transformations or unsupported asset coordinates.
- [ ] Keep planning metadata out of the single subtitle renderer.
- [ ] Introduce a renderable trace: `review/<id>/motion-director-timeline.json` with frame-indexed incoming/outgoing assets and cue evidence; compare with `motion-timeline.json`.

### M3 — Persistent elements / scene choreography [P0]
- [ ] Establish canonical coordinate spaces, anchored subject size and per-object stable IDs.
- [ ] Reuse element identity across beat changes and move/scale/rotate its state rather than recreating it. Freeze old pose until supported new cue, ease to new pose and maintain continuity.
- [ ] Add `hold`, `slide-match`, `morph-compatible-path`, `focus-track`, `cut`, `crossfade` with explicit compatibility checks; avoid false morph between semantically unrelated subjects.
- [ ] Camera rig: limited push-in/pull-back/pan/focus only for meaningful framing, safe zones and bounded transforms.
- [ ] Test duration/seek consistency (frame 0, cue-1, cue, midpoint, settled, final), no flicker, geometry and clipping at phone size.
- [ ] Ensure existing `GraphicScene` tracks can run without arbitrary first-frame resets; keep old untagged graphic behavior stable.

### M4 — Asset Library and visual vocabulary [P1]
- [ ] Define asset manifest: id, type, source, license, dimensions, verified subject, language relevance, safe bounding box, transparency, approved palette and hash.
- [ ] Add local curated vector/PNG/WebP and optional Lottie, real object cutouts, teacher/student characters, contextual maps, timelines and comparison components. Start from 3–5 high-value teaching objects, **not** a mass preset pack.
- [ ] Asset loading via Remotion `staticFile` and `Img` with verified availability; no runtime network reads, CDN dependencies or broken license chains.
- [ ] If Lottie is genuinely required, add `@remotion/lottie` with version alignment and smoke-tested render; otherwise keep no extra dependency.
- [ ] Source real UI only from verified product screenshots, no invented app screens or fake performance/people.
- [ ] Provide understandable blank/error states for unapproved assets; never silently substitute unrelated imagery.

### M5 — Transition/effects pack [P1]
- [ ] Evaluate compatible `@remotion/transitions` without changing full video duration, scene timing, continuous audio or CTA boundaries. Test overlaps explicitly; `TransitionSeries` shortens durations unless compensated.
- [ ] Add restrained eased slide, masked reveal, radial focus, shared-element zoom, crossfade and optional motion blur only when meaning-linked.
- [ ] Motion blur: evaluate `@remotion/motion-blur` cost/artifacts; use selectively, not global.
- [ ] Keep flash/glitch/large repeated zoom disabled under active editorial policy. Keep effect selection explicit and testable.
- [ ] Performance fallback for slow/failed effects must retain meaningful semantic composition.

### M6 — Voice-first art director and automatic review [P1]
- [ ] Compute cue-to-action map strictly from word timestamps; require exact phrase occurrence indexes, no equal-duration fallback.
- [ ] Build ordered preproduction shot list with `subject / action / word cue / camera / transition / proof of meaning`.
- [ ] Build automated still/contact-sheet sampling at cue-1, cue+1, transition midpoint/end, full-scene intervals and 270x480.
- [ ] Add mechanical gates for missing assets, zero frame changes, empty stage, overlapping/cropped safe-area objects, repeated unrelated shots, clips shorter than meaningful action, forbidden extra text.
- [ ] Separate subjective human/AI visual approval from structural proof. A green unit test **never** means professional visuals.
- [ ] Preserve existing audio/SRT/hash workflows and owner approval; optional audio-reactive SFX only under current limits.

### M7 — Pilot comparison, rollout and merge [P0 release gate]
- [ ] Produce two identical-script RU+TJ A/B review packages; one baseline, one feature. Capture exact source, voice, CTA, media hashes, render environment.
- [ ] Check every cue, object recognition, Chinese characters/pinyin, subtitles, compositional continuity, camera motion, absence of strobe/ghosting, first/last spoken word, safe areas, Instagram/YouTube/TikTok/Facebook exports independently.
- [ ] Run `npm run check:consistency`, `npm run lint`, all tests and actual frame+MP4 smoke. Record evidence and errors in context.
- [ ] Validate no historical lessons/audio/CTA/social-automation changed; ensure no dependencies conflict.
- [ ] Only after owner examines the actual result, finish PR; merge to `main` solely on explicit approval. Build in a feature flag so rollback is a 1-line policy change.
- [ ] Monitor first reviewed production videos for artifacts/render failures and revise before global rollout.

## 3. File ownership / likely changes

- `src/NarratedActionScene.tsx`: beat layers, scene rig, persistent asset renderer.
- `src/GraphicScene.tsx`: geometry and object-level continuity, no alien assets.
- `src/EpisodeComposition.tsx`: owner-approved scene transitions; watch scene overlap and audio continuity.
- `scripts/action-beat-continuity.mjs` (+ typed declaration/tests): first isolated continuity increment.
- `scripts/motion-design-plan.mjs`: explicit word-to-frame motion-director timeline.
- `scripts/action-design-plan.mjs` and `scripts/graphic-scene.mjs`: schema and geometry validation.
- `content/visual-system.json`: **only** home for numeric motion controls and feature flags.
- `content/EDITING_SPEC.md`, `content/EPISODE_SCHEMA.md`, `content/WORKFLOW.md`: updates only when final behavior changes; reconcile duplicates per `AGENTS.md`.
- `public/` asset manifest and audited source media, only after rights/scope verification.
- `review/`: ephemeral proof/MP4; never commit sample voice/audio inadvertently.

## 4. Dependency decision table

| Tool | Need? | Decision |
|---|---|---|
| Installed Remotion 4.0.529 / React | Yes | **Keep** existing engine; deterministic frame control |
| `@remotion/transitions` | Candidate M5 | Test duration/overlaps with audio; do not install in M1 |
| `@remotion/motion-blur` | Candidate M5 | Optional; benchmark artifacts/perf first |
| `@remotion/lottie` | Candidate M4 | Only if licensed character animations are used |
| GSAP/HyperFrames | No for lesson engine | Current `content/SKILLS.md` forbids automatic migration |
| Gemini voice & word timing | Already present | **Keep** exactly as profile-approved |
| New image/video generation provider | Not in scope by default | Decide after proving asset needs, licenses, costs |

## 5. Milestone acceptance and reporting protocol

Every milestone status in the context file is one of `TODO | IN_PROGRESS | CODED_UNVERIFIED | TESTED | PILOT_REVIEWED | BLOCKED`. Never label CODED_UNVERIFIED as TESTED. Every completed item records: commit, files, test command+result, real MP4 evidence if available, issue, next action. A green CI is not evidence of subjective video quality; note *skipped* jobs explicitly.

Do not auto-merge. A failed CI stays visible, and a baseline pre-existing failure must be identified separately from new regressions. If rollout hurts teaching clarity, revert the feature flag and preserve the original renderer. Do not modify this plan to hide a failed gate; update status in the living context.
