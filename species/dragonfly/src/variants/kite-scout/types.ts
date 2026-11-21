/** Private Kite Scout contracts. Reuse Original's state/input/options without
 * changing its public samples, exports, or renderer. */
export type * from '../../types.js';
import type {
  DragonflySample as OriginalSample,
  DragonflyGeometry as OriginalGeometry,
  Dragonfly as OriginalDragonfly,
} from '../../types.js';

/** Optional stroke hints belong to this opt-in character only. */
export interface DragonflySample extends OriginalSample {
  readonly glyph?: string;
}
export interface DragonflyGeometry extends Omit<OriginalGeometry, 'samples'> {
  readonly samples: readonly DragonflySample[];
}
export interface Dragonfly extends Omit<OriginalDragonfly, 'sample'> {
  sample(): DragonflyGeometry;
}
