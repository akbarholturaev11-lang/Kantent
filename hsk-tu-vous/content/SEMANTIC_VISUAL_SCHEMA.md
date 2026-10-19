# Semantic visual contract (v1; review-only foundation)

Current state: **P0/P1 validation plus P2 opt-in Remotion still-frame preview renderer**. Production semantic MP4, live Gemini validation and publishing remain disabled. Do not claim publishable semantic MP4s exist. See `plans/SEMANTIC_VISUAL_STORYTELLING_PLAN.md` for P0–P5.

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
- Imported Gemini exact-token/narration validation is still performed by the existing code before any real render. No synthesis of missing cues. The compilation produces a review-only sidecar, not finished animation.
- `scripts/semantic-visual-plan.mjs` exports `validateSemanticVisualEpisode` and `compileSemanticVisualTimeline`; `scripts/prepare-semantic-visual.mjs` is an **explicit standalone review command**. It will not run in normal production yet. Semantic-tagged episodes cannot accidentally render with legacy visuals: production render must block them until P2.
- Review output: `review/<episode-id>/visual-timeline.json` stores time/frame anchors, shot metadata, cue occurrence/index and separate source/timing SHA-256 fingerprints. This generated review sidecar is not canonical lesson data or an approval record.
- Modifying only semantic visual metadata invalidates both video exports and owner approval while retaining unchanged verified voice/cues. Approved or published records remain historical and untouched. Rendering and publication still require exact-preview owner approval.

The root config `productionEnabled:false` is deliberate. Do not switch it on before implementing and testing the P2 semantic renderer and a real audio+video pilot.
