import { mountDragonfly } from '../species/dragonfly/browser.js';
import type { DragonflyBrowserController, DragonflyMountOptions } from '../species/dragonfly/browser.js';
import type { DragonflyConfigPatch } from '../species/dragonfly/types.js';
import { getBrowserScheduler } from '../core/scheduler.js';
export { createDragonfly, replayDragonfly, validateDragonflyOptions, DRAGONFLY_DEFAULTS, DRAGONFLY_LIMITS } from '../species/dragonfly/model.js';
export type * from '../species/dragonfly/types.js';
export { createDragonflyDirector, validateDragonflyDirectorOptions, DRAGONFLY_DIRECTOR_DEFAULTS, DRAGONFLY_DIRECTOR_LIMITS } from '../species/dragonfly/director.js';
export type * from '../species/dragonfly/director.js';
export type { DragonflyMountOptions, DragonflyBrowserStatus, DragonflyFrameSource } from '../species/dragonfly/browser.js';
export interface DragonflyArtwork extends DragonflyBrowserController {
  readonly species: 'dragonfly';
  readonly canvas: HTMLCanvasElement;
  readonly disposed: boolean;
  update(patch: DragonflyConfigPatch): void;
  play(): void;
  pause(): void;
  restart(): void;
  /** Dart in motion, change still pose while paused/reduced/static. */
  pulse(): void;
}
/** Dedicated typed adapter: preserves Dragonfly's full/slow/static motion and
 * fixed-tick model; no cuttlefish geometry or clock compatibility is implied. */
export function createDragonflyArtwork(canvas: HTMLCanvasElement, options: DragonflyMountOptions = {}): DragonflyArtwork {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Dragonfly options must be an object');
  const view = options.environment?.window ?? canvas?.ownerDocument?.defaultView;
  if (!view) throw new TypeError('Dragonfly requires a browser canvas');
  const host = mountDragonfly(canvas, { ...options, frameSource: options.frameSource ?? getBrowserScheduler(view) });
  return Object.freeze({ ...host, species: 'dragonfly', canvas,
    get disposed() { return host.getStatus().disposed; },
    update(patch: DragonflyConfigPatch) { host.configure(patch); },
    play() { host.setPaused(false); }, pause() { host.setPaused(true); },
    restart() { host.reset(); }, pulse() { host.dart(); }
  });
}
