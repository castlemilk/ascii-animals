// Deliberately compiled with lib: ES2022 only, without DOM or @types/node.
import { createScheduler, type FrameCallback, type Scheduler } from 'ascii-animals-review/core';

let pending: FrameCallback | undefined;
let handle = 0;
const scheduler: Scheduler = createScheduler({
  requestFrame: callback => { pending = callback; return ++handle; },
  cancelFrame: () => { pending = undefined; },
});
let observed = 0;
const unsubscribe = scheduler.subscribe(milliseconds => { observed = milliseconds; });
pending?.(100);
unsubscribe();
scheduler.dispose();
void [observed, scheduler.size];


// The pure path module must also work with no DOM or Node declarations.
import { createMovementDirector, type MovementSnapshot } from 'ascii-animals-review/movement';
const director = createMovementDirector({ path: 'free', seed: 19 }, { width: 390, height: 500 });
director.advanceTicks(60);
const sample: MovementSnapshot = director.sample();
director.dispose();
void sample;
