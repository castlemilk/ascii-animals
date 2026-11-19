/**
 * Cuttlefish study choreography. Pure, fixed-tick and independent of Canvas/DOM.
 * The reviewed animal supplies its anatomy, fin undulation and ink simulation.
 * This module only authors modest whole-body poses and one explicit jet cue.
 */

const HZ = 60;
const TAU = Math.PI * 2;
const BRAND = Symbol('cuttlefish-study-state');
const DURATIONS = Object.freeze({ investigate: 414, turn: 306, retreat: 630 });
const ACTIONS = new Set(Object.keys(DURATIONS));
const BASE_YAW = Math.atan2(.38, .92);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const finite = value => typeof value === 'number' && Number.isFinite(value);

function dataObject(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every(key => typeof key === 'string' && allowed.includes(key)
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
}

function seedKey(value) {
  let result = 2166136261;
  for (const character of String(value)) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

function randomAt(key, salt) {
  let value = (key ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x21f0aaad);
  value = Math.imul(value ^ value >>> 15, 0x735a2d97);
  return ((value ^ value >>> 15) >>> 0) / 4294967296;
}

function assertState(state) {
  if (!state || state[BRAND] !== true) throw new TypeError('Expected a cuttlefish study state');
}

// Quintic interpolation has zero first and second derivatives at every key.
// Added to a continuously moving idle pose, it preserves C1 joins and recovery.
function keys(age, points) {
  if (age <= points[0][0]) return points[0][1];
  for (let index = 1; index < points.length; index++) {
    const [end, value] = points[index], [start, previous] = points[index - 1];
    if (age <= end) {
      const u = (age - start) / (end - start);
      const eased = u * u * u * (10 + u * (-15 + 6 * u));
      return previous + (value - previous) * eased;
    }
  }
  return points[points.length - 1][1];
}

function phaseAt(action, ticks) {
  if (!action) return 'hover';
  const age = (ticks - action.startTick) / HZ;
  if (action.kind === 'investigate') return age < .6 ? 'anticipation'
    : age < 2.3 ? 'approach' : age < 4.1 ? 'hold' : 'recovery';
  if (action.kind === 'turn') return age < .55 ? 'anticipation'
    : age < 2 ? 'turn' : age < 2.8 ? 'hold' : 'recovery';
  return age < .45 ? 'anticipation' : age < .9 ? 'turn'
    : age < 1.84 ? 'ink' : age < 4.15 ? 'jet' : 'recovery';
}

function begin(state, kind, target, source) {
  state.action = { kind, startTick: state.tick, target: target.slice(), source, jetFired: false };
  state.dwellTicks = 0;
  if (kind === 'investigate') state.lastInvestigated = target.slice();
  const quietTicks = 900 + Math.floor(randomAt(state.key, state.sequence + 71) * 421);
  // Automatic starts are 15–22 s apart; an explicit cue receives a full quiet
  // interval after its recovery so autonomous direction cannot immediately cut in.
  state.nextAutomaticTick = state.tick + quietTicks + (source === 'automatic' ? 0 : DURATIONS[kind]);
  state.sequence++;
}

/** Create an independent mutable simulation state. No wall clock or random global. */
export function createStudyState(seed = 0, options = {}) {
  if (!finite(seed)) throw new TypeError('Study seed must be a finite number');
  if (!dataObject(options, ['automatic'])
    || (Object.hasOwn(options, 'automatic') && typeof options.automatic !== 'boolean')) {
    throw new TypeError('Study options accept only a boolean automatic field');
  }
  return {
    [BRAND]: true,
    seed, key: seedKey(seed), tick: 0,
    automatic: options.automatic ?? true,
    action: null, target: [.24, -.06],
    pointer: false, dwellTarget: [.24, -.06], dwellTicks: 0,
    lastInvestigated: [0, 0], nextAutomaticTick: 300,
    automaticIndex: 0, sequence: 0
  };
}

/**
 * +x points right and +y down, matching the marine renderer's screen convention.
 * Pointer events only coalesce the next target; an active sequence never retargets.
 * Actions are finite and non-interruptible, including retreat. Invalid/conflicting
 * requests return false without any state mutation.
 */
export function cueStudy(state, input) {
  assertState(state);
  if (!dataObject(input, ['type', 'x', 'y']) || typeof input.type !== 'string') return false;
  const { type } = input;
  if (type !== 'pointer' && type !== 'release' && !ACTIONS.has(type)) return false;
  const hasX = Object.hasOwn(input, 'x'), hasY = Object.hasOwn(input, 'y');
  if (type === 'release' && (hasX || hasY)) return false;
  if (type === 'pointer' && (!hasX || !hasY)) return false;
  if ((hasX && (!finite(input.x) || Math.abs(input.x) > .5))
    || (hasY && (!finite(input.y) || Math.abs(input.y) > .5))) return false;
  if (ACTIONS.has(type) && state.action) return false;
  const target = [hasX ? input.x : state.target[0], hasY ? input.y : state.target[1]];
  if (type === 'release') {
    state.pointer = false; state.dwellTicks = 0;
    return true;
  }
  if (type === 'pointer') {
    state.target = target; state.pointer = true;
    if (Math.hypot(target[0] - state.dwellTarget[0], target[1] - state.dwellTarget[1]) > .025) {
      state.dwellTarget = target.slice(); state.dwellTicks = 0;
    }
    return true;
  }
  state.target = target;
  begin(state, type, target, 'manual');
  return true;
}

/** Advance exactly one 1/60 s simulation tick. The caller owns pause and catch-up. */
export function stepStudy(state) {
  assertState(state);
  if (!Number.isSafeInteger(state.tick) || state.tick >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Study tick exceeds the exact integer simulation range');
  }
  state.tick++;
  let jet = false;
  if (state.action) {
    const action = state.action, elapsed = state.tick - action.startTick;
    if (action.kind === 'retreat' && elapsed === 54 && !action.jetFired) {
      action.jetFired = true; jet = true;
    }
    if (elapsed >= DURATIONS[action.kind]) state.action = null;
  } else {
    if (state.pointer) {
      state.dwellTicks++;
      if (state.dwellTicks >= 36 && Math.hypot(state.target[0] - state.lastInvestigated[0],
        state.target[1] - state.lastInvestigated[1]) >= .08) {
        begin(state, 'investigate', state.target, 'dwell');
      }
    }
    if (!state.action && state.automatic && state.tick >= state.nextAutomaticTick) {
      const index = state.automaticIndex++;
      const kind = index % 2 ? 'turn' : 'investigate';
      const direction = randomAt(state.key, index + 201) < .5 ? -1 : 1;
      const target = [direction * (.18 + randomAt(state.key, index + 403) * .16),
        (randomAt(state.key, index + 605) - .5) * .28];
      begin(state, kind, target, 'automatic');
    }
  }
  return { jet };
}

function station(id, count, width, height) {
  if (count === 1) return [0, -.15, -.85];
  const portrait = width / height < .85;
  const viewHeight = height / Math.min(width / 9.8, height / 6.8);
  if (portrait && count <= 3) {
    const step = clamp(viewHeight * .29, 3.5, 6.1);
    return [count === 2 ? (id ? .45 : -.45) : [-.35, .55, -.30][id],
      (id - (count - 1) / 2) * (count === 2 ? step * 1.2 : step) - .15, -.9 - id * .08];
  }
  if (count === 2) return [id ? 2.65 : -2.65, -.6, -.95 - id * .08];
  if (count === 3) return [[-2.65, -.6, -.95], [2.55, 1.05, -1.03], [2.55, -1.75, -1.11]][id].slice();
  const columns = portrait ? 2 : Math.min(4, Math.ceil(Math.sqrt(count * 1.3)));
  const rows = Math.ceil(count / columns), row = Math.floor(id / columns), column = id % columns;
  const used = Math.min(columns, count - row * columns);
  const xStep = portrait ? 5 : columns === 2 ? 5.2 : columns === 3 ? 3.2 : 2.5;
  const yRange = portrait ? clamp(viewHeight * .3, 3.6, 6.2) : rows > 2 ? 2.15 : 1.6;
  return [(column - (used - 1) / 2) * xStep,
    (row - (rows - 1) / 2) * (2 * yRange / Math.max(1, rows - 1)) - .15, -.95 - row * .15];
}

function idleAt(time, phase, anchor) {
  return {
    position: [anchor[0] + .055 * Math.sin(time * .37 + phase),
      anchor[1] + .035 * Math.sin(time * .51 + phase * .7),
      anchor[2] + .025 * Math.sin(time * .29 + phase * 1.3)],
    yaw: BASE_YAW + .025 * Math.sin(time * .27 + phase),
    pitch: -.025 + .012 * Math.sin(time * .33 + phase * .8),
    bank: .018 * Math.sin(time * .43 + phase * .6)
  };
}

/** Side-effect-free pose sampling; repeating a sample cannot advance the sequence. */
export function sampleStudy(state, member = {}, viewport = {}) {
  assertState(state);
  if (!member || typeof member !== 'object' || !viewport || typeof viewport !== 'object') {
    throw new TypeError('Study member and viewport must be objects');
  }
  const { id = 0, seed = 0, count = 1 } = member;
  const { width = 900, height = 620 } = viewport;
  if (!Number.isInteger(count) || count < 1 || count > 12
    || !Number.isInteger(id) || id < 0 || id >= count || !finite(seed)) {
    throw new RangeError('Study member needs finite seed and integer 0 <= id < count <= 12');
  }
  if (!finite(width) || !finite(height) || width <= 0 || height <= 0) {
    throw new RangeError('Study viewport dimensions must be finite and positive');
  }
  const anchor = station(id, count, width, height);
  const phaseSeed = randomAt(state.key ^ seedKey(seed), id + 19) * TAU;
  const time = state.tick / HZ, pose = idleAt(time, phaseSeed, anchor);
  const action = state.action;
  let alert = 0, progress = 0;
  if (action) {
    const age = (state.tick - action.startTick) / HZ;
    progress = clamp((state.tick - action.startTick) / DURATIONS[action.kind], 0, 1);
    const target = action.target, direction = target[0] < 0 ? -1 : 1;
    // Large casts use smaller movement envelopes while retaining their stations.
    const reach = count > 3 ? .6 : count > 1 ? .8 : 1;
    if (action.kind === 'investigate') {
      const approach = keys(age, [[0, 0], [.6, -.06], [2.3, 1], [4.1, 1], [6.9, 0]]);
      const attention = keys(age, [[0, 0], [.6, .45], [1.7, 1], [3.6, 1], [6.9, 0]]);
      pose.position[0] += target[0] * .98 * approach * reach;
      pose.position[1] += target[1] * .54 * approach * reach;
      pose.position[2] += .12 * approach * reach;
      pose.yaw -= target[0] * .45 * attention;
      pose.pitch += target[1] * .11 * attention;
      pose.bank += target[0] * .075 * attention;
      alert = keys(age, [[0, 0], [.6, .22], [2.3, .12], [4.1, .08], [6.9, 0]]);
    } else if (action.kind === 'turn') {
      const turn = keys(age, [[0, 0], [.55, .035], [2, 1], [2.8, 1], [5.1, 0]]);
      const startYaw = idleAt(action.startTick / HZ, phaseSeed, anchor).yaw;
      pose.yaw += (direction * 145 * Math.PI / 180 - startYaw) * turn;
      const shift = keys(age, [[0, 0], [.55, -.04], [2, .12], [2.8, .12], [5.1, 0]]);
      pose.position[0] += direction * shift * reach;
      pose.position[2] += .08 * turn * reach;
      pose.bank += direction * .075 * keys(age, [[0, 0], [.55, .25], [1.4, 1], [2.8, 0], [5.1, 0]]);
      alert = keys(age, [[0, 0], [.55, .18], [2, .1], [2.8, .06], [5.1, 0]]);
    } else {
      // The inherited reaction owns all escape translation and particles. This
      // small pre-turn is its launch posture and its moving recovery destination.
      const ready = keys(age, [[0, 0], [.45, .3], [.9, 1], [4.15, 1], [10.5, 0]]);
      pose.yaw += direction * .5 * ready;
      pose.position[0] -= direction * .06 * ready * reach;
      pose.position[1] -= .02 * ready * reach;
      pose.position[2] -= .035 * ready * reach;
      pose.bank += direction * .045 * keys(age, [[0, 0], [.65, 1], [1.84, 0], [10.5, 0]]);
      alert = keys(age, [[0, 0], [.9, .7], [1.24, 1], [1.84, .8], [4.15, .3], [9.7, 0], [10.5, 0]]);
    }
  }
  const horizontal = Math.cos(pose.pitch);
  return {
    position: pose.position,
    forward: [Math.cos(pose.yaw) * horizontal, Math.sin(pose.pitch), Math.sin(pose.yaw) * horizontal],
    bank: pose.bank, anchor, phase: phaseAt(action, state.tick), progress, alert
  };
}

/** A deep-frozen copy for UI/recording; no caller-owned arrays escape from state. */
export function getStudyState(state) {
  assertState(state);
  const action = state.action;
  const snapshot = {
    seed: state.seed, tick: state.tick, time: state.tick / HZ, automatic: state.automatic,
    action: action ? Object.freeze({ kind: action.kind, startTick: action.startTick,
      age: (state.tick - action.startTick) / HZ, duration: DURATIONS[action.kind] / HZ,
      target: Object.freeze(action.target.slice()), source: action.source, jetFired: action.jetFired }) : null,
    phase: phaseAt(action, state.tick),
    progress: action ? clamp((state.tick - action.startTick) / DURATIONS[action.kind], 0, 1) : 0,
    target: Object.freeze(state.target.slice()), pointer: state.pointer, dwellTicks: state.dwellTicks,
    nextAutomaticTick: state.nextAutomaticTick
  };
  return Object.freeze(snapshot);
}
