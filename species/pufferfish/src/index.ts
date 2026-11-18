export type * from './types.js';
export type * from './director-types.js';
export { PUFFERFISH_DIRECTOR_DEFAULTS, PUFFERFISH_DIRECTOR_LIMITS, resolvePufferfishDirectorOptions,
  createPufferfishDirector, configurePufferfishDirector, resetPufferfishDirector,
  selectPufferfishActor, stepPufferfishDirector, pufferfishDirectorPoster,
  describePufferfishDirector } from './director.js';
export { PUFFERFISH_DEFAULTS, PUFFERFISH_LIMITS, PUFFERFISH_REPLAY, createPufferfish,
  resolvePufferfishOptions, configurePufferfish, resetPufferfish, stepPufferfish,
  pufferfishPoster, describePufferfish } from './model.js';
export { samplePufferfish, posePufferfish } from './geometry.js';
import type { PufferfishDefinition } from './types.js';
import { createPufferfish, stepPufferfish, describePufferfish } from './model.js';
import { samplePufferfish } from './geometry.js';
/** Integrated species model. Importing this module is DOM-free and starts no browser work. */
export const pufferfish: PufferfishDefinition = Object.freeze({ id: 'pufferfish-v1', maxSamples: 16000,
  create: createPufferfish, step: stepPufferfish, sample: samplePufferfish, describe: describePufferfish });
