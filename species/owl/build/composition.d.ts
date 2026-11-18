import type { OwlGrid, OwlGridOptions } from './types.js';
import type { OwlActorId, OwlDirectorState } from './director.js';
export type OwlActorRect = Readonly<{
    id: OwlActorId;
    left: number;
    top: number;
    width: number;
    height: number;
}>;
export type OwlDirectorGrid = OwlGrid & Readonly<{
    layout: 'solo' | 'wide' | 'stacked';
    /** -1 background/empty, otherwise stable actor id; pupil spaces retain ownership. */
    owners: readonly number[];
    actorRects: readonly OwlActorRect[];
}>;
export declare const OWL_SCENE_GLYPHS = " .,:;+=ox%#@-v*()~/\\";
/** Composition of existing Owl grid output, not a second geometry or glyph renderer. */
export declare function renderOwlDirectorGrid(state: OwlDirectorState, options?: OwlGridOptions): OwlDirectorGrid;
/** Visible cell ownership wins; empty clearing points select the nearest composed perch. */
export declare function targetOwlActor(grid: OwlDirectorGrid, x: number, y: number): OwlActorId;
