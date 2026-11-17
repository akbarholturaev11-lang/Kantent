/**
 * Content experiments engine (owner rule 2026-11-17; rules: content/EXPERIMENTS.md,
 * registry: content/experiments.json).
 *
 *   npm run content:experiments                         owner view: goal, styles, results, next decision
 *   npm run content:experiments -- --json               the same as JSON
 *   npm run content:experiments -- --brief <date>       script-writer brief for a calendar date
 *   npm run content:experiments -- --assign <id> [--write]   stable arm for a future calendar item
 *   npm run content:experiments -- --check              every future draft carries its assigned arm
 *   npm run content:experiments -- --review [--as-of <ISO>] [--write]
 *                                                       weekly review; --write adds a dated report
 *   npm run content:experiments -- --decide <experiment> --decision promote|keep-current|stop
 *        --owner-words "<owner's words>" --write        record the OWNER's decision (never automatic)
 *
 * Results come only from sourced Zernio observations joined to verified
 * publications (content/feedback/publications.json). Missing data stays
 * missing: a test without enough first-week evidence keeps running.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { addCalendarDays, calendarWeekday, contentTypeOf } from "./content-schedule.mjs";
import { deriveMetrics, loadObservations } from "./feedback-analyzer.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const EXPERIMENTS_FILE = "content/experiments.json";
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const HOUR = 3600000;
const STATUSES = ["queued", "active", "decided", "stopped"];
const DECISIONS = ["promote", "keep-current", "stop"];

export function readExperiments(root = ROOT) { return readJson(path.join(root, EXPERIMENTS_FILE)); }
/** The registry, or null in a project (or test sandbox) without one. */
export function readExperimentsIfPresent(root = ROOT) {
  const file = path.join(root, EXPERIMENTS_FILE);
  return fs.existsSync(file) ? readJson(file) : null;
}
export function writeExperiments(registry, root = ROOT) {
  fs.writeFileSync(path.join(root, EXPERIMENTS_FILE), JSON.stringify(registry, null, 2) + "\n");
}
function readContext(root) {
  return {
    calendar: readJson(path.join(root, "content", "calendar.json")),
    goals: readJson(path.join(root, "content", "creative-formats.json")).contentGoals?.byContentType ?? {},
    thresholds: readJson(path.join(root, "content", "hook-lab.json")).policy,
    variety: fs.existsSync(path.join(root, "content", "visual-variety.json")) ? readJson(path.join(root, "content", "visual-variety.json")) : null,
  };
}

/** Structural rules of the registry (one variable, one active test, goals from contentGoals). */
export function validateExperiments(registry, { goals = {}, variety = null } = {}) {
  const errors = [];
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.experiments)) return ["experiments.json needs schemaVersion 1 and experiments[]"];
  const ids = new Set();
  for (const exp of registry.experiments) {
    const at = `experiment ${exp.id ?? "?"}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(exp.id ?? "") || ids.has(exp.id)) errors.push(`${at}: missing or duplicate id`);
    ids.add(exp.id);
    if (!STATUSES.includes(exp.status)) errors.push(`${at}: invalid status`);
    if (!goals[exp.contentType]) errors.push(`${at}: content type has no goal in creative-formats.json#contentGoals`);
    if (typeof exp.variable !== "string" || !exp.variable.trim()) errors.push(`${at}: one named variable is required`);
    if (!Array.isArray(exp.arms) || exp.arms.length !== 2 || exp.arms[0]?.role !== "control" || exp.arms[1]?.role !== "candidate")
      errors.push(`${at}: exactly two arms, control first and candidate second`);
    for (const arm of exp.arms ?? [])
      if (!["A", "B"].includes(arm.id) || !Array.isArray(arm.steps) || !arm.steps.length || !arm.scriptBrief?.trim())
        errors.push(`${at}: arm ${arm.id ?? "?"} needs id A/B, steps and a scriptBrief`);
    if (!["video", "story"].includes(exp.unit) || (exp.unit === "story") !== (exp.contentType === "series-part"))
      errors.push(`${at}: series parts are assigned per story, other types per video`);
    if (exp.status === "active" && !/^\d{4}-\d{2}-\d{2}$/u.test(exp.startDate ?? "")) errors.push(`${at}: active test needs a startDate`);
    if (exp.status === "decided" && (!DECISIONS.includes(exp.decision?.decision) || !exp.decision?.ownerWords?.trim()))
      errors.push(`${at}: a decision needs the owner's own words`);
    if (exp.status !== "decided" && exp.decision != null && exp.status !== "stopped") errors.push(`${at}: a decision is recorded only with status decided`);
    const keys = new Set();
    for (const a of exp.assignments ?? []) {
      const key = a.seriesId ?? a.contentId;
      if (!key || !["A", "B"].includes(a.arm) || keys.has(key)) errors.push(`${at}: invalid or duplicate assignment ${key ?? "?"}`);
      keys.add(key);
      if (exp.unit === "story" && !a.seriesId) errors.push(`${at}: story assignments are per seriesId`);
    }
  }
  for (const exp of registry.experiments) if (exp.startsAfter && !ids.has(exp.startsAfter)) errors.push(`experiment ${exp.id}: unknown startsAfter`);
  const active = registry.experiments.filter((exp) => exp.status === "active");
  const varietyActive = (variety?.experiments ?? []).filter((exp) => exp.status === "active");
  const max = registry.policy?.maxActiveExperiments ?? 1;
  if (active.length + varietyActive.length > max)
    errors.push(`only ${max} test may run at a time; active: ${[...active, ...varietyActive].map((exp) => exp.id).join(", ")}`);
  return errors;
}

/** The active experiment covering a content type on a date (or null). */
export function activeExperimentFor(registry, contentType, date) {
  return (registry?.experiments ?? []).find((exp) => exp.status === "active" && exp.contentType === contentType && date >= exp.startDate) ?? null;
}

const assignmentKey = (exp, item) => (exp.unit === "story" ? item.series?.id : item.id);
const storedAssignment = (exp, item) => (exp.assignments ?? []).find((a) => (a.seriesId ?? a.contentId) === assignmentKey(exp, item)) ?? null;

/** The stored arm of a calendar item, or the next balanced arm when it has none yet. */
export function assignmentFor(registry, item) {
  const type = contentTypeOf(item);
  const exp = activeExperimentFor(registry, type, item.date);
  if (!exp) return null;
  const stored = storedAssignment(exp, item);
  if (stored) return { experimentId: exp.id, arm: stored.arm, stored: true };
  const list = exp.assignments ?? [];
  const count = (arm) => list.filter((a) => a.arm === arm).length;
  const latest = [...list].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).at(-1);
  const arm = count("A") < count("B") ? "A" : count("B") < count("A") ? "B" : latest?.arm === "A" ? "B" : "A";
  return { experimentId: exp.id, arm, stored: false };
}

/** Stores the arm for a future calendar item (idempotent; never re-assigns). */
export function assignItem(registry, item, { today }) {
  const result = assignmentFor(registry, item);
  if (!result) return { registry, assignment: null };
  if (result.stored) return { registry, assignment: result };
  if (item.date < today) throw Error(`${item.id} is in the past; experiments assign only future drafts.`);
  const exp = registry.experiments.find((entry) => entry.id === result.experimentId);
  const entry = exp.unit === "story"
    ? { seriesId: item.series.id, date: item.date, arm: result.arm, assignedAt: today }
    : { contentId: item.id, date: item.date, arm: result.arm, assignedAt: today };
  const next = structuredClone(registry);
  next.experiments.find((e) => e.id === exp.id).assignments.push(entry);
  return { registry: next, assignment: { ...result, stored: true } };
}

/** The script-writer brief for one calendar item (empty when no test covers it). */
export function experimentBrief(registry, item, goals = {}) {
  const result = assignmentFor(registry, item);
  if (!result) return null;
  const exp = registry.experiments.find((entry) => entry.id === result.experimentId);
  const arm = exp.arms.find((entry) => entry.id === result.arm);
  const goal = goals[exp.contentType];
  return [
    `Experiment ${exp.id} — ${item.date} ${item.id}`,
    `Goal (${exp.contentType}): ${goal?.goal ?? "?"} — judged by ${goal?.primaryMetric ?? "?"}.`,
    `Variable under test: ${exp.variable}. Change only this; keep: ${(exp.constants ?? []).join("; ")}.`,
    `Arm ${arm.id} (${arm.role}): ${arm.name}${result.stored ? "" : " — NOT stored yet: run --assign " + item.id + " --write first"}.`,
    arm.scriptBrief,
    exp.rule ?? "",
    `Record in the source JSON: "experiment": {"id": "${exp.id}", "arm": "${arm.id}", "structure": {${arm.steps.map((step) => `"${step}": "<sceneId>"`).join(", ")}}} — the same block in every language.`,
  ].filter(Boolean).join("\n");
}

/**
 * Errors of a future draft against its stored arm: the experiment block is
 * present, matches the stored arm and maps each step to a scene in order.
 */
export function draftExperimentErrors(registry, item, source) {
  const exp = activeExperimentFor(registry, contentTypeOf(item), item.date);
  if (!exp) return [];
  const stored = storedAssignment(exp, item);
  if (!stored) return [`${exp.id}: ${item.id} has no stored arm (npm run content:experiments -- --assign ${item.id} --write)`];
  const block = source?.experiment;
  if (block?.id !== exp.id || block?.arm !== stored.arm) return [`${exp.id}: source must carry "experiment": {"id": "${exp.id}", "arm": "${stored.arm}"}`];
  if (exp.unit === "story" || !Array.isArray(source.scenes)) return [];
  const arm = exp.arms.find((entry) => entry.id === stored.arm);
  const order = source.scenes.map((scene) => scene.id);
  const positions = arm.steps.map((step) => order.indexOf(block.structure?.[step]));
  const errors = [];
  if (Object.keys(block.structure ?? {}).join() !== arm.steps.join()) errors.push(`${exp.id}: structure must name ${arm.steps.join(" → ")} in order`);
  if (positions.some((index) => index < 0)) errors.push(`${exp.id}: every structure step must name a scene of this source`);
  else if (positions.some((index, i) => i && index < positions[i - 1])) errors.push(`${exp.id}: structure steps must follow the scene order`);
  else if (positions[0] !== 0) errors.push(`${exp.id}: the first step (${arm.steps[0]}) is the opening scene`);
  return errors;
}

function eligibleObservation(observations, policy) {
  const exact = observations.find((o) => o.window === "7d");
  if (exact) return { observation: exact, kind: "provider-exact", ageHours: 168 };
  const rule = policy.resultWindow.accepted.find((entry) => entry.kind === "cumulative-at-age");
  const aged = observations
    .filter((o) => o.window === "lifetime")
    .map((o) => ({ observation: o, kind: "cumulative-at-age", ageHours: (Date.parse(o.observedAt) - Date.parse(o.publishedAt)) / HOUR }))
    .filter((entry) => rule && entry.ageHours >= rule.minAgeHours && entry.ageHours < rule.maxAgeHours)
    .sort((a, b) => a.ageHours - b.ageHours);
  return aged[0] ?? null;
}

const median = (values) => {
  const list = values.filter((value) => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : +((list[mid - 1] + list[mid]) / 2).toFixed(4);
};

/** First-week results per arm and cohort, with a reasoned recommendation (never a forced winner). */
export function experimentResults(registry, exp, { publications = [], observations = [], goals = {}, thresholds = {}, asOf = new Date() }) {
  const policy = registry.policy;
  const goal = goals[exp.contentType] ?? {};
  const metric = goal.primaryMetric;
  const guards = goal.supportingMetrics ?? [];
  const minPosts = thresholds.minimumPostsPerFormat ?? 3;
  const minViews = thresholds.minimumViewsPerPost ?? 500;
  const minLift = thresholds.minimumRelativeLiftPercent ?? 10;
  const maxDrop = thresholds.maximumSecondaryIntentDropPercent ?? 10;
  const posts = publications.filter((p) => p.creative?.experimentId === exp.id);
  const rows = posts.map((p) => {
    const own = observations.filter((o) => (p.zernioPostId && o.zernioPostId === p.zernioPostId) ||
      (p.platformPostId && o.platformPostId === p.platformPostId && o.platform === p.platform));
    const pick = eligibleObservation(own, policy);
    const derived = pick ? deriveMetrics(pick.observation) : null;
    const published = own[0]?.publishedAt ?? p.publishedAt ?? p.scheduledFor ?? null;
    const ageDays = published ? (Date.parse(asOf) - Date.parse(published)) / (24 * HOUR) : null;
    return {
      contentId: p.content.id, language: p.content.language, platform: p.platform, arm: p.creative.arm, zernioPostId: p.zernioPostId,
      publishedAt: published, evidence: pick ? `${pick.kind} at ${pick.ageHours.toFixed(0)}h` : null,
      views: derived?.views ?? null, value: derived?.[metric] ?? null,
      guards: Object.fromEntries(guards.map((name) => [name, derived?.[name] ?? null])),
      status: !pick ? (ageDays != null && ageDays < 7 ? "waiting-for-day-7" : "no-first-week-snapshot")
        : (derived.views ?? 0) < minViews ? "below-minimum-views" : derived[metric] == null ? "metric-not-reported" : "eligible",
    };
  });
  const cohorts = [];
  for (const key of [...new Set(rows.map((row) => `${row.platform}|${row.language}`))].sort()) {
    const [platform, language] = key.split("|");
    const inCohort = rows.filter((row) => row.platform === platform && row.language === language);
    const arms = Object.fromEntries(["A", "B"].map((arm) => {
      const eligible = inCohort.filter((row) => row.arm === arm && row.status === "eligible");
      return [arm, { published: inCohort.filter((row) => row.arm === arm).length, eligible: eligible.length,
        median: median(eligible.map((row) => row.value)),
        guards: Object.fromEntries(guards.map((name) => [name, median(eligible.map((row) => row.guards[name]))])) }];
    }));
    let verdict;
    let lift = null;
    if (arms.A.eligible < minPosts || arms.B.eligible < minPosts) verdict = "insufficient-evidence";
    else if (!arms.A.median) verdict = arms.B.median ? "not-comparable-zero-baseline" : "no-clear-difference";
    else {
      lift = +(((arms.B.median - arms.A.median) / arms.A.median) * 100).toFixed(1);
      const guardDrop = guards.some((name) => arms.A.guards[name] && arms.B.guards[name] != null &&
        ((arms.B.guards[name] - arms.A.guards[name]) / arms.A.guards[name]) * 100 < -maxDrop);
      verdict = lift >= minLift && !guardDrop ? "candidate-better" : lift <= -minLift ? "control-better" : "no-clear-difference";
    }
    cohorts.push({ platform, language, arms, liftPercent: lift, verdict });
  }
  const verdicts = cohorts.map((cohort) => cohort.verdict);
  const decided = verdicts.filter((v) => ["candidate-better", "control-better", "no-clear-difference"].includes(v));
  let recommendation;
  let reason;
  if (!decided.length) {
    recommendation = "keep-testing";
    const need = cohorts.map((c) => `${c.platform}/${c.language}: A ${c.arms.A.eligible}/${minPosts}, B ${c.arms.B.eligible}/${minPosts}`).join("; ");
    reason = posts.length
      ? `Not enough first-week evidence yet (eligible posts per arm — ${need}). The test continues; no weekly winner is forced.`
      : "No published video of this test yet. The test continues.";
  } else if (verdicts.includes("candidate-better") && !verdicts.includes("control-better")) {
    recommendation = "propose-promotion";
    reason = `Arm B is at least ${minLift}% better on ${metric} without hurting ${guards.join(", ") || "supporting metrics"} in ${cohorts.filter((c) => c.verdict === "candidate-better").map((c) => `${c.platform}/${c.language}`).join(", ")}. Ask the owner whether to make it the main style.`;
  } else if (verdicts.includes("control-better") && !verdicts.includes("candidate-better")) {
    recommendation = "propose-keep-current";
    reason = `The current style (A) is at least ${minLift}% better on ${metric}. Ask the owner whether to stop the test and keep A.`;
  } else if (verdicts.includes("candidate-better") && verdicts.includes("control-better")) {
    recommendation = "keep-testing";
    reason = "Platforms disagree; the test continues until the evidence agrees.";
  } else {
    recommendation = "keep-testing";
    reason = `No clear difference on ${metric} yet; the current style stays.`;
  }
  return { id: exp.id, status: exp.status, contentType: exp.contentType, goal: goal.goal ?? null, primaryMetric: metric ?? null,
    variable: exp.variable, arms: exp.arms.map(({ id, role, name }) => ({ id, role, name })),
    assigned: (exp.assignments ?? []).length, publishedPosts: posts.length, posts: rows, cohorts, recommendation, reason };
}

/** Owner view and weekly review of every experiment. */
export function reviewExperiments({ root = ROOT, asOf = new Date(), registry = readExperiments(root), observations = null, publications = null } = {}) {
  const context = readContext(root);
  const errors = validateExperiments(registry, context);
  const pubs = publications ?? readJson(path.join(root, "content", "feedback", "publications.json")).records;
  const obs = observations ?? loadObservations(path.join(root, "content", "feedback", "observations"));
  const experiments = registry.experiments.map((exp) => exp.status === "queued"
    ? { id: exp.id, status: exp.status, contentType: exp.contentType, goal: context.goals[exp.contentType]?.goal ?? null,
        variable: exp.variable, arms: exp.arms.map(({ id, role, name }) => ({ id, role, name })), startsAfter: exp.startsAfter ?? null,
        recommendation: "queued", reason: `Starts after ${exp.startsAfter} is decided by the owner.` }
    : { ...experimentResults(registry, exp, { publications: pubs, observations: obs, goals: context.goals, thresholds: context.thresholds, asOf }),
        decision: exp.decision ?? null });
  const active = experiments.find((exp) => exp.status === "active") ?? null;
  const next = active ? registry.experiments.find((exp) => exp.status === "queued" && exp.startsAfter === active.id) : null;
  const nextDecision = !active ? "No active test: start the next queued test with the owner."
    : active.recommendation === "propose-promotion" ? `Owner decision needed: make "${active.arms[1].name}" the main ${active.contentType} style? (then ${next?.id ?? "no queued test"} starts)`
      : active.recommendation === "propose-keep-current" ? `Owner decision needed: keep "${active.arms[0].name}" and stop ${active.id}? (then ${next?.id ?? "no queued test"} starts)`
        : `Keep running ${active.id}; next review on the next ${registry.policy.reviewWeekday} Feedback run.`;
  return { asOf: new Date(asOf).toISOString(), errors, experiments, nextDecision };
}

export function reviewMarkdown(review) {
  const lines = [`# Experiment review — ${review.asOf.slice(0, 10)}`, "",
    "Source: `npm run content:experiments -- --review` (content/EXPERIMENTS.md). Sourced Zernio observations joined to verified publications only; missing data stays missing.", ""];
  for (const exp of review.experiments) {
    lines.push(`## ${exp.id} (${exp.status})`, "", `- Goal: ${exp.contentType} → ${exp.goal}${exp.primaryMetric ? ` (judged by ${exp.primaryMetric})` : ""}`,
      `- Compared: A ${exp.arms[0].name} (current) vs B ${exp.arms[1].name}`, `- Variable: ${exp.variable}`);
    if (exp.status !== "queued") {
      lines.push(`- Videos: ${exp.assigned} assigned, ${exp.publishedPosts} published posts`);
      for (const cohort of exp.cohorts)
        lines.push(`- ${cohort.platform}/${cohort.language}: A ${cohort.arms.A.eligible} eligible (median ${cohort.arms.A.median ?? "—"}), B ${cohort.arms.B.eligible} eligible (median ${cohort.arms.B.median ?? "—"}), lift ${cohort.liftPercent ?? "—"}% → ${cohort.verdict}`);
      for (const post of exp.posts) lines.push(`  - ${post.arm} ${post.contentId} ${post.platform}/${post.language} ${post.zernioPostId}: ${post.status}${post.evidence ? `, ${post.evidence}, value ${post.value ?? "—"}, views ${post.views ?? "—"}` : ""}`);
    }
    lines.push(`- Recommendation: **${exp.recommendation}** — ${exp.reason}`, "");
  }
  lines.push("## Next decision", "", review.nextDecision, "");
  if (review.errors.length) lines.push("## Registry problems", "", ...review.errors.map((error) => `- ${error}`), "");
  return lines.join("\n");
}

/** Records the owner's decision and schedules the next queued test (it starts the next Monday). */
export function recordDecision(registry, id, { decision, ownerWords, today }) {
  if (!DECISIONS.includes(decision)) throw Error(`--decision must be one of ${DECISIONS.join(", ")}`);
  if (!ownerWords?.trim()) throw Error("--owner-words with the owner's own words is required; the system never decides alone.");
  const next = structuredClone(registry);
  const exp = next.experiments.find((entry) => entry.id === id);
  if (!exp || exp.status !== "active") throw Error(`${id} is not the active experiment.`);
  exp.status = "decided";
  exp.decision = { decision, ownerWords: ownerWords.trim(), decidedOn: today,
    promotedArm: decision === "promote" ? "B" : null,
    note: decision === "promote" ? "Arm B becomes the main style only after its rule is written into the canonical policy (creative-formats.json / HOOK_LAB.md / PROMO_WORKFLOW.md) and npm run check:consistency passes." : null };
  const queued = next.experiments.find((entry) => entry.status === "queued" && entry.startsAfter === id);
  if (queued) {
    let start = addCalendarDays(today, 1);
    while (calendarWeekday(start) !== "MO") start = addCalendarDays(start, 1);
    queued.status = "active";
    queued.registeredAt = today;
    queued.startDate = start;
  }
  return next;
}

function sourceFor(root, item, language = "ru") {
  const languages = readJson(path.join(root, "content", "languages.json")).languages;
  const file = item.episodeFile ?? item.promoFile;
  if (!file) return null;
  const base = language === "ru" ? "content" : languages[language].contentRoot;
  const full = path.join(root, base, file);
  if (fs.existsSync(full)) return readJson(full);
  // Promo locales live next to the canonical promo (content/promos/<id>.<lang>.json is not assumed).
  return null;
}

/** Every future calendar item of an active test, checked in every production language. */
export function checkFutureDrafts({ root = ROOT, today }) {
  const registry = readExperiments(root);
  const { calendar } = readContext(root);
  const languages = readJson(path.join(root, "content", "languages.json"));
  const problems = [];
  for (const item of calendar.items.filter((entry) => entry.date >= today)) {
    if (!activeExperimentFor(registry, contentTypeOf(item), item.date)) continue;
    for (const language of languages.defaultProductionLanguages ?? ["ru"]) {
      const source = sourceFor(root, item, language);
      if (!source) { problems.push(`${item.id} ${language}: source not found`); continue; }
      for (const error of draftExperimentErrors(registry, item, source)) problems.push(`${item.id} ${language}: ${error}`);
    }
  }
  return problems;
}

function arg(args, name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; }
const todayIn = (timeZone) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function printOwnerView(review) {
  for (const exp of review.experiments) {
    console.log(`\n${exp.id} [${exp.status}] — ${exp.contentType}, goal: ${exp.goal}${exp.primaryMetric ? ` (${exp.primaryMetric})` : ""}`);
    console.log(`  A (current): ${exp.arms[0].name}\n  B (new):     ${exp.arms[1].name}`);
    if (exp.status !== "queued") {
      console.log(`  videos: ${exp.assigned} assigned, ${exp.publishedPosts} published posts`);
      for (const c of exp.cohorts) console.log(`  ${c.platform}/${c.language}: A ${c.arms.A.eligible} (median ${c.arms.A.median ?? "—"}) · B ${c.arms.B.eligible} (median ${c.arms.B.median ?? "—"}) → ${c.verdict}`);
    }
    console.log(`  → ${exp.recommendation}: ${exp.reason}`);
  }
  console.log(`\nNext decision: ${review.nextDecision}`);
  for (const error of review.errors) console.log(`REGISTRY: ${error}`);
}

export function runCli(args = process.argv.slice(2), root = ROOT) {
  const registry = readExperiments(root);
  const context = readContext(root);
  const today = arg(args, "--today") ?? todayIn(registry.policy.timezone);
  const write = args.includes("--write");
  if (args.includes("--brief")) {
    const date = arg(args, "--brief");
    const items = context.calendar.items.filter((item) => item.date === date);
    if (!items.length) { console.log(`No calendar item on ${date}.`); return 0; }
    for (const item of items) console.log(experimentBrief(registry, item, context.goals) ?? `${item.id}: no active experiment covers this ${contentTypeOf(item)}; write it in the current style.`);
    return 0;
  }
  if (args.includes("--assign")) {
    const id = arg(args, "--assign");
    const item = context.calendar.items.find((entry) => entry.id === id);
    if (!item) throw Error(`${id} is not in calendar.json`);
    const { registry: next, assignment } = assignItem(registry, item, { today });
    if (!assignment) { console.log(`${id}: no active experiment covers it.`); return 0; }
    if (write && JSON.stringify(next) !== JSON.stringify(registry)) writeExperiments(next, root);
    console.log(`${id}: ${assignment.experimentId} arm ${assignment.arm}${write ? " (stored)" : " (dry run; --write to store)"}`);
    return 0;
  }
  if (args.includes("--check")) {
    const problems = [...validateExperiments(registry, context), ...checkFutureDrafts({ root, today })];
    for (const problem of problems) console.log(problem);
    console.log(problems.length ? `${problems.length} experiment problem(s).` : "Every future draft of the active test carries its stored arm.");
    return problems.length ? 1 : 0;
  }
  if (args.includes("--decide")) {
    const next = recordDecision(registry, arg(args, "--decide"), { decision: arg(args, "--decision"), ownerWords: arg(args, "--owner-words"), today });
    if (!write) { console.log("Dry run; add --write to record the owner's decision."); return 0; }
    writeExperiments(next, root);
    console.log(`Recorded the owner's decision for ${arg(args, "--decide")}.`);
    return 0;
  }
  const asOf = arg(args, "--as-of") ?? new Date().toISOString();
  const review = reviewExperiments({ root, asOf, registry });
  if (args.includes("--json")) console.log(JSON.stringify(review, null, 2));
  else if (args.includes("--review")) {
    const text = reviewMarkdown(review);
    if (write) {
      const file = path.join(root, "content", "feedback", "reports", `${review.asOf.slice(0, 10)}-experiment-review.md`);
      if (fs.existsSync(file)) throw Error(`${path.relative(root, file)} exists; reports are append-only.`);
      fs.writeFileSync(file, text);
      console.log(`Wrote ${path.relative(root, file)}`);
    } else console.log(text);
  } else printOwnerView(review);
  return review.errors.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try { process.exitCode = runCli(); } catch (error) { console.error(`EXPERIMENTS: ${error.message}`); process.exitCode = 1; }
}
