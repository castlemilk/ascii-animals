import test from 'node:test';
import assert from 'node:assert/strict';
import { createGecko, createGeckoLocomotor } from '../compiled/gecko.js';
import { getGeckoAnatomy, sampleGecko } from '../compiled/geometry.js';
import { renderGeckoGrid } from '../compiled/preview.js';
import { createGeckoDirector } from '../compiled/director.js';
import { renderGeckoDirectorGrid } from '../compiled/director-preview.js';
import { mountGecko } from '../compiled/browser.js';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

// These are logical-contact and authored-locomotion checks. They do not claim
// browser input, device performance, or visible pixel equivalence.
const EPS = 1e-9;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const byId = (items, id) => items.find(item => item.id === id);
const habitat = { extentX: 2, extentY: 1, origin: { x: 0, y: 0 } };
const guide = (state, x = .8, y = -.2) => ({
  type: 'guide', tick: state.tick + 1, seq: state.lastSequence + 1, x, y,
});
const worldPosition = actor => ({ x: actor.body.position.x * actor.scale, y: actor.body.position.y * actor.scale });
const member = (state, id = 'pip') => byId(state.individuals, id);
const cue = (director, fields) => {
  const state = director.getSnapshot();
  return { tick: state.tick + 1, seq: state.lastSequence + 1, ...fields };
};

function assertVisibleJawContact(state, actor) {
  const target = state.moth.position, root = worldPosition(actor);
  const delta = Math.atan2(target.y - root.y, target.x - root.x) - actor.body.heading;
  const headTurn = Math.max(-.18, Math.min(.18, Math.atan2(Math.sin(delta), Math.cos(delta))));
  let closest = Infinity;
  // Observe the actual emitted head surface, independently of the director's
  // .55-unit analytic catch probe. No capture may happen at a remote timer.
  sampleGecko(actor.body, point => {
    if (point.part === 'head') closest = Math.min(closest,
      distance(target, { x: point.x * actor.scale, y: point.y * actor.scale }));
  }, { headTurn, headReach: .022, jawOpen: 1 });
  assert(closest < .085 * actor.scale + EPS, 'catch requires proximity to the rendered jaw surface');
}

function assertContacts(previous, state) {
  assert.equal(state.feet.length, 4);
  assert(state.feet.filter(foot => foot.phase === 'stance').length >= 3,
    'a wall gecko always has at least three support feet');
  const before = getGeckoAnatomy(previous), after = getGeckoAnatomy(state);
  for (const foot of state.feet) {
    const old = byId(previous.feet, foot.id), limb = byId(after.limbs, foot.id);
    assert(distance(limb.shoulder, limb.palm) <= .44 + EPS, 'all contacts remain within the two-bone reach');
    assert(distance(limb.shoulder, limb.elbow) <= .19 + EPS, 'upper limb length is bounded');
    assert(distance(limb.elbow, limb.palm) <= .25 + EPS, 'lower limb length is bounded');
    assert.equal(limb.pads.length, 5);
    if (foot.phase === 'stance' && old.phase === 'stance' && foot.plantedAt === old.plantedAt) {
      assert.deepEqual(foot.position, old.position, `${foot.id} palm must not slide`);
      assert.equal(foot.angle, old.angle, `${foot.id} fan must not rotate while adhered`);
      assert.deepEqual(limb.pads, byId(before.limbs, foot.id).pads,
        `${foot.id} toe tips must stay fixed, including across option updates`);
    }
  }
}

test('toe spread changes wait for real lifted steps; existing palm and toe anchors stay fixed', () => {
  const locomotor = createGeckoLocomotor({ seed: 37, heading: 0, habitat });
  const { model } = locomotor;
  let previous = model.getSnapshot();
  model.update({ toeSpread: 1.15 });
  let state = model.getSnapshot();
  assertContacts(previous, state);
  assert.equal(state.options.toeSpread, 1.15, 'the requested option is stored immediately');
  assert(state.feet.every(foot => foot.toeSpread === 1), 'adhered fans retain their landing spread');
  for (let i = 0; i < 20; i++) {
    previous = state;
    state = locomotor.stepDriven([], { hold: true }).state;
    assertContacts(previous, state);
    assert.deepEqual(state.position, habitat.origin);
  }
  for (let i = 0; i < 100; i++) {
    previous = state;
    state = locomotor.stepDriven([], { settle: true }).state;
    assertContacts(previous, state);
    assert.deepEqual(state.position, habitat.origin, 'support recovery does not drag the body');
  }
  assert.equal(state.stepsCompleted, 4, 'each fan changes through exactly one lifted replant');
  assert(state.feet.every(foot => foot.phase === 'stance' && foot.toeSpread === 1.15));
  const settled = state;
  for (let i = 0; i < 40; i++) state = locomotor.stepDriven([], { settle: true }).state;
  assert.equal(state.stepsCompleted, settled.stepsCompleted, 'settled recovery has no walk-in-place loop');
  assert.deepEqual(state.feet, settled.feet);
  model.dispose();
});

test('a supported lunge moves the root, keeps planted toe anchors, then recovers each contact in sequence', () => {
  const locomotor = createGeckoLocomotor({ seed: 52, heading: 0, habitat });
  const { model } = locomotor;
  const initial = model.getSnapshot();
  let state = initial;
  // Brace: finish any outstanding step without starting another one.
  for (let i = 0; i < 20; i++) state = locomotor.stepDriven([], { hold: true }).state;
  assert.deepEqual(state.position, initial.position);
  assert.deepEqual(state.feet, initial.feet);
  // Twelve fixed ticks with smooth displacement endpoints: .10 total units.
  const ease = t => t * t * (3 - 2 * t);
  for (let i = 0; i < 12; i++) {
    const previous = state;
    const dx = .10 * (ease((i + 1) / 12) - ease(i / 12));
    state = locomotor.stepDriven([], { hold: true, rootDelta: { x: dx, y: 0 } }).state;
    assertContacts(previous, state);
    assert(distance(state.position, previous.position) <= .025 + EPS);
    assert.equal(state.feet.filter(foot => foot.phase === 'stance').length, 4,
      'the short supported strike does not teleport feet');
  }
  assert(Math.abs(state.position.x - .10) < EPS, 'strike has real body displacement');
  assert.equal(state.stepsCompleted, 0);
  const landing = { ...state.position }, order = [];
  for (let i = 0; i < 100; i++) {
    const previous = state;
    state = locomotor.stepDriven([], { settle: true }).state;
    assertContacts(previous, state);
    assert.deepEqual(state.position, landing);
    for (const foot of state.feet) {
      if (foot.phase === 'swing' && byId(previous.feet, foot.id).phase === 'stance') order.push(foot.id);
    }
  }
  assert.deepEqual(order, ['front-left', 'rear-right', 'front-right', 'rear-left']);
  assert.equal(state.stepsCompleted, 4);
  assert(state.feet.every(foot => foot.phase === 'stance'));
  model.dispose();
});

test('a step peels in place, transfers, and adheres before the next foot moves', () => {
  const locomotor = createGeckoLocomotor({ heading: 0, habitat, options: { stepTicks: 30 } });
  const initial = locomotor.model.getSnapshot();
  let state = locomotor.stepDriven([guide(initial)], {}).state;
  const swing = state.feet.find(foot => foot.phase === 'swing');
  assert(swing);
  const root = { ...state.position };
  let maxLift = 0, translatedFrames = 0;
  for (let age = 1; age <= 30; age++) {
    const previous = state;
    state = locomotor.stepDriven([], { hold: true, rootDelta: { x: .01, y: 0 } }).state;
    const foot = byId(state.feet, swing.id);
    assertContacts(previous, state);
    assert.deepEqual(state.position, root, 'brace does not keep following the old guide');
    if (age <= 5) assert.deepEqual(foot.position, swing.from, 'peel has no wall-plane toe sliding');
    if (age >= 25) assert.deepEqual(foot.position, swing.to, 'adhesion holds the new wall anchor');
    if (age > 5 && age < 25 && distance(foot.position, swing.from) > EPS) translatedFrames++;
    if (foot.phase === 'swing') maxLift = Math.max(maxLift, foot.lift);
  }
  assert(translatedFrames > 10);
  assert(maxLift > .03, 'transfer lifts the foot off the wall');
  assert.equal(state.stepsCompleted, 1, 'hold permits the lifted foot to land, but starts no extra step');
  assert(state.feet.every(foot => foot.phase === 'stance'));
  locomotor.model.dispose();
});

test('driven movement is finite, atomic, bounded by contacts and clamped at the habitat edge', () => {
  const locomotor = createGeckoLocomotor({ heading: 0, habitat });
  const initial = locomotor.model.getSnapshot();
  for (const drive of [
    null, [], { unknown: true }, { hold: 1 }, { settle: undefined },
    { rootDelta: undefined }, { rootDelta: { x: 0 } },
    { rootDelta: { x: NaN, y: 0 } }, { rootDelta: { x: 0, y: Infinity } },
    { rootDelta: { x: .026, y: 0 } }, { rootDelta: { x: .02, y: .02 } },
    { rootDelta: { x: 0, y: 0, z: 0 } },
  ]) {
    assert.throws(() => locomotor.stepDriven([], drive));
    assert.deepEqual(locomotor.model.getSnapshot(), initial);
  }
  assert.throws(() => locomotor.stepDriven([{ type: 'guide', tick: 2, seq: 1, x: 0, y: 0 }],
    { hold: true, rootDelta: { x: .01, y: 0 } }));
  assert.deepEqual(locomotor.model.getSnapshot(), initial, 'invalid events cannot partly apply a drive');
  let state = initial;
  for (let i = 0; i < 100; i++) {
    const previous = state;
    state = locomotor.stepDriven([], { hold: true, rootDelta: { x: .025, y: 0 } }).state;
    assertContacts(previous, state);
  }
  assert(state.position.x > .1 && state.position.x < .3,
    'overreaching body movement stops instead of stretching or dragging supports');
  assert.deepEqual(state.feet, initial.feet);
  const edge = createGeckoLocomotor({ heading: 0,
    habitat: { ...habitat, origin: { x: 1.99, y: 0 } } });
  assert.equal(edge.stepDriven([], { hold: true, rootDelta: { x: .025, y: 0 } }).state.position.x, 2);
  edge.model.dispose();locomotor.model.dispose();
  assert.throws(() => locomotor.stepDriven([], {}), /disposed/);
  locomotor.model.dispose();
});

test('normal model and driven model share state semantics; seeded drive replay ignores render grouping', () => {
  const publicModel = createGecko({ seed: 91, habitat });
  const internal = createGeckoLocomotor({ seed: 91, habitat });
  for (let i = 0; i < 120; i++) {
    const input = i === 0 ? [guide(publicModel.getSnapshot())] : [];
    assert.deepEqual(publicModel.step(input), internal.stepDriven(input, {}));
  }
  function replay(group) {
    const locomotor = createGeckoLocomotor({ seed: 37, heading: 0, habitat });
    let state = locomotor.model.getSnapshot();
    const checkpoints = [];
    for (let tick = 1; tick <= 240; tick++) {
      if (tick === 60) locomotor.model.update({ toeSpread: 1.1 });
      const input = tick === 1 ? [guide(state, .8, 0)] : [];
      const drive = tick < 20 ? {} : tick < 40 ? { hold: true }
        : tick < 50 ? { hold: true, rootDelta: { x: .008, y: 0 } }
        : tick < 170 ? { settle: true } : {};
      const previous = state;
      state = locomotor.stepDriven(input, drive).state;
      assertContacts(previous, state);
      if (tick % group === 0) {
        renderGeckoGrid(state, { cols: 112, rows: 50 });
        const result = sampleGecko(state, point => {
          assert([point.x, point.y, point.z, point.tone].every(Number.isFinite));
        });
        assert(result.samples <= result.capacity);
      }
      if (tick % 20 === 0) checkpoints.push(state);
    }
    const result = { checkpoints, text: renderGeckoGrid(state, { cols: 112, rows: 50 }).text };
    const reset = locomotor.model.reset();
    assert.equal(reset.tick, 0);
    assert(reset.feet.every(foot => foot.phase === 'stance' && foot.toeSpread === 1.1));
    locomotor.model.dispose();
    return result;
  }
  const one = replay(1);
  assert.deepEqual(replay(2), one);
  assert.deepEqual(replay(5), one);
  publicModel.dispose();internal.model.dispose();
});

test('interrupted strides and sideways drives cannot fold a joint through an adhered foot', () => {
  // These two trajectories exposed different failures during implementation:
  // an unreachable mid-transfer landing and a shoulder crossing its support.
  for (const seed of [5, 6]) {
    const locomotor = createGeckoLocomotor({ seed, heading: seed * .6 - 2, habitat,
      options: { stepTicks: seed % 2 ? 12 : 30, creepSpeed: .18, turnRate: 1.2 } });
    let state = locomotor.model.getSnapshot();
    for (let tick = 1; tick <= 400; tick++) {
      const events = tick % 61 === 1
        ? [guide(state, Math.cos(tick * .031 + seed), Math.sin(tick * .031 + seed))] : [];
      const phase = tick % 200;
      const drive = phase < 50 ? {} : phase < 100
        ? { hold: true, rootDelta: { x: Math.cos(tick * .045) * .025, y: Math.sin(tick * .045) * .025 } }
        : phase < 180 ? { settle: true } : { hold: true };
      const previous = state;
      state = locomotor.stepDriven(events, drive).state;
      assertContacts(previous, state);
      assert(distance(state.position, previous.position) <= .025 + EPS);
    }
    locomotor.model.dispose();
  }
});

test('a directed climb assesses, moves by sequential wall contacts, then settles without sticky feet', () => {
  const director = createGeckoDirector({ seed: 37, options: { autonomy: false, population: 1 } });
  let previous = director.getSnapshot();
  const start = worldPosition(member(previous, 'mica'));
  let movement = 0, swings = 0, state;
  for (let tick = 1; tick <= 440; tick++) {
    state = director.step(tick === 1 ? [cue(director, { type: 'inspect', id: 'mica' })] : []).state;
    const actor = member(state, 'mica'), before = member(previous, 'mica');
    assertContacts(before.body, actor.body);
    if (tick <= 20) assert.deepEqual(worldPosition(actor), start, 'inspect anticipates before climbing');
    movement = Math.max(movement, distance(worldPosition(actor), start));
    for (const foot of actor.body.feet) {
      if (foot.phase === 'swing' && byId(before.body.feet, foot.id).phase === 'stance') swings++;
    }
    if (tick > 400) assert.deepEqual(actor.body.position, before.body.position, 'expired inspection has a quiet recovery');
    previous = state;
  }
  assert(movement > .25, 'the climb advances visibly on the wall');
  assert(swings >= 8, 'the climb uses repeated sequential contact cycles');
  assert.equal(member(state, 'mica').motive, 'watch');
  assert(member(state, 'mica').body.feet.every(foot => foot.phase === 'stance'));
  assert.equal(state.pointer, null);
  director.dispose();
});

test('manual moth tracking includes a supported physical pounce and a complete contact recovery', () => {
  const director = createGeckoDirector({ seed: 37, options: { autonomy: false } });
  let previous = director.getSnapshot();
  const start = worldPosition(member(previous));
  let braceFrames = 0, strikeTravel = 0, strikeFrames = 0, recoveryFrames = 0;
  let strikeEnd = null, recoveryPlants = 0, sawReturn = false, state;
  for (let tick = 1; tick <= 800; tick++) {
    state = director.step(tick === 1 ? [cue(director, { type: 'moth', id: 'pip' })] : []).state;
    const actor = member(state), before = member(previous);
    assertContacts(before.body, actor.body);
    const step = distance(worldPosition(actor), worldPosition(before));
    assert(step <= .025 * actor.scale + EPS, 'pounce cannot teleport the body');
    if (tick <= 24) assert.deepEqual(worldPosition(actor), start, 'the hunter first notices the insect');
    if (actor.motive === 'poise' && !strikeFrames) braceFrames++;
    if (actor.motive === 'strike') {
      assert(braceFrames >= 36, 'a real brace precedes the thrust');
      strikeFrames++;strikeTravel += step;strikeEnd = worldPosition(actor);
      assert(actor.body.feet.every(foot => foot.phase === 'stance'), 'the wall pounce remains fully supported');
    } else if (actor.motive === 'poise' && strikeFrames) {
      recoveryFrames++;
      assert.deepEqual(worldPosition(actor), strikeEnd, 'recovery holds the landing while each contact replants');
      for (const foot of actor.body.feet) {
        if (foot.phase === 'stance' && byId(before.body.feet, foot.id).phase === 'swing') recoveryPlants++;
      }
    } else if (actor.motive === 'return' && strikeFrames) {
      assert(recoveryFrames >= 115, 'recovery is complete before return travel');
      sawReturn = true;
    }
    if (actor.catches > before.catches) {
      assert.equal(actor.motive, 'strike');
      assert.equal(actor.catches, before.catches + 1);
      assertVisibleJawContact(state, actor);
      assert.equal(state.moth.visible, false);
      assert.equal(state.moth.caughtBy, 'pip');
    }
    previous = state;
  }
  assert(strikeTravel > .04 && strikeTravel <= .17 * member(state).scale + EPS,
    'the strike must advance the actual root, rather than relabel a still pose');
  assert.equal(strikeFrames, 14);
  assert.equal(recoveryPlants, 4, 'all four support contacts recover in sequence');
  assert(sawReturn);
  assert.equal(member(state).catches, 1);
  assert.equal(member(state, 'mica').catches, 0);
  assert.equal(member(state, 'slate').catches, 0);
  director.dispose();
});

test('automatic lantern hunts actually strike and recover at slow, normal and fast supported tempos', () => {
  for (const tempo of [.4, 1, 1.6]) {
    const director = createGeckoDirector({ seed: 37, options: { scene: 'lantern-hunt', tempo } });
    let previous = director.getSnapshot(), strikeTravel = 0, recoveryPlants = 0, state;
    for (let tick = 1; tick < Math.ceil(1320 / tempo); tick++) {
      state = director.step().state;
      const actor = member(state), before = member(previous);
      assertContacts(before.body, actor.body);
      if (actor.motive === 'strike') strikeTravel += distance(worldPosition(actor), worldPosition(before));
      if (actor.catches > before.catches) {
        assert.equal(actor.motive, 'strike');
        assertVisibleJawContact(state, actor);
      }
      if (actor.motive === 'poise' && actor.emotion === 'content') {
        for (const foot of actor.body.feet) {
          if (foot.phase === 'stance' && byId(before.body.feet, foot.id).phase === 'swing') recoveryPlants++;
        }
      }
      previous = state;
    }
    assert.equal(member(state).catches, 1, `tempo ${tempo}: the authored first hunt must reach and catch its insect`);
    assert(strikeTravel > .04, `tempo ${tempo}: the score needs actual pounce displacement`);
    assert(recoveryPlants >= 4, `tempo ${tempo}: supports must recover after striking`);
    director.dispose();
  }
});

test('new and repeated moth cues keep one explicit owner and cannot resurrect a superseded hunt', () => {
  const director = createGeckoDirector({ seed: 37, options: { autonomy: false } });
  const pip = member(director.getSnapshot()), position = worldPosition(pip);
  const target = { x: (position.x + Math.cos(pip.body.heading) * .65 * pip.scale) / 3.3,
    y: (position.y + Math.sin(pip.body.heading) * .65 * pip.scale) / 2.2 };
  let state = director.step([
    { type: 'moth', id: 'pip', tick: 1, seq: 1, ...target },
    { type: 'moth', id: 'mica', tick: 1, seq: 2, ...target },
  ]).state;
  assert.equal(state.lastAction.id, 'mica');
  for (let tick = 2; tick <= 450; tick++) {
    state = director.step().state;
    assert.equal(member(state).catches, 0, 'Pip cannot steal the replacement cue assigned to Mica');
    assert(state.moth.caughtBy === null || state.moth.caughtBy === 'mica');
  }
  director.dispose();
  const repeated = createGeckoDirector({ seed: 37, options: { autonomy: false } });
  for (let tick = 1; tick <= 450; tick++) {
    state = repeated.step(tick <= 61 && tick % 12 === 1
      ? [cue(repeated, { type: 'moth', id: 'pip' })] : []).state;
    if (tick < 90) assert.equal(member(state).catches, 0, 'repeated cues restart interest, not a hidden instant catch');
    assert(member(state).catches <= 1, 'one visible insect cannot yield duplicate catches');
  }
  assert.equal(member(state).catches, 1, 'the final deliberate cue still completes');
  repeated.dispose();
});

test('inspect, return and shadow can interrupt a pounce without a later ghost catch', () => {
  for (const type of ['inspect', 'return', 'shadow']) {
    const director = createGeckoDirector({ seed: 37, options: { autonomy: false } });
    let state = director.step([cue(director, { type: 'moth', id: 'pip' })]).state;
    while (member(state).motive !== 'strike') {
      state = director.step().state;
      assert(state.tick < 400, 'exercise an actual pounce before interrupting');
    }
    assert.equal(member(state).catches, 0);
    for (let i = 0; i < 180; i++) {
      const previous = state;
      state = director.step(i === 0 ? [cue(director, { type, id: 'pip' })] : []).state;
      assertContacts(member(previous).body, member(state).body);
      assert.equal(member(state).catches, 0, `${type} retains ownership over the cancelled catch`);
      assert.notEqual(member(state).motive, 'strike');
    }
    director.dispose();
  }
});

test('scene and population edits through active hunts replay exactly and preserve surviving contacts', () => {
  function replay(group) {
    const director = createGeckoDirector({ seed: 73, options: { autonomy: false } });
    let state = director.getSnapshot();
    const frames = [];
    for (let tick = 1; tick <= 720; tick++) {
      if (tick === 150 || tick === 250) {
        const before = director.getSnapshot();
        director.update({ population: tick === 150 ? 2 : 3 });
        const after = director.getSnapshot();
        for (const actor of before.individuals.slice(0, 2)) {
          assert.deepEqual(member(after, actor.id).body.feet, actor.body.feet);
          assert.deepEqual(member(after, actor.id).body.position, actor.body.position);
        }
      }
      if (tick === 175) {
        const before = director.getSnapshot();director.updateAnimal({ toeSpread: 1.12 });
        for (const actor of director.getSnapshot().individuals) assertContacts(member(before, actor.id).body, actor.body);
      }
      if (tick === 200) director.update({ scene: 'passing-shadow' });
      if (tick === 400) director.update({ scene: 'lantern-hunt', autonomy: true, reverse: true });
      const fields = tick === 1 ? { type: 'moth', id: 'pip' }
        : tick === 76 ? { type: 'select', id: 'mica' }
        : tick === 120 ? { type: 'moth', id: 'mica' }
        : tick === 220 ? { type: 'shadow', id: 'mica' }
        : tick === 450 ? { type: 'moth', id: 'pip' } : null;
      state = director.step(fields ? [cue(director, fields)] : []).state;
      if (tick % group === 0 && tick % 5 === 0) renderGeckoDirectorGrid(state, { cols: 112, rows: 72 });
      if (tick % 30 === 0) frames.push(state);
    }
    const result = { frames, text: renderGeckoDirectorGrid(state, { cols: 112, rows: 72 }).text };
    const recipe = director.exportRecipe(), reset = director.reset();
    const recreated = createGeckoDirector({ seed: recipe.seed, options: recipe.options, animal: recipe.animal,
      ...(recipe.heading === undefined ? {} : { heading: recipe.heading }) });
    assert.deepEqual(reset, recreated.getSnapshot(), 'reset clears every private hunt clock and cue');
    director.dispose();recreated.dispose();
    return result;
  }
  const one = replay(1);
  assert.deepEqual(replay(2), one);
  assert.deepEqual(replay(5), one);
  const removed = createGeckoDirector({ options: { autonomy: false } });
  let state = removed.step([cue(removed, { type: 'moth', id: 'pip' })]).state;
  while (member(state).motive !== 'strike') state = removed.step().state;
  const before = member(state, 'mica').body;
  removed.update({ population: 1 });
  assert.deepEqual(member(removed.getSnapshot(), 'mica').body, before);
  for (let tick = 0; tick < 240; tick++) {
    state = removed.step().state;
    assert.equal(state.moth.visible, false, 'a removed cue owner leaves no orphan insect');
    assert.equal(state.moth.caughtBy, null);
    assert.equal(member(state, 'mica').catches, 0);
  }
  removed.dispose();
});

test('a manual pounce spanning a score-cycle boundary can consume its insect only once', () => {
  const director = createGeckoDirector({ options: { scene: 'lantern-hunt' } });
  let state = director.getSnapshot(), countBefore = 0;
  const strikeCycles = new Set();
  for (let tick = 1; tick <= 1380; tick++) {
    let input = [];
    if (tick === 1243) {
      const actor = member(state), root = worldPosition(actor);
      countBefore = actor.catches;
      input = [cue(director, { type: 'moth', id: 'pip',
        x: (root.x + Math.cos(actor.body.heading) * .65 * actor.scale) / 3.3,
        y: (root.y + Math.sin(actor.body.heading) * .65 * actor.scale) / 2.2 })];
    }
    state = director.step(input).state;
    if (tick >= 1243) {
      assert(member(state).catches <= countBefore + 1, 'a new scene cycle cannot recatch a consumed manual insect');
      if (member(state).motive === 'strike') strikeCycles.add(state.arc.cycle);
    }
  }
  assert.equal(strikeCycles.size, 2, 'the fixture really straddles the cycle seam');
  assert.equal(member(state).catches, countBefore + 1);
  director.dispose();
});

test('mocked host C/M/Escape controls remain stage-local and cannot restart paused, reduced or hidden motion', () => {
  // Numerical/event bookkeeping only; the evidence manifest records real browser
  // execution separately. Reuse the existing shared fake host without editing it.
  const env = fakeBrowser(), canvas = env.canvas(390, 450);
  const controller = mountGecko(canvas, { director: { population: 1, autonomy: false } });
  const key = (value, extra = {}) => {
    const event = { target: canvas, key: value, code: value, repeat: false,
      altKey: false, ctrlKey: false, metaKey: false, prevented: false,
      preventDefault() { this.prevented = true; }, ...extra };
    canvas.emit('keydown', event);return event;
  };
  const pointer = () => canvas.emit('pointermove', { type: 'pointermove', pointerType: 'mouse', buttons: 0,
    clientX: 195, clientY: 170 });
  env.frame();env.frame();
  assert(key('m').prevented);env.frame();
  assert.equal(controller.getDirectorSnapshot().lastAction.type, 'moth');
  assert(key('c').prevented);env.frame();
  assert.equal(controller.getDirectorSnapshot().lastAction.type, 'inspect');
  pointer();env.frame();
  assert.notEqual(controller.getDirectorSnapshot().pointer, null);
  assert(key('Escape').prevented);env.frame();
  assert.equal(controller.getDirectorSnapshot().pointer, null);
  assert.equal(key('m', { repeat: true }).prevented, false);
  assert.equal(key('c', { target: {} }).prevented, false, 'typing in a form is not a stage command');
  assert.equal(key('m', { ctrlKey: true }).prevented, false);
  assert.equal(controller.getStatus().pendingInputs, 0);

  controller.setPaused(true);
  const paused = controller.getSnapshot();
  pointer();key('m');key('c');key('Escape');env.frame(1000);
  assert.deepEqual(controller.getSnapshot(), paused);
  assert.equal(controller.getStatus().pendingInputs, 0);
  assert.equal(env.pending, 0);
  env.setReduced(true);controller.setPaused(false);
  pointer();key('m');key('c');key('Escape');env.frame(1000);
  assert.deepEqual(controller.getSnapshot(), paused);
  assert.equal(controller.getStatus().reducedMotion, true);
  assert.equal(env.pending, 0);

  env.setReduced(false);env.frame();env.frame();env.hide(true);
  const hidden = controller.getDirectorSnapshot();
  pointer();key('m');key('c');key('Escape');env.frame(1000);
  assert.deepEqual(controller.getDirectorSnapshot(), hidden);
  assert.equal(controller.getStatus().pendingInputs, 0);
  assert.equal(env.pending, 0);
  env.hide(false);env.frame();env.frame();
  assert.equal(controller.getDirectorSnapshot().lastAction?.seq, hidden.lastAction?.seq,
    'keys while hidden cannot become delayed live cues on visibility return');
  controller.dispose();
  key('m');pointer();
  assert.equal(env.pending, 0);
  assert.equal(canvas.listenerCount, 0);
});
