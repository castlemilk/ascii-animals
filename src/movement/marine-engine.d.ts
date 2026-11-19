import { CuttlefishArtwork } from '../animals/cuttlefish.js';
import type { ArtworkOptions, ArtworkConfig } from '../public/index.js';
import type { MovementOptions, MovementConfig, MovementSnapshot } from '../public/movement.js';
export type MarineMovementOptions = Omit<MovementOptions, 'count' | 'cast' | 'profile' | 'silhouetteRadius'>;
/** Internal implementation detail. Use the public /movement/marine factory. */
export class MovementMarineEngine extends CuttlefishArtwork {
  constructor(canvas: HTMLCanvasElement, movement?: MarineMovementOptions, artwork?: ArtworkOptions);
  readonly userPaused: boolean;
  readonly reducedMotion: boolean;
  getArtworkOptions(): ArtworkConfig;
  getMovementOptions(): MovementConfig;
  getMovementState(): MovementSnapshot;
  getMovementDisplay(): MovementSnapshot;
  configureMovement(patch: MarineMovementOptions): void;
  reverseMovement(): void;
  seekMovement(tick: number): void;
  showMovementStill(progress?: number): void;
}
