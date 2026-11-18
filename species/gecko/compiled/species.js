/** TypeScript-first species facade; shared package export/integration pending. */
import { createGecko, DEFAULT_GECKO_OPTIONS, GECKO_LIMITS } from './gecko.js';
import { getGeckoAnatomy, sampleGecko } from './geometry.js';
export const geckoSpecies = Object.freeze({
    id: 'gecko', version: 1, maxSamples: GECKO_LIMITS.samples,
    defaults: DEFAULT_GECKO_OPTIONS, create: createGecko,
    sample: sampleGecko, anatomy: getGeckoAnatomy,
});
