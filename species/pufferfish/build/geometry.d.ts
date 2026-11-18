import type { PufferfishGeometryResult, PufferfishPose, PufferfishSampleOptions, PufferfishSampleSink, PufferfishState } from './types.js';
/** Original, species-local geometry. No renderer, clock, assets, or font reads. */
export declare const PUFFERFISH_MAX_SAMPLES = 16000;
export declare const PUFFERFISH_SPINES = 42;
/** Body pose is applied by the adapter once; geometry stays in local coordinates.
 * Appendage phases run continuously through behavior changes. staticPose freezes
 * all phases at tick zero without changing the chosen inflation amount.
 */
export declare function posePufferfish(state: PufferfishState, staticPose?: boolean): PufferfishPose;
/** A bounded closed ellipsoid, attached fans, raised eyes, a lip and 42 cones.
 * +z faces the observer; y points down. The painter owns camera/view/projection.
 * Every shape is authored parametrically here; no ASCII drawing is embedded.
 */
export declare function samplePufferfish(state: PufferfishState, sink: PufferfishSampleSink, options?: PufferfishSampleOptions): PufferfishGeometryResult;
