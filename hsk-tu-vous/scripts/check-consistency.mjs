import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePlatformCtaConfig } from "./platform-cta.mjs";

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


export function validateSkillRegistry(root = projectRoot) {
  const errors = [];
  const catalog = readJson(root, "content/skill-catalog.json", errors);
  if (!catalog?.skills || !catalog?.recipes) return [...errors, "skill-catalog.json: missing skills or recipes"];
  const directory = asPath(root, ".agents/skills");
  let installed = [];
  try {
    installed = fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (e) {
    return [...errors, "Skill directory unreadable: " + e.message];
  }
  const routes = new Set(["remotion-default", "hyperframes-only", "conditional"]);
  const branchNames = new Set(["lesson", "premium", "special"]);
  const categoryNames = new Set(["engine","layout","effects","captions","audio","brand","promo","teaching","data","editing","export","migration","social"]);
  const skills = catalog.skills;
  const entries = Object.entries(skills);
  for (const name of installed) {
    if (!skills[name]) errors.push("Unregistered installed skill: " + name);
    const filename = path.join(directory, name, "SKILL.md");
    try {
      const body = fs.readFileSync(filename, "utf8");
      const frontmatter = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const skillName = frontmatter?.[1].match(/^name:\s*(.+)\s*$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
      if (skillName !== name) errors.push("Skill has missing/mismatched frontmatter name: " + name);
    } catch (e) { errors.push("SKILL.md not readable for " + name + ": " + e.message); }
  }
  for (const [name, skill] of entries) {
    if (!installed.includes(name)) errors.push("Skill missing installed folder: " + name);
    if (!routes.has(skill.route)) errors.push("Unknown skill route: " + name);
    if (!categoryNames.has(skill.category)) errors.push("Unknown skill category: " + name);
    if (!branchNames.has(skill.branch)) errors.push("Unknown skill branch: " + name);
    if (typeof skill.purpose !== "string" || skill.purpose.length < 12) errors.push("Missing skill purpose: " + name);
  }
  if (skills["remotion-best-practices"]?.route !== "remotion-default" ||
      entries.filter(([,skill]) => skill.route === "remotion-default").length !== 1) {
    errors.push("Remotion must be the only default engine for dated lessons");
  }
  if (skills["hyperframes"]?.route !== "hyperframes-only") errors.push("HyperFrames must remain opt-in");
  const requiredSteps = ["effects","layout","captions","audio","branding","promotion","export"];
  for (const step of requiredSteps) {
    const variants = catalog.recipes[step];
    if (!variants) { errors.push("Missing functional recipe: " + step); continue; }
    for (const branch of branchNames) {
      const recipe = variants[branch];
      if (!recipe || !Object.prototype.hasOwnProperty.call(recipe,"owner")) {
        errors.push("Missing recipe branch: " + step + "/" + branch);
        continue;
      }
      const owner = recipe.owner;
      if (owner !== null && !skills[owner]) errors.push("Unknown recipe owner: " + step + "/" + branch + "/" + owner);
      if (owner !== null && branch === "lesson" && skills[owner]?.route === "hyperframes-only") {
        errors.push("Cannot route a HyperFrames owner to a lesson: " + step);
      }
      if (!Array.isArray(recipe.helpers) && recipe.helpers !== undefined) errors.push("Invalid helpers: " + step + "/" + branch);
      for (const helper of recipe.helpers ?? []) {
        if (!skills[helper]) errors.push("Unknown recipe helper: " + step + "/" + helper);
        if (branch === "lesson" && skills[helper]?.route === "hyperframes-only") errors.push("HyperFrames helper in lesson: " + step + "/" + helper);
      }
      if (typeof recipe.notes !== "string" || recipe.notes.length < 15) errors.push("Missing recipe notes: " + step + "/" + branch);
    }
  }
  // Dedicated social editorial phases are individually owned; they cannot
  // masquerade as Remotion subtitles or alter publication authorization.
  for (const [step, branch] of Object.entries({
    social_hook: "lesson", social_caption: "special", social_research: "special",
  })) {
    const owner = catalog.recipes[step]?.[branch]?.owner;
    if (!owner || skills[owner]?.category !== "social" || skills[owner]?.route !== "conditional") {
      errors.push("Missing/invalid social editorial owner: " + step + "/" + branch);
    }
  }
  return errors;
}

export function validateConsistency(root = projectRoot) {
  const errors = validateSkillRegistry(root);
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
        if (Object.hasOwn(item, "cta")) errors.push(`content/calendar.json: CTA must only be defined in cta-lab.json, not calendar item ${item.id}`);
        ids.add(item.id);
        dates.add(item.date);
        const filename = item.episodeFile;
        if (!filename || path.isAbsolute(filename) || filename.includes("..") || !filename.startsWith("episodes/")) {
          errors.push(`content/calendar.json: invalid episode path for ${item.id}`);
        } else {
          const planned = readJson(root, path.posix.join("content", filename), errors);
          if (planned && cta?.sourcePolicy?.ctaFreeFromDate &&
              item.date >= cta.sourcePolicy.ctaFreeFromDate &&
              (Object.hasOwn(planned, "cta") ||
               Object.hasOwn(planned, "ctaExperiment") ||
               planned.scenes?.some((scene) => scene.kind === "cta"))) {
            errors.push(`content/${filename}: future canonical lesson must be CTA-free; use cta-lab.json`);
          }
        }
      }
    }
  }

  const voiceProviderConfig = voice?.provider === "gemini-api"
    ? Boolean(voice?.ttsModel && voice?.transcriptionModel && voice?.outputFormat)
    : Boolean(voice?.site);
  if (!voice?.voiceName || !voice?.provider || !voice?.locale || !voice?.status || !voiceProviderConfig) {
    errors.push("content/voice-profile.json: missing canonical voice configuration");
  }
  if (!cta?.offer?.canonicalRussian || !cta?.offer?.id) {
    errors.push("content/cta-lab.json: missing canonical offer text/id");
  }
  if (cta) errors.push(...validatePlatformCtaConfig(cta).map((issue) => `content/cta-lab.json: ${issue}`));
  if (!hook?.policy) errors.push("content/hook-lab.json: missing hook policy");
  if (hook?.policy?.planningHorizonWeeks !== undefined || hook?.policy?.planningBufferSource !== "content/calendar.json#planningBuffer") errors.push("content/hook-lab.json: planning horizon must reference the canonical calendar buffer");
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
    console.log("Consistency check passed: canonical settings, calendar and all registered skill routes are consistent.");
  }
}
