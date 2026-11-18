import type { FoxCreateOptions, FoxGrid, FoxOptions, FoxOptionsInput, FoxPoint, FoxPose, FoxState } from './types.js';

export type FoxScene = 'dusk-hunt' | 'moon-play' | 'den-watch';
export type FoxRole = 'auto' | 'hunter' | 'playmate' | 'lookout' | 'dreamer';
export type FoxMotive = Exclude<FoxRole, 'auto'>;
export type FoxCue = 'rustle' | 'pounce' | 'play' | 'rest';
export type FoxTableau = 'listen' | 'pounce' | 'rest';
export type FoxBeat = 'arrival' | 'listening' | 'investigation' | 'response' | 'settling';
export type FoxActorAction = 'arriving' | 'listening' | 'stalking' | 'sniffing' | 'bowing' | 'playing' | 'pouncing' | 'recovering' | 'resting' | 'watching';
export interface FoxDirectorOptions {
  readonly scene: FoxScene;
  readonly count: 1 | 2 | 3;
  readonly pace: number;
  readonly curiosity: number;
  readonly wind: number;
  readonly spacing: number;
  readonly showLabels: boolean;
  readonly roles: readonly FoxRole[];
}
export type FoxDirectorOptionsInput = Partial<FoxDirectorOptions>;
export interface FoxDirectorCreateOptions extends FoxDirectorOptionsInput {
  readonly seed?: number;
  readonly fox?: FoxCreateOptions;
}
/** Bounded local deformation. Legacy pose sampling omits this entirely. */
export interface FoxExpression {
  readonly headPitch: number;
  readonly earNear: number;
  readonly earFar: number;
  readonly tailLift: number;
  readonly rest: number;
  readonly bow: number;
}
export type FoxActorIntent =
  | { readonly kind: 'autonomous' }
  | { readonly kind: 'investigate'; readonly age: number; readonly target: FoxPoint; readonly playful: boolean }
  | { readonly kind: 'rest'; readonly age: number };
export interface FoxDirectorActor {
  readonly id: number;
  readonly name: string;
  readonly role: FoxMotive;
  readonly action: FoxActorAction;
  readonly intent: FoxActorIntent;
  readonly state: FoxState;
  readonly options: FoxOptions;
  readonly expression: FoxExpression;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}
export interface FoxDirectorState {
  readonly schemaVersion: 1;
  readonly directorVersion: 1;
  readonly tick: number;
  readonly seed: number;
  readonly lastSequence: number;
  readonly scene: FoxScene;
  readonly sceneTime: number;
  readonly cycle: number;
  readonly beat: FoxBeat;
  readonly selectedId: number;
  readonly pointer: FoxPoint & { readonly active: boolean; readonly stillTicks: number };
  readonly rustle: (FoxPoint & { readonly age: number; readonly owner: number }) | null;
  readonly actors: readonly FoxDirectorActor[];
}
export type FoxDirectorInput = { readonly tick: number; readonly seq: number } & (
  | { readonly type: 'guide'; readonly x: number; readonly y: number }
  | { readonly type: 'leave' }
  | { readonly type: 'select'; readonly id: number }
  | { readonly type: 'cue'; readonly cue: FoxCue; readonly id?: number; readonly x?: number; readonly y?: number }
);
export interface FoxDirectorFrame {
  readonly state: FoxDirectorState;
  readonly options: FoxDirectorOptions;
  readonly tableau: FoxTableau | null;
  readonly actors: readonly { readonly actor: FoxDirectorActor; readonly pose: FoxPose }[];
}
export interface FoxDirectorStepResult {
  readonly kind: 'advanced' | 'paused';
  readonly state: FoxDirectorState;
  readonly eventsAccepted: number;
  readonly cue: 'none' | 'accepted' | 'ignored-busy';
}
export interface FoxDirector {
  getOptions(): FoxDirectorOptions;
  getFoxOptions(): FoxOptions;
  getState(): FoxDirectorState;
  getFrame(tableau?: FoxTableau): FoxDirectorFrame;
  configure(patch: FoxDirectorOptionsInput): FoxDirectorOptions;
  configureFox(patch: FoxOptionsInput): FoxOptions;
  /** Deliberate selection changes no simulation clock. Record externally for replay. */
  select(id: number): FoxDirectorState;
  step(tick: number, inputs?: readonly FoxDirectorInput[]): FoxDirectorStepResult;
  setPaused(value: boolean): void;
  isPaused(): boolean;
  reset(seed?: number): FoxDirectorState;
  dispose(): void;
}
export interface FoxSceneGrid extends FoxGrid {
  /** -1 is scenery; stable actor IDs are 0..2. */
  readonly owners: Int8Array;
  /** Actual presented transforms, including portrait arrangement and edge fitting. */
  readonly anchors: readonly {
    readonly id: number;
    readonly center: FoxPoint;
    readonly origin: FoxPoint;
    readonly logical: FoxPoint;
    readonly scale: number;
  }[];
}
