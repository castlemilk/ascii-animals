// Manta reef study. Original analytic direction; no DOM, timers or random state.
// The barrel bank is authored motion, not a claim to reproduce feeding somersaults.
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const smooth = (a, b, n) => { const u = clamp((n - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const unit = value => { const length = Math.hypot(...value); return value.map(n => n / length); };
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

export const REEF_DEFAULTS = Object.freeze({ current: .45, duration: 32, habitat: true });
export const REEF_STILLS = Object.freeze(['glide', 'anticipation', 'bank', 'recover', 'invite']);
export const REEF_RESPONSE_SECONDS = 8.8;
export const REEF_INVITATION_SECONDS = 6.4;

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
  for (const key of Object.keys(input)) if (!['time', 'seed', 'current', 'pointer', 'reactionAge', 'side', 'motion', 'aspect', 'invitation'].includes(key)) {
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
  if (input.invitation != null) {
    const cue = input.invitation;
    if (typeof cue !== 'object' || Array.isArray(cue)) throw new TypeError('Reef invitation must be an object.');
    for (const key of Object.keys(cue)) if (!['age', 'x', 'y'].includes(key)) throw new TypeError(`Unknown invitation field: ${key}`);
    for (const key of ['x', 'y']) if (!Number.isFinite(cue[key]) || cue[key] < -.5 || cue[key] > .5) {
      throw new RangeError('Invitation coordinates must be finite numbers from -0.5 to 0.5.');
    }
    if (!Number.isFinite(cue.age) || cue.age < 0) throw new RangeError('Invitation age must be finite and nonnegative.');
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
  let wingLoad = baseBank * .45;
  let wingFold = 0;
  let stage = cycle < .16 ? 'anticipation' : cycle < .67 ? 'glide' : 'recover';
  let phase = stage === 'anticipation' ? 'Reading the current' : stage === 'glide' ? 'Gliding along the reef' : 'Settling into open water';
  let sequence = 'current-glide', progress = cycle;
  const side = input.side === -1 ? -1 : 1;
  const age = input.reactionAge == null ? null : Math.max(0, finite(input.reactionAge, REEF_RESPONSE_SECONDS));
  const active = age !== null && age < REEF_RESPONSE_SECONDS;
  const cue = input.invitation;
  // A bank takes precedence when sampling an externally supplied overlapping
  // event log. The adapter accepts at most one response and never queues work.
  const invited = !active && cue != null && cue.age < REEF_INVITATION_SECONDS;

  if (active) {
    // Counter-load before the bank: lean away, then tuck the near wing while
    // the full body rolls to about 68 degrees, retaining a readable disc at
    // phone size. This is an authored barrel BANK, not a biological feeding
    // somersault or a complete 360-degree axial roll.
    const anticipation = smooth(0, .42, age) * (1 - smooth(.42, .9, age));
    const commit = smooth(.9, 2.7, age);
    const release = 1 - smooth(3.2, REEF_RESPONSE_SECONDS, age);
    const roll = commit * release * motion;
    const settle = smooth(3, 5.2, age) * (1 - smooth(5.2, REEF_RESPONSE_SECONDS, age));
    bank = baseBank * (1 - .94 * roll) + side * (1.18 * roll - .28 * anticipation * motion);
    heading += side * (.34 * roll - .13 * anticipation * motion);
    pitch += .12 * roll;
    position[0] += side * (.43 * roll - .075 * anticipation * motion);
    position[1] -= .18 * roll;
    position[2] -= .20 * roll;
    wingEnergy += .21 * anticipation - .22 * roll + .14 * settle;
    turn += side * (.40 * roll - .20 * anticipation * motion);
    lobeOpen += .13 * anticipation + .09 * roll;
    dihedral += .16 * roll - .11 * anticipation * motion;
    wingLoad += side * (.60 * roll - .90 * anticipation * motion);
    wingFold = .34 * roll;
    stage = age < .9 ? 'anticipation' : age < 3.2 ? 'bank' : 'recover';
    phase = stage === 'anticipation' ? 'Leaning away, loading a wing' : stage === 'bank' ? 'Carving a barrel bank' : 'Opening wide into the current';
    sequence = 'barrel-bank'; progress = age / REEF_RESPONSE_SECONDS;
  } else if (invited) {
    const anticipation = smooth(0, .35, cue.age) * (1 - smooth(.55, .9, cue.age));
    const reach = smooth(.65, 2.7, cue.age) * (1 - smooth(3.25, REEF_INVITATION_SECONDS, cue.age)) * motion;
    const arc = Math.sin(Math.PI * smooth(.65, 3.1, cue.age)) * motion;
    // Choose a safe center corridor, so a far-edge invitation cannot clip the
    // entire opposite wing on a phone. The animal arcs TOWARD the input; it is
    // not a cursor follower and does not claim to put its nose on every pixel.
    const targetX = clamp(cue.x * 2.7, -1.15, 1.15);
    const targetY = clamp(cue.y * 2.7 - .12, -1.08, .96);
    const dx = targetX - position[0], dy = targetY - position[1];
    // Choose the loaded wing from the accepted cue, not a changing idle-route
    // delta: a central invitation must not flip sides midway through its arc.
    const direction = cue.x < 0 ? -1 : 1;
    const steering = clamp(Math.atan2(dx, 1.15 + Math.abs(dy)), -.88, .88);
    position[0] += dx * reach - direction * .10 * anticipation * motion;
    position[1] += dy * reach - .13 * arc;
    position[2] += .18 * reach;
    heading += (steering - heading) * .92 * reach - direction * .19 * anticipation * motion;
    pitch += -.10 * cue.y * reach;
    // Keep the outward tip slightly banked at arrival. Opening fully only as
    // the center returns prevents far-corner invitations clipping a phone edge.
    bank = baseBank * (1 - .75 * reach) + direction * (.42 * arc + .18 * reach - .20 * anticipation * motion);
    turn += direction * (.36 * arc - .24 * anticipation * motion);
    wingEnergy += .22 * anticipation - .19 * reach;
    wingLoad += direction * (.52 * arc - .75 * anticipation * motion);
    wingFold = .12 * arc;
    dihedral += .12 * reach - .08 * anticipation * motion;
    lobeOpen += .28 * reach + .06 * anticipation;
    stage = cue.age < .65 ? 'anticipation' : cue.age < 3.25 ? 'glide' : 'recover';
    phase = stage === 'anticipation' ? 'Noticing your invitation' : stage === 'glide' ? 'Sweeping toward your invitation' : 'Floating back to a broad glide';
    sequence = 'glide-invitation'; progress = cue.age / REEF_INVITATION_SECONDS;
  }

  return {
    position,
    forward: unit([Math.sin(heading) * Math.cos(pitch), -Math.cos(heading) * Math.cos(pitch), Math.sin(pitch)]),
    reference: [0, 0, 1], bank, wingEnergy, turn: clamp(turn, -.75, .75),
    lobeOpen: clamp(lobeOpen, 0, 1), dihedral,
    wingLoad: clamp(wingLoad, -1, 1), wingFold: clamp(wingFold, 0, 1),
    time, phase, stage, sequence, progress, current,
    reactionAge: active ? age : null,
    invitationAge: invited ? cue.age : null,
    invitationTarget: invited ? { x: cue.x, y: cue.y } : null, side
  };
}
