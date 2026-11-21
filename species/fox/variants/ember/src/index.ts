/** Private opt-in Ember factory; intentionally absent from package exports.
 * Authored character proposal: Fox cartoon patch on f63b20e, isolated from Original.
 * A selector substitutes this factory within its existing single renderer lifecycle:
 * dispose the former controller first, then mount Ember on the owned canvas paused.
 * The host retains pause/reduced-motion intent; this controller owns only its own
 * input listeners, observers, model and borrowed scheduler subscription.
 */
import { mountFox } from './browser.js';
import type { FoxBrowserOptions } from './browser.js';
import { getBrowserScheduler } from './canonical-scheduler.js';
import type { FoxArtwork } from '../../../../../lib/public/fox.js';
import type { FoxOptionsInput } from '../../../lib/types.js';

export type { FoxArtwork as EmberFoxArtwork } from '../../../../../lib/public/fox.js';
export type { FoxBrowserOptions, FoxBrowserStatus } from './browser.js';
export type * from '../../../lib/types.js';
export type * from '../../../lib/director-types.js';
export { createFox as createEmberFox, staticFoxPose as staticEmberFoxPose,
  normalizeFoxPointer, FOX_DEFAULTS, FOX_LIMITS, resolveFoxOptions } from './model.js';
export { createFoxDirector as createEmberFoxDirector, FOX_DIRECTOR_DEFAULTS,
  FOX_DIRECTOR_LIMITS, resolveFoxDirectorOptions } from './director.js';
export { buildFoxGrid as buildEmberFoxGrid, paintFoxGrid as paintEmberFoxGrid,
  FOX_GLYPHS } from './preview.js';
export { buildFoxSceneGrid as buildEmberFoxSceneGrid,
  paintFoxSceneGrid as paintEmberFoxSceneGrid, routeFoxScenePointer } from './director-render.js';

/** Same controller contract and canonical browser scheduler as Original.
 * No browser state is read until construction. Importing Ember alone selects nothing.
 */
export function createEmberFoxArtwork(canvas: HTMLCanvasElement, options: FoxBrowserOptions = {}): FoxArtwork {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Fox options must be an object');
  const view = canvas?.ownerDocument?.defaultView;
  if (!view) throw new TypeError('Fox requires a canvas with a browser document');
  const controller = mountFox(canvas, { ...options, frameSource: options.frameSource ?? getBrowserScheduler(view) });
  return Object.freeze({
    ...controller, species: 'fox', canvas,
    get disposed() { return controller.getStatus().disposed; },
    update(patch: FoxOptionsInput) { controller.configure(patch); },
    play() { controller.setPaused(false); }, pause() { controller.setPaused(true); },
    restart() { controller.reset(); }, pulse() { controller.pounce(); },
  });
}
