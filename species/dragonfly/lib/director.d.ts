import type { DragonflyConfigPatch, DragonflyGeometry, DragonflyOptions, DragonflyState, Vec2, Vec3 } from './types.js';
export type DragonflyScene = 'patrol' | 'attention' | 'relay';
export type DragonflyRoute = 'banks' | 'figure-eight' | 'orbit';
export type DragonflyRole = 'patroller' | 'sentinel' | 'skimmer' | 'wanderer';
export type DragonflyCue = 'dart' | 'perch' | 'return';
export interface DragonflyDirectorOptions {
    readonly scene: DragonflyScene;
    readonly count: number;
    readonly route: DragonflyRoute;
    readonly tempo: number;
    readonly spread: number;
    readonly scale: number;
    readonly breeze: number;
    readonly labels: boolean;
    readonly roles: readonly [DragonflyRole, DragonflyRole, DragonflyRole, DragonflyRole];
}
export type DragonflyDirectorInput = {
    readonly tick: number;
    readonly seq: number;
} & ({
    readonly type: 'pointer';
    readonly x: number;
    readonly y: number;
} | {
    readonly type: 'leave';
} | {
    readonly type: 'select';
    readonly id: number;
} | {
    readonly type: 'cue';
    readonly cue: DragonflyCue;
});
export type DragonflyDirectorPhase = {
    readonly kind: 'patrol' | 'attention' | 'hover' | 'launch' | 'dart' | 'settle' | 'return' | 'land' | 'perched' | 'cooldown';
    readonly elapsed: number;
    readonly duration: number;
};
export interface DragonflyDirectorMember {
    readonly id: number;
    readonly label: string;
    readonly seed: number;
    readonly role: DragonflyRole;
    readonly position: Vec3;
    readonly perch: Vec3;
    readonly velocity: Vec2;
    readonly heading: number;
    readonly phase: DragonflyDirectorPhase;
    readonly modelTick: number;
}
export interface DragonflyDirectorState {
    readonly tick: number;
    readonly lastSeq: number;
    readonly scene: DragonflyScene;
    readonly arc: 'arrive' | 'patrol' | 'intercept' | 'return' | 'rest';
    readonly selected: number;
    readonly target: Vec2 | null;
    readonly members: readonly DragonflyDirectorMember[];
}
export interface DragonflyDirectedGeometry {
    readonly id: number;
    readonly label: string;
    readonly role: DragonflyRole;
    readonly selected: boolean;
    readonly phase: DragonflyDirectorPhase;
    readonly position: Vec3;
    readonly perch: Vec3;
    readonly geometry: DragonflyGeometry;
}
export interface DragonflyDirectorStepResult {
    readonly kind: 'advanced' | 'resting';
    readonly state: DragonflyDirectorState;
    readonly acceptedCue: boolean;
    readonly ignoredCues: number;
}
export interface DragonflyDirector {
    getState(): DragonflyDirectorState;
    getOptions(): Readonly<DragonflyDirectorOptions>;
    getPrimaryState(): DragonflyState;
    getModelOptions(): Readonly<DragonflyOptions>;
    step(tick: number, events?: readonly DragonflyDirectorInput[]): DragonflyDirectorStepResult;
    configure(patch: Partial<DragonflyDirectorOptions>): Readonly<DragonflyDirectorOptions>;
    configureModel(patch: DragonflyConfigPatch): Readonly<DragonflyOptions>;
    setPaused(paused: boolean): void;
    selectIndividual(id: number): void;
    setStaticPose(pose: 0 | 1): void;
    clearTarget(): void;
    reset(seed?: number): void;
    sample(): readonly DragonflyDirectedGeometry[];
    dispose(): void;
}
export declare const DRAGONFLY_DIRECTOR_DEFAULTS: Readonly<DragonflyDirectorOptions>;
export declare const DRAGONFLY_DIRECTOR_LIMITS: Readonly<{
    members: 4;
    samples: 24576;
    eventsPerTick: 16;
    maxTick: 2147483647;
    rootX: 1.3;
    rootYMin: -0.65;
    rootYMax: 1.05;
    speed: 0.9;
    dartSpeed: 2.6;
    acceleration: 3.2;
    dartAcceleration: 9;
    tickRate: 60;
}>;
export declare function validateDragonflyDirectorOptions(input?: Partial<DragonflyDirectorOptions>): Readonly<DragonflyDirectorOptions>;
/** One explicit scene clock; no DOM, scheduler, randomness, renderer or wall-clock reads. */
export declare function createDragonflyDirector(input?: Partial<DragonflyDirectorOptions>, modelInput?: Partial<DragonflyOptions>): DragonflyDirector;
/** Species-internal presentation seam. The accepted public director is unchanged.
 * Interpolation regenerates articulated geometry, never stretches sampled wings. */
export declare function createDragonflyDirectorHost(input?: Partial<DragonflyDirectorOptions>, modelInput?: Partial<DragonflyOptions>): {
    readonly director: DragonflyDirector;
    readonly samplePresentation: (alpha: number) => readonly DragonflyDirectedGeometry[];
};
