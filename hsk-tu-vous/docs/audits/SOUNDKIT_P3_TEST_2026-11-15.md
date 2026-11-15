# HSK AI SoundKit — P3 exact imported voice and visual cue binder audit

**Status:** P3 binder **implemented as explicit offline TEST ONLY tooling** on feature branch `feat/sound-design-phase0-kenney-audit-20261115`, PR #72. **No final-video SFX and no real Gemini A/B accepted yet.** P4–P6 have NOT been implemented or enabled.

Source decisions: SoundKit plan in PR #71; P0/P1 audit `SOUND_DESIGN_BASELINE_2026-11-15.md`, P2 audit `SOUNDKIT_P2_TEST_2026-11-15.md`.

## Real timeline and audio sources — do not invent

- `scripts/cue-timeline.mjs#assertCueTimelineMatches`: verifies episode ID, RU/TJ languageCode, voiceTextHash, source audio SHA-256, exact word cue list, canonical source snapshot, 30fps and scene IDs.
- `scripts/motion-design-plan.mjs#resolveMotionBeats`: derives each actual lesson/series teaching cue from imported word spans, cue occurrence and ordered caption index; never evenly spaces beats.
- `scripts/promo-visual.mjs#resolvePromoCue`: derives the authentic ad scene's actual visual cue from the same word captions and visible `promoVisual.cueText`.
- `scripts/voice-import-state.mjs`: original imported approved voice file hash verification; P3 CLI recomputes the real on-disk source audio SHA-256 and checks current language voice profile. Do not call anything an imported Gemini audio test unless the original bytes actually exist and pass these gates.
- Existing `render-episode.mjs` and `render-tiktok-review.mjs` write `cue-timeline.json` for **distinct** per-language/shared versus TikTok source voice takes. P3 must read these already saved timetables, never simulate one.

## P3 files and behavior

1. `scripts/sound-kit-cue-plan.mjs` (pure): receives Codex's P2 source-scoped decision, the exact source-linked brief, current imported-voice-backed episode and cue timeline and a verified sound asset byte hash map. Validates all fingerprints, checks visual event IDs and actual spoken source match the P2 brief. It re-resolves and compares each chosen word anchor with the canonical episode/timeline source before producing any output.
2. For lessons, each SFX choice must link to one real `motionBeats[].id` and its `resolveMotionBeats` caption index/start timestamp; for advertisements it binds to precisely the original `promoCue` and authentic visual entrance. The same speaker-timed P2 plan cannot reuse Russian word timings for Tajik.
3. The binder clamps a proposed effect's **TEST metadata duration** to the next verified visual cue, end of current scene, original voice end and first CTA boundary. Clip frame offsets use the source's 30 fps exact timeline. It refuses invalid missing bounds, order, stale captions, altered asset data, unverifiable SFX, crossing the CTA, or missing speech anchor. **This is NOT authorizing actual audio truncation, mixing, loudness or playback**: P4 decides how to render audible clips after separate review.
4. `scripts/codex-soundkit-bind.mjs` (explicit optional CLI): reads existing review `episode.json`, `cue-timeline.json`, the recorded actual source-audio bytes, current approved voice profile, independently hashed selected Kenney WAV bytes, and Codex's validated P2 decision. It rejects owner-approved/published packages before writing any experimental output. Writes only isolated source fingerprint-bound `cue-plan-shared.json` / `cue-plan-tiktok.json` under `review/sound-design-tests/<id>/<ru|tg>/`.
5. `package.json`: `npm run content:soundkit:bind -- <episode-id> --language=ru|tg --platform=shared|tiktok`.
6. `content/sound-design.json#phase3Timing` and `content/WORKFLOW.md` document this as a manual, post-voice P3 step. No default render path or main audio token owns SoundKit timing or references these experimental files.

## Correct execution order (no paid regeneration)

1. Existing production generates its **one approved voice take** and verifies transcribed word timestamps as usual. Do not use a synthetic tone/fixture as a substitute.
2. `content:make`, `prepare_today_video` or `prepare_video_for_date` creates independent Codex RU/TJ P2 TEST briefs. Codex (not a random selector) chooses relevant CC0 SFX references **or SILENCE**, writes per-scene reasons and exact source visual/narration evidence.
3. Validate the actual creative choice with `npm run content:soundkit:test -- <id> --language=ru --validate` and repeat for TG.
4. If the real review already has `episode.json` and `cue-timeline.json` plus the already-verified imported voice bytes, run:
    - `npm run content:soundkit:bind -- <id> --language=ru --platform=shared`
    - `npm run content:soundkit:bind -- <id> --language=tg --platform=shared`
    - `--platform=tiktok` separately for each actual language's independently voiced TikTok package (never borrow the shared version).
5. Confirm the resulting TEST metadata has truthful source voice SHA-256, selected sound SHA-256, exact captionIndex, cue.startMs and startFrame; **do not feed the output to Remotion yet**. Review only the intent, not audio quality.

If no valid P2 Codex decision, audio, approval, current per-language timeline, source media file or source hash exists, **P3 must report BLOCKED**. These are intentional provenance checks, not reasons to purchase new Gemini voices or invent timestamps.

## Audited CI and limitations

- [SoundKit P3 exact cue binder CI run #43692581245 — SUCCESS](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/43692581245), covers **synthetic fixture tests only**, including authentic project cue resolver logic, lesson/promo anchors, injected wrong timestamps, old/changed voice SHA, forbidden opening/CTA, falsified asset hash, deliberate SILENCE and separate TikTok platform identity.
- P2 selection CI and read-only CC0 import CI must also remain green.
- CI explicitly inspects current Remotion runtime source for accidental `SoundKit` imports. P3 is not connected to the production render or MP4 packaging.
- **No real imported RU/TG Gemini voice A/B was available in CI**. Unit tests use explicitly synthetic, hashed fake voice bytes and timestamps to exercise the contract. This passes engineering correctness only, not acoustic intelligibility, gain, LUFS or final approved video playback.
- A JSON `chosenBy:Codex` assertion is an integrity convention, not cryptographic authorship proof. The creative decision still belongs to the existing video-production Codex agent, not a new LLM API.
- The two CC0 mirror packs have 151 files rather than exactly 150; P3 trusts only the pinned SHA-256 subset established in P1.
- Future P4 must prevent double triggering old `soft-cut`/`soft-tap`, apply voice-first gain staging and run full mix QA (including output peak/headroom) without modifying source take. P5/P6 require measured real video sound and owner A/B listening/acceptance before any default production usage.

**Release gate:** P3 engineering work may be merged as isolated TEST-only tooling after complete green source CI; real voice-bound end-to-end evidence remains an explicit OPEN acceptance gate before P4 rollout or making any actual sound in a video.
