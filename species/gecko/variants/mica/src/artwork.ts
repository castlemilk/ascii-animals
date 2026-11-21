/**
 * Private opt-in Mica artwork. This module is intentionally outside package
 * exports, the gallery registry and the default Gecko renderer.
 *
 * Adoption seam: a host chooses either its unchanged createGeckoArtwork factory
 * or this factory for one canvas. Dispose the active artwork BEFORE mounting its
 * replacement, retain playback/configuration intent, and use each variant's own
 * view defaults (or `grid: 'auto'`). The returned controller is structurally
 * compatible with the existing Gecko artwork lifecycle. Do not mount both on
 * one canvas or wrap either one in an additional animation loop.
 *
 * Both factories borrow the existing browser scheduler unless frameSource is
 * explicitly supplied. An enclosing renderer therefore needs no new scheduler,
 * registry mutation or public package export to review this private alternative.
 * Bear owns any future shared selector/adoption change.
 */
import { mountMicaGecko } from './browser.js';
// Match the exact scheduler module used by lib/public/gecko.js. Importing the
// source or classic copy would create a second WeakMap and a second RAF owner.
import { getBrowserScheduler } from './shared-scheduler.js';
import type { GeckoController, GeckoMountOptions, GeckoActionResult } from '../../../compiled/browser.js';

export interface MicaGeckoArtwork extends GeckoController {
  readonly species: 'gecko';
  readonly variation: 'mica';
  readonly canvas: HTMLCanvasElement;
  readonly disposed: boolean;
  play(): void;
  pause(): void;
  restart(): void;
  pulse(): GeckoActionResult;
}

/** Explicit selection only; the shipped Original factory remains untouched. */
export function createMicaGeckoArtwork(canvas: HTMLCanvasElement, options: GeckoMountOptions = {}): MicaGeckoArtwork {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Mica options must be an object');
  const view = canvas?.ownerDocument?.defaultView;
  if (!view) throw new TypeError('Mica requires a browser canvas');
  const host = mountMicaGecko(canvas, { ...options, frameSource: options.frameSource ?? getBrowserScheduler(view) });
  return Object.freeze({ ...host, species: 'gecko', variation: 'mica', canvas,
    get disposed() { return host.getStatus().disposed; },
    play() { host.setPaused(false); }, pause() { host.setPaused(true); },
    restart() { host.reset(); }, pulse() { return host.startle(); }
  });
}
