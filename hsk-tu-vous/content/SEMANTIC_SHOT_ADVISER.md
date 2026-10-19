# P3 shot adviser (read-only) and approved clean-draft applicator

The canonical vocabulary of evidence patterns and action proposals is
`content/semantic-shot-intents.json`. This is a *proposal* registry, not an additional
rendering, voice, or brand policy. Supported renderer action names are owned by
`content/semantic-visual-system.json`.

## Inputs and conservative behavior

The adviser reads the episode's original scene narration, then headline,
screenCaption, editPlan and episode topic **in that order**, using explicit
lexical evidence. Scene-local evidence outranks the broad topic. This avoids
forcing the same "student outside a building" composition on every scene.

It proposes **framing**, contextual setting and (only when explicitly
supported by narration) action candidates. Proposed action cues are drawn
from the *spoken-script text*, not from Chinese Hanzi or fabricated word
timestamps. Negated motion terms are excluded conservatively. Ambiguous
repetitions and missing visualBeats are flagged for editorial review.

The proposed metadata includes:
- `proposedShot` — environmentId, shotType, cameraStyle, actorIds, objectIds.
  Zero actor IDs is expected for pure grammar, object or comparison shots.
- `contextEvidence` — source field and the actual matched term.
- `actionCandidates[]` — proposed action, candidate cue token, its script
  token index, supporting narration, linked beat if unique, and an explicit
  Gemini-word-cue verification requirement. These are **NOT**
  `visualBeats[].semanticAction` fields.
- `unsupportedConcepts[]` — explicit warning, such as no visually correct
  swimmer motion yet available in the P2 renderer.
- `warnings[]` and `requiresOwnerReview:true`.

There is no silent fallback from a missing action/timestamp to equal-time beat
splitting. The same canonical lesson produces the same proposal. The adviser
must not mutate the episode, generate voice/audio, write review copies, change
CTA, modify calendar or publish to a social platform.

## Invocation

CLI:
```
cd hsk-tu-vous
npm run content:semantic-plan -- hui-vs-neng-pool-20261028
```

Connected local HSK AI MCP: `preview_semantic_shots({date:"2026-10-28"})`.
Both entrypoints **read** canonical planned lessons; they do not change them.
Automatic semantic **review video** rendering is now wired for eligible clean future drafts; social publishing is now eligible under the owner-authorized 2026-10-20 rollout, but each exact destination/video still requires separate final-preview owner approval.

## Editorial QA example

The 2026-10-28 会/能 lesson can suggest a pool environment and a closed-gate
warning on the narrator's `закрыт` word. It must **not** fake swimming,
infer a motion from `会`/ `不能` alone, or claim Chinese-language correctness
without source review. The auto-applicator can choose a supported motion automatically for an eligible clean future review draft only if its spoken cue is unnegated, unique and unambiguously attached to a beat. Real Gemini exact-word cue timing still gates the render; unmatched cues stop rather than making up the motion.

Approved/published snapshots and CTA histories remain untouchable. Any
owner-selected visual edit invalidates old video and exact preview approval,
but voice/caption timing is reusable if narration and its fingerprint stay
unchanged. A planned draft's review MP4 is not social publication approval. Production was enabled by explicit owner authorization, not merely proposal tests; exact-final-preview approval remains mandatory.
