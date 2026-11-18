import type { OwlGrid, OwlGridOptions, OwlOptions, OwlOptionsPatch, OwlPoster, OwlState } from './types.js';
/** Structural subset of the merged scheduler; the host retains source ownership. */
export interface OwlFrameSource {
    subscribe(callback: (timestampMs: number) => void): () => void;
}
export type OwlSuspension = 'paused' | 'reduced-motion' | 'hidden' | 'offscreen' | 'zero-size' | 'small-container' | 'animation-unavailable' | 'motion-preference-unavailable' | 'disposed';
export type OwlBrowserStatus = Readonly<{
    paused: boolean;
    running: boolean;
    disposed: boolean;
    reducedMotion: boolean;
    blockedBy: readonly OwlSuspension[];
    tick: number;
    behavior: OwlState['behavior'];
    displayedPoster: OwlPoster['kind'] | 'frozen' | null;
    queuedInputs: number;
    droppedMs: number;
    frames: number;
    cols: number;
    rows: number;
    /** Optional observers have window-event fallbacks, not per-frame polling. */
    capabilities: Readonly<{
        resizeObserver: boolean;
        intersectionObserver: boolean;
        motionPreference: boolean;
    }>;
}>;
/** Injection is for hosts/tests; omit in an ordinary browser. Null disables an optional API. */
export type OwlBrowserEnvironment = Readonly<{
    document?: Document;
    requestFrame?: ((callback: FrameRequestCallback) => number) | null;
    cancelFrame?: ((handle: number) => void) | null;
    matchMedia?: ((query: string) => MediaQueryList) | null;
    ResizeObserver?: typeof ResizeObserver | null;
    IntersectionObserver?: typeof IntersectionObserver | null;
}>;
/** Preview typography is fixed to the reviewed 0.55 logical cell aspect. */
export type OwlBrowserGridOptions = Readonly<Omit<OwlGridOptions, 'cellAspect'> & {
    cellAspect?: 0.55;
}>;
export type OwlBrowserOptions = Readonly<{
    owl?: OwlOptions;
    /** Omitted: 64×36 in a narrow host, 96×54 otherwise. Explicit grids are retained. */
    grid?: OwlBrowserGridOptions;
    paused?: boolean;
    frameSource?: OwlFrameSource;
    onStatus?: (status: OwlBrowserStatus) => void;
    environment?: OwlBrowserEnvironment;
}>;
export type OwlActionResult = Readonly<{
    kind: 'queued';
} | {
    kind: 'poster';
    poster: OwlPoster['kind'];
}>;
export type OwlBrowserSnapshot = Readonly<{
    /** The explicit-tick simulation; a static poster never advances or replaces it. */
    simulation: OwlState;
    /** State used for the visible grid; may be a display-only reduced-motion pose. */
    displayed: OwlState;
    grid: OwlGrid;
}>;
export interface OwlBrowserController {
    setPaused(paused: boolean): void;
    react(): OwlActionResult;
    guide(x: number, y: number): OwlActionResult;
    leave(): void;
    reset(seed?: number): void;
    update(patch: OwlOptionsPatch): void;
    setGrid(options: OwlBrowserGridOptions): void;
    getStatus(): OwlBrowserStatus;
    getSnapshot(): OwlBrowserSnapshot;
    exportText(): string;
    dispose(): void;
}
/**
 * Owl-only DOM-text preview. This is a local integration proposal, not a package
 * renderer. It owns its element/listeners/subscription and never a shared clock.
 * Missing matchMedia/RAF yields a useful static preview. Observer fallbacks use
 * window resize/scroll plus measurements on explicit actions.
 */
export declare function mountOwl(host: HTMLElement, options?: OwlBrowserOptions): OwlBrowserController;
