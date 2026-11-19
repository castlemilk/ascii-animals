export interface ReefOptions { current?: number; duration?: number; habitat?: boolean }
export type ReefConfig = Readonly<Required<ReefOptions>>;
export type ReefStill = 'glide' | 'anticipation' | 'bank' | 'recover';
export type ReefStage = ReefStill;
export type ReefSequence = 'current-glide' | 'barrel-bank';
export interface ReefSampleInput {
  time: number;
  seed?: number;
  current?: number;
  pointer?: { x?: number; y?: number; interest?: number };
  reactionAge?: number | null;
  side?: -1 | 1;
  motion?: number;
  aspect?: number;
}
export interface ReefPose {
  position: [number, number, number];
  forward: [number, number, number];
  reference: [number, number, number];
  bank: number; wingEnergy: number; turn: number; lobeOpen: number; dihedral: number;
  time: number; phase: string; stage: ReefStage; sequence: ReefSequence; progress: number;
  current: number; reactionAge: number | null; side: -1 | 1;
}
export const REEF_DEFAULTS: ReefConfig;
export const REEF_STILLS: readonly ReefStill[];
export const REEF_RESPONSE_SECONDS: 8.8;
export function normalizeReefOptions(options?: ReefOptions): ReefConfig;
export function sampleReefPose(input: ReefSampleInput, options?: ReefOptions): ReefPose;
