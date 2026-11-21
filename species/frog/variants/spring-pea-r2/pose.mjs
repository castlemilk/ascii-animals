/**
 * Spring Pea R2 reconstruction: private pose treatment over canonical state.
 * No model, clock, event queue or lifecycle is duplicated here.
 */
import { poseFrog } from '../../generated/frog.mjs';
import { posePondFrog } from '../../generated/pond.mjs';

const smooth = value => { const u = Math.max(0, Math.min(1, value)); return u * u * (3 - 2 * u); };

function springPose(model, pose, options) {
  if (options.staticPose !== undefined || model.behavior.kind !== 'flight') return pose;
  const u = model.behavior.age / model.config.flightTicks;
  // Full launch at the first third; gather near the apex and hold the tucked
  // falling pose. Canonical root motion, phase durations and endpoints remain.
  const extension = smooth(u / .26) * (1 - smooth((u - .32) / .42));
  return Object.freeze({ ...pose, extension });
}

export function poseSpringPea(state, options = {}) {
  return springPose(state, poseFrog(state, options), options);
}

export function poseSpringPeaPondFrog(state, actor, options = {}) {
  return springPose(actor.model, posePondFrog(state, actor, options), options);
}
