export type MotionAsset={
  id:string;kind:"svg";path:string;sha256:string;width:number;height:number;
  transparent:true;stageScale:number;safeBounds:{x:number;y:number;width:number;height:number};
  subject:string;description:string;locales:string[];palette:string;
  provenance:{kind:"first-party-original";author:string;createdOn:string;license:"project-owned-original";sourceReference:string};
  status:"review-only"|"production-approved";
};
export type MotionAssetManifest={schemaVersion:1;assetRoot:string;assets:MotionAsset[]};
export function validateMotionAssetManifest(value?:MotionAssetManifest):MotionAssetManifest;
export function getMotionAsset(id:string):MotionAsset;
export function assertMotionAssetsProductionApproved(episode:{languageCode?:string;scenes?:{motionBeats?:{kind?:string;visual?:{assetId?:string}}[]}[]}):void;
