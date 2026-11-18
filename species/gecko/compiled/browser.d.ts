import type { GeckoConfig, GeckoOptions, GeckoOptionsPatch, GeckoReset, GeckoState } from './types.js';
export interface GeckoViewOptions {
    /** Auto selects 112x50 below 560 CSS px, otherwise 176x78. */
    readonly grid: 'auto' | {
        readonly cols: number;
        readonly rows: number;
    };
    readonly neutral: boolean;
    /** [1,2], no cross-device pixel identity is promised. */
    readonly maxDpr: number;
}
export interface GeckoMountOptions {
    readonly config?: GeckoConfig;
    readonly paused?: boolean;
    readonly view?: Partial<GeckoViewOptions>;
    /** Sparse state/policy changes, never a per-frame live-region feed. */
    readonly onStatus?: (status: GeckoControllerStatus) => void;
}
export interface GeckoControllerStatus {
    readonly tick: number;
    readonly phase: GeckoState['behavior']['kind'];
    readonly paused: boolean;
    readonly reducedMotion: boolean;
    readonly hidden: boolean;
    /** Frozen in the back-forward cache, independently of document visibility. */
    readonly pageSuspended: boolean;
    readonly offscreen: boolean;
    readonly zeroSize: boolean;
    readonly tooSmall: boolean;
    readonly disposed: boolean;
    readonly running: boolean;
    readonly poster: 'current' | 'curled';
    readonly pendingInputs: number;
    readonly queuedFrames: number;
    readonly renderedFrames: number;
    readonly droppedMilliseconds: number;
    readonly dimensions: Readonly<{
        width: number;
        height: number;
        dpr: number;
    }>;
}
export type GeckoActionResult = {
    readonly outcome: 'queued';
} | {
    readonly outcome: 'static';
} | {
    readonly outcome: 'ignored';
    readonly reason: 'resting';
};
export interface GeckoController {
    getSnapshot(): GeckoState;
    /** This remains available after disposal. */
    getStatus(): GeckoControllerStatus;
    update(patch: GeckoOptionsPatch): Readonly<GeckoOptions>;
    setView(patch: Partial<GeckoViewOptions>): Readonly<GeckoViewOptions>;
    setPaused(value: boolean): void;
    guide(x: number, y: number): GeckoActionResult;
    clearGuide(): void;
    startle(): GeckoActionResult;
    reset(options?: GeckoReset): void;
    exportText(): string;
    redraw(): void;
    dispose(): void;
}
export declare function mountGecko(canvas: HTMLCanvasElement, options?: GeckoMountOptions): GeckoController;
