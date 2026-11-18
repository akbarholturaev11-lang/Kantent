# CI observation integrity correction — 2026-11-18

## OBSERVATION
GitHub Actions [Canonical source consistency run 44211630138](https://github.com/akbarholturaev11-lang/Kantent/actions/runs/44211630138) failed at step **Test Zernio feedback analyzer and source snapshots**. Job logs: `Invalid feedback: Observation 0: storytellingPattern requires a verified episode, hook, HSK and creative format attribution`.

The raw Zernio metrics and verified publication mappings were not the defect. The Feedback run wrote `storytellingPattern: "direct"` for **three** approved-but-incompletely-attributed RU videos in **each** of these two observation files. Their `hskLevel` and `creativeFormatId` are null. The current validator correctly rejects that asserted storytelling evidence. No additional HSK/format evidence was discovered.

## CORRECTION (narrow owner-requested exception to raw snapshot immutability)
This is an explicitly documented exception, made after owner asked to find and remove the cause of CI failure. No observation files were deleted or replaced by unrelated snapshots. With freshly fetched GitHub blob SHA, only six unsupported storytelling values were changed from `"direct"` to `null`:

- `content/feedback/observations/instagram-2026-11-18.json`: prior blob `eb7e1fa81b4bfac999d3bdc15a7cc046b4165833`, corrected blob `9880c7a2c4369fe2e21fde8ea79cafcee40a64f6`, commit `6fa2360d668ddf996f11d1667de4fe9db174821e`.
- `content/feedback/observations/youtube-2026-11-18.json`: prior blob `b00ab1321ac202e191bf9c44e65d064239c8291b`, corrected blob `35c4426fcf46c07668fe815691c71264735418db`, commit `b5a0ff8ad1f00c11ed649471dad8ca70fbe240f2`.

All real metric counts, timestamps, platform/Zernio IDs, source provider provenance, hashes and source identities were kept byte-for-byte except these six fields. Both corrected files were fetched back from `main` and matched the expected full content. No validator, script, CTA, experiment, calendar, video or publishing code was modified.

## PROVIDER LIMITATION
Connected Zernio TJ `get_post` returns approved video statuses `published` and URLs for Instagram `6afbc565660b23b40d686cd7` and YouTube `6afbc5bfd0ac7be2b45a693d`, but no explicit native `platformPostId` for either; `get_post_analytics` likewise does not supply a native ID. YouTube analytics are still `sync_status: pending`. The ledger's native ID remains `null` per owner policy; parsing the URL into an assumed ID is forbidden. This is a provider response limitation, not a disconnected account.

## DECISION
Preserve the validated snapshot schema and mark unproven creative attribution null. The scheduled Feedback prompt was strengthened with a mandatory pre-write dataset validation and strict `storytellingPattern` prerequisite; schedule unchanged. Check the actual Actions run on the resulting head before claiming successful CI.
