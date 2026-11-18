/** Frog-local TypeScript-first entry. No package registry or shared API implied. */
export type * from './types.mjs';
export { createFrog, configureFrog, stepFrog, resetFrog, landingTarget, poseFrog, normalizeFrogPointer, FROG_DEFAULTS, FROG_LIMITS } from './frog.mjs';
export { sampleFrog, frogLandmarks } from './geometry.mjs';
import type { FrogSpecies } from './types.mjs';
export declare const frogSpecies: FrogSpecies;
