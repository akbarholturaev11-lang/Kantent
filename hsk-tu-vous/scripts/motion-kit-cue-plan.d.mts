export type ArtMotionId="art-dissolve"|"art-drift";
export type BoundArtMotionScene={
 sceneId:string;componentId:ArtMotionId;
 beats:Array<{beatId:string;startMs:number;localFrame:number}>;
};
export type BoundMotionKitPlan={
 schemaVersion:1;mode:"opt-in-review-only";contentType:"lesson";
 episodeId:string;languageCode:string;fps:number;voiceTextHash:string;audioSha256:string;
 sceneIds:string[];scenes:BoundArtMotionScene[];
};
export declare const MOTION_KIT_CUE_SCHEMA_VERSION:1;
export declare function compileMotionKitCuePlan(
 episode:any, cueTimeline:any,
 options?:{contentType?:"lesson";recentSequences?:string[][]}
):BoundMotionKitPlan;
export declare function assertMotionKitCuePlanMatches(
 episode:any,cueTimeline:any,plan:BoundMotionKitPlan
):true;
