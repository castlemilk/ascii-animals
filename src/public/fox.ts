import { mountFox } from '../species/fox/browser.js';
import type { FoxBrowserController, FoxBrowserOptions } from '../species/fox/browser.js';
import { getBrowserScheduler } from '../core/scheduler.js';
import type { FoxOptionsInput } from '../species/fox/types.js';
export { createFox, staticFoxPose, normalizeFoxPointer, FOX_DEFAULTS, FOX_LIMITS, resolveFoxOptions } from '../species/fox/model.js';
export type * from '../species/fox/types.js';
export type { FoxBrowserOptions, FoxBrowserStatus } from '../species/fox/browser.js';

/** Fox uses explicit fixed-tick input/model semantics, not the cuttlefish clock. */
export interface FoxArtwork extends FoxBrowserController {
  readonly species: 'fox';
  readonly canvas: HTMLCanvasElement;
  readonly disposed: boolean;
  /** Change animal settings atomically without restarting an active response. */
  update(options: FoxOptionsInput): void;
  /** OS reduced motion remains authoritative; play does not override it. */
  play(): void;
  pause(): void;
  /** Reset the same seed, retaining settings and user pause. */
  restart(): void;
  /** Fox-specific deliberate action: pounce, or a static crouch while paused. */
  pulse(): void;
}

/** SSR-safe import. Mount in a browser after sizing the canvas. The default
 * borrowed scheduler is shared with the other browser artwork instances.
 * All methods except getStatus/disposed reject after dispose; dispose is idempotent.
 */
export function createFoxArtwork(canvas: HTMLCanvasElement, options: FoxBrowserOptions = {}): FoxArtwork {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Fox options must be an object');
  const view = canvas?.ownerDocument?.defaultView;
  if (!view) throw new TypeError('Fox requires a canvas with a browser document');
  const controller = mountFox(canvas, { ...options, frameSource: options.frameSource ?? getBrowserScheduler(view) });
  return Object.freeze({
    ...controller, species: 'fox', canvas,
    get disposed() { return controller.getStatus().disposed; },
    update(patch: FoxOptionsInput) { controller.configure(patch); },
    play() { controller.setPaused(false); }, pause() { controller.setPaused(true); },
    restart() { controller.reset(); }, pulse() { controller.pounce(); }
  });
}
