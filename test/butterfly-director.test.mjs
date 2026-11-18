import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createButterflyModel,
  createButterflyArtwork,
  normalizeButterflyOptions,
} from '../lib/public/butterfly.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

// Numerical/lifecycle checks. These do not substitute for browser screenshots,
// real pointer/touch checks, accessibility review, or device performance tests.
const scenes = ['morning', 'nectar', 'breeze', 'roost'];
const roles = ['forager', 'scout', 'basker', 'wanderer'];
const activities = new Set(['flutter', 'glide', 'inspect', 'nectar', 'perch', 'bask', 'shelter', 'recover']);
const gardenOptions = (director = {}) => ({
  seed: 31,
  director: { scene: 'nectar', count: 4, sceneSeconds: 24, roles, ...director },
});

function advance(model, ticks) {
  while (ticks > 0) {
    const chunk = Math.min(ticks, 600);
    model.advanceTicks(chunk);
    ticks -= chunk;
  }
}

function assertFiniteGarden(garden, count) {
  assert.equal(garden.members.length, count);
  assert.equal(new Set(garden.members.map(member => member.id)).size, count);
  assert(Number.isInteger(garden.actIndex) && garden.actIndex >= 0 && garden.actIndex < 4);
  assert(Number.isFinite(garden.progress) && garden.progress >= 0 && garden.progress <= 1);
  assert(Number.isInteger(garden.cycle) && garden.cycle >= 0);
  for (const member of garden.members) {
    assert([member.x, member.y, member.opening, member.scale, member.heading].every(Number.isFinite));
    assert(member.opening >= 0 && member.opening <= 1);
    assert(member.scale > 0);
    assert(activities.has(member.activity.kind), member.activity.kind);
  }
  for (const flower of garden.flowers) assert([flower.id, flower.x, flower.y].every(Number.isFinite));
}

test('director is additive: legacy defaults and single specimen remain the default', () => {
  const options = normalizeButterflyOptions();
  assert.equal(options.behavior, 'hover');
  assert.equal(options.columns, 120);
  assert.equal(options.rows, 50);
  assert.equal(options.seed, 7);
  assert.equal(options.director.scene, 'specimen');
  assert.equal(options.director.count, 1);
  assert.equal(options.director.path, 'meadow');
  assert.equal(options.director.sceneSeconds, 32);
  assert.equal(options.director.breeze, .2);
  assert.equal(options.director.spread, 1);
  assert.equal(options.director.pointerMode, 'attract');
  assert.equal(options.director.showLabels, false);
  assert.deepEqual(options.director.roles, []);
  const model = createButterflyModel();
  model.greet();
  assert.equal(model.getPhase(), 'approach');
  model.advanceTicks(45);
  assert.equal(model.getPhase(), 'display');
  model.advanceTicks(65);
  assert.equal(model.getPhase(), 'settle');
  model.advanceTicks(70);
  assert.equal(model.getPhase(), 'idle');
});

test('director validates bounded values and nested unknown fields atomically', () => {
  const model = createButterflyModel(gardenOptions());
  model.guide(.4, -.2);
  advance(model, 113);
  const beforeOptions = model.getOptions();
  const beforeState = model.getState();
  const beforeGarden = model.getGarden();
  const invalid = [
    { count: 0 }, { count: 7 }, { count: 1.5 }, { count: NaN },
    { sceneSeconds: 17 }, { sceneSeconds: 61 }, { sceneSeconds: Infinity },
    { breeze: -1.01 }, { breeze: 1.01 }, { breeze: NaN },
    { spread: .59 }, { spread: 1.26 }, { spread: Symbol('spread') },
    { scene: 'school' }, { path: 'vertical' }, { pointerMode: 'follow' },
    { showLabels: 'yes' }, { roles: ['unknown'] }, { roles: new Array(2) },
    { roles: Array(7).fill('scout') }, { roles: 'scout' }, { roles: null },
    { madeUp: true }, null, [],
  ];
  for (const director of invalid) {
    assert.throws(() => model.configure({ palette: 'rose', director }));
    assert.deepEqual(model.getOptions(), beforeOptions);
    assert.deepEqual(model.getState(), beforeState);
    assert.deepEqual(model.getGarden(), beforeGarden);
  }
  for (const director of [
    { count: 1, sceneSeconds: 18, breeze: -1, spread: .6 },
    { count: 6, sceneSeconds: 60, breeze: 1, spread: 1.25 },
  ]) assert.doesNotThrow(() => normalizeButterflyOptions({ director }));
});

test('partial director updates retain other settings and do not retain caller arrays', () => {
  const assigned = ['scout', 'forager'];
  const model = createButterflyModel(gardenOptions({ count: 2, roles: assigned, path: 'ribbon' }));
  assigned[0] = 'basker';
  assert.deepEqual(model.getOptions().director.roles, ['scout', 'forager']);
  model.configure({ director: { breeze: -.4 } });
  assert.equal(model.getOptions().director.scene, 'nectar');
  assert.equal(model.getOptions().director.count, 2);
  assert.equal(model.getOptions().director.path, 'ribbon');
  assert.equal(model.getOptions().director.breeze, -.4);
  assert(Object.isFrozen(model.getOptions()));
  assert(Object.isFrozen(model.getOptions().director));
  assert(Object.isFrozen(model.getOptions().director.roles));
  assert.throws(() => { model.getOptions().director.roles[0] = 'wanderer'; }, TypeError);
});

test('garden snapshots are immutable detached values with resolved individual roles', () => {
  const model = createButterflyModel(gardenOptions());
  const garden = model.getGarden();
  assert.deepEqual(garden.members.map(member => member.role), roles);
  for (const value of [garden, garden.members, garden.flowers, garden.pointer,
    ...garden.members, ...garden.members.map(member => member.activity), ...garden.flowers]) {
    assert(Object.isFrozen(value));
  }
  assert.throws(() => { garden.members[0].x = 100; }, TypeError);
  assert.throws(() => { garden.members[0].activity.kind = 'shelter'; }, TypeError);
  const saved = structuredClone(garden);
  model.advanceTicks(60);
  assert.deepEqual(garden, saved);
});

test('ordered scene, pointer and cue replay is deterministic across independent models', () => {
  const a = createButterflyModel(gardenOptions({ count: 6, path: 'spiral' }));
  const b = createButterflyModel(gardenOptions({ count: 6, path: 'spiral' }));
  const events = [
    model => model.advanceTicks(41),
    model => model.guide(.7, -.25),
    model => model.cue('gather'),
    model => model.advanceTicks(150),
    model => model.release(),
    model => model.nextAct(),
    model => model.advanceTicks(600),
    model => model.configure({ director: { scene: 'breeze', breeze: -.7 } }),
    model => model.cue('breeze'),
    model => model.advanceTicks(181),
  ];
  for (const event of events) {
    event(a); event(b);
    assert.deepEqual(a.getState(), b.getState());
    assert.deepEqual(a.getGarden(), b.getGarden());
    assert.equal(a.frame().text, b.frame().text);
  }
  const untouched = b.getGarden();
  a.advanceTicks(91);
  assert.deepEqual(b.getGarden(), untouched);
});

test('pure director advancement is independent of permitted tick partitioning', () => {
  for (const scene of scenes) {
    const a = createButterflyModel(gardenOptions({ scene, count: 6 }));
    const b = createButterflyModel(gardenOptions({ scene, count: 6 }));
    a.guide(-.4, .3); b.guide(-.4, .3);
    a.cue('breeze'); b.cue('breeze');
    a.advanceTicks(600);
    for (const ticks of [1, 17, 42, 60, 180, 300]) b.advanceTicks(ticks);
    assert.deepEqual(a.getGarden(), b.getGarden(), scene);
    assert.equal(a.frame().text, b.frame().text, scene);
  }
});

test('all authored scenes expose four named acts, advance without ticking, and wrap', () => {
  for (const scene of scenes) {
    const model = createButterflyModel(gardenOptions({ scene }));
    const firstIndex = model.getGarden().actIndex;
    const tick = model.getState().tick;
    const acts = new Set();
    const frames = new Set();
    for (let index = 0; index < 4; index++) {
      const garden = model.getGarden();
      assert.equal(garden.scene, scene);
      assert.equal(garden.actIndex, (firstIndex + index) % 4);
      assert.equal(typeof garden.act, 'string');
      assert(garden.actLabel.trim().length > 0);
      acts.add(garden.act);
      frames.add(model.frame().text);
      model.nextAct(true);
      assert.equal(model.getState().tick, tick);
    }
    assert.equal(acts.size, 4, `${scene} has four distinct authored acts`);
    assert(frames.size >= 3, `${scene} has visibly distinct still act compositions`);
    assert.equal(model.getGarden().actIndex, firstIndex);
  }
});

test('automatic scenes progress through every act and retain finite members over two loops', () => {
  for (const scene of scenes) {
    const model = createButterflyModel(gardenOptions({ scene, count: 6, sceneSeconds: 18 }));
    const seen = new Set();
    for (let ticks = 0; ticks <= 18 * 60 * 2; ticks += 90) {
      const garden = model.getGarden();
      seen.add(garden.actIndex);
      assertFiniteGarden(garden, 6);
      model.advanceTicks(90);
    }
    assert.equal(seen.size, 4, scene);
    assert(model.getGarden().cycle >= 2, scene);
  }
});

test('roles and individual phase offsets produce diverse autonomous activity', () => {
  const model = createButterflyModel(gardenOptions());
  const seenActivities = new Set();
  let divergentActivity = false;
  let divergentOpening = false;
  for (let step = 0; step < 40; step++) {
    const garden = model.getGarden();
    for (const member of garden.members) seenActivities.add(member.activity.kind);
    divergentActivity ||= new Set(garden.members.map(member => member.activity.kind)).size > 1;
    divergentOpening ||= new Set(garden.members.map(member => member.opening.toFixed(3))).size > 1;
    assert.equal(new Set(garden.members.map(member => `${member.x.toFixed(3)},${member.y.toFixed(3)}`)).size, 4);
    model.advanceTicks(60);
  }
  assert(seenActivities.size >= 4, `observed activities: ${[...seenActivities]}`);
  assert(divergentActivity, 'individual motives should not all share one activity');
  assert(divergentOpening, 'individual wings should not share one phase');
});

test('path choices change composition while preserving role identity', () => {
  const frames = new Set();
  for (const path of ['meadow', 'ribbon', 'spiral']) {
    const model = createButterflyModel(gardenOptions({ path, scene: 'morning' }));
    advance(model, 420);
    assert.deepEqual(model.getGarden().members.map(member => member.role), roles);
    frames.add(model.frame().text);
  }
  assert.equal(frames.size, 3);
});

test('pointer guide has explicit release and rejects invalid coordinates without poisoning state', () => {
  const model = createButterflyModel(gardenOptions());
  model.guide(.8, -.5);
  assert.equal(model.getGarden().pointer.active, true);
  assert.equal(model.getGarden().pointer.x, .8);
  assert.equal(model.getGarden().pointer.y, -.5);
  const before = model.getGarden();
  for (const point of [[NaN, 0], [0, Infinity], [Symbol('x'), 0]]) {
    assert.throws(() => model.guide(...point));
    assert.deepEqual(model.getGarden(), before);
  }
  model.release();
  assert.equal(model.getGarden().pointer.active, false);
  advance(model, 600);
  assertFiniteGarden(model.getGarden(), 4);
});

test('cues have bounded recovery and invalid cue names do not mutate the model', () => {
  for (const cue of ['gather', 'breeze', 'rest']) {
    const model = createButterflyModel(gardenOptions());
    const before = model.getGarden();
    assert.throws(() => model.cue('explode'));
    assert.deepEqual(model.getGarden(), before);
    model.cue(cue);
    assert.equal(model.getGarden().cue, cue);
    model.advanceTicks(120);
    assertFiniteGarden(model.getGarden(), 4);
    advance(model, 1800);
    assert.equal(model.getGarden().cue, 'none');
    assertFiniteGarden(model.getGarden(), 4);
  }
});

test('restart clears director inputs and scene progress while retaining configuration', () => {
  const options = gardenOptions({ scene: 'roost', count: 6, path: 'spiral' });
  const model = createButterflyModel(options);
  advance(model, 512);
  model.guide(.6, -.7);
  model.cue('gather');
  model.nextAct();
  const config = model.getOptions();
  model.reset();
  assert.deepEqual(model.getOptions(), config);
  const fresh = createButterflyModel(options);
  assert.deepEqual(model.getState(), fresh.getState());
  assert.deepEqual(model.getGarden(), fresh.getGarden());
  assert.equal(model.frame().text, fresh.frame().text);
});

test('maximum garden remains bounded printable ASCII at boundary grids', () => {
  for (const [columns, rows] of [[80, 32], [180, 90]]) {
    for (const scene of scenes) {
      const model = createButterflyModel({
        ...gardenOptions({ scene, count: 6, spread: 1.25, breeze: -1 }),
        columns, rows, scale: 1.3,
      });
      model.guide(1, -1);
      model.cue('breeze');
      advance(model, 257);
      const frame = model.frame();
      assertFiniteGarden(model.getGarden(), 6);
      assert.equal(frame.cells.length, columns * rows);
      assert(frame.cells.length <= 16200);
      assert.equal(frame.text.split('\n').length, rows);
      assert(frame.text.split('\n').every(row => row.length === columns));
      assert(/^[\x20-\x7e\n]+$/.test(frame.text));
      assert(frame.cells.every(cell => Number.isFinite(cell.tone) && cell.tone >= 0 && cell.tone <= 9));
      assert(frame.cells.some(cell => cell.glyph !== ' '));
    }
  }
});

test('director controls remain still under pause and authoritative reduced motion', () => {
  for (const reducedMotion of [false, true]) {
    const host = fakeBrowser({ reducedMotion });
    const canvas = host.canvas();
    const art = createButterflyArtwork(canvas, { ...gardenOptions(), paused: true });
    host.intersect(canvas, true);
    const tick = art.getStatus().tick;
    const act = art.getGarden().actIndex;
    art.nextAct();
    assert.equal(art.getGarden().actIndex, (act + 1) % 4);
    art.guide(.5, -.3);
    art.cue('gather');
    art.release();
    art.update({ director: { path: 'ribbon' } });
    assert.equal(art.getStatus().tick, tick);
    assert.equal(art.getStatus().paused, true);
    assert.equal(host.pending, 0);
    art.restart();
    assert.equal(art.getStatus().paused, true);
    if (reducedMotion) {
      art.play();
      art.cue('rest');
      assert.equal(art.getStatus().paused, true);
      assert.equal(host.pending, 0);
    }
    art.dispose();
  }
});

test('director instances borrow one scheduler and release only owned subscriptions/resources', () => {
  const host = fakeBrowser();
  const firstCanvas = host.canvas();
  const secondCanvas = host.canvas();
  const first = createButterflyArtwork(firstCanvas, gardenOptions({ count: 6 }));
  const second = createButterflyArtwork(secondCanvas, gardenOptions({ scene: 'morning' }));
  host.intersect(firstCanvas, true);
  host.intersect(secondCanvas, true);
  assert.equal(host.pending, 1);
  host.frame(); host.frame(40);
  first.pause();
  const secondTick = second.getStatus().tick;
  first.cue('breeze'); first.nextAct(); first.restart();
  host.frame(40);
  assert(second.getStatus().tick > secondTick);
  assert.equal(first.getStatus().tick, 0);
  first.dispose(); first.dispose();
  const stopped = first.getGarden();
  first.cue('rest'); first.nextAct(); first.guide(1, 1); first.release();
  assert.deepEqual(first.getGarden(), stopped);
  assert.equal(firstCanvas.listenerCount, 0);
  assert.equal(host.pending, 1);
  second.dispose();
  assert.equal(host.pending, 0);
  assert.equal(host.resizes.size, 0);
  assert.equal(host.intersections.size, 0);
  assert.equal(host.motion.listenerCount, 0);
  assert.equal(host.document.listenerCount, 0);
});

test('completed touch releases hover but preserves the authored cue; explicit cancellation clears it', () => {
  const host = fakeBrowser();
  const canvas = host.canvas();
  const art = createButterflyArtwork(canvas, gardenOptions());
  host.intersect(canvas, true);
  const touch = { clientX: 400, clientY: 200, pointerType: 'touch', pointerId: 1 };
  canvas.emit('pointerdown', touch);
  assert.equal(art.getGarden().cue, 'gather');
  // A normal touch ending releases implicit pointer capture and then leaves
  // the element. This sequence must not cancel the invitation just started.
  canvas.emit('pointerup', touch);
  canvas.emit('lostpointercapture', touch);
  canvas.emit('pointerleave', touch);
  assert.equal(art.getGarden().cue, 'gather');
  assert.equal(art.getGarden().pointer.active, false);
  host.frame(); host.frame(40);
  assert.equal(art.getGarden().cue, 'gather');
  art.release();
  assert.equal(art.getGarden().cue, 'none');
  canvas.emit('pointerdown', touch);
  assert.equal(art.getGarden().cue, 'gather');
  canvas.emit('pointercancel', touch);
  canvas.emit('lostpointercapture', touch);
  assert.equal(art.getGarden().cue, 'none');
  assert.equal(art.getGarden().pointer.active, false);
  art.dispose();
});

test('appearance updates preserve a paused in-flight composition', () => {
  const host = fakeBrowser();
  const canvas = host.canvas();
  const art = createButterflyArtwork(canvas, gardenOptions());
  host.intersect(canvas, true);
  host.frame(); host.frame(20);
  art.nextAct();
  host.frame(20);
  art.pause();
  const tick = art.getStatus().tick;
  const pose = () => art.getGarden().members.map(member => ({
    id: member.id, x: member.x, y: member.y, heading: member.heading, opening: member.opening,
  }));
  const held = pose();
  for (const patch of [{ palette: 'rose' }, { scale: 1.2 }, { speed: .5 }, { paused: true }]) {
    art.update(patch);
    assert.deepEqual(pose(), held);
    assert.equal(art.getStatus().tick, tick);
    assert.equal(art.getStatus().paused, true);
    assert.equal(host.pending, 0);
  }
  art.dispose();
});

test('repeated reduced-motion invitations reanchor the still pose without starting time', () => {
  const host = fakeBrowser({ reducedMotion: true });
  const canvas = host.canvas();
  const art = createButterflyArtwork(canvas, gardenOptions({ count: 2, roles: ['forager', 'scout'] }));
  host.intersect(canvas, true);
  const tick = art.getStatus().tick;
  canvas.emit('pointerdown', { clientX: 200, clientY: 230, pointerType: 'mouse', pointerId: 1 });
  const left = art.getGarden();
  canvas.emit('pointerdown', { clientX: 700, clientY: 230, pointerType: 'mouse', pointerId: 1 });
  const right = art.getGarden();
  assert.equal(right.cue, 'gather');
  assert(right.pointer.x > left.pointer.x + .8);
  for (let i = 0; i < right.members.length; i++) {
    assert(right.members[i].x > left.members[i].x + .5,
      `visitor ${i + 1} must follow the new still invitation anchor`);
    assert.equal(right.members[i].activity.kind, 'inspect');
    assert.equal(right.members[i].activity.target, 'invitation');
    assert.equal('flower' in right.members[i].activity, false);
  }
  assert.equal(art.getStatus().tick, tick);
  assert.equal(art.getStatus().reducedMotion, true);
  assert.equal(host.pending, 0);
  art.dispose();
});

test('scene edits keep the animation clock continuous and descriptor API is deeply immutable', () => {
  const model = createButterflyModel(gardenOptions());
  model.advanceTicks(173);
  const before = model.getGarden();
  model.configure({director: {sceneSeconds: 48}});
  const changed = model.getGarden();
  assert.equal(changed.clock, before.clock);
  assert(Math.abs(changed.progress - before.progress) < 1e-12);
  model.nextAct();
  assert.equal(model.getGarden().clock, before.clock);
  const descriptors = model.getScenes();
  assert.equal(descriptors.length, 5);
  for (const value of [descriptors, ...descriptors, ...descriptors.map(scene => scene.acts),
    ...descriptors.flatMap(scene => scene.acts)]) assert(Object.isFrozen(value));
});

test('autonomous act transitions ease position and wing opening without scene-loop teleports', () => {
  for (const scene of scenes) {
    const model = createButterflyModel(gardenOptions({scene, count: 6, sceneSeconds: 18}));
    let previous = model.getGarden();
    for (let tick = 0; tick < 1100; tick++) {
      model.advanceTicks(1);
      const current = model.getGarden();
      for (let id = 0; id < current.members.length; id++) {
        const a = previous.members[id], b = current.members[id];
        assert(Math.hypot(a.x - b.x, a.y - b.y) < .09, `${scene} position at ${tick}`);
        assert(Math.abs(a.opening - b.opening) < .3, `${scene} wing opening at ${tick}`);
      }
      previous = current;
    }
  }
});
