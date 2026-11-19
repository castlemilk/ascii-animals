import type { DragonflyGeometry, DragonflyOptions, DragonflyState } from './types.js';
/** Species-private articulation. The public model and geometry contracts stay
 * unchanged; a director can lower the feet and pitch the rigid thorax. */
export interface DragonflyArticulation {
    readonly pitch: number;
    readonly grip: number;
}
/** Original parameterized dragonfly anatomy. No view, rasterizer or clock ownership. */
export declare function buildDragonflyGeometry(state: DragonflyState, config: Readonly<DragonflyOptions>, pose?: DragonflyArticulation): DragonflyGeometry;
