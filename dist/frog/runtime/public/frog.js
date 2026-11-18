import { mountFrog } from '../species/frog/controller.mjs';
import { getBrowserScheduler } from '../core/scheduler.js';
export * from '../species/frog/index.mjs';
/** SSR-safe import. OS reduced motion makes pulse cycle static poses. */
export function createFrogArtwork(canvas, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options))
        throw new TypeError('Frog options must be an object');
    const view = canvas?.ownerDocument?.defaultView;
    if (!view)
        throw new TypeError('Frog requires a canvas with an owning browser document');
    const controller = mountFrog(canvas, { ...options, frameSource: options.frameSource === undefined ? getBrowserScheduler(view) : options.frameSource });
    return Object.freeze({ ...controller, species: 'frog', canvas,
        get disposed() { return controller.getStatus().disposed; },
        update(config) { controller.updateConfig(config); },
        play() { controller.setPaused(false); }, pause() { controller.setPaused(true); },
        restart() { controller.reset(); }, pulse() { controller.leap(); } });
}
//# sourceMappingURL=frog.js.map