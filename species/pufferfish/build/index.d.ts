export type * from './types.js';
export type * from './director-types.js';
export { PUFFERFISH_DIRECTOR_DEFAULTS, PUFFERFISH_DIRECTOR_LIMITS, resolvePufferfishDirectorOptions, createPufferfishDirector, configurePufferfishDirector, resetPufferfishDirector, selectPufferfishActor, stepPufferfishDirector, pufferfishDirectorPoster, describePufferfishDirector } from './director.js';
export { PUFFERFISH_DEFAULTS, PUFFERFISH_LIMITS, PUFFERFISH_REPLAY, createPufferfish, resolvePufferfishOptions, configurePufferfish, resetPufferfish, stepPufferfish, pufferfishPoster, describePufferfish } from './model.js';
export { samplePufferfish, posePufferfish } from './geometry.js';
import type { PufferfishDefinition } from './types.js';
/** Integrated species model. Importing this module is DOM-free and starts no browser work. */
export declare const pufferfish: PufferfishDefinition;
