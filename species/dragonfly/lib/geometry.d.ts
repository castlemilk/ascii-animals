import type { DragonflyGeometry, DragonflyOptions, DragonflyState } from './types.js';
/** Original parameterized dragonfly anatomy. No view, rasterizer or clock ownership. */
export declare function buildDragonflyGeometry(state: DragonflyState, config: Readonly<DragonflyOptions>): DragonflyGeometry;
