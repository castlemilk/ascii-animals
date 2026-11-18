import type { FrogGeometryResult, FrogLandmarks, FrogPose, FrogSampleSink, FrogState, GeometryOptions } from './types.mjs';
/** Posed anatomical landmarks use exactly the transforms used for the surfaces. */
export declare function frogLandmarks(state: FrogState, options?: GeometryOptions): FrogLandmarks;
/**
 * Emit all closed volumes and attached limbs. Sample order/IDs are invariant
 * across phases, seeds and views, so changing pose does not introduce random
 * glyph texture. Returned bounds include all emitted geometry.
 */
export declare function sampleFrog(state: FrogState, sink: FrogSampleSink, options?: GeometryOptions): FrogGeometryResult;
/**
 * The same anatomical model accepts an explicit posed root for pond direction.
 * No alternate mesh, sampling topology, or single-frog behavior is introduced.
 */
export declare function sampleFrogPose(pose: FrogPose, sink: FrogSampleSink, options?: GeometryOptions): FrogGeometryResult;
