import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  FROG_DEFAULTS, FROG_LIMITS, clearFrogTarget, configureFrog, createFrog,
  landingTarget, normalizeFrogPointer, poseFrog, previewFrogTarget,
  resetFrog, stampFrogAction, stepFrog,
} from '../generated/frog.mjs';

const EPS = 1e-12;
const near = (actual, expected, label = '') => assert(Math.abs(actual - expected) <= EPS, `${label}: ${actual} != ${expected}`);
const ready = state => state.behavior.kind === 'idle' || state.behavior.kind === 'interest';

function advance(state, ticks) {
  for (let i = 0; i < ticks; i++) state = stepFrog(state, state.tick + 1).state;
  return state;
}

function replay(grouping, seed = 23, targetX = .65) {
  const events = [
    { type: 'target', x: targetX, y: .05, tick: 1, seq: 0 },
    { type: 'leap', tick: 12, seq: 1 },
    { type: 'leap', tick: 16, seq: 2 },
    { type: 'leave', tick: 24, seq: 3 },
    { type: 'target', x: -.6, y: .5, tick: 150, seq: 4 },
    { type: 'leap', tick: 162, seq: 5 },
  ];
  let state = createFrog({ seed }), ignored = 0;
  const checkpoints = [];
  for (let frame = 0; frame < 300; frame += grouping) {
    for (let substep = 0; substep < grouping && state.tick < 300; substep++) {
      const tick = state.tick + 1;
      const result = stepFrog(state, tick, events.filter(event => event.tick === tick));
      state = result.state; ignored += result.ignoredLeaps;
      if ([12, 26, 47, 68, 122, 162, 300].includes(tick)) checkpoints.push(state);
    }
    const before = JSON.stringify(state);
    poseFrog(state);
    poseFrog(state, { motion: false });
    assert.equal(JSON.stringify(state), before, 'presentation sampling must not mutate species state');
  }
  return { state, checkpoints, pose: poseFrog(state), ignored };
}

test('documented defaults, ownership, seed limits and independent option objects', () => {
  const options = { seed: 23, config: { size: .9 } };
  const state = createFrog(options);
  assert.deepEqual(FROG_DEFAULTS, {
    size: 1, jumpHeight: .85, maxDistance: 1.2, crouchTicks: 14, flightTicks: 42,
    landingTicks: 12, recoveryTicks: 24, cooldownTicks: 18, throatAmplitude: .06,
  });
  assert.equal(FROG_LIMITS.tickRate, 60);
  assert.equal(FROG_LIMITS.eventsPerTick, 8);
  assert.equal(state.species, 'frog'); assert.equal(state.version, 1);
  assert.equal(state.tick, 0); assert.equal(state.lastSeq, -1);
  assert.deepEqual(state.position, { x: -.55, y: .5 });
  assert.deepEqual(state.behavior, { kind: 'idle' }); assert.equal(state.target, null);
  assert.equal(state.jumps, 0);
  for (const object of [FROG_DEFAULTS, state, state.config, state.position, state.behavior]) assert(Object.isFrozen(object));
  options.seed = 44; options.config.size = 1.15;
  assert.equal(state.seed, 23); assert.equal(state.config.size, .9);
  assert.equal(createFrog().config.size, 1, 'one instance must not alter defaults for the next');
  assert.equal(createFrog({ seed: 0 }).seed, 0);
  assert.equal(createFrog({ seed: 0xffffffff }).seed, 0xffffffff);
  for (const seed of [-1, 0x100000000, .5, NaN, Infinity, '23', null]) {
    assert.throws(() => createFrog({ seed }), undefined, `reject seed ${String(seed)}`);
  }
  for (const value of [null, [], 'frog', { speed: 1 }]) assert.throws(() => createFrog(value));
});

test('configuration accepts declared endpoints, rejects invalid fields atomically and never mutates the base', () => {
  const limits = {
    size: [.75, 1.15], jumpHeight: [.45, 1.1], maxDistance: [.2, 1.5],
    crouchTicks: [6, 60], flightTicks: [24, 90], landingTicks: [6, 36],
    recoveryTicks: [6, 120], cooldownTicks: [1, 120], throatAmplitude: [0, .08],
  };
  const original = JSON.stringify(FROG_DEFAULTS);
  for (const [key, [min, max]] of Object.entries(limits)) {
    assert.equal(configureFrog({ [key]: min })[key], min);
    assert.equal(configureFrog({ [key]: max })[key], max);
    for (const value of [min - .01, max + .01, NaN, Infinity, -Infinity, null, '1']) {
      assert.throws(() => configureFrog({ [key]: value }), undefined, `${key} rejects ${String(value)}`);
    }
    if (key.endsWith('Ticks')) assert.throws(() => configureFrog({ [key]: min + .5 }));
  }
  for (const patch of [null, [], { speed: 1 }, { maxDistance: 1, flightTicks: NaN }]) assert.throws(() => configureFrog(patch));
  assert.equal(JSON.stringify(FROG_DEFAULTS), original);
  const first = configureFrog({ size: .8, flightTicks: 24 });
  const next = configureFrog({ size: 1.1 }, first);
  assert.equal(first.size, .8); assert.equal(next.size, 1.1); assert.equal(next.flightTicks, 24);
  assert(Object.isFrozen(next));
});

test('fixed replay is independent of 1/2/5-tick presentation grouping; changed input changes the trajectory', () => {
  const baseline = replay(1);
  assert.deepEqual(replay(2), baseline);
  assert.deepEqual(replay(5), baseline);
  assert.deepEqual(replay(1), baseline);
  assert.equal(baseline.state.jumps, 2); assert.equal(baseline.ignored, 1);
  assert.notDeepEqual(replay(5, 23, -.8).checkpoints[2].position, baseline.checkpoints[2].position);
});

test('seed changes stable idle variation without changing deterministic landing or flight timing', () => {
  const a = replay(2, 23), b = replay(2, 24);
  assert.notEqual(a.state.phaseOffset, b.state.phaseOffset);
  assert.notEqual(a.pose.throat, b.pose.throat);
  assert.deepEqual(a.checkpoints.map(s => [s.tick, s.position, s.behavior.kind]), b.checkpoints.map(s => [s.tick, s.position, s.behavior.kind]));
  assert.deepEqual(replay(5, 24), b);
});

test('pure species imports and updates without browser globals, ambient clocks or randomness', () => {
  const moduleUrl = new URL('../generated/frog.mjs', import.meta.url).href;
  const source = `
    globalThis.Date = class { constructor() { throw new Error('ambient Date'); } static now() { throw new Error('ambient Date.now'); } };
    Math.random = () => { throw new Error('ambient randomness'); };
    Object.defineProperty(globalThis, 'performance', { value: { now() { throw new Error('ambient performance'); } }, configurable: true });
    const { createFrog, stepFrog, poseFrog } = await import(${JSON.stringify(moduleUrl)});
    let state = createFrog({ seed: 23 });
    for (let tick = 1; tick <= 130; tick++) state = stepFrog(state, tick, tick === 1 ? [{ tick, seq: 0, type: 'leap' }] : []).state;
    if (poseFrog(state).throat < 0 || state.jumps !== 1) throw new Error('bad pure replay');
    process.stdout.write('pure import and replay passed');
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, 'pure import and replay passed');
});

test('an invalid event anywhere in a batch cannot partly update state, target or sequence', () => {
  const state = previewFrogTarget(createFrog(), { x: .2, y: -.2 });
  const before = JSON.stringify(state);
  const valid = Object.freeze({ type: 'target', x: .5, y: .4, tick: 1, seq: 0 });
  const invalid = [
    { type: 'target', x: NaN, y: 0, tick: 1, seq: 1 },
    { type: 'target', x: 1.0001, y: 0, tick: 1, seq: 1 },
    { type: 'target', x: 0, y: -1.0001, tick: 1, seq: 1 },
    { type: 'target', x: '0', y: 0, tick: 1, seq: 1 },
    { type: 'leap', tick: 1, seq: 0 },
    { type: 'leap', tick: 2, seq: 1 },
    { type: 'leap', tick: 1, seq: .5 },
    { type: 'leap', tick: 1, seq: Infinity },
    { type: 'leap', tick: 1, seq: 1, x: 0 },
    { type: 'explode', tick: 1, seq: 1 },
    null,
  ];
  for (const invalidEvent of invalid) {
    const batch = Object.freeze([valid, invalidEvent]);
    assert.throws(() => stepFrog(state, 1, batch));
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.lastSeq, -1);
  }
  const accepted = stepFrog(state, 1, [valid]).state;
  assert.deepEqual(accepted.target, { x: .5, y: .4 });
  assert.equal(accepted.lastSeq, 0); assert.equal(JSON.stringify(state), before);
  assert.throws(() => stepFrog(accepted, 2, [{ type: 'leave', tick: 2, seq: 0 }]));
});

test('ticks are explicit next integers and input work has a hard eight-event ceiling', () => {
  const state = createFrog();
  for (const tick of [0, -1, 2, 1.5, NaN, Infinity, 2147483648, '1']) assert.throws(() => stepFrog(state, tick));
  const batch = Array.from({ length: 8 }, (_, seq) => ({ type: 'target', tick: 1, seq, x: seq / 10, y: 0 }));
  const result = stepFrog(state, 1, batch);
  assert.equal(result.state.lastSeq, 7); assert.deepEqual(result.state.target, { x: .7, y: 0 });
  assert.throws(() => stepFrog(state, 1, [...batch, { type: 'leave', tick: 1, seq: 8 }]));
  assert.throws(() => stepFrog(state, 1, null));
  assert.throws(() => stepFrog(state, 1, {}));
  assert.equal(state.tick, 0);
});

test('same-tick ordered targets and leaps latch the first eligible destination; busy triggers never queue', () => {
  const original = createFrog();
  const expected = landingTarget(original, { x: .65, y: .05 });
  const first = stepFrog(original, 1, [
    { type: 'target', x: .65, y: .05, tick: 1, seq: 0 },
    { type: 'leap', tick: 1, seq: 1 },
    { type: 'target', x: -.9, y: -.75, tick: 1, seq: 2 },
    { type: 'leap', tick: 1, seq: 3 },
  ]);
  assert(first.startedLeap); assert.equal(first.ignoredLeaps, 1);
  let state = first.state;
  assert.equal(state.behavior.kind, 'crouch');
  assert.deepEqual(state.behavior.plan.to, expected);
  assert.deepEqual(state.target, { x: -.9, y: -.75 });
  for (const object of [state.behavior.plan, state.behavior.plan.from, state.behavior.plan.to]) assert(Object.isFrozen(object));
  state = stepFrog(state, 2, [{ type: 'leave', tick: 2, seq: 4 }]).state;
  assert.equal(state.target, null); assert.deepEqual(state.behavior.plan.to, expected);
  const duration = Object.entries(state.config).filter(([key]) => key.endsWith('Ticks')).reduce((n, [, value]) => n + value, 0);
  const readyTick = 1 + duration;
  while (state.tick < readyTick - 1) {
    const tick = state.tick + 1;
    const result = stepFrog(state, tick, [{ type: 'leap', tick, seq: state.lastSeq + 1 }]);
    assert.equal(result.startedLeap, false); assert.equal(result.ignoredLeaps, 1);
    state = result.state; assert.equal(state.jumps, 1);
  }
  assert.equal(state.behavior.kind, 'cooldown');
  state = stepFrog(state, readyTick).state;
  assert(ready(state)); assert.equal(state.jumps, 1, 'no buffered leap fires when cooldown ends');
  const next = stepFrog(state, state.tick + 1, [{ type: 'leap', tick: state.tick + 1, seq: state.lastSeq + 1 }]);
  assert(next.startedLeap); assert.equal(next.state.jumps, 2);
});

test('target/leave/leap ordering selects the cleared default; preview-only operations never advance time', () => {
  const initial = createFrog();
  const preview = previewFrogTarget(initial, { x: -.7, y: -.3 });
  assert.equal(preview.tick, initial.tick); assert.equal(preview.lastSeq, initial.lastSeq);
  assert.deepEqual(preview.position, initial.position); assert.equal(preview.jumps, 0);
  assert.equal(preview.behavior.kind, 'interest');
  const cleared = clearFrogTarget(preview);
  assert.deepEqual(cleared, initial);
  const result = stepFrog(initial, 1, [
    { type: 'target', x: -.7, y: -.3, tick: 1, seq: 0 },
    { type: 'leave', tick: 1, seq: 1 },
    { type: 'leap', tick: 1, seq: 2 },
  ]);
  assert.equal(result.state.target, null);
  assert.deepEqual(result.state.behavior.plan.to, landingTarget(initial));
  const busy = previewFrogTarget(result.state, { x: .9, y: -.4 });
  assert.deepEqual(busy.behavior.plan, result.state.behavior.plan);
  assert.equal(busy.tick, result.state.tick);
  assert.throws(() => previewFrogTarget(initial, { x: NaN, y: 0 }));
});

test('legal pad and maximum leap distance bounds hold for every normalized target corner', () => {
  for (const maxDistance of [.2, 1.2, 1.5]) {
    const state = createFrog({ config: { maxDistance } });
    for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) {
      const target = landingTarget(state, { x, y });
      assert(target.x >= -.9 - EPS && target.x <= .9 + EPS);
      assert(target.y >= -.75 - EPS && target.y <= .75 + EPS);
      assert(Math.hypot(target.x - state.position.x, target.y - state.position.y) <= maxDistance + EPS);
    }
  }
  for (const target of [{ x: 2, y: 0 }, { x: 0, y: -2 }, { x: Infinity, y: 0 }, { x: 0, y: NaN }]) {
    assert.throws(() => landingTarget(createFrog(), target));
  }
});

test('regression: a default leap remains bounded after reaching and clearing the right pad edge', () => {
  let state = createFrog({ config: { maxDistance: 1.5 } });
  state = stepFrog(state, 1, [
    { type: 'target', x: .9, y: .5, tick: 1, seq: 0 },
    { type: 'leap', tick: 1, seq: 1 },
  ]).state;
  state = advance(state, 110);
  assert(ready(state)); near(state.position.x, .9);
  state = clearFrogTarget(state);
  const result = stepFrog(state, state.tick + 1, [{ type: 'leap', tick: state.tick + 1, seq: state.lastSeq + 1 }]);
  assert(result.startedLeap); assert.equal(result.state.behavior.kind, 'crouch');
  assert.deepEqual(result.state.behavior.plan.to, { x: .9, y: .5 });
});

test('the default choreography uses the specified durations, bounded ballistic arc, exact landing and complete recovery', () => {
  let state = createFrog();
  state = stepFrog(state, 1, [
    { type: 'target', x: .65, y: -.1, tick: 1, seq: 0 },
    { type: 'leap', tick: 1, seq: 1 },
  ]).state;
  const plan = state.behavior.plan;
  const transitions = [[state.tick, state.behavior.kind]];
  let apex = 0;
  const flightHeights = [];
  for (;;) {
    const pose = poseFrog(state);
    assert(pose.compression >= 0 && pose.compression <= .92 + EPS);
    assert(pose.extension >= 0 && pose.extension <= 1 + EPS);
    const height = .2 + state.position.y * .5 - pose.origin.y;
    assert(height >= -EPS && height <= state.config.jumpHeight + EPS);
    apex = Math.max(apex, height);
    if (state.behavior.kind === 'crouch') assert.deepEqual(state.position, plan.from);
    if (state.behavior.kind === 'flight') {
      const u = state.behavior.age / state.config.flightTicks;
      near(state.position.x, plan.from.x + (plan.to.x - plan.from.x) * u, 'horizontal velocity');
      near(state.position.y, plan.from.y + (plan.to.y - plan.from.y) * u, 'ground-depth velocity');
      near(height, 4 * state.config.jumpHeight * u * (1 - u), 'ballistic altitude');
      assert.equal(pose.throat, 0); flightHeights.push(height);
    }
    if (['landing', 'recovery', 'cooldown', 'interest'].includes(state.behavior.kind)) assert.deepEqual(state.position, plan.to);
    if (state.tick === 111) break;
    const previous = state.behavior.kind;
    state = stepFrog(state, state.tick + 1).state;
    if (state.behavior.kind !== previous) transitions.push([state.tick, state.behavior.kind]);
  }
  assert.deepEqual(transitions, [[1, 'crouch'], [15, 'flight'], [57, 'landing'], [69, 'recovery'], [93, 'cooldown'], [111, 'interest']]);
  near(apex, .85, 'apex');
  const acceleration = -8 * .85 / 42 ** 2;
  for (let i = 1; i < flightHeights.length - 1; i++) near(flightHeights[i - 1] - 2 * flightHeights[i] + flightHeights[i + 1], acceleration, 'constant vertical acceleration');
  assert.equal(state.jumps, 1); near(poseFrog(state).compression, 0);
});

test('idle never leaps; throat motion is bounded and periodic, and disabled motion/static poses do not pulsate or travel', () => {
  const initial = createFrog({ seed: 23 });
  let state = initial, min = Infinity, max = -Infinity;
  const disabled = poseFrog(initial, { motion: false });
  for (let tick = 0; tick <= 480; tick++) {
    if (tick) state = stepFrog(state, tick).state;
    const pose = poseFrog(state);
    min = Math.min(min, pose.throat); max = Math.max(max, pose.throat);
    assert(pose.throat >= 0 && pose.throat <= state.config.throatAmplitude);
    assert.deepEqual(poseFrog(state, { motion: false }), disabled);
    assert.equal(state.behavior.kind, 'idle'); assert.equal(state.jumps, 0);
    assert.deepEqual(state.position, initial.position);
    if (tick === 240 || tick === 480) near(pose.throat, poseFrog(initial).throat, 'throat loop seam');
  }
  assert(max - min > .055, 'motion-enabled throat has a visible but bounded excursion');
  for (const staticPose of ['rest', 'crouch', 'airborne', 'landed']) {
    const poster = poseFrog(initial, { staticPose, motion: false });
    assert.deepEqual(poseFrog(state, { staticPose, motion: false }), poster);
    near(poster.origin.y, .45, 'static pose keeps grounded root');
    assert.equal(poster.throat, 0);
    assert.equal(poster.airborne, staticPose === 'airborne');
  }
  assert.throws(() => poseFrog(initial, { staticPose: 'swimming' }));
});

test('reset clears time, sequence, targets and response while preserving validated seed/config by default', () => {
  let state = createFrog({ seed: 99, config: { size: .9, flightTicks: 30 } });
  state = stepFrog(state, 1, [{ type: 'target', x: .8, y: -.2, tick: 1, seq: 0 }, { type: 'leap', tick: 1, seq: 1 }]).state;
  state = advance(state, 25);
  const before = JSON.stringify(state);
  assert.equal(state.behavior.kind, 'flight');
  assert.deepEqual(resetFrog(state), createFrog({ seed: 99, config: state.config }));
  const reset = resetFrog(state, { seed: 0, config: { jumpHeight: 1 } });
  assert.equal(reset.seed, 0); assert.equal(reset.config.size, .9); assert.equal(reset.config.flightTicks, 30); assert.equal(reset.config.jumpHeight, 1);
  assert.equal(reset.tick, 0); assert.equal(reset.lastSeq, -1); assert.equal(reset.target, null);
  assert.equal(reset.jumps, 0); assert.deepEqual(reset.behavior, { kind: 'idle' });
  for (const options of [{ seed: null }, { seed: NaN }, { seed: -1 }, { config: { flightTicks: 30.5 } }, { paused: false }]) assert.throws(() => resetFrog(state, options));
  assert.equal(JSON.stringify(state), before);
});

test('CSS pointer normalization handles offsets, scaling, out-of-bounds motion and invalid/zero rectangles', () => {
  const rect = { left: 120, top: 40, width: 400, height: 240 };
  assert.deepEqual(normalizeFrogPointer(120, 40, rect), { x: -1, y: -1 });
  assert.deepEqual(normalizeFrogPointer(320, 160, rect), { x: 0, y: 0 });
  assert.deepEqual(normalizeFrogPointer(520, 280, rect), { x: 1, y: 1 });
  assert.deepEqual(normalizeFrogPointer(-10, 1000, rect), { x: -1, y: 1 });
  assert.deepEqual(normalizeFrogPointer(420, 100, rect), normalizeFrogPointer(310, 100, { left: 10, top: 40, width: 400, height: 240 }));
  assert.deepEqual(normalizeFrogPointer(420, 100, rect), normalizeFrogPointer(720, 160, { left: 120, top: 40, width: 800, height: 480 }));
  for (const key of ['left', 'top', 'width', 'height']) {
    for (const value of [NaN, Infinity, '1']) assert.equal(normalizeFrogPointer(320, 160, { ...rect, [key]: value }), null);
  }
  for (const [width, height] of [[0, 240], [400, 0], [-1, 240], [400, -1]]) assert.equal(normalizeFrogPointer(320, 160, { ...rect, width, height }), null);
  assert.equal(normalizeFrogPointer(NaN, 160, rect), null);
  assert.equal(normalizeFrogPointer(320, Infinity, rect), null);
  assert.deepEqual(stampFrogAction({ type: 'target', x: .2, y: -.3 }, 6, 9), { type: 'target', x: .2, y: -.3, tick: 6, seq: 9 });
});
