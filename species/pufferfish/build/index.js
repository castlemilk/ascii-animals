export { PUFFERFISH_DEFAULTS, PUFFERFISH_LIMITS, PUFFERFISH_REPLAY, createPufferfish, resolvePufferfishOptions, configurePufferfish, resetPufferfish, stepPufferfish, pufferfishPoster, describePufferfish } from './model.js';
export { samplePufferfish, posePufferfish } from './geometry.js';
import { createPufferfish, stepPufferfish, describePufferfish } from './model.js';
import { samplePufferfish } from './geometry.js';
/** Local extension proposal. Import this file alone for a DOM-free model, not a package registry. */
export const pufferfish = Object.freeze({ id: 'pufferfish-v1', maxSamples: 16000,
    create: createPufferfish, step: stepPufferfish, sample: samplePufferfish, describe: describePufferfish });
