import type { PufferfishQuality, PufferfishState, PufferfishView } from './types.js';
import type { PufferfishDirectorState } from './director-types.js';
export declare const LEGACY_RENDERER_SHA256 = "381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91";
export declare const LEGACY_GLYPHS = ".,:;!i1l+txzvcofnae0&%8B@";
export interface PufferfishRenderOptions {
    readonly view?: PufferfishView;
    readonly quality?: PufferfishQuality;
    readonly monochrome?: boolean;
    readonly maxDpr?: number;
    readonly mode?: 'ascii' | 'points';
}
export type PufferfishRenderConfig = Readonly<Required<PufferfishRenderOptions>>;
export interface PufferfishRenderResult {
    readonly cols: number;
    readonly rows: number;
    readonly glyphs: number;
    readonly samples: number;
    readonly width: number;
    readonly height: number;
    readonly dpr: number;
    readonly text: string;
    /** Number of selectable actors; procedural reef/current cells are excluded. */
    readonly actorCount: number;
    /** Scene-only narrow-trio geometry multiplier; actor centers stay normalized. */
    readonly sceneScale: number;
}
export interface PufferfishPainter {
    resize(width: number, height: number, dpr: number): boolean;
    configure(patch: PufferfishRenderOptions): void;
    draw(state: PufferfishState, staticPose?: boolean): PufferfishRenderResult;
    drawScene(state: PufferfishDirectorState, staticPose?: boolean): PufferfishRenderResult;
    /** Normalized CSS coordinates, -1..1. Only the visible cell owner is selected. */
    hitActor(x: number, y: number): number | null;
    getConfig(): PufferfishRenderConfig;
    dispose(): void;
}
export interface PufferfishLegacyDependency {
    readonly prototype: object;
}
export declare const PUFFERFISH_RENDER_DEFAULTS: PufferfishRenderConfig;
export declare function resolveRenderOptions(options?: PufferfishRenderOptions): PufferfishRenderConfig;
export declare function createPufferfishPainter(canvas: HTMLCanvasElement, legacy: PufferfishLegacyDependency, options?: PufferfishRenderOptions, makeCanvas?: () => HTMLCanvasElement): PufferfishPainter;
