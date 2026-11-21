import type { InkPuppetArtwork, PuppetAction } from '../../../species/cuttlefish/ink-puppet/browser.mjs';

export type InkPuppetController = InkPuppetArtwork;
export type InkPuppetAction = PuppetAction;
export function createInkPuppetVariant(canvas: HTMLCanvasElement): {
  controller: InkPuppetController;
  playback: {
    readonly disposed: boolean;
    play(): void;
    pause(): void;
    restart(): void;
    dispose(): void;
  };
};
