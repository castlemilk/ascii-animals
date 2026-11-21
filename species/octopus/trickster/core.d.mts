export const TICK_RATE: 60;
export const SPECIES_VERSION: 'pocket-trickster-1';
export const MAX_EVENTS_PER_TICK: 64;
export type OctopusStage = 'idle' | 'notice' | 'reach' | 'contact' | 'recoil' | 'gather' | 'hide' | 'peek' | 'settle';
export type OctopusEvent = { type: 'invite' | 'move' | 'release' | 'startle'; x?: number; y?: number };
export interface OctopusBody { x: number; y: number; scaleX: number; scaleY: number; tilt: number; }
export interface OctopusArm { points: [number, number][]; radius: number; tip: [number, number]; layer: number; }
export interface OctopusPose {
  version: typeof SPECIES_VERSION; seed: number; tick: number; stage: OctopusStage;
  body: OctopusBody; gaze: { x: number; y: number }; eyes: { left: number; right: number };
  arms: OctopusArm[]; armCount: 8; actionAge: number; anticipated: boolean;
  target: { x: number; y: number; active: boolean };
  contact: { active: boolean; arm: number; x: number; y: number };
  ink: { amount: number; peek: number; side: number; conceal: number;
    center: { x: number; y: number }; peekEye: { x: number; y: number; open: number } };
}
export interface OctopusAction { kind: 'reach' | 'release' | 'ink'; startTick: number; origin: OctopusPose;
  target: { x: number; y: number }; arm?: number; side?: number; }
export interface OctopusState {
  version: typeof SPECIES_VERSION; seed: number; phase: number; tick: number; stage: OctopusStage;
  aim: { x: number; y: number }; target: { x: number; y: number }; cueActive: boolean;
  action: OctopusAction | null; acceptedActions: number; ignoredEvents: number; completedActions: number;
}
export function createOctopusState(seed?: number): OctopusState;
export function stepOctopus(state: OctopusState, events?: OctopusEvent[]): OctopusState;
export function sampleOctopus(state: OctopusState): OctopusPose;
export function resetOctopus(state: OctopusState): OctopusState;
