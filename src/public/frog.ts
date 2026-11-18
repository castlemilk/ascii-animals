import { mountFrog } from '../species/frog/controller.mjs';
import type { FrogController, FrogMountOptions, FrogConfigPatch } from '../species/frog/types.mjs';
import { getBrowserScheduler } from '../core/scheduler.js';
export * from '../species/frog/index.mjs';
export type { FrogMountOptions, FrogControllerStatus, FrogPreviewOptions } from '../species/frog/types.mjs';
/** Fixed-tick latched leap; no cuttlefish-clock compatibility implied. */
export interface FrogArtwork extends FrogController {
 readonly species: 'frog'; readonly canvas: HTMLCanvasElement; readonly disposed: boolean;
 update(config: FrogConfigPatch): void;
 play(): void; pause(): void; restart(): void; pulse(): void;
}
/** SSR-safe import. OS reduced motion makes pulse cycle static poses. */
export function createFrogArtwork(canvas: HTMLCanvasElement, options: FrogMountOptions = {}): FrogArtwork {
 if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Frog options must be an object');
 const view = canvas?.ownerDocument?.defaultView;
 if (!view) throw new TypeError('Frog requires a canvas with an owning browser document');
 const controller = mountFrog(canvas, {...options, frameSource: options.frameSource ?? getBrowserScheduler(view)});
 return Object.freeze({...controller, species: 'frog', canvas,
  get disposed() { return controller.getStatus().disposed; },
  update(config: FrogConfigPatch) { controller.updateConfig(config); },
  play() { controller.setPaused(false); }, pause() { controller.setPaused(true); },
  restart() { controller.reset(); }, pulse() { controller.leap(); }
 });
}
