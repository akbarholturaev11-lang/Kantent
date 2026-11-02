import type {ResolvedMotionBeat,MotionBeat} from "./motion-design-plan.mjs";
import type {DirectedTransition} from "./motion-transition-plan.mjs";
export type DirectedCamera={xPx:number;yPx:number;scale:number};
export type DirectedShot={
  shotId:string;beatId:string;meaningCue:string;cueOccurrence?:number;
  assetIds:string[];persistentElementIds?:string[];
  camera:DirectedCamera;
  transition:DirectedTransition;
  focalRole:"action"|"object"|"comparison"|"phrase";
  zIndex:number;
};
export type MotionDirection={schemaVersion:1;shots:DirectedShot[]};
export type CompiledDirectedShot=Omit<DirectedShot,"cueOccurrence"|"persistentElementIds">&{
  cueOccurrence:number|null;cueStartMs:number;cueEndMs:number;cueFrame:number;
  persistentElementIds:string[];
};
export type MotionDirectorTimeline={schemaVersion:1;sceneId:string;timingSource:"verified-word-cues";shots:CompiledDirectedShot[]};
export function compileMotionDirectorScene(
  scene:{id:string;kind?:string;motionBeats?:MotionBeat[];motionDirection?:MotionDirection},
  resolvedBeats:ResolvedMotionBeat[],
):MotionDirectorTimeline|null;
export function resolveDirectorCamera(timeline:MotionDirectorTimeline|null,frame:number):DirectedCamera;

export function resolvePersistentRootPose(
  previousGraphic:import("./graphic-scene.mjs").GraphicScene,
  currentGraphic:import("./graphic-scene.mjs").GraphicScene,
  rootId:string,fromFrame:number,toFrame:number,transitionFrames:number,fps?:number
):{x:number;y:number;scale:number;rotate:number;opacity:number};
