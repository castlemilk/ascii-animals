import type { FoxOptions, FoxOptionsInput } from './types.js';
export declare const FOX_LIMITS: Readonly<{
    tickRate: 60;
    maxTick: 2147483647;
    eventsPerTick: 16;
    maxPolygons: 48;
    maxVertices: 1024;
    minCols: 80;
    minRows: 32;
    maxCols: 160;
    maxRows: 64;
    rootMin: -0.2;
    rootMax: 0.2;
    groundY: 0.55;
}>;
export declare const FOX_DEFAULTS: FoxOptions;
export declare function finite(value: unknown, name: string): number;
export declare function integer(value: unknown, lo: number, hi: number, name: string): number;
export declare function plain(value: unknown, name: string): asserts value is Record<string, unknown>;
export declare const clamp: (n: number, a: number, b: number) => number;
export declare const smooth: (n: number) => number;
/** Strict, atomic validation. Unknown fields and explicit undefined are errors. */
export declare function resolveFoxOptions(patch?: FoxOptionsInput, base?: FoxOptions): FoxOptions;
