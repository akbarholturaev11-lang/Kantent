export const MEANING_ICON_KINDS: readonly ["compare","intensity","height","cold","hot","day","count","size","speed","choice","also","all","and",
  "no","skill","can","question","where","number","price","done","pin","have","check","near","far","think","want","heart",
  "on","under","in","beside","clock","book","table","chair","cup","tea","coffee","water","bowl","apple","coin","bag","phone",
  "laptop","house","school","student","board","medic","car","plane","cat","dog","rain","sun","swim","eye","pencil","speech",
  "go","come","cart","sleep","work","ear","music",
  "shirt","shoe","train","bus","bike","shop","ticket","fish","egg","milk","screen","ball","run","gift","flower","tree","umbrella","door","snow","moon","cake","cloud","camera","palette","card","mountain"];
export const MEANING_COMPARISON_COMPONENTS: string[];
export type MeaningLexicon = {
  roles?: Record<string,string>;
  groups?: Record<string,string[]>;
  comparisons?: Record<string,{component:string;unit?:string;more:number;less:number}>;
  icons?: Record<string,string>;
  objects?: Record<string,string>;
  positions?: Record<string,string>;
  numerals?: Record<string,number>;
  measures?: string[];
  questionNumbers?: Record<string,{range:number[]}>;
  modals?: Record<string,string>;
  degrees?: Record<string,number>;
  choices?: Record<string,string>;
  inclusion?: Record<string,string>;
  adverbs?: string[];
  times?: Record<string,string>;
};
export type ComparisonSide = {hanzi:string;pinyin:string|null;cast:string|null;value:number};
export type ComparisonMeaning = {component:"height"|"thermometer"|"bars"|"count";unit:string;relation:"more"|"less"|"equal";marker:string;a:ComparisonSide;b:ComparisonSide;
  adjective:{hanzi:string;pinyin:string|null}};
export type MeaningThing = {hanzi:string;icon:string|null};
export type MeaningSubject = {hanzi:string;cast:string[]};
export type SentenceMeaning =
  | ({pattern:"comparison"} & ComparisonMeaning)
  | {pattern:"location";form:"exists"|"placed"|"place";position:string;positionHanzi:string;container:MeaningThing;item:MeaningThing|null;count:number|null;measure:string|null}
  | {pattern:"choice";kind:"question"|"either"|"pair";marker:string|null;options:MeaningThing[];subject:MeaningSubject|null}
  | {pattern:"modal";modal:"skill"|"can"|"noskill"|"cannot";modalHanzi:string;subject:MeaningSubject|null;time:string|null;action:MeaningThing}
  | {pattern:"inclusion";kind:"also"|"all"|"identity";marker:string;verb:string|null;subject:MeaningSubject;predicate:MeaningThing}
  | {pattern:"degree";degree:number;degreeHanzi:string;adjective:MeaningThing;after:boolean}
  | {pattern:"quantity";price:boolean;question:string|null;count:number|null;measure:string|null;item:MeaningThing|null;range:[number,number]|null;priced:MeaningThing|null;subject:MeaningSubject|null}
  | {pattern:"want";kind:"want"|"like";verbHanzi:string;subject:MeaningSubject;object:MeaningThing}
  | {pattern:"question";word:string;object:MeaningThing|null;subject:MeaningSubject|null}
  | {pattern:"action";subject:MeaningSubject|null;action:MeaningThing;time:string|null;negated:boolean;done:boolean;together:MeaningSubject|null};
export function comparisonMeaning(copy:{hanzi?:string;pinyin?:string}|undefined, lexicon:MeaningLexicon):ComparisonMeaning|null;
export function comparisonRole(meaning:{a?:ComparisonSide;b?:ComparisonSide;adjective?:{hanzi:string};marker?:string}|null, highlight:string|null|undefined):"a"|"b"|"sign"|"adj"|null;
export function meaningIcon(text:string|undefined, lexicon:MeaningLexicon):string|null;
export function objectIn(text:string|undefined, lexicon:MeaningLexicon):MeaningThing|null;
export function slideIcon(text:string|undefined, lexicon:MeaningLexicon):string|null;
export function sentenceMeaning(copy:{hanzi?:string;pinyin?:string}|undefined, lexicon:MeaningLexicon):SentenceMeaning|null;
type Entry = {sceneId:string;beatId:string;template:string;text:string;visual:string|null};
export function meaningCoverage(scenes:{id:string;beats?:{id:string;localFrame?:number;visual?:unknown}[]}[], lexicon:MeaningLexicon):{covered:Entry[];missing:Entry[]};
