import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as directorModule from '../lib/director.js';
import { createDragonfly, DRAGONFLY_DEFAULTS } from '../lib/model.js';
import { buildDragonflyGeometry } from '../lib/geometry.js';
import { createDragonflyProjector, rasterizeDragonfly } from '../lib/preview.js';
import { rasterizeDragonflyPond } from '../lib/pond-preview.js';

// Numerical acceptance of authored motion and minimum-grid topology, not a
// substitute for the accompanying real-browser captures or physical-device QA.
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
const { createDragonflyDirector } = directorModule;
const speed = member => Math.hypot(member.velocity.x, member.velocity.y);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function step(director, inputs = []) {
  const state = director.getState();
  director.step(state.tick + 1, inputs.map((input, index) => ({
    tick: state.tick + 1, seq: state.lastSeq + index + 1, ...input,
  })));
  return director.getState().members[0];
}
function until(director, predicate, limit = 2000) {
  for (let index = 0; index < limit; index++) {
    const member = director.getState().members[0];
    if (predicate(member)) return member;
    step(director);
  }
  assert.fail(`Dragonfly did not complete its directed action within ${limit} ticks`);
}

test('the directed dart anticipates, travels tail-first, then visibly brakes before returning', () => {
  for (const seed of [17, 991]) for (const motion of ['full', 'slow']) {
    const director = createDragonflyDirector({ count: 1, scene: 'attention' }, { seed, motion });
    const pace = motion === 'slow' ? .25 : 1;
    for (let index = 0; index < Math.ceil(180 / pace); index++) step(director);
    const initial = director.getState().members[0];
    const rear = { x: -Math.sin(initial.heading), y: Math.cos(initial.heading) };
    const sideways = { x: rear.y, y: -rear.x };
    const phases = [], states = [];
    for (let index = 0; index < Math.ceil(600 / pace); index++) {
      const member = step(director, index === 0 ? [{ type: 'cue', cue: 'dart' }] : []);
      states.push(member);
      if (phases.at(-1) !== member.phase.kind) phases.push(member.phase.kind);
      if (phases.includes('cooldown') && member.phase.kind !== 'cooldown') break;
    }
    for (const [first, second] of [['launch', 'dart'], ['dart', 'settle'], ['settle', 'return'], ['return', 'cooldown']])
      assert(phases.indexOf(first) >= 0 && phases.indexOf(second) > phases.indexOf(first),
        `${seed}/${motion}: expected ${first} before ${second}, got ${phases}`);
    const anticipation = states.filter(member => member.phase.kind === 'launch');
    const travel = states.filter(member => member.phase.kind === 'dart');
    const braking = states.filter(member => member.phase.kind === 'settle');
    assert(anticipation.length >= 6, 'Anticipation must last long enough to read before the dart');
    const from = anticipation.at(-1).position;
    const offsets = [...travel, ...braking].map(member => ({
      rear: (member.position.x - from.x) * rear.x + (member.position.y - from.y) * rear.y,
      side: (member.position.x - from.x) * sideways.x + (member.position.y - from.y) * sideways.y,
    }));
    const farthest = offsets.reduce((best, value) => value.rear > best.rear ? value : best, offsets[0]);
    assert(farthest.rear > .2, `Backward travel must be visible, observed ${farthest.rear}`);
    assert(farthest.rear > Math.abs(farthest.side) * 2,
      'The excursion must read as backward flight, not a sideways waypoint change');
    const peak = Math.max(...travel.map(speed), ...braking.map(speed));
    const stopped = speed(braking.at(-1));
    assert(peak > .3 * pace, 'The response must actually accelerate');
    assert(stopped < peak * .35, `Brake must remove most travel speed before return (${stopped}/${peak})`);
    director.dispose();
  }
});

test('the minimum portrait grid preserves a separate distal footprint for every wing', () => {
  const director = createDragonflyDirector({ count: 1, scene: 'attention' }, { seed: 17 });
  for (const pose of [0, 1]) {
    director.setStaticPose(pose);
    for (const view of ['dorsal', 'oblique']) {
      const options = { cols: 72, rows: 44, view, neutral: true };
      const geometry = director.sample()[0].geometry;
      const project = createDragonflyProjector(options);
      const wings = new Map(geometry.wings.map(wing => [wing.id, new Set()]));
      for (const point of geometry.samples) {
        const cells = wings.get(point.part);
        if (!cells) continue;
        const wing = geometry.wings.find(item => item.id === point.part);
        // The proximal attachment can overlap the shoulder. The outer blade
        // must retain independent visible cells instead of merging into its pair.
        if (distance(point, wing.root) < distance(wing.root, wing.tip) * .45) continue;
        const cell = project(point);
        cells.add(cell.row * options.cols + cell.col);
      }
      for (const [id, cells] of wings) {
        const unique = [...cells].filter(cell => [...wings].every(([other, occupied]) => other === id || !occupied.has(cell)));
        assert(unique.length >= 3, `${view}/${pose}/${id}: fewer than three separate distal cells`);
      }
      assert.equal(rasterizeDragonfly(geometry, options).clippedSamples, 0);
    }
  }
  director.dispose();
});

test('wing phase wrap is continuous in all four blades and cannot detach a root', () => {
  const state = createDragonfly({ seed: 17 }).getState();
  const epsilon = 1e-6;
  const config = { ...DRAGONFLY_DEFAULTS, wingAmplitude: .4 };
  const left = buildDragonflyGeometry({ ...state, wingPhase: Math.PI * 2 - epsilon }, config);
  const right = buildDragonflyGeometry({ ...state, wingPhase: epsilon }, config);
  for (const wing of left.wings) {
    const other = right.wings.find(value => value.id === wing.id);
    assert(distance(wing.tip, other.tip) < 1e-5, `${wing.id} pops at the periodic seam`);
    assert(distance(wing.root, other.root) < 1e-12, `${wing.id} root moves with its phase`);
    for (const geometry of [left, right]) {
      const root = geometry.wings.find(value => value.id === wing.id).root;
      assert(geometry.samples.some(point => point.part === wing.id && distance(point, root) < 1e-12),
        `${wing.id} lacks an attached sample at its shoulder`);
    }
  }
});

test('the landing articulation places six distinct feet on the transverse twig', () => {
  const state = createDragonfly({ seed: 17 }).getState();
  for (const pitch of [0, -.2, .2]) {
    const gripped = buildDragonflyGeometry(state, DRAGONFLY_DEFAULTS, { pitch, grip: 1 });
    const contacts = gripped.samples.filter(point => point.part === 'legs' &&
      Math.abs(point.y) < 1e-12 && Math.abs(point.z) < 1e-12);
    const feet = [...new Set(contacts.map(point => point.x.toFixed(8)))].map(Number);
    assert.equal(feet.length, 6, 'A complete landing needs six separate contacts on the authored support line');
    assert.equal(feet.filter(x => x < 0).length, 3);
    assert.equal(feet.filter(x => x > 0).length, 3);
    assert(feet.every(x => Math.abs(x) < .4), 'Feet must grip the near twig rather than reach across the habitat');
  }
});

test('fractional presentation interpolates poses without changing simulation or shrinking wing blades', () => {
  assert.equal(typeof directorModule.createDragonflyDirectorHost, 'function',
    'The species-local host must interpolate fixed-step presentation without changing the public director API');
  const { director, samplePresentation } = directorModule.createDragonflyDirectorHost(
    { count: 1, scene: 'attention' }, { seed: 17, wingHz: 6, wingAmplitude: .4 });
  for (let tick = 1; tick <= 64; tick++) step(director);
  const before = director.sample();
  step(director, [{ type: 'cue', cue: 'dart' }]);
  const after = director.sample(), state = director.getState();
  assert.deepEqual(samplePresentation(0)[0].geometry, before[0].geometry,
    'Alpha zero must retain the previous simulation pose');
  assert.deepEqual(samplePresentation(1)[0].geometry, after[0].geometry,
    'Alpha one must exactly reach the current simulation pose');
  const reference = new Map(after[0].geometry.wings.map(wing => [wing.id, distance(wing.root, wing.tip)]));
  for (const alpha of [0, .25, .5, .75, 1]) {
    const shown = samplePresentation(alpha)[0];
    for (const axis of ['x', 'y', 'z']) {
      const expected = before[0].position[axis] + (after[0].position[axis] - before[0].position[axis]) * alpha;
      assert(Math.abs(shown.position[axis] - expected) < 1e-12,
        `Root ${axis} does not interpolate continuously at alpha ${alpha}`);
    }
    for (const wing of shown.geometry.wings) {
      assert(Math.abs(distance(wing.root, wing.tip) - reference.get(wing.id)) < 1e-11,
        `${wing.id} shrinks under fractional presentation; interpolate angles before constructing geometry`);
      assert(shown.geometry.samples.some(point => point.part === wing.id && distance(point, wing.root) < 1e-12));
    }
    assert.deepEqual(director.getState(), state);
    assert.deepEqual(director.sample(), after, 'Presentation sampling cannot alter the next exact-tick sample');
  }
  assert.notEqual(digest(samplePresentation(.5)[0].geometry), digest(before[0].geometry));
  assert.notEqual(digest(samplePresentation(.5)[0].geometry), digest(after[0].geometry));
  for (const invalid of [-.01, 1.01, NaN, Infinity, '0.5']) assert.throws(() => samplePresentation(invalid));
  assert.equal(director.samplePresentation, undefined, 'Interpolation stays outside the accepted public director interface');
  director.dispose();
  assert.throws(() => samplePresentation(.5), /disposed/);
});

test('a held twig perch is still under guidance and releases through an authored return', () => {
  const director = createDragonflyDirector({ count: 1, scene: 'attention' }, { seed: 17 });
  step(director, [{ type: 'cue', cue: 'perch' }]);
  const landed = until(director, member => member.phase.kind === 'perched');
  const shape = digest(director.sample()[0].geometry);
  for (let index = 0; index < 90; index++) {
    const member = step(director, [{ type: 'pointer', x: index % 2 ? -1 : 1, y: index % 3 ? .8 : -.8 }]);
    assert.equal(member.phase.kind, 'perched');
    assert.deepEqual(member.position, landed.position);
    assert.equal(speed(member), 0);
    assert.equal(digest(director.sample()[0].geometry), shape, 'Held wings and feet must stay still');
  }
  let previous = director.getState().members[0], leftTwig = false, wingMotion = false;
  for (let index = 0; index < 360; index++) {
    const member = step(director, index === 0 ? [{ type: 'cue', cue: 'return' }] : []);
    if (index === 0) assert.equal(member.phase.kind, 'launch', 'Held return begins with wing spool-up and lift');
    assert(distance(member.position, previous.position) < .08, 'Relaunch must not teleport off its twig');
    wingMotion ||= digest(director.sample()[0].geometry) !== shape;
    leftTwig ||= distance(member.position, landed.position) > .1;
    previous = member;
  }
  assert(wingMotion && leftTwig, 'A deliberate return cue must animate the wings and release the held perch');
  director.dispose();
});

test('land, relaunch and backward-response replay is independent of render cadence and sampling', () => {
  const events = new Map([
    [12, [{ type: 'cue', cue: 'perch' }]],
    [400, [{ type: 'cue', cue: 'return' }]],
    [610, [{ type: 'pointer', x: .2, y: -.4 }]],
    [690, [{ type: 'leave' }]],
    [710, [{ type: 'cue', cue: 'dart' }]],
  ]);
  const outcomes = [1, 2, 5].map(cadence => {
    const director = createDragonflyDirector({ count: 2, scene: 'attention' }, { seed: 991 });
    for (let tick = 1; tick <= 1080; tick++) {
      step(director, events.get(tick) ?? []);
      if (tick % cadence === 0) director.sample();
    }
    const state = director.getState(), geometry = director.sample();
    const grid = rasterizeDragonflyPond(geometry, { cols: 72, rows: 44, view: 'oblique', neutral: false });
    const result = { state: digest(state), geometry: digest(geometry), cells: digest([...grid.chars]) };
    for (let extra = 0; extra < 5; extra++) director.sample();
    assert.deepEqual(director.getState(), state, 'Sampling must not drive private attitude or wing easing');
    director.dispose();
    return result;
  });
  assert.deepEqual(outcomes[1], outcomes[0]);
  assert.deepEqual(outcomes[2], outcomes[0]);
});
