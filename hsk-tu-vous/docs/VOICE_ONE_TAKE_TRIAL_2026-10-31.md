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

## 2026-10-31 continuation: preserve voice, separate alignment

- Added `scripts/external-word-cue-gate.mjs` and its negative-case unit tests.
- `content:voice ... --resume <existing-take> --aligned-cues <file.json>` now accepts an **independently generated** word-cue file only after checking exact original WAV SHA-256, source narration SHA-256, RU/TJ locale, word timestamp bounds and model/method provenance. The existing exact normalized-token gate runs after the file gate. If any word is missing or the generator would invent a timestamp correction, import fails.
- This offline path **requires no Gemini secret and categorically blocks Gemini API calls and new TTS**. It only processes the archived one-take audio.
- In the opt-in pilot, invalid zero-length or backward Gemini word timestamps now fail closed rather than being expanded to a synthetic 1ms token.
- All pilot Gemini Transcribe HTTP attempts are budgeted to **at most eight per original recording**, including 429/5xx retries across saved metadata/resumes. Successful silence-clip ASR responses are cached by the SHA-256 of the exact clipped audio plus model, locale and measured source interval. This avoids rebilling identical clips on later resumes; incompatible legacy cache files fail closed.
- Model-backed commercial-quality **RU/TJ plus Chinese** cue coverage is **not yet proven**. Do not call the current archived audio a finished captioned MP4. The original TTS samples are accepted by the owner for voice quality, not approved for posting.

Full schema and CLI: `docs/VOICE_OFFLINE_CUE_IMPORT.md`.

## Offline acoustic model trial (2026-10-31)

- Qwen3 ForcedAligner 0.6B (Apache-2.0): the real archived RU WAV's first five Russian words were aligned successfully by the actual CPU model, 0.240s through 2.880s. See [first trial run](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41188312492). The initial Chinese diagnostic window was not speech-isolated, resulting in nonmonotonic timestamps that were properly rejected. Retest uses measured source silences at 4.782–5.400 and 6.461–7.293s to isolate the first Chinese phrase; all output remains diagnostic, not importable cues.
- Tajik Sherpa-ONNX Zipformer2/Vosk 0.61 (Apache-2.0): the real archived TJ WAV was processed on the runner with **zero Gemini requests** in [run 41188404443](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41188404443). Source Cyrillic-script token-sequence match coverage was **0.93** for the approved Tajik-script reference; 71 expected Tajik words and 98 ASR words after filtering. Its ONNX source-token timepoints are real provider outputs, **not source-verified start/end word cues**. Chinese and Latin acronym passages need distinct alignment. The complete raw word/timepoint evidence is in GitHub artifact ID `13037318948`.
- The result is a technical advancement, but **neither language's full original audio currently has complete accepted word annotations**. Do not make or approve a final MP4 using partial/tentative timings, and do not substitute Russian language models for Tajik. The temporarily created one-shot model workflows are removed after the runs; normal GitHub CI never installs models or spends Gemini quotas.


## Verified offline trial progression — speech timing, not yet full-video approval

**Real Qwen model (not mocked):** The archived RU original WAV was loaded by Qwen3 ForcedAligner 0.6B on CPU; run [41188312492](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41188312492), latest attempt, evidence artifact ID `13037692357`. The first five Russian words were successfully timestamped (0.240–2.880 s). The first Mandarin phrase `这个有点儿贵` was isolated using real measured silence and Qwen returned:
- `这` 5.399–5.559 s;
- `个` 5.559–5.639 s;
- `有` 5.639–5.879 s;
- `点` 5.879–6.119 s;
- `儿` instantaneous at 6.119 s; this is a rhotacized suffix, **not an independently timed syllable**;
- `贵` 6.199–6.439 s.

The experimental normalizer now groups *only* verified `点儿` as a single source-preserving unit (5.879–6.119 s) and leaves `儿子`, `花儿`, etc. unchanged. **No synthetic time extension.** Qwen's valid five acoustic units correspond exactly to six written Hanzi. The approved Chinese script is unchanged; original model raw output and the phonetic-fold provenance are preserved. Code and tests are in `scripts/mandarin-erhua-units.mjs`, its test, and the read-only `scripts/qwen-one-take-probe.py`.

This is confirmed **model inference with a real 1.063-second Mandarin audio crop**, not full RU/TJ episode alignment. Model-provided offsets are candidates pending listening and whole-script coverage checks, and **not yet imported or approved as captions**.

## Complete Mandarin phrase probe + independent ASR — 2026-10-31

With the **original, unchanged one-take WAVs** and offline Qwen3 models:

1. In [full Qwen forced-alignment evidence run 41190035220](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41190035220), all ten Chinese clauses in each language were processed separately, strictly bound to the original approved narration, WAV SHA-256 and 20 candidate speech windows. Qwen returned **structurally valid** monotonic timestamps for **RU 9/10** and **TJ 8/10**. Three candidates were deliberately rejected for zero-duration syllables or model outputs beyond the candidate crop. Source evidence artifact ID: `13038616727`.
2. An **independent** model was then run on the same source clips **without supplying target text**, Qwen3-ASR-0.6B (Apache-2.0); see [run 41190353327](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/41190353327), artifact `13038203679`. RU ASR Chinese exact text match **2/10** plus *erhua-only* spelling equivalence **3/10**. TJ ASR exact match **3/10** plus *erhua-only* equivalence **5/10**. ASR sometimes misrecognized Mandarin in multilingual short clips; ASR mismatch is **not** proof of bad pronunciation.
3. Intersection **both provider-timing-structural + independent ASR same Chinese content (allowing only 点儿→点 orthographic rhotacization)**: **RU 4/10**, **TJ 6/10** candidate phrases. Even these candidates are **NOT independently owner-auditioned word cues**, and the recorded source text contains other untranslated/unverified Russian, Tajik and brand-acronym spans. **Do not import partial diagnostic timing into VTT or mark a full MP4 complete.**
4. Original archived WAV chunks can be directly reviewed in a locally created 20-clip acoustic QA package (original PCM, no new TTS) with expected phrase and independent ASR hypotheses. Audio listening approval is distinct from model equality.
5. One-shot GitHub CPU model workflow triggers were removed after the experiments; repository main, voice TTS model, approved voice and production pipeline remain unchanged.

The next change must be a clear product decision about whole-word karaoke captions versus a separate **review-only, scene-synchronized** preview path. Do not silently weaken `render-episode.mjs`'s canonical strict word-cue gate.
