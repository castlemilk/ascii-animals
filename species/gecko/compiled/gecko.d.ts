import type { GeckoConfig, GeckoFoot, GeckoModel, GeckoOptions, GeckoOptionsPatch, Vec2 } from './types.js';
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
/** Original deterministic single-gecko model. Rendering and scheduling are host-owned. */
export declare function createGecko(config?: GeckoConfig): GeckoModel;
