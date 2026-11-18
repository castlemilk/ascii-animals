import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createFoxDirector, FOX_DIRECTOR_DEFAULTS, FOX_DIRECTOR_LIMITS, resolveFoxDirectorOptions } from '../lib/director.js';
import { buildFoxSceneGrid } from '../lib/director-render.js';

const SCENES = ['dusk-hunt', 'moon-play', 'den-watch'];
const responding = actor => 'plan' in actor.state.behavior;
const progress = (director, through, events = new Map()) => {
  while (director.getState().tick < through) {
    const tick = director.getState().tick + 1;
    director.step(tick, events.get(tick) ?? []);
  }
  return director.getState();
};

function assertPose(pose) {
  assert.equal(pose.species, 'fox');
  assert(pose.polygons.length > 0 && pose.polygons.length <= 48);
  assert.equal(pose.legs.length, 4);
  assert.equal(new Set(pose.legs.map(leg => leg.id)).size, 4);
  const vertices = pose.polygons.flatMap(polygon => polygon.points);
  assert(vertices.length <= 1024);
  for (const point of [...vertices, ...pose.legs.flatMap(leg => leg.joints), ...Object.values(pose.landmarks)]) {
    assert(Number.isFinite(point.x) && Number.isFinite(point.y), 'geometry remains finite');
    assert(Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1, `geometry within normalized stage: ${JSON.stringify(point)}`);
  }
  for (const leg of pose.legs) {
    assert(leg.joints.length >= 3);
    for (let i = 1; i < leg.joints.length; i++) {
      assert(Math.hypot(leg.joints[i].x - leg.joints[i - 1].x, leg.joints[i].y - leg.joints[i - 1].y) < .8);
    }
  }
}

function assertGrid(grid, count, cols) {
  assert.equal(grid.cols, cols);
  assert.equal(grid.rows, 64);
  assert.equal(grid.glyphs.length, cols * 64);
  assert.equal(grid.materials.length, grid.glyphs.length);
  assert.equal(grid.owners.length, grid.glyphs.length);
  assert(grid.occupied > 0 && grid.occupied <= cols * 64);
  assert(/^[\x20-\x7e\n]+$/.test(grid.text), 'ASCII export is printable and uses newline only');
  assert.equal(grid.text.split('\n').length, 64);
  assert(grid.text.split('\n').every(line => line.length === cols), 'rectangular ASCII export retains right padding');
  assert([...grid.owners].every(id => Number.isInteger(id) && id >= -1 && id < count));
}

test('director defaults, option normalization and all documented boundaries are strict and detached', () => {
  assert(Object.isFrozen(FOX_DIRECTOR_DEFAULTS));
  assert(Object.isFrozen(FOX_DIRECTOR_LIMITS));
  assert.equal(FOX_DIRECTOR_DEFAULTS.scene, 'dusk-hunt');
  assert.equal(FOX_DIRECTOR_DEFAULTS.count, 2);
  assert.equal(FOX_DIRECTOR_DEFAULTS.pace, 1);
  assert.equal(FOX_DIRECTOR_DEFAULTS.curiosity, .7);
  assert.equal(FOX_DIRECTOR_DEFAULTS.wind, .3);
  assert.equal(FOX_DIRECTOR_DEFAULTS.spacing, 1);
  assert.equal(FOX_DIRECTOR_DEFAULTS.showLabels, true);
  const roles = ['hunter', 'lookout', 'dreamer'];
  const valid = resolveFoxDirectorOptions({ count: 3, pace: .5, curiosity: 0, wind: -1, spacing: .8, roles });
  roles[0] = 'playmate';
  assert.equal(valid.roles[0], 'hunter');
  assert(Object.isFrozen(valid) && Object.isFrozen(valid.roles));
  assert.doesNotThrow(() => resolveFoxDirectorOptions({ count: 1, pace: 1.5, curiosity: 1, wind: 1, spacing: 1.15, roles: ['auto', 'auto', 'auto'] }));
  const invalid = [
    null, [], { scene: 'school' }, { scene: undefined }, { count: 0 }, { count: 4 }, { count: 1.5 },
    { pace: .49 }, { pace: 1.51 }, { curiosity: -.01 }, { curiosity: 1.01 }, { wind: -1.01 }, { wind: 1.01 },
    { spacing: .79 }, { spacing: 1.16 }, { showLabels: 1 }, { roles: ['hunter', 'hunter', 'hunter', 'hunter'] },
    { roles: ['orbit'] }, { roles: 'hunter' }, { roles: [, 'hunter'] }, { pace: NaN }, { pace: Infinity }, { pace: '1' },
    { count: undefined }, { unknown: 1 },
  ];
  for (const patch of invalid) assert.throws(() => resolveFoxDirectorOptions(patch), `reject ${JSON.stringify(patch)}`);
  for (const options of [{ seed: -1 }, { seed: 0x100000000 }, { seed: NaN }, { fox: null }, { fox: [] }, { fox: false }]) {
    assert.throws(() => createFoxDirector(options), `reject malformed constructor ${JSON.stringify(options)}`);
  }
});

test('non-scene configuration preserves clocks and surviving identities; scene changes restart only the authored arc', () => {
  const director = createFoxDirector({ seed: 123, count: 3, roles: ['hunter', 'lookout', 'dreamer'] });
  progress(director, 120);
  const before = director.getState();
  director.configure({ pace: .75, wind: -.2, curiosity: .8, showLabels: false });
  const changed = director.getState();
  assert.equal(changed.tick, before.tick);
  assert.equal(changed.lastSequence, before.lastSequence);
  assert.equal(changed.sceneTime, before.sceneTime);
  assert.deepEqual(changed.actors.map(a => [a.id, a.state.seed, a.state.tick]), before.actors.map(a => [a.id, a.state.seed, a.state.tick]));
  director.configure({ count: 1 });
  const survivor = director.getState().actors[0];
  assert.equal(survivor.state.tick, before.actors[0].state.tick);
  assert.equal(survivor.state.seed, before.actors[0].state.seed);
  director.configure({ count: 3 });
  assert.deepEqual(director.getState().actors.map(a => a.id), [0, 1, 2]);
  assert.equal(director.getState().actors[0].state.tick, survivor.state.tick);
  assert.equal(director.getState().actors[1].state.tick, 0);
  director.configure({ scene: 'moon-play' });
  assert.equal(director.getState().tick, before.tick);
  assert.equal(director.getState().sceneTime, 0);
  assert.equal(director.getState().scene, 'moon-play');
  const state = director.getState(), options = director.getOptions();
  assert.throws(() => director.configure({ scene: 'den-watch', count: 4 }));
  assert.deepEqual(director.getState(), state);
  assert.deepEqual(director.getOptions(), options);
  director.dispose();
});

test('animal tuning preserves per-actor profiles and validates the entire patch before updating any actor', () => {
  const director = createFoxDirector({ count: 3 });
  const before = director.getState();
  director.configureFox({ tailSway: .11 });
  assert.equal(director.getFoxOptions().tailSway, .11);
  assert.deepEqual(director.getState().actors.map(actor => actor.options.facing), before.actors.map(actor => actor.options.facing));
  assert(director.getState().actors.every(actor => actor.options.tailSway === .11));
  assert.equal(director.getState().tick, before.tick);
  const stable = director.getState(), options = director.getFoxOptions();
  assert.throws(() => director.configureFox({ tailSway: .07, scale: 100 }));
  assert.deepEqual(director.getState(), stable);
  assert.deepEqual(director.getFoxOptions(), options);
  director.configureFox({ facing: 'left' });
  assert(director.getState().actors.every(actor => actor.options.facing === 'left'));
  director.dispose();
});

test('input batches are atomic with exact tick, increasing sequence, bounded count and actor validation', () => {
  const director = createFoxDirector({ count: 2 });
  const before = director.getState();
  const invalidBatches = [
    [{ type: 'guide', tick: 2, seq: 0, x: 0, y: 0 }],
    [{ type: 'guide', tick: 1, seq: 0, x: .5, y: .2 }, { type: 'cue', tick: 1, seq: 1, cue: 'ink' }],
    [{ type: 'guide', tick: 1, seq: 0, x: .5, y: .2 }, { type: 'leave', tick: 1, seq: 0 }],
    [{ type: 'select', tick: 1, seq: 0, id: 2 }],
    [{ type: 'cue', tick: 1, seq: 0, cue: 'rustle', id: -1 }],
    [{ type: 'cue', tick: 1, seq: 0, cue: 'rustle', x: .2 }],
    [{ type: 'cue', tick: 1, seq: 0, cue: 'rustle', y: .2 }],
    [{ type: 'guide', tick: 1, seq: 0, x: NaN, y: 0 }],
    [{ type: 'guide', tick: 1, seq: 0, x: 0, y: Infinity }],
    [{ type: 'leave', tick: 1, seq: 0, unexpected: true }],
    Array.from({ length: 17 }, (_, seq) => ({ type: 'leave', tick: 1, seq })),
  ];
  for (const batch of invalidBatches) {
    assert.throws(() => director.step(1, batch));
    assert.deepEqual(director.getState(), before, 'no earlier input or actor may advance after rejection');
  }
  for (const tick of [0, 2, 1.5, NaN]) assert.throws(() => director.step(tick));
  const accepted = director.step(1, [{ type: 'guide', tick: 1, seq: 10, x: 20, y: -20 }]);
  assert.equal(accepted.eventsAccepted, 1);
  assert.equal(accepted.state.pointer.x, 1);
  assert.equal(accepted.state.pointer.y, -1);
  assert.throws(() => director.step(2, [{ type: 'leave', tick: 2, seq: 10 }]));
  director.dispose();
});

test('pause, selection and deliberate tableaux do not advance time; reset retains options and pause', () => {
  const director = createFoxDirector({ seed: 1234, count: 3, fox: { paused: true } });
  const before = director.getState();
  const result = director.step(1, [{ type: 'cue', tick: 1, seq: 0, cue: 'pounce', id: 1 }]);
  assert.equal(result.kind, 'paused');
  assert.equal(result.eventsAccepted, 0);
  assert.deepEqual(director.getState(), before);
  director.select(2);
  assert.equal(director.getState().selectedId, 2);
  assert.equal(director.getState().tick, 0);
  assert.equal(director.getState().lastSequence, -1);
  assert.throws(() => director.select(3));
  const selected = director.getState();
  const stills = ['listen', 'pounce', 'rest'].map(tableau => {
    const frame = director.getFrame(tableau);
    assert.equal(frame.tableau, tableau);
    assert.equal(frame.state.tick, 0);
    for (const { pose } of frame.actors) assertPose(pose);
    return buildFoxSceneGrid(frame, { cols: 112, rows: 64 }).text;
  });
  assert.equal(new Set(stills).size, 3, 'reduced-motion choices produce visibly different cell tableaux');
  assert.deepEqual(director.getState(), selected);
  assert.throws(() => director.getFrame('ink'));
  director.configure({ scene: 'den-watch', pace: .75 });
  director.reset(99);
  assert.equal(director.isPaused(), true);
  assert.equal(director.getOptions().scene, 'den-watch');
  assert.equal(director.getOptions().pace, .75);
  assert.equal(director.getState().seed, 99);
  assert.equal(director.getState().tick, 0);
  assert.equal(director.getState().lastSequence, -1);
  assert.throws(() => director.setPaused('false'));
  director.setPaused(false);
  assert.equal(director.step(1).kind, 'advanced');
  director.dispose();
});

test('replay state and cell output are independent of render grouping and repeat after reset', () => {
  const events = new Map([
    [10, [{ type: 'guide', tick: 10, seq: 0, x: .75, y: .05 }]],
    [11, [{ type: 'select', tick: 11, seq: 1, id: 1 }]],
    [12, [{ type: 'cue', tick: 12, seq: 2, cue: 'rustle', id: 1, x: .75, y: .05 }]],
    [90, [{ type: 'leave', tick: 90, seq: 3 }]],
    [250, [{ type: 'cue', tick: 250, seq: 4, cue: 'play', id: 0 }]],
    [510, [{ type: 'cue', tick: 510, seq: 5, cue: 'pounce', id: 1 }]],
  ]);
  const run = (director, group) => {
    const samples = [];
    for (let tick = 1; tick <= 600; tick++) {
      director.step(tick, events.get(tick) ?? []);
      if (tick % group === 0) director.getFrame();
      if (tick % 60 === 0) samples.push(buildFoxSceneGrid(director.getFrame(), { cols: 112, rows: 64 }).text);
    }
    return { state: director.getState(), samples };
  };
  const directors = [1, 2, 5].map(() => createFoxDirector({ seed: 77, count: 2, scene: 'moon-play' }));
  const outputs = directors.map((director, i) => run(director, [1, 2, 5][i]));
  assert.deepEqual(outputs[1], outputs[0]);
  assert.deepEqual(outputs[2], outputs[0]);
  directors[0].reset();
  assert.deepEqual(run(directors[0], 5), outputs[0]);
  for (const director of directors) director.dispose();
});

test('reset preserves a nondefault initial Fox configuration and produces the same initial snapshot', () => {
  const director = createFoxDirector({ seed: 91, count: 3,
    fox: { facing: 'left', scale: .62, tailSway: .11, pounceHeight: .3 } });
  const initial = director.getState(), foxOptions = director.getFoxOptions();
  progress(director, 120);
  director.reset();
  assert.deepEqual(director.getFoxOptions(), foxOptions);
  assert.deepEqual(director.getState(), initial, 'reset does not replace the authored first profile with an implicit right profile');
  director.dispose();
});

test('deliberate pounce selects one actor, ignores repeat cues while busy and traverses recovery', () => {
  const director = createFoxDirector({ count: 3, roles: ['hunter', 'lookout', 'dreamer'] });
  const result = director.step(1, [{ type: 'cue', tick: 1, seq: 0, cue: 'pounce', id: 2 }]);
  assert.equal(result.cue, 'accepted');
  assert.equal(result.state.actors[2].state.behavior.kind, 'crouch');
  assert.equal(result.state.actors.filter(responding).length, 1);
  const plan = result.state.actors[2].state.behavior.plan;
  const phases = new Set(['crouch']);
  let seq = 1;
  for (let tick = 2; tick <= 220; tick++) {
    const prior = director.getState().actors[2];
    const inputs = responding(prior) ? [{ type: 'cue', tick, seq: seq++, cue: 'pounce', id: 2 }] : [];
    const step = director.step(tick, inputs);
    if (inputs.length) assert.equal(step.cue, 'ignored-busy', `busy input at ${tick}`);
    const actor = step.state.actors[2];
    phases.add(actor.state.behavior.kind);
    if (responding(actor)) assert.deepEqual(actor.state.behavior.plan, plan, 'busy cues cannot redirect an existing response');
  }
  for (const phase of ['airborne', 'landing', 'recover', 'cooldown']) assert(phases.has(phase), `observed ${phase}`);
  assert(!responding(director.getState().actors[2]), 'response recovers without a queued replay');
  director.dispose();
});

test('localized rustle has a single owner and starts attention before a delayed response', () => {
  const director = createFoxDirector({ count: 3, roles: ['lookout', 'hunter', 'dreamer'] });
  const result = director.step(1, [{ type: 'cue', tick: 1, seq: 0, cue: 'rustle', id: 1, x: .45, y: .35 }]);
  assert.equal(result.cue, 'accepted');
  assert.equal(result.state.rustle.owner, 1);
  assert.equal(result.state.actors[1].intent.kind, 'investigate');
  assert(!responding(result.state.actors[1]), 'notice/attention precedes any leap');
  const actions = new Set([result.state.actors[1].action]);
  for (let tick = 2; tick <= 420; tick++) {
    const state = director.step(tick).state;
    actions.add(state.actors[1].action);
  }
  assert(actions.has('listening'));
  assert(actions.has('stalking') || actions.has('sniffing'));
  assert(actions.has('pouncing'), 'a rustle leads to a bounded multi-stage response');
  assert(actions.has('recovering') || actions.has('resting'));
  director.dispose();
});

test('three authored scenes and individual roles exhibit meaningful autonomous action diversity', () => {
  const reports = [];
  for (const scene of SCENES) {
    const director = createFoxDirector({ seed: 17, count: 3, scene });
    const actions = new Set(), beats = new Set();
    for (let tick = 1; tick <= 1800; tick++) {
      const state = director.step(tick).state;
      beats.add(state.beat);
      for (const actor of state.actors) actions.add(actor.action);
    }
    assert(beats.size >= 3, `${scene} has an authored multi-stage arc`);
    assert(actions.size >= (scene === 'den-watch' ? 4 : 5), `${scene} exposes varied autonomous behavior`);
    reports.push(actions);
    director.dispose();
  }
  assert(reports[0].has('pouncing') && (reports[0].has('sniffing') || reports[0].has('stalking')));
  assert(reports[1].has('bowing') && reports[1].has('playing'));
  assert(reports[2].has('resting') && reports[2].has('watching'));
  const director = createFoxDirector({ count: 3, roles: ['hunter', 'lookout', 'dreamer'] });
  assert.deepEqual(director.getState().actors.map(actor => actor.role), ['hunter', 'lookout', 'dreamer']);
  assert.equal(new Set(director.getState().actors.map(actor => actor.state.seed)).size, 3);
  director.dispose();
});

test('full scene arcs at extreme settings retain bounded original geometry and printable owner-indexed grids', () => {
  for (const scene of SCENES) {
    const director = createFoxDirector({ scene, count: 3, pace: 1.5, wind: 1, spacing: 1.15,
      fox: { scale: .72, tailSway: .16, pounceHeight: .34 } });
    let seq = 0;
    const visibleActors = new Set();
    for (let tick = 1; tick <= 2160; tick++) {
      const inputs = tick % 260 === 1 ? [{ type: 'cue', tick, seq: seq++, cue: 'pounce', id: Math.floor(tick / 260) % 3 }] : [];
      director.step(tick, inputs);
      if (tick % 12 === 0) for (const { pose } of director.getFrame().actors) assertPose(pose);
      if (tick % 360 === 0) {
        for (const cols of [112, 160]) {
          const grid = buildFoxSceneGrid(director.getFrame(), { cols, rows: 64 });
          assertGrid(grid, 3, cols);
          for (const id of grid.owners) if (id >= 0) visibleActors.add(id);
        }
      }
    }
    assert.deepEqual([...visibleActors].sort(), [0, 1, 2], `${scene}: every cast member appears in the composed scene`);
    director.dispose();
  }
});

test('director snapshots are immutable, SSR imports are safe, and disposal is idempotent', () => {
  const director = createFoxDirector({ count: 2 });
  const state = director.getState();
  assert(Object.isFrozen(state));
  assert(Object.isFrozen(state.actors));
  assert(Object.isFrozen(state.actors[0]));
  assert(Object.isFrozen(state.actors[0].expression));
  assert.throws(() => { state.actors[0].expression.tailLift = 99; });
  assert.throws(() => { state.actors[0].state.target.x = 99; });
  const url = new URL('../lib/director.js', import.meta.url).href;
  const render = new URL('../lib/director-render.js', import.meta.url).href;
  const script = `for (const key of ['window','document','requestAnimationFrame']) Object.defineProperty(globalThis,key,{get(){throw new Error('SSR touched '+key)}}); await import(${JSON.stringify(url)}); await import(${JSON.stringify(render)});`;
  execFileSync(process.execPath, ['--input-type=module', '-e', script]);
  director.dispose(); director.dispose();
  for (const operation of [
    () => director.getState(), () => director.getOptions(), () => director.getFoxOptions(),
    () => director.getFrame(), () => director.configure({}), () => director.configureFox({}),
    () => director.step(1), () => director.setPaused(false), () => director.isPaused(),
    () => director.reset(), () => director.select(0),
  ]) assert.throws(operation, /disposed/i);
});
