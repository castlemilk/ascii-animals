import type { FoxCue, FoxDirectorInput, FoxDirectorOptions, FoxDirectorOptionsInput, FoxDirectorState, FoxTableau } from './director-types.js';
import type { FoxCreateOptions, FoxFrameSource, FoxGridOptions, FoxInput, FoxOptions, FoxOptionsInput, FoxPoint, FoxState, FoxStaticPose } from './types.js';
export interface FoxBrowserOptions {
    readonly fox?: FoxCreateOptions;
    readonly grid?: FoxGridOptions;
    /** Opt in to a bounded meadow cast. Omit to preserve the original single Fox. */
    readonly director?: FoxDirectorOptionsInput;
    readonly onDirectorInputs?: (batch: readonly FoxDirectorInput[]) => void;
    /** Borrowed: only this mount's subscription is released. */
    readonly frameSource?: FoxFrameSource;
    readonly onStatus?: (status: FoxBrowserStatus) => void;
    /** Complete consumed input batches, including policy-generated leave events. */
    readonly onInputs?: (batch: readonly FoxInput[]) => void;
}
export interface FoxBrowserStatus {
    readonly tick: number;
    readonly phase: FoxState['behavior']['kind'];
    readonly paused: boolean;
    readonly reducedMotion: boolean;
    readonly hidden: boolean;
    readonly offscreen: boolean;
    readonly zeroSized: boolean;
    readonly disposed: boolean;
    readonly running: boolean;
    readonly ownAnimationFrames: 0 | 1;
    readonly subscribed: boolean;
    readonly pendingInputs: number;
    readonly pendingPolicyReset: boolean;
    readonly droppedMilliseconds: number;
    readonly renderedFrames: number;
    readonly staticPose: FoxStaticPose | null;
    readonly cols: number;
    readonly rows: number;
    readonly backingWidth: number;
    readonly backingHeight: number;
    readonly director: FoxDirectorState | null;
    readonly tableau: FoxTableau | null;
}
export interface FoxBrowserController {
    configure(options: FoxOptionsInput): FoxOptions;
    reset(seed?: number): FoxState;
    setPaused(value: boolean): void;
    guide(x: number, y: number): void;
    leave(): void;
    pounce(): void;
    /** Deliberately pauses playback and displays a static specimen. */
    showStaticPose(pose: FoxStaticPose): void;
    getOptions(): FoxOptions;
    getState(): FoxState;
    /** Diagnostics remain readable after disposal; other operations reject. */
    getStatus(): FoxBrowserStatus;
    exportText(): string;
    configureDirector(options: FoxDirectorOptionsInput): FoxDirectorOptions;
    getDirectorOptions(): FoxDirectorOptions | null;
    getDirectorState(): FoxDirectorState | null;
    cue(cue: FoxCue, id?: number, point?: FoxPoint): void;
    selectFox(id: number): void;
    showTableau(tableau: FoxTableau): void;
    dispose(): void;
}
/** Construction alone touches the DOM; importing this module is SSR safe.
 * Requires Canvas 2D, ResizeObserver and IntersectionObserver. On unsupported
 * hosts the demo retains a text specimen and meaningful description.
 */
export declare function mountFox(canvas: HTMLCanvasElement, options?: FoxBrowserOptions): FoxBrowserController;
