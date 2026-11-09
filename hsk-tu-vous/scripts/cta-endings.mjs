/**
 * Content-type CTA endings (owner rule 2026-11-09). Each weekly content type
 * has its own goal (content/creative-formats.json#contentGoals), so its video
 * ends differently:
 *   lesson         -> the platform CTA (offer / platformVariants), unchanged;
 *   advertisement  -> brand ending (brand recall);
 *   series-part    -> follow invitation: "next part" before the last part,
 *                     the weekend copy on the last part (audience growth).
 * The approved copy and cue-linked visuals live in each language's
 * cta-lab.json#contentTypeEndings; nothing here invents wording.
 */
export const CTA_ENDING_KINDS = Object.freeze(["advertisement", "series-next-part", "series-final-part"]);

const isText = (value) => typeof value === "string" && value.trim().length > 0;
const FOLLOW = /подпиш|обуна\s+шав/iu;
const DIRECT_RESPONSE = /скача|ссылк|профил|боргир|пайванд/iu;

export function validateCtaEndings(lab) {
  const config = lab?.contentTypeEndings;
  if (config === undefined) return [];
  const errors = [];
  const endings = config?.endings;
  if (!endings || typeof endings !== "object") return ["contentTypeEndings.endings is required"];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.effectiveFromDate ?? "")) errors.push("contentTypeEndings.effectiveFromDate must be YYYY-MM-DD");
  for (const kind of CTA_ENDING_KINDS) {
    const ending = endings[kind];
    const where = `contentTypeEndings.${kind}`;
    if (!ending) { errors.push(`${where} is missing`); continue; }
    if (ending.status !== "approved" || ending.ownerApprovedWording !== true) errors.push(`${where} needs the owner's approved wording`);
    if (!isText(ending.copy) || !/^[a-z][a-z0-9-]{2,63}$/.test(ending.formatId ?? "")) errors.push(`${where} needs copy and formatId`);
    const expectedType = kind === "advertisement" ? "advertisement" : "series-part";
    if (ending.contentType !== expectedType) errors.push(`${where} must apply to ${expectedType}`);
    const template = ending.sceneTemplate;
    if (!template || template.kind !== "cta" || template.id !== "cta" || !Array.isArray(template.visualBeats) ||
        !template.visualBeats.length || !isText(template.headline) || !isText(template.screenCaption) ||
        !isText(template.editPlan) || "narration" in template || "cta" in template || "ctaExperiment" in template)
      errors.push(`${where} needs a cue-linked CTA sceneTemplate without duplicated narration`);
    for (const beat of template?.visualBeats ?? [])
      if (!isText(beat.syncCueText) || !ending.copy?.includes(beat.syncCueText)) errors.push(`${where}: cue "${beat.syncCueText}" is not in the spoken copy`);
    if (kind === "advertisement") {
      if (!/HSK\s+AI/u.test(ending.copy ?? "")) errors.push(`${where} must name HSK AI`);
      if (FOLLOW.test(ending.copy ?? "") || DIRECT_RESPONSE.test(ending.copy ?? "")) errors.push(`${where} is a brand ending: no download, link or follow request`);
    } else {
      if (!FOLLOW.test(ending.copy ?? "")) errors.push(`${where} must invite viewers to follow/subscribe`);
      if (DIRECT_RESPONSE.test(ending.copy ?? "")) errors.push(`${where} is a follow ending: no download or link request`);
    }
    if (kind === "series-next-part" && !Number.isSafeInteger(ending.forNextPart)) errors.push(`${where} must name the part number its copy promises`);
  }
  return errors;
}

export function ctaEndingByKind(lab, kind) {
  const ending = lab?.contentTypeEndings?.endings?.[kind];
  return ending ? { kind, ...ending } : null;
}

/**
 * The ending a content type needs, or null for a lesson (platform CTA).
 * Throws instead of guessing when the approved wording does not fit.
 */
export function ctaEndingFor(lab, { contentType = "lesson", series, date } = {}) {
  if (!contentType || contentType === "lesson") return null;
  // Earlier items keep the CTA they were prepared and registered with.
  const from = lab?.contentTypeEndings?.effectiveFromDate;
  if (date && from && date < from) return null;
  const errors = validateCtaEndings(lab);
  if (!lab?.contentTypeEndings) errors.push("cta-lab.json#contentTypeEndings is missing");
  if (errors.length) throw new Error(`${contentType} CTA ending is not ready: ${errors.join("; ")}`);
  if (contentType === "advertisement") return ctaEndingByKind(lab, "advertisement");
  if (contentType !== "series-part") throw new Error(`Unknown content type "${contentType}" for a CTA ending.`);
  if (!series || !Number.isSafeInteger(series.part) || !Number.isSafeInteger(series.totalParts) || series.part > series.totalParts)
    throw new Error("A serial part needs its calendar series {part,totalParts} to choose its follow CTA.");
  if (series.part === series.totalParts) return ctaEndingByKind(lab, "series-final-part");
  const next = ctaEndingByKind(lab, "series-next-part");
  if (next.forNextPart !== series.part + 1)
    throw new Error(`The approved serial follow CTA promises part ${next.forNextPart}; part ${series.part} of ${series.totalParts} needs its own owner-approved wording.`);
  return next;
}
