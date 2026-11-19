// Executed source-model and logical-grid evidence. These are not browser tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwl, makeOwlPoster } from '../build/owl.js';
import { createOwlDirector, makeOwlDirectorPoster } from '../build/director.js';
import { buildOwlGeometry, OWL_SURFACE_LIMIT } from '../build/geometry.js';
import { renderOwlGrid } from '../build/preview.js';
import { renderOwlDirectorGrid } from '../build/composition.js';

const rest = Object.freeze({ headRollDeg: 0, airborne: 0, lift: 0, travel: 0,
  bankDeg: 0, crouch: 0, wingSweep: 0, tailFan: 0, feetReach: 0 });
const cue = (tick, seq, kind, x = -.72, target = 0) => ({ tick, seq, type: 'cue',
  cue: { kind, target, x, y: -.3 } });
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const assertRest = presentation => {
  for (const name of Object.keys(rest)) assert(presentation[name] === 0, `${name} must return to numeric zero`);
};
const wood = geometry => geometry.surfaces.filter(surface => surface.part === 'perch');
const advance = (director, tick, events = []) => {
  for (let next = director.getState().tick + 1; next <= tick; next++)
    director.advance(next, events.filter(event => event.tick === next));
  return director.getState();
};

test('flight has ordered launch/glide/brake/alight phases and finishes before cue cooldown', () => {
  const director = createOwlDirector({ count: 1, autonomous: false });
  const seen = [];
  for (let tick = 1; tick <= 360; tick++) {
    const result = director.advance(tick, tick === 1 ? [cue(1, 0, 'flight')]
      : tick === 120 ? [cue(120, 1, 'flight')] : []);
    if (tick === 1) assert.equal(result.acceptedCues, 1);
    if (tick === 120) assert.equal(result.ignoredCues, 1);
    if (seen.at(-1)?.kind !== result.state.phase.kind)
      seen.push({ kind: result.state.phase.kind, tick });
  }
  assert.deepEqual(seen, [
    { kind: 'launch', tick: 1 }, { kind: 'glide', tick: 91 },
    { kind: 'brake', tick: 199 }, { kind: 'alight', tick: 265 },
  ]);
  assertRest(director.getState().actors[0].pose.presentation);
  const cooled = director.advance(361, [cue(361, 2, 'flight')]);
  assert.equal(cooled.state.cue, null);
  assert.equal(cooled.ignoredCues, 1, 'a landing does not silently remove the cue cooldown');
  advance(director, 420);
  assert.equal(director.advance(421, [cue(421, 3, 'flight')]).acceptedCues, 1);
  director.dispose();
});

test('flight releases the feet, extends them to brake, and lands on the same fixed branch', () => {
  const director = createOwlDirector({ count: 1, autonomous: false });
  const initial = buildOwlGeometry(director.getState().actors[0].pose);
  const initialBranch = wood(initial);
  let previous = initial;
  const selected = new Map();
  for (let tick = 1; tick <= 361; tick++) {
    const actor = director.advance(tick, tick === 1 ? [cue(tick, 0, 'flight')] : []).state.actors[0];
    const geometry = buildOwlGeometry(actor.pose);
    assert.deepEqual(wood(geometry), initialBranch, `landing branch moved at tick ${tick}`);
    assert.equal(actor.simulation.presentation, undefined);
    assert.equal(actor.simulation.cycle, null, 'flight must not consume the existing core reaction cycle');
    assert.equal(actor.simulation.leftWing, 0);
    assert.equal(actor.simulation.rightWing, 0);
    assert.equal(actor.simulation.behavior.kind, 'approach');
    assert(Object.isFrozen(actor.pose.presentation));
    assert(distance(geometry.landmarks.root, previous.landmarks.root) < .06, 'no root teleport');
    for (const side of ['Left', 'Right'])
      assert(distance(geometry.landmarks[`wingTip${side}`], previous.landmarks[`wingTip${side}`]) < .08, 'no wing-tip pop');
    if ([27, 91, 229, 265, 281, 341].includes(tick)) selected.set(tick, { pose: actor.pose, geometry });
    previous = geometry;
  }
  const anticipation = selected.get(27);
  assert(anticipation.pose.presentation.crouch > 0);
  assert(distance(anticipation.geometry.landmarks.footLeft, initial.landmarks.footLeft) < 1e-12,
    'anticipation keeps the gripping foot on the perch');
  const glide = selected.get(91);
  assert(glide.geometry.landmarks.footLeft[1] < initial.landmarks.footLeft[1] - .3,
    'both body and feet leave the bough');
  assert(distance(glide.geometry.landmarks.wingTipLeft, glide.geometry.landmarks.wingTipRight)
    > distance(initial.landmarks.wingTipLeft, initial.landmarks.wingTipRight) + .7,
  'glide exposes a broad attached wingspan');
  assert(selected.get(229).pose.presentation.feetReach > .9, 'feet reach before first contact');
  assert(selected.get(229).pose.presentation.tailFan > .9, 'braking spreads the tail');
  assert(selected.get(281).pose.presentation.crouch > 0, 'touchdown has a settling compression');
  for (const tick of [265, 281, 341]) for (const side of ['Left', 'Right'])
    assert(distance(selected.get(tick).geometry.landmarks[`foot${side}`], initial.landmarks[`foot${side}`]) < 1e-12,
      `foot ${side} lands on the original bough at tick ${tick}`);
  assertRest(selected.get(341).pose.presentation);
  director.dispose();
});

test('flight waits for a configured long core stretch instead of mixing two wing sequences', () => {
  const director = createOwlDirector({ count: 1, autonomous: false }, {
    blinkTicks: 60, ruffleTicks: 120, stretchTicks: 180, recoveryTicks: 180, cooldownTicks: 600,
  });
  director.advance(1, [cue(1, 0, 'stretch')]);
  advance(director, 420);
  const busy = director.advance(421, [cue(421, 1, 'flight')]);
  assert.equal(busy.acceptedCues, 0); assert.equal(busy.ignoredCues, 1);
  assert.equal(busy.state.actors[0].simulation.cycle.startTick, 1);
  advance(director, 1140);
  assert.equal(director.advance(1141, [cue(1141, 2, 'flight')]).acceptedCues, 1);
  director.dispose();
});

test('directed flight preserves fixed framing, finite surfaces and readable minimum-grid anchors', () => {
  for (const x of [-1, 1]) for (const strength of [0, 1]) {
    const director = createOwlDirector({ count: 1, autonomous: false, alertness: strength },
      { headYawLimitDeg: 45, headPitchLimitDeg: 20, reactionStrength: strength });
    for (let tick = 1; tick <= 361; tick++) {
      const pose = director.advance(tick, tick === 1 ? [cue(tick, 0, 'flight', x)] : []).state.actors[0].pose;
      const geometry = buildOwlGeometry(pose);
      assert(geometry.surfaces.length <= OWL_SURFACE_LIMIT);
      for (const surface of geometry.surfaces) {
        for (const key of ['cx', 'cy', 'z', 'rx', 'ry', 'depth', 'rotation', 'tone']) assert(Number.isFinite(surface[key]));
        assert(surface.rx > 0 && surface.ry > 0);
        const c = Math.abs(Math.cos(surface.rotation)), s = Math.abs(Math.sin(surface.rotation));
        const halfWidth = c * surface.rx + s * surface.ry;
        const halfHeight = s * surface.rx + c * surface.ry;
        assert(Math.abs(surface.cx) + halfWidth < 1.104, `horizontal bounds at ${tick}`);
        assert(surface.cy - halfHeight > -1.18 && surface.cy + halfHeight < 1.22,
          `vertical bounds at ${tick}`);
      }
      if (tick % 5 !== 1) continue;
      const grid = renderOwlGrid(pose, { cols: 64, rows: 36 });
      assert.match(grid.text, /^[\x20-\x7e\n]+$/);
      const rows = grid.text.split('\n');
      assert(rows.every(row => row.length === 64));
      assert.equal(rows[0].trim(), ''); assert.equal(rows.at(-1).trim(), '');
      assert(rows.every(row => row[0] === ' ' && row.at(-1) === ' '));
      for (const part of ['head', 'face', 'body', 'wing-left', 'wing-right', 'beak', 'perch'])
        assert(grid.parts.includes(part), `${part} lost at tick ${tick}, direction ${x}`);
    }
    director.dispose();
  }
});

test('listening anticipates, holds and recovers a whole facial-disc cant while staying perched', () => {
  const director = createOwlDirector({ count: 1, autonomous: false, alertness: 1 });
  const initial = buildOwlGeometry(director.getState().actors[0].pose);
  const selected = new Map();
  for (let tick = 1; tick <= 301; tick++) {
    const actor = director.advance(tick, tick === 1 ? [cue(tick, 0, 'rustle')] : []).state.actors[0];
    const geometry = buildOwlGeometry(actor.pose);
    assert.deepEqual(wood(geometry), wood(initial));
    for (const landmark of ['root', 'footLeft', 'footRight'])
      assert(distance(geometry.landmarks[landmark], initial.landmarks[landmark]) < 1e-12,
        `${landmark} stays on the perch; allow only floating-point transform roundoff`);
    assert.equal(actor.simulation.presentation, undefined);
    if ([1, 13, 61, 91, 121, 221, 301].includes(tick)) selected.set(tick, actor.pose);
  }
  assert(selected.get(1).presentation.headRollDeg === 0);
  assert(Math.abs(selected.get(13).presentation.headRollDeg) < Math.abs(selected.get(61).presentation.headRollDeg));
  assert(Math.abs(selected.get(61).presentation.headRollDeg) > 6);
  assert.equal(selected.get(61).presentation.headRollDeg, selected.get(91).presentation.headRollDeg,
    'listening includes a held fixation, not continuous decorative wobble');
  assert(Math.abs(selected.get(121).presentation.headRollDeg) < Math.abs(selected.get(91).presentation.headRollDeg),
    'the second fixation deliberately changes the head cant');
  assert(Math.abs(selected.get(221).presentation.headRollDeg) < Math.abs(selected.get(121).presentation.headRollDeg));
  assertRest(selected.get(301).presentation);
  const pose = selected.get(61), tilted = buildOwlGeometry(pose);
  const untilted = buildOwlGeometry({ ...pose, presentation: { ...pose.presentation, headRollDeg: 0 } });
  assert.notDeepEqual(tilted.surfaces.filter(surface => surface.part === 'face'), untilted.surfaces.filter(surface => surface.part === 'face'));
  assert.notDeepEqual(tilted.surfaces.filter(surface => surface.part === 'beak'), untilted.surfaces.filter(surface => surface.part === 'beak'));
  assert.deepEqual(tilted.surfaces.filter(surface => surface.part === 'body'), untilted.surfaces.filter(surface => surface.part === 'body'));
  director.dispose();
});

test('flight replay is deterministic across draw grouping and leaves immutable core snapshots intact', () => {
  const events = [cue(30, 0, 'flight', .8, 1),
    { tick: 50, seq: 1, type: 'attention', target: 0, x: -.4, y: -.2 },
    cue(90, 2, 'rustle'), { tick: 400, seq: 3, type: 'leave' }];
  const results = [];
  for (const grouping of [1, 2, 5]) {
    const director = createOwlDirector({ autonomous: false, roles: ['sentinel', 'curious'] }, { seed: 31 });
    const initial = director.getState(), initialJson = JSON.stringify(initial);
    for (let tick = 1; tick <= 450; tick++) {
      director.advance(tick, events.filter(event => event.tick === tick));
      if (tick % grouping === 0) renderOwlDirectorGrid(director.getState(), { cols: 80, rows: 90 });
    }
    assert.equal(JSON.stringify(initial), initialJson);
    const state = director.getState();
    assert(state.actors.every(actor => actor.simulation.presentation === undefined));
    results.push({ state, text: renderOwlDirectorGrid(state).text });
    director.reset(); assert.deepEqual(director.getState(), initial);
    director.dispose();
  }
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[0], results[2]);
});

test('a deliberate flight poster remains grounded and never advances or mutates simulation', () => {
  const director = createOwlDirector({ count: 1, autonomous: false });
  const state = director.getState(), json = JSON.stringify(state);
  const poster = makeOwlDirectorPoster(state, { kind: 'flight', target: 0 });
  assert.equal(poster.poster, true);
  assert.equal(poster.tick, 0); assert.equal(poster.beat, 0);
  assert.equal(poster.actors[0].simulation, state.actors[0].simulation);
  assert.equal(poster.actors[0].pose.presentation.airborne, 0);
  assert.equal(poster.actors[0].pose.presentation.lift, 0);
  assert(poster.actors[0].pose.leftWing > .5);
  assert.equal(JSON.stringify(state), json);
  assert.notEqual(renderOwlDirectorGrid(poster).text, renderOwlDirectorGrid(state).text);
  assert.deepEqual(buildOwlGeometry(poster.actors[0].pose).landmarks.footLeft,
    buildOwlGeometry(state.actors[0].pose).landmarks.footLeft);
  director.dispose();
});

test('the original core poster also grounds a director pose without mutating the flight', () => {
  const director = createOwlDirector({ count: 1, autonomous: false });
  director.advance(1, [cue(1, 0, 'flight')]);
  const actor = advance(director, 153).actors[0];
  assert(actor.pose.presentation.airborne > .9);
  for (const kind of ['rest', 'react', 'attention']) {
    const poster = makeOwlPoster(actor.pose, kind === 'attention' ? { kind, x: .4, y: -.2 } : { kind });
    assert.equal(poster.presentation, undefined);
    assert.deepEqual(buildOwlGeometry(poster).landmarks.footLeft, [-.18, .915]);
    assert.equal(poster.tick, actor.pose.tick);
  }
  assert.equal(director.getState().actors[0], actor);
  director.dispose();
});

test('malformed presentation cannot produce nonfinite geometry or leak into the core API', () => {
  const owl = createOwl();
  const state = owl.getState();
  assert.equal(state.presentation, undefined);
  for (const name of Object.keys(rest)) for (const value of [NaN, Infinity, '1'])
    assert.throws(() => buildOwlGeometry({ ...state, presentation: { ...rest, [name]: value } }));
  for (const patch of [{ headRollDeg: 13 }, { airborne: 1.01 }, { lift: .51 }, { travel: .061 },
    { bankDeg: -5.01 }, { crouch: .081 }, { wingSweep: -1.01 }, { tailFan: 1.01 }, { feetReach: -1 }])
    assert.throws(() => buildOwlGeometry({ ...state, presentation: { ...rest, ...patch } }));
  assert.throws(() => owl.update({ presentation: rest }), /Unknown/);
  assert.equal(owl.getState(), state);
  owl.advance(1, [{ tick: 1, seq: 0, type: 'react' }]);
  for (let tick = 2; tick < 350; tick++) owl.advance(tick);
  assert.equal(owl.getState().presentation, undefined);
  owl.dispose();
});
