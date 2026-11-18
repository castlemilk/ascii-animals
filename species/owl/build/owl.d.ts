import type { OwlConfig, OwlInstance, OwlOptions, OwlPoster, OwlState } from './types.js';
export declare const OWL_VERSION: 1;
export declare const OWL_LIMITS: Readonly<{
    tickRate: 60;
    maxTick: 2147483647;
    eventsPerTick: 16;
    maxSurfaces: 96;
}>;
export declare const OWL_DEFAULTS: OwlConfig;
/** Unknown keys and invalid values reject before state changes. No coercion. */
export declare function resolveOwlOptions(options?: OwlOptions): OwlConfig;
/** DOM-free instance with immutable snapshots; no timers, renderer or shared state. */
export declare function createOwl(options?: OwlOptions): OwlInstance;
/** A display-only static pose. It does not advance or mutate an OwlInstance. */
export declare function makeOwlPoster(state: OwlState, poster: OwlPoster): OwlState;
/** CSS-rectangle normalization. Device pixel ratio never participates. */
export declare function normalizeOwlPointer(clientX: number, clientY: number, rect: Readonly<{
    left: number;
    top: number;
    width: number;
    height: number;
}>): {
    x: number;
    y: number;
} | null;
