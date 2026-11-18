import type { GeckoGrid, GeckoPreviewOptions, GeckoState, GeckoViewport, Vec2 } from './types.js';
export declare const GECKO_GLYPHS = " .:-=+*#%@oO";
export declare const GECKO_VIEW: Readonly<{
    width: 3.4;
    height: 2.6;
}>;
export interface GeckoRasterLayer {
    readonly state: GeckoState;
    readonly scale: number;
    readonly blink?: boolean;
}
export type GeckoCellWriter = (x: number, y: number, glyph: string, tone: number, material: number, depth?: number) => void;
/** The same Gecko sample/depth/glyph seam serves solo and the opt-in wall. */
export declare function rasterizeGeckos(layers: readonly GeckoRasterLayer[], cols: number, rows: number, viewport: GeckoViewport, neutral: boolean, environment?: (put: GeckoCellWriter) => void): GeckoGrid;
export declare function renderGeckoGrid(state: GeckoState, options?: GeckoPreviewOptions): GeckoGrid;
/** Draw exactly the logical cell identities, with a fixed, letterboxed world aspect. */
export declare function drawGeckoGrid(ctx: CanvasRenderingContext2D, grid: GeckoGrid, width: number, height: number): void;
/** Map CSS input through the identical painter letterbox into world space. */
export declare function geckoPointFromCanvas(grid: GeckoGrid, width: number, height: number, clientX: number, clientY: number, rect: {
    left: number;
    top: number;
    width: number;
    height: number;
}): Vec2 | null;
