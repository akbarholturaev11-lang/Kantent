# Sound Design Library — P0 repository baseline and source-audit

Status: **P0 factual baseline complete; verified sound acquisition and real-media listening still pending.**
Source main SHA: `3ac50097aa2e3aa649cea28962234aa69d081726`.
Implementation branch: `feat/sound-design-phase0-kenney-audit-20261115`.
Owner plan: `plans/SOUND_DESIGN_LIBRARY_2026-11-15.md` (currently draft PR #71).

## Current production — measured from repository source

| Area | Actual current state | Current owner |
|---|---|---|
| Original Remotion SFX | Two generated WAV files, `public/sfx/soft-cut.wav` (23,084 bytes) and `soft-tap.wav` (13,484 bytes) | `scripts/generate-sfx.mjs`, `src/EpisodeComposition.tsx` |
| Sound envelopes | scene cue 18 frames, volume 0.08; beat cue 14 frames, volume 0.09; max 2 extra beat taps/scene; optional music volume 0.07 | `content/visual-system.json#sound` |
| Source narration | Gemini approved one-take per language; verified imported word-level captions and source audio SHA required | language's `voice-profile.json`, `scripts/voice-import-state.mjs`, `scripts/cue-timeline.mjs` |
| Shared outputs | Remotion renders one shared body; builds platform-specific CTA endings; one continuous AAC audio mix; TikTok has a separate variant | `scripts/render-platform-videos.mjs`, `scripts/render-tiktok-review.mjs` |
| Archived skill SFX | 19 MP3 file paths in the media-use skill, **17 unique content blobs** | `.agents/skills/media-use/audio/assets/sfx/` |
| Embedded media-use sound loader | With a HeyGen credential, can retrieve online sounds; without it selects bundled MP3s. **This is separate from the ordinary Remotion production sound layer** | `.agents/skills/media-use/audio/scripts/lib/sfx.mjs` |
| Video publications | Require owner approval of the exact rendered preview; no agent action may infer authority from a TEST | `AI_RULES.md`, `content/WORKFLOW.md` |

The 19 existing bundled MP3s total **1,300,487 bytes** (Git tree size). Duplicate content pairs (same Git blob SHA-1): `click-soft.mp3`/`click.mp3` and `whoosh-short.mp3`/`whoosh.mp3`. There is no reason to ship redundant copies in a new production library.

The `media-use/audio/assets/sfx/CREDITS.md` claims that the entire bundle came from Pixabay, but **does not identify original asset page URLs, creator names, source hashes or date for each MP3**. The files are kept unchanged where they are: they are **not approved for repackaging as a new public raw SFX collection** without individual provenance audit.

Existing local WAV files have Git blob SHAs `a936be9ea7b0082f3ba75377250a578cec91d834` and `8e9da85fcebe246486e6963ba8e10d80e94675a8`. These are Git blob IDs, **not** WAV payload SHA-256: do not mislabel them as SHA-256.

## External source audit

- [Kenney UI Audio](https://kenney.nl/assets/ui-audio) advertises **50** files, version 1.0 (2012), **Creative Commons CC0**.
- [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) advertises **100** files, version 1.0 (2020), **Creative Commons CC0**.
- [Kenney support](https://kenney.nl/support) confirms free commercial use and no mandatory attribution; package-local license must still be read after a real download.
- **Publisher archives have not been downloaded in this branch yet.** Local container network is unavailable. The GitHub CI acquisition probe is intended to verify archive SHA-256, exact directory listings, playable formats, license texts and 50/100 counts before importing.
- A nonpublisher GitHub repackaging at `Calinou/kenney-ui-audio` (pinned `8c3d81b9159d058c444f89d12d518276b0b09345`) exposes **51 WAV files**, despite its README calling it a 50-sound pack. Therefore **do not import it as the certified official 50-file archive without investigation**.
- The other nonpublisher repackaging, `Calinou/kenney-interface-sounds` (pinned `4596a49eaf5a533948d49a47467f606bcdea70ff`), exposes 100 WAV files and the Kenney CC0 license; a converted third-party copy still does not replace authentic publisher-archive audit evidence.
- The Github connector's text-only blob-fetch endpoint cannot retrieve WAV bytes (Unicode decoding error), and the sandbox has no external network. Do not claim 150 assets were fetched or analyzed as playable files.

## P0 constraints/risk register

| Risk | Severity | Decision |
|---|---|---|
| License laundering / unaudited Pixabay MP3 redistribution | High | Do not copy bundled MP3s into new stock pack; preserve original folder and collect per-file proof separately |
| External archive count mismatch (51/50 in mirror) | High | Verify exact publisher ZIP; stop/flag count mismatch rather than delete or silently select 50 |
| Broken audio in repository | High | Do not change `public/sfx/`, `render-episode.mjs`, `EpisodeComposition.tsx` or voice profiles during P0/P1 |
| Audio-over-voice mixing | High | Voice quality and meaningful silence take precedence; future sound design limited by canonical volume/density rules |
| RU/TJ timing reuse | High | Separate localized cue/decision plans, hashes and CTA variants; no copy/paste of timestamps |
| CI auto-import supply chain | High | Hard-code official HTTPS source host, validate ZIP paths/size, license, sound count and signatures, no arbitrary scripts from archive |
| Expensive external sound APIs | Medium | Do not enable HeyGen retrieval or another provider for ordinary production |
| Need objective baseline audio metrics | Medium | Compute with ffprobe/EBU R128 when exact real review MP4s exist; do not invent missing LUFS/true-peak measurements |
| Bloat / 150 effects per render | Medium | Catalog only once; curate separately and load only selected files when opted in |
| Double-trigger of old and new cues | Medium | Future design must replace (not stack) existing soft-cut/tap only when opted-in and tested |

## P0 outputs and gates

- [x] Registered main SHA, original sound files, current controlling source and reference video workflows.
- [x] Counted 19 MP3s, 17 unique blobs, two duplicate pairs; captured byte totals and two original WAV Git SHAs.
- [x] Found lack of per-asset origin/license provenance for existing Pixabay bundle.
- [x] Verified publisher advertises 50+100 CC0 and identified unsafe 51/50 third-party discrepancy.
- [x] Execute official URL probe in GitHub Actions; **both URL responses were text/html, not ZIP**. Real archive/license/audio verification therefore remains BLOCKED. See `docs/audits/SOUNDKIT_KENNEY_ARCHIVE_PROBE.json` (automatically captured).
- [ ] Acquire genuine publisher ZIPs through the official free-download flow or a separately owner-approved pinned CC0 redistribution with exact byte provenance; rerun the audit against those actual archives.
- [ ] Compute file-level SHA-256/ffprobe metadata once official audio bytes are accessible in runner.
- [ ] Obtain real imported-voice baseline audio mix metrics and a listening sample (no production regeneration).

## Actual live publisher download evidence (GitHub Actions)

- [Probe run #43686300424](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/43686300424): unit tests passed, license gate intentionally failed closed.
- `UI Audio` official media URL replied `text/html` (18,499 bytes), not `PK` ZIP archive data.
- `Interface Sounds` official media URL replied `text/html` (18,690 bytes), not ZIP data.
- **0/150 actual audio files downloaded**, so 0 files copied into `assets/sound-library/`. No user-approved video or existing `public/sfx/` file changed.
- Publishing those HTML payloads as ZIP files or silently falling back to the 51/50 third-party WAV mirror is expressly disallowed. An alternate source requires verification/owner acknowledgment under the P1 plan.

**P0 is an engineering baseline, not listening QA. P1 assets must never be called imported before GitHub CI returns verified extracts and committed file hashes.**
