/** Frog-only pond choreography. The single-frog/body contract stays separate. */
import type { FrogConfig, FrogConfigPatch, FrogState, Vec2 } from './types.mjs';

export type FrogScene = 'stillwater' | 'firefly-supper' | 'moonlit-chorus';
export type FrogRole = 'caller' | 'hunter' | 'dreamer';
export type FrogPondLayout = 'arc' | 'stepping-stones' | 'shelter';
export type FrogPondScenePhase = 'opening' | 'activity' | 'settling' | 'quiet';
export type FrogPondRoles = readonly [FrogRole, FrogRole, FrogRole];

export interface FrogDirectorConfig {
  readonly scene: FrogScene;
  readonly count: 1 | 2 | 3;
  readonly layout: FrogPondLayout;
  /** Changes cue spacing, never the 60 Hz clock or body leap durations. */
  readonly tempo: number;
  readonly autonomy: boolean;
  /** Stable-ID roles, including currently absent actors. Exactly three entries. */
  readonly roles: FrogPondRoles;
}
export type FrogDirectorOptions = Partial<FrogDirectorConfig>;
export interface FrogPondOptions {
  readonly seed?: number;
  readonly config?: FrogConfigPatch;
  readonly director?: FrogDirectorOptions;
}
export interface FrogPondPad {
  readonly id: number;
  readonly label: string;
  readonly point: Vec2;
}

/** Every motive is bounded. Hop completion follows the existing body model. */
export type FrogPondMotive =
  | Readonly<{ kind: 'rest'; age: number }>
  | Readonly<{ kind: 'listen'; age: number; duration: number; point: Vec2 }>
  | Readonly<{ kind: 'call'; age: number; duration: number; reply: boolean }>
  | Readonly<{ kind: 'track'; age: number; duration: number; point: Vec2; padId: number | null }>
  | Readonly<{ kind: 'hop'; age: number; purpose: 'manual' | 'wander' | 'hunt'; point: Vec2 }>
  | Readonly<{ kind: 'strike'; age: number; duration: number; point: Vec2 }>
  | Readonly<{ kind: 'settle'; age: number; duration: number }>;

export interface FrogPondActor {
  readonly id: number;
  readonly name: 'Moss' | 'Pip' | 'Fern';
  readonly role: FrogRole;
  readonly model: FrogState;
  /** Source occupancy remains until touchdown; reservedPad is the destination. */
  readonly padId: number;
  readonly reservedPad: number | null;
  readonly motive: FrogPondMotive;
}
export interface FrogPondRipple {
  readonly id: number;
  readonly point: Vec2;
  readonly age: number;
  readonly ttl: number;
  readonly kind: 'water' | 'landing' | 'call';
  readonly strength: number;
}
export interface FrogPondFirefly {
  readonly point: Vec2;
  readonly age: number;
  readonly ttl: number;
  readonly phase: 'hover' | 'chased' | 'caught';
  readonly ownerId: number;
}
export interface FrogPondReply {
  readonly frogId: number;
  readonly sourceId: number;
  readonly dueTick: number;
  /** Replies never enqueue their own replies. */
  readonly generation: 1;
}
export interface FrogPondState {
  readonly species: 'frog-pond';
  readonly version: 1;
  readonly seed: number;
  readonly tick: number;
  readonly lastSeq: number;
  readonly config: Readonly<FrogDirectorConfig>;
  readonly bodyConfig: Readonly<FrogConfig>;
  readonly selectedId: number;
  readonly actors: readonly FrogPondActor[];
  readonly pads: readonly FrogPondPad[];
  readonly target: Vec2 | null;
  readonly previewPad: number | null;
  readonly ripples: readonly FrogPondRipple[];
  readonly firefly: FrogPondFirefly | null;
  readonly replies: readonly FrogPondReply[];
  readonly scenePhase: FrogPondScenePhase;
  readonly nextCueTick: number;
  readonly cueCount: number;
  readonly nextEffectId: number;
}
export type FrogPondAction =
  | Readonly<{ type: 'target'; x: number; y: number }>
  | Readonly<{ type: 'leave' }>
  | Readonly<{ type: 'select'; frogId: number }>
  | Readonly<{ type: 'hop'; frogId: number; padId: number }>
  | Readonly<{ type: 'call'; frogId: number }>
  | Readonly<{ type: 'hunt'; frogId: number; x: number; y: number }>
  | Readonly<{ type: 'ripple'; x: number; y: number }>;
export type FrogPondInput = FrogPondAction & Readonly<{ tick: number; seq: number }>;
export interface FrogPondStepResult {
  readonly state: FrogPondState;
  readonly notices: readonly string[];
  readonly ignoredActions: number;
}
