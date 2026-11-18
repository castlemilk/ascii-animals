import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createDragonfly, replayDragonfly, DRAGONFLY_DEFAULTS, DRAGONFLY_LIMITS,
  writeDragonflyGeometry, PROPOSED_DRAGONFLY_MATERIALS } from '../lib/index.js';
import { rasterizeDragonfly, gridToText } from '../lib/preview.js';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const distance = (a, b) => Math.hypot(a.x-b.x, a.y-b.y, (a.z ?? 0)-(b.z ?? 0));
const next = (model, events = []) => model.step(model.getState().tick+1, events);
const close = (a, b, tolerance = 1e-11) => assert(Math.abs(a-b) <= tolerance, `${a} differs from ${b}`);
const replay = {
  schemaVersion: 1, speciesVersion: 'dragonfly-v1', options: { seed: 17 }, ticks: 360,
  events: [
    { type: 'pointer', tick: 45, seq: 0, x: .75, y: -.5 },
    { type: 'dart', tick: 100, seq: 1 },
    { type: 'leave', tick: 180, seq: 2 },
    { type: 'pointer', tick: 280, seq: 3, x: -.8, y: .4 },
    { type: 'dart', tick: 330, seq: 4 },
  ],
};

test('default configuration is explicit, immutable and rejects coercion/unknown fields', () => {
  const model = createDragonfly();
  assert.deepEqual(model.getOptions(), DRAGONFLY_DEFAULTS);
  assert.equal(model.species.tickRate, 60);
  assert(Object.isFrozen(model.getOptions()));
  for (const bad of [null, [], { seed: -1 }, { seed: 1.5 }, { seed: 2**32 }, { seed: '17' },
    { wingHz: NaN }, { wingHz: Infinity }, { wingHz: undefined }, { wingAmplitude: -.1 },
    { followPointer: 1 }, { motion: 'realtime' }, { trackingAcceleration: 0 }, { dartTicks: 18.2 },
    { cooldownTicks: 601 }, { hiddenEngineOption: true }])
    assert.throws(() => createDragonfly(bad), undefined, JSON.stringify(bad));
  assert.equal(createDragonfly({ seed: 0 }).getOptions().seed, 0);
  assert.equal(createDragonfly({ seed: 0xffffffff, wingAmplitude: 0, hoverRadius: 0 }).getOptions().seed, 0xffffffff);
});

test('invalid configuration is atomic; seed changes are reset-only', () => {
  const model = createDragonfly(); next(model);
  const state = model.getState(), options = model.getOptions();
  assert.throws(() => model.configure({ trackingSpeed: .7, motion: 'static', wingHz: NaN }));
  assert.strictEqual(model.getState(), state); assert.strictEqual(model.getOptions(), options);
  assert.throws(() => model.configure({ seed: 42 }), /reset/);
  model.setPaused(true);
  const changed = model.configure({ trackingSpeed: .5, dartTicks: 24 });
  assert.equal(changed.trackingSpeed, .5); assert.equal(changed.dartTicks, 24);
  assert.equal(model.getState().tick, 1); assert.equal(model.getStatus().paused, true);
});

test('ordered input rejects an entire malformed batch before any state mutation', () => {
  const invalid = [
    [{ type: 'pointer', tick: 2, seq: 0, x: 0, y: 0 }],
    [{ type: 'pointer', tick: 1, seq: -1, x: 0, y: 0 }],
    [{ type: 'pointer', tick: 1, seq: .5, x: 0, y: 0 }],
    [{ type: 'pointer', tick: 1, seq: 2**53, x: 0, y: 0 }],
    [{ type: 'pointer', tick: 1, seq: 0, x: 1.01, y: 0 }],
    [{ type: 'pointer', tick: 1, seq: 0, x: Infinity, y: 0 }],
    [{ type: 'pointer', tick: 1, seq: 0, x: '0', y: 0 }],
    [{ type: 'pointer', tick: 1, seq: 0, x: 0, y: 0, pressure: 1 }],
    [{ type: 'dart', tick: 1, seq: 0, direction: { x: 0, y: 0 } }],
    [{ type: 'dart', tick: 1, seq: 0, direction: undefined }],
    [{ type: 'startle', tick: 1, seq: 0 }],
    [{ type: 'pointer', tick: 1, seq: 0, x: 1, y: -1 }, { type: 'leave', tick: 1, seq: 0 }],
    [{ type: 'pointer', tick: 1, seq: 0, x: 1, y: -1 }, { type: 'dart', tick: 1, seq: 1, direction: { x: NaN, y: 0 } }],
    Array.from({ length: 17 }, (_, seq) => ({ type: 'leave', tick: 1, seq })),
  ];
  for (const events of invalid) {
    const model = createDragonfly(), state = model.getState();
    assert.throws(() => model.step(1, events));
    assert.strictEqual(model.getState(), state);
  }
  const model = createDragonfly();
  for (const tick of [0, 2, .5, NaN, Infinity, '1']) assert.throws(() => model.step(tick));
  next(model, [{ type: 'pointer', tick: 1, seq: 8, x: 1, y: -1 }]);
  const state = model.getState();
  assert.throws(() => next(model, [{ type: 'leave', tick: 2, seq: 8 }]));
  assert.strictEqual(model.getState(), state);
  next(model, [{ type: 'leave', tick: 2, seq: 9 }]);
  assert.equal(model.getState().target, null);
});

test('bounded batches preserve sequence order and only the first eligible dart starts', () => {
  const model = createDragonfly({ hoverRadius: 0 });
  const events = [
    { type: 'pointer', tick: 1, seq: 0, x: -1, y: 0 },
    ...Array.from({ length: 15 }, (_, i) => ({ type: 'dart', tick: 1, seq: i+1 })),
  ];
  const result = model.step(1, events);
  assert.equal(result.acceptedDart, true); assert.equal(result.ignoredDarts, 14);
  assert.equal(result.state.lastSeq, 15); assert.equal(result.state.behavior.kind, 'dart');
  assert(result.state.behavior.to.x < 0, 'Earlier pointer is used by the subsequent dart');
  const target = result.state.behavior.to;
  const repeated = next(model, [{ type: 'dart', tick: 2, seq: 16, direction: { x: 1, y: 0 } }]);
  assert.equal(repeated.acceptedDart, false); assert.equal(repeated.ignoredDarts, 1);
  assert.deepEqual(repeated.state.behavior.to, target);
});

test('fixed event replay has identical state, geometry and cells with 1/2/5-tick render grouping', () => {
  const outcomes = [1, 2, 5].map(group => {
    const model = replayDragonfly(replay, group);
    const geometry = model.sample();
    const grid = rasterizeDragonfly(geometry, { cols: 120, rows: 64, view: 'oblique', neutral: false });
    return { state: digest(model.getState()), samples: digest(geometry), cells: digest([...grid.chars]), text: gridToText(grid) };
  });
  assert.deepEqual(outcomes[1], outcomes[0]); assert.deepEqual(outcomes[2], outcomes[0]);
  const lines = outcomes[0].text.split('\n');
  assert.equal(lines.length, 64); assert(lines.every(line => line.length === 120));
  assert.match(outcomes[0].text, /^[\x20-\x7e\n]+$/);
});

test('seeds change local wing phases without changing anatomy or another instance', () => {
  const first = createDragonfly({ seed: 17 }), second = createDragonfly({ seed: 991 });
  const untouched = digest(second.sample());
  assert.notEqual(digest(first.sample()), untouched);
  for (let i = 0; i < 60; i++) next(first);
  first.reset(123);
  assert.equal(digest(second.sample()), untouched); assert.equal(second.getState().tick, 0);
  assert.equal(first.sample().wings.length, second.sample().wings.length);
});

test('tracking acceleration, speed, heading rate and root bounds survive abrupt targets', () => {
  for (const motion of ['full', 'slow']) {
    const model = createDragonfly({ motion, trackingSpeed: .8, trackingAcceleration: 4, trackingReach: .4, hoverRadius: .08 });
    const pace = motion === 'slow' ? .25 : 1;
    for (let tick = 1; tick <= 720; tick++) {
      const previous = model.getState();
      next(model, [{ type: 'pointer', tick, seq: tick-1, x: Math.sign(Math.sin(tick*.2)), y: Math.sign(Math.cos(tick*.17)) }]);
      const state = model.getState();
      assert(distance(state.velocity, previous.velocity) <= 4*pace/60 + 1e-12);
      assert(Math.hypot(state.velocity.x, state.velocity.y) <= .8*pace + 1e-12);
      assert(Math.abs(state.heading-previous.heading) <= .012 + 1e-12);
      assert(Math.abs(state.position.x) <= DRAGONFLY_LIMITS.rootX);
      assert(Math.abs(state.position.y) <= DRAGONFLY_LIMITS.rootY);
      assert.equal(state.behavior.kind, 'approach');
    }
  }
});

test('dart carries the incoming velocity, ends stationary, then recovers and cools down in order', () => {
  const model = createDragonfly({ hoverRadius: 0 });
  for (let tick = 1; tick <= 40; tick++) next(model, tick === 1 ? [{ type: 'pointer', tick, seq: 0, x: .8, y: -.3 }] : []);
  const before = model.getState(), triggerTick = before.tick+1;
  const first = next(model, [{ type: 'dart', tick: triggerTick, seq: 1, direction: { x: 1, y: 0 } }]).state;
  assert.equal(first.behavior.kind, 'dart');
  assert.deepEqual(first.behavior.from, before.position); assert.deepEqual(first.behavior.initialVelocity, before.velocity);
  const destination = first.behavior.to, phases = ['dart'], trajectory = [before.position, first.position];
  let last = first, seq = 1, enteredRecoveryAt = 0, enteredCooldownAt = 0, endedAt = 0;
  for (let i = 1; i <= 180; i++) {
    const tick = model.getState().tick+1;
    const result = next(model, [{ type: 'dart', tick, seq: ++seq }]);
    const state = result.state;
    if (!enteredRecoveryAt) trajectory.push(state.position);
    if (last.behavior.kind !== 'idle' && last.behavior.kind !== 'approach') assert.equal(result.acceptedDart, false);
    if (phases.at(-1) !== state.behavior.kind) phases.push(state.behavior.kind);
    assert(distance(last.position, state.position) < .08, 'No teleport at a state boundary');
    if (state.behavior.kind === 'recover' || state.behavior.kind === 'cooldown') {
      assert.deepEqual(state.position, destination); assert.deepEqual(state.velocity, { x: 0, y: 0 });
    }
    if (state.behavior.kind === 'recover' && !enteredRecoveryAt) enteredRecoveryAt = tick;
    if (state.behavior.kind === 'cooldown' && !enteredCooldownAt) enteredCooldownAt = tick;
    if ((state.behavior.kind === 'idle' || state.behavior.kind === 'approach') && enteredCooldownAt) { endedAt = tick; break; }
    last = state;
  }
  assert.deepEqual(phases, ['dart','recover','cooldown','approach']);
  assert.equal(enteredRecoveryAt-triggerTick+1, 20);
  assert.equal(enteredCooldownAt-enteredRecoveryAt, 48);
  assert.equal(endedAt-enteredCooldownAt, 90);
  // Independent cubic interpolation of actual positions checks the two path derivatives.
  // It catches a renderer that stores initialVelocity correctly but ignores it in translation.
  for (const axis of ['x','y']) {
    const startDerivative = (-11*trajectory[0][axis]+18*trajectory[1][axis]-9*trajectory[2][axis]+2*trajectory[3][axis])*10;
    close(startDerivative, before.velocity[axis], 1e-10);
    const end = trajectory.length-1;
    const endDerivative = (11*trajectory[end][axis]-18*trajectory[end-1][axis]+9*trajectory[end-2][axis]-2*trajectory[end-3][axis])*10;
    close(endDerivative, 0, 1e-10);
  }
  assert(next(model, [{ type: 'dart', tick: endedAt+1, seq: ++seq }]).acceptedDart);
});

test('slow mode stretches dart travel; motion changes preserve pause and cancel a fast response', () => {
  const slow = createDragonfly({ motion: 'slow' });
  next(slow, [{ type: 'dart', tick: 1, seq: 0 }]);
  assert.equal(slow.getState().behavior.duration, 80);
  const fast = createDragonfly(); next(fast, [{ type: 'dart', tick: 1, seq: 0 }]);
  const position = fast.getState().position, tick = fast.getState().tick;
  fast.setPaused(true); fast.configure({ motion: 'slow' });
  assert.equal(fast.getState().behavior.kind, 'idle'); assert.deepEqual(fast.getState().position, position);
  assert.equal(fast.getState().tick, tick); assert.equal(fast.getStatus().paused, true);
});

test('all four wing roots stay on the thorax and blade lengths stay rigid across changing poses', () => {
  const model = createDragonfly({ wingAmplitude: .4, wingHz: 6 });
  const lengths = new Map(model.sample().wings.map(wing => [wing.id, distance(wing.root, wing.tip)]));
  const angleHistories = new Map([...lengths.keys()].map(key => [key, []]));
  for (let tick = 1; tick <= 240; tick++) {
    const events = tick === 1 ? [{ type: 'pointer', tick, seq: 0, x: .8, y: -.8 }] :
      tick === 90 ? [{ type: 'dart', tick, seq: 1, direction: { x: -1, y: .4 } }] : [];
    next(model, events);
    if (tick % 4 !== 0) continue;
    const state = model.getState(), geometry = model.sample();
    assert.equal(geometry.wings.length, 4); assert.equal(new Set(geometry.wings.map(w => w.id)).size, 4);
    assert(geometry.samples.length <= 6144);
    for (const point of geometry.samples) {
      assert([point.x,point.y,point.z,point.tone].every(Number.isFinite));
      assert(point.tone >= 0 && point.tone <= 1);
      assert(Math.abs(point.x) < 2.5 && point.y > -1.5 && point.y < 2.5 && Math.abs(point.z) < 1);
    }
    for (const wing of geometry.wings) {
      const dx = wing.root.x-state.position.x, dy = wing.root.y-state.position.y;
      const localX = Math.cos(state.heading)*dx + Math.sin(state.heading)*dy;
      const localY = -Math.sin(state.heading)*dx + Math.cos(state.heading)*dy;
      assert((localX/.18)**2 + ((localY+.04)/.31)**2 < 1, 'Root lies inside the thorax ellipse');
      assert(geometry.samples.some(p => p.part === wing.id && distance(p, wing.root) < 1e-12), 'Wing sampling includes its own root');
      close(distance(wing.root, wing.tip), lengths.get(wing.id));
      assert(Math.abs(wing.angle) <= .4 + 1e-12);
      angleHistories.get(wing.id).push(wing.angle);
    }
    assert(distance(...geometry.eyes) > .2 && distance(...geometry.eyes) < .4);
    assert(distance(geometry.abdomenTip, state.position) > 1.5);
  }
  assert.equal(new Set([...angleHistories.values()].map(digest)).size, 4, 'All four wings have distinct phase histories');
});

test('abdomen has ten tapered bounded segments; geometry returned to callers cannot mutate model state', () => {
  const model = createDragonfly({ motion: 'static' });
  const geometry = model.sample(), abdomen = geometry.samples.filter(p => p.part === 'abdomen');
  const collars = [...new Set(abdomen.filter(p => p.material === 'band').map(p => p.y.toFixed(6)))].map(Number).sort((a,b) => a-b);
  assert.equal(collars.length-1, 10);
  for (let i = 1; i < collars.length; i++) {
    assert(collars[i]-collars[i-1] > .1 && collars[i]-collars[i-1] < .2);
    assert(abdomen.some(p => p.material === 'body' && p.y > collars[i-1] && p.y < collars[i]));
  }
  const width = points => Math.max(...points.map(p => p.x))-Math.min(...points.map(p => p.x));
  assert(width(abdomen.filter(p => p.y < .4)) > 2.5*width(abdomen.filter(p => p.y > 1.5)));
  const before = digest(model.sample());
  geometry.samples[0].x = 999; geometry.wings[0].root.x = 999;
  assert.equal(digest(model.sample()), before, 'Geometry arrays are fresh per sample, not borrowed simulation buffers');
});

test('abdomen curvature stays continuous when the independent wing clock wraps', () => {
  const model = createDragonfly({ hoverRadius: 0 });
  let prior = model.sample().abdomenTip, priorPhase = model.getState().wingPhase;
  let regularMaximum = 0, wrapMaximum = 0;
  for (let tick = 1; tick <= 100; tick++) {
    next(model);
    const tip = model.sample().abdomenTip, phase = model.getState().wingPhase;
    const movement = distance(tip, prior);
    if (phase < priorPhase) wrapMaximum = Math.max(wrapMaximum, movement);
    else regularMaximum = Math.max(regularMaximum, movement);
    prior = tip; priorPhase = phase;
  }
  assert(regularMaximum > 0, 'The intended secondary curvature is sampled');
  assert(wrapMaximum <= regularMaximum*1.1 + 1e-9,
    `Clock wrap must not produce a tail pop: regular=${regularMaximum}, wrap=${wrapMaximum}`);
  // At the default 3 Hz presentation beat, gentle +/-0.016 secondary curvature
  // must stay below 0.006 units per tick. The old fractional wrapped phase jumped 0.052736.
  assert(wrapMaximum < .006, 'A stationary body has no segment-sized one-tick tail jump');
});

test('state and options are deeply frozen snapshots; caller mutation never changes future simulation', () => {
  const model = createDragonfly(); next(model, [{ type: 'pointer', tick: 1, seq: 0, x: 1, y: -1 }]);
  next(model, [{ type: 'dart', tick: 2, seq: 1 }]);
  const state = model.getState();
  for (const action of [() => { state.tick = 99; }, () => { state.position.x = 99; },
    () => { state.target.x = 99; }, () => { state.behavior.duration = 1; },
    () => { state.behavior.from.y = 99; }, () => { model.getOptions().seed = 99; }]) assert.throws(action, TypeError);
  assert.equal(model.getState().tick, 2);
  next(model); assert.equal(state.tick, 2, 'Earlier snapshots stay unchanged after a later tick');
});

test('pause/static steps validate but consume no tick, event or seq; reset preserves pause/options', () => {
  const model = createDragonfly(); model.setPaused(true);
  const initial = model.getState();
  const event = { type: 'pointer', tick: 1, seq: 0, x: .5, y: 0 };
  assert.equal(next(model, [event]).kind, 'resting'); assert.strictEqual(model.getState(), initial);
  assert.throws(() => next(model, [{ ...event, x: NaN }]));
  model.configure({ wingHz: 2 }); model.reset(99);
  assert.equal(model.getStatus().paused, true); assert.equal(model.getState().tick, 0);
  assert.equal(model.getOptions().wingHz, 2); assert.equal(model.getOptions().seed, 99);
  model.setPaused(false); assert.equal(next(model, [event]).kind, 'advanced');
  model.configure({ motion: 'static' });
  const poster = digest(model.sample()), state = model.getState();
  for (let i = 0; i < 12; i++) assert.equal(next(model, [{ type: 'dart', tick: 2, seq: 1 }]).kind, 'resting');
  assert.strictEqual(model.getState(), state); assert.equal(digest(model.sample()), poster);
  model.setStaticPose(1); assert.notEqual(digest(model.sample()), poster); assert.equal(model.getState().tick, 1);
  assert.equal(model.getStatus().motion, 'static');
});

test('clearTarget and disposal have explicit local semantics and leave other instances alive', () => {
  const model = createDragonfly(), other = createDragonfly();
  next(model, [{ type: 'pointer', tick: 1, seq: 0, x: 1, y: 1 }]); model.clearTarget();
  assert.equal(model.getState().target, null); assert.equal(model.getState().tick, 1);
  model.dispose(); model.dispose();
  assert.equal(model.getStatus().disposed, true); assert.equal(model.getStatus().paused, true);
  for (const action of [() => next(model), () => model.reset(), () => model.configure({}),
    () => model.setPaused(false), () => model.clearTarget(), () => model.setStaticPose(1), () => model.sample()])
    assert.throws(action, /disposed/);
  next(other); assert.equal(other.getState().tick, 1); assert.equal(other.getStatus().disposed, false);
});

test('provisional writer preflights capacity and reports partial rejection without hiding samples', () => {
  const model = createDragonfly(), geometry = model.sample(), required = geometry.samples.length;
  let calls = 0;
  const insufficient = writeDragonflyGeometry(model, { capacity: required, count: 1, write() { calls++; return true; } });
  assert.deepEqual(insufficient, { kind: 'insufficient-capacity', written: 0, required }); assert.equal(calls, 0);
  const rejected = writeDragonflyGeometry(model, { capacity: 6144, count: 0, write() { return calls++ < 12; } });
  assert.deepEqual(rejected, { kind: 'writer-rejected', written: 12, required }); assert.equal(calls, 13);
  const points = [];
  const full = writeDragonflyGeometry(model, { capacity: 6144, count: 0, write(...point) { points.push(point); return true; } });
  assert.deepEqual(full, { kind: 'complete', written: required, required });
  assert.deepEqual(points, geometry.samples.map(p => [p.x,p.y,p.z,p.tone,PROPOSED_DRAGONFLY_MATERIALS[p.material],p.stableIndex]));
  for (const bad of [{ capacity: -1, count: 0 }, { capacity: 6144, count: 6145 }, { capacity: Infinity, count: 0 },
    { capacity: 6144.5, count: 0 }, { capacity: 6144, count: .1 }])
    assert.throws(() => writeDragonflyGeometry(model, { ...bad, write() { throw new Error('Must validate first'); } }), RangeError);
});

test('replay rejects stale logs, unsupported versions, missing required metadata and work overflow', () => {
  const invalid = [
    { ...replay, schemaVersion: 2 }, { ...replay, speciesVersion: 'dragonfly-v2' },
    { ...replay, ticks: -1 }, { ...replay, ticks: 21601 }, { ...replay, options: null },
    { ...replay, extra: true }, { ...replay, events: [{ type: 'leave', tick: 361, seq: 0 }] },
    { ...replay, events: [{ type: 'leave', tick: 2, seq: 0 }, { type: 'leave', tick: 1, seq: 1 }] },
    { ...replay, events: [{ type: 'leave', tick: 1, seq: 0 }, { type: 'leave', tick: 2, seq: 0 }] },
    { ...replay, events: Array.from({ length: 17 }, (_,seq) => ({ type: 'leave', tick: 1, seq })) },
    { ...replay, events: Array.from({ length: 4097 }, (_,seq) => ({ type: 'leave', tick: 1, seq })) },
    { ...replay, options: { motion: 'static' } },
  ];
  for (const log of invalid) assert.throws(() => replayDragonfly(log));
  const { options: omitted, ...withoutOptions } = replay;
  assert.throws(() => replayDragonfly(withoutOptions), 'Required initial options object must not be silently defaulted');
  assert.throws(() => replayDragonfly({ ...replay, options: undefined }));
  assert.throws(() => replayDragonfly(replay, 0)); assert.throws(() => replayDragonfly(replay, 1.5));
  assert.equal(replayDragonfly({ ...replay, options: { motion: 'static' }, ticks: 0, events: [] }).getState().tick, 0);
});

test('core imports and executes without browser globals, host clocks or ambient randomness', () => {
  const url = new URL('../lib/index.js', import.meta.url).href;
  const script = `
    for (const name of ['window','document','performance']) Object.defineProperty(globalThis,name,{get(){throw new Error('Unexpected '+name)}});
    Date.now=()=>{throw new Error('Unexpected Date.now')};
    Math.random=()=>{throw new Error('Unexpected Math.random')};
    const {createDragonfly}=await import(${JSON.stringify(url)});
    const a=createDragonfly({seed:17});a.step(1);a.sample();a.dispose();
  `;
  const result = spawnSync(process.execPath, ['--input-type=module','-e',script], { encoding:'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
