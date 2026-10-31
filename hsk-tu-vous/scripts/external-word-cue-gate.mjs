import {createHash} from "node:crypto";
const sha=data=>createHash("sha256").update(data).digest("hex");
const hex=/^[0-9a-f]{64}$/;
function ms(value){
 if(typeof value!=="string"||!/^(?:0|[1-9]\d*)(?:\.\d+)?s$/.test(value))
   throw Error("Aligned word offsets must be explicit nonnegative seconds (e.g. 1.250s).");
 return Number(value.slice(0,-1))*1000;
}
/** Validate exact original WAV/text binding and external word-cue structure.
 * This does not independently verify spoken words; caller must run the
 * canonical exact normalized-token alignment gate and require owner review.
 */
export function verifyExternalWordCues({payload,wavBytes,narration,languageCode,durationMs}){
 if(!payload||typeof payload!=="object"||Array.isArray(payload))throw Error("External word cues require a JSON object.");
 if(!Buffer.isBuffer(wavBytes)||wavBytes.length<44||
   wavBytes.subarray(0,4).toString("ascii")!=="RIFF"||
   wavBytes.subarray(8,12).toString("ascii")!=="WAVE")
   throw Error("External cues require the existing RIFF/WAV original audio.");
 if(typeof narration!=="string"||!narration||!["ru-RU","tg-TJ"].includes(languageCode)||
   !Number.isFinite(durationMs)||durationMs<=0)
   throw Error("Original narration, RU/TJ locale, and measured audio duration are required.");
 if(payload.version!==1||payload.languageCode!==languageCode)
   throw Error("External word-cue format version or language does not match the saved voice.");
 if(typeof payload.audioSha256!=="string"||!hex.test(payload.audioSha256)||payload.audioSha256!==sha(wavBytes))
   throw Error("External cues are not bound to the exact saved original WAV SHA-256.");
 if(typeof payload.narrationSha256!=="string"||!hex.test(payload.narrationSha256)||
   payload.narrationSha256!==sha(Buffer.from(narration,"utf8")))
   throw Error("External cues do not match the exact approved narration SHA-256.");
 if(!payload.provenance||!["forced-alignment","provider-word-timestamps"].includes(payload.provenance.method)||
   typeof payload.provenance.model!=="string"||!/^[\w./-]{3,160}$/.test(payload.provenance.model))
   throw Error("External word cues must identify their alignment method and model.");
 if(!Array.isArray(payload.wordAnnotations)||!payload.wordAnnotations.length||payload.wordAnnotations.length>4000)
   throw Error("External word cues must contain a bounded nonempty annotation list.");
 let prevStart=-1,prevEnd=-1;
 for(const [i,item] of payload.wordAnnotations.entries()){
   if(!item||typeof item.text!=="string"||!item.text.trim()||item.text.length>256)
     throw Error(`External word cue ${i+1} has missing or invalid text.`);
   const start=ms(item.startOffset),end=ms(item.endOffset);
   if(!Number.isFinite(start)||!Number.isFinite(end)||end-start<20||
     end>durationMs+100||start<prevStart||start<prevEnd-20)
     throw Error(`External word cue ${i+1} has untrusted, overlapping or zero-length timing.`);
   prevStart=start;prevEnd=end;
 }
 return {wordAnnotations:payload.wordAnnotations.map(({text,startOffset,endOffset})=>({text,startOffset,endOffset})),
   source:{method:payload.provenance.method,model:payload.provenance.model,
     audioSha256:payload.audioSha256,narrationSha256:payload.narrationSha256,
     wordCount:payload.wordAnnotations.length,status:"exact-token-and-owner-listening-review-required"}};
}
