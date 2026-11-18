import { mountGecko } from '../species/gecko/browser.js';
import type { GeckoController, GeckoMountOptions, GeckoActionResult } from '../species/gecko/browser.js';
import { getBrowserScheduler } from '../core/scheduler.js';
export { createGecko, resolveGeckoOptions, DEFAULT_GECKO_OPTIONS, GECKO_LIMITS } from '../species/gecko/gecko.js';
export type * from '../species/gecko/types.js';
export type { GeckoMountOptions, GeckoControllerStatus, GeckoViewOptions, GeckoActionResult, GeckoFrameSource } from '../species/gecko/browser.js';
export interface GeckoArtwork extends GeckoController {
  readonly species: 'gecko';
  readonly canvas: HTMLCanvasElement;
  readonly disposed: boolean;
  play(): void;
  pause(): void;
  restart(): void;
  /** Startle in motion, curl a still pose while paused/reduced. */
  pulse(): GeckoActionResult;
}
/** Explicit adapter preserving Gecko's integer-tick gait and input ordering. */
export function createGeckoArtwork(canvas: HTMLCanvasElement, options: GeckoMountOptions = {}): GeckoArtwork {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Gecko options must be an object');
  const view = canvas?.ownerDocument?.defaultView;
  if (!view) throw new TypeError('Gecko requires a browser canvas');
  const host = mountGecko(canvas, { ...options, frameSource: options.frameSource ?? getBrowserScheduler(view) });
  return Object.freeze({ ...host, species: 'gecko', canvas,
    get disposed() { return host.getStatus().disposed; },
    play() { host.setPaused(false); }, pause() { host.setPaused(true); },
    restart() { host.reset(); }, pulse() { return host.startle(); }
  });
}
