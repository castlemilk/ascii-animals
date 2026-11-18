import type { PufferfishConfig, PufferfishEvent, PufferfishOptions, PufferfishState, PufferfishStepResult, PufferfishTick } from './types.js';
export declare const PUFFERFISH_LIMITS: Readonly<{
    tickRate: 60;
    maxTick: 2147483647;
    maxSamples: 16000;
    eventsPerTick: 16;
    maxCatchUp: 5;
    spines: 42;
}>;
export declare const PUFFERFISH_DEFAULTS: PufferfishConfig;
export declare function finite(value: unknown, low: number, high: number, name: string): number;
export declare function integer(value: unknown, low: number, high: number, name: string): number;
export declare function record(value: unknown, allowed: readonly string[], name: string): asserts value is Record<string, unknown>;
/** Reject, never coerce or partially apply, invalid config. Units are ticks / normalized distance. */
export declare function resolvePufferfishOptions(options?: PufferfishOptions): PufferfishConfig;
export declare function createPufferfish(options?: PufferfishOptions): PufferfishState;
/** Configuration is a new deterministic run. The browser controller preserves its pause policy. */
export declare function configurePufferfish(state: PufferfishState, patch: PufferfishOptions): PufferfishState;
export declare function resetPufferfish(state: PufferfishState, seed?: number): PufferfishState;
/** Pure one-tick update. The complete batch validates before any new state is produced. */
export declare function stepPufferfish(state: PufferfishState, input: PufferfishTick): PufferfishStepResult;
/** A deliberate static alternative, not an advancement of the running simulation. */
export declare function pufferfishPoster(state: PufferfishState, inflated: boolean): PufferfishState;
export declare function describePufferfish(state: PufferfishState): string;
export declare const PUFFERFISH_REPLAY: readonly PufferfishEvent[];
