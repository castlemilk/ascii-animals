import type { FrogController, FrogMountOptions } from './types.mjs';
/** Browser-only host; imports and the pure models remain safe without DOM globals. */
export declare function mountFrog(canvas: HTMLCanvasElement, options?: FrogMountOptions): FrogController;
