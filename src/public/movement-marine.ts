import { MovementMarineEngine } from '../movement/marine-engine.js';
import type { MarineMovementOptions } from '../movement/marine-engine.js';
import type { Artwork, ArtworkOptions } from './index.js';
import type { MovementConfig, MovementSnapshot } from './movement.js';
export type { MarineMovementOptions } from '../movement/marine-engine.js';

/** Concrete bridge for cuttlefish, manta and octopus. Other species retain
 * their own pose contracts; use the pure /movement sampler in their adapters. */
export interface MarineMovementArtwork extends Artwork {
  readonly userPaused: boolean;
  readonly reducedMotion: boolean;
  getMovementOptions(): MovementConfig;
  /** The real simulation clock; rendering/static posters never advance it. */
  getMovementState(): MovementSnapshot;
  /** May be a display-only poster while paused or reduced. */
  getMovementDisplay(): MovementSnapshot;
  configureMovement(options: MarineMovementOptions): void;
  reverseMovement(): void;
  seekMovement(tick: number): void;
  showMovementStill(progress?: number): void;
}

/** SSR-safe import. Mount after a canvas exists and dispose on unmount.
 * Movement is opt-in: omitted/disabled movement preserves the native scene.
 * Travel uses 60 Hz fixed ticks; native reactions take precedence and recover
 * into the progressing route. This factory does not expose the separate
 * authored marine director, so two directors cannot fight over world pose.
 */
export function createMarineMovementArtwork(
  canvas: HTMLCanvasElement,
  movement: MarineMovementOptions = {},
  artwork: ArtworkOptions = {}
): MarineMovementArtwork {
  const engine = new MovementMarineEngine(canvas, movement, artwork);
  return Object.freeze({
    get species() { return engine.getArtworkOptions().species; }, canvas,
    get disposed() { return engine.destroyed; },
    get userPaused() { return engine.userPaused; },
    get reducedMotion() { return engine.reducedMotion; },
    getOptions: () => engine.getArtworkOptions(),
    getStats: () => engine.getStats(),
    update: (patch: ArtworkOptions) => engine.setOptions(patch),
    play: () => engine.setPaused(false), pause: () => engine.setPaused(true),
    restart: () => engine.restart(), pulse: () => engine.pulse(),
    advance: (seconds: number) => engine.advance(seconds),
    resize: () => engine.resize(), render: () => engine.render(),
    dispose: () => engine.destroy(),
    getMovementOptions: () => engine.getMovementOptions(),
    getMovementState: () => engine.getMovementState(),
    getMovementDisplay: () => engine.getMovementDisplay(),
    configureMovement: (patch: MarineMovementOptions) => engine.configureMovement(patch),
    reverseMovement: () => engine.reverseMovement(),
    seekMovement: (tick: number) => engine.seekMovement(tick),
    showMovementStill: (progress?: number) => engine.showMovementStill(progress)
  });
}
