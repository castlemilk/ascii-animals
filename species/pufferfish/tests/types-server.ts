/** Compile using ES2022 only, deliberately without DOM or Node ambient types. */
import { createPufferfish, stepPufferfish, describePufferfish } from '../build/model.js';
import type { PufferfishOptions, PufferfishPhase, PufferfishStepResult } from '../build/types.js';
import { pufferfish } from '../build/index.js';

const options: PufferfishOptions = { seed: 17 };
const result: PufferfishStepResult = stepPufferfish(createPufferfish(options), {
  tick: 1,
  events: [{ tick: 1, seq: 0, type: 'approach' }],
});
const phase: PufferfishPhase = result.state.phase;
const label: string = describePufferfish(result.state);
void phase; void label;
pufferfish.sample(result.state, point => { const x: number = point.x; void x; }, { quality: 'small' });
// @ts-expect-error This test has no browser globals in its ambient environment.
document.createElement('canvas');
