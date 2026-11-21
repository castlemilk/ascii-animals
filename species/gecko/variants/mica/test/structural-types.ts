// This is compiled with noEmit: selecting Mica must fit the existing host seam.
import { createGeckoArtwork } from '../../../../../lib/public/gecko.js';
import type { GeckoArtwork, GeckoMountOptions } from '../../../../../lib/public/gecko.js';
import { mountGecko } from '../../../compiled/browser.js';
import type { GeckoController } from '../../../compiled/browser.js';
import { createMicaGeckoArtwork } from '../compiled/artwork.js';
import { mountMicaGecko } from '../compiled/browser.js';

const artworkFactory: typeof createGeckoArtwork = createMicaGeckoArtwork;
const controllerFactory: typeof mountGecko = mountMicaGecko;

export function selectForExistingHost(canvas: HTMLCanvasElement, options: GeckoMountOptions, mica: boolean): GeckoArtwork {
  return (mica ? artworkFactory : createGeckoArtwork)(canvas, options);
}
export function mountForExistingHost(canvas: HTMLCanvasElement, options: GeckoMountOptions): GeckoController {
  return controllerFactory(canvas, options);
}
