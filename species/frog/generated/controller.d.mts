import type { FrogController, FrogMountOptions } from './types.mjs';
/** Browser-only host; the imported module itself is safe without DOM globals. */
export declare function mountFrog(canvas: HTMLCanvasElement, options?: FrogMountOptions): FrogController;
