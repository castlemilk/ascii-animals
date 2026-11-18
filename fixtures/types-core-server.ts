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
