import test from 'node:test';
import assert from 'node:assert/strict';
import { createGecko, DEFAULT_GECKO_OPTIONS, GECKO_LIMITS, normalizeGuide } from '../compiled/gecko.js';
import { sampleGecko, getGeckoAnatomy } from '../compiled/geometry.js';
import { renderGeckoGrid } from '../compiled/preview.js';

// These are acceptance tests of the authored contract, not browser/Canvas evidence.
const TAU = 2 * Math.PI;
const EPS = 1e-9;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clone = value => structuredClone(value);
const eventLog = Object.freeze([
  { tick: 1, seq: 1, type: 'guide', x: .9, y: -.9 },
  { tick: 181, seq: 2, type: 'startle' },
  { tick: 320, seq: 3, type: 'guide', x: -.8, y: .5 },
  { tick: 570, seq: 4, type: 'leave' },
]);
const minimum = {
  creepSpeed: .02, turnRate: .15, stride: .04, stepTicks: 12,
  tailLength: .75, toeSpread: .9, curlStrength: .25, tailSway: 0,
  breathing: 0, startleTicks: 6, retreatTicks: 24, retreatDistance: .05,
  recoveryTicks: 60, cooldownTicks: 30,
};
const maximum = {
  creepSpeed: .18, turnRate: 1.2, stride: .16, stepTicks: 30,
  tailLength: 1.05, toeSpread: 1.15, curlStrength: 1, tailSway: .08,
  breathing: .018, startleTicks: 60, retreatTicks: 90, retreatDistance: .18,
  recoveryTicks: 240, cooldownTicks: 300,
};

function checkAnatomy(state) {
  const anatomy = getGeckoAnatomy(state);
  assert.equal(anatomy.limbs.length, 4, 'exactly four connected limbs');
  assert.equal(new Set(anatomy.limbs.map(limb => limb.id)).size, 4);
  assert.ok(anatomy.tail.length >= 20, 'tail is a continuous sampled curve');
  const root = {
    x: state.position.x - .23 * Math.cos(state.heading),
    y: state.position.y - .23 * Math.sin(state.heading),
  };
  assert.ok(distance(anatomy.tail[0], root) <= EPS, 'tail remains attached to the pelvis');
  assert.ok(anatomy.tail[0].radius > anatomy.tail.at(-1).radius * 10, 'clear long taper');
  let arcLength = 0;
  for (let i = 0; i < anatomy.tail.length; i++) {
    const p = anatomy.tail[i];
    assert.ok([p.x, p.y, p.radius].every(Number.isFinite));
    assert.ok(p.radius > 0, 'tail never vanishes into a detached tip');
    if (i > 0) {
      assert.ok(p.radius <= anatomy.tail[i - 1].radius + EPS, 'monotone taper');
      const segment = distance(p, anatomy.tail[i - 1]);
      assert.ok(segment > 0 && segment < .08, 'continuous tail segments, no jump');
      arcLength += segment;
    }
  }
  assert.ok(arcLength >= .6 && arcLength <= .95, 'tail arc length stays in authored range');
  for (const limb of anatomy.limbs) {
    const foot = state.feet.find(f => f.id === limb.id);
    assert.ok(foot);
    assert.equal(limb.pads.length, 5, 'five toe pads per foot');
    assert.deepEqual(limb.palm, foot.position);
    assert.equal(limb.angle, foot.angle);
    assert.ok(distance(limb.shoulder, limb.palm) <= .44 + EPS, 'limb cannot exceed two-bone reach');
    assert.ok(distance(limb.shoulder, limb.elbow) <= .19 + EPS, 'upper segment has bounded length');
    assert.ok(distance(limb.elbow, limb.palm) <= .25 + EPS, 'lower segment has bounded length');
    for (const point of [limb.shoulder, limb.elbow, limb.palm, ...limb.pads]) {
      assert.ok([point.x, point.y].every(Number.isFinite));
    }
  }
  return anatomy;
}

function checkSamples(state) {
  const samples = [];
  const before = clone(state);
  const report = sampleGecko(state, point => samples.push(point));
  assert.deepEqual(state, before, 'sampling is read-only');
  assert.equal(report.samples, samples.length);
  assert.ok(report.capacity <= 12288);
  assert.ok(samples.length > 500 && samples.length <= report.capacity);
  const ids = new Set();
  const parts = new Set();
  for (const point of samples) {
    assert.ok([point.x, point.y, point.z, point.tone, point.stableId].every(Number.isFinite));
    assert.ok(Math.abs(point.x) <= 1.7 + EPS && Math.abs(point.y) <= 1.3 + EPS,
      `sample must fit the fixed preview window: ${JSON.stringify(point)}`);
    assert.ok(point.tone >= 0 && point.tone <= 1);
    assert.ok(Number.isSafeInteger(point.stableId) && point.stableId >= 0);
    assert.ok(!ids.has(point.stableId), 'sample IDs are unique within one animal');
    ids.add(point.stableId);
    parts.add(point.part);
    assert.ok(['skin', 'pad', 'eye', 'pupil'].includes(point.material));
  }
  for (const part of ['body', 'neck', 'head', 'tail', 'limb', 'digit', 'pad', 'eye']) {
    assert.ok(parts.has(part), `missing anatomical surface ${part}`);
  }
  return samples;
}

test('defaults are resolved, versioned, independent and resettable', () => {
  const first = createGecko();
  const second = createGecko({ seed: 37 });
  const initial = first.getSnapshot();
  assert.equal(initial.version, 1);
  assert.equal(initial.tick, 0);
  assert.equal(initial.seed, 37);
  assert.equal(initial.heading, -.24);
  assert.deepEqual(initial.options, DEFAULT_GECKO_OPTIONS);
  assert.equal(initial.behavior.kind, 'idle');
  assert.equal(initial.feet.length, 4);
  assert.ok(initial.feet.every(foot => foot.phase === 'stance'));
  first.step([{ tick: 1, seq: 1, type: 'guide', x: 1, y: 1 }]);
  assert.deepEqual(second.getSnapshot(), initial, 'instances do not share mutable state');
  assert.deepEqual(first.reset(), initial, 'default replay starts from the same state');
  assert.ok(Object.keys(GECKO_LIMITS).length > 0, 'resource limits are exported');
});

test('reference event replay is identical with 1, 2 and 5 tick render groups', () => {
  const run = group => {
    const model = createGecko({ seed: 37 });
    const checkpoints = [];
    for (let tick = 1; tick <= 600; tick++) {
      model.step(eventLog.filter(event => event.tick === tick));
      if (tick % group === 0) renderGeckoGrid(model.getSnapshot(), { cols: 112, rows: 50 });
      if (tick % 30 === 0) checkpoints.push(model.getSnapshot());
    }
    return { checkpoints, final: model.getSnapshot(), text: renderGeckoGrid(model.getSnapshot()).text };
  };
  const single = run(1);
  assert.deepEqual(run(2), single);
  assert.deepEqual(run(5), single);
  const changed = createGecko({ seed: 37 });
  for (let tick = 1; tick <= 600; tick++) {
    changed.step(eventLog.filter(event => event.tick === tick && event.type !== 'startle'));
  }
  assert.notDeepEqual(changed.getSnapshot(), single.final, 'a different deliberate event changes the result');
});

test('invalid config and updates reject atomically; documented numeric endpoints work', () => {
  for (const options of [minimum, maximum]) {
    assert.deepEqual(createGecko({ options }).getSnapshot().options, options);
  }
  for (const config of [
    { seed: -1 }, { seed: 2 ** 32 }, { seed: .1 }, { seed: NaN },
    { heading: Infinity }, { heading: Math.PI + .001 }, { heading: -Math.PI - .001 },
    { seed: 37, unknown: true }, { options: { unknown: 1 } },
  ]) assert.throws(() => createGecko(config));
  for (const seed of [0, 2 ** 32 - 1]) assert.equal(createGecko({ seed }).getSnapshot().seed, seed);
  const model = createGecko();
  model.step([{ tick: 1, seq: 1, type: 'guide', x: 1, y: 0 }]);
  for (const patch of [
    { creepSpeed: NaN }, { turnRate: Infinity }, { stride: -.1 },
    { stepTicks: 18.1 }, { stepTicks: 0 }, { tailLength: 1.051 },
    { toeSpread: .89 }, { curlStrength: 1.001 }, { tailSway: -.01 },
    { breathing: .019 }, { startleTicks: 5 }, { retreatTicks: 91 },
    { retreatDistance: .181 }, { recoveryTicks: 59 }, { cooldownTicks: 301 },
    { unknown: true }, { creepSpeed: .12, cooldownTicks: NaN },
  ]) {
    const before = model.getSnapshot();
    assert.throws(() => model.update(patch));
    assert.deepEqual(model.getSnapshot(), before);
  }
  const before = model.getSnapshot();
  model.update({ creepSpeed: .12, tailLength: .9 });
  const updated = model.getSnapshot();
  assert.equal(updated.options.creepSpeed, .12);
  assert.equal(updated.options.tailLength, .9);
  for (const key of ['seed', 'tick', 'lastSequence', 'position', 'heading', 'behavior', 'feet']) {
    assert.deepEqual(updated[key], before[key], `${key} preserved by an option patch`);
  }
  const reset = model.reset({ seed: 0, heading: Math.PI });
  assert.equal(reset.tick, 0);
  assert.equal(reset.lastSequence, 0);
  assert.equal(reset.seed, 0);
  assert.equal(reset.heading, Math.PI);
  assert.equal(reset.options.creepSpeed, .12, 'reset retains resolved options');
});

test('invalid next-tick input batches reject before any state mutation', () => {
  const model = createGecko();
  const valid = { tick: 1, seq: 1, type: 'guide', x: .9, y: -.9 };
  const invalid = [
    [{ ...valid, tick: 0 }], [{ ...valid, tick: 2 }], [{ ...valid, tick: 1.5 }],
    [{ ...valid, tick: NaN }], [{ ...valid, seq: -1 }], [{ ...valid, seq: .5 }],
    [{ ...valid, seq: Infinity }], [{ ...valid, x: NaN }], [{ ...valid, y: Infinity }],
    [{ ...valid, x: 1.0001 }], [{ ...valid, y: -1.0001 }],
    [{ ...valid, type: 'teleport' }], [valid, { ...valid, seq: 1 }],
    [{ ...valid, seq: 3 }, { ...valid, seq: 2 }],
    [valid, { tick: 1, seq: 2, type: 'guide', x: NaN, y: 0 }],
    Array.from({ length: 33 }, (_, i) => ({ tick: 1, seq: i + 1, type: 'leave' })),
  ];
  for (const batch of invalid) {
    const before = model.getSnapshot();
    assert.throws(() => model.step(batch));
    assert.deepEqual(model.getSnapshot(), before, `atomic rejection: ${JSON.stringify(batch)}`);
  }
  model.step([valid]);
  const before = model.getSnapshot();
  assert.throws(() => model.step([{ tick: 2, seq: 1, type: 'leave' }]));
  assert.deepEqual(model.getSnapshot(), before, 'sequence cannot be reused on a later tick');
});

test('pointer normalization uses CSS bounds, clamps edges, and rejects absent or nonfinite area', () => {
  const rect = { left: 120, top: 40, width: 800, height: 600 };
  assert.deepEqual(normalizeGuide(520, 340, rect), { x: 0, y: 0 });
  assert.deepEqual(normalizeGuide(120, 40, rect), { x: -1, y: -1 });
  assert.deepEqual(normalizeGuide(920, 640, rect), { x: 1, y: 1 });
  assert.deepEqual(normalizeGuide(-100, 900, rect), { x: -1, y: 1 });
  // The same relative position has the same result for a CSS resize; DPR is not an input.
  assert.deepEqual(normalizeGuide(320, 490, rect), { x: -.5, y: .5 });
  assert.deepEqual(normalizeGuide(220, 265, { ...rect, width: 400, height: 300 }), { x: -.5, y: .5 });
  for (const invalid of [
    { ...rect, width: 0 }, { ...rect, height: 0 }, { ...rect, width: -1 },
    { ...rect, height: -1 }, { ...rect, left: NaN }, { ...rect, top: Infinity },
    { ...rect, width: Infinity }, { ...rect, height: NaN },
  ]) assert.equal(normalizeGuide(520, 340, invalid), null);
  for (const [x, y] of [[NaN, 0], [0, Infinity], [-Infinity, 0]]) {
    assert.equal(normalizeGuide(x, y, rect), null);
  }
});

test('startle takes behavior priority; guidance preserves sequence order', () => {
  for (const startleFirst of [false, true]) {
    const model = createGecko();
    const types = startleFirst ? ['startle', 'guide'] : ['guide', 'startle'];
    const batch = types.map((type, index) => type === 'guide'
      ? { type, tick: 1, seq: index + 1, x: -.8, y: .5 }
      : { type, tick: 1, seq: index + 1 });
    const result = model.step(batch);
    assert.equal(result.state.behavior.kind, 'startle');
    assert.equal(result.inputs.length, 2);
    assert.ok(result.inputs.every(input => input.outcome === 'applied'));
    assert.ok(result.state.target, 'guidance remains available for curious recovery');
  }
  const model = createGecko();
  model.step([
    { tick: 1, seq: 1, type: 'guide', x: 1, y: 1 },
    { tick: 1, seq: 2, type: 'leave' },
  ]);
  assert.equal(model.getSnapshot().target, null);
});

test('response phases finish in order and repeated startles cannot extend cooldown', () => {
  const model = createGecko();
  const control = createGecko();
  model.step([{ tick: 1, seq: 1, type: 'startle' }]);
  control.step([{ tick: 1, seq: 1, type: 'startle' }]);
  const phases = ['startle'];
  let seq = 1;
  let maximumCurl = 0;
  let finishedAt = 0;
  for (let tick = 2; tick <= 450; tick++) {
    const busy = ['startle', 'retreat', 'recover', 'cooldown'].includes(model.getSnapshot().behavior.kind);
    const result = model.step(busy ? [{ tick, seq: ++seq, type: 'startle' }] : []);
    control.step();
    if (busy) {
      assert.deepEqual(result.inputs, [{ seq, type: 'startle', outcome: 'ignored', reason: 'busy' }]);
    }
    assert.deepEqual(result.state.behavior, control.getSnapshot().behavior,
      'rejected startles cannot reset a phase clock');
    maximumCurl = Math.max(maximumCurl, result.state.tailCurl);
    if (phases.at(-1) !== result.state.behavior.kind) phases.push(result.state.behavior.kind);
    if (result.state.behavior.kind === 'idle') { finishedAt = tick; break; }
  }
  assert.deepEqual(phases, ['startle', 'retreat', 'recover', 'cooldown', 'idle']);
  assert.ok(finishedAt > 250 && finishedAt < 400);
  assert.ok(maximumCurl > .8, 'the deliberate response produces a substantial tail curl');
  const again = model.step([{ tick: finishedAt + 1, seq: ++seq, type: 'startle' }]);
  assert.equal(again.state.behavior.kind, 'startle', 'cooldown eventually permits another deliberate response');
});

test('a deliberate startle holds first, then makes a short backward retreat with an attached tail', () => {
  const model = createGecko({ heading: 0 });
  const initial = model.getSnapshot();
  model.step([{ tick: 1, seq: 1, type: 'startle' }]);
  let retreatStart = null;
  let retreatEnd = null;
  for (let tick = 2; tick <= 90; tick++) {
    const state = model.step().state;
    if (state.behavior.kind === 'startle') {
      assert.deepEqual(state.position, initial.position, 'curl warning does not slide the body');
    }
    if (state.behavior.kind === 'retreat') {
      retreatStart ??= initial.position;
      retreatEnd = state.position;
      assert.ok(state.behavior.traveled >= 0 && state.behavior.traveled <= state.options.retreatDistance + EPS);
      checkAnatomy(state);
    }
  }
  assert.ok(retreatStart && retreatEnd);
  const traveled = distance(retreatStart, retreatEnd);
  assert.ok(traveled > .03 && traveled <= initial.options.retreatDistance + EPS,
    'response must include visible bounded travel, not just relabel a stationary pose');
  assert.ok(retreatEnd.x < retreatStart.x, 'retreat is opposite the remembered heading');
  assert.ok(Math.abs(retreatEnd.y - retreatStart.y) <= EPS);
});

test('creeping, reversal and response keep three toes planted and all limbs within reach', () => {
  for (const options of [{}, minimum, maximum]) {
    const model = createGecko({ seed: 37, options });
    let previous = model.getSnapshot();
    let previousAnatomy = checkAnatomy(previous);
    let stanceComparisons = 0;
    let swings = 0;
    const swingOrder = [];
    let sequence = 0;
    for (let tick = 1; tick <= 1200; tick++) {
      const events = [];
      if (tick === 1 || tick % 180 === 0) {
        const angle = tick / 180 * Math.PI * .55;
        events.push({ tick, seq: ++sequence, type: 'guide', x: Math.cos(angle), y: Math.sin(angle) });
      }
      if (tick === 301 || tick === 901) events.push({ tick, seq: ++sequence, type: 'startle' });
      const state = model.step(events).state;
      const anatomy = checkAnatomy(state);
      const swingFeet = state.feet.filter(foot => foot.phase === 'swing');
      assert.ok(swingFeet.length <= 1, 'only one foot may leave the ground at a time');
      assert.ok(state.feet.filter(foot => foot.phase === 'stance').length >= 3);
      swings += swingFeet.length;
      for (const foot of swingFeet) {
        if (previous.feet.find(candidate => candidate.id === foot.id).phase !== 'swing') swingOrder.push(foot.id);
      }
      for (const foot of state.feet) {
        const prior = previous.feet.find(candidate => candidate.id === foot.id);
        if (foot.phase === 'stance' && prior.phase === 'stance' && foot.plantedAt === prior.plantedAt) {
          assert.deepEqual(foot.position, prior.position, `${foot.id} stance palm slides at tick ${tick}`);
          assert.equal(foot.angle, prior.angle, `${foot.id} planted toe fan rotates at tick ${tick}`);
          assert.deepEqual(anatomy.limbs.find(limb => limb.id === foot.id).pads,
            previousAnatomy.limbs.find(limb => limb.id === foot.id).pads,
            `${foot.id} rendered toe pads slide despite a planted palm at tick ${tick}`);
          stanceComparisons++;
        }
      }
      assert.ok(Math.abs(state.position.x) <= .26 + EPS && Math.abs(state.position.y) <= .13 + EPS);
      assert.ok(Number.isFinite(state.heading));
      if (tick % 60 === 0) checkSamples(state);
      previous = state;
      previousAnatomy = anatomy;
    }
    assert.ok(stanceComparisons > 3000, 'exercise sustained contacts, not only initial pose');
    assert.ok(swings > 100, 'guidance must produce alternating steps');
    assert.ok(previous.stepsCompleted > 4, 'complete more than one gait cycle');
    const expectedOrder = ['front-left', 'rear-right', 'front-right', 'rear-left'];
    assert.ok(swingOrder.length > 4);
    swingOrder.forEach((id, index) => assert.equal(id, expectedOrder[index % 4], 'alternating diagonal-order steps'));
  }
});

test('full-turn silhouettes and option extremes emit finite, bounded original anatomy', () => {
  for (const options of [{}, minimum, maximum]) {
    for (let i = 0; i <= 8; i++) {
      const heading = -Math.PI + i / 8 * TAU;
      const model = createGecko({ seed: i, heading, options });
      checkAnatomy(model.getSnapshot());
      checkSamples(model.getSnapshot());
      model.step([{ tick: 1, seq: 1, type: 'startle' }]);
      for (let tick = 2; tick <= (options.startleTicks ?? 18) + 15; tick++) model.step();
      checkAnatomy(model.getSnapshot());
      checkSamples(model.getSnapshot());
    }
  }
});

test('cell output is bounded printable ASCII and cannot mutate state', () => {
  const state = createGecko().getSnapshot();
  const before = clone(state);
  for (const options of [{}, { cols: 112, rows: 50 }, { cols: 192, rows: 86 }, { neutral: true }]) {
    const grid = renderGeckoGrid(state, options);
    assert.deepEqual(state, before);
    assert.ok(grid.cols >= 112 && grid.cols <= 192);
    assert.ok(grid.rows >= 50 && grid.rows <= 86);
    assert.equal(grid.glyphs.length, grid.cols * grid.rows);
    assert.equal(grid.tones.length, grid.glyphs.length);
    assert.equal(grid.materials.length, grid.glyphs.length);
    const rows = grid.text.split('\n');
    assert.equal(rows.length, grid.rows);
    assert.ok(rows.every(row => row.length === grid.cols));
    assert.match(grid.text, /^[ .:\-=+*#%@oO|\n]*$/);
    assert.ok(grid.occupied > 100 && grid.occupied < grid.cols * grid.rows);
  }
  for (const options of [
    { cols: 111 }, { cols: 193 }, { rows: 49 }, { rows: 87 },
    { cols: NaN }, { cols: 112.5 }, { rows: Infinity }, {cols:null}, {rows:null},
    { [Symbol('unknown')]: 1 }, new Date(),
  ]) assert.throws(() => renderGeckoGrid(state, options));
});

test('minimum-grid toe-pad fans retain at least three separated marks per foot in reviewed orientations', () => {
  // Post-fix regression from the independent visual critique. Five analytic toe
  // pads remain mandatory, but this test does not claim all five resolve alone.
  for (const heading of [-.24, Math.PI, Math.PI / 2, -Math.PI / 2]) {
    const state = createGecko({ seed: 37, heading }).getSnapshot();
    const anatomy = getGeckoAnatomy(state);
    const grid = renderGeckoGrid(state, { cols: 112, rows: 50 });
    const byFoot = new Map(anatomy.limbs.map(limb => [limb.id, new Set()]));
    for (let index = 0; index < grid.materials.length; index++) {
      if (grid.materials[index] !== 1) continue; // Preview's declared pad material.
      const col = index % grid.cols;
      const row = Math.floor(index / grid.cols);
      const center = { x: (col + .5) / grid.cols * 3.4 - 1.7, y: (row + .5) / grid.rows * 2.6 - 1.3 };
      let nearest = anatomy.limbs[0];
      for (const limb of anatomy.limbs) {
        if (distance(center, limb.palm) < distance(center, nearest.palm)) nearest = limb;
      }
      byFoot.get(nearest.id).add(index);
    }
    for (const limb of anatomy.limbs) {
      assert.equal(limb.pads.length, 5, 'the analytic foot still has five pads');
      const remaining = new Set(byFoot.get(limb.id));
      let components = 0;
      while (remaining.size > 0) {
        const first = remaining.values().next().value;
        remaining.delete(first);
        const stack = [first];
        components++;
        while (stack.length > 0) {
          const index = stack.pop();
          const col = index % grid.cols;
          const row = Math.floor(index / grid.cols);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const x = col + dx;
            const y = row + dy;
            if (x < 0 || x >= grid.cols || y < 0 || y >= grid.rows) continue;
            const next = y * grid.cols + x;
            if (remaining.delete(next)) stack.push(next);
          }
        }
      }
      assert.ok(components >= 3,
        `${limb.id} at heading ${heading}: ${components} separated pad marks; require at least 3 at 112x50`);
    }
  }
});

test('snapshots are defensive, reset validation is atomic, disposal is terminal and idempotent', () => {
  const model = createGecko();
  const expected = model.getSnapshot();
  const snapshot = model.getSnapshot();
  // Frozen snapshots and detached mutable copies are both valid defensive results.
  try { snapshot.position.x = 99; } catch {}
  try { snapshot.options.creepSpeed = 99; } catch {}
  try { snapshot.feet[0].position.x = 99; } catch {}
  try { snapshot.feet.length = 0; } catch {}
  assert.deepEqual(model.getSnapshot(), expected);
  for (const reset of [{ seed: -1 }, { heading: NaN }, { unknown: true }]) {
    assert.throws(() => model.reset(reset));
    assert.deepEqual(model.getSnapshot(), expected);
  }
  model.dispose();
  model.dispose();
  assert.equal(model.disposed, true);
  for (const action of [
    () => model.getSnapshot(), () => model.step(),
    () => model.update({ creepSpeed: .1 }), () => model.reset(),
  ]) assert.throws(action, /dispos/i);
});
