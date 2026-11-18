/** Species-local proposal v1. No shared ascii-animals package contract is implied. */
export type OwlConfig = Readonly<{
  schemaVersion: 1;
  seed: number;
  headYawLimitDeg: number;
  headPitchLimitDeg: number;
  attentionSmoothing: number;
  idleAmplitude: number;
  reactionStrength: number;
  featherContrast: number;
  blinkIntervalTicks: number;
  blinkTicks: number;
  ruffleTicks: number;
  stretchTicks: number;
  recoveryTicks: number;
  cooldownTicks: number;
}>;
export type OwlOptions = Partial<OwlConfig>;
/** Seed and schema version can only change through explicit creation/reset. */
export type OwlOptionsPatch = Partial<Omit<OwlConfig, 'schemaVersion' | 'seed'>>;
export type OwlTarget = Readonly<{ x: number; y: number; active: boolean }>;
export type OwlInput = Readonly<{ tick: number; seq: number } & (
  | { type: 'attention'; x: number; y: number }
  | { type: 'leave' }
  | { type: 'react' }
)>;
export type OwlBehavior = Readonly<
  | { kind: 'idle'; sinceTick: number }
  | { kind: 'approach'; sinceTick: number }
  | { kind: 'response'; phase: 'blink' | 'ruffle' | 'stretch'; sinceTick: number; phaseTick: number }
  | { kind: 'recovery'; sinceTick: number; phaseTick: number }
  | { kind: 'cooldown'; sinceTick: number; untilTick: number }
>;
export type OwlCycle = Readonly<Pick<OwlConfig, 'blinkTicks' | 'ruffleTicks' | 'stretchTicks' | 'recoveryTicks' | 'cooldownTicks' | 'reactionStrength'> & { startTick: number }>;
export type OwlState = Readonly<{
  species: 'owl';
  version: 1;
  config: OwlConfig;
  tick: number;
  lastSequence: number;
  phaseOffset: number;
  attention: OwlTarget;
  behavior: OwlBehavior;
  cycle: OwlCycle | null;
  headYawDeg: number;
  headPitchDeg: number;
  /** 0=open, 1=closed. Eyes remain fixed in the head. */
  blink: number;
  /** 0..1 feather envelope and wing extension; not angles. */
  ruffle: number;
  leftWing: number;
  rightWing: number;
  breath: number;
}>;
export type OwlStepResult = Readonly<{ state: OwlState; acceptedReactions: number; ignoredReactions: number }>;
export type OwlPart = 'body' | 'head' | 'face' | 'eye-left' | 'eye-right' | 'pupil-left' | 'pupil-right' | 'beak' | 'wing-left' | 'wing-right' | 'foot-left' | 'foot-right' | 'tail' | 'perch';
export type OwlMaterial = 'feather' | 'disk' | 'eye' | 'pupil' | 'highlight' | 'beak' | 'foot' | 'wood';
/** Analytic 2.5D surface, original owl geometry; y points down, z toward viewer. */
export type OwlSurface = Readonly<{
  shape: 'ellipse' | 'diamond';
  part: OwlPart;
  material: OwlMaterial;
  cx: number; cy: number; z: number;
  rx: number; ry: number; depth: number;
  rotation: number;
  tone: number;
  pattern: number;
}>;
export type OwlLandmarks = Readonly<{
  root: readonly [number, number];
  neck: readonly [number, number];
  shoulderLeft: readonly [number, number];
  shoulderRight: readonly [number, number];
  wingTipLeft: readonly [number, number];
  wingTipRight: readonly [number, number];
  footLeft: readonly [number, number];
  footRight: readonly [number, number];
  eyeLeft: readonly [number, number];
  eyeRight: readonly [number, number];
}>;
export type OwlGeometry = Readonly<{ surfaces: readonly OwlSurface[]; landmarks: OwlLandmarks }>;
export type OwlSample = Readonly<{ x: number; y: number; z: number; tone: number; part: OwlPart; material: OwlMaterial }>;
export type OwlGridOptions = Readonly<{ cols?: number; rows?: number; cellAspect?: number; silhouette?: boolean }>;
export type OwlGrid = Readonly<{ cols: number; rows: number; text: string; occupied: number; parts: readonly (OwlPart | null)[]; samples: readonly (OwlSample | null)[] }>;
export type OwlPoster = Readonly<{ kind: 'rest' | 'react' } | { kind: 'attention'; x: number; y: number }>;
export interface OwlInstance {
  advance(tick: number, inputs?: readonly OwlInput[]): OwlStepResult;
  update(patch: OwlOptionsPatch): OwlConfig;
  reset(seed?: number): OwlState;
  getState(): OwlState;
  getOptions(): OwlConfig;
  sample(): OwlGeometry;
  dispose(): void;
  readonly disposed: boolean;
}
