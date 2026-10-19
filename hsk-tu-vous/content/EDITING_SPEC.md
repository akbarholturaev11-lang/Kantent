# HSK AI video editing rules

This is the shared edit and caption standard for every HSK AI short. The renderer values live in `content/visual-system.json`; `src/EpisodeComposition.tsx`, `src/NarrativeVisual.tsx`, and `src/CaptionOverlay.tsx` read those values directly.

## Frame and lesson layout

- Use the production canvas specified by the active renderer/global rules and the safe margins from `content/visual-system.json`. Keep all important text within those safe areas.
- Use the canonical colors in `content/visual-system.json`, with provenance in `content/reference-sources.md`. Place the HSK AI logo below the top app-overlay zone. The central stage is a transparent layout boundary, not a visible enclosing card or backplate. Use HeroUI only for small interface details inside the video, and use Pinterest/posts.design as creative references. Do not copy a reference's artwork or exact composition.
- Use one large central stage as the only content focus. Chinese text, pinyin, Russian meaning, a person/context cue, and captions share that open composition; never put a second illustration panel above it. Remove generic header chips, `ON AIR` labels/meters, and segmented progress rails. Keep only text and visuals that teach the spoken idea or perform the CTA.
- Show one teaching beat at a time. Keep Simplified Chinese, tone-marked pinyin, and Russian meaning together in the same stage. A person/context cue stays visually secondary to the large lesson word.
- Cut to the narration. For each named person, place, or action, set a matching `visualFocus` and exact imported word in `syncCueText`. Use the configurable beat-entry lead from `content/visual-system.json` so the new visual is readable as the cue begins. Use a teacher, older person, shopkeeper, or group only when the narration supports it.
- Do not hold one lesson composition through a multi-idea voice line. Use distinct semantic beats for important words: show the named object when it is spoken (such as a book or coffee), show the matching possession/absence visual on 有/没有, and return to the full phrase for the reading hold. Bind each beat to its exact imported cue; skip rapid adjacent cues that do not carry a new visual idea.
- Move between lesson beats with the configured crossfade or short eased slide from `content/visual-system.json`. Keep the outgoing and incoming frames readable during the transition; avoid sharp wipes and instantaneous vanish/reappear changes.
- Choose two or three caption styles per video using `captionStyleId`. Never show the styles simultaneously. Use ink text with no subtitle backing shape; distinguish styles through type size, weight, and position. `screenCaption` is a short lesson-card takeaway, never a second spoken subtitle.
- Use two or three UI treatments across the episode: kinetic type, an animated context cue, and a compact lesson/answer interface. Choose the treatment for the current narration beat; animate strokes and text reveals from Remotion frames. Never leave a context illustration as a separate static picture panel.
- Use HeroUI React v3 MCP as a reference for small interface details inside the video—such as a comment field, send control, comment row, or status badge. Do not redesign the project's own management UI or add HeroUI as a Remotion runtime dependency. Adapt useful details to HSK AI styling, then animate them with Remotion frames. Use posts.design as the owner's motion reference site; turn broad motion cues into original transitions rather than copying artwork or layouts.

## Semantic actions (P0/P1 foundation only)

The proposed semantic shot/action vocabulary and strict cue-time contract are defined in `content/SEMANTIC_VISUAL_SCHEMA.md`. P0/P1 validate cue timing, P2 supplies Remotion action visuals, and a connected auto-review workflow now produces **review MP4s** for eligible clean future drafts using verified Gemini word cues. A socially publishable semantic MP4 is **not** yet authorized. Distinguish composition appearing before a cue (permitted) from movement that *depicts* the spoken verb (must begin on the confirmed cue frame, not on the early storyboard beat lead). Reject unmatched/ambiguous cues; do not approximate them by equal scene division. Do not apply to CTA, prior approvals or published episodes.

### P3 semantic shot recommendations

A read-only adviser may propose scene-specific environments, framing and meaningful movements backed by actual authored narration; see `content/SEMANTIC_SHOT_ADVISER.md`. Visual variety does not justify random gestures. An unimplemented action (e.g. swimming) must be flagged for a new asset/renderer pass rather than faked using another gesture. Do not apply an advised `syncCueText` as verified until it matches imported Gemini word timestamps. This planning does not alter production rules or render approval.

## Cinematic storyboard scenes (opt-in)

For a future, unapproved HSK lesson, a `scene.storyboard` can select an original illustrated location and character treatment; the renderer draws all shapes procedurally, without pretending they are documentary footage. Keep context art secondary in the upper part of the vertical canvas, Hanzi/pinyin/Russian meaning readable in the open central stage, and the existing word-timed caption layer at its approved position. Animate only from Remotion frames. Do not use storyboard on CTA scenes or the existing approved/published lesson snapshots; keep the existing single focus, timings, approved screenshots and central CTA intact. Pilot layouts live in `content/visual-system.json#storyboardLayout` and format selection in `content/creative-formats.json`. Before claiming a lesson is complete, inspect real rendered frames and verify the approved voice + SRT/VTT export.

Apply these defaults when creating cinematic teaching scenes or making owner-requested revisions:

- Make the illustrated frame feel alive with gentle camera drift, character bob/sway and narration-relevant gestures. Combine one dominant teaching action with restrained ambient movement, keeping the words readable. Read motion amounts from `content/visual-system.json#storyboardLayout`.
- Give Chinese teaching text a short, decaying entrance quiver and a settled reading hold. Use the canonical `heroQuiverPx` and `heroQuiverDeg` tokens. When a beat uses a drawing or text reveal, let the reveal unfold visibly in time with its spoken cue before holding the completed form.
- Keep 在 and all other Hanzi compact and lower in the teaching composition, with pinyin and Russian meaning grouped below. The active `hanziScale` and `heroTopPx` tokens in `content/visual-system.json#storyboardLayout` own their size and vertical position; apply them consistently to every Chinese teaching beat. Preserve caption separation and phone readability.

## Motion and effects

| Moment        | Rule                                                                                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First hook    | Start with the promised subject already visible. Use a calm reveal or short eased slide; no flash, pulse, or opening sound cue.                                                                                 |
| Scene change  | Ease into the new lesson composition with a short crossfade. Use one soft cut cue after the opening scene; keep it under the narration.                                                                          |
| Teaching beat | Change the contextual illustration and lesson composition on the matching spoken cue. Use one short eased slide or reveal per idea change. Keep movement small and settle the frame before the next idea.       |
| CTA           | Follow the currently approved CTA in `content/cta-lab.json` and its visual sequence in `content/CTA_LAB.md`. Match each visual action to its spoken cue. |
| Reference motion | Use posts.design motion references only when relevant to the current approved episode/CTA. Do not resurrect previously superseded comment/DM UI or reproduce another author's artwork. |

- Use one main movement per beat. The spoken word activates the matching caption and context cue. Keep ambient motion slow inside the centered open stage; do not add flash, strobe, bright sweep, glitch, or per-word pulsing.
- CTA uses one large open central composition. Read the current offer and action sequence from `content/cta-lab.json` and `content/CTA_LAB.md`. Change each visual on the matching spoken cue and highlight the relevant action. Do not stage real taps or claim the app was downloaded. Keep the full spoken CTA in the timed captions instead of repeating it in a headline chip.
- Use two or three CTA transition treatments when their beat timing supports them: type-reveal for the HSK AI intro, slide-match for the profile and website screens, and mask-reveal for the profile-link overlay. Keep every transition driven by Remotion frames and shared tokens in content/visual-system.json; never reuse source footage, artwork, or an exact layout.
- For Instagram and YouTube, use the owner-supplied screenshots required by the current CTA Lab and time them to the spoken action words. For TikTok's approved manual-DM variant, use cue-synced kinetic typography and eased type-reveal, slide-match, or mask-reveal effects instead of screenshots; do not simulate a sent DM or completed download.
- Do not use flash or strobe anywhere in the video, including the opening hook. Avoid bright sweep overlays, rapid zoom, glitch, and repeated bounce; use eased opacity and small positional changes for smooth motion.
- Use a quiet instrumental bed under the narration when the episode has a resolved music asset. Use the music volume and fades from `content/visual-system.json`; keep speech clearly dominant. Do not use SFX as a music substitute. Use the generated soft cut only at scene changes after the hook and at most two quiet soft taps per scene for meaningful teaching transitions. Keep effects below the narration; do not add a cue to every word or decorative beat.
- Drive all animation from Remotion frames. Do not use CSS time-based transitions or animations.

## Russian captions

- Use the exact narration and Gemini Transcribe word timings produced through the approved provider in `content/voice-profile.json`. The import step must confirm a normalized exact-token match; do not move timings by hand to fit a changed script.
- Group adjacent word cues into readable phrases using the current limits and hold timings in `content/visual-system.json`. Never stretch captions across unrelated speech.
- Keep captions as high-contrast ink text without backing shapes. Use the caption safe areas, variants and positions from `content/visual-system.json`, including the CTA-specific placement to avoid covering screenshots.
- Keep one or two short lines on screen at a time. Do not cover Hanzi, pinyin, Russian meaning, the HSK AI logo, or the final CTA. If the available timed cues cannot fit clearly, stop and ask for a cleaner export; do not shrink text below the configured size.
- Burn the same scene-bounded phrase pages into the MP4 and write those same pages to `captions.srt`. Each scene's style range follows imported audio timestamps. A script edit requires a fresh matching MP3 and word-timed caption export before rendering.

## Review before delivery

For each render, check cue-accurate cutaways, a hook-matched first frame, consistent caption styles, correctly paired Chinese examples and pinyin, safe audio levels, a readable CTA, and that the full scenario and narration finish cleanly. For cinematic scenes, also inspect the living context motion, timed entrances/reveals, and compact lower Hanzi placement against the canonical storyboard tokens. There is no fixed duration cap. A visual, caption, or sound edit invalidates the previous MP4 and package approval; render and review the new version before approval.
