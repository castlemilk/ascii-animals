/** Integrated Pufferfish model types, exported through the public species subpath. */
export type PufferfishView = 'front' | 'left' | 'right';
export type PufferfishQuality = 'small' | 'standard' | 'fine';
export interface PufferfishOptions {
    readonly seed?: number;
    readonly approachRadius?: number;
    readonly retreatRadius?: number;
    readonly dwellTicks?: number;
    readonly bellyTicks?: number;
    readonly spineTicks?: number;
    readonly holdTicks?: number;
    readonly recoveryTicks?: number;
    readonly cooldownTicks?: number;
    readonly inflationScale?: number;
    readonly wobble?: number;
}
export type PufferfishConfig = Readonly<Required<PufferfishOptions>>;
export type PufferfishPhase = Readonly<{
    kind: 'idle';
}> | Readonly<{
    kind: 'approach';
    age: number;
}> | Readonly<{
    kind: 'inflating';
    stage: 'belly' | 'spines';
    age: number;
}> | Readonly<{
    kind: 'holding';
    age: number;
}> | Readonly<{
    kind: 'recovering';
    age: number;
    from: number;
}> | Readonly<{
    kind: 'cooldown';
    remaining: number;
    retreated: boolean;
}>;
export interface PufferfishPointer {
    readonly active: boolean;
    readonly x: number;
    readonly y: number;
    /** CSS width / height, used to make nearby distance isotropic. */
    readonly aspect: number;
}
export type PufferfishInput = Readonly<{
    type: 'pointer';
    x: number;
    y: number;
    aspect: number;
}> | Readonly<{
    type: 'approach';
}> | Readonly<{
    type: 'retreat';
}>;
export type PufferfishEvent = PufferfishInput & Readonly<{
    tick: number;
    seq: number;
}>;
export interface PufferfishState {
    readonly version: 'pufferfish-v1';
    readonly config: PufferfishConfig;
    readonly tick: number;
    readonly lastSequence: number;
    readonly phase: PufferfishPhase;
    readonly pointer: PufferfishPointer;
    readonly inflation: number;
    readonly variation: number;
    readonly reactions: number;
}
export interface PufferfishTick {
    readonly tick: number;
    readonly events?: readonly PufferfishEvent[];
}
export interface PufferfishStepResult {
    readonly state: PufferfishState;
    readonly transition: PufferfishPhase['kind'] | null;
    readonly ignoredApproaches: number;
}
export interface PufferfishPose {
    readonly inflation: number;
    readonly scale: number;
    readonly bob: number;
    readonly roll: number;
    readonly leftFin: number;
    readonly rightFin: number;
    readonly tail: number;
}
export type PufferfishMaterial = 0 | 1 | 2;
export interface PufferfishSample {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly light: number;
    readonly material: PufferfishMaterial;
    readonly seed: number;
    readonly part: 'body' | 'eye' | 'pupil' | 'mouth' | 'fin' | 'tail' | 'spine';
}
export type PufferfishSampleSink = (sample: PufferfishSample) => void;
export interface PufferfishGeometryResult {
    readonly count: number;
    readonly spineCount: number;
    readonly bounds: Readonly<{
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        minZ: number;
        maxZ: number;
    }>;
}
export interface PufferfishSampleOptions {
    readonly quality?: PufferfishQuality;
    readonly monochrome?: boolean;
    readonly staticPose?: boolean;
    /** Local eye attention, each axis -1..1. Omission keeps the original pupils. */
    readonly gaze?: Readonly<{
        x: number;
        y: number;
    }>;
    /** Extra paddle amplitude, 0..1. Zero/omission preserves original fin motion. */
    readonly finEffort?: number;
}
export interface PufferfishDefinition {
    readonly id: 'pufferfish-v1';
    readonly maxSamples: number;
    create(options?: PufferfishOptions): PufferfishState;
    step(state: PufferfishState, input: PufferfishTick): PufferfishStepResult;
    sample(state: PufferfishState, sink: PufferfishSampleSink, options?: PufferfishSampleOptions): PufferfishGeometryResult;
    describe(state: PufferfishState): string;
}
