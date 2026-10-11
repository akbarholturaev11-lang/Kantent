# HSK AI Content — feedback agent playbook

This runbook is for ChatGPT using its already-connected **Zernio and GitHub** tools. It is not a background daemon. It requires no additional API key and collects no HSK AI application user data.

## GitHub connector writes for scheduled agents (mandatory)

Use the **connected GitHub connector's write actions** when changing repository files. A GitHub search, read-only web fetch, chat-generated patch or locally described edit is **not** a repository write. On each run, read the latest `main` and canonical project rules first; never rely on a historical feature branch or a previously cached SHA.

1. Verify repository write permission. Read the target file with `mcp__GitHub__fetch_file` and retain its current blob `sha`. Use `mcp__GitHub__create_branch` with `base_ref: "main"` and a unique topic/date branch. Never write scheduled changes directly to `main`.
2. For existing files, use `mcp__GitHub__update_file` with `repository_full_name`, `branch`, `path`, the **full replacement UTF-8 `content`**, `message`, and **that file's current blob `sha`**. Use `mcp__GitHub__create_file` for a new path. Write changes to the same path sequentially, not in parallel; on SHA conflicts re-fetch and reconcile rather than overwriting other work.
3. Fetch the changed files again **from the topic branch** and independently verify episode IDs/dates, Chinese facts, pronunciation, real working source URLs and the facts they support, CTA-free structure, complete scene narration/cards, hook preregistration and calendar references. URL syntax or a populated `learningFactSources` array alone is not proof that a source was checked. Preserve approved/published histories, central CTA, approved voice, render code and publishing controls.
4. Create a **review** pull request with `mcp__GitHub__create_pull_request` (`base: "main"`, `head: <topic branch>`); do not auto-merge. Observe the actual PR HEAD and `mcp__GitHub__fetch_commit_workflow_runs` / `fetch_workflow_run_jobs` / job logs. If CI fails, correct the precise failure in the same branch and wait for the **new HEAD's** CI result. Report success only after the workflow concludes successfully. Invalidation of an old CTA registration after lesson edits is a *required guardrail*; do not silently reuse stale approval.
5. Record the exact changed paths, commit SHA, PR URL, CI conclusion and merge state. If the write connector, source verification or workflow is unavailable, **report the blocker and incomplete work**, never claim it was pushed, tested, merged or published. Do not bypass a safety denial, create separate tokens or obtain HSK AI server data.

The repository's 2026-10-11 [PR #5](https://github.com/akbarholturaev11-lang/Kantent/pull/5) demonstrates the successful branch → file SHA → sequential update → PR → CI → owner-authorized merge flow. This example is not permission to auto-merge later scheduled PRs.

## Analysis run (proposed cadence: Monday / Wednesday / Friday, Asia/Shanghai)

1. Fetch the latest GitHub branch SHA and read the **current** `hsk-tu-vous/AGENTS.md`, `AI_RULES.md`, `content/calendar.json`, `content/hook-lab.json` and `content/cta-lab.json`.
2. Read the performance horizon and windows ONLY from `content/hook-lab.json#policy` (rolling 30 days by actual `publishedAt`; `24h` early signal; `7d` primary). Query connected Zernio Instagram/TikTok accounts for real posts published during the recent horizon and collect actual post ID, timestamps, units and metrics. If platform/provider history coverage is less than 30 days, report the coverage gap. Do not present unavailable records as zero.
3. Add a provenance-stamped snapshot in `content/feedback/observations/` following the README and schema. For cumulative Zernio totals use `window: "lifetime"`, not fabricated exact 24h/7d windows.
4. Match source `episodeId` / hook format / HSK level / effect style only if the published media and existing episode source prove the mapping. Unverified fields remain `null`.
5. Inspect the read-only `content:feedback`, `content:viral-plan` and `content:buffer` reports. For a new cycle create a dated feedback report containing OBSERVATION, HYPOTHESIS, EXPERIMENT and DECISION sections, plus source links and uncertainty. Only source-verified `24h` may provide an early signal; only source-verified `7d` within the rolling 30-day publication cohort may support a primary recommendation. Require verified episode-to-post mapping, matched platform, same window, level, duration band, minimum comparable post sample and views. No lifetime/72h substitution. Never infer a 24h or 7d result simply by waiting 24h or 7d before fetching cumulative lifetime.
6. If the scenario reserve is below target, run `npm run content:scenario-buffer -- --json` or replicate its deterministic rules from the canonical calendar. First repair broken **unapproved** future plans. Then autonomously author the needed NEW future dated **full** CTA-free scenarios (not placeholders) in `content/episodes/`, add calendar rows in the same GitHub PR, verify each Chinese claim with trustworthy citations and register distinct topic-specific Hook experiments. The owner has authorised future draft replenishment; this does not authorise production, new CTA variants, voice changes or social publishing.
7. Only modify *unapproved future* script drafts when permitted by canonical production rules. Performance-led adoption requires an eligible primary `7d` group, the existing Hook Lab lift/secondary-metric criteria, explicit documentation of the experiment and a GitHub review PR. When evidence is missing, offer exploratory hypotheses rather than asserting a performance improvement. Do not change canonical CTA wording, provider voice, approved/published snapshots, publication, or core renderer.
8. Commit through a branch/PR and run repository tests. Summarize metrics, caveats, exact changed files, SHA and current merge status. Never claim unattended execution unless the scheduled task actually confirmed it.

## Before each new video

Fetch the latest `main` SHA and current episode, Hook Lab, CTA Lab and voice/visual rules immediately before preparing working media. Capture the SHA used in production metadata. If relevant source files change before render/review, invalidate the old working preview and refresh the appropriate dependencies.

## Non-goals

No customer-install attribution, no separate social API token, no user data extraction, no causal claim from views alone, no automatic winner declaration, no autonomous publishing. Existing owner approval of the exact final preview remains mandatory.
