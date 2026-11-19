import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGeckoDirector, resolveGeckoDirectorOptions, DEFAULT_GECKO_DIRECTOR_OPTIONS,
  GECKO_DIRECTOR_LIMITS, GECKO_SCENES, geckoSceneArc, geckoDirectorPoster,
} from '../compiled/director.js';
import { renderGeckoDirectorGrid } from '../compiled/director-preview.js';
import { getGeckoAnatomy, sampleGecko } from '../compiled/geometry.js';
import { geckoPointFromCanvas } from '../compiled/preview.js';

const EPS = 1e-9;
const clone = value => structuredClone(value);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const position = actor => ({ x: actor.body.position.x * actor.scale, y: actor.body.position.y * actor.scale });
const scaledPads = (actor, limb) => limb.pads.map(p => ({ x: p.x * actor.scale, y: p.y * actor.scale }));
const member = (state, id) => state.individuals.find(actor => actor.id === id);
const event = (director, fields) => {
  const state = director.getSnapshot();
  return { tick: state.tick + 1, seq: state.lastSequence + 1, ...fields };
};
const bodyWithoutOptions = actor => {
  const { options, ...rest } = actor.body;
  return rest;
};
const recipeConfig = recipe => ({ seed: recipe.seed, ...(recipe.heading === undefined ? {} : { heading: recipe.heading }),
  options: recipe.options, animal: recipe.animal });

test('director defaults create three independent named roles, routes and real contact models', () => {
  const director = createGeckoDirector();
  const state = director.getSnapshot();
  assert.deepEqual(state.options, DEFAULT_GECKO_DIRECTOR_OPTIONS);
  assert.equal(state.tick, 0);
  assert.equal(state.lastSequence, 0);
  assert.deepEqual(state.individuals.map(actor => actor.id), ['mica', 'pip', 'slate']);
  assert.deepEqual(state.individuals.map(actor => actor.role), ['scout', 'hunter', 'sentry']);
  assert.equal(new Set(state.individuals.map(actor => actor.body.seed)).size, 3);
  assert.equal(new Set(state.individuals.map(actor => JSON.stringify(actor.route))).size, 3);
  for (const actor of state.individuals) {
    assert(actor.scale > 0 && actor.scale <= 1);
    assert.equal(actor.body.tick, 0);
    assert.equal(actor.body.feet.length, 4);
    assert(actor.body.feet.every(foot => foot.phase === 'stance'));
    assert(Math.abs(position(actor).x) <= GECKO_DIRECTOR_LIMITS.rootX);
    assert(Math.abs(position(actor).y) <= GECKO_DIRECTOR_LIMITS.rootY);
  }
  assert.deepEqual(createGeckoDirector().getSnapshot(), state);
  const roles = ['hunter'];
  const custom = createGeckoDirector({ options: { roles } });
  roles[0] = 'sentry';
  assert.deepEqual(custom.getSnapshot().individuals.map(actor => actor.role), ['hunter', 'hunter', 'sentry']);
});

test('ordered inputs and settings replay identically with 1/2/5 render grouping; seed changes visible behavior', () => {
  const events = [
    { tick: 1, seq: 1, type: 'select', id: 'pip' },
    { tick: 1, seq: 2, type: 'guide', id: 'pip', x: .18, y: -.28 },
    { tick: 90, seq: 3, type: 'moth', id: 'pip', x: .22, y: -.24 },
    { tick: 150, seq: 4, type: 'shadow', id: 'mica', x: -.45, y: .2 },
    { tick: 250, seq: 5, type: 'leave' },
    { tick: 320, seq: 6, type: 'inspect', id: 'slate', x: .42, y: .1 },
    { tick: 400, seq: 7, type: 'return', id: 'slate' },
    { tick: 480, seq: 8, type: 'select', id: null },
    { tick: 600, seq: 9, type: 'guide', x: -.5, y: -.1 },
    { tick: 640, seq: 10, type: 'leave' },
  ];
  function replay(group, seed = 37) {
    const director = createGeckoDirector({ seed });
    const checkpoints = [];
    for (let tick = 1; tick <= 720; tick++) {
      if (tick === 200) director.update({ reverse: true });
      if (tick === 450) director.update({ scene: 'lantern-hunt' });
      if (tick === 570) director.update({ tempo: 1.2, boldness: .8 });
      const result = director.step(events.filter(input => input.tick === tick));
      if (tick % group === 0) renderGeckoDirectorGrid(result.state, { cols: 112, rows: 72, neutral: true });
      if (tick % 30 === 0) checkpoints.push(result);
    }
    return { checkpoints, text: renderGeckoDirectorGrid(director.getSnapshot()).text };
  }
  const one = replay(1);
  assert.deepEqual(replay(2), one);
  assert.deepEqual(replay(5), one);
  const changed = replay(5, 89437);
  assert.notEqual(changed.text, one.text);
  assert.notDeepEqual(changed.checkpoints.map(frame => frame.state.individuals.map(position)),
    one.checkpoints.map(frame => frame.state.individuals.map(position)), 'seed must affect action timing, not just a metadata field');
});

test('all authored scenes produce travel and independent motives while world-space stance pads remain fixed', () => {
  for (const scene of GECKO_SCENES) {
    const director = createGeckoDirector({ options: { scene: scene.id } });
    let prior = director.getSnapshot();
    const starts = prior.individuals.map(position);
    const maxTravel = [0, 0, 0];
    const motives = prior.individuals.map(() => new Set());
    let fixedContacts = 0, independentFrames = 0;
    for (let tick = 1; tick <= scene.ticks; tick++) {
      const state = director.step().state;
      if (new Set(state.individuals.map(actor => actor.motive)).size > 1) independentFrames++;
      for (let i = 0; i < state.individuals.length; i++) {
        const actor = state.individuals[i], previous = prior.individuals[i];
        assert.equal(actor.id, previous.id);
        assert.equal(actor.scale, previous.scale, 'placement scale is constant during every gait');
        assert.equal(actor.body.tick, tick);
        assert(actor.body.feet.filter(foot => foot.phase === 'stance').length >= 3);
        const anatomy = getGeckoAnatomy(actor.body), previousAnatomy = getGeckoAnatomy(previous.body);
        for (const foot of actor.body.feet) {
          const before = previous.body.feet.find(candidate => candidate.id === foot.id);
          const limb = anatomy.limbs.find(candidate => candidate.id === foot.id);
          assert(distance(limb.shoulder, limb.palm) <= .44 + EPS);
          assert.equal(limb.pads.length, 5);
          if (foot.phase === 'stance' && before.phase === 'stance' && foot.plantedAt === before.plantedAt) {
            assert.deepEqual(foot.position, before.position);
            assert.equal(foot.angle, before.angle);
            assert.deepEqual(scaledPads(actor, limb), scaledPads(previous,
              previousAnatomy.limbs.find(candidate => candidate.id === foot.id)), `${scene.id}/${actor.id} drags its planted pads`);
            fixedContacts++;
          }
        }
        assert(Math.abs(position(actor).x) <= 2 + EPS && Math.abs(position(actor).y) <= 1 + EPS);
        maxTravel[i] = Math.max(maxTravel[i], distance(position(actor), starts[i]));
        motives[i].add(actor.motive);
      }
      prior = state;
    }
    maxTravel.forEach((travel, i) => assert(travel > .18, `${scene.id}/${prior.individuals[i].id} needs actual route travel; got ${travel}`));
    motives.forEach((seen, i) => assert(seen.size >= 2, `${scene.id}/${prior.individuals[i].id} needs changing motives`));
    assert(independentFrames > 100, `${scene.id} must not move all members in lockstep`);
    assert(fixedContacts > scene.ticks * 8);
  }
});

test('guidance ownership follows ordered selection, explicit IDs and nearest-member fallback', () => {
  const director = createGeckoDirector({ options: { autonomy: false } });
  const first = director.getSnapshot();
  const selected = director.step([
    { type: 'select', tick: 1, seq: 1, id: 'pip' },
    { type: 'guide', tick: 1, seq: 2, x: .2, y: -.2 },
  ]);
  assert.deepEqual(selected.inputs.map(receipt => receipt.id), ['pip', 'pip']);
  assert.equal(member(selected.state, 'pip').motive, 'inspect');
  assert.equal(member(selected.state, 'mica').goal, null);
  assert.equal(member(selected.state, 'slate').goal, null);
  const explicit = director.step([event(director, { type: 'inspect', id: 'mica', x: -.35, y: .15 })]);
  assert.equal(explicit.inputs[0].id, 'mica');
  assert.equal(explicit.state.selectedId, 'pip', 'a directed cue does not silently change selection');
  director.select(null);
  const nearest = director.step([event(director, { type: 'guide', x: .49, y: -.12 })]);
  assert.equal(nearest.inputs[0].id, 'slate');
  assert.equal(nearest.state.selectedId, null);
  for (let i = 0; i < 100; i++) director.step();
  assert(distance(position(member(director.getSnapshot(), 'mica')), position(member(first, 'mica'))) > .08,
    'inspection includes real contact-gait approach');
  const left = director.step([event(director, { type: 'leave' })]).state;
  assert.equal(left.pointer, null);
  assert(left.individuals.every(actor => actor.goal === null && actor.motive === 'watch'));
});

test('inspection approaches, expires naturally, and settles without a latent movement target', () => {
  const director = createGeckoDirector({ options: { autonomy: false, boldness: 0 } });
  const initial = position(member(director.getSnapshot(), 'mica'));
  const first = director.step([event(director, { type: 'inspect', id: 'mica', x: -.35, y: .1 })]).state;
  assert.equal(member(first, 'mica').motive, 'inspect');
  for (let i = 0; i < 399; i++) director.step();
  const settled = member(director.getSnapshot(), 'mica');
  assert(distance(position(settled), initial) > .15, 'inspection must involve approach before settling');
  assert.equal(settled.motive, 'watch');
  assert.equal(settled.goal, null);
  assert.equal(settled.body.target, null);
  assert.equal(settled.body.behavior.kind, 'idle');
  assert.equal(director.getSnapshot().pointer, null, 'an expired interest does not leave a stale crosshair');
  assert(settled.tailExpression < .1, 'curious tail expression recovers after interest expires');
  for (let i = 0; i < 120; i++) director.step();
  assert.deepEqual(position(member(director.getSnapshot(), 'mica')), position(settled));
});

test('deliberate shadow completes hold, backward retreat, recovery and cooldown without retrigger extension', () => {
  const director = createGeckoDirector({ options: { autonomy: false } });
  const initial = director.getSnapshot(), id = 'mica';
  const first = director.step([event(director, { type: 'shadow', id })]);
  assert.equal(first.inputs[0].outcome, 'applied');
  const start = member(first.state, id);
  const total = start.body.options.startleTicks + start.body.options.retreatTicks +
    start.body.options.recoveryTicks + start.body.options.cooldownTicks;
  assert.equal(start.body.behavior.kind, 'startle');
  assert.equal(start.cooldown, total);
  const phases = ['startle'];
  let retreatStart = null, retreatEnd = null, recoverySeen = false;
  for (let i = 0; i < total + 5; i++) {
    const snapshot = director.getSnapshot();
    const input = snapshot.tick === 10 || snapshot.tick === 150
      ? [event(director, { type: 'shadow', id })] : [];
    const result = director.step(input), actor = member(result.state, id);
    if (input.length) {
      assert.deepEqual(result.inputs[0], { seq: input[0].seq, type: 'shadow', outcome: 'ignored', reason: 'busy', id });
      assert.equal(actor.cooldown, Math.max(0, 1 + total - result.state.tick));
    }
    if (phases.at(-1) !== actor.body.behavior.kind) phases.push(actor.body.behavior.kind);
    if (actor.body.behavior.kind === 'retreat') { retreatStart ??= position(actor); retreatEnd = position(actor); }
    if (actor.body.behavior.kind === 'recover') recoverySeen = true;
  }
  assert.deepEqual(phases.slice(0, 4), ['startle', 'retreat', 'recover', 'cooldown']);
  assert(recoverySeen && phases.some(phase => phase === 'idle' || phase === 'approach'));
  assert(retreatStart && retreatEnd);
  const traveled = distance(retreatStart, retreatEnd);
  assert(traveled > .03 && traveled <= start.body.options.retreatDistance + EPS);
  const direction = member(initial, id).body.heading;
  assert((retreatEnd.x - retreatStart.x) * Math.cos(direction) +
    (retreatEnd.y - retreatStart.y) * Math.sin(direction) < -.025);
  assert.equal(member(director.getSnapshot(), id).cooldown, 0);
  assert.equal(director.step([event(director, { type: 'shadow', id })]).inputs[0].outcome, 'applied');
});

test('default lantern hunt reaches a real moth, poises, strikes, and returns with distance-gated catches', () => {
  const director = createGeckoDirector({ options: { scene: 'lantern-hunt' } });
  let previous = director.getSnapshot();
  const motives = new Set(), catches = [], catchCycles = new Set();
  let firstCatchPosition = null, closestAfterReturn = Infinity;
  const home = position(member(previous, 'pip'));
  for (let tick = 1; tick <= 2640; tick++) {
    const state = director.step().state, actor = member(state, 'pip'), before = member(previous, 'pip');
    motives.add(actor.motive);
    if (actor.catches > before.catches) {
      assert.equal(actor.catches, before.catches + 1);
      assert.equal(state.moth.caughtBy, 'pip');
      assert.equal(state.moth.visible, false);
      const p = position(before);
      const head = { x: p.x + Math.cos(before.body.heading) * .49 * before.scale,
        y: p.y + Math.sin(before.body.heading) * .49 * before.scale };
      assert(distance(head, state.moth.position) < .18 + EPS, 'catch requires the actual head to reach the moth');
      const toward = Math.atan2(state.moth.position.y - p.y, state.moth.position.x - p.x);
      assert(Math.cos(toward - before.body.heading) > .7);
      assert(!catchCycles.has(state.arc.cycle), 'an automatic hunt catches at most once per score cycle');
      catchCycles.add(state.arc.cycle); catches.push(tick); firstCatchPosition ??= position(actor);
    }
    if (firstCatchPosition && actor.motive === 'return') closestAfterReturn = Math.min(closestAfterReturn, distance(position(actor), home));
    previous = state;
  }
  assert(catches.length >= 1, 'the default authored hunt must actually catch, not merely label a hunt');
  for (const motive of ['stalk', 'poise', 'strike', 'return']) assert(motives.has(motive), `missing hunt phase ${motive}`);
  assert(closestAfterReturn < distance(firstCatchPosition, home) - .05, 'return must include real travel toward shelter');
});

test('explicit inspection, shadow and return intentions take priority over an otherwise eligible automatic strike', () => {
  for (const type of ['inspect', 'shadow', 'return']) {
    const director = createGeckoDirector({ options: { scene: 'lantern-hunt' } });
    const control = createGeckoDirector({ options: { scene: 'lantern-hunt' } });
    // A pounce now takes physical time. Intervene on the actual contact tick,
    // rather than assuming a score label itself awards the catch.
    while (member(control.getSnapshot(), 'pip').catches === 0) {
      control.step();
      assert(control.getSnapshot().tick < 1320, 'the authored first hunt must reach the prey');
    }
    const contactTick=control.getSnapshot().tick;
    while(director.getSnapshot().tick<contactTick-1)director.step();
    assert.equal(member(director.getSnapshot(), 'pip').catches, 0);
    assert.equal(member(control.getSnapshot(), 'pip').catches, 1, 'control confirms an actual eligible strike');
    const result = director.step([event(director, { type, id: 'pip' })]);
    assert.equal(result.inputs[0].outcome, 'applied');
    assert.equal(member(result.state, 'pip').catches, 0, `${type} must not be replaced by a hidden automatic catch`);
    for (let i = 0; i < 60; i++) {
      assert.equal(member(director.step().state, 'pip').catches, 0, `${type} retains priority during the strike window`);
    }
  }
});

test('a distant manual moth cannot award a fake catch; a reachable moth belongs to its named hunter', () => {
  const far = createGeckoDirector({ options: { autonomy: false } });
  far.step([event(far, { type: 'moth', id: 'mica', x: 1, y: -1 })]);
  for (let tick = 1; tick < 600; tick++) {
    const state = far.step().state;
    assert.equal(member(state, 'mica').catches, 0, 'moth expiry or a score window cannot manufacture a catch');
    assert.equal(state.moth.caughtBy, null);
  }
  const near = createGeckoDirector({ options: { autonomy: false } });
  const actor = member(near.getSnapshot(), 'pip'), p = position(actor);
  const head = { x: p.x + Math.cos(actor.body.heading) * .49 * actor.scale,
    y: p.y + Math.sin(actor.body.heading) * .49 * actor.scale };
  let state = near.step([event(near, { type: 'moth', id: 'pip', x: head.x / 3.3, y: head.y / 2.2 })]).state;
  for (let i = 0; i < 180 && member(state, 'pip').catches === 0; i++) state = near.step().state;
  assert.equal(member(state, 'pip').catches, 1);
  assert.equal(state.moth.caughtBy, 'pip');
  assert.equal(member(state, 'mica').catches, 0);
  assert.equal(member(state, 'slate').catches, 0);
});

test('an unsuccessful moth cue expires into a real return rather than chasing an invisible replacement', () => {
  const director = createGeckoDirector({ options: { autonomy: false, population: 1 } });
  const home = position(member(director.getSnapshot(), 'mica'));
  director.step([event(director, { type: 'moth', id: 'mica', x: 1, y: -1 })]);
  let returnDistance = null;
  for (let tick = 2; tick <= 1000; tick++) {
    const state = director.step().state, actor = member(state, 'mica');
    assert.equal(actor.catches, 0);
    if (!state.moth.visible) {
      returnDistance ??= distance(position(actor), home);
      assert(['return', 'watch'].includes(actor.motive), 'an invisible expired moth cannot remain a stalk/poise/strike goal');
    }
  }
  assert(returnDistance !== null && returnDistance > .2, 'exercise an actual failed excursion before cue expiry');
  assert(distance(position(member(director.getSnapshot(), 'mica')), home) < returnDistance - .1,
    'a missed hunt must travel back toward shelter');
});

test('director options, bases, animal updates and reset validation reject atomically', () => {
  const invalid = [null, [], 2, { unknown: true }, { [Symbol('extra')]: true },
    { scene: 'ocean' }, { scene: undefined }, { population: 0 }, { population: 4 }, { population: 1.5 },
    { tempo: .399 }, { tempo: 1.601 }, { tempo: NaN }, { tempo: Infinity }, { tempo: undefined },
    { boldness: -.01 }, { boldness: 1.01 }, { boldness: NaN }, { reverse: 1 },
    { showRoutes: 'yes' }, { autonomy: undefined }, { roles: [] }, { roles: ['bird'] },
    { roles: ['scout', 'hunter', 'sentry', 'scout'] }, { roles: [undefined] }, { roles: new Array(2) },
    Object.defineProperty({}, 'tempo', { value: NaN }),
  ];
  const director = createGeckoDirector();
  director.step([event(director, { type: 'inspect', id: 'mica', x: -.3, y: 0 })]);
  const before = director.getSnapshot(), recipe = director.exportRecipe();
  for (const [index, patch] of invalid.entries()) {
    assert.throws(() => createGeckoDirector({ options: patch }), undefined, `creation accepted invalid option case ${index}`);
    assert.throws(() => director.update(patch), undefined, `update accepted invalid option case ${index}`);
    assert.deepEqual(director.getSnapshot(), before);
    assert.deepEqual(director.exportRecipe(), recipe);
  }
  for (const base of [{ ...DEFAULT_GECKO_DIRECTOR_OPTIONS, tempo: NaN }, { ...DEFAULT_GECKO_DIRECTOR_OPTIONS, extra: 1 }]) {
    assert.throws(() => resolveGeckoDirectorOptions({}, base));
  }
  for (const patch of [{ creepSpeed: NaN }, { stepTicks: 2 }, { scene: 'moonlit-wall' }, { tailLength: undefined }]) {
    assert.throws(() => director.updateAnimal(patch));
    assert.deepEqual(director.getSnapshot(), before);
    assert.deepEqual(director.exportRecipe(), recipe);
  }
  for (const reset of [{ seed: -1 }, { heading: NaN }, { habitat: {} }, { options: {} }, { mystery: 1 }]) {
    assert.throws(() => director.reset(reset));
    assert.deepEqual(director.getSnapshot(), before);
  }
  for (const config of [{ seed: -1 }, { heading: 4 }, { animal: { creepSpeed: NaN } }, { population: 2 }]) {
    assert.throws(() => createGeckoDirector(config));
  }
  for (const patch of [{ population: 1, tempo: .4, boldness: 0 }, { population: 3, tempo: 1.6, boldness: 1 }]) {
    const resolved = resolveGeckoDirectorOptions(patch);
    assert.equal(resolved.tempo, patch.tempo);
  }
});

test('invalid ordered input batches have no partial effects and the event budget is enforced', () => {
  const director = createGeckoDirector({ options: { autonomy: false } });
  const before = director.getSnapshot();
  const prefix = { type: 'guide', tick: 1, seq: 1, x: .2, y: -.3, id: 'mica' };
  const invalid = [
    { type: 'guide', x: NaN, y: 0 }, { type: 'guide', x: 1.01, y: 0 },
    { type: 'guide', x: 0, y: -1.01 }, { type: 'guide', x: 0 },
    { type: 'guide', x: 0, y: 0, id: null }, { type: 'inspect', id: null },
    { type: 'moth', x: 0 }, { type: 'shadow', y: 0 }, { type: 'inspect', x: undefined, y: undefined },
    { type: 'guide', x: 0, y: 0, id: 'ghost' }, { type: 'select' }, { type: 'select', id: undefined },
    { type: 'leave', id: 'mica' }, { type: 'return', extra: true }, { type: 'teleport' },
    { type: 'leave', tick: 2 }, { type: 'leave', seq: 1 }, { type: 'leave', seq: 2.5 },
    { type: 'leave', [Symbol('extra')]: true },
  ];
  for (const bad of invalid) {
    assert.throws(() => director.step([prefix, { tick: 1, seq: 2, ...bad }]));
    assert.deepEqual(director.getSnapshot(), before, `invalid ${bad.type} partially applied its preceding guidance`);
  }
  for (const batch of [null, {}, 'leave', new Array(2), Array.from({ length: 33 }, (_, i) => ({ type: 'leave', tick: 1, seq: i + 1 }))]) {
    assert.throws(() => director.step(batch));
    assert.deepEqual(director.getSnapshot(), before);
  }
  director.update({ population: 1 });
  assert.throws(() => director.step([{ type: 'inspect', id: 'pip', tick: 1, seq: 1 }]));
  assert.equal(director.getSnapshot().tick, 0);
  const result = director.step(Array.from({ length: 32 }, (_, i) => ({ type: 'leave', tick: 1, seq: i + 1 })));
  assert.equal(result.inputs.length, 32);
  assert.equal(result.state.lastSequence, 32);
  assert.equal(result.state.tick, 1);
});

test('population, role and scene changes preserve survivor contacts, seeds and clocks', () => {
  const director = createGeckoDirector();
  for (let i = 0; i < 250; i++) director.step();
  director.select('slate');
  const before = director.getSnapshot();
  director.update({ population: 2, roles: ['sentry', 'scout'], tempo: 1.3 });
  const fewer = director.getSnapshot();
  assert.equal(fewer.selectedId, 'mica');
  assert.equal(fewer.tick, before.tick);
  assert.equal(fewer.individuals.length, 2);
  for (let i = 0; i < 2; i++) assert.deepEqual(bodyWithoutOptions(fewer.individuals[i]), bodyWithoutOptions(before.individuals[i]));
  assert.deepEqual(fewer.individuals.map(actor => actor.role), ['sentry', 'scout']);
  director.update({ scene: 'passing-shadow', population: 3 });
  const changed = director.getSnapshot();
  assert.equal(changed.arc.scoreTick, 0);
  assert.equal(changed.arc.scene, 'passing-shadow');
  assert.equal(changed.tick, before.tick);
  assert.equal(changed.individuals[2].body.tick, 0);
  for (let i = 0; i < 2; i++) assert.deepEqual(changed.individuals[i].body, fewer.individuals[i].body);
  const animal = director.updateAnimal({ curlStrength: .7, tailLength: .9 });
  assert.equal(animal.curlStrength, .7);
  const afterAnimal = director.getSnapshot();
  afterAnimal.individuals.forEach((actor, i) => {
    assert.equal(actor.body.options.curlStrength, .7);
    assert.deepEqual(actor.body.feet, changed.individuals[i].body.feet);
    assert.deepEqual(actor.body.position, changed.individuals[i].body.position);
  });
  assert.throws(() => director.select('ghost'));
  assert.deepEqual(director.getSnapshot(), afterAnimal);
});

test('reset and exported recipes reproduce configured headings, roles, animal settings and initial cue state', () => {
  const director = createGeckoDirector({ seed: 841, heading: .9,
    options: { scene: 'passing-shadow', roles: ['hunter', 'sentry'], tempo: .8, reverse: true },
    animal: { toeSpread: 1.1, creepSpeed: .12 } });
  const initial = director.getSnapshot();
  director.step([event(director, { type: 'shadow', id: 'mica', x: -.5, y: .4 })]);
  for (let i = 0; i < 73; i++) director.step();
  director.select('pip');
  const recipe = director.exportRecipe();
  assert.equal(recipe.kind, 'gecko-scene-recipe');
  assert.equal(recipe.startsAtTick, 0);
  assert.equal(recipe.heading, .9, 'settings replay retains a configured initial heading');
  const recreated = createGeckoDirector(recipeConfig(JSON.parse(JSON.stringify(recipe))));
  assert.deepEqual(recreated.getSnapshot(), initial);
  assert.deepEqual(director.reset(), initial, 'reset clears previous shadow position and every cue clock');
  director.update({ population: 2, boldness: .1 });
  director.updateAnimal({ curlStrength: .6 });
  const reset = director.reset({ seed: 0, heading: -.3 });
  assert.equal(reset.tick, 0);
  assert.equal(reset.seed, 0);
  assert.equal(reset.options.population, 2);
  assert.equal(reset.options.boldness, .1);
  assert(reset.individuals.every(actor => actor.body.heading === -.3 && actor.body.options.curlStrength === .6));
  assert.deepEqual(createGeckoDirector(recipeConfig(director.exportRecipe())).getSnapshot(), reset);
});

test('snapshots and settings are defensive; static posters change an informative pose without simulation', () => {
  const director = createGeckoDirector();
  director.step([event(director, { type: 'inspect', id: 'pip', x: .2, y: -.1 })]);
  const before = director.getSnapshot(), detached = director.getSnapshot();
  detached.options.roles[0] = 'hunter';
  detached.individuals[0].body.habitat.origin.x = 99;
  detached.individuals[0].body.feet[0].position.x = 99;
  detached.individuals[0].route[0].x = 99;
  detached.pointer.x = 99;
  detached.shadow.position.y = 99;
  detached.moth.position.x = 99;
  detached.lastAction.id = 'slate';
  assert.deepEqual(director.getSnapshot(), before);
  const recipe = director.exportRecipe();
  recipe.options.roles[0] = 'sentry'; recipe.animal.creepSpeed = .02;
  assert.notDeepEqual(director.exportRecipe(), recipe);
  const resolved = director.update({ showRoutes: true });
  resolved.roles[0] = 'hunter';
  assert.equal(director.getSnapshot().options.roles[0], 'scout');
  const state = director.getSnapshot(), copied = clone(state);
  const baseGrid = renderGeckoDirectorGrid(state).text;
  for (const type of ['shadow', 'moth', 'inspect', 'return']) {
    const poster = geckoDirectorPoster(state, { type, id: 'mica' });
    assert.deepEqual(state, copied, 'poster construction must not mutate the input snapshot');
    assert.equal(poster.tick, state.tick);
    assert.equal(poster.lastSequence, state.lastSequence);
    poster.individuals.forEach((actor, i) => {
      assert.equal(actor.body.tick, state.individuals[i].body.tick);
      assert.deepEqual(actor.body.feet, state.individuals[i].body.feet);
      assert.deepEqual(actor.body.position, state.individuals[i].body.position);
    });
    const rendered = renderGeckoDirectorGrid(poster);
    assert.equal(rendered.samples, renderGeckoDirectorGrid(state).samples);
    if (type === 'shadow' || type === 'moth' || type === 'inspect') assert.notEqual(rendered.text, baseGrid);
  }
  assert.deepEqual(director.getSnapshot(), copied);
});

test('director geometry and cell output remain finite, bounded, attached and read-only for every scene and population', () => {
  for (const scene of GECKO_SCENES) for (const population of [1, 2, 3]) {
    const director = createGeckoDirector({ options: { scene: scene.id, population, showRoutes: true } });
    director.step([event(director, { type: 'shadow', id: 'mica' })]);
    for (let i = 0; i < 20; i++) director.step();
    const state = director.getSnapshot(), before = clone(state);
    let samples = 0;
    const samplesById = new Map();
    for (const actor of state.individuals) {
      const anatomy = getGeckoAnatomy(actor.body);
      const pelvis = { x: actor.body.position.x - .23 * Math.cos(actor.body.heading),
        y: actor.body.position.y - .23 * Math.sin(actor.body.heading) };
      assert(distance(anatomy.tail[0], pelvis) < EPS);
      for (let i = 1; i < anatomy.tail.length; i++) {
        assert(anatomy.tail[i].radius <= anatomy.tail[i - 1].radius);
        assert(distance(anatomy.tail[i], anatomy.tail[i - 1]) < .08);
      }
      const report = sampleGecko(actor.body, p => {
        assert([p.x, p.y, p.z, p.tone].every(Number.isFinite));
        assert(Math.abs(p.x * actor.scale) <= GECKO_DIRECTOR_LIMITS.worldWidth / 2 + EPS);
        assert(Math.abs(p.y * actor.scale) <= GECKO_DIRECTOR_LIMITS.worldHeight / 2 + EPS);
      });
      samples += report.samples;
      samplesById.set(actor.id, report.samples);
    }
    assert(samples <= GECKO_DIRECTOR_LIMITS.samples);
    for (const options of [{}, { cols: 112, rows: 50 }, { cols: 256, rows: 168 },
      { cols: 112, rows: 72, focus: 'mica' }, { neutral: true }]) {
      const grid = renderGeckoDirectorGrid(state, options);
      assert.equal(grid.samples, options.focus ? samplesById.get(options.focus) : samples);
      assert(grid.cols * grid.rows <= 43008);
      assert.equal(grid.glyphs.length, grid.cols * grid.rows);
      assert.equal(grid.tones.length, grid.glyphs.length);
      assert.equal(grid.materials.length, grid.glyphs.length);
      assert.equal(grid.text.split('\n').length, grid.rows);
      assert(grid.text.split('\n').every(line => line.length === grid.cols));
      assert(/^[\x20-\x7e\n]+$/.test(grid.text));
      assert(grid.glyphs.every(code => code >= 32 && code <= 126));
      assert(grid.tones.every(tone => Number.isFinite(tone) && tone >= 0 && tone <= 1));
      assert.equal(grid.theme, 'moonlight');
      assert(grid.occupied > 100 && grid.occupied <= grid.glyphs.length);
      if (options.neutral) assert(/^[ #\n]+$/.test(grid.text));
      if (options.focus) {
        assert.deepEqual({ x: grid.viewport.centerX, y: grid.viewport.centerY }, position(member(state, options.focus)));
        assert.equal(grid.viewport.width, 2.55);
        assert.equal(grid.viewport.height, 2.75);
      }
    }
    assert.deepEqual(state, before);
  }
});

test('focused portraits contain only the selected geometry while the full wall and all three simulations remain intact', () => {
  const director = createGeckoDirector();
  for (let i = 0; i < 240; i++) director.step();
  const state = director.getSnapshot(), before = clone(state), chosen = member(state, 'pip');
  const isolatedState = { ...state, individuals: [chosen] };
  const options = { focus: 'pip', cols: 112, rows: 72, neutral: true };
  const portrait = renderGeckoDirectorGrid(state, options);
  const isolatedPortrait = renderGeckoDirectorGrid(isolatedState, options);
  assert.deepEqual(portrait.glyphs, isolatedPortrait.glyphs, 'no cropped neighbour may enter the portrait');
  assert.equal(portrait.samples, isolatedPortrait.samples);
  assert.equal(portrait.samples, sampleGecko(chosen.body, () => {}).samples);

  const fullWall = renderGeckoDirectorGrid(state, { neutral: true });
  const isolatedWall = renderGeckoDirectorGrid(isolatedState, { neutral: true });
  const allSamples = state.individuals.reduce((sum, actor) => sum + sampleGecko(actor.body, () => {}).samples, 0);
  assert.equal(fullWall.samples, allSamples, 'the full-wall view still samples all three residents');
  assert(fullWall.samples > portrait.samples * 2);
  assert.notDeepEqual(fullWall.glyphs, isolatedWall.glyphs, 'other residents remain visible on the full wall');
  assert.deepEqual(state, before, 'rendering cannot mutate the snapshot, ticks or contacts');
  assert.deepEqual(director.getSnapshot(), before, 'focus is a projection choice, not a simulation mutation');
  const next = director.step().state;
  next.individuals.forEach((actor, i) => assert.equal(actor.body.tick, before.individuals[i].body.tick + 1));
});

test('director preview validates bounds and focus; pointer mapping uses the actual letterboxed viewport', () => {
  const state = createGeckoDirector({ options: { population: 1 } }).getSnapshot();
  for (const options of [null, [], { unknown: 1 }, { cols: 111 }, { cols: 257 }, { cols: 112.5 },
    { cols: NaN }, { rows: 49 }, { rows: 169 }, { neutral: 1 }, { focus: 'pip' }, { focus: 'ghost' }]) {
    assert.throws(() => renderGeckoDirectorGrid(state, options));
  }
  const grid = renderGeckoDirectorGrid(state), rect = { left: 100, top: 40, width: 900, height: 700 };
  assert.deepEqual(geckoPointFromCanvas(grid, 900, 700, 550, 390, rect), { x: 0, y: 0 });
  assert.equal(geckoPointFromCanvas(grid, 900, 700, 550, 42, rect), null, 'letterbox padding is not part of the wall');
  const focused = renderGeckoDirectorGrid(state, { focus: 'mica' });
  const focusCenter = geckoPointFromCanvas(focused, 900, 700, 550, 390, rect);
  assert.deepEqual(focusCenter, position(state.individuals[0]));
  assert.equal(geckoPointFromCanvas(grid, 900, 700, NaN, 0, rect), null);
  assert.equal(geckoPointFromCanvas(grid, 0, 700, 0, 0, rect), null);
});

test('scene arcs retain discriminated beat boundaries and reject invalid score time', () => {
  const first = { 'moonlit-wall': 'emerge', 'lantern-hunt': 'notice', 'passing-shadow': 'peek' };
  for (const scene of GECKO_SCENES) {
    const initial = geckoSceneArc(scene.id, 0), next = geckoSceneArc(scene.id, scene.ticks);
    assert.equal(initial.beat, first[scene.id]);
    assert.equal(initial.cycle, 0);
    assert.equal(next.beat, initial.beat);
    assert.equal(next.progress, 0);
    assert.equal(next.cycle, 1);
    assert.equal(geckoSceneArc(scene.id, scene.ticks - .25).cycle, 0);
  }
  for (const time of [-1, NaN, Infinity, undefined, '1']) assert.throws(() => geckoSceneArc('moonlit-wall', time));
  assert.throws(() => geckoSceneArc('ocean', 0));
});

test('director disposal is terminal and idempotent without changing a peer instance', () => {
  const first = createGeckoDirector(), peer = createGeckoDirector();
  first.dispose(); first.dispose();
  assert.equal(first.disposed, true);
  for (const call of [() => first.step(), () => first.getSnapshot(), () => first.update({ tempo: 1 }),
    () => first.updateAnimal({ creepSpeed: .1 }), () => first.select(null), () => first.reset(), () => first.exportRecipe()]) {
    assert.throws(call, /disposed/i);
  }
  assert.equal(peer.disposed, false);
  assert.equal(peer.step().state.tick, 1);
});
