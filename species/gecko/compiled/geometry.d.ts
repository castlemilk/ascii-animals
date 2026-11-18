import type { GeckoAnatomy, GeckoGeometryResult, GeckoSample, GeckoState } from './types.js';
/** Original attached centerline + four two-bone limbs, with world-fixed stance pads. */
export declare function getGeckoAnatomy(state: GeckoState): GeckoAnatomy;
/**
 * Bounded surface samples. This knows no camera, cell grid, Canvas or host clock.
 * Material names are gecko-local; the proposed writer adapter maps them explicitly.
 */
export declare function sampleGecko(state: GeckoState, emit: (sample: GeckoSample) => void): GeckoGeometryResult;
