/** Species-local v1 contracts. These are NOT shared ascii-animals package exports. */
export interface Vec2 { readonly x: number; readonly y: number }
export interface Vec3 extends Vec2 { readonly z: number }
export type MotionMode = 'full' | 'slow' | 'static';
export type DragonflyView = 'dorsal' | 'oblique';

export interface DragonflyConfig {
  readonly motion: MotionMode;
  readonly followPointer: boolean;
  readonly hoverRadius: number;
  readonly trackingReach: number;
  readonly trackingSpeed: number;
  readonly trackingAcceleration: number;
  readonly dartDistance: number;
  readonly dartTicks: number;
  readonly recoveryTicks: number;
  readonly cooldownTicks: number;
  readonly wingHz: number;
  readonly wingAmplitude: number;
}
export interface DragonflyOptions extends DragonflyConfig { readonly seed: number }
export type DragonflyConfigPatch = Partial<DragonflyConfig>;
export type DragonflyBehavior =
  | { readonly kind: 'idle' }
  | { readonly kind: 'approach' }
  | { readonly kind: 'dart'; readonly elapsed: number; readonly duration: number;
      readonly from: Vec2; readonly to: Vec2; readonly initialVelocity: Vec2 }
  | { readonly kind: 'recover'; readonly elapsed: number; readonly duration: number }
  | { readonly kind: 'cooldown'; readonly remaining: number };
export interface DragonflyState {
  readonly species: 'dragonfly-v1';
  readonly seed: number;
  readonly tick: number;
  readonly lastSeq: number;
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly heading: number;
  readonly anchor: Vec2;
  readonly target: Vec2 | null;
  readonly behavior: DragonflyBehavior;
  readonly wingPhase: number;
  readonly staticPose: 0 | 1;
}
export type DragonflyInput = { readonly tick: number; readonly seq: number } & (
  | { readonly type: 'pointer'; readonly x: number; readonly y: number }
  | { readonly type: 'leave' }
  | { readonly type: 'dart'; readonly direction?: Vec2 }
);
export interface DragonflyStepResult {
  readonly kind: 'advanced' | 'resting';
  readonly state: DragonflyState;
  readonly acceptedDart: boolean;
  readonly ignoredDarts: number;
}
export type DragonflyMaterial = 'body' | 'band' | 'wing' | 'vein' | 'eye' | 'leg';
export type WingId = 'left-fore' | 'right-fore' | 'left-hind' | 'right-hind';
export type DragonflyPart = 'thorax' | 'head' | 'left-eye' | 'right-eye' | 'abdomen' | 'legs' | WingId;
export interface DragonflySample extends Vec3 {
  readonly tone: number;
  readonly material: DragonflyMaterial;
  readonly part: DragonflyPart;
  readonly stableIndex: number;
}
export interface WingLandmark { readonly id: WingId; readonly root: Vec3; readonly tip: Vec3; readonly angle: number }
export interface DragonflyGeometry {
  readonly samples: readonly DragonflySample[];
  readonly wings: readonly WingLandmark[];
  readonly eyes: readonly [Vec3, Vec3];
  readonly abdomenTip: Vec3;
}
export interface DragonflyStatus { readonly paused: boolean; readonly disposed: boolean; readonly tick: number; readonly motion: MotionMode }
export interface Dragonfly {
  readonly species: { readonly id: 'dragonfly-v1'; readonly version: 1; readonly maxSamples: 6144; readonly tickRate: 60 };
  getOptions(): Readonly<DragonflyOptions>;
  getState(): DragonflyState;
  getStatus(): DragonflyStatus;
  step(tick: number, events?: readonly DragonflyInput[]): DragonflyStepResult;
  configure(patch: DragonflyConfigPatch): Readonly<DragonflyOptions>;
  setPaused(value: boolean): void;
  reset(seed?: number): DragonflyState;
  /** Explicit single-pose action; never schedules or advances simulation. */
  setStaticPose(pose: 0 | 1): void;
  /** Cancel transient input on host suspension without advancing the clock. */
  clearTarget(): void;
  sample(): DragonflyGeometry;
  dispose(): void;
}
export interface DragonflyReplay {
  readonly schemaVersion: 1;
  readonly speciesVersion: 'dragonfly-v1';
  readonly options: Partial<DragonflyOptions>;
  readonly ticks: number;
  readonly events: readonly DragonflyInput[];
}
export interface DragonflyGrid {
  readonly cols: number; readonly rows: number;
  readonly chars: Uint8Array; readonly depth: Float64Array; readonly materials: Uint8Array;
  readonly occupied: number; readonly clippedSamples: number;
}
export interface DragonflyPreviewOptions { readonly cols: number; readonly rows: number; readonly view: DragonflyView; readonly neutral: boolean }

/** Exact structural shape from PR2 docs/EXTENDING.md, not an accepted export. */
export interface ProposedGeometryWriter {
  readonly capacity: number; readonly count: number;
  write(x: number, y: number, z: number, light: number, material: number, stableSeed: number): boolean;
}
export type GeometryWriteResult =
  | { readonly kind: 'complete'; readonly written: number; readonly required: number }
  | { readonly kind: 'insufficient-capacity'; readonly written: 0; readonly required: number }
  | { readonly kind: 'writer-rejected'; readonly written: number; readonly required: number };
