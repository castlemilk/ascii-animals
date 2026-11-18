import type { GeckoDirectorOptions, GeckoDirectorOptionsPatch, GeckoDirectorState, GeckoDirectorCue, GeckoIndividualId, GeckoDirectorRecipe } from './director.js';
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
export interface GeckoFrameSource {
    subscribe(callback: (timestampMs: number) => void): () => void;
}
export interface GeckoMountOptions {
    /** Opt-in wall ensemble. Omit to retain the original single-gecko contract. */
    readonly director?: GeckoDirectorOptionsPatch;
    readonly frameSource?: GeckoFrameSource;
    readonly config?: GeckoConfig;
    readonly paused?: boolean;
    readonly view?: Partial<GeckoViewOptions>;
    /** Sparse state/policy changes, never a per-frame live-region feed. */
    readonly onStatus?: (status: GeckoControllerStatus) => void;
}
export interface GeckoControllerStatus {
    readonly director: Readonly<{
        scene: GeckoDirectorOptions['scene'];
        beat: string;
        population: number;
        selectedId: GeckoIndividualId | null;
    }> | null;
    readonly directorPoster: 'none' | GeckoDirectorCue['type'];
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
/** Richer cue receipt without widening the existing solo action contract. */
export type GeckoDirectorActionResult = GeckoActionResult | {
    readonly outcome: 'ignored';
    readonly reason: 'busy';
};
export interface GeckoController {
    getDirectorSnapshot(): GeckoDirectorState | null;
    configureDirector(patch: GeckoDirectorOptionsPatch): Readonly<GeckoDirectorOptions>;
    direct(cue: GeckoDirectorCue): GeckoDirectorActionResult;
    selectGecko(id: GeckoIndividualId | null): void;
    exportScene(): GeckoDirectorRecipe | null;
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
