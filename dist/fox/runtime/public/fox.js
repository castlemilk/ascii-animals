import { mountFox } from '../species/fox/browser.js';
import { getBrowserScheduler } from '../core/scheduler.js';
export { createFox, staticFoxPose, normalizeFoxPointer, FOX_DEFAULTS, FOX_LIMITS, resolveFoxOptions } from '../species/fox/model.js';
/** SSR-safe import. Mount in a browser after sizing the canvas. The default
 * borrowed scheduler is shared with the other browser artwork instances.
 * All methods except getStatus/disposed reject after dispose; dispose is idempotent.
 */
export function createFoxArtwork(canvas, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options))
        throw new TypeError('Fox options must be an object');
    const view = canvas?.ownerDocument?.defaultView;
    if (!view)
        throw new TypeError('Fox requires a canvas with a browser document');
    const controller = mountFox(canvas, { ...options, frameSource: options.frameSource ?? getBrowserScheduler(view) });
    return Object.freeze({
        ...controller, species: 'fox', canvas,
        get disposed() { return controller.getStatus().disposed; },
        update(patch) { controller.configure(patch); },
        play() { controller.setPaused(false); }, pause() { controller.setPaused(true); },
        restart() { controller.reset(); }, pulse() { controller.pounce(); }
    });
}
//# sourceMappingURL=fox.js.map