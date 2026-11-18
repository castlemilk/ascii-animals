import { mountGecko } from '../species/gecko/browser.js';
import { getBrowserScheduler } from '../core/scheduler.js';
export { createGecko, resolveGeckoOptions, DEFAULT_GECKO_OPTIONS, GECKO_LIMITS } from '../species/gecko/gecko.js';
/** Explicit adapter preserving Gecko's integer-tick gait and input ordering. */
export function createGeckoArtwork(canvas, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options))
        throw new TypeError('Gecko options must be an object');
    const view = canvas?.ownerDocument?.defaultView;
    if (!view)
        throw new TypeError('Gecko requires a browser canvas');
    const host = mountGecko(canvas, { ...options, frameSource: options.frameSource ?? getBrowserScheduler(view) });
    return Object.freeze({ ...host, species: 'gecko', canvas,
        get disposed() { return host.getStatus().disposed; },
        play() { host.setPaused(false); }, pause() { host.setPaused(true); },
        restart() { host.reset(); }, pulse() { return host.startle(); }
    });
}
//# sourceMappingURL=gecko.js.map