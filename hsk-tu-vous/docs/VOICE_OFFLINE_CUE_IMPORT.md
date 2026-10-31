# Offline external word-cue import (experimental, PR #46)

Goal: preserve the **one-take original Gemini RU/TJ voice** while allowing a separate genuine forced-alignment model to supply **actual word timestamps**. Nothing below auto-approves a lesson, voice, VTT, or video.

## Offline command

```bash
HSK_CONTENT_LANGUAGE=ru HSK_AI_CONTINUOUS_TTS_PILOT=true \
 npm run content:voice -- youdianr-vs-yidianr-price-20261030 \
 --resume 2026-10-31T08-07-45-724Z --aligned-cues /absolute/path/ru-aligned-cues.json
```

This path reads the *existing* WAV, JSON and episode. It **does not need Gemini credentials** and every Gemini API call (including TTS) is hard blocked. A matching prior production voice and its original narration fingerprint are required. Use `HSK_CONTENT_LANGUAGE=tg` and the Tajik archived generation folder for TJ.

## JSON contract (real provider evidence only)

```json
{
  "version": 1,
  "languageCode": "ru-RU",
  "audioSha256": "562c368a0dd5800f11da724a54480797631ed141625bcabba248111184cc652c",
  "narrationSha256": "75d2bad12fc1c5347ea097cb0d772c0abd1d4390178078ddc0987bace022ef59",
  "provenance": {"method": "forced-alignment", "model": "ACTUAL/PROVIDER-MODEL-ID"},
  "wordAnnotations": [
    {"text": "Представьте", "startOffset": "0.200s", "endOffset": "1.100s"}
  ]
}
```

The one-word example is **deliberately incomplete** and MUST FAIL the full-script exact-token gate. **Never invent or extrapolate timestamps to fill this contract.**

Frozen one-take original WAV hashes:
- RU: WAV `562c368a0dd5800f11da724a54480797631ed141625bcabba248111184cc652c`, narration `75d2bad12fc1c5347ea097cb0d772c0abd1d4390178078ddc0987bace022ef59`, 45.36s.
- TJ: WAV `df7d2073f37d0c4bbd23f6542ac99cf9368823196f54a47104d29ce71bb80c23`, narration `4bbb1e7ff18c262004f8a454c0efa804dd67780dffda478ad3ef18ac37335842`, 47.28s.

These hashes identify **this archived sample only**, not a new recording or release. Recalculate if the WAV or approved narration changes.

## Strict acceptance

1. `--aligned-cues` works only with `--resume`, `HSK_AI_CONTINUOUS_TTS_PILOT=true`, and exactly one existing WAV take.
2. `verifyExternalWordCues` checks exact original WAV SHA-256, approved narration SHA-256, RU/TJ language, real model/method identifier, no unbounded items, no invalid/overlapping/zero-length timestamps or times beyond the source recording.
3. The **existing** `alignWords` enforces complete exact normalized-token coverage and timestamp order; external cues are rejected if legacy 1ms timing repairs would be required.
4. Existing source-freshness, owner-approval protection, CTA registration, and downstream render validations remain mandatory.
5. An aligner may timestamp the provided text even if the speaker pronounced it wrong. **The owner must still listen** and check Chinese words, rhotic `儿` syllables and Tajik speech. The API model name in self-reported JSON is not a cryptographic attestation of acoustic validity.
6. No guessed subtitle or insufficiently supported language is accepted. **RU/Chinese and TJ/Chinese forced-alignment provider compatibility has not yet been demonstrated**, so this is an integration contract, not a completed video.

## Why not blindly install any open aligner?

Model licensing and language support must be vetted for commercial HSK AI. Qwen3 ForcedAligner advertises Russian and Mandarin but **not Tajik**; multilingual Meta MMS model weights may have noncommercial licensing. Neither is currently enabled as the production fallback. Keep all model downloads and billed ASR calls explicit and separately tested.

See `docs/VOICE_ONE_TAKE_TRIAL_2026-10-31.md` for the actual API evidence and free-tier quota block.
