import type { PufferfishOptions } from './types.js';
import type { PufferfishDirectorConfig, PufferfishDirectorOptions, PufferfishDirectorResult, PufferfishDirectorState, PufferfishDirectorTick } from './director-types.js';
export declare const PUFFERFISH_DIRECTOR_LIMITS: Readonly<{
    maxActors: 3;
    eventsPerTick: 16;
    sceneTicks: 1200;
    retreatTicks: 240;
    invitationTicks: 360;
    maxSamples: 16000;
    maxVelocityX: 0.004;
    maxVelocityY: 0.003;
}>;
export declare const PUFFERFISH_DIRECTOR_DEFAULTS: PufferfishDirectorConfig;
/** Every option validates before a new run is allocated. No coercion or silent clamping. */
export declare function resolvePufferfishDirectorOptions(options?: PufferfishDirectorOptions): PufferfishDirectorConfig;
export declare function createPufferfishDirector(options?: PufferfishDirectorOptions, species?: PufferfishOptions): PufferfishDirectorState;
export declare function configurePufferfishDirector(state: PufferfishDirectorState, patch: PufferfishDirectorOptions): PufferfishDirectorState;
export declare function resetPufferfishDirector(state: PufferfishDirectorState, seed?: number): PufferfishDirectorState;
/** Focus changes do not advance the scene clock. Replay consumers can instead use a select event. */
export declare function selectPufferfishActor(state: PufferfishDirectorState, id: number): PufferfishDirectorState;
/** One explicit 60 Hz tick; choreography tempo never accelerates the inflation safety model. */
export declare function stepPufferfishDirector(state: PufferfishDirectorState, input: PufferfishDirectorTick): PufferfishDirectorResult;
/** Deliberate still alternative: one selected defensive fish, or a settled whole reef. */
export declare function pufferfishDirectorPoster(state: PufferfishDirectorState, inflated: boolean): PufferfishDirectorState;
export declare function describePufferfishDirector(state: PufferfishDirectorState): string;
