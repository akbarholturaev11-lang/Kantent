import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const activeDocs = [
  "../HSK_AI_Content_System.md",
  "AGENTS.md",
  "AI_RULES.md",
  "PROJECT_MEMORY.md",
  "README.md",
  "content/WORKFLOW.md",
  "content/CONTENT_PLAN.md",
  "content/SKILLS.md",
  "content/CTA_LAB.md",
  "content/HOOK_LAB.md",
  "content/EDITING_SPEC.md",
  "content/EPISODE_SCHEMA.md",
  "content/REFERENCE_AUDIT.md",
  "content/reference-sources.md",
];

function asPath(root, relativePath) {
  return path.resolve(root, relativePath);
}

function readJson(root, relativePath, errors) {
  const file = asPath(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${relativePath}: cannot read/parse JSON (${e.message})`);
    return null;
  }
}

export function findDuplicatedValues(text, settings) {
  const errors = [];
  const voice = settings.voice ?? {};
  const cta = settings.cta?.offer ?? {};
  const restricted = [
    ["voice.voiceName", voice.voiceName],
    ["voice.serviceName", voice.serviceName],
    ["voice.provider", voice.provider],
    ["voice.site", voice.site],
    ["voice.locale", voice.locale],
    ["cta.offer.canonicalRussian", cta.canonicalRussian],
  ];

  for (const [label, value] of restricted) {
    if (typeof value === "string" && value.trim().length >= 3 && text.includes(value)) {
      errors.push(`copied mutable value ${label}; refer to the owning JSON instead`);
    }
  }

  // Do not let active explanations become a copied calendar.
  if (/\b\d+\s+(?:production\s+)?(?:dates|episodes|дат(?:ы)?|выпуск(?:а|ов)?|ta\s+video)\b/iu.test(text)) {
    errors.push("hard-coded episode count; read content/calendar.json instead");
  }
  return errors;
}

export function validateConsistency(root = projectRoot) {
  const errors = [];
  const calendar = readJson(root, "content/calendar.json", errors);
  const voice = readJson(root, "content/voice-profile.json", errors);
  const cta = readJson(root, "content/cta-lab.json", errors);
  const hook = readJson(root, "content/hook-lab.json", errors);
  const visual = readJson(root, "content/visual-system.json", errors);

  if (calendar) {
    if (!calendar.timezone || !Array.isArray(calendar.items) || calendar.items.length === 0) {
      errors.push("content/calendar.json: missing timezone or episodes");
    } else {
      const ids = new Set();
      const dates = new Set();
      for (const item of calendar.items) {
        if (!item.id || ids.has(item.id)) errors.push(`content/calendar.json: missing/duplicate episode id ${item.id}`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date ?? "") || dates.has(item.date)) {
          errors.push(`content/calendar.json: invalid/duplicate date ${item.date}`);
        }
        ids.add(item.id);
        dates.add(item.date);
        const filename = item.episodeFile;
        if (!filename || path.isAbsolute(filename) || filename.includes("..") || !filename.startsWith("episodes/")) {
          errors.push(`content/calendar.json: invalid episode path for ${item.id}`);
        } else {
          readJson(root, path.posix.join("content", filename), errors);
        }
      }
    }
  }

  if (!voice?.voiceName || !voice?.provider || !voice?.site || !voice?.locale || !voice?.status) {
    errors.push("content/voice-profile.json: missing canonical voice configuration");
  }
  if (!cta?.offer?.canonicalRussian || !cta?.offer?.id) {
    errors.push("content/cta-lab.json: missing canonical offer text/id");
  }
  if (!hook?.policy) errors.push("content/hook-lab.json: missing hook policy");
  if (!visual?.colors || !visual?.motion) errors.push("content/visual-system.json: missing visual tokens");

  for (const doc of activeDocs) {
    const file = asPath(root, doc);
    let contents;
    try {
      contents = fs.readFileSync(file, "utf8");
    } catch (e) {
      errors.push(`${doc}: cannot read active document (${e.message})`);
      continue;
    }
    for (const error of findDuplicatedValues(contents, { voice, cta })) {
      errors.push(`${doc}: ${error}`);
    }
  }

  // The owner must be able to run this check before a push.
  try {
    const pkg = readJson(root, "package.json", errors);
    if (pkg?.scripts?.["check:consistency"] !== "node scripts/check-consistency.mjs") {
      errors.push("package.json: missing check:consistency script");
    }
  } catch (e) {
    errors.push("package.json: missing consistency script");
  }

  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateConsistency();
  if (errors.length) {
    console.error("Consistency check failed:\n" + errors.map((e) => " - " + e).join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Consistency check passed: active docs contain no duplicated canonical voice/CTA values; calendar and configuration references are readable.");
  }
}
