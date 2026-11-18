import type { OwlGeometry, OwlState, OwlSurface } from './types.js';
/** Original owl-local analytic surfaces. No renderer, clock, randomness or DOM. */
export declare const OWL_SURFACE_LIMIT = 96;
/** Both modest turning views retain the two facial landmarks. Full profile is not modeled. */
export declare function buildOwlGeometry(state: OwlState): OwlGeometry;
/** Owl-specific material shading, sampled in each original surface's local frame. */
export declare function owlSurfaceTone(surface: OwlSurface, u: number, v: number, dome: number, contrast: number): number;
