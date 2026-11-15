# Kenney CC0 Sound Library — verified GitHub mirror snapshot

**Status: asset catalog imported; NOT enabled in production, NOT automatically selectable.**

Imported 2026-11-15 by [SoundKit pinned mirror CI](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/43689444267) into the isolated engineering branch.

## Exact source provenance

| Pack | Publisher catalog | Audited source (not the original publisher ZIP) | SHA-pinned commit | Audited WAVs |
| --- | --- | --- | --- | ---: |
| UI Audio | [Kenney UI Audio](https://kenney.nl/assets/ui-audio) (50 listed) | [Calinou/kenney-ui-audio](https://github.com/Calinou/kenney-ui-audio) CC0 Godot package | `8c3d81b9159d058c444f89d12d518276b0b09345` | **51** |
| Interface Sounds | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) (100 listed) | [Calinou/kenney-interface-sounds](https://github.com/Calinou/kenney-interface-sounds) CC0 Godot package | `4596a49eaf5a533948d49a47467f606bcdea70ff` | **100** |

**Total: 151 unique binary WAVs, 5,766,530 audio bytes, zero exact duplicate SHA-256 payloads** in this imported mirror snapshot.

The 51/50 discrepancy belongs to the third-party Godot mirror, not a claim that the publisher provides 51 audio files. No arbitrary WAV was deleted to force the mirror down to 50.

Both mirrors contain CC0 source licenses in their `addons` directories. Their pinned `.gitattributes` deliberately marks the root `LICENSE.txt` as `export-ignore` in downloadable ZIPs. The importer recognizes ONLY that explicitly locked omission, and verifies the embedded addon license plus pinned file Git blob hashes and WAV byte SHA-256s. A copy of each verified addon license resides alongside its audio files here.

All files were fetched from `codeload.github.com` using explicit immutable commit hashes, not a floating GitHub branch or an undocumented paid service. Official publisher ZIP requests were independently attempted and returned HTML, not a valid ZIP; see `docs/audits/SOUNDKIT_KENNEY_ARCHIVE_PROBE.json`.

## Auditable inventory and use restrictions

- `../../content/sound-library.json`: stable file identifiers, verified publisher page, mirror commit, archive SHA-256, per-WAV SHA-256, exact byte count, codec, sample rate, channels and duration; explicitly `eligibleForAutomaticUse: false`.
- `../../vendor-catalog/soundkit/kenney-mirror-lock.json`: expected per-file Git blob SHA-1 (Git object identifiers) and pinned source paths. Do **not** confuse a Git blob SHA-1 with the independently computed raw WAV SHA-256.
- `../../scripts/kenney-mirror-import.py`: standalone source and playback decoder audit; `--mode verify` checks every imported WAV against its SHA-256 without network.
- `../../scripts/kenney_mirror_import_test.py`: no-network tests of tampering, ZIP slip, license, lock correctness and file-count mismatch.

**No production audio mix has changed.** The original generated `public/sfx/soft-cut.wav` and `soft-tap.wav` remain in the existing ordinary video renderer. This raw CC0 catalog is not `public/` and is intentionally not a Remotion runtime dependency. During P2, Codex may choose only a *curated allowlist* matched to the real RU/TJ narration and visible actions; silence must remain an explicit option. P3/P4 will need approved word-cue binding and opt-in render QA. No new AI API, no HeyGen SFX retrieval, no changes to existing TTS, CTA or social publishing approvals.

Copyright / attribution: audio work is credited to Kenney under CC0-1.0. License notices remain in each pack. This does not imply endorsement of HSK AI by Kenney or the mirror distributor.
