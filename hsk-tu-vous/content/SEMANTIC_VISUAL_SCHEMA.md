# Semantic visual contract (v1; review-only foundation)

Current state: **automatic new-draft semantic composition and Gemini-word-anchored Remotion review MP4 pipeline**. Publishing semantic videos remains disabled pending real P4 owner audio/video approval. A synthetic still-frame test is not a verified narrated video. See `plans/SEMANTIC_VISUAL_STORYTELLING_PLAN.md` for P0–P5.

P3 adviser remains non-mutating when run standalone. The separately enabled clean-draft auto-applicator `scripts/semantic-review-integration.mjs` applies eligible scene shots, but proposed cues become executable only after real Gemini word-level validation at render. See `content/WORKFLOW.md`.

The single source for allowed semantic enumerations, limits and rollout status is `content/semantic-visual-system.json`; this file explains their usage. Broad format selection remains `content/creative-formats.json`, layout numbers remain `content/visual-system.json`, and the editorial shot method remains `content/EDITING_SPEC.md`. No changes to CTA policy.

Opt-in for an **unapproved review-only** lesson:
```json
{
  "semanticVisual":{"schemaVersion":1,"mode":"review-only"},
  "scenes":[
    {"id":"direction","kind":"example","semanticShot":{
      "environmentId":"street","shotType":"medium","cameraStyle":"static",
      "actorIds":["traveler"],"objectIds":[]
    },"visualBeats":[
      {"hero":"来","syncCueText":"приходит","semanticAction":{
        "type":"approach-camera","subjectId":"traveler","durationMs":500
      }},
      {"hero":"去","syncCueText":"уходит","semanticAction":{
        "type":"move-away","subjectId":"traveler","durationMs":600
      }}
    ]}
  ]
}
```
This is a structural example, NOT a real production Chinese transcript; `syncCueText` MUST be copied from the **actual spoken caption cue**, not inferred from the Hanzi on screen. The real episode must also have the existing episode/schema fields, exact verified `captionSource="gemini-word-timestamps"`, imported `captions[]` and `scene.startMs/endMs` to compile a timeline.

- `semanticShot` is an optional scene-level scene/actor/object/camera proposal, exclusively for lessons. Zero actor IDs is allowed; no ubiquitous student default.
- `semanticAction` is optional per visual beat, requires `semanticShot`, a declared subject ID and the existing `syncCueText`. `syncCueOccurrence` disambiguates repeated **spoken** words within the same scene (1-based). Missing/ambiguous/unmatched cues fail, never split a scene into equal intervals as fallback.
- All semantic action start frames are computed as `ceil(startMs * fps / 1000)`. Composition can be visible early, but meaningful motion **never** starts before the spoken cue. Nonsemantic legacy `beatEntryLeadFrames` is unchanged.
- Repeated spoken words require explicit occurrence, overlapping incompatible actions are rejected, action durations must fit the scene, and captions crossing scene bounds or containing multiple unseparated words are rejected for semantic scenes.
- Imported Gemini exact-token/narration validation is still performed by the existing code before any real render. No synthesis of missing cues. The compilation produces a review-only timeline passed into the actual Remotion review MP4 exporter; it never authorizes publishing.
- `scripts/semantic-visual-plan.mjs` exports `validateSemanticVisualEpisode` and `compileSemanticVisualTimeline`; `scripts/prepare-semantic-visual.mjs` is an **explicit standalone review command**. The normal review render now calls its strict compiler automatically and passes the result into the Remotion scene renderer. Social publication stays disabled via the canonical `productionEnabled:false` flag; no fallthrough to legacy visuals is permitted.
- Review output: `review/<episode-id>/visual-timeline.json` stores time/frame anchors, shot metadata, cue occurrence/index and separate source/timing SHA-256 fingerprints. This generated review sidecar is not canonical lesson data or an approval record.
- Modifying only semantic visual metadata invalidates both video exports and owner approval while retaining unchanged verified voice/cues. Approved or published records remain historical and untouched. Rendering and publication still require exact-preview owner approval.

The root config `reviewAutoEnabled:true` and `productionEnabled:false` is deliberate: auto-construct **review videos** only for eligible clean planned drafts on/after `reviewAutoFromDate`, never enable social publishing. P2's renderer supports the explicitly listed `previewSupportedActions` only and currently illustrates object IDs containing `door` or `gate`; unsupported actions/objects fail closed. Use `node scripts/semantic-render-fixture.mjs /tmp/semantic-props.json` and Remotion `still` for a **synthetic, non-publishable** 来/去 review. Do not switch on production until an actual audio+video pilot and owner review have passed.
