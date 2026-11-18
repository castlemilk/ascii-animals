import type { FoxGridOptions, FoxPoint } from './types.js';
import type { FoxDirectorFrame, FoxSceneGrid } from './director-types.js';
/** Glyph buffers contain printable ASCII character codes, with 0 for empty cells. */
export declare function buildFoxSceneGrid(frame: FoxDirectorFrame, options?: FoxGridOptions): FoxSceneGrid;
export declare function paintFoxSceneGrid(context: CanvasRenderingContext2D, grid: FoxSceneGrid, width: number, height: number, options?: {
    readonly monochrome?: boolean;
}): void;
/** Coordinates within the painted cell rectangle, not the surrounding letterbox. */
export declare function hitFoxScene(grid: FoxSceneGrid, x: number, y: number): number | null;
/** Map a painted-cell point back into the selected actor's logical director space.
 * Visible ownership wins for clicks; empty space selects the nearest presented fox.
 * A preferred ID keeps hover attention on the deliberate selection. No pose is rebuilt.
 */
export declare function routeFoxScenePointer(grid: FoxSceneGrid, x: number, y: number, preferredId?: number): {
    readonly id: number;
    readonly point: FoxPoint;
} | null;
