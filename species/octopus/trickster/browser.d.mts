import type { OctopusPose, OctopusStage } from './core.mjs';
/** Local prototype API; not a package export or replacement for createArtwork. */
export interface OctopusTricksterOptions {
  /** Unsigned 32-bit integer. */
  seed?: number;
  paused?: boolean;
  /** False disables automatic scheduling and permits explicit advance(seconds) replay. */
  autoStart?: boolean;
  reducedMotion?: 'system' | 'ignore';
  observeVisibility?: boolean;
  /** Finite value in [0.5, 2]. */
  maxDpr?: number;
}
export interface OctopusTricksterStats {
  tick: number;
  stage: OctopusStage;
  pose: OctopusPose;
  paused: boolean;
  running: boolean;
  destroyed: boolean;
  queuedEvents: number;
  discardedEvents: number;
  droppedSeconds: number;
  renderCount: number;
  stepCount: number;
  lastRenderMs: number;
  width: number;
  height: number;
  dpr: number;
  occupiedCells?: number;
  glyphCount?: number;
  characterCells?: number;
  inkCells?: number;
  cols?: number;
  rows?: number;
  cellCount?: number;
  pauseReasons: { user: boolean; reducedMotion: boolean; hidden: boolean; offscreen: boolean;
    zeroSize: boolean; manual: boolean; destroyed: boolean };
}
export interface OctopusTricksterController {
  readonly canvas: HTMLCanvasElement;
  readonly paused: boolean;
  /** World coordinates x in [-.9, .9], y in [-.65, .7]; finite inputs are clamped. */
  invite(x?: number, y?: number): boolean;
  release(): boolean;
  pulse(x?: number, y?: number): boolean;
  /** Explicit false opts into motion even if the system currently requests reduced motion. */
  setPaused(paused: boolean): void;
  restart(): void;
  /** Explicit fixed-step replay, finite seconds in [0, 5]. Paused/hidden/offscreen stays still. */
  advance(seconds: number): void;
  render(): void;
  setOptions(options: OctopusTricksterOptions): void;
  getStats(): OctopusTricksterStats;
  destroy(): void;
  dispose(): void;
}
export function createOctopusTrickster(canvas: HTMLCanvasElement, options?: OctopusTricksterOptions): OctopusTricksterController;
