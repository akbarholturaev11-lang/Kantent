# Viral Discovery rollout — 2026-11-28

Scope: owner-requested 3,000 views / two attempts, with Sunday batch production unchanged.
This branch is **phase 1 shadow only**, not an active policy migration.
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
