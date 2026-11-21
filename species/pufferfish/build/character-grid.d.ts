import type { PufferfishState, PufferfishView } from './types.js';
import type { PufferfishDirectorState } from './director-types.js';
export declare const CHARACTER_PALETTE: readonly string[];
/** Shapes use this small vocabulary. Optional actor labels add printable text. */
export declare const CHARACTER_MARKS = " .,:;'_-=~^/\\|()<>oO@!*+";
export interface CharacterGrid {
    readonly cols: number;
    readonly rows: number;
    readonly cells: Uint8Array;
    readonly colors: Uint8Array;
    readonly owners: Int16Array;
    samples: number;
}
export interface CharacterFrameOptions {
    readonly width: number;
    readonly height: number;
    readonly view: PufferfishView;
    readonly staticPose: boolean;
    readonly sceneScale: number;
}
export declare function createCharacterGrid(cols: number, rows: number): CharacterGrid;
/** Drawing is observational. Repeated draw order cannot change a later frame. */
export declare function composePufferfishFrame(grid: CharacterGrid, state: PufferfishState | PufferfishDirectorState, options: CharacterFrameOptions): void;
