import type { PufferfishPainter, PufferfishLegacyDependency, PufferfishRenderConfig, PufferfishRenderOptions } from './legacy-painter.js';
import type { PufferfishInput, PufferfishOptions, PufferfishPhase, PufferfishState } from './types.js';
import type { PufferfishDirectorOptions, PufferfishDirectorState, PufferfishSceneStatus } from './director-types.js';
export interface PufferfishFrameSource {
    subscribe(callback: (timestamp: number) => void): () => void;
}
export interface PufferfishMountOptions {
    readonly frameSource?: PufferfishFrameSource;
    readonly species?: PufferfishOptions;
    /** Omit to retain the original centered solo experience. */
    readonly director?: PufferfishDirectorOptions;
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
    readonly director: PufferfishSceneStatus | null;
}
export type PufferfishActionResult = Readonly<{
    kind: 'queued' | 'static-poster' | 'suspended';
    phase: PufferfishPhase['kind'];
}>;
export interface PufferfishController {
    configure(patch: PufferfishOptions): void;
    configureRender(patch: PufferfishRenderOptions): void;
    configureDirector(patch: PufferfishDirectorOptions): void;
    selectActor(id: number): void;
    invite(x?: number, y?: number): PufferfishActionResult;
    setPaused(paused: boolean): void;
    reset(seed?: number): void;
    approach(): PufferfishActionResult;
    retreat(): PufferfishActionResult;
    getSnapshot(): PufferfishState;
    getDirectorSnapshot(): PufferfishDirectorState | null;
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
/** Internal dependency injection for art variations. All variants share this lifecycle. */
export declare function mountPufferfishWithPainter(canvas: HTMLCanvasElement, options: PufferfishMountOptions, createPainter: (surface: HTMLCanvasElement, config: PufferfishRenderConfig) => PufferfishPainter): PufferfishController;
