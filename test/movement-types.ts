import { createMovementDirector, normalizeMovementOptions, sampleMovement, MOVEMENT_TICK_RATE } from '../lib/public/movement.js';
import type { MovementConfig, MovementDirector, MovementOptions, MovementSnapshot, MovementViewport } from '../lib/public/movement.js';
const options: MovementOptions = { enabled: true, path: 'free', direction: 'reverse', timing: { mode: 'speed', pixelsPerSecond: 80 }, seed: 7, count: 3, cast: ['manta', 'cuttlefish', 'octopus'] };
const viewport: MovementViewport = { width: 900, height: 600 };
const config: MovementConfig = normalizeMovementOptions(options);
const director: MovementDirector = createMovementDirector(config, viewport);
const snapshot: MovementSnapshot = director.sample();
director.advanceTicks(MOVEMENT_TICK_RATE); director.seek(120); director.reverse(); director.resize(viewport); director.configure({ timing: { mode: 'duration', seconds: 20 } });
const x: number | undefined = snapshot.members[0]?.x;
void x; void sampleMovement(options, viewport, 120);
// @ts-expect-error timing is a discriminated union, not two competing clocks
normalizeMovementOptions({ timing: { mode: 'speed', seconds: 10, pixelsPerSecond: 20 } });
// @ts-expect-error unsupported biological profile must be explicit future work
createMovementDirector({ profile: 'fox' });
// @ts-expect-error movement is not formation
createMovementDirector({ formation: 'horizontal' });
// @ts-expect-error snapshots are immutable
snapshot.members[0]!.x = 20;
// @ts-expect-error configuration cast is immutable
config.cast.push('neutral');
// @ts-expect-error viewport excludes presentation scale
createMovementDirector({}, { width: 500, height: 300, dpr: 2 });
