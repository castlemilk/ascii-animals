import test from 'node:test';
import assert from 'node:assert/strict';
import { createMovementDirector, normalizeMovementOptions, sampleMovement, MOVEMENT_DEFAULTS, MOVEMENT_TICK_RATE } from '../lib/public/movement.js';

const viewport = { width: 900, height: 600 };
const options = { enabled: true, seed: 17, count: 3, lanes: 3, timing: { mode: 'duration', seconds: 10 }, lingerSeconds: 2, staggerSeconds: .5, silhouetteRadius: 45, edgePadding: 20, cast: ['cuttlefish', 'manta', 'octopus'] };
const positions = snapshot => snapshot.members.map(({ id, x, y }) => ({ id, x, y }));
function near(actual, expected, tolerance = 1e-9) { assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`); }
function finite(snapshot) {
  for (const member of snapshot.members) {
    assert([member.x, member.y, member.heading, member.progress, member.tangent.x, member.tangent.y].every(Number.isFinite));
    assert(member.progress >= 0 && member.progress <= 1);
    near(Math.hypot(member.tangent.x, member.tangent.y), 1);
  }
}
function outside(member, size = viewport) {
  assert(member.x + member.radius <= 1e-8 || member.x - member.radius >= size.width - 1e-8
    || member.y + member.radius <= 1e-8 || member.y - member.radius >= size.height - 1e-8,
  `Silhouette ${member.id} must be entirely beyond an edge: ${JSON.stringify(member)}`);
}

test('SSR-safe pure module preserves natural defaults and returns independent frozen snapshots', () => {
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(MOVEMENT_TICK_RATE, 60);
  assert.equal(MOVEMENT_DEFAULTS.enabled, false);
  const input = { ...options, cast: [...options.cast], timing: { ...options.timing } };
  const director = createMovementDirector(input, viewport), config = director.getOptions(), before = director.sample();
  input.cast[0] = 'neutral'; input.timing.seconds = 300;
  assert.equal(config.cast[0], 'cuttlefish'); assert.equal(config.timing.seconds, 10);
  for (const value of [config, config.cast, config.timing, before, before.members, before.members[0], before.members[0].tangent]) assert(Object.isFrozen(value));
  director.advanceTicks(120); assert.equal(before.tick, 0); assert.equal(before.playheadTicks, 0);
  assert.equal(createMovementDirector({}, viewport).sample().members[0].visible, false);
});

test('all path/direction pairs enter and fully leave actual viewport bounds with complete cast clearance', () => {
  for (const path of ['horizontal', 'vertical', 'diagonal', 'free']) for (const direction of ['forward', 'reverse']) {
    const director = createMovementDirector({ ...options, path, direction, repeat: false }, viewport);
    const first = director.sample(); first.members.forEach(member => { outside(member); assert.equal(member.visible, false); });
    for (let i = 0; i < director.getState().durationTicks; i += 13) { director.seek(i); finite(director.sample()); }
    const total = director.getState().durationTicks;
    director.seek(total); const last = director.sample();
    assert.equal(last.complete, true);
    last.members.forEach(member => { outside(member); assert.equal(member.visible, false); assert.equal(member.phase, 'complete'); });
    director.advanceTicks(600); assert.deepEqual(positions(director.sample()), positions(last));
  }
});

test('zero padding still starts and ends wholly offscreen, including diagonal and tiny viewports', () => {
  for (const size of [viewport, { width: 1, height: 1 }, { width: 19, height: 2000 }]) for (const path of ['horizontal', 'vertical', 'diagonal', 'free']) {
    const director = createMovementDirector({ ...options, path, edgePadding: 0, repeat: false }, size);
    director.sample().members.forEach(member => { outside(member, size); assert.equal(member.visible, false); });
    director.seek(director.getState().durationTicks);
    director.sample().members.forEach(member => outside(member, size));
  }
});

test('repeat seam occurs only after every staggered actor has exited; no in-frame wrapping', () => {
  const director = createMovementDirector(options, viewport), total = director.getState().durationTicks;
  assert.equal(total, 780, '600 travel + 120 linger + last member at tick 60');
  director.seek(total - 1); const previous = director.sample();
  previous.members.forEach(member => { outside(member); assert.equal(member.visible, false); });
  director.advanceTicks(1); const next = director.sample();
  assert.equal(next.cycle, 1); next.members.forEach(member => { outside(member); assert.equal(member.visible, false); });
  assert.deepEqual(positions(next), positions(createMovementDirector(options, viewport).sample()));
});

test('lanes and cast stagger are independent of travel direction and species profile', () => {
  const director = createMovementDirector({ ...options, profile: 'neutral', cast: [], lingerSeconds: 0, staggerSeconds: 1 }, viewport);
  const initial = director.sample();
  assert.deepEqual(initial.members.map(member => member.lane), [0, 1, 2]);
  assert.deepEqual(initial.members.map(member => member.startTick), [0, 60, 120]);
  assert.equal(new Set(initial.members.map(member => member.y)).size, 3);
  for (const [id, expectedY] of [140, 300, 460].entries()) near(initial.members[id].y, expectedY);
  const vertical = createMovementDirector({ ...options, path: 'vertical', profile: 'neutral', cast: [] }, viewport).sample();
  for (const [id, expectedX] of [210, 450, 690].entries()) near(vertical.members[id].x, expectedX);
  director.seek(61); const running = director.sample();
  assert(running.members[0].progress > running.members[1].progress);
  assert.equal(running.members[2].phase, 'waiting');
  const singleton = createMovementDirector({ enabled: true, count: 1, lanes: 3 }, viewport).sample().members[0];
  assert.equal(singleton.lane, 1); near(singleton.y, viewport.height / 2);
});

test('linger is a real stationary interval between traversal halves and can be omitted', () => {
  const director = createMovementDirector({ ...options, count: 1, lingerSeconds: 2 }, viewport);
  director.seek(300); const beginning = director.sample().members[0];
  director.advanceTicks(90); const during = director.sample().members[0];
  assert.equal(beginning.phase, 'linger'); assert.equal(during.phase, 'linger');
  assert.deepEqual([during.x, during.y, during.progress], [beginning.x, beginning.y, beginning.progress]);
  director.seek(421); assert(director.sample().members[0].progress > .5);
  const without = createMovementDirector({ ...options, count: 1, lingerSeconds: 0 }, viewport);
  without.seek(300); assert.notEqual(without.sample().members[0].phase, 'linger');
});

test('duration excludes linger/stagger, speed uses bounded CSS path length and responsive timing', () => {
  const speed = { enabled: true, profile: 'neutral', count: 1, silhouetteRadius: 30, edgePadding: 20, timing: { mode: 'speed', pixelsPerSecond: 100 }, repeat: false };
  const director = createMovementDirector(speed, viewport);
  assert.equal(director.getState().durationTicks, 600, '(900 + 2 * 50)px / 100px/s');
  director.seek(60); near(director.sample().members[0].x, 50);
  director.advanceTicks(60); near(director.sample().members[0].x, 150);
  const fraction = director.getState().playheadTicks / director.getState().durationTicks;
  director.resize({ width: 1900, height: 600 });
  assert.equal(director.getState().durationTicks, 1200);
  near(director.getState().playheadTicks / director.getState().durationTicks, fraction);
  director.advanceTicks(60); near(director.sample().members[0].x, 450);
});

test('seeded free routes and stylized marine profiles vary reproducibly without ambient randomness', () => {
  const run = seed => sampleMovement({ ...options, seed, path: 'free' }, viewport, 210);
  assert.deepEqual(run(17), run(17)); assert.notDeepEqual(positions(run(17)), positions(run(18)));
  const states = ['neutral', 'cuttlefish', 'manta', 'octopus'].map(profile => sampleMovement({ ...options, count: 1, profile, cast: [], path: 'horizontal' }, viewport, 140));
  assert.equal(new Set(states.map(state => JSON.stringify(positions(state)))).size, 4);
  const oldRandom = Math.random;
  try { Math.random = () => { throw new Error('Ambient randomness forbidden'); }; assert.deepEqual(run(17), run(17)); }
  finally { Math.random = oldRandom; }
});

test('tick grouping and repeated static sampling do not affect deterministic state', () => {
  const one = createMovementDirector({ ...options, path: 'free' }, viewport);
  const batch = createMovementDirector({ ...options, path: 'free' }, viewport);
  for (let i = 0; i < 1500; i++) { one.advanceTicks(1); if (i % 17 === 0) one.sample(); }
  for (let i = 0; i < 300; i++) batch.advanceTicks(5);
  assert.deepEqual(one.sample(), batch.sample());
  const before = one.sample(); for (let i = 0; i < 50; i++) assert.deepEqual(one.sample(), before);
  assert.deepEqual(sampleMovement({ ...options, path: 'free' }, viewport, 1500), before);
});

test('live reverse preserves positions immediately and retraces the exact sampled path', () => {
  for (const path of ['horizontal', 'vertical', 'diagonal', 'free']) {
    const director = createMovementDirector({ ...options, path }, viewport);
    director.seek(213); const earlier = director.sample();
    director.advanceTicks(67); const before = director.sample();
    director.reverse(); const reversed = director.sample();
    assert.deepEqual(positions(reversed), positions(before));
    for (let id = 0; id < before.members.length; id++) {
      near(reversed.members[id].tangent.x, -before.members[id].tangent.x);
      near(reversed.members[id].tangent.y, -before.members[id].tangent.y);
    }
    director.advanceTicks(67); assert.deepEqual(positions(director.sample()), positions(earlier));
    director.reverse(); director.advanceTicks(67); assert.deepEqual(positions(director.sample()), positions(before));
  }
});

test('route direction swaps endpoints, live reversal traverses the loop seam only offscreen', () => {
  const a = createMovementDirector({ ...options, count: 1, cast: [], profile: 'neutral', repeat: false }, viewport);
  const b = createMovementDirector({ ...options, count: 1, cast: [], profile: 'neutral', direction: 'reverse', repeat: false }, viewport);
  assert(a.sample().members[0].x < 0); assert(b.sample().members[0].x > viewport.width);
  a.seek(a.getState().durationTicks); a.reverse(); a.advanceTicks(30);
  assert.equal(a.sample().complete, false); assert.equal(a.sample().members[0].phase, 'enter');
  a.advanceTicks(1000); assert.equal(a.sample().complete, true); outside(a.sample().members[0]);
  const loop = createMovementDirector(options, viewport); loop.reverse(); loop.advanceTicks(1);
  assert.equal(loop.sample().cycle, -1); loop.sample().members.forEach(member => outside(member));
});

test('resize and configuration preserve normalized cast clock and do not resume anything', () => {
  const director = createMovementDirector(options, viewport); director.seek(177); director.reverse();
  const before = director.getState(), fraction = before.playheadTicks / before.durationTicks;
  director.resize({ width: 390, height: 700 });
  assert.equal(director.getState().tick, before.tick); assert.equal(director.getState().playbackDirection, -1);
  near(director.getState().playheadTicks / director.getState().durationTicks, fraction);
  director.configure({ timing: { mode: 'speed', pixelsPerSecond: 70 } });
  near(director.getState().playheadTicks / director.getState().durationTicks, fraction);
  const still = director.sample(); director.resize({ width: 390, height: 700 }); assert.deepEqual(director.sample(), still);
  director.resize({ width: 0, height: 0 }); const zero = director.sample(); finite(zero);
  assert.equal(zero.available, false); zero.members.forEach(member => assert.equal(member.visible, false));
  assert.equal(director.getState().tick, before.tick);
  director.resize(viewport); finite(director.sample());
});

test('invalid configuration and inputs are rejected atomically before unbounded allocation', () => {
  const invalid = [null, [], {wat: 1}, {enabled: 1}, {repeat: 'yes'}, {seed: -1}, {seed: .1}, {seed: 4294967296},
    {count: 0}, {count: 13}, {count: 1.5}, {count: Infinity}, {lanes: 0}, {lanes: 13}, {path: 'circle'}, {direction: 'backwards'}, {diagonalSlope: 'sideways'},
    {timing: {mode: 'duration', seconds: NaN}}, {timing: {mode: 'duration', seconds: 0}}, {timing: {mode: 'duration', seconds: 10, pixelsPerSecond: 1}},
    {timing: {mode: 'speed', pixelsPerSecond: Infinity}}, {timing: {mode: 'speed', pixelsPerSecond: 0}}, {timing: {mode: 'speed'}}, {timing: {}}, {timing: null},
    {staggerSeconds: -1}, {lingerSeconds: -1}, {edgePadding: Infinity}, {silhouetteRadius: 8193}, {profile: 'fox'}, {cast: new Array(2)}, {cast: ['fox']}, {cast: Array(13).fill('neutral')}];
  const director = createMovementDirector(options, viewport); director.seek(200); const before = director.sample(), config = director.getOptions();
  for (const input of invalid) {
    assert.throws(() => normalizeMovementOptions(input)); assert.throws(() => director.configure(input));
    assert.deepEqual(director.sample(), before); assert.equal(director.getOptions(), config);
  }
  for (const size of [null, {}, {width: -1,height: 1}, {width: 1,height: NaN}, {width: 32769,height: 1}, {width:1,height:1,dpr:2}]) {
    assert.throws(() => director.resize(size)); assert.deepEqual(director.sample(), before);
  }
  for (const amount of [-1, .5, NaN, Infinity, 216001, '1']) { assert.throws(() => director.advanceTicks(amount)); assert.deepEqual(director.sample(), before); }
  for (const amount of [-1, .5, NaN, Infinity, 1_000_000_001]) { assert.throws(() => director.seek(amount)); assert.deepEqual(director.sample(), before); }
});

test('two instances are independent; disposal is idempotent and later mutations are inert', () => {
  const first = createMovementDirector(options, viewport), other = createMovementDirector(options, viewport);
  first.advanceTicks(180); const untouched = other.sample(); first.dispose(); first.dispose();
  const ended = first.sample(); assert.equal(ended.disposed, true);
  first.advanceTicks(NaN); first.configure(null); first.resize(null); first.seek(-1); first.reverse(); first.reset();
  assert.deepEqual(first.sample(), ended); assert.deepEqual(other.sample(), untouched);
  other.advanceTicks(1); assert.equal(other.sample().tick, 1);
});

test('reset retains exact configuration and restarts seeded route deterministically', () => {
  const director = createMovementDirector(options, viewport), initial = director.sample();
  director.advanceTicks(100); director.reverse(); director.reset();
  assert.deepEqual(director.sample(), initial); assert.deepEqual(director.getOptions(), normalizeMovementOptions(options));
});


test('large conservative silhouettes retain lane centers; all four diagonal headings exist', () => {
  const spread = createMovementDirector({ ...options, silhouetteRadius: 1000 }, viewport).sample();
  assert.equal(new Set(spread.members.map(member => member.y)).size, 3);
  const midpoint = sampleMovement({ ...options, silhouetteRadius: 1000, lingerSeconds: 0, staggerSeconds: 0 }, viewport, 300);
  midpoint.members.forEach(member => assert.equal(member.phase, 'traverse', 'phase classifies center even with a conservative large radius'));
  const headings = [];
  for (const diagonalSlope of ['down', 'up']) for (const direction of ['forward', 'reverse']) {
    const member = sampleMovement({ ...options, count: 1, profile: 'neutral', cast: [], path: 'diagonal', diagonalSlope, direction }, viewport, 200).members[0];
    headings.push(Math.sign(member.tangent.x) + ',' + Math.sign(member.tangent.y));
  }
  assert.equal(new Set(headings).size, 4);
});

test('fractional resize anchors remain reproducible across different advance batching', () => {
  const config = { ...options, path: 'free', timing: { mode: 'speed', pixelsPerSecond: 73 } };
  const a = createMovementDirector(config, viewport), b = createMovementDirector(config, viewport);
  for (const director of [a, b]) { director.seek(127); director.resize({ width: 413, height: 719 }); director.reverse(); }
  for (let tick = 0; tick < 500; tick++) a.advanceTicks(1);
  b.advanceTicks(500);
  assert.deepEqual(a.sample(), b.sample());
});
