/** Frog-specific TypeScript entry used by the integrated /frog facade. */
export type * from './types.mjs';
export type * from './pond-types.mjs';
export { createFrogPond, stepFrogPond, resetFrogPond, configureFrogDirector, FROG_DIRECTOR_DEFAULTS, FROG_POND_LIMITS, selectPondFrog, setPondRole, previewPondTarget, posePondFrog, pondPointToWorld } from './pond.mjs';
export { createFrog, configureFrog, stepFrog, resetFrog, landingTarget, poseFrog, normalizeFrogPointer, FROG_DEFAULTS, FROG_LIMITS } from './frog.mjs';
export { sampleFrog, frogLandmarks } from './geometry.mjs';
import type { FrogSpecies } from './types.mjs';
export declare const frogSpecies: FrogSpecies;
