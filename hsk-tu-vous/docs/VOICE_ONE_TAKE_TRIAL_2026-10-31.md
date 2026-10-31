# Real RU/TJ continuous-audio audition — 2026-10-31

Status: **experimental only / not accepted for production / no merge**.
Target: one unbroken take per language, at most two actual TTS HTTP attempts for any take, and exact trusted word cues before rendering.

## Evidence

- Branch PR #46, based on `main` SHA `9f63773321876c114d9933f830e2cf11328156e6`.
- Real TTS run [41183287146](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41183287146) on the existing October 30 RU/TJ HSK lesson.
- Both languages generated valid WAV and MP3 on **one TTS request per language**. Russian WAV: **45,360 ms**. Tajik WAV: **47,280 ms**. Approved voice and model IDs in their canonical locale `voice-profile.json` files were unchanged.
- Measured PCM sample peak levels: RU -1.48 dBFS, TJ -1.27 dBFS, **zero clipped 16-bit samples**. This is audio signal integrity evidence, **not** proof of natural pronunciation, correct Hanzi or listener quality.
- Full-audio approved Gemini Transcribe returned **55 annotations for 113 expected normalized tokens (RU)** and **0 annotations for 126 expected (TJ)**. Exact alignment therefore **correctly prevented VTT/import/render**.
- [41183656556](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41183656556): first saved-WAV recovery test found a regex parsing defect, repaired without regenerating speech.
- [41183762779](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41183762779): source-pause splits and saved ASR anchors improved diagnosis. RU has 11 missing speech spans; an original RU word-time anchor incorrectly covered some Chinese speech. TJ short clips returned Mandarin tokens and some invalid zero-duration word times. The exact gate correctly rejected all.
- [41183987510](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41183987510): locale-prioritized short-clip experiment still did not fully validate RU. TJ hit a **real Free Tier Gemini 3.5 Transcribe limit of 25 requests/day (HTTP 429)**. No more same-day API retries are justified.

## Permanent operational safeguards in the pilot

1. Exact script text, locale-bound voice/model profile and strict approval/published-source protection remain intact.
2. The continuous-TTS path refuses >12k characters and limits real TTS HTTP attempts to two per take; the archived run used one.
3. Saved WAV and metadata are reusable via `--resume`; `HSK_AI_CONTINUOUS_TTS_RESUME_ONLY=true` categorically forbids TTS generation during transcript diagnosis.
4. Experimental full-audio ASR is reduced to one attempt rather than three identical failed responses. Failed word timing does **not** cause regenerated speech.
5. Silence-bounded transcript diagnostics use only measured original audio silence cuts and actual provider timestamps. Any zero-duration, missing, overlapping, wrong-text or unsupported cue is rejected; no interpolation or fabricated word times.
6. No Zernio, social upload or publication is part of the test. The old release stays unmodified.

## Blocking criteria before merge

- Approved source-bound **RU and TJ** narration must pass exact whole-script word-cue verification, including Chinese words and brand acronym.
- TikTok's separate CTA take, per-platform renders and final mixed-language spoken audio must be checked.
- The owner must hear the actual WAV/MP3 and assess pronunciation and naturalness; timestamp checks alone are insufficient.
- Gemini transcription's real paid-tier quota and throttling must be confirmed before scheduling daily use. Free Tier exhausted during this trial.
- A durable regression suite and CI must remain green after the final correction.

The experimental one-shot secret-using GitHub Actions workflow is intentionally removed after evidence collection to avoid unintended billed reruns. Ordinary PR validation never calls paid Gemini.
