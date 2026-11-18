import type { Scheduler } from '../../types/core/index.js';
export { createScheduler } from '../../types/core/index.js';
/** Internal browser scheduler; shared per browsing context. */
export function getBrowserScheduler(view: Window): Scheduler;
