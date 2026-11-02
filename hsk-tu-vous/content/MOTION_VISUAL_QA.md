# M6 Visual QA: scope, thresholds and release gates

**Status: technical tests verified; production NOT approved.** This document is supplementary to `plans/PREMIUM_MOTION_DIRECTOR_CONTEXT.md` and `content/EDITING_SPEC.md`.

## Verified technical workflows

- `scripts/motion-visual-qa.mjs` derives an ordered shot/meaning/asset/camera/transition map from the **authored** action beats and imported **word timestamps** (never equal-time scene slicing). Each item has its exact original caption index and `cue-1`, cue, midpoint and settled sample frames.
- `scripts/motion-frame-qa.mjs` decodes the actual Remotion 8-bit RGB/RGBA PNG, then restricts its pixel analysis to the **artwork stage**. For the current 1080×1920 fixture, region is x100–979, y650–1109. This prevents changing subtitles/branding from falsely passing the artwork-motion check.
- Hard gates: valid/non-corrupt pixels; stage hero visible (≥3% brightly colored stage pixels); visible hero fully inside stage safe margins; ≥3.5% changed pixels in that stage between different meaning samples. Advisory warnings: bright hero occupancy below 20%, or visible hero width below 45% of stage. A detected bright pixel is **not proof** of true conceptual meaning.
- Two archived outputs: `motion-cue-review.json` and `motion-frame-qa.json`, stored with 8 stills and short synthetic MP4 in GitHub Actions artifact `motion-asset-library-review`.
- `audioAuthenticity:not-verified-by-this-check`, `productionApproved:false`, and `requiresHumanReview:true` are explicit. A synthetic test cannot verify the source Gemini voice, accurate Russian/Tajik subtitles or professional composition.

## Verified CI evidence, 2026-11-02

| Technical check | First run | Improved source art |
|---|---:|---:|
| CI run | [41432672568](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41432672568) — PASS | [41433093412](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41433093412) — PASS |
| Book bright occupancy | 21.52% | 21.52% |
| Tea bright occupancy | **15.67%** (warning) | **21.10%** |
| Market bright occupancy | **15.93%** (warning) | **21.57%** |
| Textbook bright occupancy | 23.29% | 23.29% |
| Stage changed pixels, book→tea | 20.86% | 24.07% |
| Stage changed pixels, tea→market | 24.82% | 33.06% |
| Stage changed pixels, market→textbook | 25.82% | 31.08% |

The user-reviewed original-asset registry now supports bounded per-asset `stageScale` in range 1–1.18; book remains 1.00 and tea/market have 1.16. Their original SVG content, SHA-256 hashes, source ownership and **review-only** status were unchanged. Video timing, source scripts, voice and CTA were not edited.

## Known limitations / not yet delivered

- Current pixel thresholds and ROI are calibrated for **this specific open-stage synthetic asset fixture**. Applying them blindly to arbitrary graphic themes, portraits, layouts or other aspect ratios may create false passes or failures. Calibrate with human-approved reference frames for each new style.
- A future universal per-shot screenshot generator must render all cue-1/cue/mid/end frames for real RU and TJ lessons. Current CI's 8 stills cover a finite test fixture only.
- Text clipping/overlap and CTA layout need separate real 270×480 phone-size checks; current ROI intentionally excludes them. Validate actual long Russian/Tajik words with owner-approved audio and captions.
- Reconcile actual Gemini narration/audio waveform, imported word timestamps, scene/SRT hashes, CTA and final MP4 before any claim of synchronization.
- Content truthfulness, aesthetic quality, third-party asset rights, portrait realism, compositional complexity and publishing approval require human review. A green synthetic CI, even with no warnings, is **not** a finished premium video.

**No main-branch merge, production approval, scheduled publication or automatic video release follows from these tests.**
