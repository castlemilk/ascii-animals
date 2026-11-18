import type { FoxCreateOptions, FoxModel, FoxPoint, FoxPose, FoxSpecies, FoxStaticPose } from './types.js';
export { FOX_DEFAULTS, FOX_LIMITS, resolveFoxOptions } from './config.js';
export type * from './types.js';
export declare function createFox(init?: FoxCreateOptions): FoxModel;
/** A deliberate still alternative, never an implicit simulation step. */
export declare function staticFoxPose(options?: FoxCreateOptions, pose?: FoxStaticPose): FoxPose;
export declare function normalizeFoxPointer(clientX: number, clientY: number, rect: {
    left: number;
    top: number;
    width: number;
    height: number;
}): FoxPoint | null;
export declare const foxSpecies: FoxSpecies;
