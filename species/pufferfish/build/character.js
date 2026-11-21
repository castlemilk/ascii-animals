/** Private opt-in study entry. Not exposed through the package export map. */
import { mountPufferfishWithPainter } from './controller.js';
import { createPufferfishCharacterPainter } from './character-painter.js';
export function mountPufferfishCharacter(canvas, options = {}) {
    return mountPufferfishWithPainter(canvas, options, createPufferfishCharacterPainter);
}
