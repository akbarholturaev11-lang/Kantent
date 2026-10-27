import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scope = new AsyncLocalStorage();
export function readLanguages(rootDir = root) {
  const config = JSON.parse(fs.readFileSync(path.join(rootDir, "content/languages.json"), "utf8"));
  if (config.schemaVersion !== 1 || !Array.isArray(config.defaultProductionLanguages) ||
      !config.defaultProductionLanguages.length || new Set(config.defaultProductionLanguages).size !== config.defaultProductionLanguages.length)
    throw new Error("Invalid content/languages.json production languages.");
  for (const language of config.defaultProductionLanguages) {
    if (!["ru", "tg"].includes(language) || !config.languages[language]) throw new Error("Unsupported production language: " + language);
  }
  return config;
}

export function requireLanguage(language) {
  if (!["ru", "tg"].includes(language)) throw new Error("Language must be ru or tg; no language fallback is allowed.");
  return language;
}
export function activeLanguage() {
  return requireLanguage(scope.getStore() ?? process.env.HSK_CONTENT_LANGUAGE ?? "ru");
}
export function withLanguage(language, work) {
  return scope.run(requireLanguage(language), work);
}
export function languageSettings(language = activeLanguage()) {
  const selected = readLanguages().languages[requireLanguage(language)];
  const contentRoot = path.resolve(root, selected.contentRoot);
  if (contentRoot !== path.join(root, "content") && !contentRoot.startsWith(path.join(root, "content/locales") + path.sep))
    throw new Error("Language contentRoot must stay inside content/.");
  return { ...selected, language, contentRoot,
    voiceProfilePath: path.join(contentRoot, "voice-profile.json"),
    ctaLabPath: path.join(contentRoot, "cta-lab.json"),
    hookLabPath: path.join(contentRoot, "hook-lab.json"),
  };
}
export function languageEnvironment(language = activeLanguage()) {
  return { ...process.env, HSK_CONTENT_LANGUAGE: requireLanguage(language) };
}
export function generatedVoicePath(id, language = activeLanguage()) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id ?? "")) throw new Error("Invalid episode ID.");
  return requireLanguage(language) === "ru" ? `generated/${id}` : `generated/${language}/${id}`;
}
export function lessonSourceHash(episode) {
  return createHash("sha256").update(JSON.stringify(episode)).digest("hex");
}
export function ctaSourceHash(lab) {
  return lessonSourceHash({ offer: lab.offer, policy: lab.policy, platformVariants: lab.platformVariants,
    sourcePolicy: lab.sourcePolicy, activeRules: (lab.corrections ?? []).map(({id,rule,supersedes,scope}) => ({id,rule,supersedes,scope})) });
}
export function assertEpisodeLanguage(episode, language = activeLanguage()) {
  const wanted = languageSettings(language).languageCode;
  if ((episode.languageCode ?? "ru-RU") !== wanted) throw new Error(`Episode language ${episode.languageCode ?? "missing"} does not match ${wanted}. Refused to mix language artifacts.`);
}
export function assertLocalizedLessonSource(episode, canonical, language = activeLanguage()) {
  requireLanguage(language);
  if (language === "ru") return;
  assertEpisodeLanguage(episode, language);
  if (episode.localization?.sourceHash !== lessonSourceHash(canonical) ||
      episode.localization?.sourceEpisodeId !== canonical.id || episode.localization?.language !== language ||
      episode.id !== canonical.id || episode.date !== canonical.date)
    throw new Error("LOCALIZATION_REQUIRED: translation is not bound to the current canonical lesson. Review/retranslate before voice or rendering.");
}
