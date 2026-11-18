/** Deliberately small, Dragonfly-only review surface. Not a shared renderer API. */
import type { DragonflyGeometry, DragonflyGrid, DragonflyPreviewOptions } from './types.js';
export declare const DRAGONFLY_GLYPHS = " .,:;-=+x*oO#@";
export declare const DRAGONFLY_FONT = "ui-monospace, SFMono-Regular, Consolas, \"Liberation Mono\", monospace";
export declare const DRAGONFLY_CELL_ASPECT = 0.68;
/** Samples are in species world units, larger z is in front. No camera/engine reuse is claimed. */
export declare function rasterizeDragonfly(geometry: DragonflyGeometry, options: DragonflyPreviewOptions): DragonflyGrid;
export declare function gridToText(grid: DragonflyGrid): string;
export interface DragonflyPaintOptions {
    readonly width: number;
    readonly height: number;
    readonly dpr: number;
    readonly neutral?: boolean;
}
/** The same cells as text output; centered letterboxing preserves the declared cell aspect. */
export declare function paintDragonfly(context: CanvasRenderingContext2D, grid: DragonflyGrid, options: DragonflyPaintOptions): void;
