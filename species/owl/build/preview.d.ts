import type { OwlGrid, OwlGridOptions, OwlState } from './types.js';
/** Only a local review fixture. Not a shared engine, Canvas renderer or npm export. */
export declare const GLYPHS = " .,:;+=ox%#@-v";
export declare const OWL_GRID_LIMITS: Readonly<{
    minCols: 64;
    maxCols: 160;
    minRows: 36;
    maxRows: 90;
    maxCells: 14400;
}>;
/** Grid resolution may vary; framing never follows the owl or zooms during motion. */
export declare function renderOwlGrid(state: OwlState, options?: OwlGridOptions): OwlGrid;
