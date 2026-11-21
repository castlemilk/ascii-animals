import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { TICK_RATE, createOctopusState, stepOctopus, sampleOctopus, resetOctopus } from '../core.mjs';

const advance = (state, ticks) => { for (let i = 0; i < ticks; i++) stepOctopus(state); return state; };
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const maxArmDelta = (a, b) => Math.max(...a.arms.flatMap((arm, k) => arm.points.map((p, i) => distance(p, b.arms[k].points[i]))));

test('SSR-safe imports, explicit integer seed, eight bounded attached original curves', async () => {
  assert.equal(TICK_RATE, 60);
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof globalThis.document, 'undefined');
  for (const invalid of [NaN, Infinity, -1, 1.2, '17', 4294967296]) assert.throws(() => createOctopusState(invalid));
  for (const seed of [0, 7, 17, 4294967295]) {
    const state = createOctopusState(seed);
    for (let tick = 0; tick < 300; tick++) {
      const pose = sampleOctopus(state);
      assert.equal(pose.arms.length, 8);
      for (const arm of pose.arms) {
        assert.equal(arm.points.length, 33);
        assert.deepEqual(arm.tip, arm.points.at(-1));
        for (const p of arm.points) assert(p.every(Number.isFinite));
        assert(Math.hypot(arm.points[0][0] - pose.body.x, arm.points[0][1] - pose.body.y) < .34);
        assert(arm.points.every(p => Math.abs(p[0]) < 1.1 && p[1] > -.85 && p[1] < .85));
      }
      stepOctopus(state);
    }
  }
});

test('invalid batches fail atomically and coordinate clamping is explicit', () => {
  const state = createOctopusState();
  const before = structuredClone(state);
  const bad = [null, {}, { type: 'explode' }, { type: 'invite', x: NaN }, { type: 'move', x: 0 }, { type: 'invite', y: '0.2' }];
  for (const event of bad) {
    assert.throws(() => stepOctopus(state, [{ type: 'move', x: .3, y: .2 }, event]));
    assert.deepEqual(state, before);
  }
  assert.throws(() => stepOctopus(state, Array.from({ length: 65 }, () => ({ type: 'release' }))));
  assert.deepEqual(state, before);
  stepOctopus(state, [{ type: 'move', x: 100, y: -100 }]);
  assert.deepEqual(state.aim, { x: .9, y: -.65 });
});

test('invitation side and position choose distinct arms and exact visible contact', () => {
  for (const target of [{ x: -.78, y: .34 }, { x: .75, y: .28 }, { x: .87, y: -.35 }]) {
    const state = createOctopusState();
    stepOctopus(state, [{ type: 'invite', ...target }]);
    assert.equal(state.stage, 'notice');
    advance(state, 30);
    assert.equal(state.stage, 'reach');
    advance(state, 60);
    const pose = sampleOctopus(state);
    assert.equal(pose.stage, 'contact');
    assert(pose.contact.active);
    assert.equal(pose.contact.arm, target.x < 0 ? 1 : 6);
    assert.deepEqual(pose.arms[pose.contact.arm].tip, [target.x, target.y]);
    assert.deepEqual({ x: pose.target.x, y: pose.target.y }, target);
    advance(state, 60);
    assert.equal(state.stage, 'recoil');
    advance(state, 65);
    assert.equal(state.stage, 'idle');
    assert.equal(state.completedActions, 1);
  }
});

test('pointer motion changes gaze while an in-progress invitation retains its contact', () => {
  const state = createOctopusState();
  stepOctopus(state, [{ type: 'invite', x: .75, y: .28 }]);
  advance(state, 95);
  stepOctopus(state, [{ type: 'move', x: -.85, y: .4 }]);
  const pose = sampleOctopus(state);
  assert.deepEqual(state.aim, { x: -.85, y: .4 });
  assert.deepEqual(pose.arms[6].tip, [.75, .28]);
  advance(state, 150);
  assert(sampleOctopus(state).gaze.x < 0);
});

test('release recoils from the current shape without a first-tick teleport', () => {
  const state = createOctopusState();
  stepOctopus(state, [{ type: 'invite', x: .86, y: -.40 }]);
  advance(state, 96);
  const before = sampleOctopus(state);
  stepOctopus(state, [{ type: 'release' }]);
  const after = sampleOctopus(state);
  assert.equal(after.stage, 'recoil');
  assert.equal(after.target.active, false);
  assert(maxArmDelta(before, after) < .01, 'release has a bounded .01 world-unit first-tick displacement');
  advance(state, 72);
  assert.equal(state.stage, 'idle');
  assert(!sampleOctopus(state).contact.active);
});

test('ink has anticipation, full concealment, directional peek and quiet recovery', () => {
  for (const x of [-.8, .8]) {
    const state = createOctopusState();
    stepOctopus(state, [{ type: 'startle', x, y: .2 }]);
    assert.equal(state.stage, 'gather');
    assert.equal(sampleOctopus(state).ink.amount, 0);
    advance(state, 55);
    let pose = sampleOctopus(state);
    assert.equal(pose.stage, 'hide');
    assert.equal(pose.ink.amount, 1);
    assert.equal(pose.ink.conceal, 1);
    assert.equal(pose.ink.peek, 0);
    advance(state, 55);
    pose = sampleOctopus(state);
    assert.equal(pose.stage, 'peek');
    assert.equal(pose.ink.peek, 1);
    assert.equal(pose.ink.side, Math.sign(x));
    assert.equal(Math.sign(pose.ink.peekEye.x), Math.sign(x));
    advance(state, 70);
    assert.equal(state.stage, 'settle');
    advance(state, 96);
    pose = sampleOctopus(state);
    assert.equal(state.stage, 'idle');
    assert.equal(pose.ink.amount, 0);
    assert.equal(pose.ink.peek, 0);
  }
});

test('startle interrupts contact continuously, repeated busy input never grows a queue', () => {
  const state = createOctopusState();
  stepOctopus(state, [{ type: 'invite', x: -.82, y: .45 }]);
  advance(state, 95);
  const before = sampleOctopus(state);
  stepOctopus(state, [{ type: 'startle', x: -.8, y: .3 }]);
  assert.equal(state.stage, 'gather');
  assert(maxArmDelta(before, sampleOctopus(state)) < .01);
  const started = state.action.startTick;
  for (let i = 0; i < 100; i++) stepOctopus(state, [{ type: 'startle' }, { type: 'invite', x: .8, y: .4 }]);
  assert.equal(state.action.startTick, started);
  assert.equal(state.acceptedActions, 2);
  assert.equal(state.ignoredEvents, 200);
  assert(!Object.hasOwn(state, 'queue'));
});

test('same tick/event log is deterministic with 1, 2 or 5 presentation render groupings', () => {
  const log = new Map([[20, [{ type: 'invite', x: -.74, y: .38 }]], [150, [{ type: 'release' }]],
    [245, [{ type: 'startle', x: .7, y: .4 }]], [330, [{ type: 'startle' }]],
    [560, [{ type: 'invite', x: .82, y: -.25 }]]]);
  const replay = group => {
    const state = createOctopusState(17);
    for (let tick = 0; tick < 820; tick++) {
      stepOctopus(state, log.get(tick) || []);
      if (tick % group === 0) {
        const before = digest(state);
        for (let draw = 0; draw < 5; draw++) sampleOctopus(state);
        assert.equal(digest(state), before);
      }
    }
    return digest([state, sampleOctopus(state)]);
  };
  assert.equal(replay(1), replay(2));
  assert.equal(replay(1), replay(5));
});

test('restart restores the same seed/poster and different seeds vary quiet poses', () => {
  const state = createOctopusState(17), initial = digest([state, sampleOctopus(state)]);
  stepOctopus(state, [{ type: 'startle', x: -.8, y: .3 }]);
  advance(state, 129);
  assert.equal(resetOctopus(state), state);
  assert.equal(digest([state, sampleOctopus(state)]), initial);
  assert.notEqual(digest(sampleOctopus(createOctopusState(7))), digest(sampleOctopus(createOctopusState(17))));
});

test('every sequence emits finite, bounded geometry through edge targets', () => {
  for (const target of [{ x: -.9, y: -.65 }, { x: .9, y: .7 }]) {
    for (const type of ['invite', 'startle']) {
      const state = createOctopusState(17);
      for (let tick = 0; tick < 280; tick++) {
        stepOctopus(state, tick === 0 ? [{ type, ...target }] : []);
        const pose = sampleOctopus(state);
        for (const arm of pose.arms) {
          for (const p of arm.points) {
            assert(p.every(Number.isFinite));
            assert(Math.abs(p[0]) <= 1.2 && p[1] >= -.85 && p[1] <= .9);
          }
          assert(distance(arm.points[0], [pose.body.x, pose.body.y]) < .4);
        }
      }
    }
  }
});
