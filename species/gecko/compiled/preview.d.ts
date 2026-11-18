import type { GeckoGrid, GeckoPreviewOptions, GeckoState } from './types.js';
export declare const GECKO_GLYPHS = " .:-=+*#%@oO";
export declare const GECKO_VIEW: Readonly<{
    width: 3.4;
    height: 2.6;
}>;
export declare function renderGeckoGrid(state: GeckoState, options?: GeckoPreviewOptions): GeckoGrid;
/** Draw exactly the logical cell identities, with a fixed, letterboxed world aspect. */
export declare function drawGeckoGrid(ctx: CanvasRenderingContext2D, grid: GeckoGrid, width: number, height: number): void;
