# HSK AI SoundKit P4 — isolated Remotion audio mix preview audit

**Status:** P4 engineering implementation and **synthetic** AAC A/B verification COMPLETE on isolated feature branch; **real imported Gemini voice A/B and P5/P6 quality/owner approval OPEN**.

Project: `akbarholturaev11-lang/Kantent/hsk-tu-vous`.
PR: [#72](https://github.com/akbarholturaev11-lang/Kantent/pull/72) — **DRAFT**.
Prior evidence: `SOUND_DESIGN_BASELINE_2026-11-15.md`, `SOUNDKIT_P2_TEST_2026-11-15.md`, `SOUNDKIT_P3_TEST_2026-11-15.md`.
Authority: `AGENTS.md`, `content/WORKFLOW.md`, `content/EDITING_SPEC.md`, `content/visual-system.json#sound`.

## P4 implementation

1. `scripts/sound-kit-render-plan.mjs` and `.d.mts`: browser-safe, fail-closed Remotion plan validation. The plan must specify `TEST_ONLY`, false production/owner-approval flags, current imported voice/locale/text SHA, exact 30fps compiled cue timeline, verified cue frame, protected first-scene/CTA exclusions, one non-overlapping clip per selected source, SHA-named temporary WAV and very low scene-token-derived gain.
2. `src/EpisodeComposition.tsx`: **one optional** `soundKitRenderPlan` prop. If **absent**, production behavior is unchanged: original soft-cut/soft-tap sound cues, original voice, music and captions all follow the original code. If **present and validated**, only selected SoundKit WAV refs are layered as `<Sequence><Audio>` at the actual spoken cue frame with a two-frame fade-in/out. The old soft-cut/tap effects are suppressed **ONLY in the opt-in preview** to prevent double trigger. Speech is never regenerated or altered. Voice and BGM remain the same approved source/current mix.
3. `scripts/codex-soundkit-render-test.mjs`: explicit test-only isolated preview creator. **Requires** `HSK_AI_SOUND_DESIGN_TEST=1`, current owner-approved voice profile, already produced P2 Codex decision, already bound P3 word-cue plan, exact original episode/timeline, current source WAV SHA-256, original Gemini audio byte SHA-256. It recomputes P3 for the actual requested platform and rejects stale/wrong-locale/TikTok assets rather than reuse, guesses or regeneration. Real `instagram/youtube/facebook` review packages may share the existing word-cue plan only if their canonical timeline matches; `tiktok` must use its own independent voice+CTA and P3 file.
4. The preview CLI stages only the selected SHA-verified WAV(s) in `public/soundkit-p4-preview-*/`, cleans them in `finally`, and writes a new isolated `review/sound-design-tests/<id>/<ru|tg>/p4-preview/<platform>/p4-audio-test.mp4` and `p4-report.json` (ignored by Git). It does **NOT** write normal `review/<id>/video.mp4`, CTA registrations, approvals, scheduled posts, published posts or audio profiles.
5. CLI: `HSK_AI_SOUND_DESIGN_TEST=1 npm run content:soundkit:render:test -- <id> --language=ru --platform=instagram`, then repeat for required TG/other platform ONLY where an existing real, unapproved imported-voice review package exists. Without the flag or real media, it must fail closed. The test is not called by normal video/MCP scheduled producers.
6. Canonical `content/sound-design.json` now distinguishes experimental test mix implementation from `productionAudioMixEnabled:false`; `content/visual-system.json#sound` still owns all canonical numeric mix values. No new AI API, sound generation, TTS payment or framework dependency.

## Verified technical QA

- [P4 Remotion synthetic AAC A/B CI #43694666738 — **SUCCESS**](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/43694666738). The early version failed because a synthetic CTA lacked legitimate CTA Lab content; fixture was fixed by creating a **CTA-free synthetic engineering smoke** rather than forging an approved CTA. The revised run passed.
- **27 adversarial source/cue tests passed**, with TypeScript + ESLint + `check:consistency` passing.
- Real FFmpeg generated a five-second tone as **SYNTHETIC stand-in for voice** and a 0.15-second short test SFX. Remotion rendered baseline and TEST-only candidate to separate AAC outputs; FFmpeg decoded both to 48kHz PCM; both retained speech audio and matched duration within a small AAC rounding tolerance. Between 1.5–1.7s, the absolute sample-difference sum was **182,036** (arbitrary PCM test metric), demonstrating **actual sound changes at the intended cue**. This number is NOT LUFS, dBTP or proof of professional mixing.
- Temporary synthetic voice/SFX were cleaned by CI. The original `public/sfx/` files, pinned source Kenney asset folder, official review packages and voice profiles were not modified.
- Separate P2, P3, 151-WAV asset integrity, canonical source and existing video-review CI must also pass before considering PR stable.
- SFX test gain = half the smaller canonical `sceneCueVolume`/`beatCueVolume`, capped at 0.045 (for current 0.08 and 0.09 defaults, 0.04). This is an **audition engineering default**, not a calibrated mix loudness guarantee.

## P4 limitation / remaining gates

- **No real Gemini RU or TG source voice has been auditioned with the new selected SFX in CI.** The CLI will refuse to run if the current real imported voice and actual P3 decision are missing; the existing CI test uses deliberately artificial tones.
- No realistic music+voice+SFX real-platform test, loudness normalization, true-peak and clipping audit, listener test on iPhone speaker/headphones or confirmation of Mandarin tone clarity. These are **P5**.
- No owner approval of full videos or official application of SFX to production videos. Exact video approval remains P6; publishing a test file is forbidden.
- The P4 preview replaces old effect taps when opted in. This means a **SILENCE-only** experimental selection deliberately yields only original voice/BGM, rather than preserving legacy soft cues. The default production audio still keeps those original cues.
- Shared-voice platforms have the same approved take but their CTA endings differ. P4 preview renders each requested existing platform snapshot separately (not an optimized shared-body render), which is an isolated audition method and **not** a change to normal continuous-audio platform packaging.
- If an on-disk source/approval/locale/timing hash no longer matches P3, fail instead of forging the right test. A synthetic test-only AAC passing is **not** an authorization to enable SOUND DESIGN by default.

**Release status:** P4 is prepared for optional internal review on this branch. P5 objective real-audio QA and P6 exact RU/TJ owner listening/sign-off remain required before any normal video receives a SoundKit soundtrack.
