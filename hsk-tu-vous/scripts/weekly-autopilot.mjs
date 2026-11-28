/**
 * Weekly autopilot helper (owner rule 2026-11-17; policy content/weekly-autopilot.json,
 * runbook content/WORKFLOW.md#weekly-autopilot). Deterministic parts only; the
 * Hafta Rejachisi agent (scheduled task hsk-hafta-rejachisi) does the creative work, QA and fixes.
 *
 *   node scripts/weekly-autopilot.mjs plan [--week-start YYYY-MM-DD] [--json]
 *        next Monday..Sunday: content, experiment arm, source readiness, review stage,
 *        publish targets and default times, what is already scheduled
 *   node scripts/weekly-autopilot.mjs post-json <date> <language> <platform> <out.json>
 *        the exact post JSON (caption from the package's post.md, settings, time)
 *        for scripts/codex-local-video-publish.mjs under the standing approval
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { addCalendarDays, calendarWeekday, contentTypeOf } from "./content-schedule.mjs";
import { inspectDraftReadiness } from "./self-improvement-check.mjs";
import { assignmentFor, readExperimentsIfPresent } from "./experiments.mjs";
import { readDiscoveryWeek } from "./viral-plan.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const tryJson = (file) => { try { return readJson(file); } catch { return null; } };

/** UTC offset in minutes of a time zone at an instant. */
function offsetMinutes(timeZone, instant) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(instant).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** "<date> <localTime> in <zone>" as an ISO string in the calendar zone (Asia/Shanghai, +08:00). */
export function scheduledFor(date, { localTime, timezone }, calendarZone = "Asia/Shanghai") {
  const [h, m] = localTime.split(":").map(Number);
  const guess = new Date(`${date}T${localTime}:00Z`);
  const utc = new Date(Date.UTC(...date.split("-").map((v, i) => (i === 1 ? +v - 1 : +v)), h, m) - offsetMinutes(timezone, guess) * 60000);
  const off = offsetMinutes(calendarZone, utc);
  const local = new Date(utc.getTime() + off * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  const sign = off >= 0 ? "+" : "-";
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:00` +
    `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

export function nextWeekStart(today) {
  let date = addCalendarDays(today, 1);
  while (calendarWeekday(date) !== "MO") date = addCalendarDays(date, 1);
  return date;
}

/** Package folder of a language/platform inside review/<id>. */
export function packageDir(root, id, language, platform) {
  return path.join(root, "review", id, ...(language === "ru" ? [] : [language]), ...(platform === "instagram" ? [] : [platform]));
}

export function weekPlan({ root = ROOT, weekStart, now=new Date() }) {
  const calendar = readJson(path.join(root, "content", "calendar.json"));
  const autopilot = readJson(path.join(root, "content", "weekly-autopilot.json"));
  const destinations = readJson(path.join(root, "content", "publication-destinations.json")).videoDestinations;
  const languages = readJson(path.join(root, "content", "languages.json")).defaultProductionLanguages ?? ["ru"];
  const ledger = tryJson(path.join(root, "content", "feedback", "publications.json"))?.records ?? [];
  const experiments = readExperimentsIfPresent(root);
  const dates = Array.from({ length: 7 }, (_, i) => addCalendarDays(weekStart, i));
  const days = dates.map((date) => {
    const items = calendar.items.filter((item) => item.date === date);
    if (!items.length) return { date, weekday: calendarWeekday(date), missing: true,
      expected: (calendar.weeklySchedule?.days ?? []).find((day) => day.weekday === calendarWeekday(date)) ?? null };
    return { date, weekday: calendarWeekday(date), items: items.map((item) => {
      const readiness = inspectDraftReadiness(root, item);
      const arm = experiments ? assignmentFor(experiments, item) : null;
      return { id: item.id, type: contentTypeOf(item), series: item.series ?? null, experiment: arm,
        sourceReady: readiness.ready, sourceReason: readiness.reason ?? null,
        languages: Object.fromEntries(languages.map((language) => {
          const targets = Object.entries(destinations[language]?.platforms ?? {}).map(([platform, spec]) => {
            const dir = packageDir(root, item.id, language, platform);
            const scheduled = ledger.find((r) => r.content?.id === item.id && r.content?.language === language && r.platform === platform);
            return { platform, account: spec.account, auto: spec.zernioPublishingAuthorized === true,
              stage: tryJson(path.join(dir, "status.json"))?.stage ?? null, video: fs.existsSync(path.join(dir, "video.mp4")),
              scheduledFor: scheduledFor(date, autopilot.publishTimes.default[language]),
              zernioPostId: scheduled?.zernioPostId ?? null };
          });
          return [language, { stage: tryJson(path.join(root, "review", item.id, "languages-status.json"))?.variants?.[language]?.stage ?? null, targets }];
        })) };
    }) };
  });
  const discoveryWeek=readDiscoveryWeek({projectRoot:root,calendar,today:addCalendarDays(weekStart,-1),now});
  return { weekStart, weekEnd: dates[6], days, ...(discoveryWeek?{discoveryWeek}:{}) };
}

/** The exact post JSON for the local Zernio publisher (caption = post.md up to its metadata footer). */
export function postJson({ root = ROOT, date, language, platform }) {
  const calendar = readJson(path.join(root, "content", "calendar.json"));
  const autopilot = readJson(path.join(root, "content", "weekly-autopilot.json"));
  const item = calendar.items.find((entry) => entry.date === date);
  if (!item) throw Error(`no calendar item on ${date}`);
  const dir = packageDir(root, item.id, language, platform);
  const text = fs.readFileSync(path.join(dir, "post.md"), "utf8");
  const footer = /\n\n(?:Тема|Мавзӯъ):/u.exec(text);
  const content = (footer ? text.slice(0, footer.index) : text).trim();
  const episode = readJson(path.join(dir, "episode.json"));
  const settings = platform === "instagram" ? { shareToFeed: true, isAiGenerated: true }
    : platform === "youtube" ? { title: String(episode.title ?? item.topic ?? item.id).slice(0, 100), visibility: "public", madeForKids: false, containsSyntheticMedia: true }
      : platform === "tiktok" ? { tiktokSettings: { privacy_level: "PUBLIC_TO_EVERYONE", allow_comment: true, allow_duet: false, allow_stitch: false,
          content_preview_confirmed: true, express_consent_given: true, video_made_with_ai: true, commercialContentType: "none" } }
        : {};
  return { content, ...settings, scheduledFor: scheduledFor(date, autopilot.publishTimes.default[language]) };
}

/** Whether the owner-approved OpenRouter voice fallback is configured (names only; values are never read out). */
export function voiceFallbackReady(root = ROOT, env = process.env) {
  let file = "";
  try { file = fs.readFileSync(path.join(root, ".env.local"), "utf8"); } catch { /* no local env file */ }
  const has = (name, pattern) => pattern.test(String(env[name] ?? "")) ||
    new RegExp(`^\\s*${name}\\s*=\\s*${pattern.source}`, "m").test(file);
  return { fallbackEnabled: has("HSK_AI_OPENROUTER_FALLBACK_ENABLED", /true/), openRouterKey: has("OPENROUTER_API_KEY", /\S+/) };
}

function printPlan(plan) {
  console.log(`Week ${plan.weekStart} … ${plan.weekEnd}`);
  const fallback = voiceFallbackReady();
  console.log(fallback.fallbackEnabled && fallback.openRouterKey
    ? "Voice: Gemini first, OpenRouter fallback on quota (429) is configured."
    : "WARNING: OpenRouter voice fallback is NOT configured (HSK_AI_OPENROUTER_FALLBACK_ENABLED=true + OPENROUTER_API_KEY) — a Gemini quota stop will wait for the reset.");
  for(const slot of plan.discoveryWeek?.slots??[])if(slot.contentType==='lesson')console.log('Discovery (shadow) '+slot.date+': '+slot.action+' '+(slot.discoveryFormatId??''));
  for (const day of plan.days) {
    if (day.missing) { console.log(`${day.date} ${day.weekday}: NO calendar item (expected ${day.expected?.contentType ?? "?"}) — author it first`); continue; }
    for (const item of day.items) {
      console.log(`${day.date} ${day.weekday}: ${item.id} [${item.type}${item.experiment ? ` ${item.experiment.experimentId}/${item.experiment.arm}` : ""}] source ${item.sourceReady ? "ready" : `NOT ready (${item.sourceReason})`}`);
      for (const [language, info] of Object.entries(item.languages))
        console.log(`   ${language} stage=${info.stage ?? "—"}: ` + info.targets.map((t) => `${t.platform}${t.auto ? "" : "(manual)"}${t.zernioPostId ? "✓" : t.video ? "▶" : ""}@${t.scheduledFor.slice(11, 16)}`).join(" "));
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [command, ...args] = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  try {
    if (command === "plan") {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
      const plan = weekPlan({ weekStart: opt("--week-start") ?? nextWeekStart(today) });
      if (args.includes("--json")) console.log(JSON.stringify(plan, null, 2)); else printPlan(plan);
    } else if (command === "post-json") {
      const [date, language, platform, out] = args;
      const body = postJson({ date, language, platform });
      fs.writeFileSync(out, JSON.stringify(body, null, 1));
      console.log(`${out}: ${language}/${platform} ${body.scheduledFor}`);
    } else throw Error("usage: plan [--week-start YYYY-MM-DD] [--json] | post-json <date> <language> <platform> <out.json>");
  } catch (error) { console.error(`AUTOPILOT: ${error.message}`); process.exitCode = 1; }
}
