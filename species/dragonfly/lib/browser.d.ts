import type { DragonflyBehavior, DragonflyState, DragonflyConfigPatch, DragonflyOptions, DragonflyView, MotionMode, Vec2 } from './types.js';
export interface DragonflyBrowserEnvironment {
    readonly window: Window;
    readonly document: Document;
    readonly ResizeObserver: typeof ResizeObserver;
    readonly IntersectionObserver: typeof IntersectionObserver | null;
}
export interface DragonflyBrowserStatus {
    readonly tick: number;
    readonly behavior: DragonflyBehavior['kind'];
    readonly paused: boolean;
    readonly motion: MotionMode;
    readonly requestedMotion: MotionMode;
    readonly reducedMotion: boolean;
    readonly hidden: boolean;
    readonly offscreen: boolean;
    readonly zeroSized: boolean;
    readonly disposed: boolean;
    readonly queuedFrames: number;
    readonly pendingInputs: number;
    readonly droppedMilliseconds: number;
    readonly renderedFrames: number;
    readonly cols: number;
    readonly rows: number;
    readonly width: number;
    readonly height: number;
    readonly dpr: number;
    readonly samples: number;
    readonly occupied: number;
    readonly clippedSamples: number;
}
export interface DragonflyFrameSource {
    subscribe(callback: (timestampMs: number) => void): () => void;
}
export interface DragonflyMountOptions {
    /** Borrowed scheduler: release only this subscription. */
    readonly frameSource?: DragonflyFrameSource;
    readonly model?: Partial<DragonflyOptions>;
    readonly paused?: boolean;
    readonly view?: DragonflyView;
    readonly neutral?: boolean;
    readonly onStatus?: (status: DragonflyBrowserStatus) => void;
    readonly environment?: DragonflyBrowserEnvironment;
}
export interface DragonflyBrowserController {
    setPaused(value: boolean): void;
    configure(patch: DragonflyConfigPatch): void;
    setView(view: DragonflyView): void;
    setNeutral(value: boolean): void;
    setTarget(x: number, y: number): void;
    clearTarget(): void;
    dart(): void;
    reset(seed?: number): void;
    render(): void;
    exportText(): string;
    /** Immutable species snapshot; cannot bypass host scheduling ownership. */
    getState(): DragonflyState;
    /** Effective species options, including the live reduced-motion policy. */
    getOptions(): Readonly<DragonflyOptions>;
    getStatus(): DragonflyBrowserStatus;
    dispose(): void;
}
export declare function normalizeDragonflyPointer(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): Vec2 | null;
/** Construct only in a browser. Importing this module does not read DOM globals. */
export declare function mountDragonfly(canvas: HTMLCanvasElement, options?: DragonflyMountOptions): DragonflyBrowserController;
