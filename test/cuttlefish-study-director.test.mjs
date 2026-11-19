import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudyState, cueStudy, stepStudy, sampleStudy, getStudyState }
  from '../src/animals/cuttlefish-study-director.js';

const advance = (state, ticks) => { for (let tick = 0; tick < ticks; tick++) stepStudy(state); };
const numbers = pose => [...pose.position, ...pose.forward, pose.bank, ...pose.anchor, pose.progress, pose.alert];
const vector = pose => [...pose.position, ...pose.forward, pose.bank];
const difference = (left, right) => left.map((value, index) => value - right[index]);

test('study is SSR-safe, rejects malformed input atomically, and snapshots are detached and frozen', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  assert.throws(() => createStudyState(NaN));
  assert.throws(() => createStudyState(2, { automatic: 'yes' }));
  assert.throws(() => createStudyState(2, { surprise: true }));
  const state = createStudyState(19, { automatic: false });
  const invalid = [null, [], {}, { type: 'unknown' }, { type: 'pointer', x: 0 },
    { type: 'pointer', x: 0, y: Infinity }, { type: 'pointer', x: .50001, y: 0 },
    { type: 'investigate', x: NaN }, { type: 'turn', x: '0' },
    { type: 'retreat', y: -.50001 }, { type: 'release', x: 0 },
    { type: 'turn', surprise: true }, { get type() { throw new Error('must not read accessor'); } }];
  for (const input of invalid) {
    const before = getStudyState(state);
    assert.equal(cueStudy(state, input), false);
    assert.deepEqual(getStudyState(state), before);
  }
  assert.equal(cueStudy(state, { type: 'investigate', x: .5, y: -.5 }), true);
  const snapshot = getStudyState(state);
  assert(Object.isFrozen(snapshot)); assert(Object.isFrozen(snapshot.target));
  assert(Object.isFrozen(snapshot.action)); assert(Object.isFrozen(snapshot.action.target));
  assert.throws(() => { snapshot.action.target[0] = 0; });
  assert.throws(() => { snapshot.automatic = true; });
  assert.equal(cueStudy(state, { type: 'retreat', x: -.4 }), false);
  assert.deepEqual(getStudyState(state), snapshot, 'conflicting action must be wholly atomic');
  const pose = sampleStudy(state); pose.position[0] = 999; pose.anchor[1] = 999;
  assert(sampleStudy(state).position[0] < 1, 'sample arrays do not alias simulation state');
});

test('fixed ticks replay identically regardless of sampling and caller grouping; seeds change poses', () => {
  const a = createStudyState(34), b = createStudyState(34);
  for (let group = 0; group < 80; group++) {
    advance(a, 30);
    for (let tick = 0; tick < 30; tick++) {
      sampleStudy(b, { id: 0, seed: .35, count: 1 }, { width: 390, height: 560 });
      stepStudy(b);
      sampleStudy(b); sampleStudy(b);
    }
    assert.deepEqual(getStudyState(a), getStudyState(b));
    assert.deepEqual(sampleStudy(a), sampleStudy(b));
  }
  assert.notDeepEqual(sampleStudy(createStudyState(34)), sampleStudy(createStudyState(35)));
  const before = getStudyState(a); sampleStudy(a); sampleStudy(a);
  assert.deepEqual(getStudyState(a), before);
});

test('investigation, in-place turn and retreat have distinct finite phases and one delayed jet event', () => {
  const scenes = new Map();
  for (const [kind, duration] of [['investigate', 414], ['turn', 306], ['retreat', 630]]) {
    const state = createStudyState(17, { automatic: false });
    assert(cueStudy(state, { type: kind, x: -.38, y: -.18 }));
    const phases = new Set(), poses = [], jets = [];
    for (let tick = 0; tick <= duration; tick++) {
      const pose = sampleStudy(state);
      assert(numbers(pose).every(Number.isFinite));
      assert(Math.abs(Math.hypot(...pose.forward) - 1) < 1e-12);
      assert(pose.progress >= 0 && pose.progress <= 1 && pose.alert >= 0 && pose.alert <= 1);
      phases.add(pose.phase);
      if (tick % 30 === 0) poses.push(vector(pose));
      if (stepStudy(state).jet) jets.push(tick + 1);
    }
    assert(phases.has('anticipation') && phases.has('recovery') && phases.has('hover'));
    if (kind === 'investigate') assert(phases.has('approach') && phases.has('hold'));
    if (kind === 'turn') assert(phases.has('turn') && phases.has('hold'));
    if (kind === 'retreat') assert(phases.has('turn') && phases.has('ink') && phases.has('jet'));
    assert.deepEqual(jets, kind === 'retreat' ? [54] : []);
    assert.equal(getStudyState(state).action, null);
    scenes.set(kind, JSON.stringify(poses));
  }
  assert.equal(new Set(scenes.values()).size, 3);
});

test('position, heading and bank recover with C1 joins instead of snapping to frozen idle poses', () => {
  // Different channels intentionally anticipate one another. Check each keyed
  // channel's join, not a different channel that is accelerating mid-segment.
  const boundaries = {
    investigate: { position: [0, 36, 138, 246, 414], heading: [0, 36, 102, 216, 414], bank: [0, 36, 102, 216, 414] },
    turn: { position: [0, 33, 120, 168, 306], heading: [0, 33, 120, 168, 306], bank: [0, 33, 84, 168, 306] },
    retreat: { position: [0, 27, 54, 249, 630], heading: [0, 27, 54, 249, 630], bank: [0, 39, 110.4, 630] }
  };
  for (const [kind, channels] of Object.entries(boundaries)) {
    const active = createStudyState(77, { automatic: false });
    const idle = createStudyState(77, { automatic: false });
    assert(cueStudy(active, { type: kind, x: -.5, y: .5 }));
    const end = channels.position.at(-1), length = end + 2, offsets = [];
    for (let tick = 0; tick <= length; tick++) {
      offsets.push(difference(vector(sampleStudy(active)), vector(sampleStudy(idle))));
      stepStudy(active); stepStudy(idle);
    }
    assert(offsets[0].every(value => value === 0), `${kind} begins at the continuous idle pose`);
    assert(offsets[end].every(value => value === 0), `${kind} ends at live idle`);
    for (const [channel, joins] of Object.entries(channels)) {
      const start = channel === 'position' ? 0 : channel === 'heading' ? 3 : 6;
      const finish = channel === 'position' ? 3 : channel === 'heading' ? 6 : 7;
      for (const join of joins) {
        const tick = Math.round(join);
        if (tick < 1) {
          assert(Math.max(...offsets[1].slice(start, finish).map(Math.abs)) < .0002);
          continue;
        }
        const before = difference(offsets[tick], offsets[tick - 1]).map(value => value * 60);
        const after = difference(offsets[tick + 1], offsets[tick]).map(value => value * 60);
        const discontinuity = Math.max(...difference(before, after).slice(start, finish).map(Math.abs));
        assert(discontinuity < .035, `${kind} ${channel} at ${join / 60}s velocity change ${discontinuity}`);
      }
    }
  }
});

test('pointer is coalesced, dwell is finite, active actions do not retarget and release cancels dwell', () => {
  const state = createStudyState(8, { automatic: false });
  for (let index = 0; index < 100; index++) assert(cueStudy(state, { type: 'pointer', x: .35, y: -.12 }));
  advance(state, 35); assert.equal(getStudyState(state).action, null);
  stepStudy(state); assert.equal(getStudyState(state).action.source, 'dwell');
  const fixedTarget = getStudyState(state).action.target;
  const same = createStudyState(8, { automatic: false });
  cueStudy(same, { type: 'pointer', x: .35, y: -.12 }); advance(same, 36);
  for (let tick = 0; tick < 120; tick++) {
    cueStudy(state, { type: 'pointer', x: -.4 + tick / 1000, y: .3 });
    stepStudy(state); stepStudy(same);
    assert.deepEqual(sampleStudy(state), sampleStudy(same), 'pointer updates must not bend an active route');
  }
  assert.deepEqual(getStudyState(state).action.target, fixedTarget);
  cueStudy(state, { type: 'release' });
  advance(state, 500); assert.equal(getStudyState(state).action, null);
  assert.equal(getStudyState(state).pointer, false);
  assert.equal(getStudyState(state).dwellTicks, 0);
});

test('automatic direction begins after five quiet seconds, alternates, and never emits ink', () => {
  const state = createStudyState(2026);
  advance(state, 299); assert.equal(getStudyState(state).action, null);
  stepStudy(state); assert.equal(getStudyState(state).action.kind, 'investigate');
  const starts = [{ tick: 300, kind: 'investigate' }];
  for (let tick = 301; tick <= 7200; tick++) {
    assert.equal(stepStudy(state).jet, false);
    const snapshot = getStudyState(state);
    if (snapshot.action && snapshot.action.startTick === tick) starts.push({ tick, kind: snapshot.action.kind });
  }
  assert(starts.length >= 6);
  starts.forEach((start, index) => {
    assert.equal(start.kind, index % 2 ? 'turn' : 'investigate');
    if (index) assert(start.tick - starts[index - 1].tick >= 900 && start.tick - starts[index - 1].tick <= 1320);
  });
});

test('desktop and portrait sampling retain finite separated stations for 1–12 animals', () => {
  const state = createStudyState(26, { automatic: false });
  cueStudy(state, { type: 'investigate', x: .5, y: .5 }); advance(state, 150);
  for (const viewport of [{ width: 1200, height: 760 }, { width: 390, height: 560 }]) {
    for (let count = 1; count <= 12; count++) {
      const anchors = new Set();
      for (let id = 0; id < count; id++) {
        const pose = sampleStudy(state, { id, seed: id / 12, count }, viewport);
        assert(numbers(pose).every(Number.isFinite));
        assert(Math.hypot(...difference(pose.position, pose.anchor)) < .65);
        anchors.add(JSON.stringify(pose.anchor));
      }
      assert.equal(anchors.size, count);
    }
  }
  const before = getStudyState(state);
  for (const viewport of [{ width: NaN, height: 1 }, { width: 0, height: 1 }, { width: 10, height: Infinity }]) {
    assert.throws(() => sampleStudy(state, {}, viewport));
  }
  for (const member of [{ count: 13 }, { count: 0 }, { id: 1 }, { id: -.1 }, { seed: NaN }]) {
    assert.throws(() => sampleStudy(state, member));
  }
  assert.deepEqual(getStudyState(state), before);
});
