/** Deliberately small, Dragonfly-only review surface. Not a shared renderer API. */
import type { DragonflyGeometry, DragonflyGrid, DragonflyPreviewOptions, Vec3 } from './types.js';
export declare const DRAGONFLY_GLYPHS = " .,:;-=+x*oO#@/\\|_~'";
export declare const DRAGONFLY_FONT = "ui-monospace, SFMono-Regular, Consolas, \"Liberation Mono\", monospace";
export declare const DRAGONFLY_CELL_ASPECT = 0.68;
export interface DragonflyProjectedPoint {
    col: number;
    row: number;
    depth: number;
}
/** The same orthographic projection for animal samples and their reed contacts.
 * Pass an output object to reuse it while sampling; no per-point allocation is required. */
export declare function createDragonflyProjector(options: Pick<DragonflyPreviewOptions, 'cols' | 'rows' | 'view'>): (point: Vec3, output?: DragonflyProjectedPoint) => DragonflyProjectedPoint;
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
