import { mountPufferfish } from '../species/pufferfish/controller.js';
import type { PufferfishController, PufferfishMountOptions } from '../species/pufferfish/controller.js';
import type { PufferfishOptions, PufferfishConfig } from '../species/pufferfish/types.js';
import { CuttlefishArtwork } from '../animals/cuttlefish.js';
import { getBrowserScheduler } from '../core/scheduler.js';
export * from '../species/pufferfish/index.js';
export type { PufferfishMountOptions, PufferfishStatus, PufferfishActionResult, PufferfishFrameSource } from '../species/pufferfish/controller.js';
export type { PufferfishRenderOptions, PufferfishRenderConfig } from '../species/pufferfish/legacy-painter.js';
export interface PufferfishArtwork extends PufferfishController {
  readonly species: 'pufferfish'; readonly canvas: HTMLCanvasElement; readonly disposed: boolean;
  update(patch: PufferfishOptions): void;
  getOptions(): PufferfishConfig;
  play(): void; pause(): void; restart(): void; pulse(): void; dispose(): void;
}
/** Explicit fixed-tick pufferfish API. SSR-safe import; mount after sizing the canvas.
 * Reduced motion and compact layouts use deliberate static poses, never a hidden animation.
 * The scheduler is borrowed, so disposing this animal cannot stop other artwork.
 */
export function createPufferfishArtwork(canvas: HTMLCanvasElement, options: PufferfishMountOptions = {}): PufferfishArtwork {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Pufferfish options must be an object');
  const view = canvas?.ownerDocument?.defaultView;
  if (!view) throw new TypeError('Pufferfish requires a canvas with a browser document');
  const controller = mountPufferfish(canvas, CuttlefishArtwork, { ...options, frameSource: options.frameSource ?? getBrowserScheduler(view) });
  return Object.freeze({ ...controller, species: 'pufferfish', canvas,
    get disposed() { return controller.getStatus().destroyed; },
    update(patch: PufferfishOptions) { controller.configure(patch); },
    getOptions() { return controller.getDirectorSnapshot()?.speciesConfig ?? controller.getSnapshot().config; },
    play() { controller.setPaused(false); }, pause() { controller.setPaused(true); },
    restart() { controller.reset(); }, pulse() { controller.approach(); }, dispose() { controller.destroy(); }
  });
}
