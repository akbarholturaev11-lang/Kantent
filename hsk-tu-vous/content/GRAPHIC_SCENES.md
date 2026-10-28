# Declarative teaching drawings

This is the drawing contract for `explain-actions-v1`'s `graphic` beat. Presentation rules remain in `EDITING_SPEC.md`; episode structure and invalidation remain in `EPISODE_SCHEMA.md`. The scenario-authoring agent defined in `WORKFLOW.md` writes drawings alongside the narration, before voice generation. There is no separate text-model author or critic. The existing Remotion engine renders the drawings locally; no new provider, dependency or generated JavaScript is needed.

Keep each language's authored cues and imported word timestamps independent under the localization contract in `EPISODE_SCHEMA.md`. Geometry may be shared where its meaning is unchanged; copied source-language cue text or timing is not a localized motion plan.

## Authoring procedure

1. Identify the real objects, actions and changes in the narration. Write an `explains` rationale and exact spoken `cueText` for every change. Preserve the learning point and verified narration.
2. Use existing quantity/number/ordinal models where they fit. For a new object or action, author a `graphic` drawing. Write the actual geometry and movement, not prose such as “show a swimmer”. `content/visual-examples/swimming-and-gate.json` provides reusable technical drawings without voice or production approval.
3. Validate before TTS. After genuine word timestamps are imported, keyframes start at the exact spoken anchor. `atMs` is elapsed time since that anchor; it never replaces the imported cue. A later beat selects a new drawing state and stops the preceding tracks.
4. Inspect start, moving and settled poses, then their transitions in the real MP4 with actual narration. Apply the pass/fail review in `EDITING_SPEC.md#Review before delivery`; repair missing/misleading details and repeat the affected render. Mechanical checks do not prove teaching meaning, visual quality or phone readability.

## Object-recognition bar

A drawing must read as its named object/action from its silhouette, meaningful details and context at the rendered phone size. Do not rely on an extra headline, tiny labels, or a subtitle to turn generic shapes into the intended scene. Scale the hero until its parts and action are visible; if that no longer fits, split the explanation across cue-linked beats instead of shrinking the subject.

For example, a pool comparison needs a contained water basin with a visible rim, lane/water details, a swimmer whose head/body/limbs can be distinguished, and a visibly different closed state such as a gate or lane barrier. Wave lines that spill between flat green rectangles, a tiny swimmer, or a large unexplained X do not establish “pool / swimming / closed.” Keep both pools' details inside their own outlines. Preserve the spoken comparison by changing the pool state, not by changing unrelated colors. `content/visual-examples/swimming-and-gate.json` is a technical geometry reference; still inspect the actual localized MP4 at full frame and 270×480, since a valid example or schema is not proof of readability.

## Payload

For a real-voice diagnostic after importing matching audio/cues, run:

```sh
node scripts/graphic-voice-proof.mjs <episode-id> <scene-id> <drawing-plan.json>
```

The plan contains `motionBeats`, optionally bound to `episodeId`/`sceneId`; `content/visual-examples/cafe-word-cues.json` is an example for the existing tea lesson hook. The helper validates the drawing, real cue matches and hold policy, then renders a low-resolution technical fragment under the selected language's `review/` folder. It reuses the approved matching voice, includes the last complete word even when it crosses a scene boundary, and stops before the next phrase. It never writes the source episode, changes narration/cues, generates a new voice or creates a publication package. Its verification sidecar records the original audio hash and actual anchors. Inspect the fragment with sound before treating the new drawing as visually reviewed.

Each beat is `{id,kind:"graphic",cueText,cueOccurrence?,explains,visual}`. `visual` keeps the usual `title`, `hanzi`, `pinyin`, `meaning` alignment metadata and adds:

```json
{
  "graphic": {
    "width": 820, "height": 400,
    "nodes": [
      {"id":"object","type":"g","attrs":{},"x":180,"y":200},
      {"id":"body","parentId":"object","type":"circle",
       "attrs":{"cx":0,"cy":0,"r":60,"fill":"gold"}}
    ],
    "tracks": [
      {"nodeId":"object","property":"x",
       "keyframes":[{"atMs":0,"value":180},{"atMs":1200,"value":550}]}
    ]
  }
}
```

The moving circle above demonstrates syntax; it is not a generic replacement for a spoken person/action.

- Node types: `g`, `path`, `circle`, `ellipse`, `rect`, `line`, `polyline`, `polygon`. An optional `parentId` references an earlier group. Missing parents, duplicate IDs and cycles are rejected.
- `attrs` holds the shape's geometry and paint: `fill`, `stroke`, `strokeWidth`, `strokeLinecap`, `strokeLinejoin`. Color tokens are `foreground`, `muted`, `secondary`, `red`, `gold`, `teal`, `poolDeck`, `poolWater`, `poolRipple`, `none`, resolved from the active design system.
- Node `x`, `y`, `rotate`, `scale`, `opacity` set its base transform. Tracks override a selected property using increasing `{atMs,value}` keys beginning at zero. Group rotation uses its local origin; place joints at the intended arm/leg pivot and nest groups for coordinated movement.
- An optional closed `loop:true` supports continuous meaningful movement. Flashing opacity/scale loops and constant tracks are rejected. All animation is frame-driven and seek-safe.
- A `graphic` cannot mix legacy object/count/value/choice/model payloads. Use multiple nodes or separate beats.
- Drawings cannot contain text, images, HTML, scripts, external resources or arbitrary attributes. Spoken text stays in the existing single subtitle. Do not draw headlines as paths to bypass that rule.

Executable limits live in `scripts/graphic-scene.mjs` and its MCP input schema in `scripts/graphic-scene-schema.mjs`. Invalid drawings have no fallback.

## Visible coverage and timing

The active gate/date and longest permitted unchanged visual hold are in `visual-system.json#lessonPresentation`. Covered new lessons need genuinely drawable states and at least two distinct graphic presentations per scene. Planning titles, meanings, Hanzi, pinyin and arbitrary drawing IDs are excluded from visible-state comparison.

After exact word-cue resolution, unchanged intervals are measured from the first scene frame to its end. Metadata-only edits do not reset the timer. A hold beyond the configured limit blocks rendering and requires a meaning-linked change at an existing spoken cue. Do not add decorative filler or alter speech timing. The intervals are saved with the motion timeline. Earlier reviewed examples retain their historical policy.
