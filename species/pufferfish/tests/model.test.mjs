import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUFFERFISH_DEFAULTS, PUFFERFISH_LIMITS, PUFFERFISH_REPLAY,
  createPufferfish, resolvePufferfishOptions, stepPufferfish,
  configurePufferfish, resetPufferfish, pufferfishPoster, describePufferfish,
} from '../build/model.js';

const event = (tick, seq, type, extra = {}) => ({ tick, seq, type, ...extra });
function step(state, events = []) {
  return stepPufferfish(state, { tick: state.tick + 1, events }).state;
}
function until(state, tick, events = []) {
  while (state.tick < tick) state = step(state, events.filter(e => e.tick === state.tick + 1));
  return state;
}
function start(options = {}) {
  return step(createPufferfish(options), [event(1, 0, 'approach')]);
}
const near = { x: 0.05, y: 0.02, aspect: 16 / 9 };

test('defaults, units and documented bounds resolve without retaining caller state', () => {
  const options = { seed: 0, wobble: 0 };
  const state = createPufferfish(options);
  options.seed = 99;
  assert.equal(state.config.seed, 0);
  assert.equal(state.config.wobble, 0);
  assert.equal(state.tick, 0);
  assert.equal(state.lastSequence, -1);
  assert.equal(state.inflation, 0);
  assert.equal(state.reactions, 0);
  assert.deepEqual(state.phase, { kind: 'idle' });
  assert.deepEqual(resolvePufferfishOptions(), PUFFERFISH_DEFAULTS);
  assert.equal(PUFFERFISH_LIMITS.tickRate, 60);
  assert.equal(createPufferfish({ seed: 0xffffffff }).config.seed, 0xffffffff);
  assert.equal(createPufferfish({ dwellTicks: 6, cooldownTicks: 3600 }).config.cooldownTicks, 3600);
});

test('default deliberate approach has exact dwell, belly, spine, hold and recovery durations', () => {
  let state = start();
  assert.deepEqual(state.phase, { kind: 'approach', age: 1 });
  state = until(state, 29);
  assert.deepEqual(state.phase, { kind: 'approach', age: 29 });
  assert.equal(state.inflation, 0);
  state = step(state);
  assert.deepEqual(state.phase, { kind: 'inflating', stage: 'belly', age: 0 });
  assert.equal(state.reactions, 1);
  state = until(state, 51);
  assert.equal(state.inflation, 0.275, 'belly midpoint is 55% × smoothstep(0.5)');
  state = until(state, 72);
  assert.deepEqual(state.phase, { kind: 'inflating', stage: 'spines', age: 0 });
  assert.equal(state.inflation, 0.55);
  state = until(state, 90);
  assert.equal(state.inflation, 0.775);
  state = until(state, 108);
  assert.deepEqual(state.phase, { kind: 'holding', age: 0 });
  assert.equal(state.inflation, 1);
  state = until(state, 287);
  assert.deepEqual(state.phase, { kind: 'holding', age: 179 });
  state = step(state);
  assert.deepEqual(state.phase, { kind: 'recovering', age: 0, from: 1 });
  assert.equal(state.inflation, 1);
  state = until(state, 363);
  assert.equal(state.inflation, 0.5);
  state = until(state, 438);
  assert.deepEqual(state.phase, { kind: 'cooldown', remaining: 180, retreated: false });
  assert.equal(state.inflation, 0);
});

test('passing nearby without dwell cancels interest and produces no inflation', () => {
  let state = step(createPufferfish(), [event(1, 0, 'pointer', near)]);
  state = until(state, 29);
  state = step(state, [event(30, 1, 'pointer', { x: 0.9, y: 0, aspect: 1 })]);
  state = until(state, 300);
  assert.deepEqual(state.phase, { kind: 'idle' });
  assert.equal(state.inflation, 0);
  assert.equal(state.reactions, 0);
  const restarted = step(state, [event(301, 2, 'approach')]);
  assert.deepEqual(restarted.phase, { kind: 'approach', age: 1 });
});

test('near distance uses CSS aspect and retreat hysteresis does not oscillate at approach boundary', () => {
  const wide = step(createPufferfish(), [event(1, 0, 'pointer', { x: 0.25, y: 0, aspect: 2 })]);
  const square = step(createPufferfish(), [event(1, 0, 'pointer', { x: 0.25, y: 0, aspect: 1 })]);
  assert.equal(wide.phase.kind, 'idle');
  assert.equal(square.phase.kind, 'approach');
  let state = until(start(), 40);
  state = step(state, [event(41, 1, 'pointer', { x: 0.36, y: 0, aspect: 1 })]);
  assert.equal(state.phase.kind, 'inflating', 'between radii retains committed inflation');
  state = step(state, [event(42, 2, 'pointer', { x: 0.42, y: 0, aspect: 1 })]);
  assert.equal(state.phase.kind, 'recovering', 'at retreat radius begins recovery');
});

test('retreat at anticipation, belly, spines and hold cancels or recovers without an inflation discontinuity', () => {
  const anticipated = until(start(), 15);
  assert.equal(step(anticipated, [event(16, 1, 'retreat')]).phase.kind, 'idle');
  for (const tick of [40, 85, 120]) {
    const before = until(start(), tick);
    let state = step(before, [event(tick + 1, 1, 'retreat')]);
    assert.equal(state.phase.kind, 'recovering');
    assert.equal(state.phase.from, before.inflation);
    assert.equal(state.inflation, before.inflation);
    let previous = state.inflation;
    for (let i = 0; i < state.config.recoveryTicks; i++) {
      state = step(state);
      assert.ok(Number.isFinite(state.inflation));
      assert.ok(state.inflation <= previous && state.inflation >= 0);
      assert.ok(previous - state.inflation < 0.011, 'bounded smooth deflation per default tick');
      previous = state.inflation;
    }
    assert.equal(state.inflation, 0);
    assert.equal(state.phase.kind, 'cooldown');
    assert.equal(state.phase.retreated, true);
  }
});

test('cooldown ignores repeated approach, cannot accumulate pulses, and requires retreat before another dwell', () => {
  let state = until(start(), 438);
  for (let i = 0; i < 600; i++) {
    const result = stepPufferfish(state, { tick: state.tick + 1,
      events: [event(state.tick + 1, state.lastSequence + 1, 'approach')] });
    assert.equal(result.ignoredApproaches, 1);
    state = result.state;
    assert.equal(state.phase.kind, 'cooldown');
    assert.equal(state.reactions, 1);
    assert.equal(state.inflation, 0);
  }
  assert.equal(state.phase.remaining, 0);
  assert.equal(state.phase.retreated, false);
  state = step(state, [event(state.tick + 1, state.lastSequence + 1, 'retreat')]);
  assert.equal(state.phase.kind, 'idle');
  state = step(state, [event(state.tick + 1, state.lastSequence + 1, 'approach')]);
  assert.deepEqual(state.phase, { kind: 'approach', age: 1 });
  state = until(state, state.tick + 29);
  assert.equal(state.reactions, 2);
});

test('retreat has precedence over approach or a near pointer anywhere in a single ordered tick batch', () => {
  for (const actions of [
    [event(1, 0, 'retreat'), event(1, 1, 'approach')],
    [event(1, 0, 'approach'), event(1, 1, 'retreat')],
    [event(1, 0, 'retreat'), event(1, 1, 'pointer', near)],
  ]) {
    const state = step(createPufferfish(), actions);
    assert.equal(state.phase.kind, 'idle');
    assert.equal(state.pointer.active, false);
    assert.equal(state.lastSequence, 1);
  }
});

test('same explicit tick and event log has identical every-tick state for 1/2/5 render grouping', () => {
  function replay(group) {
    let state = createPufferfish({ seed: 23 });
    const snapshots = [];
    while (state.tick < 1110) {
      for (let i = 0; i < group && state.tick < 1110; i++) {
        state = step(state, PUFFERFISH_REPLAY.filter(e => e.tick === state.tick + 1));
        snapshots.push(JSON.stringify(state));
      }
      // A presentation read must not change state, regardless of its cadence.
      describePufferfish(state);
    }
    return snapshots;
  }
  const baseline = replay(1);
  assert.deepEqual(replay(2), baseline);
  assert.deepEqual(replay(5), baseline);
  const final = JSON.parse(baseline.at(-1));
  assert.equal(final.phase.kind, 'idle');
  assert.equal(final.reactions, 2);
});

test('state is deterministic without ambient random/time and other instances stay independent', () => {
  const random = Math.random, now = Date.now;
  Math.random = () => { throw new Error('ambient random is forbidden'); };
  Date.now = () => { throw new Error('wall clock is forbidden'); };
  try {
    const a = until(start({ seed: 42 }), 120);
    const b = until(start({ seed: 42 }), 120);
    const different = until(start({ seed: 43 }), 120);
    assert.deepEqual(a, b);
    assert.notEqual(a.variation, different.variation);
    assert.equal(a.inflation, different.inflation, 'seed changes phase, not reaction timing');
    const next = step(a, [event(121, 1, 'retreat')]);
    assert.equal(next.phase.kind, 'recovering');
    assert.equal(b.phase.kind, 'holding');
    assert.equal(b.tick, 120);
  } finally { Math.random = random; Date.now = now; }
});

test('malformed configuration rejects atomically, including JavaScript inputs TypeScript cannot prevent', () => {
  const invalid = [
    null, [], 'pufferfish', { seed: NaN }, { seed: Infinity }, { seed: '23' },
    { seed: -1 }, { seed: 1.5 }, { seed: 0x100000000 }, { seed: undefined },
    { dwellTicks: 0 }, { bellyTicks: 5 }, { spineTicks: 6.5 }, { holdTicks: 3601 },
    { recoveryTicks: '150' }, { cooldownTicks: Infinity }, { approachRadius: NaN },
    { approachRadius: 0.09 }, { approachRadius: 0.6, retreatRadius: 0.4 },
    { approachRadius: 0.4, retreatRadius: 0.4 }, { retreatRadius: 0.91 },
    { inflationScale: 1.299 }, { inflationScale: 1.801 }, { wobble: -0.01 },
    { wobble: 1.01 }, { surprise: true },
  ];
  for (const options of invalid) assert.throws(() => createPufferfish(options), undefined, JSON.stringify(options));
  const current = until(start(), 90), saved = JSON.stringify(current);
  assert.throws(() => configurePufferfish(current, { seed: 25, cooldownTicks: NaN }));
  assert.equal(JSON.stringify(current), saved);
  assert.throws(() => configurePufferfish(current, { unknown: 1 }));
  assert.throws(() => resetPufferfish(current, '25'));
  assert.equal(JSON.stringify(current), saved);
});

test('tick/sequence/type/coordinate errors and oversized batches reject before any partial update', () => {
  const current = step(createPufferfish(), [event(1, 4, 'pointer', near)]);
  const saved = JSON.stringify(current);
  const badInputs = [
    null, [], { tick: 1 }, { tick: 3 }, { tick: 2.5 }, { tick: NaN }, { tick: '2' },
    { tick: 2, unknown: true }, { tick: 2, events: 'near' },
    { tick: 2, events: Array.from({ length: 17 }, (_, i) => event(2, 5 + i, 'approach')) },
    { tick: 2, events: [event(1, 5, 'retreat')] },
    { tick: 2, events: [event(2, 4, 'retreat')] },
    { tick: 2, events: [event(2, -1, 'retreat')] },
    { tick: 2, events: [event(2, 5.5, 'retreat')] },
    { tick: 2, events: [event(2, Infinity, 'retreat')] },
    { tick: 2, events: [event(2, '5', 'retreat')] },
    { tick: 2, events: [event(2, 5, 'unknown')] },
    { tick: 2, events: [event(2, 5, 'approach', { x: 0 })] },
    { tick: 2, events: [event(2, 5, 'pointer', { x: 0, y: 0 })] },
    { tick: 2, events: [event(2, 5, 'pointer', { x: NaN, y: 0, aspect: 1 })] },
    { tick: 2, events: [event(2, 5, 'pointer', { x: 0, y: Infinity, aspect: 1 })] },
    { tick: 2, events: [event(2, 5, 'pointer', { x: -1.01, y: 0, aspect: 1 })] },
    { tick: 2, events: [event(2, 5, 'pointer', { x: 0, y: 1.01, aspect: 1 })] },
    { tick: 2, events: [event(2, 5, 'pointer', { x: 0, y: 0, aspect: 0 })] },
    { tick: 2, events: [event(2, 5, 'pointer', { x: 0, y: 0, aspect: 11 })] },
    { tick: 2, events: [null] },
    { tick: 2, events: [event(2, 5, 'retreat'), event(2, 5, 'approach')] },
    { tick: 2, events: [event(2, 8, 'retreat'), event(2, 7, 'approach')] },
    { tick: 2, events: [event(2, 5, 'retreat'), event(2, 6, 'pointer', { x: NaN, y: 0, aspect: 1 })] },
  ];
  for (const input of badInputs) {
    assert.throws(() => stepPufferfish(current, input), undefined, JSON.stringify(input));
    assert.equal(JSON.stringify(current), saved);
  }
  const maximum = Array.from({ length: 16 }, (_, i) => event(2, 5 + i, 'approach'));
  assert.equal(step(current, maximum).lastSequence, 20);
  assert.throws(() => stepPufferfish({ ...current, tick: PUFFERFISH_LIMITS.maxTick }, { tick: PUFFERFISH_LIMITS.maxTick + 1 }));
  assert.throws(() => stepPufferfish({ ...current, version: 'unknown' }, { tick: 2 }));
});

test('explicit null event batch is malformed rather than silently treated as no input', () => {
  const current = createPufferfish();
  assert.throws(() => stepPufferfish(current, { tick: 1, events: null }));
  assert.equal(current.tick, 0);
});

test('configuration and reset create reproducible fresh runs, while originals and immutable snapshots remain unchanged', () => {
  const original = until(start({ seed: 91, wobble: 0.4 }), 95);
  const saved = JSON.stringify(original);
  const changed = configurePufferfish(original, { dwellTicks: 18 });
  assert.equal(changed.config.seed, 91);
  assert.equal(changed.config.wobble, 0.4);
  assert.equal(changed.config.dwellTicks, 18);
  assert.equal(changed.tick, 0);
  assert.equal(changed.lastSequence, -1);
  assert.equal(changed.pointer.active, false);
  assert.equal(changed.inflation, 0);
  assert.equal(changed.reactions, 0);
  assert.deepEqual(resetPufferfish(original), createPufferfish(original.config));
  assert.equal(resetPufferfish(original, 92).config.seed, 92);
  assert.equal(JSON.stringify(original), saved);
  for (const value of [original, original.config, original.pointer, original.phase]) assert.equal(Object.isFrozen(value), true);
  assert.throws(() => { original.tick = 0; }, TypeError);
  assert.throws(() => { original.config.seed = 1; }, TypeError);
  assert.throws(() => { original.pointer.x = 1; }, TypeError);
  assert.throws(() => { original.phase.kind = 'idle'; }, TypeError);
  assert.equal(JSON.stringify(original), saved);
});

test('static alternatives do not advance simulation or leave a latent pointer target', () => {
  const original = until(start(), 60), before = JSON.stringify(original);
  const inflated = pufferfishPoster(original, true), calm = pufferfishPoster(original, false);
  assert.equal(inflated.tick, original.tick);
  assert.equal(inflated.lastSequence, original.lastSequence);
  assert.equal(inflated.reactions, original.reactions);
  assert.equal(inflated.inflation, 1);
  assert.equal(inflated.phase.kind, 'holding');
  assert.equal(inflated.pointer.active, false);
  assert.equal(calm.inflation, 0);
  assert.equal(calm.phase.kind, 'idle');
  assert.equal(calm.pointer.active, false);
  assert.equal(JSON.stringify(original), before);
  assert.match(describePufferfish(inflated), /inflated pufferfish/i);
  assert.match(describePufferfish(calm), /oblong, spotted pufferfish/i);
});
