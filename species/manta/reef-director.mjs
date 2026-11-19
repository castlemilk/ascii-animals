// Manta reef study. Original analytic direction; no DOM, timers or random state.
// The barrel bank is authored motion, not a claim to reproduce feeding somersaults.
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const smooth = (a, b, n) => { const u = clamp((n - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const unit = value => { const length = Math.hypot(...value); return value.map(n => n / length); };
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

export const REEF_DEFAULTS = Object.freeze({ current: .45, duration: 32, habitat: true });
export const REEF_STILLS = Object.freeze(['glide', 'anticipation', 'bank', 'recover']);
export const REEF_RESPONSE_SECONDS = 8.8;

/** Strict study-only options. Existing package configuration is unchanged. */
export function normalizeReefOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Reef options must be an object.');
  for (const key of Object.keys(options)) if (!Object.hasOwn(REEF_DEFAULTS, key)) throw new TypeError(`Unknown reef option: ${key}`);
  const next = { ...REEF_DEFAULTS };
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue;
    if (key === 'habitat') {
      if (typeof value !== 'boolean') throw new TypeError('Reef habitat must be a boolean.');
    } else {
      const range = key === 'current' ? [-1, 1] : [20, 80];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < range[0] || value > range[1]) {
        throw new RangeError(`Reef ${key} must be ${range[0]}..${range[1]}.`);
      }
    }
    next[key] = value;
  }
  return Object.freeze(next);
}

/**
 * Analytic pose for one ordered simulation instant. `time` is the existing
 * artwork's speed-scaled clock; motion affects travel, not the fin phase.
 * `current` can be the adapter's eased current. Response age uses the inherited
 * 8.8-second clock and is independent of playback speed. Extra renders do no work.
 */
export function sampleReefPose(input, options = REEF_DEFAULTS) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('A reef pose needs a sample input.');
  for (const key of Object.keys(input)) if (!['time', 'seed', 'current', 'pointer', 'reactionAge', 'side', 'motion', 'aspect'].includes(key)) {
    throw new TypeError(`Unknown reef sample field: ${key}`);
  }
  if (!Number.isFinite(input.time) || input.time < 0) throw new RangeError('Reef sample time must be finite and nonnegative.');
  for (const [key, low, high] of [['seed', 0, 4294967295], ['current', -1, 1], ['motion', 0, 1], ['aspect', Number.MIN_VALUE, Number.MAX_VALUE]]) {
    const value = input[key];
    if (value !== undefined && (!Number.isFinite(value) || value < low || value > high || (key === 'seed' && !Number.isInteger(value)))) {
      throw new RangeError(`Invalid reef sample ${key}.`);
    }
  }
  if (input.side !== undefined && input.side !== -1 && input.side !== 1) throw new RangeError('Reef side must be -1 or 1.');
  if (input.reactionAge != null && (!Number.isFinite(input.reactionAge) || input.reactionAge < 0)) throw new RangeError('Reaction age must be finite and nonnegative.');
  if (input.pointer !== undefined) {
    if (!input.pointer || typeof input.pointer !== 'object' || Array.isArray(input.pointer)) throw new TypeError('Reef pointer must be an object.');
    for (const key of Object.keys(input.pointer)) {
      if (!['x', 'y', 'interest'].includes(key)) throw new TypeError(`Unknown reef pointer field: ${key}`);
      const value = input.pointer[key], low = key === 'interest' ? 0 : -.5, high = key === 'interest' ? 1 : .5;
      if (value !== undefined && (!Number.isFinite(value) || value < low || value > high)) throw new RangeError(`Invalid reef pointer ${key}.`);
    }
  }
  const config = normalizeReefOptions(options);
  const time = input.time;
  const seed = (finite(input.seed, 0) >>> 0);
  // Seeded phase changes small individual tendencies without shifting chapters.
  const personality = ((Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0) / 4294967296) * TAU;
  const current = clamp(finite(input.current, config.current), -1, 1);
  const motion = clamp(finite(input.motion, 1), 0, 1);
  const aspect = clamp(finite(input.aspect, 1.5), .3, 3);
  const clock = time * motion;
  const cycle = ((clock / config.duration) % 1 + 1) % 1;
  const a = cycle * TAU;
  const pointer = input.pointer || {};
  const interest = clamp(finite(pointer.interest, 0), 0, 1);
  const px = clamp(finite(pointer.x, 0), -.5, .5) * interest;
  const py = clamp(finite(pointer.y, 0), -.5, .5) * interest;
  const travel = (.46 + .36 * clamp(aspect - .65, 0, 1)) * current;
  const catching = (1 + Math.cos(a - .55)) * .5;
  const sailing = (1 - Math.cos(a)) * .5;
  const x = travel * (.86 * Math.sin(a) + .14 * Math.sin(2 * a));
  const y = -.14 + .17 * Math.sin(a) - .045 * Math.sin(2 * a);
  const z = -.66 - .28 * sailing;
  // A bounded route has a return leg. Let its horizontal tangent lead the
  // heading instead of facing down-current while translating the other way.
  // Presentation stays dorsal; this is a shallow turn through moving water,
  // not a full yaw orbit or a biological flow simulation.
  const tangent = current * (.86 * Math.cos(a) + .28 * Math.cos(2 * a));
  const baseTurn = .43 * Math.tanh(2.4 * tangent) + .045 * Math.sin(a + personality) + px * .48;
  const baseBank = (-.23 * current * Math.sin(a) + .07 * Math.sin(a + personality) + px * .24) * motion;
  const position = [x + px * .25 * motion, y + py * .12 * motion, z];
  let heading = baseTurn;
  let pitch = .14 - py * .10;
  let bank = baseBank;
  let wingEnergy = .64 + .28 * catching;
  let turn = baseTurn;
  let lobeOpen = .06 + .07 * catching;
  let dihedral = .04 + .12 * sailing;
  let stage = cycle < .16 ? 'anticipation' : cycle < .67 ? 'glide' : 'recover';
  let phase = stage === 'anticipation' ? 'Reading the current' : stage === 'glide' ? 'Gliding along the reef' : 'Settling into open water';
  let sequence = 'current-glide', progress = cycle;
  const side = input.side === -1 ? -1 : 1;
  const age = input.reactionAge == null ? null : Math.max(0, finite(input.reactionAge, REEF_RESPONSE_SECONDS));
  const active = age !== null && age < REEF_RESPONSE_SECONDS;

  if (active) {
    // The leading wing loads first. Roll and travel then build together, with
    // more than half the response reserved for a slow, continuous unroll.
    const anticipation = smooth(0, .42, age) * (1 - smooth(.42, .8, age));
    const commit = smooth(.8, 2.6, age);
    const release = 1 - smooth(3, REEF_RESPONSE_SECONDS, age);
    const roll = commit * release * motion;
    const settle = smooth(3, 5.2, age) * (1 - smooth(5.2, REEF_RESPONSE_SECONDS, age));
    bank = baseBank * (1 - .9 * roll) + side * (1.12 * roll - .115 * anticipation * motion);
    heading += side * .23 * roll;
    pitch += .09 * roll;
    position[0] += side * .28 * roll;
    position[1] -= .13 * roll;
    position[2] -= .27 * roll;
    wingEnergy += .21 * anticipation - .22 * roll + .14 * settle;
    turn += side * .32 * roll;
    lobeOpen += .13 * anticipation + .09 * roll;
    dihedral += .17 * roll - .05 * anticipation;
    stage = age < .8 ? 'anticipation' : age < 3 ? 'bank' : 'recover';
    phase = stage === 'anticipation' ? 'Loading the near wing' : stage === 'bank' ? 'Banking over the reef' : 'Unrolling into the current';
    sequence = 'barrel-bank'; progress = age / REEF_RESPONSE_SECONDS;
  }

  return {
    position,
    forward: unit([Math.sin(heading) * Math.cos(pitch), -Math.cos(heading) * Math.cos(pitch), Math.sin(pitch)]),
    reference: [0, 0, 1], bank, wingEnergy, turn: clamp(turn, -.75, .75),
    lobeOpen: clamp(lobeOpen, 0, 1), dihedral, time, phase, stage, sequence,
    progress, current, reactionAge: active ? age : null, side
  };
}
