# Semantic visual contract (v1; owner-authorized publication eligibility)

Current state: **automatic new-draft semantic composition and Gemini-word-anchored Remotion review MP4 pipeline**. The owner reported satisfactory real-video QA and explicitly authorized semantic production on 2026-10-20. Publishing remains subject to a separate exact-final-preview owner approval for each post. A synthetic still-frame test is not a verified narrated video. See `plans/SEMANTIC_VISUAL_STORYTELLING_PLAN.md` for P0–P5.

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
- Imported Gemini exact-token/narration validation is still performed by the existing code before any real render. No synthesis of missing cues. The compilation produces an internal `mode:"review-only"` timeline passed into the Remotion review MP4 exporter. The timeline marker itself never authorizes a social post.
- `scripts/semantic-visual-plan.mjs` exports `validateSemanticVisualEpisode` and `compileSemanticVisualTimeline`; `scripts/prepare-semantic-visual.mjs` is an **explicit standalone review command**. The normal review render now calls its strict compiler automatically and passes the result into the Remotion scene renderer. The canonical `productionEnabled:true` removes only the extra semantic-specific publishing block; exact platform previews, current CTA and media-hash checks remain mandatory, and no fallthrough to legacy visuals is permitted.
- Review output: `review/<episode-id>/visual-timeline.json` stores time/frame anchors, shot metadata, cue occurrence/index and separate source/timing SHA-256 fingerprints. This generated review sidecar is not canonical lesson data or an approval record.
- Modifying only semantic visual metadata invalidates both video exports and owner approval while retaining unchanged verified voice/cues. Approved or published records remain historical and untouched. Rendering and publication still require exact-preview owner approval.

The root config `reviewAutoEnabled:true` and `productionEnabled:true` allows review videos only for eligible clean planned drafts on/after `reviewAutoFromDate`, while an actual social post always requires a separate exact-owner-approved final preview. P2's renderer supports the explicitly listed `previewSupportedActions` only and currently illustrates object IDs containing `door` or `gate`; unsupported actions/objects fail closed. Use `node scripts/semantic-render-fixture.mjs /tmp/semantic-props.json` and Remotion `still` for a **synthetic, non-publishable** 来/去 review. The owner explicitly authorized production after reporting a satisfactory real-video trial on 2026-10-20; synthetic tests alone do not authorize a post.
