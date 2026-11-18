import type { Dragonfly, DragonflyOptions, DragonflyReplay } from './types.js';
export declare const DRAGONFLY_LIMITS: Readonly<{
    tickRate: 60;
    samples: 6144;
    eventsPerTick: 16;
    maxTick: 2147483647;
    maxReplayTicks: 21600;
    replayEvents: 4096;
    rootX: 0.72;
    rootY: 0.58;
}>;
export declare const DRAGONFLY_DEFAULTS: Readonly<DragonflyOptions>;
export declare function finiteNumber(value: unknown, name: string, low: number, high: number, integer?: boolean): number;
export declare function validateDragonflyOptions(patch?: Partial<DragonflyOptions>): Readonly<DragonflyOptions>;
export declare function seedPhase(seed: number): number;
/** Original dragonfly behavior. No browser, camera, font, renderer or wall clock. */
export declare function createDragonfly(input?: Partial<DragonflyOptions>): Dragonfly;
/** Fixed-configuration bounded replay. Configuration/reset/host suspension start a new log. */
export declare function replayDragonfly(record: DragonflyReplay, renderEvery?: number): Dragonfly;
