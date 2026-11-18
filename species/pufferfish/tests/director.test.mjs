import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUFFERFISH_DIRECTOR_DEFAULTS, PUFFERFISH_DIRECTOR_LIMITS,
  resolvePufferfishDirectorOptions, createPufferfishDirector, configurePufferfishDirector,
  resetPufferfishDirector, stepPufferfishDirector, pufferfishDirectorPoster, describePufferfishDirector,
} from '../build/director.js';

const event = (tick, seq, type, values = {}) => ({ tick, seq, type, ...values });
const step = (state, events = []) => stepPufferfishDirector(state, { tick: state.tick + 1, events }).state;
function until(state, tick, events = []) {
  while (state.tick < tick) state = step(state, events.filter(item => item.tick === state.tick + 1));
  return state;
}
const ids = state => state.actors.map(actor => actor.id);
const reactions = state => state.actors.map(actor => actor.state.reactions);
const defaultRoles = ['explorer', 'sentinel', 'drifter'];

test('director defaults are opt-in immutable configuration and bounded dense actor identities', () => {
  const state = createPufferfishDirector();
  assert.equal(state.version, 'pufferfish-director-v1');
  assert.equal(state.tick, 0); assert.equal(state.lastSequence, -1);
  assert.equal(state.config.scene, 'reef'); assert.equal(state.config.count, 2);
  assert.deepEqual(state.config.roles, defaultRoles.slice(0, 2));
  assert.deepEqual(resolvePufferfishDirectorOptions(), PUFFERFISH_DIRECTOR_DEFAULTS);
  assert.ok(Object.isFrozen(PUFFERFISH_DIRECTOR_LIMITS));
  assert.deepEqual(ids(state), [0, 1]);
  assert.equal(state.pointer, null); assert.equal(state.invitation, null);
  for (const count of [1, 2, 3]) {
    const scene = createPufferfishDirector({ count }, { seed: 23 });
    assert.deepEqual(ids(scene), Array.from({ length: count }, (_, id) => id));
    assert.equal(new Set(scene.actors.map(actor => actor.state.config.seed)).size, count);
    assert.deepEqual(scene.config.roles, defaultRoles.slice(0, count));
    assert.deepEqual(scene.actors.map(actor => actor.role), defaultRoles.slice(0, count));
    for (const value of [scene, scene.config, scene.config.roles, scene.actors, scene.beat,
      ...scene.actors.flatMap(actor => [actor, actor.gaze, actor.state])]) assert.ok(Object.isFrozen(value));
  }
});

test('director configuration validates boundaries, exact role count and unknown fields before creating state', () => {
  for (const options of [
    null, [], 'reef', { scene: 'ocean' }, { count: 0 }, { count: 4 }, { count: 1.5 }, { count: '2' },
    { count: NaN }, { count: Infinity }, { tempo: 0.49 }, { tempo: 1.51 }, { tempo: NaN },
    { current: -1.01 }, { current: 1.01 }, { current: Infinity }, { curiosity: -0.01 }, { curiosity: 1.01 },
    { spacing: 0.79 }, { spacing: 1.21 }, { size: 0.79 }, { size: 1.11 }, { labels: 1 },
    { count: 2, roles: ['explorer'] }, { count: 1, roles: ['explorer', 'drifter'] },
    { roles: ['explorer', 'unknown'] }, { roles: null }, { roles: 'explorer' }, { scene: undefined }, { typo: true },
  ]) assert.throws(() => createPufferfishDirector(options), undefined, JSON.stringify(options));
  const smallest = createPufferfishDirector({ count: 1, tempo: 0.5, current: -1, curiosity: 0, spacing: 0.8, size: 0.8, labels: false });
  const largest = createPufferfishDirector({ count: 3, tempo: 1.5, current: 1, curiosity: 1, spacing: 1.2, size: 1.1, labels: true });
  assert.equal(smallest.actors.length, 1); assert.equal(largest.actors.length, 3);
  assert.throws(() => createPufferfishDirector({}, { seed: NaN }));
  const source = ['sentinel', 'explorer'];
  const copied = createPufferfishDirector({ roles: source });
  source[0] = 'drifter'; assert.deepEqual(copied.config.roles, ['sentinel', 'explorer']);
});

test('each scene has deterministic state independent of 1/2/5-tick presentation grouping', () => {
  for (const scene of ['reef', 'current', 'shadow']) {
    function replay(group) {
      let state = createPufferfishDirector({ scene, count: 3 }, { seed: 23 });
      const checkpoints = [];
      while (state.tick < 1200) {
        for (let i = 0; i < group && state.tick < 1200; i++) {
          const tick = state.tick + 1, seq = state.lastSequence + 1;
          const events = tick === 121 ? [event(tick, seq, 'select', { id: 1 })]
            : tick === 122 ? [event(tick, seq, 'invite', { x: 0.35, y: -0.2 })]
            : tick === 361 ? [event(tick, seq, 'approach')]
            : tick === 461 || tick === 841 ? [event(tick, seq, 'retreat')]
            : tick === 721 ? [event(tick, seq, 'pointer', { x: state.actors[1].x, y: state.actors[1].y, aspect: 16 / 9 })] : [];
          state = step(state, events);
          if ([1, 120, 122, 240, 420, 461, 660, 721, 841, 900, 1199, 1200].includes(state.tick)) checkpoints.push(state);
        }
        describePufferfishDirector(state);
      }
      return checkpoints;
    }
    assert.deepEqual(replay(2), replay(1), `${scene}, 2-tick presentation`);
    assert.deepEqual(replay(5), replay(1), `${scene}, 5-tick presentation`);
  }
});

test('director choreography uses only explicit ticks and seeds, with no ambient random or time dependency', () => {
  const options = { scene: 'current', count: 3 };
  const expected = until(createPufferfishDirector(options, { seed: 23 }), 180);
  const other = until(createPufferfishDirector(options, { seed: 24 }), 180);
  assert.notDeepEqual(other.actors.map(actor => [actor.x, actor.y, actor.gaze]),
    expected.actors.map(actor => [actor.x, actor.y, actor.gaze]), 'seed changes individual exploratory variation');
  const random = Math.random, now = Date.now;
  Math.random = () => { throw new Error('ambient randomness is forbidden in deterministic replay'); };
  Date.now = () => { throw new Error('wall clock is forbidden in deterministic replay'); };
  try { assert.deepEqual(until(createPufferfishDirector(options, { seed: 23 }), 180), expected); }
  finally { Math.random = random; Date.now = now; }
});

test('tempo scales the scene clock while deliberate inflation retains the existing 60 Hz durations', () => {
  const slow = createPufferfishDirector({ scene: 'reef', count: 1, tempo: 0.5 });
  const fast = createPufferfishDirector({ scene: 'reef', count: 1, tempo: 1.5 });
  const log = [event(1, 0, 'approach')];
  const a = until(slow, 108, log), b = until(fast, 108, log);
  assert.equal(a.sceneTick, 54); assert.equal(b.sceneTick, 162);
  for (const state of [a, b]) {
    assert.equal(state.actors[0].state.tick, 108);
    assert.equal(state.actors[0].state.phase.kind, 'holding');
    assert.equal(state.actors[0].state.inflation, 1);
    assert.equal(state.actors[0].state.reactions, 1);
  }
  assert.equal(until(createPufferfishDirector({ tempo: 1 }), 1200).cycle, 1);
  assert.equal(until(createPufferfishDirector({ tempo: 1 }), 1200).sceneTick, 0);
});

test('roles produce distinct continuous bounded routes across scene and loop joins', () => {
  for (const scene of ['reef', 'current', 'shadow']) {
    let state = createPufferfishDirector({ scene, count: 3, tempo: 1.5, spacing: 1.2, size: 1.1, current: -1 });
    const beats = new Set(), actorPositions = state.actors.map(() => new Set());
    for (let tick = 1; tick <= 1650; tick++) {
      const before = state; state = step(state); beats.add(state.beat.kind);
      assert.ok(state.beat.progress >= 0 && state.beat.progress <= 1);
      assert.ok(state.flow >= -1 && state.flow <= 1);
      assert.equal(state.actors.length, 3);
      for (let id = 0; id < 3; id++) {
        const actor = state.actors[id], previous = before.actors[id];
        assert.equal(actor.id, id); assert.equal(actor.state.tick, tick);
        for (const number of [actor.x, actor.y, actor.vx, actor.vy, actor.scale, actor.yaw,
          actor.gaze.x, actor.gaze.y, actor.finEffort, actor.threat]) assert.ok(Number.isFinite(number));
        assert.ok(Math.abs(actor.x) <= 1 && Math.abs(actor.y) <= 1, `${scene}: centers stay in normalized view`);
        assert.ok(actor.scale > 0);
        assert.ok(Math.abs(actor.vx) <= PUFFERFISH_DIRECTOR_LIMITS.maxVelocityX);
        assert.ok(Math.abs(actor.vy) <= PUFFERFISH_DIRECTOR_LIMITS.maxVelocityY);
        assert.ok(Math.abs(actor.x - previous.x) <= PUFFERFISH_DIRECTOR_LIMITS.maxVelocityX + 1e-12,
          `${scene}: horizontal continuity at tick ${tick}, actor ${id}`);
        assert.ok(Math.abs(actor.y - previous.y) <= PUFFERFISH_DIRECTOR_LIMITS.maxVelocityY + 1e-12,
          `${scene}: vertical continuity at tick ${tick}, actor ${id}`);
        if (tick % 120 === 0) actorPositions[id].add(`${actor.x.toFixed(4)},${actor.y.toFixed(4)}`);
      }
    }
    assert.equal(beats.size, 4, `${scene} exercises all authored beats`);
    assert.ok(actorPositions.every(positions => positions.size > 4), `${scene} has purposeful travel`);
    assert.notDeepEqual([...actorPositions[0]], [...actorPositions[1]], `${scene} role paths differ`);
  }
});

test('select and invite target a specific actor and preserve one bounded invitation', () => {
  let state = createPufferfishDirector({ count: 3, curiosity: 1 });
  const original = state;
  state = step(state, [event(1, 0, 'select', { id: 2 }), event(1, 1, 'invite', { x: 0.6, y: -0.3 })]);
  assert.equal(state.selected, 2); assert.equal(state.invitation.id, 2);
  assert.equal(state.invitation.x, 0.6); assert.equal(state.invitation.y, -0.3);
  assert.ok(state.invitation.until > state.tick); assert.ok(Object.isFrozen(state.invitation));
  assert.equal(original.selected, 0); assert.equal(original.invitation, null);
  const distance = Math.hypot(state.actors[2].x - 0.6, state.actors[2].y + 0.3);
  state = until(state, 90);
  assert.ok(Math.hypot(state.actors[2].x - 0.6, state.actors[2].y + 0.3) < distance, 'invited actor approaches the selected target');
  for (let i = 0; i < 300; i++) {
    state = step(state, [event(state.tick + 1, state.lastSequence + 1, 'invite', { x: 0.4, y: -0.2 })]);
    assert.equal(state.actors.length, 3); assert.equal(state.invitation.id, 2);
  }
});

test('deliberate approach addresses the selected actor without triggering every neighbor', () => {
  let state = createPufferfishDirector({ scene: 'reef', count: 3 });
  state = step(state, [event(1, 0, 'select', { id: 1 }), event(1, 1, 'approach')]);
  state = until(state, 108);
  assert.deepEqual(reactions(state), [0, 1, 0]);
  assert.equal(state.actors[1].state.phase.kind, 'holding');
  assert.equal(state.actors[1].state.inflation, 1);
});

test('invitations expire at their explicit tick and one deliberate approach completes without rearming itself', () => {
  let invited = step(createPufferfishDirector({ count: 3 }), [event(1, 0, 'invite', { x: 0.3, y: -0.2 })]);
  assert.equal(invited.invitation.until, 361);
  invited = until(invited, 360); assert.notEqual(invited.invitation, null);
  invited = step(invited); assert.equal(invited.invitation, null);
  assert.equal(invited.actors.length, 3);
  const approached = until(createPufferfishDirector({ scene: 'reef', count: 3 }), 1000,
    [event(1, 0, 'select', { id: 1 }), event(1, 1, 'approach')]);
  assert.equal(approached.approach, null); assert.deepEqual(reactions(approached), [0, 1, 0]);
  assert.ok(approached.actors.every(actor => actor.state.phase.kind === 'idle' && actor.state.inflation === 0));
});

test('nearby pointer proximity follows the actual noncenter actor location rather than screen origin', () => {
  let state = createPufferfishDirector({ scene: 'reef', count: 3 });
  assert.ok(Math.hypot(state.actors[2].x, state.actors[2].y) > 0.1, 'fixture uses a noncenter actor');
  state = step(state, [event(1, 0, 'select', { id: 2 })]);
  for (let i = 0; i < 40; i++) {
    const target = state.actors[2];
    state = step(state, [event(state.tick + 1, state.lastSequence + 1, 'pointer', { x: target.x, y: target.y, aspect: 16 / 9 })]);
  }
  assert.equal(state.actors[2].state.reactions, 1);
  assert.equal(state.actors[0].state.reactions, 0);
});

test('retreat overrides invitations, pointer and approach in the same ordered batch', () => {
  for (const retreatFirst of [true, false]) {
    const inputs = [
      { type: 'select', id: 1 }, { type: 'invite', x: 0.3, y: -0.2 },
      { type: 'pointer', x: 0, y: 0, aspect: 1 }, { type: 'approach' },
    ];
    if (retreatFirst) inputs.unshift({ type: 'retreat' }); else inputs.push({ type: 'retreat' });
    const state = step(createPufferfishDirector({ count: 3 }), inputs.map((input, seq) => ({ ...input, tick: 1, seq })));
    assert.equal(state.pointer, null); assert.equal(state.invitation, null);
    assert.ok(state.quietUntil >= state.tick + 240);
    assert.deepEqual(reactions(state), [0, 0, 0]);
    assert.ok(state.actors.every(actor => actor.threat === 0));
  }
});

test('a later deliberate approach or sustained proximity remains available during the automatic-shadow quiet window', () => {
  const afterRetreat = step(createPufferfishDirector({ scene: 'shadow', count: 1 }), [event(1, 0, 'retreat')]);
  assert.equal(afterRetreat.quietUntil, 241);
  const manual = until(afterRetreat, 40, [event(2, 1, 'approach')]);
  assert.equal(manual.actors[0].state.reactions, 1);
  assert.equal(manual.actors[0].state.phase.kind, 'inflating');
  let proximity = afterRetreat;
  while (proximity.tick < 40) {
    const actor = proximity.actors[0];
    proximity = step(proximity, [event(proximity.tick + 1, proximity.lastSequence + 1,
      'pointer', { x: actor.x, y: actor.y, aspect: 16 / 9 })]);
  }
  assert.equal(proximity.actors[0].state.reactions, 1);
  assert.equal(proximity.actors[0].state.phase.kind, 'inflating');
  assert.equal(manual.quietUntil, 241); assert.equal(proximity.quietUntil, 241);
  assert.equal(until(manual, 500).actors[0].state.reactions, 1,
    'the quiet window still suppresses the automatic shadow at tick 240');
});

test('curiosity changes idle exploration and the personal space of explicit touch/keyboard invitations', () => {
  const cautious = createPufferfishDirector({ scene: 'reef', count: 2, curiosity: 0 }, { seed: 23 });
  const curious = createPufferfishDirector({ scene: 'reef', count: 2, curiosity: 1 }, { seed: 23 });
  const idleLow = until(cautious, 120), idleHigh = until(curious, 120);
  assert.notDeepEqual(idleLow.actors.map(actor => [actor.x, actor.y]), idleHigh.actors.map(actor => [actor.x, actor.y]));
  const log = [event(1, 0, 'invite', { x: 0.35, y: -0.2 })];
  // Allow the capped-velocity journey to settle before assessing personal space;
  // at tick 120 both visitors are still near their maximum travel speed.
  const low = until(cautious, 300, log), high = until(curious, 300, log);
  const distance = actor => Math.hypot(actor.x - 0.35, actor.y + 0.2);
  assert.ok(distance(high.actors[0]) + 0.01 < distance(low.actors[0]), 'more curious visitor approaches an explicit invitation more closely');
  for (const scene of [low, high]) {
    assert.equal(scene.actors[0].motive, 'invited');
    assert.equal(scene.actors[0].state.reactions, 0, 'a calm invitation does not force inflation');
  }
});

test('retreat wins on the automatic shadow-cue tick and suppresses further cues for 240 ticks', () => {
  let probe = createPufferfishDirector({ scene: 'shadow', count: 3 }), beforeCue = null;
  for (let tick = 1; tick <= 1200; tick++) {
    const previous = probe; probe = step(probe);
    if (probe.actors.some(actor => actor.threat > 0 || actor.state.reactions > previous.actors[actor.id].state.reactions)) {
      beforeCue = previous; break;
    }
  }
  assert.ok(beforeCue, 'the shadow scene must have an observable local defensive cue');
  let state = step(beforeCue, [event(beforeCue.tick + 1, beforeCue.lastSequence + 1, 'retreat')]);
  const initialReactions = reactions(beforeCue), quietStart = state.tick;
  assert.equal(state.pointer, null); assert.equal(state.invitation, null);
  assert.deepEqual(reactions(state), initialReactions);
  assert.ok(state.quietUntil >= quietStart + 240);
  for (let i = 0; i < 239; i++) {
    state = step(state);
    assert.deepEqual(reactions(state), initialReactions, `no automatic rearm during quiet interval at tick ${state.tick}`);
    assert.ok(state.actors.every(actor => actor.threat === 0));
  }
});

test('a full shadow cycle triggers at most one local reaction without accumulating effect state', () => {
  let state = createPufferfishDirector({ scene: 'shadow', count: 3 });
  for (let cycle = 0; cycle < 3; cycle++) {
    const before = reactions(state).reduce((sum, value) => sum + value, 0);
    state = until(state, (cycle + 1) * 1200);
    const after = reactions(state).reduce((sum, value) => sum + value, 0);
    assert.ok(after - before <= 1, `cycle ${cycle} produces no repeat startle queue`);
    assert.equal(state.actors.length, 3);
  }
  assert.ok(reactions(state).some(value => value > 0), 'bounded behavior must still have a visible reaction');
});

test('director event validation is atomic for sequence, target, coordinate, batch and late invalid-event errors', () => {
  const current = step(createPufferfishDirector({ count: 3 }), [event(1, 4, 'select', { id: 1 })]);
  const saved = JSON.stringify(current);
  const bad = [
    null, [], { tick: 1 }, { tick: 3 }, { tick: NaN }, { tick: '2' }, { tick: 2, extra: true },
    { tick: 2, events: null }, { tick: 2, events: {} },
    { tick: 2, events: Array.from({ length: 17 }, (_, i) => event(2, i + 5, 'approach')) },
    { tick: 2, events: [event(1, 5, 'retreat')] },
    { tick: 2, events: [event(2, 4, 'retreat')] },
    { tick: 2, events: [event(2, 5.5, 'retreat')] },
    { tick: 2, events: [event(2, Infinity, 'retreat')] },
    { tick: 2, events: [event(2, 5, 'select', { id: -1 })] },
    { tick: 2, events: [event(2, 5, 'select', { id: 3 })] },
    { tick: 2, events: [event(2, 5, 'select', { id: 1.5 })] },
    { tick: 2, events: [event(2, 5, 'invite', { x: NaN, y: 0 })] },
    { tick: 2, events: [event(2, 5, 'invite', { x: 1.01, y: 0 })] },
    { tick: 2, events: [event(2, 5, 'pointer', { x: 0, y: -1.01, aspect: 1 })] },
    { tick: 2, events: [event(2, 5, 'pointer', { x: 0, y: 0, aspect: 0 })] },
    { tick: 2, events: [event(2, 5, 'pointer', { x: 0, y: 0, aspect: 11 })] },
    { tick: 2, events: [event(2, 5, 'pointer', { x: 0, y: 0 })] },
    { tick: 2, events: [event(2, 5, 'unknown')] },
    { tick: 2, events: [event(2, 5, 'retreat', { id: 1 })] },
    { tick: 2, events: [null] },
    { tick: 2, events: [event(2, 5, 'select', { id: 2 }), event(2, 5, 'retreat')] },
    { tick: 2, events: [event(2, 7, 'select', { id: 2 }), event(2, 6, 'retreat')] },
    { tick: 2, events: [event(2, 5, 'select', { id: 2 }), event(2, 6, 'invite', { x: Infinity, y: 0 })] },
  ];
  for (const input of bad) {
    assert.throws(() => stepPufferfishDirector(current, input), undefined, JSON.stringify(input));
    assert.equal(JSON.stringify(current), saved);
  }
  const accepted = step(current, Array.from({ length: 16 }, (_, i) => event(2, i + 5, 'select', { id: i % 3 })));
  assert.equal(accepted.lastSequence, 20);
});

test('configure/reset have explicit deterministic identity reset and immutable state semantics', () => {
  let state = createPufferfishDirector({ scene: 'current', count: 3, roles: ['drifter', 'explorer', 'sentinel'] }, { seed: 91, wobble: 0.4 });
  state = until(step(state, [event(1, 0, 'select', { id: 2 }), event(1, 1, 'invite', { x: 0.4, y: 0.2 })]), 100);
  const before = JSON.stringify(state);
  assert.throws(() => configurePufferfishDirector(state, { count: 1, tempo: NaN }));
  assert.throws(() => configurePufferfishDirector(state, null));
  assert.equal(JSON.stringify(state), before);
  const changed = configurePufferfishDirector(state, { count: 2 });
  assert.equal(changed.tick, 0); assert.equal(changed.selected, 0);
  assert.equal(changed.pointer, null); assert.equal(changed.invitation, null);
  assert.deepEqual(ids(changed), [0, 1]); assert.deepEqual(changed.config.roles, ['explorer', 'sentinel']);
  assert.equal(changed.config.scene, 'current'); assert.equal(changed.speciesConfig.seed, 91);
  assert.deepEqual(resetPufferfishDirector(state), createPufferfishDirector(state.config, state.speciesConfig));
  assert.equal(resetPufferfishDirector(state, 92).speciesConfig.seed, 92);
  assert.notDeepEqual(resetPufferfishDirector(state, 92).actors.map(actor => actor.state.config.seed),
    resetPufferfishDirector(state).actors.map(actor => actor.state.config.seed));
  assert.throws(() => { state.actors.push(state.actors[0]); }, TypeError);
  assert.throws(() => { state.actors[0].x = 99; }, TypeError);
  assert.throws(() => { state.actors[0].gaze.x = 99; }, TypeError);
  assert.throws(() => { state.config.roles[0] = 'drifter'; }, TypeError);
  assert.equal(JSON.stringify(state), before);
});

test('static director posters do not advance clocks or mutate original scene and remain bounded', () => {
  const state = until(createPufferfishDirector({ scene: 'shadow', count: 3 }), 200);
  const saved = JSON.stringify(state);
  const inflated = pufferfishDirectorPoster(state, true), calm = pufferfishDirectorPoster(state, false);
  for (const poster of [inflated, calm]) {
    assert.equal(poster.tick, state.tick); assert.equal(poster.sceneTick, state.sceneTick);
    assert.equal(poster.actors.length, 3); assert.equal(poster.selected, state.selected);
    assert.ok(Object.isFrozen(poster)); assert.equal(typeof describePufferfishDirector(poster), 'string');
  }
  assert.equal(inflated.actors[state.selected].state.inflation, 1);
  assert.ok(calm.actors.every(actor => actor.state.inflation === 0));
  assert.equal(JSON.stringify(state), saved);
});
