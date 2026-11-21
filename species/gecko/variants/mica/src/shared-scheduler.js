// The Original factory imports this exact runtime module. Its build omits the
// adjacent declaration, so our private .d.ts reuses the canonical source type.
export { getBrowserScheduler } from '../../../../../lib/core/scheduler.js';
