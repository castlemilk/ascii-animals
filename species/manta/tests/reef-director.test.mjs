import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReefOptions, sampleReefPose } from '../reef-director.mjs';
import { poseVector } from './reef-test-host.mjs';

const frame = (time, patch = {}, options = {}) => sampleReefPose({ time, seed: 20261119, ...patch }, options);
const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));

test('reef imports are SSR-safe and options reject invalid data without mutation', () => {
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof globalThis.document, 'undefined');
  const options = normalizeReefOptions();
  assert.deepEqual(options, { current: .45, duration: 32, habitat: true });
  assert(Object.isFrozen(options));
  const supplied = { current: -.4, duration: 44, habitat: false };
  const copy = normalizeReefOptions(supplied);
  supplied.current = .8;
  assert.equal(copy.current, -.4);
  for (const invalid of [null, [], 4, { current: NaN }, { current: Infinity },
    { current: -1.01 }, { current: 1.01 }, { current: '.3' }, { duration: 19.9 },
    { duration: 80.1 }, { duration: Infinity }, { habitat: 0 }, { surprise: true }]) {
    assert.throws(() => normalizeReefOptions(invalid), JSON.stringify(invalid));
  }
  assert.deepEqual(options, normalizeReefOptions());
});

test('pure samples validate time, identity, input and dimension values before math', () => {
  for (const patch of [{ time: NaN }, { time: Infinity }, { time: -1 },
    { seed: 1.5 }, { seed: -1 }, { seed: 4294967296 }, { current: NaN },
    { current: 1.01 }, { reactionAge: Infinity }, { reactionAge: -1 },
    { side: 0 }, { motion: NaN }, { motion: -.01 }, { motion: 1.01 },
    { aspect: 0 }, { aspect: Infinity }, { pointer: { x: NaN, y: 0, interest: 1 } },
    { pointer: { x: 0, y: Infinity, interest: 1 } },
    { pointer: { x: 0, y: 0, interest: 1.01 } }]) {
    assert.throws(() => frame(0, patch), JSON.stringify(patch));
  }
});

test('current glide has authored anticipation, travel and recovery in a bounded loop', () => {
  for (const duration of [20, 32, 80]) for (const current of [-1, .45, 1]) {
    const stages = new Set(), positions = [], options = { duration, current };
    for (let index = 0; index <= 80; index++) {
      const pose = frame(index * duration / 80, {}, options);
      assert.equal(pose.sequence, 'current-glide');
      stages.add(pose.stage); positions.push(pose.position);
      assert(poseVector(pose).every(Number.isFinite));
      assert(pose.position.every(value => Math.abs(value) < 12));
      assert(Math.abs(pose.bank) <= Math.PI);
      assert(Math.abs(Math.hypot(...pose.forward) - 1) < 1e-10);
      assert(pose.progress >= 0 && pose.progress <= 1);
    }
    assert(stages.has('anticipation'), 'the glide must prepare for its current');
    assert(stages.has('glide'), 'the glide must travel');
    assert(stages.has('recover'), 'the glide must visibly settle before its loop seam');
    assert(Math.max(...positions.map(position => distance(position, positions[0]))) > .25,
      'authored direction must change the body path, not only its label');
  }
});

test('current cycle joins position, direction and deformation with continuous velocity', () => {
  const duration = 32, epsilon = 1e-4;
  // Time metadata intentionally keeps elapsed time; compare only the rendered pose.
  const a = poseVector(frame(duration - 2 * epsilon));
  const b = poseVector(frame(duration - epsilon));
  const c = poseVector(frame(duration + epsilon));
  const d = poseVector(frame(duration + 2 * epsilon));
  assert(distance(b, c) < .003, 'cycle position/pose seam');
  const before = b.map((value, index) => (value - a[index]) / epsilon);
  const after = d.map((value, index) => (value - c[index]) / epsilon);
  assert(distance(before, after) < .03, 'cycle velocity seam');
});

test('barrel bank prepares, rolls substantially, then recovers slowly to the running glide', () => {
  const stages = new Set(), banked = [], recovered = [], startTime = 7;
  const first = frame(startTime, { reactionAge: 0, side: 1 });
  const idle = frame(startTime);
  assert(distance(first.position, idle.position) < 1e-9, 'trigger must not teleport');
  assert(distance(first.forward, idle.forward) < 1e-9, 'trigger must not snap heading');
  assert(Math.abs(first.bank - idle.bank) < 1e-9, 'trigger must not snap roll');
  for (let tick = 0; tick <= 528; tick++) {
    const age = tick / 60, pose = frame(startTime + age, { reactionAge: age, side: 1 });
    assert(poseVector(pose).every(Number.isFinite));
    if (age < 8.8) assert.equal(pose.sequence, 'barrel-bank');
    stages.add(pose.stage);
    if (pose.stage === 'bank') banked.push(pose);
    if (pose.stage === 'recover') recovered.push(pose);
  }
  assert(stages.has('anticipation') && stages.has('bank') && stages.has('recover'));
  assert(banked.length > 0 && recovered.length > banked.length,
    'recovery should take longer than the active bank');
  assert(Math.max(...banked.map(pose => Math.abs(pose.bank))) > .65,
    'barrel bank should rotate materially beyond an ordinary 20–25 degree glide turn');
  const finish = frame(startTime + 8.8, { reactionAge: 8.8, side: 1 });
  const running = frame(startTime + 8.8);
  assert(distance(poseVector(finish), poseVector(running)) < 1e-7,
    'completed response must meet its running destination continuously');
});

test('side, current and pointer input alter the pose while seed and calls remain isolated', () => {
  const input = { reactionAge: 2, side: 1, pointer: { x: .3, y: -.1, interest: 1 } };
  const reference = frame(9, input);
  assert.deepEqual(reference, frame(9, input));
  for (let time = 0; time < 100; time += 1.3) frame(time, { seed: 7, aspect: .6 });
  assert.deepEqual(reference, frame(9, input), 'another sample must not mutate seeded state');
  const otherSide = frame(9, { ...input, side: -1 });
  assert(reference.bank * otherSide.bank < 0, 'left and right bank must have opposing roll');
  assert.notDeepEqual(frame(7, { current: -.7 }).position, frame(7, { current: .7 }).position);
  assert.notDeepEqual(frame(7, { pointer: { x: -.4, y: .1, interest: 1 } }).forward,
    frame(7, { pointer: { x: .4, y: -.1, interest: 1 } }).forward);
  assert.notDeepEqual(frame(7, { seed: 1 }), frame(7, { seed: 2 }));
});
