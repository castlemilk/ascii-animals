import test from 'node:test';
import assert from 'node:assert/strict';
import { createFox, staticFoxPose, normalizeFoxPointer, FOX_DEFAULTS, FOX_LIMITS, foxSpecies } from '../lib/model.js';
import { buildFoxGrid } from '../lib/preview.js';

// These checks come from AUTHORING.md's declared requirements. They intentionally
// exercise the public model/pose/grid outputs instead of duplicating the equations.
const legIds = ['far-front', 'far-hind', 'near-front', 'near-hind'];
const groundY = 0.55;
const scenario = new Map([
  [45, [{ tick: 45, seq: 0, type: 'guide', x: 0.8, y: 0.15 }]],
  [150, [{ tick: 150, seq: 1, type: 'pounce' }]],
  [160, [{ tick: 160, seq: 2, type: 'pounce' }]],
  [340, [{ tick: 340, seq: 3, type: 'leave' }]],
  [400, [{ tick: 400, seq: 4, type: 'guide', x: -0.7, y: 0.2 }]],
  [530, [{ tick: 530, seq: 5, type: 'pounce' }]],
]);
const near = (actual, expected, tolerance = 1e-10, message = '') =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} != ${expected}`);

function advanceTo(model, tick, events = new Map()) {
  while (model.getState().tick < tick) {
    const next = model.getState().tick + 1;
    model.step(next, events.get(next) ?? []);
  }
  return model.getState();
}

function assertFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value), 'public state/options must be recursively frozen');
  for (const child of Object.values(value)) assertFrozen(child, seen);
}

function checkPose(pose) {
  assert.equal(pose.species, 'fox');
  assert.ok(pose.polygons.length > 0 && pose.polygons.length <= 48);
  assert.equal(new Set(pose.polygons.map(part => part.id)).size, pose.polygons.length);
  assert.deepEqual(pose.legs.map(leg => leg.id).sort(), legIds);
  let vertices = 0;
  const points = [];
  for (const part of pose.polygons) {
    assert.ok(['fur', 'cream', 'shadow', 'ink'].includes(part.material));
    assert.ok(Number.isFinite(part.depth));
    assert.ok(part.points.length >= 3, `${part.id} has an area`);
    vertices += part.points.length;
    points.push(...part.points);
  }
  assert.ok(vertices <= 1024, 'authored vertex budget');
  for (const leg of pose.legs) {
    assert.equal(leg.joints.length, leg.id.endsWith('front') ? 3 : 4);
    points.push(...leg.joints);
    for (let i = 1; i < leg.joints.length; i++) {
      const a = leg.joints[i - 1], b = leg.joints[i];
      const length = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(length > 0 && length < 0.65, `${leg.id}: connected finite limb segment`);
    }
  }
  points.push(...Object.values(pose.landmarks), pose.root);
  for (const point of points) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), 'finite world geometry');
    assert.ok(point.x >= -1 && point.x <= 1 && point.y >= -1 && point.y <= 1,
      `geometry remains within normalized world: ${JSON.stringify(point)}`);
  }
  const emitted = pose.polygons.flatMap(part => part.points);
  near(pose.bounds.minX, Math.min(...emitted.map(p => p.x)), 1e-10, 'bounds.minX');
  near(pose.bounds.maxX, Math.max(...emitted.map(p => p.x)), 1e-10, 'bounds.maxX');
  near(pose.bounds.minY, Math.min(...emitted.map(p => p.y)), 1e-10, 'bounds.minY');
  near(pose.bounds.maxY, Math.max(...emitted.map(p => p.y)), 1e-10, 'bounds.maxY');
  const torso = pose.polygons.find(part => part.id === 'torso');
  assert.ok(torso, 'original torso is an explicit part');
  const torsoBounds = {
    minX: Math.min(...torso.points.map(p => p.x)), maxX: Math.max(...torso.points.map(p => p.x)),
    minY: Math.min(...torso.points.map(p => p.y)), maxY: Math.max(...torso.points.map(p => p.y)),
  };
  for (const leg of pose.legs) {
    const root = leg.joints[0];
    assert.ok(root.x >= torsoBounds.minX - 0.04 && root.x <= torsoBounds.maxX + 0.04 &&
      root.y >= torsoBounds.minY - 0.04 && root.y <= torsoBounds.maxY + 0.04,
    `${leg.id} attaches within the torso rather than floating away`);
  }
}

test('species descriptor, documented defaults and neutral state are explicit', () => {
  assert.equal(foxSpecies.id, 'fox');
  assert.equal(foxSpecies.version, 1);
  assert.equal(foxSpecies.maxPolygons, 48);
  assert.equal(foxSpecies.maxVertices, 1024);
  const model = foxSpecies.create();
  assert.deepEqual(model.getOptions(), {
    facing: 'right', scale: 0.7, breathing: 0.009, tailSway: 0.075,
    stalkSpeed: 0.0018, sniffDepth: 0.045, pounceDistance: 0.2, pounceHeight: 0.24,
    crouchTicks: 24, airTicks: 36, landingTicks: 12, recoveryTicks: 36, cooldownTicks: 72,
  });
  assert.deepEqual(model.getOptions(), FOX_DEFAULTS);
  assert.ok(FOX_LIMITS && typeof FOX_LIMITS === 'object');
  const state = model.getState();
  assert.equal(state.schemaVersion, 1);
  assert.equal(state.speciesVersion, 1);
  assert.equal(state.species, 'fox');
  assert.equal(state.seed, 17);
  assert.equal(state.tick, 0);
  assert.equal(state.lastSequence, -1);
  assert.equal(state.rootX, 0);
  assert.equal(state.behavior.kind, 'idle');
  assert.equal(model.isPaused(), false);
  assertFrozen(state);
  assertFrozen(model.getOptions());
  checkPose(model.getPose());
});

test('all finite configuration limits accept endpoints and reject excess atomically', () => {
  const ranges = {
    scale: [0.58, 0.72], breathing: [0, 0.025], tailSway: [0, 0.16],
    stalkSpeed: [0.0005, 0.004], sniffDepth: [0, 0.1], pounceDistance: [0.08, 0.3],
    pounceHeight: [0.1, 0.34], crouchTicks: [12, 60], airTicks: [20, 60],
    landingTicks: [8, 30], recoveryTicks: [12, 90], cooldownTicks: [30, 180],
  };
  const model = createFox();
  for (const [key, [low, high]] of Object.entries(ranges)) {
    for (const valid of [low, high]) assert.equal(createFox({ [key]: valid }).getOptions()[key], valid);
    for (const invalid of [low - 1, high + 1, NaN, Infinity, -Infinity, String(low), null]) {
      const before = model.getOptions();
      assert.throws(() => model.configure({ facing: 'left', [key]: invalid }), `${key}: ${invalid}`);
      assert.deepEqual(model.getOptions(), before, `${key}: rejection cannot partially configure`);
    }
    if (key.endsWith('Ticks')) assert.throws(() => model.configure({ [key]: low + 0.5 }));
  }
  for (const invalid of ['north', false, null, 1]) assert.throws(() => createFox({ facing: invalid }));
  for (const invalid of [{ typo: 1 }, { seed: 2 }, { paused: true }, null, [], 'fox']) {
    const before = model.getOptions();
    assert.throws(() => model.configure(invalid));
    assert.deepEqual(model.getOptions(), before);
  }
});

test('seed is uint32 and playback policy is a boolean', () => {
  assert.equal(createFox({ seed: 0 }).getState().seed, 0);
  assert.equal(createFox({ seed: 0xffffffff }).getState().seed, 0xffffffff);
  for (const seed of [-1, 0x100000000, 0.5, NaN, Infinity, '17', null]) {
    assert.throws(() => createFox({ seed }));
    const model = createFox();
    assert.throws(() => model.reset(seed));
    assert.equal(model.getState().seed, 17);
  }
  for (const paused of [1, 'false', null]) {
    assert.throws(() => createFox({ paused }));
    const model = createFox();
    assert.throws(() => model.setPaused(paused));
    assert.equal(model.isPaused(), false);
  }
});

test('tick is exactly the next safe integer; failed steps leave state untouched', () => {
  const model = createFox();
  for (const tick of [-1, 0, 2, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1']) {
    assert.throws(() => model.step(tick));
    assert.equal(model.getState().tick, 0);
  }
  assert.equal(model.step(1).kind, 'advanced');
  assert.throws(() => model.step(1));
  assert.throws(() => model.step(3));
  assert.equal(model.getState().tick, 1);
});

test('a whole input batch is validated before guide or pounce can take effect', () => {
  const badEvents = [
    { tick: 1, seq: 1, type: 'guide', x: NaN, y: 0 },
    { tick: 1, seq: 1, type: 'guide', x: 0, y: Infinity },
    { tick: 2, seq: 1, type: 'pounce' },
    { tick: 1, seq: 0, type: 'pounce' },
    { tick: 1, seq: -1, type: 'pounce' },
    { tick: 1, seq: 0.5, type: 'pounce' },
    { tick: 1, seq: Number.MAX_SAFE_INTEGER + 1, type: 'pounce' },
    { tick: 1, seq: 1, type: 'fly' },
    { tick: 1, seq: 1, type: 'guide', x: '1', y: 0 },
    { tick: 1, seq: 1, type: 'guide', x: 0 },
    null,
  ];
  for (const bad of badEvents) {
    const model = createFox();
    const before = model.getState();
    assert.throws(() => model.step(1, [{ tick: 1, seq: 0, type: 'guide', x: 0.9, y: 0 }, bad]));
    assert.deepEqual(model.getState(), before);
    assert.equal(model.step(1, [{ tick: 1, seq: 0, type: 'pounce' }]).pounce, 'started');
  }
  const model = createFox();
  assert.throws(() => model.step(1, Array.from({ length: 17 }, (_, seq) => ({ tick: 1, seq, type: 'leave' }))));
  assert.equal(model.getState().tick, 0);
  const allowed = Array.from({ length: 16 }, (_, seq) => ({ tick: 1, seq, type: 'leave' }));
  assert.equal(model.step(1, allowed).eventsAccepted, 16);
  assert.equal(model.getState().lastSequence, 15);
  assert.throws(() => model.step(2, [{ tick: 2, seq: 15, type: 'leave' }]));
  assert.equal(model.getState().tick, 1);
});

test('normalized guidance clamps finite coordinates and honors ordered leave/guide', () => {
  const model = createFox();
  model.step(1, [{ tick: 1, seq: 7, type: 'guide', x: 80, y: -90 }]);
  assert.deepEqual(model.getState().target, { x: 1, y: -1, active: true });
  model.step(2, [
    { tick: 2, seq: 8, type: 'guide', x: 0.6, y: 0.2 },
    { tick: 2, seq: 9, type: 'leave' },
  ]);
  assert.equal(model.getState().target.active, false);
  model.step(3, [
    { tick: 3, seq: 10, type: 'leave' },
    { tick: 3, seq: 11, type: 'guide', x: -0.4, y: 0.5 },
  ]);
  assert.deepEqual(model.getState().target, { x: -0.4, y: 0.5, active: true });
});

test('pointer normalization uses CSS bounds, handles edges, and rejects unusable input', () => {
  const rect = { left: 100, top: 40, width: 300, height: 200 };
  assert.deepEqual(normalizeFoxPointer(250, 140, rect), { x: 0, y: 0 });
  assert.deepEqual(normalizeFoxPointer(100, 40, rect), { x: -1, y: -1 });
  assert.deepEqual(normalizeFoxPointer(400, 240, rect), { x: 1, y: 1 });
  assert.deepEqual(normalizeFoxPointer(-100, 1000, rect), { x: -1, y: 1 });
  // Native DOMRect values expose geometry through their prototype rather than
  // a plain object. This stand-in tests the browser-facing structural boundary.
  class Rectangle {
    get left() { return 100; }
    get top() { return 40; }
    get width() { return 300; }
    get height() { return 200; }
  }
  assert.deepEqual(normalizeFoxPointer(250, 140, new Rectangle()), { x: 0, y: 0 });
  for (const bad of [0, -1]) {
    assert.equal(normalizeFoxPointer(100, 50, { ...rect, width: bad }), null);
    assert.equal(normalizeFoxPointer(100, 50, { ...rect, height: bad }), null);
  }
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.throws(() => normalizeFoxPointer(bad, 50, rect));
    assert.throws(() => normalizeFoxPointer(100, bad, rect));
    assert.throws(() => normalizeFoxPointer(100, 50, { ...rect, width: bad }));
    assert.throws(() => normalizeFoxPointer(100, 50, { ...rect, top: bad }));
  }
});

test('paused steps validate but consume neither ticks nor events, and reset preserves pause', () => {
  const model = createFox({ paused: true, tailSway: 0.1 });
  const input = [{ tick: 1, seq: 0, type: 'pounce' }];
  const before = model.getState();
  const result = model.step(1, input);
  assert.equal(result.kind, 'paused');
  assert.equal(result.eventsAccepted, 0);
  assert.deepEqual(result.state, before);
  assert.throws(() => model.step(1, [{ tick: 1, seq: 0, type: 'guide', x: NaN, y: 0 }]));
  model.configure({ sniffDepth: 0.06 });
  model.reset(23);
  assert.equal(model.isPaused(), true);
  assert.equal(model.getOptions().tailSway, 0.1);
  assert.equal(model.getOptions().sniffDepth, 0.06);
  model.setPaused(false);
  assert.equal(model.step(1, input).pounce, 'started');
  assert.equal(model.getState().lastSequence, 0);
});

test('pounce completes every authored phase and rejects repeated requests until cooldown ends', () => {
  const model = createFox();
  const seen = [];
  let seq = 0;
  const first = model.step(1, [{ tick: 1, seq: seq++, type: 'pounce' }]);
  assert.equal(first.pounce, 'started');
  seen.push(first.state.behavior.kind);
  const counts = new Map();
  counts.set('crouch', 1);
  let previous = model.getPose();
  for (let tick = 2; tick <= 240; tick++) {
    const before = model.getState();
    const busy = ['crouch', 'airborne', 'landing', 'recover', 'cooldown'].includes(before.behavior.kind);
    // Avoid the final cooldown tick so a just-expired cooldown boundary does not
    // silently define whether input is consumed before or after phase advance.
    const retry = busy && !(before.behavior.kind === 'cooldown' && before.behavior.remaining <= 1) && tick % 7 === 0;
    const result = model.step(tick, retry ? [{ tick, seq: seq++, type: 'pounce' }] : []);
    if (retry) assert.equal(result.pounce, 'ignored-busy');
    const kind = result.state.behavior.kind;
    if (kind !== seen.at(-1)) seen.push(kind);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    const pose = model.getPose();
    assert.ok(Math.abs(pose.root.x - previous.root.x) < 0.04, 'short leap never teleports horizontally');
    assert.ok(Math.abs(pose.root.y - previous.root.y) < 0.08, 'body transitions remain continuous');
    previous = pose;
  }
  assert.deepEqual(seen, ['crouch', 'airborne', 'landing', 'recover', 'cooldown', 'idle']);
  assert.equal(counts.get('crouch'), 24);
  assert.equal(counts.get('airborne'), 36);
  assert.equal(counts.get('landing'), 12);
  assert.equal(counts.get('recover'), 36);
  assert.equal(counts.get('cooldown'), 72);
  assert.equal(model.step(241, [{ tick: 241, seq: seq++, type: 'pounce' }]).pounce, 'started');
});

test('active response captures configuration; updates cannot redirect or retime the leap', () => {
  const model = createFox({ facing: 'right', pounceDistance: 0.16, airTicks: 42 });
  model.step(1, [{ tick: 1, seq: 0, type: 'pounce' }]);
  const plan = model.getState().behavior.plan;
  assertFrozen(plan);
  model.configure({ facing: 'left', pounceDistance: 0.3, pounceHeight: 0.34, airTicks: 20, cooldownTicks: 30 });
  assert.deepEqual(model.getState().behavior.plan, plan);
  assert.equal(model.getOptions().airTicks, 20);
  let airborneCount = 0;
  for (let tick = 2; tick < 190; tick++) {
    const state = model.step(tick).state;
    if (state.behavior.kind === 'airborne') airborneCount++;
    if ('plan' in state.behavior) assert.deepEqual(state.behavior.plan, plan);
    if (state.behavior.kind === 'landing') near(state.rootX, plan.toX);
  }
  assert.equal(airborneCount, 42);
});

test('morphology updated during a response takes effect without leaving old facing/scale paws', () => {
  const model = createFox();
  model.step(1, [{ tick: 1, seq: 0, type: 'pounce' }]);
  model.configure({ facing: 'left', scale: 0.58 });
  while ('plan' in model.getState().behavior) model.step(model.getState().tick + 1);
  const state = model.getState();
  const pose = model.getPose();
  const reference = staticFoxPose({ facing: 'left', scale: 0.58 });
  for (const leg of pose.legs) {
    const actualPaw = leg.joints.at(-1);
    const expectedPaw = reference.legs.find(item => item.id === leg.id).joints.at(-1);
    near(actualPaw.x - state.rootX, expectedPaw.x, 1e-10, `${leg.id} applies new local morphology`);
    near(actualPaw.y, expectedPaw.y, 1e-10, `${leg.id} is planted after response`);
  }
  checkPose(pose);
});

test('forepaws reach the ground before hindpaws during the landing pose', () => {
  const model = createFox();
  model.step(1, [{ tick: 1, seq: 0, type: 'pounce' }]);
  while (model.getState().behavior.kind !== 'landing') model.step(model.getState().tick + 1);
  const pose = model.getPose();
  for (const leg of pose.legs) {
    const paw = leg.joints.at(-1);
    if (leg.id.endsWith('front')) near(paw.y, groundY, 1e-8, 'forepaw has landed');
    else assert.ok(paw.y < groundY, 'hindpaw remains above ground at forepaw contact');
  }
});

test('stance feet stay planted while the root stalks; four legs have independent swing times', () => {
  const model = createFox({ stalkSpeed: 0.003 });
  let previous = model.getState();
  const swings = new Map(legIds.map(id => [id, []]));
  let moving = 0, locks = 0;
  for (let tick = 1; tick <= 160; tick++) {
    const state = model.step(tick, tick === 1 ? [{ tick, seq: 0, type: 'guide', x: 1, y: 0 }] : []).state;
    if (state.rootX !== previous.rootX) moving++;
    for (const foot of state.feet) {
      const before = previous.feet.find(candidate => candidate.id === foot.id);
      assert.ok(before);
      if (foot.mode === 'swing') swings.get(foot.id).push(tick);
      if (before.mode === 'planted' && foot.mode === 'planted') {
        near(foot.x, before.x, 1e-10, `${foot.id} planted x`);
        near(foot.y, before.y, 1e-10, `${foot.id} planted y`);
        locks++;
      }
    }
    previous = state;
  }
  assert.ok(moving > 15 && locks > 30);
  for (const ticks of swings.values()) assert.ok(ticks.length > 0, 'each leg participates in the gait');
  assert.ok(new Set([...swings.values()].map(ticks => ticks.join(','))).size > 1,
    'all four legs must not swing as one rigid pair');
});

test('idle appendages move independently while the root and planted paws stay still', () => {
  const model = createFox();
  const startState = model.getState();
  const first = model.getPose();
  advanceTo(model, 41);
  const later = model.getPose();
  assert.equal(model.getState().rootX, startState.rootX);
  assert.equal(model.getState().behavior.kind, 'idle');
  for (const leg of later.legs) {
    const initial = first.legs.find(item => item.id === leg.id);
    assert.deepEqual(leg.joints.at(-1), initial.joints.at(-1));
  }
  assert.notDeepEqual(later.landmarks.tailTip, first.landmarks.tailTip);
  assert.notEqual(model.getState().breathPhase, startState.breathPhase);
  assert.notEqual(model.getState().tailPhase, startState.tailPhase);
  const still = createFox({ breathing: 0, tailSway: 0 });
  const pose0 = still.getPose();
  advanceTo(still, 41);
  assert.deepEqual(still.getPose().polygons, pose0.polygons, 'zero local motion gives an actual static idle');
});

test('same seed/options/event log survive presentation grouping at 1, 2 and 5 ticks', () => {
  function replay(group) {
    const model = createFox({ seed: 17 });
    const checkpoints = [];
    for (let tick = 1; tick <= 720; tick++) {
      model.step(tick, scenario.get(tick) ?? []);
      if (tick % group === 0) buildFoxGrid(model.getPose());
      if (tick % 30 === 0) checkpoints.push({ state: model.getState(), grid: buildFoxGrid(model.getPose()).text });
    }
    return checkpoints;
  }
  const reference = replay(1);
  assert.deepEqual(replay(2), reference);
  assert.deepEqual(replay(5), reference);
});

test('seeds and instances are independent, and reset reproduces its own initial replay', () => {
  const first = createFox({ seed: 17 });
  const untouched = createFox({ seed: 17 });
  const different = createFox({ seed: 18 });
  const pristine = untouched.getState();
  assert.notEqual(first.getState().tailPhase, different.getState().tailPhase);
  advanceTo(first, 200, scenario);
  const replayed = first.getState();
  assert.deepEqual(untouched.getState(), pristine);
  const options = first.getOptions();
  first.reset();
  assert.deepEqual(first.getOptions(), options);
  assert.deepEqual(first.getState(), pristine);
  advanceTo(first, 200, scenario);
  assert.deepEqual(first.getState(), replayed);
});

test('pose sampling is pure and public snapshots cannot corrupt later simulation', () => {
  const model = createFox();
  advanceTo(model, 150, scenario);
  const before = model.getState();
  const options = model.getOptions();
  const pose = model.getPose();
  for (let i = 0; i < 10; i++) assert.deepEqual(model.getPose(), pose);
  assert.deepEqual(model.getState(), before);
  assertFrozen(before);
  assertFrozen(options);
  assert.throws(() => { before.tick = 0; }, TypeError);
  assert.throws(() => { before.target.x = -100; }, TypeError);
  assert.throws(() => { before.feet[0].x = -100; }, TypeError);
  assert.throws(() => { options.scale = 100; }, TypeError);
  assert.deepEqual(model.getState(), before);
});

test('all behavior phases and extreme supported configurations retain bounded attached geometry', () => {
  const variants = [
    {},
    { facing: 'left' },
    { scale: 0.58, breathing: 0, tailSway: 0, sniffDepth: 0, pounceDistance: 0.08, pounceHeight: 0.1 },
    { scale: 0.72, breathing: 0.025, tailSway: 0.16, stalkSpeed: 0.004, sniffDepth: 0.1,
      pounceDistance: 0.3, pounceHeight: 0.34, crouchTicks: 12, airTicks: 20,
      landingTicks: 8, recoveryTicks: 12, cooldownTicks: 30 },
    { facing: 'left', scale: 0.72, breathing: 0.025, tailSway: 0.16, pounceHeight: 0.34,
      pounceDistance: 0.3, crouchTicks: 60, airTicks: 60, landingTicks: 30,
      recoveryTicks: 90, cooldownTicks: 180 },
  ];
  const allPhases = new Set();
  for (const options of variants) {
    const model = createFox(options);
    let seq = 0;
    for (let tick = 1; tick <= 630; tick++) {
      const events = tick === 10 ? [{ tick, seq: seq++, type: 'guide', x: options.facing === 'left' ? -1 : 1, y: 1 }]
        : tick === 110 ? [{ tick, seq: seq++, type: 'pounce' }]
        : tick === 600 ? [{ tick, seq: seq++, type: 'leave' }] : [];
      const state = model.step(tick, events).state;
      assert.ok(state.rootX >= -0.2 && state.rootX <= 0.2);
      allPhases.add(state.behavior.kind);
      checkPose(model.getPose());
    }
  }
  for (const phase of ['stalk', 'sniff', 'crouch', 'airborne', 'landing', 'recover', 'cooldown', 'idle']) {
    assert.ok(allPhases.has(phase), `test actually covers ${phase}`);
  }
});

test('prolonged guide reversals retain bounded connected legs without stale foot growth', () => {
  const model = createFox({ scale: 0.72, stalkSpeed: 0.004, tailSway: 0.16, breathing: 0.025 });
  let seq = 0;
  for (let tick = 1; tick <= 3060; tick++) {
    const events = tick % 85 === 1 ? [{ tick, seq: seq++, type: 'guide',
      x: Math.floor(tick / 85) % 2 ? -1 : 1, y: 0.5 }] : [];
    const state = model.step(tick, events).state;
    assert.ok(Number.isFinite(state.velocityX));
    assert.ok(state.rootX >= -0.2 && state.rootX <= 0.2);
    checkPose(model.getPose());
  }
});

test('static alternatives are reproducible and left/right poses preserve the silhouette anchors', () => {
  for (const kind of ['idle', 'sniff', 'crouch']) {
    const right = staticFoxPose({ seed: 17, facing: 'right' }, kind);
    const left = staticFoxPose({ seed: 17, facing: 'left' }, kind);
    assert.deepEqual(staticFoxPose({ seed: 17, facing: 'right' }, kind), right);
    checkPose(right);
    checkPose(left);
    for (const name of ['muzzle', 'earNear', 'earFar', 'tailRoot', 'tailTip']) {
      near(left.landmarks[name].x, -right.landmarks[name].x, 1e-10, `mirror ${name}.x`);
      near(left.landmarks[name].y, right.landmarks[name].y, 1e-10, `mirror ${name}.y`);
    }
    assert.ok(right.landmarks.muzzle.x > right.landmarks.earNear.x, 'muzzle points in front of skull');
    assert.ok(right.landmarks.tailTip.x < right.landmarks.tailRoot.x, 'bushy tail extends behind rump');
    assert.ok(Math.abs(right.landmarks.earNear.x - right.landmarks.earFar.x) > 0.025, 'ear peaks remain separated');
  }
  assert.throws(() => staticFoxPose({}, 'fly'));
});

test('ASCII grids obey exact declared cell limits and work at minimum/default/maximum sizes', () => {
  for (const [cols, rows] of [[80, 32], [112, 44], [160, 64]]) {
    for (const facing of ['left', 'right']) {
      const pose = staticFoxPose({ facing });
      const grid = buildFoxGrid(pose, { cols, rows });
      assert.equal(grid.cols, cols);
      assert.equal(grid.rows, rows);
      assert.equal(grid.glyphs.length, cols * rows);
      assert.equal(grid.materials.length, cols * rows);
      assert.ok(grid.occupied > 50 && grid.occupied <= cols * rows);
      assert.match(grid.text, /^[ .:\-=+*#%@o\n]+$/);
      const lines = grid.text.replace(/\n$/, '').split('\n');
      assert.equal(lines.length, rows);
      for (const line of lines) assert.equal(line.length, cols);
      assert.equal(lines.join('').replace(/ /g, '').length, grid.occupied);
      const mono = buildFoxGrid(pose, { cols, rows, monochrome: true });
      assert.match(mono.text, /^[ #\n]+$/);
      assert.equal(mono.occupied, grid.occupied);
    }
  }
  const pose = staticFoxPose();
  for (const options of [{ cols: 79 }, { cols: 161 }, { rows: 31 }, { rows: 65 },
    { cols: 80.5 }, { rows: 32.5 }, { cols: NaN }, { rows: Infinity }, { cols: 1e9 }]) {
    assert.throws(() => buildFoxGrid(pose, options));
  }
});

test('dispose is repeatable and every other model operation rejects use after release', () => {
  const model = createFox();
  model.dispose();
  assert.doesNotThrow(() => model.dispose());
  for (const operation of [
    () => model.getOptions(), () => model.getState(), () => model.getPose(),
    () => model.configure({}), () => model.step(1), () => model.setPaused(true),
    () => model.isPaused(), () => model.reset(),
  ]) assert.throws(operation, /dispos/i);
});
