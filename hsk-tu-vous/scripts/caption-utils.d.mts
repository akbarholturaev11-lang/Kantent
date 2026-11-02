export type TimedCaption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs?: number | null;
  confidence?: number | null;
};

export type CaptionPage = {
  text: string;
  startMs: number;
  endMs: number;
  styleId: string;
};

export type CaptionGroupingStyle = {
  maxWordsPerPage: number;
  maxCharactersPerPage: number;
  maxPageDurationMs: number;
  maxGapMs: number;
  holdAfterWordMs: number;
  sections?: Array<{ startMs: number; endMs: number; styleId: string }>;
};

export const CAPTION_STYLE_IDS: readonly ["headline", "pill", "highlight"];

export function groupTimedCaptions(
  captions: TimedCaption[],
  style: CaptionGroupingStyle,
): CaptionPage[];

export function buildCaptionSections(
  scenes: Array<Record<string, unknown>>,
  fps?: number,
): Array<{ startMs: number; endMs: number; styleId: string }>;
