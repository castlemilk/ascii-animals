import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { emberModel, emberDirector, emberPreview, emberScene,
  originalModel, originalDirector, originalPreview, originalScene } from './modules.mjs';

// Captured from the recovered authored patch, before extracting this variation.
// These are logical state/geometry/cells, not screenshots or browser acceptance.
const oracle = JSON.parse(await readFile(new URL('./fixtures/authored-output.json', import.meta.url), 'utf8'));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const gridHash = grid => ({ text: hash(grid.text), materials: hash(grid.materials) });
const versions = [
  ['original', originalModel, originalDirector, originalPreview, originalScene],
  ['authored', emberModel, emberDirector, emberPreview, emberScene],
];

for (const [version, modelApi, directorApi, preview, scene] of versions) {
  test(`${version}: solo geometry, cells and captured response match the independent source oracle`, () => {
    const expected = oracle.solo[version], model = modelApi.createFox({ seed: expected.seed });
    for (let tick = 0; tick <= expected.captures.at(-1).tick; tick++) {
      if (tick) model.step(tick, expected.events.filter(event => event.tick === tick));
      const capture = expected.captures.find(item => item.tick === tick);
      if (!capture) continue;
      const pose = model.getPose();
      assert.equal(hash(model.getState()), capture.state, `state at ${tick}`);
      assert.equal(hash(pose), capture.pose, `pose at ${tick}`);
      assert.deepEqual(gridHash(preview.buildFoxGrid(pose, { cols: 80, rows: 32 })), capture.phone);
      assert.deepEqual(gridHash(preview.buildFoxGrid(pose, { cols: 112, rows: 44 })), capture.desktop);
    }
    model.dispose();
  });

  test(`${version}: both full moments and static tableaux retain their authored desktop/phone output`, () => {
    for (const cue of ['rustle', 'play']) {
      const expected = oracle.directed[version][cue];
      const director = directorApi.createFoxDirector({ seed: expected.seed, count: expected.count });
      for (let tick = 0; tick <= expected.captures.at(-1).tick; tick++) {
        if (tick) director.step(tick, tick === expected.event.tick ? [expected.event] : []);
        const capture = expected.captures.find(item => item.tick === tick);
        if (!capture) continue;
        const frame = director.getFrame();
        assert.equal(hash(director.getState()), capture.state, `${cue} state at ${tick}`);
        assert.equal(hash(frame.actors.map(actor => actor.pose)), capture.pose, `${cue} pose at ${tick}`);
        assert.deepEqual(gridHash(scene.buildFoxSceneGrid(frame, { cols: 112, rows: 64 })), capture.phone);
        assert.deepEqual(gridHash(scene.buildFoxSceneGrid(frame, { cols: 160, rows: 64 })), capture.desktop);
      }
      for (const tableau of ['rest', 'listen', 'pounce']) {
        assert.deepEqual(gridHash(scene.buildFoxSceneGrid(director.getFrame(tableau), { cols: 112, rows: 64 })), expected.tableaus[tableau]);
      }
      director.dispose();
    }
    for (const capture of oracle.static[version]) {
      const pose = modelApi.staticFoxPose({ seed: 17, facing: capture.facing }, capture.mode);
      assert.equal(hash(pose), capture.pose, `${capture.mode} static pose facing ${capture.facing}`);
      const grid = preview.buildFoxGrid(pose, { cols: 80, rows: 32 });
      assert.deepEqual(gridHash(grid), { text: capture.text, materials: capture.materials });
    }
  });
}

test('Ember reuses Original state semantics without mutating its options, model or appearance', () => {
  const original = originalModel.createFox({ seed: 91 }), ember = emberModel.createFox({ seed: 91 });
  const originalPose = original.getPose();
  assert.notDeepEqual(ember.getPose(), originalPose, 'variation is visibly distinct at the same state');
  assert.notEqual(emberPreview.buildFoxGrid(ember.getPose(), { cols: 80, rows: 32 }).text,
    originalPreview.buildFoxGrid(originalPose, { cols: 80, rows: 32 }).text);
  for (const model of [original, ember]) {
    model.configure({ facing: 'left', scale: .6 });
    model.setPaused(true);
    assert.equal(model.step(1, [{ type: 'pounce', tick: 1, seq: 0 }]).kind, 'paused');
    model.reset(); assert.equal(model.isPaused(), true);
    model.setPaused(false);
  }
  for (let tick = 1; tick <= 220; tick++) {
    const input = tick === 1 ? [{ type: 'guide', tick, seq: 0, x: -.8, y: .7 }, { type: 'pounce', tick, seq: 1 }] : [];
    assert.deepEqual(ember.step(tick, input), original.step(tick, input));
  }
  assert.deepEqual(ember.getOptions(), original.getOptions());
  const fresh = originalModel.createFox({ seed: 91 }); assert.deepEqual(fresh.getPose(), originalPose); fresh.dispose();
  for (const model of [original, ember]) {
    const before = model.getState();
    assert.throws(() => model.configure({ scale: Infinity })); assert.deepEqual(model.getState(), before);
    model.dispose(); model.dispose(); assert.throws(() => model.getPose(), /disposed/);
  }
});

test('minimum-grid Ember keeps one eye and nose, closes its resting eye, and emits only ASCII', () => {
  const director = emberDirector.createFoxDirector({ seed: 17, count: 1 });
  for (const tableau of ['listen', 'rest']) {
    const pose = director.getFrame(tableau).actors[0].pose;
    const grid = emberPreview.buildFoxGrid(pose, { cols: 80, rows: 32 });
    const count = glyph => [...grid.glyphs].filter(index => emberPreview.FOX_GLYPHS[index] === glyph).length;
    assert.match(grid.text, /^[\x20-\x7e\n]*$/);
    assert.equal(count('@'), 1);
    assert.equal(count('o'), tableau === 'rest' ? 0 : 1);
    if (tableau === 'rest') assert.equal(count('-'), 1);
    assert.equal(emberPreview.buildFoxGrid(pose, { cols: 80, rows: 32, monochrome: true }).occupied, grid.occupied);
  }
  director.dispose();
});

function directed(cue, x) {
  const director = emberDirector.createFoxDirector({ seed: 17, count: 1, roles: ['lookout'] });
  const frames = [];
  for (let tick = 1; tick <= 420; tick++) frames.push(director.step(tick, tick === 1
    ? [{ type: 'cue', tick, seq: 0, cue, id: 0, x, y: .68 }] : []).state.actors[0]);
  director.dispose(); return frames;
}

test('left/right input changes both moments and direct pounces while anticipation and settling remain intact', () => {
  for (const cue of ['rustle', 'play', 'pounce']) {
    const left = directed(cue, -.8), right = directed(cue, .8), plans = [];
    for (const [frames, facing] of [[left, 'left'], [right, 'right']]) {
      const wait = cue === 'rustle' ? 44 : cue === 'play' ? 75 : 1;
      assert(frames.slice(0, wait).every(actor => actor.state.rootX === 0), `${cue} anticipates before root travel`);
      const plan = frames.find(actor => 'plan' in actor.state.behavior).state.behavior.plan;
      plans.push(plan); assert.equal(plan.options.facing, facing);
      const landing = frames.find(actor => actor.state.behavior.kind === 'landing');
      assert.equal(landing.state.rootX, plan.toX);
      assert(landing.state.feet.every(foot => foot.mode === 'planted'));
      const settled = frames.at(-1);
      assert.equal(settled.state.behavior.kind, 'idle');
      assert.equal(settled.state.target.active, false);
      if (cue !== 'pounce') {
        assert(Math.abs(settled.expression.headPitch) < .001);
        assert(Math.abs(settled.expression.tailLift) < .001);
      }
    }
    assert(plans[0].toX < plans[1].toX - .3, `${cue} changes the landing`);
  }
});

test('captured pounces reject later cues and replay identically across presentation grouping', () => {
  const replay = grouping => {
    const director = emberDirector.createFoxDirector({ seed: 91, count: 1 });
    const samples = []; let plan;
    for (let tick = 1; tick <= 220; tick++) {
      const inputs = tick === 1 ? [
        { type: 'cue', tick, seq: 0, cue: 'pounce', id: 0, x: -.8, y: .68 },
        { type: 'guide', tick, seq: 1, x: .9, y: -.3 },
        { type: 'cue', tick, seq: 2, cue: 'pounce', id: 0, x: .8, y: .68 },
      ] : tick === 32 ? [{ type: 'cue', tick, seq: 3, cue: 'pounce', id: 0, x: .8, y: .68 }] : [];
      const result = director.step(tick, inputs);
      if (tick === 1) {
        plan = result.state.actors[0].state.behavior.plan;
        assert.equal(result.cue, 'ignored-busy'); assert.equal(plan.options.facing, 'left'); assert(plan.toX < 0);
      }
      if (tick === 32) { assert.equal(result.cue, 'ignored-busy'); assert.deepEqual(result.state.actors[0].state.behavior.plan, plan); }
      if (tick % grouping === 0) director.getFrame();
      if (tick % 20 === 0) samples.push({ state: director.getState(), text: emberScene.buildFoxSceneGrid(director.getFrame(), { cols: 112, rows: 64 }).text });
    }
    director.dispose(); return samples;
  };
  assert.deepEqual(replay(2), replay(1)); assert.deepEqual(replay(5), replay(1));
});

test('head and ears keep the authored continuous load through solo, rustle and play launches', () => {
  for (const kind of ['solo', 'rustle', 'play']) {
    const core = kind === 'solo' ? emberModel.createFox({ seed: 17 }) : emberDirector.createFoxDirector({ seed: 17, count: 1 });
    const pose = () => kind === 'solo' ? core.getPose() : core.getFrame().actors[0].pose;
    let previous = pose(), measured = false;
    for (let tick = 1; tick <= 240; tick++) {
      core.step(tick, tick === 1 ? [kind === 'solo' ? { type: 'pounce', tick, seq: 0 }
        : { type: 'cue', tick, seq: 0, cue: kind, id: 0, x: .8, y: .68 }] : []);
      const next = pose();
      if (previous.phase === 'crouch' && next.phase === 'airborne') {
        for (const name of ['earNear', 'earFar', 'muzzle']) {
          const a = previous.landmarks[name], b = next.landmarks[name];
          assert(Math.hypot(b.x - a.x, b.y - a.y) < .025, `${kind} ${name}: less than one minimum-grid horizontal cell`);
        }
        measured = true; break;
      }
      previous = next;
    }
    assert(measured); core.dispose();
  }
});
