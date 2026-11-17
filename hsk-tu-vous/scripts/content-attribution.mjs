import {createHash} from 'node:crypto';
import {contentTypeOf} from './content-schedule.mjs';
const id=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hash=/^[a-f0-9]{64}$/;
export const sourceHash=source=>createHash('sha256').update(JSON.stringify(source)).digest('hex');
/** Identity is shared across platform exports; each language and revision is explicit. */
export function contentIdentity(item,{language,source}) {
 const result={id:item.id,type:contentTypeOf(item),language,sourceHash:sourceHash(source),
  ...(item.series?{series:{...item.series}}:{})};
 const errors=validateContentIdentity(result);if(errors.length)throw Error(errors.join('; '));
 return result;
}
export function validateContentIdentity(value) {
 const errors=[];
 if(!value||!id.test(value.id??'')||!['lesson','advertisement','series-part'].includes(value.type)||
  !['ru','tg'].includes(value.language)||!hash.test(value.sourceHash??''))errors.push('invalid content identity: ID/type/language/sourceHash required');
 if(value?.type==='series-part') {
  const s=value.series;
  if(!s||!id.test(s.id??'')||!Number.isSafeInteger(s.part)||!Number.isSafeInteger(s.totalParts)||s.totalParts<2||s.part<1||s.part>s.totalParts)
   errors.push('series-part needs series ID, part and totalParts');
 } else if(value?.series!==undefined) errors.push('only series-part can carry series metadata');
 return errors;
}
/** Platforms whose verified Zernio publications are tracked (RU Facebook is posted by hand and has no receipt). */
export const TRACKED_PLATFORMS=['instagram','youtube','tiktok','facebook'];
const postIdPattern=/^[A-Za-z0-9_-]{6,100}$/;
export const normalizeUsername=value=>typeof value==='string'?value.trim().replace(/^@/,''):value;
/**
 * Durable attribution receipt, written only AFTER exact-preview approval and a
 * verified provider result. The Zernio post ID is known at scheduling time; the
 * native platform ID arrives later and stays null until a provider returns it.
 */
export function validatePublicationMapping(mapping) {
 const errors=validateContentIdentity(mapping?.content);
 const zernio=mapping?.zernioPostId, native=mapping?.platformPostId;
 if(!TRACKED_PLATFORMS.includes(mapping?.platform)||!/^[A-Za-z0-9_-]{1,100}$/.test(mapping?.accountId??'')||
  typeof mapping?.accountUsername!=='string'||!mapping.accountUsername.trim()||
  !((zernio!=null&&postIdPattern.test(zernio)&&(native==null||postIdPattern.test(native)))||(zernio==null&&postIdPattern.test(native??'')))||
  !hash.test(mapping?.videoSha256??'')||mapping?.approvedVideoSha256!==mapping?.videoSha256||
  !['scheduled','published','processing'].includes(mapping?.status)||
  !Number.isFinite(Date.parse(mapping?.approvedAt))||!Number.isFinite(Date.parse(mapping?.verifiedAt))||
  Date.parse(mapping.approvedAt)>Date.parse(mapping.verifiedAt)||
  mapping?.source?.provider!=='Zernio'||typeof mapping?.source?.endpoint!=='string'||!mapping.source.endpoint.trim())
  errors.push('publication mapping needs exact approved media, account, verified Zernio post ID/status and provenance');
 return errors;
}
const nativeKey=m=>m.platformPostId?['native',m.platform,normalizeUsername(m.accountUsername),m.platformPostId].join('|'):null;
const zernioKey=m=>m.zernioPostId?['zernio',m.zernioPostId].join('|'):null;
export function applyPublicationMappings(observations,mappings) {
 const byPost=new Map();
 for(const mapping of mappings) {
  const errors=validatePublicationMapping(mapping);if(errors.length)throw Error(errors.join('; '));
  for(const key of [nativeKey(mapping),zernioKey(mapping)].filter(Boolean)) {
   if(byPost.has(key))throw Error('Duplicate publication attribution '+key);
   byPost.set(key,mapping);
  }
 }
 return observations.map(o=>{
  const m=byPost.get(zernioKey(o)??'')??byPost.get(nativeKey(o)??'');
  if(!m)return o;
  if(m.platform!==o.platform)throw Error('Observation platform conflicts with publication mapping');
  if(o.content&&JSON.stringify(o.content)!==JSON.stringify(m.content))throw Error('Observation conflicts with publication mapping');
  if(o.episodeId&&o.episodeId!==m.content.id)throw Error('Episode ID conflicts with publication mapping');
  return {...o,content:m.content,videoSha256:m.videoSha256,...(m.creative?{creative:m.creative}:{})};
 });
}
