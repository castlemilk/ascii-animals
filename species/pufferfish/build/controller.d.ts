import type { PufferfishLegacyDependency, PufferfishRenderOptions } from './legacy-painter.js';
import type { PufferfishInput, PufferfishOptions, PufferfishPhase, PufferfishState } from './types.js';
export interface PufferfishFrameSource {
    subscribe(callback: (timestamp: number) => void): () => void;
}
export interface PufferfishMountOptions {
    readonly frameSource?: PufferfishFrameSource;
    readonly species?: PufferfishOptions;
    readonly render?: PufferfishRenderOptions;
    readonly paused?: boolean;
    readonly onChange?: (status: PufferfishStatus) => void;
    readonly onError?: (error: unknown) => void;
}
export interface PufferfishStatus {
    readonly tick: number;
    readonly phase: PufferfishPhase['kind'];
    readonly description: string;
    readonly userPaused: boolean;
    readonly reducedMotion: boolean;
    readonly hidden: boolean;
    readonly offscreen: boolean;
    readonly zeroSized: boolean;
    readonly compact: boolean;
    readonly destroyed: boolean;
    readonly running: boolean;
    readonly queuedFrames: number;
    readonly droppedMilliseconds: number;
    readonly renderedFrames: number;
    readonly coalescedInputs: number;
    readonly pendingInputs: number;
    readonly failure: string | null;
}
export type PufferfishActionResult = Readonly<{
    kind: 'queued' | 'static-poster' | 'suspended';
    phase: PufferfishPhase['kind'];
}>;
export interface PufferfishController {
    configure(patch: PufferfishOptions): void;
    configureRender(patch: PufferfishRenderOptions): void;
    setPaused(paused: boolean): void;
    reset(seed?: number): void;
    approach(): PufferfishActionResult;
    retreat(): PufferfishActionResult;
    getSnapshot(): PufferfishState;
    getStatus(): PufferfishStatus;
    exportText(): string;
    destroy(): void;
}
export interface PufferfishRect {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}
export declare function normalizePufferfishPointer(clientX: number, clientY: number, rect: PufferfishRect): PufferfishInput | null;
/** Browser lifecycle only. No legacy constructor/listener/RAF is created by the painter. */
export declare function mountPufferfish(canvas: HTMLCanvasElement, legacy: PufferfishLegacyDependency, options?: PufferfishMountOptions): PufferfishController;
