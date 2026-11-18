/** Original side-profile construction. No image, sprite, ASCII drawing or ray geometry. */
import type { FoxFoot, FoxOptions, FoxPose, FoxState } from './types.js';
export declare function neutralFeet(rootX: number, options: FoxOptions): readonly FoxFoot[];
/** Pure pose sampling; output vertices are world-space normalized x/y, +y down. */
export declare function poseFox(state: FoxState, liveOptions: FoxOptions): FoxPose;
