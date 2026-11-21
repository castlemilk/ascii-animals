/** Ember pose adapter over Original's unchanged fixed-tick state machine.
 * No second clock, random source, event queue, or independent model state.
 */
import { createFox as createOriginalFox } from '../../../lib/model.js';
import { poseFox } from './geometry.js';
import type { FoxBehavior, FoxCreateOptions, FoxModel, FoxPose, FoxStaticPose } from '../../../lib/types.js';

export { normalizeFoxPointer } from '../../../lib/model.js';
export { FOX_DEFAULTS, FOX_LIMITS, resolveFoxOptions } from '../../../lib/config.js';
export type * from '../../../lib/types.js';

/** All simulation methods delegate to Original; only pose sampling is Ember. */
export function createFox(init: FoxCreateOptions = {}): FoxModel {
  const model = createOriginalFox(init);
  return Object.freeze({
    ...model,
    getPose(): FoxPose { return poseFox(model.getState(), model.getOptions()); },
  });
}

/** Exact authored static alternatives, without an implicit simulation step. */
export function staticFoxPose(options: FoxCreateOptions = {}, pose: FoxStaticPose = 'idle'): FoxPose {
  if (!['idle', 'sniff', 'crouch'].includes(pose)) throw new TypeError('Unknown static pose');
  const model = createFox(options), state = model.getState(), config = model.getOptions();
  let behavior: FoxBehavior = { kind: 'idle' };
  if (pose === 'sniff') behavior = { kind: 'sniff' };
  if (pose === 'crouch') behavior = { kind: 'crouch', age: config.crouchTicks - 1,
    plan: { fromX: 0, toX: 0, options: config } };
  const result = poseFox({ ...state, behavior, target: { active: pose === 'sniff', x: .6, y: .2 } }, config);
  model.dispose();
  return result;
}
