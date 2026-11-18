/** Species-local proposal v1. These types are not shared ascii-animals exports. */
export type Vec2 = Readonly<{
    x: number;
    y: number;
}>;
export type Vec3 = Readonly<{
    x: number;
    y: number;
    z: number;
}>;
export type FrogView = 'front' | 'left' | 'right' | 'profile';
export type StaticPose = 'rest' | 'crouch' | 'airborne' | 'landed';
export interface FrogConfig {
    readonly size: number;
    readonly jumpHeight: number;
    readonly maxDistance: number;
    readonly crouchTicks: number;
    readonly flightTicks: number;
    readonly landingTicks: number;
    readonly recoveryTicks: number;
    readonly cooldownTicks: number;
    readonly throatAmplitude: number;
}
export type FrogConfigPatch = Partial<FrogConfig>;
export interface FrogOptions {
    readonly seed?: number;
    readonly config?: FrogConfigPatch;
}
export interface LeapPlan {
    readonly from: Vec2;
    readonly to: Vec2;
}
export type FrogBehavior = Readonly<{
    kind: 'idle';
}> | Readonly<{
    kind: 'interest';
}> | Readonly<{
    kind: 'crouch';
    age: number;
    plan: LeapPlan;
}> | Readonly<{
    kind: 'flight';
    age: number;
    plan: LeapPlan;
}> | Readonly<{
    kind: 'landing';
    age: number;
}> | Readonly<{
    kind: 'recovery';
    age: number;
}> | Readonly<{
    kind: 'cooldown';
    age: number;
}>;
export interface FrogState {
    readonly species: 'frog';
    readonly version: 1;
    readonly seed: number;
    readonly config: Readonly<FrogConfig>;
    readonly tick: number;
    readonly lastSeq: number;
    readonly phaseOffset: number;
    readonly position: Vec2;
    readonly target: Vec2 | null;
    readonly behavior: FrogBehavior;
    readonly jumps: number;
}
export type FrogAction = Readonly<{
    type: 'target';
    x: number;
    y: number;
}> | Readonly<{
    type: 'leave';
}> | Readonly<{
    type: 'leap';
}>;
export type FrogInput = FrogAction & Readonly<{
    tick: number;
    seq: number;
}>;
export interface FrogStepResult {
    readonly state: FrogState;
    readonly startedLeap: boolean;
    readonly ignoredLeaps: number;
}
export interface FrogReplay {
    readonly schemaVersion: 1;
    readonly speciesVersion: 1;
    readonly tickRate: 60;
    readonly seed: number;
    readonly config: FrogConfig;
    readonly events: readonly FrogInput[];
}
export interface FrogPose {
    readonly origin: Vec3;
    readonly scale: number;
    /** 0 neutral, 1 compressed. Feet remain planted in grounded poses. */
    readonly compression: number;
    readonly extension: number;
    readonly airborne: boolean;
    readonly throat: number;
    readonly gaze: number;
    readonly phase: number;
}
export interface FrogSample extends Vec3 {
    readonly light: number;
    readonly material: 0 | 1 | 2;
    readonly sampleId: number;
    readonly part: FrogPart;
}
export type FrogPart = 'torso' | 'head' | 'eye-left' | 'eye-right' | 'throat' | 'rear-left' | 'rear-right' | 'fore-left' | 'fore-right' | 'mouth';
export interface LimbLandmarks {
    readonly attachment: Vec3;
    readonly elbow: Vec3;
    readonly ankle: Vec3;
    readonly tip: Vec3;
}
export interface FrogLandmarks {
    readonly torso: Vec3;
    readonly head: Vec3;
    readonly eyeLeft: Vec3;
    readonly eyeRight: Vec3;
    readonly rearLeft: LimbLandmarks;
    readonly rearRight: LimbLandmarks;
    readonly foreLeft: LimbLandmarks;
    readonly foreRight: LimbLandmarks;
}
export interface FrogGeometryResult {
    readonly count: number;
    readonly bounds: Readonly<{
        min: Vec3;
        max: Vec3;
    }>;
    readonly landmarks: FrogLandmarks;
}
export type FrogSampleSink = (point: FrogSample) => void;
export interface GeometryOptions {
    readonly view?: FrogView;
    readonly motion?: boolean;
    readonly staticPose?: StaticPose;
    readonly silhouette?: boolean;
}
export interface FrogSpecies {
    readonly id: 'frog';
    readonly version: 1;
    readonly maxSamples: 32000;
    readonly defaults: Readonly<FrogConfig>;
    create(options?: FrogOptions): FrogState;
    step(state: FrogState, tick: number, inputs?: readonly FrogInput[]): FrogStepResult;
    sample(state: FrogState, sink: FrogSampleSink, options?: GeometryOptions): FrogGeometryResult;
}
export interface FrogPreviewOptions {
    readonly cols?: number;
    readonly rows?: number;
    readonly view?: FrogView;
    readonly silhouette?: boolean;
}
export interface FrogPreviewFrame {
    readonly glyphs: number;
    readonly samples: number;
    readonly cols: number;
    readonly rows: number;
    readonly geometry: FrogGeometryResult;
}
export interface FrogPreview {
    resize(width: number, height: number, dpr: number): void;
    update(options: FrogPreviewOptions): void;
    draw(state: FrogState, options?: GeometryOptions): FrogPreviewFrame;
    toText(): string;
    /** Convert normalized canvas coordinates to normalized ground-plane coordinates. */
    targetAt(point: Vec2): Vec2;
    dispose(): void;
}
export interface FrogMountOptions extends FrogOptions {
    /** Borrowed continuous frame source, unsubscribed when suspended/disposed. */
    readonly frameSource?: {
        subscribe(callback: (timestamp: number) => void): () => void;
    };
    readonly paused?: boolean;
    readonly preview?: FrogPreviewOptions;
    readonly onAction?: (message: string) => void;
    /** Injectable preview for bookkeeping tests; default uses actual legacy seams. */
    readonly previewFactory?: (canvas: HTMLCanvasElement, options: FrogPreviewOptions) => FrogPreview;
}
export interface FrogControllerStatus {
    readonly tick: number;
    readonly phase: FrogBehavior['kind'];
    readonly paused: boolean;
    readonly reducedMotion: boolean;
    readonly hidden: boolean;
    readonly offscreen: boolean;
    readonly zeroSize: boolean;
    readonly undersized: boolean;
    readonly disposed: boolean;
    readonly scheduled: boolean;
    readonly pendingInputs: number;
    readonly coalescedInputs: number;
    readonly droppedMilliseconds: number;
    readonly staticPose: StaticPose;
}
export interface FrogController {
    getState(): FrogState;
    getStatus(): FrogControllerStatus;
    target(point: Vec2): void;
    leap(): void;
    clearTarget(): void;
    setPaused(paused: boolean): void;
    setStaticPose(pose: StaticPose): void;
    /** Atomic validation, then deterministic reset; pause intent is preserved. */
    updateConfig(patch: FrogConfigPatch): void;
    updatePreview(patch: FrogPreviewOptions): void;
    reset(options?: Readonly<{
        seed?: number;
    }>): void;
    exportText(): string;
    dispose(): void;
}
