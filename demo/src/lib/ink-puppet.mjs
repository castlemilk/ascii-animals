import { createInkPuppet } from '../../../species/cuttlefish/ink-puppet/browser.mjs';

/** Load this module only for the Ink Puppet variation. The shell owns the canvas. */
export function createInkPuppetVariant(canvas) {
  const controller = createInkPuppet(canvas, { seed: 7, paused: true });
  const playback = {
    get disposed() { return controller.destroyed; },
    play() { controller.setPaused(false); },
    pause() { controller.setPaused(true); },
    restart() { controller.restart(); },
    dispose() { controller.destroy(); },
  };
  return { controller, playback };
}
