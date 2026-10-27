import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { activeLanguage, requireLanguage } from "./language-context.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const file=path.join(root,"content","published-posts.json");
const ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;

/**
 * Immutable-at-read publication snapshots, backed by actual provider post IDs.
 * These snapshots do not prove the rendering template or current link health.
 * Never infer publication from approved, scheduled or local render status.
 */
export function verifiedPublishedRecords(snapshot = JSON.parse(fs.readFileSync(file,"utf8"))) {
  if(snapshot?.schemaVersion!==1 || !Array.isArray(snapshot.records)) throw Error("Invalid published-posts registry");
  const seen=new Set();
  return snapshot.records.map((r)=>{
    if(!ID.test(r.episodeId||"")||!DATE.test(r.calendarDate||"")||
       !["instagram","youtube"].includes(r.platform)||
       !/^[a-zA-Z0-9_-]{10,100}$/.test(r.zernioPostId||"")||
       r.zernioStatus!=="published" ||
       r.evidence!=="Zernio posts_get" ||
       !DATE.test(r.verifiedOn||"") ||
       typeof r.creativeFormatVerified!=="boolean" ||
       !Number.isFinite(Date.parse(r.scheduledFor||"")) ||
       (r.language !== undefined && !["ru", "tg"].includes(r.language))) throw Error("Unverified/invalid Zernio publication record");
    const key=r.platform+":"+r.zernioPostId;
    if(seen.has(key))throw Error("Duplicate published post ID");
    seen.add(key);
    return r;
  });
}

// Existing publication snapshots predate language support and belong to the
// Russian series. Never let one language's post protect another's draft.
const recordLanguage = (record) => requireLanguage(record.language ?? "ru");

export function confirmedPublishedFor(episodeId, records=verifiedPublishedRecords(), language=activeLanguage()){
  requireLanguage(language);
  return records.filter(r=>r.episodeId===episodeId && recordLanguage(r)===language);
}

export function confirmedPublishedIds(records=verifiedPublishedRecords(), language=activeLanguage()){
  requireLanguage(language);
  return new Set(records.filter(r=>recordLanguage(r)===language).map(r=>r.episodeId));
}

/** Only a lesson published in every requested language may be skipped wholly. */
export function confirmedPublishedInAllLanguages(languages, records=verifiedPublishedRecords()){
  if (!Array.isArray(languages) || !languages.length)
    throw new Error("At least one production language is required.");
  const selected=[...new Set(languages.map(requireLanguage))];
  const published=selected.map(language=>confirmedPublishedIds(records,language));
  return new Set([...published[0]].filter(id=>published.every(ids=>ids.has(id))));
}

export function assertNotPreviouslyPublished(episodeId, records=verifiedPublishedRecords(), language=activeLanguage()){
  const found=confirmedPublishedFor(episodeId,records,language);
  if(found.length){
    throw Error(`Episode ${episodeId} (${language}) already has externally VERIFIED published post(s): ${found.map(p=>p.platform+":"+p.zernioPostId).join(", ")}. Do not silently rerender or republish this version. Create a separately dated, uniquely named revision only after explicit owner approval. The original post's creative format is not verified by this record.`);
  }
}
