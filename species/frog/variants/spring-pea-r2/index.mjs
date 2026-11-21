/**
 * Private, opt-in Spring Pea R2 adapter. This is not a public package export.
 * Build the repository before importing: the canonical facade owns the model,
 * input contract and shared browser scheduler; this adapter changes rendering.
 */
import { createFrogArtwork } from '../../../../lib/public/frog.js';
import { createSpringPeaPreview } from './preview.mjs';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('../../../../lib/public/frog.js').FrogMountOptions} [options]
 * @returns {import('../../../../lib/public/frog.js').FrogArtwork}
 */
export function createSpringPeaArtwork(canvas, options = {}) {
  // Match the canonical facade before object spread can coerce invalid options.
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Frog options must be an object');
  }
  return createFrogArtwork(canvas, {
    ...options,
    // This private entry point explicitly selects R2. The original entry point
    // continues to select Original, including when both share one browser view.
    previewFactory: createSpringPeaPreview,
  });
}

export { createSpringPeaPreview };
