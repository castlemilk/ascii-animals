import { createMarineMovementArtwork } from 'ascii-animals-review/movement/marine';
import type { MarineMovementArtwork, MarineMovementOptions } from 'ascii-animals-review/movement/marine';
import { mountMarineJourneyDemo } from '../examples/movement/main.mjs';
declare const canvas: HTMLCanvasElement;
declare const controlsHost: HTMLElement;
const options: MarineMovementOptions = { enabled: true, path: 'diagonal', diagonalSlope: 'up', timing: { mode: 'speed', pixelsPerSecond: 80 } };
const art: MarineMovementArtwork = createMarineMovementArtwork(canvas, options, { species: 'manta' });
art.configureMovement({ direction: 'reverse' });
art.update({ followPointer: true });
art.getMovementDisplay().members[0]?.tangent.x;
art.showMovementStill(.5);
art.dispose();
void mountMarineJourneyDemo({ canvas, controlsHost, signal: new AbortController().signal });
// @ts-expect-error Cast belongs to the renderer, not the movement settings.
art.configureMovement({ count: 3 });
// @ts-expect-error Only the actually supported marine species can be mounted here.
createMarineMovementArtwork(canvas, {}, { species: 'fox' });
// @ts-expect-error A DOM text host is not a canvas.
createMarineMovementArtwork(controlsHost);
// @ts-expect-error Public movement snapshots are immutable.
art.getMovementState().tick = 2;
// @ts-expect-error This adapter intentionally does not expose a competing authored director.
art.setDirector({ scene: 'reef-rendezvous' });
