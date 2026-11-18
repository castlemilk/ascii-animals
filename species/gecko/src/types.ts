/** Species-local v1 contracts. No shared ascii-animals API is implied. */
export interface Vec2 { readonly x: number; readonly y: number }
export type FootId = 'front-left' | 'front-right' | 'rear-left' | 'rear-right';

export interface GeckoOptions {
  /** World units/second; [0.02, 0.18]. Default .10. */
  readonly creepSpeed: number;
  /** Radians/second; [.15, 1.2]. Default .65. */
  readonly turnRate: number;
  /** Forward placement allowance; [.04, .16]. Default .10. */
  readonly stride: number;
  /** Integer swing duration; [12, 30]. Default 18 ticks. */
  readonly stepTicks: number;
  /** Tail length multiplier; [.75, 1.05]. Default 1. */
  readonly tailLength: number;
  /** Toe fan multiplier; [.9, 1.15]. Default 1. */
  readonly toeSpread: number;
  /** Curl intensity; [.25, 1]. Default 1. */
  readonly curlStrength: number;
  /** Idle tail angular sway; [0, .08]. Default .035. */
  readonly tailSway: number;
  /** Small body breathing amplitude; [0, .018]. Default .008. */
  readonly breathing: number;
  /** Integer response hold; [6, 60]. Default 18 ticks. */
  readonly startleTicks: number;
  /** Integer backward phase; [24, 90]. Default 48 ticks. */
  readonly retreatTicks: number;
  /** Backward travel target; [.05, .18]. Default .14 world units. */
  readonly retreatDistance: number;
  /** Integer recovery; [60, 240]. Default 120 ticks. */
  readonly recoveryTicks: number;
  /** Integer repeat-trigger block; [30, 300]. Default 120 ticks. */
  readonly cooldownTicks: number;
}
export type GeckoOptionsPatch = Partial<GeckoOptions>;
/** Root travel bounds in world units; feet and the attached tail may extend beyond them. */
export interface GeckoHabitat {
  /** Symmetric horizontal root extent; [.26, 3]. Default .26. */
  readonly extentX: number;
  /** Symmetric vertical root extent; [.13, 2]. Default .13. */
  readonly extentY: number;
  /** Reset position, inside the extents. Both coordinates are required when supplied. */
  readonly origin: Vec2;
}
export interface GeckoConfig {
  readonly seed?: number;
  /** Initial heading, [-PI, PI]; default -.24. Reset-only. */
  readonly heading?: number;
  readonly options?: GeckoOptionsPatch;
  /** Reset-only travel domain. Omitted fields use the single-gecko defaults. */
  readonly habitat?: Partial<GeckoHabitat>;
}
export interface GeckoReset {
  readonly seed?: number;
  readonly heading?: number;
  /** Patch the current resolved habitat; contacts are recreated at its origin. */
  readonly habitat?: Partial<GeckoHabitat>;
}

export type GeckoBehavior =
  | { readonly kind: 'idle'; readonly since: number }
  | { readonly kind: 'approach'; readonly since: number }
  | { readonly kind: 'startle'; readonly since: number; readonly heading: number }
  | { readonly kind: 'retreat'; readonly since: number; readonly heading: number; readonly traveled: number }
  | { readonly kind: 'recover'; readonly since: number }
  | { readonly kind: 'cooldown'; readonly since: number };

export type GeckoFoot = {
  readonly id: FootId;
  readonly side: -1 | 1;
  readonly front: boolean;
  readonly position: Vec2;
  /** World-space toe fan angle; does not rotate during stance. */
  readonly angle: number;
} & (
  | { readonly phase: 'stance'; readonly plantedAt: number }
  | { readonly phase: 'swing'; readonly since: number; readonly duration: number;
      readonly from: Vec2; readonly to: Vec2; readonly fromAngle: number; readonly toAngle: number;
      readonly lift: number }
);

export interface GeckoState {
  readonly version: 1;
  readonly seed: number;
  readonly initialHeading: number;
  readonly options: Readonly<GeckoOptions>;
  readonly habitat: Readonly<GeckoHabitat>;
  readonly tick: number;
  readonly lastSequence: number;
  readonly position: Vec2;
  readonly heading: number;
  readonly target: Vec2 | null;
  readonly behavior: GeckoBehavior;
  readonly tailCurl: number;
  readonly phase: number;
  readonly feet: readonly GeckoFoot[];
  readonly nextFoot: number;
  readonly stepsCompleted: number;
}

export type GeckoEvent = { readonly tick: number; readonly seq: number } & (
  | { readonly type: 'guide'; readonly x: number; readonly y: number }
  | { readonly type: 'leave' }
  | { readonly type: 'startle' }
);
export type GeckoInput = readonly GeckoEvent[];
export type GeckoInputResult =
  | { readonly seq: number; readonly type: GeckoEvent['type']; readonly outcome: 'applied' }
  | { readonly seq: number; readonly type: 'startle'; readonly outcome: 'ignored'; readonly reason: 'busy' };
export interface GeckoStepResult { readonly state: GeckoState; readonly inputs: readonly GeckoInputResult[] }
export interface GeckoModel {
  /** Advance exactly one tick. Reject the entire invalid batch before mutation. */
  step(events?: GeckoInput): GeckoStepResult;
  getSnapshot(): GeckoState;
  /** Atomic update; preserves seed, time, contacts and behavior. */
  update(patch: GeckoOptionsPatch): Readonly<GeckoOptions>;
  /** Reset time and inputs, retaining resolved options and unpatched habitat fields. */
  reset(options?: GeckoReset): GeckoState;
  /** Idempotent; all later methods except disposed/dispose reject. */
  dispose(): void;
  readonly disposed: boolean;
}

export type GeckoMaterial = 'skin' | 'pad' | 'eye' | 'pupil';
export type GeckoPart = 'body' | 'neck' | 'head' | 'tail' | 'limb' | 'digit' | 'pad' | 'eye';
export interface GeckoSample {
  readonly x: number; readonly y: number; readonly z: number;
  readonly tone: number; readonly material: GeckoMaterial; readonly part: GeckoPart;
  readonly stableId: number;
}
export interface GeckoGeometryResult { readonly samples: number; readonly capacity: number }
/** Local discoverable facade, not an accepted shared species/registry interface. */
export interface GeckoSpecies {
  readonly id: 'gecko';
  readonly version: 1;
  readonly maxSamples: number;
  readonly defaults: Readonly<GeckoOptions>;
  create(config?: GeckoConfig): GeckoModel;
  sample(state: GeckoState, emit: (sample: GeckoSample) => void): GeckoGeometryResult;
  anatomy(state: GeckoState): GeckoAnatomy;
}
export interface GeckoTailPoint extends Vec2 { readonly radius: number }
export interface GeckoLimb {
  readonly id: FootId; readonly shoulder: Vec2; readonly elbow: Vec2;
  readonly palm: Vec2; readonly angle: number; readonly lift: number;
  readonly pads: readonly Vec2[];
}
export interface GeckoAnatomy { readonly tail: readonly GeckoTailPoint[]; readonly limbs: readonly GeckoLimb[] }

export interface GeckoPreviewOptions { readonly cols?: number; readonly rows?: number; readonly neutral?: boolean }
export interface GeckoViewport {
  readonly width: number; readonly height: number;
  readonly centerX: number; readonly centerY: number;
}
export interface GeckoGrid {
  readonly cols: number; readonly rows: number;
  readonly text: string; readonly glyphs: Uint8Array;
  readonly tones: Float32Array; readonly materials: Uint8Array;
  readonly occupied: number; readonly samples: number;
  /** Optional scene projection metadata; absent on the original single-gecko grid. */
  readonly viewport?: GeckoViewport;
  readonly theme?: 'moonlight';
}
