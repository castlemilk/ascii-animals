import type { FoxDirector, FoxDirectorCreateOptions, FoxDirectorOptions, FoxDirectorOptionsInput } from './director-types.js';
export type * from './director-types.js';
export declare const FOX_DIRECTOR_LIMITS: Readonly<{
    maxActors: 3;
    tickRate: 60;
    maxTick: 2147483647;
    eventsPerTick: 16;
    cycleTicks: 1800;
    minCols: 112;
    minRows: 48;
    maxCols: 160;
    maxRows: 64;
    maxAccents: 48;
    maxPolygons: 144;
    maxVertices: 3072;
}>;
export declare const FOX_DIRECTOR_DEFAULTS: FoxDirectorOptions;
export declare function resolveFoxDirectorOptions(patch?: FoxDirectorOptionsInput, base?: FoxDirectorOptions): FoxDirectorOptions;
/** Explicit deterministic director. Its scene clock never changes the animal's 60Hz tick domain. */
export declare function createFoxDirector(init?: FoxDirectorCreateOptions): FoxDirector;
