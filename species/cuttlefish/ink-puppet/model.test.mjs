import test from 'node:test';
import assert from 'node:assert/strict';
import { createPuppetState, cuePuppet, stepPuppet, samplePuppet, getPuppetState,
  PUPPET_DURATIONS } from './model.mjs';

const poseAt = (kind, seconds, target = { x: .3, y: -.15 }, seed = 7) => {
  const state = createPuppetState(seed);
  assert.equal(cuePuppet(state, { type: kind, ...target }), true);
  stepPuppet(state, Math.round(seconds * 60));
  return { pose: samplePuppet(state), state };
};

test('exact same input ticks replay through 1, 2 and 5-tick presentation groups', () => {
  const events = [
    [0, { type: 'point', x: .32, y: -.15 }],
    [30, { type: 'investigate' }],
    [90, { type: 'point', x: -.32, y: .2 }],
    [430, { type: 'retreat' }],
    [500, { type: 'leave' }]
  ];
  function replay(group) {
    const state = createPuppetState(20261121), checks = [];
    let nextEvent = 0;
    while (state.tick < 840) {
      while (events[nextEvent]?.[0] === state.tick) cuePuppet(state, events[nextEvent++][1]);
      const count = Math.min(group, 840 - state.tick,
        (events[nextEvent]?.[0] ?? 840) - state.tick);
      stepPuppet(state, count);
      // Every group meets these same checkpoints; extra sampling is harmless.
      if (state.tick % 30 === 0) checks.push(samplePuppet(state));
      samplePuppet(state);
    }
    return { state: getPuppetState(state), checks };
  }
  assert.deepEqual(replay(1), replay(2));
  assert.deepEqual(replay(1), replay(5));
});

test('investigate makes a distinct gather, approach, reach and settled return', () => {
  const phases = [[.3, 'anticipation'], [1.2, 'approach'], [2.2, 'reach'],
    [2.8, 'hold'], [3.6, 'retract'], [5, 'settle']];
  for (const [time, phase] of phases) assert.equal(poseAt('investigate', time).pose.phase, phase);
  const gathered = poseAt('investigate', .65).pose, reached = poseAt('investigate', 2.3).pose;
  assert.ok(gathered.gather > .7 && gathered.reach === 0);
  assert.ok(reached.reach > .98 && reached.gather < .2);
  assert.equal(poseAt('investigate', 2.6).pose.targetVisible, false);
  const end = poseAt('investigate', 6).pose, control = createPuppetState(7);
  stepPuppet(control, 360);
  assert.deepEqual(end, samplePuppet(control));
});

test('target position materially changes investigation position and angle', () => {
  const left = poseAt('investigate', 2.2, { x: -.4, y: -.32 }).pose;
  const right = poseAt('investigate', 2.2, { x: .4, y: .32 }).pose;
  assert.ok(right.x - left.x > .14);
  assert.ok(right.y - left.y > .06);
  assert.ok(right.angle - left.angle > .12);
  assert.notDeepEqual(left.target, right.target);
});

test('soft jet anticipates before ink and retreats away from the chosen threat', () => {
  const right = poseAt('retreat', 2.4, { x: .4, y: -.03 }).pose;
  const left = poseAt('retreat', 2.4, { x: -.4, y: -.03 }).pose;
  const baseline = createPuppetState(7); stepPuppet(baseline, 144);
  const idle = samplePuppet(baseline);
  assert.ok(right.x < idle.x - .055 && left.x > idle.x + .055);
  const early = poseAt('retreat', .7).pose, launch = poseAt('retreat', 1.32).pose;
  assert.equal(early.phase, 'warning');
  assert.equal(early.ink, 0);
  assert.ok(early.gather > .75 && early.squeeze > .35);
  assert.equal(launch.phase, 'jet');
  assert.ok(launch.ink > .45);
  assert.equal(poseAt('retreat', 3.7).pose.ink, 0);
  const end = poseAt('retreat', 5.8).pose, control = createPuppetState(7);
  stepPuppet(control, 348);
  assert.deepEqual(end, samplePuppet(control));
});

test('a nearby disturbance produces a stronger bounded response than a distant one', () => {
  const baseline = samplePuppet(createPuppetState(7));
  const close = poseAt('retreat', 1.32, { x: baseline.x + .04, y: baseline.y }).pose;
  const far = poseAt('retreat', 1.32, { x: .49, y: .45 }).pose;
  assert.ok(close.strength > far.strength + .35);
  assert.ok(close.ink > far.ink + .35);
});

test('a left-side cue turns through a frontal pose before responding, then turns back', () => {
  for (const kind of ['investigate', 'retreat']) {
    const state = createPuppetState();
    cuePuppet(state, { type: kind, x: -.4, y: -.05 });
    let previous = samplePuppet(state), frontSeen = false, leftSeen = false;
    for (let tick = 0; tick < PUPPET_DURATIONS[kind]; tick++) {
      stepPuppet(state); const pose = samplePuppet(state);
      assert.ok(Math.abs(pose.facing - previous.facing) < .16);
      frontSeen ||= Math.abs(pose.facing) < .12;
      leftSeen ||= pose.facing < -.99;
      if (kind === 'investigate' && pose.reach > .9) assert.equal(pose.facing, -1);
      if (kind === 'retreat' && pose.phase === 'jet') assert.equal(pose.facing, -1);
      previous = pose;
    }
    assert.ok(frontSeen && leftSeen);
    assert.equal(samplePuppet(state).facing, 1);
    assert.equal(samplePuppet(state).turn, 0);
  }
  assert.equal(poseAt('investigate', 2.2, { x: .4, y: 0 }).pose.facing, 1);
});

test('coalesced pointer input cannot move an active sequence target or interrupt it', () => {
  const state = createPuppetState();
  cuePuppet(state, { type: 'investigate', x: .3, y: -.1 });
  const committed = samplePuppet(state).target;
  for (let i = 0; i < 10000; i++) cuePuppet(state, { type: 'point', x: -.3, y: .1 });
  assert.deepEqual(samplePuppet(state).target, committed);
  const before = getPuppetState(state);
  assert.equal(cuePuppet(state, { type: 'retreat', x: -.2, y: 0 }), false);
  assert.deepEqual(getPuppetState(state), before);
  cuePuppet(state, { type: 'leave' });
  assert.deepEqual(samplePuppet(state).target, committed);
  stepPuppet(state, 360);
  assert.equal(cuePuppet(state, { type: 'retreat' }), false);
  stepPuppet(state, 35);
  assert.equal(cuePuppet(state, { type: 'retreat' }), false);
  stepPuppet(state, 1);
  assert.equal(cuePuppet(state, { type: 'retreat' }), true);
});

test('invalid or accessor-bearing input is rejected atomically', () => {
  const state = createPuppetState(), before = getPuppetState(state);
  const invalid = [null, [], 'retreat', { type: 'bad' }, { type: 'point' },
    { type: 'point', x: 0 }, { type: 'point', x: NaN, y: 0 },
    { type: 'retreat', x: Infinity, y: 0 }, { type: 'retreat', x: .6, y: 0 },
    { type: 'leave', x: 0, y: 0 }, { type: 'retreat', x: '0', y: 0 },
    { type: 'retreat', extra: 1 }, { get type() { throw Error('Getter must not execute'); } }];
  for (const input of invalid) {
    assert.equal(cuePuppet(state, input), false);
    assert.deepEqual(getPuppetState(state), before);
  }
  for (const seed of [-1, 1.1, NaN, Infinity, '7', 2 ** 32]) assert.throws(() => createPuppetState(seed), RangeError);
  for (const step of [-1, .5, NaN, Infinity, '2', 3601]) {
    assert.throws(() => stepPuppet(state, step), RangeError);
    assert.deepEqual(getPuppetState(state), before);
  }
});

test('all poses remain finite, bounded and return smoothly across target extremes', () => {
  for (const kind of ['investigate', 'retreat']) for (const target of [
    { x: -.5, y: -.5 }, { x: .5, y: -.5 }, { x: -.5, y: .5 }, { x: .5, y: .5 },
    { x: -.06, y: -.5 }, { x: -.06, y: .5 }, { x: 0, y: 0 }
  ]) {
    const state = createPuppetState(0xffffffff); cuePuppet(state, { type: kind, ...target });
    let previous = samplePuppet(state);
    for (let tick = 1; tick <= PUPPET_DURATIONS[kind] + 1; tick++) {
      stepPuppet(state); const current = samplePuppet(state);
      for (const value of Object.values(current)) if (typeof value === 'number') assert.ok(Number.isFinite(value));
      assert.ok(Math.abs(current.x) <= .19 && Math.abs(current.y) < .19 && Math.abs(current.angle) < .30);
      for (const key of ['gather', 'reach', 'squeeze', 'stripe', 'ink', 'eye']) assert.ok(current[key] >= 0 && current[key] <= 1.00000001);
      assert.ok(Math.hypot(current.x - previous.x, current.y - previous.y) < .006);
      assert.ok(Math.abs(current.angle - previous.angle) < .015);
      previous = current;
    }
  }
});

test('seeded idle varies deterministically; detached snapshots cannot modify live state', () => {
  const first = createPuppetState(7), second = createPuppetState(8);
  assert.notDeepEqual(samplePuppet(first), samplePuppet(second));
  cuePuppet(first, { type: 'investigate' });
  const snapshot = getPuppetState(first);
  assert.ok(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.point)
    && Object.isFrozen(snapshot.action.target));
  const pose = samplePuppet(first); pose.target.x = -.5; pose.x = 100;
  assert.notEqual(samplePuppet(first).target.x, -.5);
  assert.notEqual(samplePuppet(first).x, 100);
});

test('the plume origin stays at action-start world position while its body retreats', () => {
  const state = createPuppetState(7), start = samplePuppet(state);
  assert.equal(start.origin, null); assert.equal(start.age, 0);
  cuePuppet(state, { type: 'retreat', x: .4, y: -.1 });
  stepPuppet(state, 144);
  const jet = samplePuppet(state);
  assert.deepEqual(jet.origin, { x: start.x, y: start.y });
  assert.equal(jet.age, 2.4);
  assert.ok(Math.hypot(jet.x - jet.origin.x, jet.y - jet.origin.y) > .05);
  jet.origin.x = 900;
  assert.equal(samplePuppet(state).origin.x, start.x);
  stepPuppet(state, 204);
  assert.equal(samplePuppet(state).origin, null);
  assert.equal(samplePuppet(state).age, 0);
});

test('an action cannot create unsafe tick counters near the integer limit', () => {
  const state = createPuppetState(7);
  state.tick = Number.MAX_SAFE_INTEGER - 20;
  const before = getPuppetState(state);
  assert.equal(cuePuppet(state, { type: 'retreat' }), false);
  assert.deepEqual(getPuppetState(state), before);
  assert.throws(() => stepPuppet(state, 21), RangeError);
  assert.deepEqual(getPuppetState(state), before);
});
