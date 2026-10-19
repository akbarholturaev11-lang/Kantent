# Semantic Visual Storytelling — integration plan (PROPOSAL; NOT IMPLEMENTED)

Status: **design only / pending owner review before executable code**  
Repository: `akbarholturaev11-lang/Kantent`, base `main` at `40a115494c952be45ec6be1e894384056c99ee13` (2026-10-19).  
Goal: Each lesson's **context, actors/objects, camera motion, and meaning-bearing gestures** should depict exactly what the fixed approved narrator says, not repeatedly show a student in front of the same building. Preserve one HSK learning point, high readability, and the existing production/publishing contract.

**This document is a proposed implementation roadmap, not an active production policy.** The owning source documents (`AGENTS.md`, `AI_RULES.md`, `content/EDITING_SPEC.md`, `content/EPISODE_SCHEMA.md`, `content/visual-system.json`, etc.) must be migrated together **when code implementation begins**. Existing approved/published revisions must not be changed.

## Implementation tracking — 2026-10-19

- **P0 + P1 implemented on branch** `codex/semantic-visual-foundation-20261019`, [Draft PR #16](https://github.com/akbarholturaev11-lang/Kantent/pull/16). This is NOT merged into `main` and is NOT a production semantic renderer.
- Added `content/semantic-visual-system.json`, `content/SEMANTIC_VISUAL_SCHEMA.md`, `scripts/semantic-visual-plan.mjs`, a standalone cue-timeline preview CLI and Node tests. Integrated metadata validation in `lib.mjs` and the MCP review editor, and a fail-closed production renderer guard while P2 is absent.
- Semantic feature is **off for production**, with legacy episodes and central CTA preserved. Timeline compilation requires imported true spoken word cues; unmatched/ambiguous cues abort rather than using proportional timing.
- Independent CI `semantic-foundation` covers logic, CLI, source consistency and lint. The separate legacy CTA assembly test on `main` was already red at `episode-cta-assembly.test.mjs:84`; do not relabel aggregate CI green or silently merge production code.
- **P2 renderer preview now staged in stacked Draft PR #17**: `src/SemanticStoryScene.tsx` renders varied settings/shot compositions and a minimum set of cue-driven actor/object actions; `EpisodeComposition.tsx` accepts an optional compiled semantic timeline, and synthetic 来/去 Remotion still-frame QA runs in CI. Production flag remains OFF; no publishable real-Gemini semantic MP4 or actual post exists. P3–P5 remain unimplemented; next is a real-source and real-audio pilot with stronger semantic asset coverage.

## 1. Confirmed current implementation (source audit)

- `scripts/auto-storyboard.mjs` selects one of four creative formats and chooses `street|cafe|campus|home` by light text matching. It assigns `student` to newly decorated scenes; no rich per-action scene direction is inferred. Eligible CTA-free future source lessons are decorated in working review copies only.
- `scripts/storyboard-validation.mjs` restricts storyboard settings to those four, characters to `student|shopkeeper`, moods to four values. `src/CinematicStoryScene.tsx` draws essentially one building and a gently bobbing/swaying figure per scene; variations are mainly background, pose/mood and typography. This does **not** portray meaning-bearing physical actions such as approach, depart, open, close, give, take.
- `src/EpisodeComposition.tsx` routes `scene.storyboard` to the cinematic renderer; legacy `NarrativeVisual` / `BoldMotionScene` paths remain available. A beat with no `syncCueText` is apportioned by scene duration, and an unmatched explicit `syncCueText` also falls back to proportional timing. Matching cues are currently advanced by `motion.beatEntryLeadFrames`, so visual appearance may lead the spoken word.
- `scripts/generate-voice-gemini.mjs` + `scripts/import-voice.mjs` already provide fixed approved Gemini narration and transcript-verified word-level cues, scene boundaries and immutable narration hash. This is a strong timing foundation: keep it.
- `scripts/render-episode.mjs` / `scripts/render-platform-videos.mjs` already render the common lesson **once**, derive separately approved Instagram/YouTube CTA endings, and reuse continuous speech audio. Do not duplicate lesson renders or redefine the central CTA.
- In the 18 source `content/episodes/*.json` files reviewed on this date, 2 have authored cinematic storyboard per scene; others may acquire one in a working copy. Many source `visualBeats` have no `syncCueText`. Thus data authoring, cue binding and renderer expressiveness must all be addressed.
- `content/creative-formats.json` controls broad editorial formats, not semantic actions. `content/visual-system.json` controls numerical design/motion values; `content/EDITING_SPEC.md` controls shot/editorial principles. Keep these ownership boundaries.

## 2. Target architecture: add a lesson-only semantic layer

```text
content/calendar.json + CTA-free episode.json
        |
        v
existing creative-format selection / review-copy materialization
        |
        v
NEW semantic shot/beat planner (editorial, owner-reviewable intentions)
        |
        v
existing approved Gemini TTS + exact word-transcript verification
        |
        v
NEW strict cue resolver => review/<id>/visual-timeline.json
        |                             [resolved frame anchors + provenance]
        v
existing EpisodeComposition => NEW semantic lesson renderer
        |                       \-> unchanged legacy lesson/CTA render paths
        v
existing shared Instagram/YouTube export, caption, version approval and publication
```

### 2.1 Proposed additive data contract (names to finalize during coding)

Keep existing `scene.storyboard`, `visualBeats`, `cards`, narration and CTA fields valid.

- Optional `scene.semanticShot`: `environmentId`, `shotType` (`wide|medium|closeup|object-focus|split-contrast`), `cameraStyle`, `actorIds` (zero, one or more if necessary), and optional curated `assetIds`. **Zero actors** is valid for object/action-only beats.
- Optional `visualBeats[].semanticAction`: a typed enum such as `approach-camera`, `move-away`, `enter`, `exit`, `give`, `take`, `open`, `close`, `appear`, `disappear`, `point-to`, `compare`, `show-blocked`, or `hold`, plus typed `subjectId`, `objectId`, `targetId` and optional allowed intensity/perspective. Add actions to the renderer only as implemented/tested; no arbitrary CSS string injection.
- Reuse existing `syncCueText` for spoken tokens and optionally add a disambiguating `syncCueOccurrence` (1-based occurrence **within the scene**) and a versioned cue-binding strategy when a repeated word/phrase is needed. The resolved cue **must** match the imported actual spoken transcript, not merely the Hanzi drawn on screen. Explicitly verified pinyin/syllable-to-spoken-text mappings may assist but must not bypass the existing exact narration/caption alignment gate.
- The semantic scene/beat spec is authored or checked in the **unapproved** canonical lesson / working review copy; the runtime planner performs deterministic assembly/validation, not unconstrained visual generation. Do not claim simple keyword heuristics can reliably understand every Chinese grammar contrast.
- `review/<id>/visual-timeline.json` is a **generated local, noncanonical** resolved sidecar: schema version, episode/scene/beat IDs, immutable source+timing fingerprints, cue text + occurrence, matched caption index, start/end milliseconds/frames, asset provenance and action parameters. Never invent missing timestamp values.

Example teaching semantics:
- `来 (lái)` — an actor visibly **approaches** the viewpoint; the approach starts on the confirmed *spoken* cue.
- `去 (qù)` — an actor visibly **recedes/departs** from the viewpoint; the movement starts on its confirmed spoken cue.
- `会 (huì)` vs `不能 (bù néng)` — first depict an acquired swimming skill, then the **closed pool** preventing swimming today; do not inaccurately imply the skill vanished.
- `有 (yǒu)` vs `没有 (méiyǒu)` — object is visibly present vs absent, with an unambiguous stable camera reference.

### 2.2 Two separate timing requirements

1. **Pre-cue composition** may already show the location/subject for orientation and phone readability (including hook first-frame).
2. **Meaning-bearing action** must be anchored to the matched word/phrase start frame; do not start that movement 15 frames early just because `beatEntryLeadFrames` exists. Animate a frame-driven action curve, settle on a readable hold and keep captions precisely on source word times. Existing earlier lead may remain only for nonsemantic staging/text introduction.

**Fail closed for new semantic actions**: missing/ambiguous/out-of-scene cue, missing asset/action, invalid timeline or visual conflict must produce a precise validation error before semantic production render. No quiet equal-duration fallback. Legacy nonsemantic episodes may retain their old fallback to avoid regressions.

### 2.3 Visual system / variation without unnecessary cloud costs

- Keep **Remotion + React/SVG** as renderer; introduce composable procedural scene objects, actor motion rigs, camera transforms and contextual layouts. A shot can prioritize objects (a door, clock, cup, pool, bus) instead of always showing the same student.
- Curate a versioned set of environments (extend only as needed; pilot candidates: street, room, transport stop, cafe, campus, pool) and shot types, with per-topic scene framing. Do not make every scene use the same front-facing building.
- Retain `content/visual-system.json` for measured movement limits, durations, typography, safe zones, camera bounds and motion strength. Maintain one dominant teaching action at a time; subtle ambience is secondary. Preserve 1080×1920 / 30 fps, Chinese + tone-marked pinyin + Russian meaning and existing word-timed subtitle lanes.
- Prefer reusable native vector/Remotion assets for a first implementation: deterministic output, low dependency/cost, controllable timing. Optional owner-approved/licensed stills or short generated clips can be a *later*, provenance-tracked asset-adapter stage. No runtime network generation, unlicensed scraping, fake app screenshots, unapproved provider switch, added voice, or automatic media purchase.
- Sound cues reflect the visual event only when semantically useful; cap and duck under narration per existing sound tokens. Avoid flash/strobe/glitch/rapid zoom and busy motion.

## 3. Implementation sequence (separate reversible increments)

### P0 — contract, gates and baseline
- Capture `main` SHA, current test/CI baseline, dated render smoke fixtures, and current protected review states.
- Define versioned semantic schema and shot/action registry; document precedence: **semantic lesson opt-in > legacy storyboard for that lesson beat; CTA and approved/published content always keep existing path**.
- Introduce a feature flag/opt-in, **off for existing episodes**; add validator tests before renderer changes.
- Edit owning schema/editorial/config docs as one rule migration, reconcile contradictory text; `AI_RULES.md` only if a truly global policy changes.

### P1 — cue binding and strict visual timeline
- Implement `scripts/semantic-visual-plan.mjs` (name provisional) after word-timing import and before Remotion render. Resolve exact spoken text with occurrence, identify out-of-scene/duplicate/missing cues, maintain nondecreasing beat/action times and cue-centered frame anchors.
- Extend `scripts/lib.mjs` validation and the `mcp-server.mjs` editor Zod shapes together; ensure `episodeContentHash` and per-platform visual fingerprints invalidate stale output/approval.
- Write auditable `visual-timeline.json`, make render refuse stale/missing semantic timeline and avoid changes to voice or `captionSource`.

### P2 — minimum semantic renderer and reusable actions
- Add `src/SemanticStoryScene.tsx` (or extracted semantic components under `src/`), with `src/EpisodeComposition.tsx` dispatch for **lesson-only opted-in** scenes.
- Implement tested actor/object transformations for **approach vs depart**, enter/exit, appear/disappear, opening/closing, and one unambiguous contrast. Use deterministic Remotion frame interpolation; avoid CSS-clock animations.
- Extend environment and framing options without rewriting `CinematicStoryScene` defaults; CTA always follows existing registered `BeatText`/screenshots.

### P3 — content-intent authoring / controlled auto-plan
- Add topic-specific `semanticShot` and per-beat `semanticAction` to **new or owner-authorized unapproved** lesson JSONs, with actual cue tokens verified from narration. Future Calendar Reserve may prepare *intent metadata*, not fabricate verified transcript timestamps or change narration.
- Existing `auto-storyboard` remains the broad creative-format router. It must not auto-convert every `student`/building scene to a guessed action; semantic shot plans are a separate declarative layer, with editorial review and explicit fallback for unsupported concepts.
- Extend skill/router and MCP review descriptions only where needed so agents always inspect planned semantic beats before voice/render.

### P4 — pilot, pixel/audio QA and regression
- First use a test-only fixture for **来 / 去** with explicit approach/depart and synthetic known cue timestamps. Inspect frames before, on, after and at the end of each cue; ensure the camera anchor is stable and direction unmistakable.
- Then test the real **unapproved** `hui-vs-neng-pool-20261028` future lesson as a candidate context/contrast pilot *only if still eligible when implementation begins*. Do not automatically edit it if review/voice/approval or publication state has changed; choose a new owner-authorized test episode instead.
- Measure clear visual difference versus legacy static storyboard, correct Chinese teaching meaning, synced actions, phone readability, render memory/duration and narration/SRT exactness. Inspect decoded output frames and listen to narration, not just TypeScript/unit pass.
- End-to-end test Instagram + YouTube: identical shared lesson footage and audio, platform-specific CTA ending unmodified, correct media/content hashes, review states and exact-preview approval invalidation.

### P5 — incremental rollout
- Roll out only to future planned episodes in small batches, preserve old screenshots/approved/published reviews and keep an explicit off-switch. No automatic publishing.
- Collect human review notes and verified platform readbacks. Do not declare higher retention or better conversion from visual attractiveness alone; test matched-window metrics with confounders disclosed.

## 4. Required QA / acceptance criteria

1. Spoken `来` yields visible movement toward the camera; spoken `去` yields movement away, **beginning at the bound spoken cue**, not at an evenly split scene time. No contradictory overlay/gesture or camera reversal.
2. A lesson can show zero actors, different camera compositions and multiple contextual settings across beats. The single generic student/building composition is no longer an unavoidable default for opted-in semantic scenes.
3. Missing/duplicated/unmatched cue, invalid action IDs, off-scene timestamps, unsafe asset paths, overlong action, overlapping incompatible actions all **fail validation** with scene/beat-level diagnostics.
4. `narrationHash`, approved Gemini profile, `captions.srt` and `captionSource` remain exact; **visual-only edits reuse approved audio** when narration is unchanged but force new MP4, hashes and preview approval.
5. Old lessons without semantic opt-in render via unchanged existing path. Approved/published episode files, CTA experiment ledgers, publishing records and historical social posts are never rewritten.
6. Existing four broad creative formats, date selection, draft hydration, CTA assembly, Git freshness guard, shared-render export, TikTok publication restriction and owner consent all continue to work.
7. `npm run lint`, `npm run check:consistency`, affected Node tests plus new semantic tests and representative real MP4 review must pass before executable-code integration. A known preexisting CTA test failure is **not green CI** and must be isolated/fixed before claiming overall success; the feedback-data-only exception does not authorize merging broken renderer/code.
8. No cloud/image/video generation credentials, subscription fees, or additional runtime API calls are introduced without an explicit separately reviewed provider/asset decision.

## 5. Risks / deliberate non-goals

- **Lip movement / realistic video generation is not included in v1.** Existing illustrated Remotion can depict clear motion/causality without pretending to be filmed live action.
- Text search alone cannot infer Chinese semantic intent reliably. Model-assisted editorial planning can propose actions, but allowed metadata and cue timing must be validated deterministically and reviewed.
- Chinese spoken tokens may appear as Mandarin syllables or normalized Cyrillic phonetics in transcription; do not assume the written Hanzi equals `caption.text`. Missing exact alignment must be surfaced.
- `beatEntryLeadFrames` is a staging lead, not a license to play a meaning-bearing action before speech.
- Feature work is separate from independent technical debt in existing CTA-related CI; isolate that baseline rather than hiding it.

## 6. Original P0/P1 task instruction (historical; completed on Draft PR #16)

Start with **P0 + P1 only**, on an isolated code branch/PR with a known `main` baseline: introduce the additive schema, validators, strict cue resolver and test fixtures. Do **not** switch on for production, edit past approved work or publish videos. Review the first diff and tests, then proceed to P2 renderer and subsequent pilot. No executable-code change is authorized by this planning document itself.
