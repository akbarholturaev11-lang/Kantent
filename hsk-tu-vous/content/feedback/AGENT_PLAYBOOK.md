# HSK AI Content — feedback agent playbook

This runbook is for ChatGPT using its already-connected **Zernio and GitHub** tools. It is not a background daemon. It requires no additional API key and collects no HSK AI application user data.

## Analysis run (proposed cadence: Monday / Wednesday / Friday, Asia/Shanghai)

1. Fetch the latest GitHub branch SHA and read the **current** `hsk-tu-vous/AGENTS.md`, `AI_RULES.md`, `content/calendar.json`, `content/hook-lab.json` and `content/cta-lab.json`.
2. Read the performance horizon and windows ONLY from `content/hook-lab.json#policy` (rolling 30 days by actual `publishedAt`; `24h` early signal; `7d` primary). Query connected Zernio Instagram/TikTok accounts for real posts published during the recent horizon and collect actual post ID, timestamps, units and metrics. If platform/provider history coverage is less than 30 days, report the coverage gap. Do not present unavailable records as zero.
3. Add a provenance-stamped snapshot in `content/feedback/observations/` following the README and schema. For cumulative Zernio totals use `window: "lifetime"`, not fabricated exact 24h/7d windows.
4. Match source `episodeId` / hook format / HSK level / effect style only if the published media and existing episode source prove the mapping. Unverified fields remain `null`.
5. Inspect the read-only `content:feedback` and `content:buffer` reports. For a new cycle create a dated feedback report containing OBSERVATION, HYPOTHESIS, EXPERIMENT and DECISION sections, plus source links and uncertainty. Only source-verified `24h` may provide an early signal; only source-verified `7d` within the rolling 30-day publication cohort may support a primary recommendation. Require verified episode-to-post mapping, matched platform, same window, level, duration band, minimum comparable post sample and views. No lifetime/72h substitution. Never infer a 24h or 7d result simply by waiting 24h or 7d before fetching cumulative lifetime.
6. If the scenario reserve is below target, run `npm run content:scenario-buffer -- --json` or replicate its deterministic rules from the canonical calendar. First repair broken **unapproved** future plans. Then autonomously author the needed NEW future dated **full** CTA-free scenarios (not placeholders) in `content/episodes/`, add calendar rows in the same GitHub PR, verify each Chinese claim with trustworthy citations and register distinct topic-specific Hook experiments. The owner has authorised future draft replenishment; this does not authorise production, new CTA variants, voice changes or social publishing.
7. Only modify *unapproved future* script drafts when permitted by canonical production rules. Performance-led adoption requires an eligible primary `7d` group, the existing Hook Lab lift/secondary-metric criteria, explicit documentation of the experiment and a GitHub review PR. When evidence is missing, offer exploratory hypotheses rather than asserting a performance improvement. Do not change canonical CTA wording, provider voice, approved/published snapshots, publication, or core renderer.
8. Commit through a branch/PR and run repository tests. Summarize metrics, caveats, exact changed files, SHA and current merge status. Never claim unattended execution unless the scheduled task actually confirmed it.

## Before each new video

Fetch the latest `main` SHA and current episode, Hook Lab, CTA Lab and voice/visual rules immediately before preparing working media. Capture the SHA used in production metadata. If relevant source files change before render/review, invalidate the old working preview and refresh the appropriate dependencies.

## Non-goals

No customer-install attribution, no separate social API token, no user data extraction, no causal claim from views alone, no automatic winner declaration, no autonomous publishing. Existing owner approval of the exact final preview remains mandatory.
