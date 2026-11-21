/**
 * Private opt-in entry for the authored Kite Scout variation.
 * No public package export, selector, default mount or shared renderer imports it.
 *
 * Integration owns one active controller for a canvas:
 *   const paused = active.getStatus().paused;
 *   active.dispose(); // releases its subscription, observers and input handlers
 *   active = mountKiteScout(canvas, { ...savedOptions, paused, frameSource });
 *
 * Reuse the caller's existing scheduler as frameSource. Keep savedOptions in the
 * integration layer so a user's requested motion mode is not replaced by the
 * effective reduced-motion mode. Do not mount Original behind this controller,
 * and do not add an update loop: the private host owns one borrowed subscription.
 * Returning to Original uses the same dispose-then-mount handoff.
 */
import { mountDragonfly } from './browser.js';
import type { DragonflyBrowserController, DragonflyFrameSource, DragonflyMountOptions } from './browser.js';

export const KITE_SCOUT_VARIATION = Object.freeze({
  id: 'kite-scout', version: 1, species: 'dragonfly',
} as const);

export { createDragonfly as createKiteScout, replayDragonfly as replayKiteScout } from './model.js';
export { createDragonflyDirector as createKiteScoutDirector } from './director.js';
export type { Dragonfly as KiteScout } from './types.js';
export type KiteScoutController = DragonflyBrowserController;
export type KiteScoutMountOptions = Omit<DragonflyMountOptions, 'frameSource'> & {
  readonly frameSource: DragonflyFrameSource;
};

/** A single private host; the coordinator supplies its already-owned clock. */
export function mountKiteScout(canvas: HTMLCanvasElement, options: KiteScoutMountOptions): KiteScoutController {
  if (!options || typeof options.frameSource?.subscribe !== 'function')
    throw new TypeError('Kite Scout requires a borrowed frameSource');
  return mountDragonfly(canvas, options);
}
