/** Pure director verification. No browser, raster or device-performance claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FROG_DIRECTOR_DEFAULTS, FROG_POND_LIMITS, configureFrogDirector,
  createFrogPond, stepFrogPond, resetFrogPond, selectPondFrog, setPondRole,
  previewPondTarget, posePondFrog,
} from '../generated/pond.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const ready = actor => ['idle', 'interest'].includes(actor.model.behavior.kind);
function step(state, actions = []) {
  return stepFrogPond(state, state.tick + 1, actions.map((action, i) => ({ ...action, tick: state.tick + 1, seq: state.lastSeq + i + 1 })));
}
function advance(state, ticks) { for (let n = 0; n < ticks; n++) state = step(state).state; return state; }
function freeHop(state, preferredId) {
  const used = new Set(state.actors.flatMap(actor => [actor.padId, actor.reservedPad].filter(id => id !== null)));
  for (const actor of state.actors.filter(a => preferredId === undefined || a.id === preferredId)) {
    if (!ready(actor)) continue;
    const pad = state.pads.find(p => !used.has(p.id) && Math.hypot(p.point.x - actor.model.position.x, p.point.y - actor.model.position.y) <= state.bodyConfig.maxDistance + 1e-10);
    if (pad) return { actor, pad };
  }
  throw new Error('Fixture expected at least one reachable unoccupied pad');
}
function assertBounds(state) {
  assert(state.actors.length >= 1 && state.actors.length <= 3);
  assert.equal(new Set(state.actors.map(a => a.id)).size, state.actors.length);
  assert.equal(new Set(state.actors.map(a => a.padId)).size, state.actors.length, 'occupied source pads remain exclusive');
  const reservations = state.actors.map(a => a.reservedPad).filter(p => p !== null);
  assert.equal(new Set(reservations).size, reservations.length, 'destination reservations are exclusive');
  const used = new Set(state.actors.map(a => a.padId));
  for (const id of reservations) assert(!used.has(id), 'reserved destination is not an occupied source');
  assert(state.actors.filter(a => ['crouch', 'flight'].includes(a.model.behavior.kind)).length <= 1);
  assert(state.pads.length <= 6 && state.ripples.length <= 6 && state.replies.length <= 2);
  assert(state.actors.some(a => a.id === state.selectedId));
  for (const actor of state.actors) {
    assert.equal(actor.model.tick, state.tick, 'all models advance once per director tick');
    assert(state.pads.some(p => p.id === actor.padId));
    assert(Number.isFinite(actor.model.position.x) && Number.isFinite(actor.model.position.y));
    assert(Math.abs(actor.model.position.x) <= .9 + 1e-10 && Math.abs(actor.model.position.y) <= .75 + 1e-10);
    if ('plan' in actor.model.behavior) {
      const { from, to } = actor.model.behavior.plan;
      assert(Math.hypot(to.x - from.x, to.y - from.y) <= actor.model.config.maxDistance + 1e-10);
      const reserved = state.pads.find(p => p.id === actor.reservedPad);
      assert(reserved, 'crouch/flight retains destination reservation');
      // The existing ballistic target arithmetic may round by a few ulps.
      // Ownership is still exact by pad id; spatial error must stay negligible.
      assert(Math.hypot(to.x - reserved.point.x, to.y - reserved.point.y) <= 1e-10, 'body endpoint is the reserved pad within floating-point tolerance');
    }
  }
  for (const r of state.ripples) { assert(r.age >= 0 && r.age < r.ttl); assert(r.ttl > 0); }
  for (const r of state.replies) { assert.equal(r.generation, 1); assert(r.dueTick > state.tick); assert.notEqual(r.frogId, r.sourceId); }
  if (state.firefly) { assert(state.firefly.age >= 0 && state.firefly.age < state.firefly.ttl); assert(state.actors.some(a => a.id === state.firefly.ownerId)); }
}

test('pond defaults and roles are fully validated, immutable and independently owned', () => {
  const roles = ['caller', 'hunter', 'dreamer'];
  const state = createFrogPond({ seed: 23, director: { roles } });
  roles[0] = 'dreamer';
  assert.deepEqual(state.config, FROG_DIRECTOR_DEFAULTS); assert.equal(state.config.roles[0], 'caller');
  assert.equal(state.species, 'frog-pond'); assert.equal(state.version, 1); assert.equal(state.tick, 0); assert.equal(state.actors.length, 3);
  assert.deepEqual(state.actors.map(a => a.id), [0, 1, 2]); assert.deepEqual(state.actors.map(a => a.name), ['Moss', 'Pip', 'Fern']);
  for (const object of [state, state.config, state.config.roles, state.actors, state.pads, ...state.actors, ...state.pads]) assert(Object.isFrozen(object));
  assertBounds(state);
  for (const scene of ['stillwater', 'firefly-supper', 'moonlit-chorus']) for (const layout of ['arc', 'stepping-stones', 'shelter']) for (const count of [1, 2, 3]) {
    const p = createFrogPond({ director: { scene, layout, count, autonomy: false } });
    assert.equal(p.actors.length, count); assertBounds(p);
    for (const pad of p.pads) assert(Math.abs(pad.point.x) <= .9 && Math.abs(pad.point.y) <= .75);
  }
});

test('invalid director config and options reject without coercion or partial changes', () => {
  const base = configureFrogDirector(), before = copy(base);
  for (const patch of [null, [], { count: 0 }, { count: 4 }, { count: 1.5 }, { count: '2' },
    { scene: 'ocean' }, { layout: 'line' }, { tempo: NaN }, { tempo: Infinity }, { tempo: .49 }, { tempo: 1.51 },
    { autonomy: 1 }, { autonomy: 'false' }, { roles: ['caller'] }, { roles: ['caller', 'hunter', 'bird'] },
    { roles: new Array(3) }, { roles: ['caller', undefined, 'dreamer'] }, { roles: undefined }, { scene: undefined }, { surprise: true }]) {
    assert.throws(() => configureFrogDirector(patch, base), JSON.stringify(patch));
    assert.deepEqual(base, before);
  }
  assert.equal(configureFrogDirector({ tempo: .5 }).tempo, .5); assert.equal(configureFrogDirector({ tempo: 1.5 }).tempo, 1.5);
  for (const options of [null, [], { count: 2 }, { seed: -1 }, { seed: 2.5 }, { seed: null }, { director: null }, { config: { maxDistance: Infinity } }]) assert.throws(() => createFrogPond(options));
});

test('pure director events validate the complete batch, exact next tick and global sequence', () => {
  const state = createFrogPond({ director: { autonomy: false } }), before = copy(state);
  const good = { type: 'target', x: .2, y: .1, tick: 1, seq: 0 };
  for (const bad of [
    { type: 'select', frogId: 99, tick: 1, seq: 1 }, { type: 'call', frogId: 1.5, tick: 1, seq: 1 },
    { type: 'hop', frogId: 0, padId: 99, tick: 1, seq: 1 }, { type: 'hunt', frogId: 0, x: NaN, y: 0, tick: 1, seq: 1 },
    { type: 'ripple', x: 2, y: 0, tick: 1, seq: 1 }, { type: 'leave', tick: 0, seq: 1 },
    { type: 'leave', tick: 1, seq: 0 }, { type: 'leave', tick: 1, seq: -1 },
    { type: 'surprise', tick: 1, seq: 1 }, { type: 'call', frogId: 0, extra: true, tick: 1, seq: 1 },
  ]) { assert.throws(() => stepFrogPond(state, 1, [good, bad])); assert.deepEqual(state, before); }
  for (const tick of [0, 2, 1.5, NaN, Infinity, '1']) assert.throws(() => stepFrogPond(state, tick, []));
  assert.throws(() => stepFrogPond(state, 1, Array.from({ length: 9 }, (_, seq) => ({ type: 'leave', tick: 1, seq }))));
  const first = stepFrogPond(state, 1, [good]).state;
  assert.throws(() => stepFrogPond(first, 2, [{ type: 'leave', tick: 2, seq: 0 }]));
  assert.deepEqual(state, before);
});

test('identical seed and routed event log replay across 1/2/5-tick presentation groups', () => {
  const events = [
    { tick: 1, seq: 0, type: 'call', frogId: 0 },
    { tick: 200, seq: 1, type: 'hunt', frogId: 1, x: .4, y: -.2 },
    { tick: 270, seq: 2, type: 'ripple', x: -.5, y: .3 },
    { tick: 340, seq: 3, type: 'select', frogId: 2 },
    { tick: 341, seq: 4, type: 'target', x: .7, y: .1 },
    { tick: 410, seq: 5, type: 'leave' },
  ];
  const run = group => {
    let state = createFrogPond({ seed: 23, director: { autonomy: false } }); const snapshots = [];
    for (let tick = 1; tick <= 600; tick++) {
      state = stepFrogPond(state, tick, events.filter(e => e.tick === tick)).state;
      if (tick % group === 0) { const before = copy(state); for (const actor of state.actors) posePondFrog(state, actor); assert.deepEqual(state, before); }
      if (tick % 30 === 0) snapshots.push(copy(state));
    }
    return { state, snapshots };
  };
  const every = run(1); assert.deepEqual(run(2), every); assert.deepEqual(run(5), every);
  const other = createFrogPond({ seed: 24, director: { autonomy: false } });
  assert.notDeepEqual(other.actors.map(a => a.model.phaseOffset), createFrogPond({ seed: 23 }).actors.map(a => a.model.phaseOffset));
});

test('all scene/count/layout combinations keep pad ownership, single-flight and bounded effects/replies', () => {
  for (const scene of ['stillwater', 'firefly-supper', 'moonlit-chorus']) for (const count of [1, 2, 3]) for (const layout of ['arc', 'stepping-stones', 'shelter']) {
    let state = createFrogPond({ seed: 23 + count, director: { scene, count, layout, tempo: 1.5 } });
    for (let tick = 1; tick <= 1200; tick++) { state = step(state).state; assertBounds(state); }
    assert(state.cueCount > 0, `${scene} must produce its declared autonomous cues`);
  }
});

test('deliberate hop reserves one free pad, preserves the latched endpoint and settles exactly on it', () => {
  let state = createFrogPond({ director: { autonomy: false } });
  const { actor, pad } = freeHop(state), neighbor = state.actors.find(a => a.id !== actor.id);
  state = step(state, [{ type: 'hop', frogId: actor.id, padId: pad.id }]).state;
  assert.equal(state.actors[actor.id].reservedPad, pad.id);
  const plan = copy(state.actors[actor.id].model.behavior.plan), neighborPosition = copy(neighbor.model.position);
  for (let i = 0; i < 120; i++) {
    const actions = i === 2 ? [{ type: 'target', x: -.9, y: .75 }, { type: 'hop', frogId: actor.id, padId: actor.padId }] : [];
    state = step(state, actions).state; assertBounds(state);
    const current = state.actors[actor.id]; if ('plan' in current.model.behavior) assert.deepEqual(current.model.behavior.plan, plan);
  }
  const landed = state.actors[actor.id]; assert.equal(landed.padId, pad.id); assert.equal(landed.reservedPad, null);
  assert.deepEqual(landed.model.position, pad.point); assert.deepEqual(state.actors[neighbor.id].model.position, neighborPosition);
  assert.equal(landed.model.jumps, 1, 'busy repeats never queue a second hop');
});

test('two simultaneous manual hops cannot reserve the same destination or start two flights', () => {
  let state = createFrogPond({ director: { autonomy: false } });
  const { actor, pad } = freeHop(state), other = state.actors.find(a => a.id !== actor.id);
  const result = step(state, [{ type: 'hop', frogId: actor.id, padId: pad.id }, { type: 'hop', frogId: other.id, padId: pad.id }]);
  state = result.state; assertBounds(state);
  assert.equal(state.actors.filter(a => a.reservedPad === pad.id).length, 1); assert(result.ignoredActions >= 1);
  assert.equal(state.actors.filter(a => a.model.behavior.kind === 'crouch').length, 1);
});

test('a deliberate hop wins the same tick as an autonomous cue in every scene', () => {
  for (const scene of ['stillwater', 'firefly-supper', 'moonlit-chorus']) {
    let state = createFrogPond({ seed: 23, director: { scene } }); state = advance(state, state.nextCueTick - 1);
    const autonomous = step(state).state; assert.equal(autonomous.cueCount, state.cueCount + 1, 'fixture lands on an eligible autonomous cue');
    const { actor, pad } = freeHop(state);
    const manual = step(state, [{ type: 'hop', frogId: actor.id, padId: pad.id }]).state;
    assert.equal(manual.cueCount, state.cueCount); assert.equal(manual.actors[actor.id].motive.kind, 'hop');
    assert.equal(manual.actors[actor.id].motive.purpose, 'manual'); assert.equal(manual.actors[actor.id].reservedPad, pad.id);
    assert(manual.actors.filter(a => a.id !== actor.id).every(a => a.motive.kind === 'rest'));
    assert(manual.nextCueTick > manual.tick, 'a suppressed cue is not a backlog for the next tick'); assertBounds(manual);
  }
});

test('hunting places one insect at a reachable perch and reports a catch only within strike reach', () => {
  for (const layout of ['arc', 'stepping-stones', 'shelter']) {
    let state = createFrogPond({ director: { layout, autonomy: false } });
    state = step(state, [{ type: 'hunt', frogId: 1, x: 1, y: 1 }]).state;
    const hunter = state.actors[1], focus = state.firefly.point;
    assert.equal(hunter.motive.kind, 'track'); assert.deepEqual(hunter.motive.point, focus);
    assert(Math.hypot(focus.x - hunter.model.position.x, focus.y - hunter.model.position.y) <= .95 + 1e-10);
    assert(state.pads.some(pad => Math.hypot(pad.point.x - focus.x, pad.point.y - focus.y) <= 1e-10));
    let caught = false;
    for (let i = 0; i < 240; i++) {
      state = step(state).state; assertBounds(state);
      if (state.firefly?.phase === 'caught') {
        const actor = state.actors[state.firefly.ownerId]; caught = true;
        assert(Math.hypot(actor.model.position.x - state.firefly.point.x, actor.model.position.y - state.firefly.point.y) <= .15 + 1e-10);
      }
    }
    assert(caught, `uninterrupted ${layout} hunt completes at its visible insect`); assert.equal(state.firefly, null);
  }
  let blocked = createFrogPond({ director: { autonomy: false } });
  blocked = step(blocked, [{ type: 'hunt', frogId: 1, x: 1, y: 1 }]).state;
  blocked = advance(blocked, FROG_POND_LIMITS.trackTicks - 1);
  const { actor, pad } = freeHop(blocked, 0);
  const result = step(blocked, [{ type: 'hop', frogId: actor.id, padId: pad.id }]); blocked = result.state;
  assert.equal(blocked.actors[0].motive.kind, 'hop'); assert.equal(blocked.actors[1].motive.kind, 'strike');
  assert.notEqual(blocked.firefly?.phase, 'caught', 'the manual flight slot cannot cause a distant stationary catch');
  assert(result.notices.some(message => /slips away/i.test(message))); assertBounds(blocked);
});

test('caller replies are delayed, bounded and one generation; repeated water effects expire', () => {
  let state = createFrogPond({ director: { autonomy: false } });
  state = step(state, [{ type: 'call', frogId: 0 }]).state;
  assert.equal(state.actors[0].motive.kind, 'call'); assert(state.replies.length > 0 && state.replies.length <= 2);
  const due = state.replies.map(r => r.dueTick); assert(due.every(t => t > state.tick));
  const answered = new Set();
  for (let i = 0; i < 500; i++) {
    state = step(state).state; assertBounds(state);
    for (const a of state.actors) if (a.motive.kind === 'call' && a.motive.reply) answered.add(a.id);
  }
  assert(answered.size > 0); assert.equal(state.replies.length, 0); assert(state.actors.every(a => a.motive.kind !== 'call'));
  for (let i = 0; i < 100; i++) {
    state = step(state, Array.from({ length: 8 }, (_, j) => ({ type: 'ripple', x: (j - 4) / 5, y: .1 }))).state;
    assertBounds(state);
  }
  assert(state.ripples.length > 0); state = advance(state, 200); assert.equal(state.ripples.length, 0);
});

test('selection/role edits preserve model clocks, positions and committed hops; reset preserves options and clears activity', () => {
  let state = createFrogPond({ seed: 77, director: { autonomy: false, scene: 'firefly-supper', layout: 'shelter' } });
  const { actor, pad } = freeHop(state); state = step(state, [{ type: 'hop', frogId: actor.id, padId: pad.id }]).state;
  const before = copy(state.actors.map(a => a.model));
  state = selectPondFrog(state, 2); state = setPondRole(state, actor.id, 'dreamer');
  assert.equal(state.selectedId, 2); assert.equal(state.actors[actor.id].role, 'dreamer'); assert.deepEqual(state.actors.map(a => a.model), before);
  for (const id of [-1, 3, 1.5, NaN]) assert.throws(() => selectPondFrog(state, id));
  assert.throws(() => setPondRole(state, 0, 'bird'));
  const preview = previewPondTarget(state, { x: .6, y: -.2 }); assert.equal(preview.tick, state.tick); assert.deepEqual(preview.actors.map(a => a.model.position), state.actors.map(a => a.model.position));
  const reset = resetFrogPond(preview); assert.equal(reset.seed, 77); assert.equal(reset.tick, 0); assert.equal(reset.lastSeq, -1);
  assert.deepEqual(reset.config, state.config); assert.deepEqual(reset.bodyConfig, state.bodyConfig);
  assert.equal(reset.target, null); assert.equal(reset.previewPad, null); assert.equal(reset.ripples.length, 0); assert.equal(reset.replies.length, 0); assert.equal(reset.firefly, null);
  assert(reset.actors.every(a => a.reservedPad === null && a.model.jumps === 0));
  assert.deepEqual(reset, resetFrogPond(reset));
  assert.throws(() => resetFrogPond(state, { director: { count: 4 } }));
});

test('autonomy off preserves rest indefinitely and tempo never changes model leap durations', () => {
  const rest = advance(createFrogPond({ director: { autonomy: false } }), 1200);
  assert.equal(rest.cueCount, 0); assert(rest.actors.every(a => a.model.jumps === 0)); assert.equal(rest.replies.length, 0);
  const runs = [.5, 1.5].map(tempo => {
    let state = createFrogPond({ director: { tempo, autonomy: false } }); const { actor, pad } = freeHop(state);
    state = step(state, [{ type: 'hop', frogId: actor.id, padId: pad.id }]).state;
    const sequence = [];
    for (let i = 0; i < 120; i++) { const b = state.actors[actor.id].model.behavior; sequence.push([b.kind, b.age ?? 0, state.actors[actor.id].model.position]); state = step(state).state; }
    return sequence;
  });
  assert.deepEqual(runs[0], runs[1]);
  assert.equal(FROG_POND_LIMITS.maxActors, 3); assert.equal(FROG_POND_LIMITS.maxRipples, 6); assert.equal(FROG_POND_LIMITS.maxReplies, 2);
});
