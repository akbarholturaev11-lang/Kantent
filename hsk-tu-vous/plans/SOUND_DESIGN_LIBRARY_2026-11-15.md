# HSK AI Sound Design Library — complete implementation plan

Status: **P0–P4 IMPLEMENTED AS TEST-ONLY ENGINEERING; P5–P6 OPEN.** Original plan dated 2026-11-15.
Original planning branch: planning/sound-design-library-20261115 (PR #71); working implementation: feat/sound-design-phase0-kenney-audit-20261115 (PR #72).
Scope: Kantent/hsk-tu-vous; plan was drafted against main 3ac50097aa2e3aa649cea28962234aa69d081726. The status immediately below supersedes the historical planning-only statements in later sections.
Owner goal: provide a legitimate reusable professional SFX library and allow Codex to design a tasteful, meaning-synchronized soundscape for EACH new video, without changing approved narration, CTA or publication permissions.

## Progress ledger (implementation vs. original plan)

- **P0 — completed:** Existing 19 MP3/17 unique blobs and two baseline soft WAVs audited, licensing uncertainty documented; see `docs/audits/SOUND_DESIGN_BASELINE_2026-11-15.md`.
- **P1 — verified pinned mirror implementation:** The official Kenney ZIP URLs returned HTML; owner-approved alternative GitHub Godot mirror snapshots yielded **51 UI Audio WAVs plus 100 Interface Sounds WAVs = 151 unique SHA-256-verified CC0 WAV files**, not 150 publisher-identical files. Their exact source Git commits, file hashes and two addon CC0 licenses are recorded in `content/sound-library.json` and `assets/sound-library/README.md`. All remain disabled for automatic production.
- **P2 — TEST-only software complete:** `content/sound-design.json`, `scripts/codex-soundkit-selection.mjs` and `scripts/codex-soundkit-test.mjs` create language-scoped licensed candidate briefs and validate Codex authored sound/SILENCE decisions. **Codex does not automatically run a new model API** and creative decisions still require the video agent to perform them.
- **P3 — TEST-only software complete:** `scripts/sound-kit-cue-plan.mjs` and explicit `codex-soundkit-bind.mjs` validate real-imported voice byte SHA-256 and genuine word/visual cues, but only synthetic CI cases have been executed; real Gemini voice A/B and exact user approval remain open.
- **P4 — TEST-only opt-in engineering complete:** `src/EpisodeComposition.tsx` accepts a validated `soundKitRenderPlan` in an isolated manual preview. The original renderer has the legacy SFX unchanged when the prop is absent. A synthetic Remotion/FFmpeg voice+SFX AAC A/B actually differs at the selected cue; a real finished video has **not** been quality-approved. Preview requires `HSK_AI_SOUND_DESIGN_TEST=1` and does not publish.
- **P5–P6 — NOT DONE:** no human phone/headphone review of a genuine imported RU/TJ Gemini voice mix, final LUFS/true-peak calibration, exact real MP4 owner sign-off or approved production rollout.

**This file preserves the original specification/checklists as a planning baseline. For present test status, consult the P0–P4 audit files and current policy. Do not treat historical unchecked boxes, source count of 150, or original plan-only wording as current implementation status.**

## 0. Decision and boundaries

- Build a complete, searchable inventory of rights-cleared sound effects; do NOT put all sounds into each video. Each video may deliberately use zero effects.
- Codex itself is the AI sound designer during video preparation. A local rules engine filters candidates and validates decisions; it is not an AI and must not silently override Codex. No new Gemini, OpenAI, HeyGen, ElevenLabs or other inference/music/SFX generation API, account, credential, subscription or paid call.
- Work only on a separate engineering branch until baseline tests and licensing review. First integration is TEST ONLY, opt-in; no automatic SFX changes to normal production until owner accepts exact real-audio A/B previews.
- Preserve existing voice profiles, RU/TJ one-take audio, STT word timestamps, source audio hashes, visual meaning, user-approved CTA, historical published/approved files, per-platform packaging and social publishing gate.
- Ordinary dated HSK lessons remain Remotion. Ads use their existing engine selection; a professional premium HyperFrames workflow is separate, with compatible metadata, not a forced migration.
- No automatic publishing, no rewritten old media, no speculative timestamps, no external sound queries at rendering time.

## 1. Verified existing baseline

1. Existing Remotion production:
   - src/EpisodeComposition.tsx uses local public/sfx/soft-cut.wav and soft-tap.wav. Scene and beat mix envelope/limits are read from content/visual-system.json#sound.
   - sound.sceneCueVolume = 0.08, beatCueVolume = 0.09, maxBeatCuesPerScene = 2; backgroundMusic.volume = 0.07 where a real licensed music asset exists. These are CURRENT tokens, not proposed universal final loudness levels.
   - scripts/generate-sfx.mjs generates the two original deterministic 48 kHz mono WAV cues. scripts/render-sfx-step.mjs is already part of render-episode.mjs, with failure persistence.
   - scripts/render-platform-videos.mjs composes a shared RU/TJ lesson/body audio once for common-platform review; TikTok has a separately spoken and rendered CTA. All final MP4s need independent audit.
2. Existing optional media-use skill:
   - .agents/skills/media-use/audio/assets/sfx contains 19 MP3 filenames and a manifest with 19 named entries (some audio appears duplicated by file content). A bundled sound set is NOT equivalent to 19 newly audited licenses.
   - CREDITS.md attributes the skill bundle generally to Pixabay Content License but does not supply original per-file asset pages, authors or download records. Before re-packaging assets, establish each file's legal provenance.
   - .agents/skills/media-use/audio/scripts/lib/sfx.mjs has a separate HyperFrames/media engine path: with HeyGen credentials it can fetch SFX from HeyGen, otherwise match its bundled files. This is NOT permission to enable the HeyGen route or make it the default for Remotion.
3. Existing audio rules are authoritative: content/EDITING_SPEC.md (no opening-hook SFX, soft accents only when meaningful, at most two quiet beat taps per scene), content/WORKFLOW.md, AI_RULES.md, content/visual-system.json, content/languages.json, content/SKILLS.md, skill-catalog.json. The new domain's configuration must link to, not duplicate, these rules.
4. Codex MotionKit pilot is already merged on main, but new visual effects remain opt-in. SoundKit must not implicitly enable MotionKit or alter video approval.

## 2. External sound libraries and license gate

| Source | Confirmed catalog | Rights | Proposed treatment |
| --- | --- | --- | --- |
| Kenney UI Audio | 50 audio files | CC0 listed on official asset page | Import complete pack after downloading from official source; verify archive and included license, inventory every file. |
| Kenney Interface Sounds | 100 audio files | CC0 listed on official asset page | Import complete pack under pinned version/source; inventory 100 files and deduplicate identical audio. |
| Existing bundled skill MP3s | 19 named MP3 files | General Pixabay Content License claim, individual origin not yet confirmed | KEEP isolated in existing skill. Do not replicate them into a new public standalone stock pack until per-file source and permissions are verified. Videos may use only assets with adequate verified provenance. |
| Original soft-cut / soft-tap | 2 code-generated WAV effects | Original locally generated assets | Retain as verified, safe fallback. Never delete or silently change existing audio. |
| Optional future ambience / cinematic / foley packs | Not yet selected | Unknown | Separate later proposal with official source, exact per-file license and real need. Do not mix them into phase 1. |
| Background music | Separate from sound effects | Track-specific | Preserve current optional licensed music logic. No auto-generated music, no unlicensed loops, no blanket Content ID claims. |

Primary licensing evidence (verified before planning):
- https://kenney.nl/assets/ui-audio (50, Creative Commons CC0)
- https://kenney.nl/assets/interface-sounds (100, Creative Commons CC0)
- https://kenney.nl/support (commercial use allowed, attribution optional; see license in download)
- https://pixabay.com/service/license-summary/ and https://pixabay.com/service/terms/ (commercial use in derivatives allowed, standalone redistribution prohibited for ordinary Pixabay Content License)
- Exact local CREDITS.md is evidence of the skill author's claim only, NOT proof of origin of each MP3.

Acquisition controls:
- Download from the publisher's official page, record source URL, download date, package version, SHA-256 archive digest, accompanying license and attribution. Do not invent a direct download link or bypass a download gate.
- Count and checksum all extracted files; reject unexpected executable/scripts, path traversal, hidden extra payloads, unsupported codecs, unsupported bit depth, corrupt audio and undeclared source folders.
- Keep source archive in temporary isolated staging until verified; do not upload an opaque ZIP to public production asset paths. Check whether a vendored 150-file catalog is appropriate for public GitHub size; keep only license-safe content with traceable provenance and avoid needless duplicate binaries.
- CC0 source files can be cataloged; provenance stays in the repository for audit and optional courtesy credit. Never suggest Kenney branding is official HSK AI branding.
- If the full packs are not retrievable or cannot be verified, record the blocker and do not claim 150 imported sounds. The two existing local WAV assets remain the fallback.

## 3. Source-of-truth layout (PROPOSED; not yet created)

- content/sound-design.json: a single canonical machine-readable SoundKit policy/config for source usage, scope, allowed effect roles, density, voice priority and TEST status. Add to hsk-tu-vous/AGENTS.md ownership table ONLY during implementation, after classifying the rule migration.
- assets/sound-library/kenney-ui-audio/* and assets/sound-library/kenney-interface-sounds/*: verified CC0 source assets, kept distinct from public rendering files and third-party skill stock.
- content/sound-library.json: generated asset inventory with stable ID, pack, original filename and provenance; do not duplicate the authoritative sound policy.
- scripts/sound-library-audit.mjs: source manifest schema checks, SHA-256 checks, license and duplicate detection, metadata from ffprobe, sample preview index.
- scripts/sound-design-candidates.mjs: pure filters and candidate lists; NO model API. Include mandatory NONE / SILENCE option.
- scripts/codex-sound-design-test.mjs: per-episode / per-language planning brief and validated Codex decisions.
- scripts/sound-cue-timeline.mjs: resolve proposed sound cues to exact imported word anchors / approved visual events and attach source/audio/locale/CTA fingerprints.
- src/audio/SoundKit.tsx or existing canonical composition path: optional layered Remotion Audio tracks from allowlisted verified sounds, with frame-based envelopes and safe gain.
- scripts/audio-mix-qa.mjs: source and final platform audio analysis, clipping, true peak, loudness, silence/voice masking and cue alignment.
- review/sound-design-tests/<episode-id>/<ru|tg>/brief.json, codex-decision.json, cue-plan.json, audit.json and isolated preview files: generated, ignored experimental artifacts, never source lesson or paid audio history.
- docs/audits/SOUND_DESIGN_BASELINE.md: measured original-video baseline and voice/artifact identity matrix.

Every actual file location must be checked against existing .gitignore, library conventions and review path rules before implementation. Avoid duplicate ownership with content/visual-system.json#sound (the existing volume/transition settings remain authoritative until a reviewed migration moves only the necessary new token values).

## 4. Per-video Codex Sound Director workflow

At the start of a new video job:
1. Read canonical date, contentType (lesson / advertisement / series-part), final RU or TJ narration, actual planned visual beats and existing CTA/platform scope.
2. Automatically build an unambiguous TEST ONLY brief with real available sound IDs, source license status, semantic event types, existing SFX, relevant last few video sound patterns and an explicit silence option. No new AI or music service is invoked.
3. Codex, as the EXISTING video-production AI, makes the creative decisions. For every proposed effect record: intended on-screen action, actual narration evidence and visual-event ID, why this sound helps comprehension, why a quiet alternative is insufficient, and an approximate role/gain class.
4. Codex must select NOTHING where a cue is irrelevant, promotional fiction, missing UI evidence, or competes with Chinese pronunciation. Generate no synthetic product success tones for interactions not actually shown.
5. Write a source-hash-bound decision document containing episodeId, languageCode, contentType, sceneId, cueId, candidate sound ID, semantic rationale, library version, provenance reference, effect role, gain preset and status TEST_ONLY.
6. Validate selection independently against allowlist, locale, source-hash and owner policy. The validator must reject stale/cross-language decisions and unexpected source IDs; never silently replace rejected choices with a random/hash choice.
7. Before voice creation: record optional sound INTENT only. It is not a true timed cue. After the existing approved voice is imported: resolve effect placement against real Gemini word timestamps and authored motion/shot cues. Reject inferred or approximate speech timestamps.

Editorial priorities:
- LESSON: voice clarity, pronunciation, meaning first. No opening hook cue; respect soft scene cuts and max two meaningful quiet taps per scene from current canonical policy. Most spoken words receive NO sound effect. Only actual changes supported by frames may trigger quiet SFX; no additional display UI.
- ADVERTISEMENT: real HSK AI UI/interaction evidence required for click, swipe, notification, confirmation, success. Avoid fake payment/install/activation results. Build, whoosh and impact are optional and should be short, restrained and matched to actual visual state changes.
- SERIES: sound continuity across recurring character/setting plus measured variation. No enforced unique effect every scene; a consistent branded motif can repeat when appropriate.
- Locales: RU and TJ must get separate decisions because narration lengths and word cues differ. Common lesson visuals and stock file IDs may be shared when both independently validate, but SFX frames/cue plans cannot be copied blindly.
- Platforms: reuse identical shared voice/lesson mix where possible across Instagram/YouTube/Facebook; tie platform-specific CTA accents to the platform's actual CTA and word cues. TikTok's different approved voice and CTA require separate validation. Never create a Telegram video route.

## 5. Mix architecture and technical audio policy

Existing render and audio rules are the baseline, not an excuse to run every generic SFX at the media-use sample's 0.35 gain.

Proposed architecture:
- Keep the original verified narration source audio bit-for-bit unchanged and store its hash. Build a derived mixed timeline: narration (foreground), SFX (sparse meaningful accents), optional cleared BGM (quiet).
- Load only the selected allowlisted source files for an actual render; no whole 150-file pack in Remotion's runtime bundle, no network/HeyGen API at render time.
- Decode/normalize sample format in a deterministic reproducible build step if required (use ffmpeg/ffprobe); cache by source hash, converter options and tool version. Avoid resampling source speech unnecessarily.
- Compute exact effect start frames from verified voice cue and/or precise validated visual event. Long riser should be positioned by its measured peak, not a guessed 10-second countdown; trim/out-of-bounds must be explicit.
- Envelope per sound: soft fade in/out; no discontinuities, pops or overlapping peaks. No sound entering before first hook where forbidden, or continuing past final scene/CTA unexpectedly.
- One central gain-token ownership migration after reviewing existing content/visual-system.json#sound; do not append contradictory values to multiple files.
- Voice-first gain staging: do not alter/correct the original approved TTS source. Duck SFX/BGM underneath intelligible words in the FINAL MIX, not by overwriting the voice asset. Calibrate on real examples and check Chinese consonants/tones as well as RU/TJ explanations.
- Proposal only, subject to baseline: protect peak headroom (for example final true peak <= -1 dBTP); assess integrated/short-term loudness with LUFS measurement rather than promising a single streaming-platform standard. Reject clipping, severe masking, extended accidental silence, inaudible transitions and unintended excessive bass.
- Assess mono compatibility, speaker/headphone listening, cheap phone loudspeaker, fade-outs, loudness jumps between videos, clipping and quiet/loud source variation.
- Music remains optional and separately rights-cleared; never improvise generic music to replace missing SFX or force an unlicensed track.

## 6. Implementation phases, tasks and gates

### Phase 0 — baseline, inventory, risk register (NO rendering change)
- [ ] Capture main SHA, source files, audio settings, real available RU/TJ review packages, existing local 2 WAV and skill's 19 MP3 metadata, actual duplicate hashes.
- [ ] Measure original outputs (or state explicitly no current real final file available) and document input audio SHA, measured loudness/peak, scene SFX counts, voice intelligibility, platform variants and test commands.
- [ ] Identify whether existing bundled Pixabay MP3 file-specific licenses and original URLs can be recovered; classify unverified ones as no-copy/no-new-use.
- Gate P0: baseline report + asset provenance register + no unsupported claim of available sources.

### Phase 1 — obtain and validate 150 Kenney CC0 sources
- [ ] Retrieve the 50 UI Audio and 100 Interface Sounds files only from official rights-cleared archives, retain license and exact provenance.
- [ ] Audit every file for codec/playability/peak/duration/sample-rate/channel count, hash, semantic name, file format, duplicates, problematic sounds and practical usefulness.
- [ ] Separate raw inventory from a CURATED allowlist of a smaller useful subset. No assumption that every game-like sound is suitable for Chinese education.
- [ ] Compile portable file manifests with stable IDs and source verification. Stage storage without changing production sound paths.
- Gate P1: all 150 either verifiably cataloged or accurately declared missing; legal and testable, no opaque/unauthorized audio.

### Phase 2 — Codex candidate + human/agent semantic decision
- [ ] Create one machine-readable policy with categories (soft-ui, reveal, motion, texture, state, ambience candidate), banned patterns and explicit silence.
- [ ] Build source-scoped RU/TJ TEST briefs early in prepare_today_video, prepare_video_for_date and content:make; ensure advisory failures do not break approved production.
- [ ] Codex chooses per-video using actual narration/visual reason, plus current/previous combinations; rule-based code only validates candidates and reasons.
- [ ] Add strict per-language decision validation: source hash, locale, scene IDs, IDs in catalog, proof of visual action, file SHA/license, no new fake states, stable reproducibility and no CTA bypass.
- Gate P2: reproducible semantic decisions and guard tests, no extra model API calls, normal render unchanged.

### Phase 3 — exact voice/visual cue binding
- [ ] Bind selected SFX to validated imported word cues and/or verified rendered-action frames, after the voice source SHA and corresponding locale/platform plan are known.
- [ ] Bound clip length, overlap and fade with source audio duration and final video range; reject missing/duplicate/out-of-order cue anchors.
- [ ] Revalidate when narration hash, voice take, localization, CTA version, source visual or rendering fps changes.
- Gate P3: exact cue-synchronized plan with explicit failure reason, no fabricated timestamp, unchanged historical voice.

### Phase 4 — safe opt-in Remotion/HyperFrames mixing
- [ ] Integrate optional sound plan into the existing HSKAI-Episode renderer; avoid duplicating soft-cut/tap already emitted by legacy code (exclusive legacy-vs-new per-cue ownership).
- [ ] Bind only selected public-safe assets; convert/copy to actual render path with hash verification and deterministic output. No network download in final render.
- [ ] Match existing shared lesson audio process for Instagram/YT/Facebook; separately validate the TikTok CTA/voice. Do not change approved publication destinations.
- [ ] HyperFrames route is a separate adapter only if needed for a premium standalone job, and must not switch ordinary lessons to HyperFrames.
- [ ] Flag: HSK_AI_SOUND_DESIGN_TEST=1 for explicit reviewer preview; default 0 and untouched previous mix.
- Gate P4: baseline and candidate videos render, default audio identity unchanged, SFX can be disabled instantly without rewriting approved source.

### Phase 5 — objective audio QA and regression CI
- [ ] Test metadata/hash/license/duplicate recognition; invalid WAV/MP3/OGG, path traversal, bad file, missing asset, corrupted PCM, unexpected license, stale ID.
- [ ] Test no-effect fallback; RU/TJ cross-contamination; wrong audio SHA; wrong CTA/platform; missing word anchor; denied sound role; forbidden hook cue; redundant SFX; max lesson cue density.
- [ ] Test audio duration vs video, scene/CTA boundaries, sample peak/true peak, EBU R128 loudness, unplanned silence, transitions, overlapping SFX bursts, codec compatibility and file fingerprints.
- [ ] Test a synthetic two-variant Remotion MP4 with controlled WAV/tones and no Gemini calls: baseline SHA stable, sound-mix opt-in changes expected audible frames only, no animation regression.
- [ ] Test real language and platform review packages when already imported/available; do not synthesize fake Gemini proof or spend TTS credits on an engineering smoke.
- [ ] Save before/cue/after waveform and true listening A/B reports as review evidence. Listening is mandatory; automation cannot prove professional taste or Chinese tone clarity.
- Gate P5: lint + check:consistency + all targeted CI green, real media QA evidence ready, license audit complete.

### Phase 6 — real-world A/B + rollout control
- [ ] Choose at least one unapproved lesson per RU/TJ and one genuine UI-driven ad (if source assets/voice available). Render no-SoundKit baseline and SoundKit candidate with identical approved voice take and equal platform output settings.
- [ ] Blind/normal-volume listen both on phone speaker and headphones: subtitle/speech clarity, effect relevance, background masking, suddenness, cultural/teaching appropriateness, CTA and final transition.
- [ ] Confirm audio hash of ORIGINAL VOICE unchanged; derived mix/video hashes must differ only where the opt-in sound plan legitimately applies. Store source, plan and final MP4 fingerprints per language and platform.
- [ ] Owner reviews exact final MP4s. If rejected, retain default 2-SFX renderer and revise the plan, not the voice. Do not auto-publish or switch default.
- [ ] Only after separate explicit owner rollout approval, migrate from TEST ONLY behind a production feature flag with kill switch, per-content-type rollout and monitoring for new SFX-related failures.
- Gate P6: clear owner approval for production default, no hidden live change, rollback verified.

## 7. Quality and release acceptance matrix

| Requirement | Evidence / pass condition |
| --- | --- |
| Source legality | Every selected SFX has a verified license/source record and exact asset hash. Unknown origin never silently passes. |
| Real selection | Codex's own per-video source-grounded decision, not a pseudo-AI random/hash choice; NONE is valid. |
| Visual truth | Every audible click, swipe, success or reveal corresponds to a real visible action/state; no fake app proof. |
| Timing | Frame equals verified cue/visual event, no guessed word bounds, no drift past final voice/CTA. |
| Narration | Both ru-RU and tg-TJ approved source voice files and identity hashes unchanged; no altered Gemini models/provider. |
| Sound balance | Final audible mix passes configured measurable peak/loudness rules and human speaker/headphone listening. |
| Density | Existing lesson no-hook cue and max-two-taps-per-scene constraints respected; ads get their own approved limits. |
| Compatibility | Old default video mix remains the same without explicit TEST flag; all scoped platform/CTA variants render. |
| Performance | Asset count does not imply loading 150 assets; only chosen/verified files are decoded or copied. |
| Safety | No extra external API, secrets, auto-download during render, unauthorized license redistribution, unapproved VIDEO publishing. |
| Review | A/B clips, SHA report, waveform, phone listening checklist, CI evidence and exact owner decision before activation. |

## 8. Main failure modes and defenses

1. Copyright/provenance: bundled Pixabay files have general but not per-file attribution. Do not republish them as a standalone stock collection; separately verify use or quarantine for new work.
2. Excessive sound design: library size is NOT video quality. Reject selection without real action. Prefer quiet transition and deliberate silence to random swooshes or fake success sounds.
3. Mixed narration identity: shared visuals do not imply shared RU/TJ sound timings. Separate plans, hashes and voice cues; TikTok is additionally its own CTA route.
4. Loudness/voice masking: low numeric volume alone does not ensure legibility. Measure real mix and listen on phones. No clipping and no modification of approved source takes.
5. Duplicate SFX: two existing Remotion cues must not fire together with a new replacement. Preserve current defaults if SoundKit is disabled.
6. Synthetic test confusion: synthetic rendered tones and waveform checks are engineering QA, not verified paid TTS or human listening.
7. Automatic publication/approval: new SFX invalidates final video approval hash; re-render and present the exact version to the owner before posting.
8. Outdated docs/skill precedence: reconcile canonical EDITING_SPEC, sound config, WORKFLOW, AGENTS ownership table, skill router and tests in the same implementation PR.
9. External dependencies: no HeyGen auto-retrieval, generated sound APIs, tracking, or external network needed for default runtime.

## 9. Change scope, handoff and owner choices

- **Historical plan-only rule (superseded after owner-approved implementation):** this document was initially the only change in its planning branch. P0–P4 are now implemented on the separate reviewed feature branch as disabled-by-default TEST tooling; no user-approved TTS, official published videos or automated publishing destinations have been changed.
- Implementation PR should split into auditable commits: (1) baseline/licensing manifest, (2) asset registry and CC0 files, (3) Codex decision planner and tests, (4) cue binder and optional audio layer, (5) objective audio checks and sample A/B, (6) documentation migration/review.
- Engineering execution belongs to Codex/Claude on a separate implementation branch following the project rules; Codex remains the creative sound selector in video jobs.
- Explicit owner review decisions are needed for (a) importing the full rights-verified Kenney pack into a public repo if the archive is not publicly retrievable or has unexpected terms, and (b) later enabling SOUND DESIGN as the production default, rather than continuing the TEST-only experiment.
- **Current checkpoint:** P0–P4 are implemented in isolated TEST mode; proceed with P5 objective real audio mix QA and P6 exact owner-approved RU/TJ A/B before any default activation. Do not call the entire SoundKit product rollout implemented.

## 10. Recommended first execution acceptance

The original first development milestone (historical intent, now largely satisfied by P0–P2) was NOT a new SFX in published content. It is:
1. An audited catalog (Kenney 50+100 license-verified, current skill 19 individually assessed, soft WAV 2 preserved);
2. A Codex TEST brief for one real RU and one real TG script with distinct source hashes and semantically justified choices, including silence where appropriate;
3. Zero change to default video audio and zero additional paid API calls.

Only then move to a real cue-bound render and professional audio mix A/B. A full stock library without this selection/timing/QA contract would add bloat and reduce educational quality rather than improve it.
