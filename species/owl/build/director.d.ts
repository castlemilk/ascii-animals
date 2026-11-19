import type { OwlOptions, OwlOptionsPatch, OwlState } from './types.js';
export type OwlScene = 'lookout' | 'duet' | 'roost';
export type OwlRole = 'sentinel' | 'curious' | 'dreamer';
export type OwlPerchLayout = 'bough' | 'split' | 'close';
export type OwlActorId = 0 | 1;
export type OwlDirectorConfig = Readonly<{
    scene: OwlScene;
    count: 1 | 2;
    layout: OwlPerchLayout;
    tempo: number;
    alertness: number;
    sociability: number;
    breeze: number;
    autonomous: boolean;
    roles: readonly [OwlRole, OwlRole];
}>;
export type OwlDirectorOptions = Partial<OwlDirectorConfig>;
/** x/y use the addressed actor's viewport, normalized -1..1; the DOM host maps scene pointers. */
export type OwlDirectorCue = Readonly<{
    kind: 'rustle' | 'call' | 'stretch' | 'flight';
    target?: OwlActorId;
    x?: number;
    y?: number;
}>;
export type OwlResolvedCue = Readonly<{
    kind: OwlDirectorCue['kind'];
    target: OwlActorId;
    x: number;
    y: number;
}>;
export type OwlDirectorInput = Readonly<{
    tick: number;
    seq: number;
} & ({
    type: 'attention';
    x: number;
    y: number;
    target?: OwlActorId;
} | {
    type: 'leave';
} | {
    type: 'cue';
    cue: OwlDirectorCue;
})>;
export type OwlDirectorPhase = Readonly<{
    kind: 'survey' | 'listen' | 'alert' | 'settle' | 'call' | 'answer' | 'shared-watch' | 'stretch' | 'rest' | 'wake' | 'launch' | 'glide' | 'brake' | 'alight';
    progress: number;
    cycle: number;
}>;
export type OwlDirectorActor = Readonly<{
    id: OwlActorId;
    name: 'Ash' | 'Ember';
    role: OwlRole;
    motive: string;
    simulation: OwlState;
    pose: OwlState;
}>;
export type OwlDirectorState = Readonly<{
    version: 1;
    tick: number;
    lastSequence: number;
    beat: number;
    config: OwlDirectorConfig;
    phase: OwlDirectorPhase;
    actors: readonly OwlDirectorActor[];
    pointer: Readonly<{
        active: boolean;
        x: number;
        y: number;
        target: OwlActorId;
    }>;
    cue: Readonly<OwlResolvedCue & {
        startTick: number;
        duration: number;
        strength: number;
    }> | null;
    cooldownUntil: number;
    poster: boolean;
}>;
export type OwlDirectorStepResult = Readonly<{
    state: OwlDirectorState;
    acceptedCues: number;
    ignoredCues: number;
}>;
export type OwlDirectorPoster = OwlDirectorCue | Readonly<{
    kind: 'attention';
    x: number;
    y: number;
    target?: OwlActorId;
}> | Readonly<{
    kind: 'rest';
}>;
export interface OwlDirectorInstance {
    advance(tick: number, inputs?: readonly OwlDirectorInput[]): OwlDirectorStepResult;
    getState(): OwlDirectorState;
    update(options: OwlDirectorOptions): OwlDirectorConfig;
    updateOwl(options: OwlOptionsPatch): void;
    reset(seed?: number): OwlDirectorState;
    dispose(): void;
    readonly disposed: boolean;
}
export declare const OWL_DIRECTOR_DEFAULTS: OwlDirectorConfig;
export declare const OWL_DIRECTOR_LIMITS: Readonly<{
    actors: 2;
    eventsPerTick: 16;
    tickRate: 60;
    cueCooldownTicks: 60;
    maxCueTicks: 360;
    maxCells: 14400;
}>;
export declare function resolveOwlDirectorOptions(options?: OwlDirectorOptions): OwlDirectorConfig;
export declare function validateOwlDirectorCue(cue: OwlDirectorCue): OwlResolvedCue;
/** Pure scene direction over the integrated Owl models. No renderer, timer or DOM ownership. */
export declare function createOwlDirector(options?: OwlDirectorOptions, owlOptions?: OwlOptions): OwlDirectorInstance;
/** A deliberate scene still. Does not mutate or advance director/core simulation. */
export declare function makeOwlDirectorPoster(state: OwlDirectorState, poster: OwlDirectorPoster): OwlDirectorState;
