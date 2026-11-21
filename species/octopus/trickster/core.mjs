/**
 * Pocket Trickster v1 — pure, tick-driven octopus choreography.
 * Original cartoon construction; no DOM, rendering, clocks or ambient randomness.
 * Coordinates are world-space: x grows right, y grows down. Eight elastic arms
 * are intentional cartoon curves, not a biomechanical skeleton.
 */
export const TICK_RATE = 60;
export const SPECIES_VERSION = 'pocket-trickster-1';
export const MAX_EVENTS_PER_TICK = 64;

const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mix = (a, b, u) => a + (b - a) * u;
const ease = (a, b, n) => {
  const u = clamp((n - a) / (b - a), 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const pointMix = (a, b, u) => [mix(a[0], b[0], u), mix(a[1], b[1], u)];
const hash = seed => {
  let n = seed >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

// Root, two cubic control pairs, and their shared knot/end. The unequal poses
// give each arm a silhouette channel rather than eight copies of a sine wave.
const ARM_PATHS = [
  [[-.28, .075], [-.49, .09], [-.83, -.03], [-.76, -.23], [-.70, -.40], [-.49, -.33], [-.61, -.17]],
  [[-.27, .12], [-.48, .23], [-.88, .19], [-.91, .39], [-.96, .63], [-.67, .65], [-.68, .46]],
  [[-.19, .145], [-.32, .30], [-.62, .45], [-.57, .62], [-.52, .79], [-.29, .72], [-.34, .56]],
  [[-.085, .15], [-.13, .31], [-.29, .54], [-.17, .65], [-.06, .76], [.015, .61], [-.10, .56]],
  [[.075, .15], [.13, .30], [.25, .44], [.19, .60], [.13, .76], [.39, .75], [.37, .59]],
  [[.19, .145], [.36, .28], [.57, .43], [.49, .61], [.41, .77], [.74, .75], [.69, .54]],
  [[.27, .12], [.49, .23], [.86, .18], [.91, .35], [.99, .56], [.70, .60], [.71, .42]],
  [[.28, .075], [.49, .055], [.77, -.04], [.70, -.24], [.63, -.42], [.45, -.28], [.57, -.15]],
];
const ARM_RADII = [.062, .078, .072, .069, .068, .073, .080, .064];
const POINTS_PER_HALF = 16;

function cubic(a, b, c, d, u) {
  const v = 1 - u, aa = v * v * v, bb = 3 * v * v * u;
  const cc = 3 * v * u * u, dd = u * u * u;
  return [a[0] * aa + b[0] * bb + c[0] * cc + d[0] * dd,
    a[1] * aa + b[1] * bb + c[1] * cc + d[1] * dd];
}

function curve(path) {
  const points = [];
  for (let i = 0; i <= POINTS_PER_HALF; i++) points.push(cubic(...path.slice(0, 4), i / POINTS_PER_HALF));
  for (let i = 1; i <= POINTS_PER_HALF; i++) points.push(cubic(...path.slice(3, 7), i / POINTS_PER_HALF));
  return points;
}

function transform(point, body) {
  const x = point[0] * body.scaleX, y = point[1] * body.scaleY;
  const c = Math.cos(body.tilt), s = Math.sin(body.tilt);
  return [body.x + x * c - y * s, body.y + x * s + y * c];
}

function armFrom(points, k) {
  return { points, radius: ARM_RADII[k], tip: [...points[points.length - 1]],
    // Back arms first, three quiet feet, then the two tactile arms.
    layer: k === 0 || k === 7 ? 0 : k === 1 || k === 6 ? 2 : 1 };
}

function idleBody(state) {
  const t = state.tick / TICK_RATE, phase = state.phase;
  const breath = Math.sin(t * 1.18 + phase) - Math.sin(phase);
  return { x: .009 * Math.sin(t * .52), y: .007 * Math.sin(t * 1.18),
    scaleX: 1 + breath * .012, scaleY: 1 - breath * .008,
    tilt: .023 * Math.sin(t * .56 + phase) };
}

function neutralArms(state, body) {
  const t = state.tick / TICK_RATE;
  return ARM_PATHS.map((path, k) => {
    const points = curve(path).map((p, i) => {
      const u = i / (POINTS_PER_HALF * 2);
      const tip = ease(.55, 1, u);
      const sway = Math.sin(t * (.73 + k * .016) + state.phase + k * 1.71);
      return transform([p[0] + .017 * sway * tip, p[1] + .013 * Math.cos(t * .81 + k * 1.1 + state.phase) * tip], body);
    });
    return armFrom(points, k);
  });
}

function mixBody(a, b, u) {
  return { x: mix(a.x, b.x, u), y: mix(a.y, b.y, u),
    scaleX: mix(a.scaleX, b.scaleX, u), scaleY: mix(a.scaleY, b.scaleY, u),
    tilt: mix(a.tilt, b.tilt, u) };
}

function blendArms(a, b, u, body) {
  return a.map((arm, k) => {
    const amount = typeof u === 'function' ? u(k) : u;
    const points = arm.points.map((p, i) => pointMix(p, b[k].points[i], amount));
    points[0] = transform(ARM_PATHS[k][0], body);
    return armFrom(points, k);
  });
}

function coiledArm(body, k) {
  const side = k < 4 ? -1 : 1, root = ARM_PATHS[k][0];
  const rank = k < 4 ? k : 7 - k;
  const y = .17 + rank * .072;
  const outer = .35 + (rank % 2) * .08;
  const local = [root, [side * .27, y - .06], [side * outer, y - .13], [side * outer, y + .04],
    [side * outer, y + .19], [side * .17, y + .19], [side * .22, y + .045]];
  return armFrom(curve(local).map(p => transform(p, body)), k);
}

function targetArm(body, k, target) {
  const side = k < 4 ? -1 : 1;
  const root = transform(ARM_PATHS[k][0], body);
  const distance = Math.hypot(target.x - root[0], target.y - root[1]);
  const bow = Math.min(.18, distance * .26);
  const middle = [mix(root[0], target.x, .52), mix(root[1], target.y, .52) + bow];
  const path = [root, [root[0] + side * .19, root[1] + .12],
    [middle[0] - side * .12, middle[1] + .04], middle,
    [middle[0] + side * .13, middle[1] - .025],
    [target.x - side * .08, target.y + .09], [target.x, target.y]];
  return armFrom(curve(path), k);
}

function stageFor(action, tick) {
  if (!action) return 'idle';
  const age = (tick - action.startTick) / TICK_RATE;
  if (action.kind === 'release') return age < 1.2 ? 'recoil' : 'idle';
  if (action.kind === 'reach') return age < .5 ? 'notice' : age < 1.5 ? 'reach'
    : age < 2.2 ? 'contact' : age < 3.6 ? 'recoil' : 'idle';
  return age < .45 ? 'gather' : age < 1.25 ? 'hide'
    : age < 2.65 ? 'peek' : age < 4.6 ? 'settle' : 'idle';
}

function checkSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed must be an unsigned 32-bit integer');
  return seed;
}

export function createOctopusState(seed = 17) {
  checkSeed(seed);
  return { version: SPECIES_VERSION, seed, phase: hash(seed) * TAU, tick: 0,
    stage: 'idle', aim: { x: .76, y: .35 }, cueActive: false, action: null,
    target: { x: .76, y: .35 }, acceptedActions: 0, ignoredEvents: 0, completedActions: 0 };
}

export function resetOctopus(state) {
  const fresh = createOctopusState(state.seed);
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, fresh);
  return state;
}

function normalizeEvents(events) {
  if (!Array.isArray(events) || events.length > MAX_EVENTS_PER_TICK) throw new RangeError('events must be an array of at most 64 events');
  return events.map(event => {
    if (!event || typeof event !== 'object' || !['invite', 'move', 'release', 'startle'].includes(event.type)) {
      throw new TypeError('unknown octopus event');
    }
    for (const axis of ['x', 'y']) if (event[axis] !== undefined && !Number.isFinite(event[axis])) {
      throw new TypeError('event coordinates must be finite numbers');
    }
    if (event.type === 'move' && (event.x === undefined || event.y === undefined)) throw new TypeError('move requires x and y');
    return { type: event.type, x: event.x === undefined ? undefined : clamp(event.x, -.9, .9),
      y: event.y === undefined ? undefined : clamp(event.y, -.65, .7) };
  });
}

/**
 * Apply one ordered event batch, then advance exactly one tick. Every event is
 * validated before state changes. Busy invitations are ignored, not queued.
 * Startle interrupts reach/recoil, and cannot restart an existing ink sequence.
 * The last move in a batch controls gaze; a reach freezes its explicit contact.
 */
export function stepOctopus(state, events = []) {
  if (!state || state.version !== SPECIES_VERSION || !Number.isSafeInteger(state.tick) || state.tick < 0
    || state.tick >= Number.MAX_SAFE_INTEGER) throw new TypeError('invalid octopus state');
  const normalized = normalizeEvents(events);
  for (const event of normalized) {
    const target = { x: event.x ?? state.aim.x, y: event.y ?? state.aim.y };
    if (event.type === 'move') { state.aim = target; continue; }
    if (event.type === 'release') {
      state.cueActive = false;
      if (state.action?.kind === 'reach') {
        const origin = sampleOctopus(state);
        state.action = { kind: 'release', startTick: state.tick, origin,
          target: { ...state.action.target }, arm: state.action.arm };
      }
      continue;
    }
    if (event.type === 'startle') {
      if (state.action?.kind === 'ink') { state.ignoredEvents++; continue; }
      const origin = sampleOctopus(state);
      state.aim = target; state.target = target; state.cueActive = false;
      state.action = { kind: 'ink', startTick: state.tick, origin, target,
        side: target.x < 0 ? -1 : 1 };
      state.acceptedActions++;
      continue;
    }
    if (state.action) { state.ignoredEvents++; continue; }
    const origin = sampleOctopus(state);
    state.aim = target; state.target = target; state.cueActive = true;
    state.action = { kind: 'reach', startTick: state.tick, origin, target,
      arm: target.x < 0 ? 1 : 6 };
    state.acceptedActions++;
  }
  state.tick++;
  state.stage = stageFor(state.action, state.tick);
  if (state.action && state.stage === 'idle') { state.action = null; state.completedActions++; }
  return state;
}

/** No mutation: rendering once, five times or never cannot alter a sequence. */
export function sampleOctopus(state) {
  const age = state.action ? (state.tick - state.action.startTick) / TICK_RATE : 0;
  const action = state.action;
  const idle = idleBody(state);
  let body = { ...idle };
  let arms = neutralArms(state, body);
  const stage = stageFor(action, state.tick);
  const target = action?.target ?? state.aim;
  const gaze = { x: clamp(target.x / .9, -1, 1), y: clamp((target.y + .15) / .85, -1, 1) };
  const blinkTick = (state.tick + Math.floor(hash(state.seed + 73) * 230)) % 311;
  const blink = blinkTick >= 294 ? Math.sin((blinkTick - 294) / 17 * Math.PI) ** 2 : 0;
  let eyes = { left: .76 * (1 - blink), right: .96 * (1 - blink) };
  const contact = { active: false, arm: action?.arm ?? -1, x: target.x, y: target.y };
  const ink = { amount: 0, peek: 0, side: action?.side ?? (target.x < 0 ? -1 : 1), conceal: 0,
    center: { x: 0, y: .015 } };

  if (action?.kind === 'reach') {
    const side = action.arm < 4 ? -1 : 1;
    const reach = ease(.5, 1.5, age) * (1 - ease(2.2, 3.6, age));
    const notice = ease(0, .5, age) * (1 - ease(.5, 1.3, age));
    body.x += side * (.065 * reach - .025 * notice);
    body.y += .025 * notice - .018 * reach;
    body.tilt += side * (.08 * reach - .04 * notice);
    body.scaleX += .035 * notice - .015 * reach;
    body.scaleY -= .035 * notice;
    arms = neutralArms(state, body);
    const k = action.arm, coiled = coiledArm(body, k), stretched = targetArm(body, k, action.target);
    const points = arms[k].points.map((p, i) => pointMix(pointMix(p, coiled.points[i], notice * .75), stretched.points[i], reach));
    arms[k] = armFrom(points, k);
    contact.active = stage === 'contact';
    // At contact the endpoint is the actual invitation, not an approximate cue.
    if (contact.active) {
      arms[k].points[arms[k].points.length - 1] = [action.target.x, action.target.y];
      arms[k].tip = [action.target.x, action.target.y];
    }
    const attentive = ease(0, .34, age) * (1 - ease(2.2, 3.4, age));
    eyes = { left: mix(eyes.left, side < 0 ? 1 : .74, attentive),
      right: mix(eyes.right, side > 0 ? 1 : .74, attentive) };
    if (age < .18) {
      const q = ease(0, .18, age);
      body = mixBody(action.origin.body, body, q);
      arms = blendArms(action.origin.arms, arms, q, body);
    }
  } else if (action?.kind === 'release') {
    const q = ease(0, 1.2, age);
    body = mixBody(action.origin.body, idle, q);
    body.x += (action.arm < 4 ? 1 : -1) * .028 * Math.sin(clamp(age / 1.2, 0, 1) * Math.PI) ** 2;
    arms = blendArms(action.origin.arms, neutralArms(state, idle), q, body);
    eyes = { left: mix(action.origin.eyes.left, eyes.left, q), right: mix(action.origin.eyes.right, eyes.right, q) };
  } else if (action?.kind === 'ink') {
    const gather = ease(0, .45, age), settle = ease(2.65, 4.6, age);
    const peek = ease(1.25, 1.65, age) * (1 - ease(2.65, 3.15, age));
    const tucked = { x: idle.x + action.side * .18 * peek, y: idle.y + .065,
      scaleX: 1.10, scaleY: .78, tilt: action.side * (.08 + .09 * peek) };
    const gathered = mixBody(action.origin.body, tucked, gather);
    body = mixBody(gathered, idle, settle);
    const coils = ARM_PATHS.map((_, k) => coiledArm(body, k));
    const beginning = blendArms(action.origin.arms, coils, gather, body);
    arms = blendArms(beginning, neutralArms(state, idle), k => ease(2.65 + k * .04, 4.3 + k * .04, age), body);
    // The raised outer arm provides a recognizable peek gesture even without
    // the overlay eye. The renderer can draw the isolated eye above the ink.
    const peekingArm = action.side < 0 ? 0 : 7;
    const p = arms[peekingArm].points;
    for (let i = 1; i < p.length; i++) {
      const u = i / (p.length - 1);
      p[i][0] += action.side * .16 * peek * ease(.15, .8, u);
      p[i][1] -= .12 * peek * ease(.15, .8, u);
    }
    arms[peekingArm].tip = [...p[p.length - 1]];
    const alarm = ease(0, .16, age) * (1 - ease(.32, .55, age));
    eyes = { left: mix(eyes.left, 1, alarm), right: mix(eyes.right, 1, alarm) };
    ink.amount = ease(.25, .72, age) * (1 - ease(2.65, 4.2, age));
    ink.conceal = ease(.42, .72, age) * (1 - ease(2.75, 3.75, age));
    ink.peek = peek;
  }

  // Keep eye position/shape data independent of any glyph renderer. `peekEye`
  // describes the optional single revealed eye at the edge of the ink screen.
  ink.peekEye = { x: ink.side * .49, y: -.19, open: .80 };
  return { version: SPECIES_VERSION, seed: state.seed, tick: state.tick, stage,
    body, gaze, eyes, arms,
    target: { x: target.x, y: target.y, active: state.cueActive && action?.kind !== 'ink' },
    contact, ink, armCount: 8, actionAge: age,
    anticipated: stage === 'notice' || stage === 'gather' };
}
