# HSK AI video editing rules

This is the shared edit and caption standard for every HSK AI short. The renderer values live in `content/visual-system.json`; `src/EpisodeComposition.tsx`, `src/NarrativeVisual.tsx`, and `src/CaptionOverlay.tsx` read those values directly.

## Frame and lesson layout

- Export vertical 9:16 at 1080×1920, 30 fps. Keep all important text at least 80 px from the edges.
- Use the HSK-AI-Bot app palette from `content/reference-sources.md`: paper `#FDF9F0`, white surface `#FFFFFF`, ink `#211D17`, secondary `#665D50`, line `#EAE0CC`, cinnabar `#E04A40`, jade `#2FA06A`, and gold `#E9A916`. Place the HSK AI logo below the top app-overlay zone. The central stage is a transparent layout boundary, not a visible enclosing card or backplate. Use HeroUI only for small interface details inside the video, and use Pinterest/posts.design as creative references. Do not copy a reference's artwork or exact composition.
- Use one large central stage as the only content focus. Chinese text, pinyin, Russian meaning, a person/context cue, and captions share that open composition; never put a second illustration panel above it. Remove generic header chips, `ON AIR` labels/meters, and segmented progress rails. Keep only text and visuals that teach the spoken idea or perform the CTA.
- Show one teaching beat at a time. Keep Simplified Chinese, tone-marked pinyin, and Russian meaning together in the same stage. A person/context cue stays visually secondary to the large lesson word.
- Cut to the narration. For each named person, place, or action, set a matching `visualFocus` and exact imported word in `syncCueText`. Begin the context animation and lesson beat four frames before its VTT cue so the new visual is readable as the word starts. Use a teacher, older person, shopkeeper, or group only when the narration supports it.
- Do not hold one lesson composition through a multi-idea voice line. Use distinct semantic beats for important words: show the named object when it is spoken (such as a book or coffee), show the matching possession/absence visual on 有/没有, and return to the full phrase for the reading hold. Bind each beat to its exact imported cue; skip rapid adjacent cues that do not carry a new visual idea.
- Move between lesson beats with a gentle 8–12 frame opacity crossfade or short eased slide. Keep the outgoing and incoming frames readable during the transition; avoid sharp wipes and instantaneous vanish/reappear changes.
- Choose two or three caption styles per video using `captionStyleId`. Never show the styles simultaneously. Use ink text with no subtitle backing shape; distinguish styles through type size, weight, and position. `screenCaption` is a short lesson-card takeaway, never a second spoken subtitle.
- Use two or three UI treatments across the episode: kinetic type, an animated context cue, and a compact lesson/answer interface. Choose the treatment for the current narration beat; animate strokes and text reveals from Remotion frames. Never leave a context illustration as a separate static picture panel.
- Use HeroUI React v3 MCP as a reference for small interface details inside the video—such as a comment field, send control, comment row, or status badge. Do not redesign the project's own management UI or add HeroUI as a Remotion runtime dependency. Adapt useful details to HSK AI styling, then animate them with Remotion frames. Use posts.design as the owner's motion reference site; turn broad motion cues into original transitions rather than copying artwork or layouts.

## Motion and effects

| Moment        | Rule                                                                                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First hook    | Start with the promised subject already visible. Use a calm reveal or short eased slide; no flash, pulse, or opening sound cue.                                                                                 |
| Scene change  | Ease into the new lesson composition with a short crossfade. Use one soft cut cue after the opening scene; keep it under the narration.                                                                          |
| Teaching beat | Change the contextual illustration and lesson composition on the matching spoken cue. Use one short eased slide or reveal per idea change. Keep movement small and settle the frame before the next idea.       |
| CTA           | Follow the owner-approved path in order: try HSK AI, go to the Instagram profile, open its link, then download the app from the website. Match the profile, links overlay, and website screenshots to the spoken cues and highlight the exact row/button. |
| Reference motion | The opened posts.design “Folder animation” preview inspires a brief layered-sheet unfold when the sent comment row appears. Apply it only to that meaningful UI reveal, in the same central footprint as the composer; do not reproduce the source artwork or add a second panel. |

- Use one main movement per beat. The spoken word activates the matching caption and context cue. Keep ambient motion slow inside the centered open stage; do not add flash, strobe, bright sweep, glitch, or per-word pulsing.
- CTA uses one large, open central composition. Follow the owner-approved route in order: try HSK AI, visit the Instagram profile, open its link, then download the app from the website. Change each visual on the matching spoken cue and highlight the exact link row or download button. Do not stage real taps or claim the app was downloaded. Keep the full spoken CTA in the timed captions instead of repeating it in a headline chip.
- Use two or three CTA transition treatments when their beat timing supports them: type-reveal for the HSK AI intro, slide-match for the profile and website screens, and mask-reveal for the profile-link overlay. Keep every transition driven by Remotion frames and shared tokens in content/visual-system.json; never reuse source footage, artwork, or an exact layout.
- Use the owner-supplied full screenshots for the current CTA. Keep them legible in the same central stage, preserve screenshot content, and time highlights to “Зайди”, “Открой”, and “скачай”. Keep spoken captions below tall CTA screenshots with the ctaFooter style so screenshot text stays unobstructed. These visuals show the route only; do not imply that a real link was opened or that an app download finished.
- Do not use flash or strobe anywhere in the video, including the opening hook. Avoid bright sweep overlays, rapid zoom, glitch, and repeated bounce; use eased opacity and small positional changes for smooth motion.
- Use a quiet instrumental bed under the narration when the episode has a resolved music asset. Set its volume to `0.07` with a short fade-in and fade-out; keep speech clearly dominant. Do not use SFX as a music substitute. Use the generated soft cut only at scene changes after the hook and at most two quiet soft taps per scene for meaningful teaching transitions. Keep effects below the narration; do not add a cue to every word or decorative beat.
- Drive all animation from Remotion frames. Do not use CSS time-based transitions or animations.

## Russian captions

- Use the exact Russian narration and word timings exported manually from `text-to-speech.online`. Do not create timings through a transcription API or move timings by hand to fit a changed script.
- Group adjacent word cues into quick readable phrases: at most two words, 32 characters, 1.25 seconds, and a 250 ms gap. Hold the final word for up to 100 ms, stopping sooner when the next phrase begins.
- Keep captions high-contrast ink text with no backing shape and inside the 82 px side safe area. Use the configured differences in type size, weight, and position. Main captions sit at 1300 px; place ctaFooter at 1660 px below the tallest CTA screenshot, to keep the source UI readable.
- Keep one or two short lines on screen at a time. Do not cover Hanzi, pinyin, Russian meaning, the HSK AI logo, or the final CTA. If the available timed cues cannot fit clearly, stop and ask for a cleaner export; do not shrink text below the configured size.
- Burn the same scene-bounded phrase pages into the MP4 and write those same pages to `captions.srt`. Each scene's style range follows imported audio timestamps. A script edit requires a fresh matching MP3 and word-timed caption export before rendering.

## Review before delivery

For each render, check that every cutaway changes on the matching spoken cue, the first frame matches the hook, only two or three caption styles appear, Chinese examples remain paired with pinyin and meaning, effects do not drown the voice, the CTA has a still reading hold, and the video remains 25–35 seconds. A visual, caption, or sound edit invalidates the previous MP4 and package approval; render and review the new version before approval.
