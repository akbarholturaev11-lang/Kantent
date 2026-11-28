# Viral Discovery rollout — 2026-11-28

Scope: owner-requested 3,000 views / two attempts, with Sunday batch production unchanged.
Current branch includes the phase 3 active-policy candidate; main is unchanged until reviewed and merged. Prior phase descriptions below are historical.
Canonical trial threshold proposal: `content/hook-lab.json#policy.discoveryPilot`.
The existing fixed-window A/B policy remains active until phase 2 is complete.

## Implemented in this change
- Read-only `content:viral-plan -- --json` discovery section with exact account + native/Zernio identity, approved receipt, independent content IDs and language-specific platform status.
- First observed cumulative lifetime snapshot at or after 72 hours, with actual age and timestamp provenance; never relabel as exact 72h. Later verified threshold hits can revive the state.
- First full miss or one-platform hit gets another topic; two full misses retire; any hit remains recorded for its platform; independent repeat hits can be replicated. Missing or immature data is not failure. Existing in-flight attempt blocks a third retry.
- Legacy experiment arm diagnostics are explicitly non-actionable. Unattributed threshold hits are reported, never assigned from dates or titles.
- Regression tests included through the existing viral-plan test entry.

## Remaining before activation
1. Reconcile the 11 November Instagram RU 3,439-view Reel using original provider receipt and exact original media/source. If impossible, keep it unattributed; inspect media as research only. Do not rewrite raw observations or historical approvals.
2. Register specific discovery families prospectively, not broad hook formats; bind the family, exact script and source identity to all published receipts. Validate localizations and migrations. Define known formats and external evidence in the existing creative registry/skill.
3. Implement the weekly allocation in existing Calendar Reserve: one replication, one retry, one exploration when available, fill empty lanes with exploration. No waiting for all data, no changing an already voiced/approved/scheduled video. Freeze the 7-slot plan on Sunday; account outcomes separate, same RU/TJ production path. Daily Feedback remains observations-only. Both Sunday agents can recompute a deterministic plan from the same committed cutoff; persist the chosen weekly assignments before TTS.
4. Migrate active lesson A/B rules and validators together (experiments.mjs, buffer, workflow, agent instructions, documentation); archive historical assignments unchanged and preserve ad/series business goals. No additional agent, API or per-platform render required. Run consistency, regression and current real-data shadow report; fix pre-existing CI fixture failures without weakening validation.
5. Competitor sample, first-frame/media review, platform retention sources, 30-day prospective evaluation (per locale/platform, age-matched hit rate and median, repeat successes, 10k+ and 7/7 production). No claim of viral causality from this threshold.

## Phase 2 — weekly shadow proposal and prospective metadata
- `content:viral-plan -- --json` now also returns `discoveryWeek`, seven typed slots using the canonical schedule and Sunday 08:00 China cutoff. Evidence after cutoff/collection is excluded. Existing dates and scheduled families are protected; new lessons get distinct retry/replicate/explore candidates. All unavailable candidates yield `author-new-family` rather than a blocked week or a forced retired family. RU/TG share a source family and their evidence is separate. Initial nine editorial hypotheses live in `creative-formats.json#discoveryFamilies` (not proven competitors).
- New exact-package creative receipts include optional prospective `hookExperiment.discoveryFormatId`, explicit HSK level and creative format, never retroactively mutate existing receipts. Discovery reads raw validated snapshots, not an already enriched attribution join.
- Corrected two pre-existing non-hermetic tests: synthetic attribution fixture and balanced-arm fixture pinned to the first two assignments; no validation weakened. Phase 1 CI run 46152541868 verified all eight new tests passed; legacy fixture failures blocked the full run.
- **Still shadow**: no active authoring-policy migration, frozen assignment persistence, or production publishing changes. Activation requires coherent canonical rule and draft-validator migration, real-data verification and full CI.

- CI run 46152787642 exposed an integration issue in the historical October report (before the typed weekly calendar effective date). The planner now returns an explicit empty historical-week proposal rather than inventing slots or throwing; regression test added. The two previous fixture failures were corrected in this run. Full CI must be checked on the new head.

## Phase 2 integration readback
- The existing reserve CLI, MCP weekly plan and Hafta Rejachisi plan now expose the same shared `readDiscoveryWeek` proposal. It is read-only, leaves the 7-slot source plan/production untouched and has no new scheduler. The existing authoring gate still requires the active A/B arm until migration; frozen decision persistence and actual activation remain outstanding. The existing CI test entry includes a real-calendar weekly proposal test.

## Phase 3 — active policy candidate
- Previous head b9d4910: both CI runs 46152966249 and 46152966226 passed. New branch changes switch new standalone lessons from old A/B to Discovery at 2026-11-30; old assignments and queued ad/serial tests are retained. Reserve and weekly autopilot share one immutable seven-slot freeze record in the existing calendar, with dry-run/explicit write support and RU/TG draft checks. No actual weekly sources, render, publishing or main changes were made.
- Weekly competitor research is a permitted hypothesis source; original public evidence sample and 30-day prospective results remain outstanding. The highest lifetime peak and hit tiers are preserved separately from the first decision observation.
- New CI, exact receipt capture from a prospectively tagged real publication, and weekly agent live run are not yet verified. Keep PR draft until code checks pass; do not claim real viral lift.
