/** Tiny FOX-LOCAL orthographic proof renderer, not the shared npm renderer.
 * Replace this host layer when the central geometry/material contract is accepted.
 */
import type { FoxGrid, FoxGridOptions, FoxPose } from './types.js';
export declare const FOX_GLYPHS = " .:-=+*#%@o";
export declare const FOX_COLORS: readonly string[];
export declare function buildFoxGrid(pose: FoxPose, options?: FoxGridOptions): FoxGrid;
export declare function paintFoxGrid(context: CanvasRenderingContext2D, grid: FoxGrid, width: number, height: number, options?: {
    readonly monochrome?: boolean;
}): void;
