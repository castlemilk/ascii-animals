import type { FrogPreview, FrogPreviewOptions, FrogView } from './types.mjs';
export declare const LEGACY_GLYPHS = ".,:;!i1l+txzvcofnae0&%8B@";
export declare const LEGACY_SOURCE_SHA256 = "381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91";
type ResolvedPreview = {
    cols: number;
    rows: number;
    view: FrogView;
    silhouette: boolean;
    labels: boolean;
    trajectories: boolean;
    renderFps: number;
};
export declare function validatePreview(patch?: FrogPreviewOptions, base?: ResolvedPreview): ResolvedPreview;
export declare function createLegacyFrogPreview(canvas: HTMLCanvasElement, options?: FrogPreviewOptions): FrogPreview;
export {};
