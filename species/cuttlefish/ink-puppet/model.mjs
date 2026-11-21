/**
 * Ink Puppet — Cuttlefish-only, original fixed-tick character direction.
 * No Canvas, DOM, font metrics, random global, or browser clock belongs here.
 * Coordinates are offsets from the centre of the viewing lens, in [-.5, .5].
 * Same module version, seed and ordered tick/input log produce the same state.
 */
export const PUPPET_MODEL_VERSION = 'ink-puppet-1';
export const PUPPET_TICK_RATE = 60;
export const PUPPET_DURATIONS = Object.freeze({ investigate: 360, retreat: 348 });
const COOLDOWN = 36;
const MAX_STEP = 3600;
const BRAND = Symbol('ink-puppet-state');
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function plainData(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every(key => typeof key === 'string'
    && allowed.includes(key)
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
}

function unitRandom(seed, salt) {
  let value = (seed ^ Math.imul(salt, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x21f0aaad);
  value = Math.imul(value ^ value >>> 15, 0x735a2d97);
  return ((value ^ value >>> 15) >>> 0) / 4294967296;
}

function assertState(state) {
  if (!state || state[BRAND] !== true) throw new TypeError('Expected an Ink Puppet state.');
  if (!Number.isSafeInteger(state.tick) || state.tick < 0) throw new RangeError('Invalid puppet tick.');
}

/** Quintic interpolation: position, velocity and acceleration meet at keys. */
function keys(age, points) {
  if (age <= points[0][0]) return points[0][1];
  for (let index = 1; index < points.length; index++) {
    const [end, value] = points[index], [start, previous] = points[index - 1];
    if (age <= end) {
      const q = (age - start) / (end - start);
      return previous + (value - previous) * q ** 3 * (10 + q * (-15 + 6 * q));
    }
  }
  return points[points.length - 1][1];
}

function idle(state) {
  const time = state.tick / PUPPET_TICK_RATE;
  return {
    x: -.06 + .025 * Math.sin(time * .46 + state.phase),
    y: -.03 + .018 * Math.sin(time * .71 + state.phase * .73),
    angle: -.06 + .024 * Math.sin(time * .53 + state.phase * .41)
  };
}

function actionPhase(kind, age) {
  if (kind === 'investigate') return age < .65 ? 'anticipation'
    : age < 1.8 ? 'approach' : age < 2.6 ? 'reach'
      : age < 3.1 ? 'hold' : age < 4.3 ? 'retract' : 'settle';
  return age < .65 ? 'anticipation' : age < 1.05 ? 'warning'
    : age < 2.4 ? 'jet' : 'settle';
}

/** Only uint32 seeds are accepted; silently coercing a seed changes a replay. */
export function createPuppetState(seed = 7) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Puppet seed must be an unsigned 32-bit integer.');
  }
  return {
    [BRAND]: true, seed, tick: 0, phase: unitRandom(seed, 31) * TAU,
    point: { x: .28, y: -.08 }, pointer: false,
    action: null, cooldownUntil: 0, sequence: 0
  };
}

/**
 * Point is one coalesced slot, not a queue. Explicit cues lock their own target.
 * An action cannot interrupt another action or the following .6 s rest.
 * Invalid/conflicting input returns false without changing any state.
 */
export function cuePuppet(state, input) {
  assertState(state);
  if (!plainData(input, ['type', 'x', 'y'])) return false;
  const { type } = input;
  if (!['point', 'leave', 'investigate', 'retreat'].includes(type)) return false;
  const hasX = Object.hasOwn(input, 'x'), hasY = Object.hasOwn(input, 'y');
  if (hasX !== hasY || (type === 'point' && !hasX)
    || (type === 'leave' && hasX)) return false;
  if (hasX && (![input.x, input.y].every(value => typeof value === 'number'
    && Number.isFinite(value) && value >= -.5 && value <= .5))) return false;
  if (type === 'leave') { state.pointer = false; return true; }
  const target = hasX ? { x: input.x, y: input.y } : { ...state.point };
  if (type === 'point') {
    state.point = target; state.pointer = true;
    return true;
  }
  if (state.action || state.tick < state.cooldownUntil || state.sequence >= Number.MAX_SAFE_INTEGER
    || state.tick > Number.MAX_SAFE_INTEGER - PUPPET_DURATIONS[type] - COOLDOWN) return false;
  const origin = idle(state);
  const dx = target.x - origin.x, dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  // Coincident input has a stable forward threat direction, never NaN.
  const direction = distance > .000001
    ? { x: dx / distance, y: dy / distance } : { x: 1, y: 0 };
  const strength = type === 'retreat' ? .45 + .55 * (1 - clamp(distance / .65, 0, 1))
    : .65 + .35 * clamp(distance / .5, 0, 1);
  state.point = target;
  state.action = { kind: type, startTick: state.tick, target: { ...target },
    origin: { x: origin.x, y: origin.y }, direction, strength };
  state.cooldownUntil = state.tick + PUPPET_DURATIONS[type] + COOLDOWN;
  state.sequence++;
  return true;
}

/**
 * Advance explicit whole ticks only. A call is bounded to one minute; browser
 * adapters must apply their smaller catch-up budget before calling this model.
 * Sampling cadence is irrelevant: no rendering operation changes state.
 */
export function stepPuppet(state, ticks = 1) {
  assertState(state);
  if (!Number.isInteger(ticks) || ticks < 0 || ticks > MAX_STEP
    || state.tick > Number.MAX_SAFE_INTEGER - ticks) {
    throw new RangeError(`Puppet step must be 0..${MAX_STEP} integer ticks within the exact tick range.`);
  }
  state.tick += ticks;
  if (state.action && state.tick - state.action.startTick >= PUPPET_DURATIONS[state.action.kind]) {
    state.action = null;
  }
  return samplePuppet(state);
}

/** Return a detached pose; this operation does not advance or mutate the model. */
export function samplePuppet(state) {
  assertState(state);
  const base = idle(state), action = state.action;
  const pose = {
    tick: state.tick, phase: 'swim', action: action?.kind ?? null,
    x: base.x, y: base.y, angle: base.angle, facing: 1, turn: 0,
    squeeze: 0, reach: 0, gather: 0, stripe: .12, ink: 0, eye: 0,
    target: action ? { ...action.target } : state.pointer ? { ...state.point } : null,
    origin: action ? { ...action.origin } : null,
    age: action ? (state.tick - action.startTick) / PUPPET_TICK_RATE : 0,
    targetVisible: Boolean(action || state.pointer), strength: action?.strength ?? 0
  };
  if (!action) return pose;
  const age = pose.age;
  const { direction, strength } = action;
  pose.phase = actionPhase(action.kind, age);
  if (action.kind === 'investigate') {
    const approach = keys(age, [[0, 0], [.65, -.11], [1.8, 1], [3.1, 1], [4.3, .55], [6, 0]]);
    const attention = keys(age, [[0, 0], [.65, .65], [1.8, 1], [3.1, 1], [6, 0]]);
    pose.x += direction.x * .105 * approach;
    pose.y += direction.y * .07 * approach;
    pose.angle += clamp(direction.y * .21 + direction.x * -.025, -.21, .21) * attention;
    pose.gather = keys(age, [[0, 0], [.45, .65], [.65, .8], [1.8, .18], [2.6, 0], [3.1, .18], [4.3, .08], [6, 0]]);
    pose.squeeze = keys(age, [[0, 0], [.65, .16], [1.8, .03], [3.1, .03], [6, 0]]);
    pose.reach = keys(age, [[0, 0], [1.8, 0], [2.15, 1], [2.6, 1], [3.1, .85], [4.3, 0], [6, 0]]);
    pose.stripe += keys(age, [[0, 0], [.65, .30], [1.8, .65], [2.6, .55], [3.1, .25], [6, 0]]);
    pose.eye = keys(age, [[0, 0], [.65, .14], [1.8, .02], [3.1, .02], [6, 0]]);
    pose.targetVisible = age < 2.6;
    if (direction.x < 0) {
      pose.turn = Math.PI * keys(age, [[0, 0], [.65, .30], [1.8, 1], [4.3, 1], [6, 0]]);
      pose.facing = Math.cos(pose.turn);
    }
  } else {
    const retreat = keys(age, [[0, 0], [.65, -.045], [1.05, -.07], [2.4, 1], [3.1, 1], [5.8, 0]]);
    const attention = keys(age, [[0, 0], [.65, .75], [1.05, 1], [2.4, .65], [5.8, 0]]);
    pose.x -= direction.x * (.055 + .05 * strength) * retreat;
    pose.y -= direction.y * (.035 + .035 * strength) * retreat;
    pose.angle += clamp(-direction.y * .17 + direction.x * .075, -.20, .20) * attention;
    pose.gather = keys(age, [[0, 0], [.65, .78], [1.05, 1], [2.4, .55], [4.4, .12], [5.8, 0]]);
    pose.squeeze = keys(age, [[0, 0], [.65, .36], [1.05, .72], [1.6, .18], [2.4, .06], [5.8, 0]]);
    pose.stripe += keys(age, [[0, 0], [.65, .45], [1.05, .88], [2.4, .58], [4.4, .10], [5.8, 0]]);
    pose.eye = keys(age, [[0, 0], [.65, .48], [1.05, .60], [2.4, .22], [5.8, 0]]);
    pose.ink = keys(age, [[0, 0], [1.05, 0], [1.32, 1], [1.85, .82], [2.4, .5], [3.7, 0], [5.8, 0]]) * strength;
    if (direction.x < 0) {
      pose.turn = Math.PI * keys(age, [[0, 0], [.65, 1], [3.1, 1], [5.8, 0]]);
      pose.facing = Math.cos(pose.turn);
    }
  }
  return pose;
}

/** A frozen, detached review snapshot; it is not a cross-version restore API. */
export function getPuppetState(state) {
  assertState(state);
  const action = state.action ? Object.freeze({
    kind: state.action.kind, startTick: state.action.startTick,
    duration: PUPPET_DURATIONS[state.action.kind], strength: state.action.strength,
    target: Object.freeze({ ...state.action.target }),
    origin: Object.freeze({ ...state.action.origin }),
    direction: Object.freeze({ ...state.action.direction })
  }) : null;
  return Object.freeze({ version: PUPPET_MODEL_VERSION, tickRate: PUPPET_TICK_RATE,
    seed: state.seed, tick: state.tick, phase: samplePuppet(state).phase,
    pointer: state.pointer, point: Object.freeze({ ...state.point }),
    action, cooldownUntil: state.cooldownUntil, sequence: state.sequence });
}
