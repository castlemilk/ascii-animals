import { mountDragonfly } from '../species/dragonfly/browser.js';
import { getBrowserScheduler } from '../core/scheduler.js';
export { createDragonfly, replayDragonfly, validateDragonflyOptions, DRAGONFLY_DEFAULTS, DRAGONFLY_LIMITS } from '../species/dragonfly/model.js';
/** Dedicated typed adapter: preserves Dragonfly's full/slow/static motion and
 * fixed-tick model; no cuttlefish geometry or clock compatibility is implied. */
export function createDragonflyArtwork(canvas, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options))
        throw new TypeError('Dragonfly options must be an object');
    const view = options.environment?.window ?? canvas?.ownerDocument?.defaultView;
    if (!view)
        throw new TypeError('Dragonfly requires a browser canvas');
    const host = mountDragonfly(canvas, { ...options, frameSource: options.frameSource ?? getBrowserScheduler(view) });
    return Object.freeze({ ...host, species: 'dragonfly', canvas,
        get disposed() { return host.getStatus().disposed; },
        update(patch) { host.configure(patch); },
        play() { host.setPaused(false); }, pause() { host.setPaused(true); },
        restart() { host.reset(); }, pulse() { host.dart(); } });
}
//# sourceMappingURL=dragonfly.js.map