/** Private opt-in study entry. Not exposed through the package export map. */
import { mountPufferfishWithPainter } from './controller.js';
import type { PufferfishController, PufferfishMountOptions } from './controller.js';
import { createPufferfishCharacterPainter } from './character-painter.js';

export function mountPufferfishCharacter(canvas: HTMLCanvasElement,
  options: PufferfishMountOptions = {}): PufferfishController {
  return mountPufferfishWithPainter(canvas, options, createPufferfishCharacterPainter);
}
