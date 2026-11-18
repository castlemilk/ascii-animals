/** Species-local proposal v1. None of these names is a merged package export. */
export type FoxFacing = 'left' | 'right';
export type FoxStaticPose = 'idle' | 'sniff' | 'crouch';
export type FoxLegId = 'far-hind' | 'far-front' | 'near-hind' | 'near-front';
export type FoxMaterial = 'fur' | 'cream' | 'shadow' | 'ink';
export interface FoxOptions {
  readonly facing: FoxFacing;
  readonly scale: number;
  readonly breathing: number;
  readonly tailSway: number;
  readonly stalkSpeed: number;
  readonly sniffDepth: number;
  readonly pounceDistance: number;
  readonly pounceHeight: number;
  readonly crouchTicks: number;
  readonly airTicks: number;
  readonly landingTicks: number;
  readonly recoveryTicks: number;
  readonly cooldownTicks: number;
}
export type FoxOptionsInput = Partial<FoxOptions>;
export interface FoxCreateOptions extends FoxOptionsInput {
  readonly seed?: number;
  readonly paused?: boolean;
}
export interface FoxPoint { readonly x: number; readonly y: number }
export interface FoxTarget extends FoxPoint { readonly active: boolean }
export type FoxInput = { readonly tick: number; readonly seq: number } & (
  | { readonly type: 'guide'; readonly x: number; readonly y: number }
  | { readonly type: 'leave' }
  | { readonly type: 'pounce' }
);
export interface FoxFoot extends FoxPoint {
  readonly id: FoxLegId;
  readonly mode: 'planted' | 'swing';
  readonly progress: number;
  readonly fromX: number;
  readonly toX: number;
}
export interface FoxPouncePlan {
  readonly fromX: number;
  readonly toX: number;
  /** Settings are captured at trigger time so an update cannot move a leap's goal. */
  readonly options: FoxOptions;
}
export type FoxBehavior =
  | { readonly kind: 'idle' }
  | { readonly kind: 'stalk' }
  | { readonly kind: 'sniff' }
  | { readonly kind: 'crouch'; readonly age: number; readonly plan: FoxPouncePlan }
  | { readonly kind: 'airborne'; readonly age: number; readonly plan: FoxPouncePlan }
  | { readonly kind: 'landing'; readonly age: number; readonly plan: FoxPouncePlan }
  | { readonly kind: 'recover'; readonly age: number; readonly plan: FoxPouncePlan }
  | { readonly kind: 'cooldown'; readonly remaining: number; readonly plan: FoxPouncePlan };
export interface FoxState {
  readonly schemaVersion: 1;
  readonly speciesVersion: 1;
  readonly species: 'fox';
  readonly tick: number;
  readonly lastSequence: number;
  readonly seed: number;
  readonly rootX: number;
  readonly velocityX: number;
  readonly gait: number;
  readonly breathPhase: number;
  readonly tailPhase: number;
  readonly target: FoxTarget;
  readonly feet: readonly FoxFoot[];
  readonly behavior: FoxBehavior;
}
export type FoxStepResult =
  | { readonly kind: 'advanced'; readonly state: FoxState; readonly eventsAccepted: number;
      readonly pounce: 'none' | 'started' | 'ignored-busy' }
  | { readonly kind: 'paused'; readonly state: FoxState; readonly eventsAccepted: 0; readonly pounce: 'none' };
export interface FoxPolygon {
  readonly id: string;
  readonly material: FoxMaterial;
  readonly depth: number;
  readonly points: readonly FoxPoint[];
}
export interface FoxLeg {
  readonly id: FoxLegId;
  readonly joints: readonly FoxPoint[];
  readonly planted: boolean;
}
export interface FoxPose {
  readonly species: 'fox';
  readonly tick: number;
  readonly phase: FoxBehavior['kind'];
  readonly root: FoxPoint;
  readonly polygons: readonly FoxPolygon[];
  readonly legs: readonly FoxLeg[];
  readonly landmarks: Readonly<Record<'muzzle' | 'earNear' | 'earFar' | 'tailRoot' | 'tailTip', FoxPoint>>;
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number };
}
export interface FoxModel {
  getOptions(): FoxOptions;
  getState(): FoxState;
  getPose(): FoxPose;
  configure(patch: FoxOptionsInput): FoxOptions;
  step(tick: number, inputs?: readonly FoxInput[]): FoxStepResult;
  setPaused(paused: boolean): void;
  isPaused(): boolean;
  reset(seed?: number): FoxState;
  dispose(): void;
}
export interface FoxSpecies {
  readonly id: 'fox';
  readonly version: 1;
  readonly maxPolygons: 48;
  readonly maxVertices: 1024;
  create(options?: FoxCreateOptions): FoxModel;
}
/** Structurally compatible with PR #2 Scheduler.subscribe at e7c16104… . */
export interface FoxFrameSource {
  subscribe(callback: (timestampMs: number) => void): () => void;
}
export interface FoxGrid {
  readonly cols: number;
  readonly rows: number;
  readonly glyphs: Uint8Array;
  readonly materials: Uint8Array;
  readonly text: string;
  readonly occupied: number;
}
export interface FoxGridOptions { readonly cols?: number; readonly rows?: number; readonly monochrome?: boolean }
