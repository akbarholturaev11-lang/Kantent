import { readLanguages, requireLanguage, withLanguage } from "./language-context.mjs";

export function requestedLanguages(language = "all") {
  return language === "all" ? readLanguages().defaultProductionLanguages : [requireLanguage(language)];
}

/** Each language owns its package. A failure never labels the other package complete. */
export async function prepareLanguagePackages(languages, prepare) {
  if (!Array.isArray(languages) || !languages.length || new Set(languages).size !== languages.length)
    throw new Error("Production needs a unique nonempty language list.");
  languages.forEach(requireLanguage);
  const variants = {};
  for (const language of languages) {
    try {
      const result = await withLanguage(language, () => prepare(language));
      variants[language] = { language, ...result };
    } catch (error) {
      variants[language] = { language, stage: "blocked", error: error.message };
    }
  }
  const ready = (value) => value.stage === "ready-for-review" || value.status?.stage === "externally-verified-published";
  const complete = Object.values(variants).every(ready);
  return {
    stage: complete ? "ready-for-review" : Object.values(variants).some(ready) ? "partial" : "blocked",
    complete, requestedLanguages: languages, variants,
    publishing: "manual-review-required; nothing was published",
  };
}
