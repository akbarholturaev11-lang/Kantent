export type ContentType="lesson"|"advertisement"|"series-part";
export type MotionSelection={sceneId:string;sceneKind:string;componentId:string;source:string;reason:string;verifiedCueRequired:true};
export declare const MOTION_SELECTOR_VERSION: number;
export declare const MOTION_COMPONENTS: ReadonlyArray<{id:string;source:string;formats:ContentType[];sceneKinds:string[];purpose:string}>;
export declare function selectVideoComponents(episode:{
 id:string;scenes:Array<{id:string;kind:string;narration:string}>
},options:{contentType:ContentType;recentSequences?:string[][]}):{
 schemaVersion:number;episodeId:string;contentType:ContentType;status:"advisory-preview-only";
 productionReady:false;cueSource:"not-bound";sequence:string[];
 scenes:MotionSelection[];skippedCtaScenes:string[];needsBeforeProduction:string[];
};
