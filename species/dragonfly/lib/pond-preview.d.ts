import type { DragonflyPaintOptions } from './preview.js';
import type { DragonflyGrid, DragonflyPreviewOptions } from './types.js';
import type { DragonflyDirectedGeometry } from './director.js';
export interface PondMemberLabel {
    readonly id: number;
    readonly label: string;
    readonly role: string;
    readonly selected: boolean;
    readonly minCol: number;
    readonly maxCol: number;
    readonly minRow: number;
    readonly maxRow: number;
}
export interface DragonflyPondGrid extends DragonflyGrid {
    readonly owners: Int8Array;
    readonly labels: readonly PondMemberLabel[];
    readonly animalCells: number;
    readonly perches: readonly {
        readonly id: number;
        readonly col: number;
        readonly row: number;
    }[];
}
/** Frontmost depth wins; an exact depth tie belongs to the lower stable ID. */
export declare function rasterizeDragonflyPond(members: readonly DragonflyDirectedGeometry[], options: DragonflyPreviewOptions): DragonflyPondGrid;
export interface DragonflyPondPaintOptions extends DragonflyPaintOptions {
    readonly labels: boolean;
}
export interface PlacedPondLabel {
    readonly id: number;
    readonly text: string;
    readonly selected: boolean;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
/** At most four labels, with a bounded set of candidate positions. A label never
 * covers another label or an animal's visible bounding rectangle. */
export declare function layoutDragonflyPondLabels(grid: DragonflyPondGrid, width: number, height: number, measure: (text: string) => number): readonly PlacedPondLabel[];
/** Labels are UI annotations on top of the same merged ASCII surface. */
export declare function paintDragonflyPond(context: CanvasRenderingContext2D, grid: DragonflyPondGrid, options: DragonflyPondPaintOptions): void;
