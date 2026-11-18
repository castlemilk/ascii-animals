export type * from './types.js';
export { PUFFERFISH_DEFAULTS, PUFFERFISH_LIMITS, PUFFERFISH_REPLAY, createPufferfish, resolvePufferfishOptions, configurePufferfish, resetPufferfish, stepPufferfish, pufferfishPoster, describePufferfish } from './model.js';
export { samplePufferfish, posePufferfish } from './geometry.js';
import type { PufferfishDefinition } from './types.js';
/** Local extension proposal. Import this file alone for a DOM-free model, not a package registry. */
export declare const pufferfish: PufferfishDefinition;
