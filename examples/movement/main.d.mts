import type { MarineMovementArtwork } from 'ascii-animals-review/movement/marine';
import type { MovementControls, MovementControlsPort } from './controls.mjs';
export interface MarineJourneyDemo {
  readonly artwork: MarineMovementArtwork;
  readonly controls: MovementControls;
  readonly port: MovementControlsPort;
  refresh(): void;
  dispose(): void;
}
export function mountMarineJourneyDemo(options: {
  canvas: HTMLCanvasElement;
  controlsHost: HTMLElement;
  signal?: AbortSignal;
}): Promise<MarineJourneyDemo | null>;
