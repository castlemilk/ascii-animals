/** Frog-local TypeScript-first entry. No package registry or shared API implied. */
export type * from './types.mjs';
export { createFrog, configureFrog, stepFrog, resetFrog, landingTarget, poseFrog, normalizeFrogPointer, FROG_DEFAULTS, FROG_LIMITS } from './frog.mjs';
export { sampleFrog, frogLandmarks } from './geometry.mjs';
import { createFrog, stepFrog, FROG_DEFAULTS } from './frog.mjs';
import { sampleFrog } from './geometry.mjs';
import type { FrogSpecies } from './types.mjs';
export const frogSpecies: FrogSpecies = Object.freeze({ id: 'frog', version: 1, maxSamples: 32000, defaults: FROG_DEFAULTS, create: createFrog, step: stepFrog, sample: sampleFrog });
