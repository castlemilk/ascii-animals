import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGecko, DEFAULT_GECKO_HABITAT, GECKO_LIMITS } from '../compiled/gecko.js';
import { getGeckoAnatomy, sampleGecko } from '../compiled/geometry.js';
import { renderGeckoGrid } from '../compiled/preview.js';

const EPS = 1e-9;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const referenceEvents = [
  { tick: 1, seq: 1, type: 'guide', x: .9, y: -.9 },
  { tick: 181, seq: 2, type: 'startle' },
  { tick: 320, seq: 3, type: 'guide', x: -.8, y: .5 },
  { tick: 570, seq: 4, type: 'leave' },
];

test('omitted and explicit default habitats preserve the reviewed default replay and glyph output', () => {
  const implicit = createGecko({ seed: 37 });
  const explicit = createGecko({ seed: 37, habitat: DEFAULT_GECKO_HABITAT });
  const emptyPatch = createGecko({ seed: 37, habitat: {} });
  const checkpoints = new Set([0, 1, 180, 181, 228, 320, 570, 600]);
  const states = [], grids = [];
  for (let tick = 0; tick <= 600; tick++) {
    const events = referenceEvents.filter(event => event.tick === tick);
    const state = tick ? implicit.step(events).state : implicit.getSnapshot();
    assert.deepEqual(tick ? explicit.step(events).state : explicit.getSnapshot(), state);
    assert.deepEqual(tick ? emptyPatch.step(events).state : emptyPatch.getSnapshot(), state);
    assert.deepEqual(state.habitat, { extentX: .26, extentY: .13, origin: { x: .18, y: 0 } });
    if (checkpoints.has(tick)) {
      const { habitat, ...fixtureState } = state;
      states.push(fixtureState);
      const grid = renderGeckoGrid(state, { cols: 112, rows: 50 });
      assert.equal(Object.hasOwn(grid, 'viewport'), false, 'single-gecko grids retain their original shape');
      assert.equal(Object.hasOwn(grid, 'theme'), false);
      grids.push(grid.text);
    }
  }
  // Reviewed 19 November 2026 on Node v24.22.3, after the gecko uplift based on
  // main b8f222dab868821f27bf2a64a98434f3483fc8e6. Latched toe spread, the
  // peel/transfer/adhere gait, support constraints and new anatomy deliberately
  // change the old state and glyph fixtures; this is not legacy pixel parity.
  // Only habitat remains excluded from the state digest. Exact state equality
  // for implicit, explicit-default and empty habitats is still checked each tick.
  assert.equal(digest(states), 'cd4d45a757e86df029541e70a0588e0e2c06dcd3af3c4d8304451386a4475003');
  assert.equal(digest(grids), '3c049fbbce2911f6ff5de9b552f943efdc10a78c9d3382166822f9c3622c9f8e');
});

test('habitat resolution and all snapshots detach caller-owned nested origins', () => {
  const input = { extentX: 1.4, extentY: .8, origin: { x: -1.1, y: .5 } };
  const expected = structuredClone(input);
  const model = createGecko({ habitat: input, heading: .7 });
  input.extentX = 3;
  input.origin.x = 2;
  assert.deepEqual(model.getSnapshot().habitat, expected);
  assert.deepEqual(model.getSnapshot().position, expected.origin);
  for (const state of [model.getSnapshot(), model.step().state, model.reset()]) {
    state.habitat.extentY = 2;
    state.habitat.origin.y = -1;
    state.position.x = 99;
    assert.deepEqual(model.getSnapshot().habitat, expected);
    assert.deepEqual(model.getSnapshot().position, expected.origin);
  }
  const other = createGecko();
  const copy = other.getSnapshot();
  copy.habitat.origin.x = 99;
  assert.deepEqual(createGecko().getSnapshot().habitat, DEFAULT_GECKO_HABITAT);
  assert.equal(DEFAULT_GECKO_HABITAT.origin.x, .18);
});

test('reset retains the resolved habitat and options, applies partial habitat patches, and recreates contacts at origin', () => {
  const habitat = { extentX: 1.4, extentY: .8, origin: { x: -1.1, y: .5 } };
  const model = createGecko({ seed: 10, heading: .7, habitat, options: { creepSpeed: .14 } });
  model.step([{ tick: 1, seq: 1, type: 'guide', x: 1, y: -1 }]);
  for (let i = 0; i < 60; i++) model.step();
  const beforeUpdate = model.getSnapshot();
  model.update({ creepSpeed: .16 });
  const afterUpdate = model.getSnapshot();
  assert.deepEqual(afterUpdate.habitat, beforeUpdate.habitat);
  assert.deepEqual(afterUpdate.feet, beforeUpdate.feet);
  assert.equal(afterUpdate.tick, beforeUpdate.tick);

  const reset = model.reset();
  assert.deepEqual(reset.habitat, habitat);
  assert.deepEqual(reset.position, habitat.origin);
  assert.equal(reset.options.creepSpeed, .16);
  assert.equal(reset.tick, 0);
  assert.equal(reset.lastSequence, 0);
  assert.equal(reset.target, null);
  assert.equal(reset.heading, .7);
  assert(reset.feet.every(foot => foot.phase === 'stance' && foot.plantedAt === 0));

  assert.deepEqual(model.reset({ habitat: { extentY: 1.1 } }).habitat,
    { ...habitat, extentY: 1.1 });
  const origin = { x: .9, y: -.6 };
  const changed = model.reset({ seed: 22, heading: -.5, habitat: { origin } });
  origin.x = -99;
  assert.deepEqual(changed.habitat, { extentX: 1.4, extentY: 1.1, origin: { x: .9, y: -.6 } });
  assert.deepEqual(changed.position, changed.habitat.origin);
  const independentlyCreated = createGecko({ seed: 22, heading: -.5,
    habitat: changed.habitat, options: { creepSpeed: .16 } }).getSnapshot();
  assert.deepEqual(changed, independentlyCreated, 'reset recreates all four contacts, phase and input identity');
  assert.deepEqual(model.reset({ habitat: {} }), changed);
});

test('invalid habitat creation and reset patches reject before any mutation; update remains options-only', () => {
  const invalid = [
    undefined, null, [], 1, true, new Date(),
    { extentX: undefined }, { extentY: undefined }, { origin: undefined },
    { extentX: NaN }, { extentX: Infinity }, { extentX: -Infinity }, { extentX: '1' },
    { extentX: .259 }, { extentX: 3.001 }, { extentY: .129 }, { extentY: 2.001 },
    { extentY: NaN }, { extentY: Infinity }, { extentY: '1' },
    { unknown: 1 }, { [Symbol('extra')]: 1 },
    Object.defineProperty({}, 'extentX', { value: undefined }),
    Object.defineProperty({}, 'extentY', { value: NaN }),
    { origin: null }, { origin: [] }, { origin: {} }, { origin: { x: 0 } },
    { origin: { y: 0 } }, { origin: { x: undefined, y: 0 } },
    { origin: { x: 0, y: undefined } }, { origin: { x: NaN, y: 0 } },
    { origin: { x: 0, y: Infinity } }, { origin: { x: '0', y: 0 } },
    { origin: { x: 0, y: 0, unknown: 1 } },
    { origin: { x: 0, y: 0, [Symbol('extra')]: 1 } },
    { extentX: .26, origin: { x: .261, y: 0 } },
    { extentY: .13, origin: { x: 0, y: -.131 } },
  ];
  const model = createGecko({ habitat: { extentX: 1.4, extentY: .8, origin: { x: -.6, y: .2 } } });
  model.step([{ tick: 1, seq: 1, type: 'guide', x: .7, y: .4 }]);
  const before = model.getSnapshot();
  for (const patch of invalid) {
    assert.throws(() => createGecko({ habitat: patch }), undefined, `config accepted ${String(patch)}`);
    assert.throws(() => model.reset({ seed: 123, habitat: patch }), undefined, `reset accepted ${String(patch)}`);
    assert.deepEqual(model.getSnapshot(), before, 'invalid habitat must not reset seed, tick, origin or contacts');
  }
  for (const patch of [{ habitat: {} }, { extentX: 2 }, { creepSpeed: NaN }, { creepSpeed: undefined }]) {
    assert.throws(() => model.update(patch));
    assert.deepEqual(model.getSnapshot(), before);
  }
  for (const patch of [
    { seed: -1, habitat: { extentX: 2 } },
    { heading: NaN, habitat: { origin: { x: 0, y: 0 } } },
    { habitat: { extentX: .26 } }, // Retained origin -.6 no longer fits.
    { habitat: { extentY: .13 } }, // Retained origin .2 no longer fits.
    { options: { creepSpeed: .1 }, habitat: { extentX: 2 } },
  ]) {
    assert.throws(() => model.reset(patch));
    assert.deepEqual(model.getSnapshot(), before);
  }
  assert.throws(() => model.step([{ tick: 2, seq: 2, type: 'guide', x: 1.1, y: 0 }]));
  assert.deepEqual(model.getSnapshot(), before, 'an expanded habitat still takes normalized inputs');
});

test('larger routes travel across the wall while actual world-space palms, fan angles and toe pads stay planted', () => {
  const habitat = { extentX: 1.6, extentY: .9, origin: { x: -1.35, y: -.55 } };
  const model = createGecko({ seed: 37, heading: 0, habitat,
    options: { creepSpeed: .18, turnRate: 1.2 } });
  let previous = model.getSnapshot();
  let previousAnatomy = getGeckoAnatomy(previous);
  let minimumX = previous.position.x, maximumX = previous.position.x;
  let stanceComparisons = 0, seq = 0;
  const swingOrder = [];
  for (let tick = 1; tick <= 4000; tick++) {
    const events = [];
    if (tick === 1) events.push({ tick, seq: ++seq, type: 'guide', x: 1, y: .6 });
    if (tick === 2001) events.push({ tick, seq: ++seq, type: 'guide', x: -1, y: -.7 });
    if (tick === 1001 || tick === 3001) events.push({ tick, seq: ++seq, type: 'startle' });
    const state = model.step(events).state;
    const anatomy = getGeckoAnatomy(state);
    assert(Math.abs(state.position.x) <= habitat.extentX + EPS);
    assert(Math.abs(state.position.y) <= habitat.extentY + EPS);
    assert(state.feet.filter(foot => foot.phase === 'stance').length >= 3);
    for (const foot of state.feet) {
      const prior = previous.feet.find(candidate => candidate.id === foot.id);
      const limb = anatomy.limbs.find(candidate => candidate.id === foot.id);
      assert(limb.pads.length === 5);
      assert(distance(limb.shoulder, limb.palm) <= GECKO_LIMITS.limbReach + EPS);
      if (foot.phase === 'swing' && prior.phase !== 'swing') swingOrder.push(foot.id);
      if (foot.phase === 'stance' && prior.phase === 'stance' && foot.plantedAt === prior.plantedAt) {
        assert.deepEqual(foot.position, prior.position, `palm slides at tick ${tick}`);
        assert.equal(foot.angle, prior.angle, `toe fan rotates at tick ${tick}`);
        assert.deepEqual(limb.pads, previousAnatomy.limbs.find(candidate => candidate.id === foot.id).pads,
          `rendered pads slide at tick ${tick}`);
        stanceComparisons++;
      }
    }
    if (tick % 200 === 0) {
      const beforeSample = structuredClone(state);
      const report = sampleGecko(state, point => {
        assert([point.x, point.y, point.z, point.tone].every(Number.isFinite));
        assert(Math.abs(point.x - state.position.x) <= 1.3);
        assert(Math.abs(point.y - state.position.y) <= 1.3);
      });
      assert(report.samples > 500 && report.samples <= GECKO_LIMITS.samples);
      assert.deepEqual(state, beforeSample);
    }
    minimumX = Math.min(minimumX, state.position.x);
    maximumX = Math.max(maximumX, state.position.x);
    previous = state;
    previousAnatomy = anatomy;
  }
  assert(maximumX > 1, `approach should travel beyond the original domain; maximum x=${maximumX}`);
  assert(previous.position.x < -1, `reversal should traverse the wider route; final x=${previous.position.x}`);
  assert(maximumX - minimumX > 2.3, 'the test must exercise visible travel, not a larger unused bound');
  assert(stanceComparisons > 10_000);
  assert(previous.stepsCompleted > 40);
  const order = ['front-left', 'rear-right', 'front-right', 'rear-left'];
  swingOrder.forEach((id, index) => assert.equal(id, order[index % 4]));
});

test('normalized guide endpoints and outward retreat obey inclusive habitat root bounds', () => {
  for (const [origin, heading] of [
    [{ x: -3, y: 0 }, 0], [{ x: 3, y: 0 }, Math.PI],
    [{ x: 0, y: -2 }, Math.PI / 2], [{ x: 0, y: 2 }, -Math.PI / 2],
  ]) {
    const model = createGecko({ habitat: { extentX: 3, extentY: 2, origin }, heading });
    for (let tick = 1; tick <= 200; tick++) {
      const state = model.step(tick === 1 ? [{ type: 'startle', tick, seq: 1 }] : []).state;
      assert(Math.abs(state.position.x) <= 3);
      assert(Math.abs(state.position.y) <= 2);
      getGeckoAnatomy(state); // Clipping body motion must not overextend a planted limb.
    }
    assert(distance(model.getSnapshot().position, origin) < EPS, 'outward retreat stops at the root boundary');
    for (const [x, y] of [[-1, -1], [1, 1], [0, 0]]) {
      const snapshot = model.getSnapshot();
      const state = model.step([{ tick: snapshot.tick + 1, seq: snapshot.lastSequence + 1, type: 'guide', x, y }]).state;
      assert.deepEqual(state.target, { x: x * 3, y: y * 2 });
    }
  }
});

test('expanded-habitat replay is independent of render grouping and reset is repeatable', () => {
  const replay = group => {
    const model = createGecko({ seed: 93, habitat: { extentX: 2, extentY: 1, origin: { x: -.8, y: .4 } } });
    const first = model.getSnapshot();
    const run = () => {
      const states = [];
      for (let tick = 1; tick <= 600; tick++) {
        const state = model.step(referenceEvents.filter(event => event.tick === tick)).state;
        if (tick % group === 0) getGeckoAnatomy(state);
        if (tick % 30 === 0) states.push(state);
      }
      return states;
    };
    const result = run();
    assert.deepEqual(model.reset(), first);
    assert.deepEqual(run(), result);
    model.dispose();
    assert.throws(() => model.reset({ habitat: {} }), /disposed/i);
    assert.throws(() => model.getSnapshot(), /disposed/i);
    return result;
  };
  const one = replay(1);
  assert.deepEqual(replay(2), one);
  assert.deepEqual(replay(5), one);
});
