import type { GeckoConfig, GeckoFoot, GeckoHabitat, GeckoInput, GeckoModel, GeckoOptions, GeckoOptionsPatch, GeckoStepResult, Vec2 } from './types.js';
export type * from './types.js';
export declare const GECKO_LIMITS: Readonly<{
    tickRate: 60;
    eventsPerTick: 32;
    samples: 12288;
    maxTick: 2147483646;
    minCols: 112;
    minRows: 50;
    maxCols: 192;
    maxRows: 86;
    rootX: 0.26;
    rootY: 0.13;
    limbReach: 0.44;
}>;
export declare const DEFAULT_GECKO_HABITAT: Readonly<GeckoHabitat>;
export declare const DEFAULT_GECKO_OPTIONS: Readonly<GeckoOptions>;
export declare function resolveGeckoOptions(patch?: GeckoOptionsPatch, base?: Readonly<GeckoOptions>): Readonly<GeckoOptions>;
/** Convert a CSS rectangle to normalized input; DPR never participates. */
export declare function normalizeGuide(clientX: number, clientY: number, rect: {
    left: number;
    top: number;
    width: number;
    height: number;
}): Vec2 | null;
export declare function transformGeckoPoint(position: Vec2, heading: number, x: number, y: number): Vec2;
export declare function geckoShoulder(position: Vec2, heading: number, foot: Pick<GeckoFoot, 'front' | 'side'>): Vec2;
/** Species-internal drive used by the wall director; not part of the package facade. */
export interface GeckoLocomotorDrive {
    /** Additional root movement; <=.025/tick. A lifted foot must land first. */
    readonly rootDelta?: Vec2;
    /** Hold ordinary travel and new steps; an already lifted foot still lands. */
    readonly hold?: boolean;
    /** Hold the root while displaced contacts replant, one foot at a time. */
    readonly settle?: boolean;
}
export interface GeckoLocomotor {
    readonly model: GeckoModel;
    stepDriven(events: GeckoInput, drive: GeckoLocomotorDrive): GeckoStepResult;
}
/** Original deterministic single-gecko model. Rendering and scheduling are host-owned. */
export declare function createGeckoLocomotor(config?: GeckoConfig): GeckoLocomotor;
/** Original public model contract; authored director movement remains internal. */
export declare function createGecko(config?: GeckoConfig): GeckoModel;
