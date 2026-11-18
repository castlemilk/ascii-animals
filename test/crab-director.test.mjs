import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrabModel, createCrabArtwork, normalizeCrabOptions } from '../lib/public/crab.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

// Model/lifecycle checks. This harness does not implement browser rendering.
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const advance = (model, ticks) => {
  while (ticks > 0) { const n = Math.min(600, ticks); model.advanceTicks(n); ticks -= n; }
};
const manual = (extra = {}) => createCrabModel({ scene: 'forage', count: 3, director: 'manual', ...extra });

test('authored scenes visit every advertised beat in order and start a new bounded cycle', () => {
  const arcs = {
    forage: ['arrive', 'forage', 'signal', 'return'],
    signals: ['arrive', 'signal', 'challenge', 'return'],
    tide: ['forage', 'retreat', 'shelter', 'return'],
  };
  for (const [scene, beats] of Object.entries(arcs)) {
    const model = createCrabModel({ scene, count: 3, actDuration: 120 });
    assert.deepEqual(model.getScene().beats, beats);
    for (let i = 0; i < beats.length; i++) {
      assert.equal(model.getScene().beat, beats[i]);
      assert.equal(model.getScene().beatIndex, i);
      model.advanceTicks(119);
      assert.equal(model.getScene().beat, beats[i], `${scene}: transition must not happen early`);
      assert(model.getScene().progress > 0.98);
      model.advanceTicks(1);
    }
    assert.equal(model.getScene().cycle, 1);
    assert.equal(model.getScene().beat, beats[0]);
    assert.equal(model.getScene().progress, 0);
    model.reset();
    assert.deepEqual(model.getScene(), createCrabModel({ scene, count: 3, actDuration: 120 }).getScene());
  }
});

test('rising tide produces retreat, shelter and a complete return to individual patches', () => {
  const model = createCrabModel({ scene: 'tide', count: 3, actDuration: 240 });
  const low = model.getScene().tideLevel;
  advance(model, 480 + 110);
  const sheltered = model.getScene();
  assert.equal(sheltered.beat, 'shelter');
  assert(sheltered.tideLevel > low + 0.5);
  for (const actor of sheltered.actors) {
    assert.equal(actor.behavior.kind, 'shelter');
    assert(actor.crouch > 0.9);
    assert(distance(actor, actor.home) < 0.04);
  }
  advance(model, 720 - model.getState().tick);
  const returning = new Set();
  for (let i = 0; i < 230; i++) {
    model.advanceTicks(1);
    for (const actor of model.getScene().actors) if (actor.behavior.kind === 'return') returning.add(actor.id);
  }
  const returned = model.getScene();
  assert.equal(returned.beat, 'return');
  assert(returned.tideLevel < low + 0.02);
  assert.equal(returning.size, 3, 'every resident must perform its return before resuming idle motives');
  for (const actor of returned.actors) {
    assert(['return', 'rest', 'groom', 'inspect'].includes(actor.behavior.kind));
    assert(distance(actor, actor.patch) < 0.04, `${actor.label} did not return to its patch`);
    assert(actor.crouch < 0.01);
  }
  model.advanceTicks(10);
  assert.equal(model.getScene().cycle, 1);
  assert.equal(model.getScene().beat, 'forage');
});

test('manual direction holds scene transitions while signals and retreat-return stages still perform', () => {
  const calls = manual({ scene: 'signals' });
  calls.setBeat('signal');
  let raised = false;
  for (let n = 0; n < 300; n++) {
    calls.advanceTicks(1);
    raised ||= calls.getScene().actors.some(actor => actor.behavior.kind === 'signal' && actor.leftClaw > 0.2);
  }
  assert(raised, 'manual signal must perform a claw call');
  assert.equal(calls.getScene().beat, 'signal');
  assert.equal(calls.getScene().cycle, 0);

  const tide = manual({ scene: 'tide' });
  tide.setBeat('retreat');
  tide.advanceTicks(200);
  assert.equal(tide.getScene().beat, 'retreat');
  assert(tide.getScene().actors.every(actor => actor.behavior.kind === 'retreat'), 'manual retreat must progress beyond bracing');
  tide.setBeat('return');
  const returning = new Set();
  for (let i = 0; i < 230; i++) {
    tide.advanceTicks(1);
    for (const actor of tide.getScene().actors) if (actor.behavior.kind === 'return') returning.add(actor.id);
  }
  assert.equal(tide.getScene().beat, 'return');
  assert.equal(returning.size, 3, 'every resident must finish waiting and perform its return');
  for (const actor of tide.getScene().actors) {
    assert(distance(actor, actor.patch) < 0.04);
  }
});

test('pointer proximity produces distinct shy, curious and territorial motives', () => {
  for (const [role, expected] of [['shy', 'retreat'], ['curious', 'inspect'], ['territorial', 'signal']]) {
    const model = manual({ count: 1, cast: [{ role }] });
    model.setBeat('forage');
    const actor = model.getScene().actors[0];
    model.guide(actor.x + 0.1, actor.y + 0.04);
    model.advanceTicks(1);
    assert.equal(model.getScene().actors[0].behavior.kind, expected, role);
    assert(model.getScene().guide.active);
    model.clearGuide();
    model.advanceTicks(600);
    assert.equal(model.getScene().guide.active, false);
    assert(distance(model.getScene().actors[0], model.getScene().actors[0].patch) < 0.04);
    assert.notEqual(model.getScene().actors[0].behavior.kind, 'retreat');
  }
});

test('unprompted foraging includes sifting, grooming and inspection without an input event', () => {
  const model = manual();
  model.setBeat('forage');
  const kinds = new Set();
  let individualsDiffer = false;
  for (let tick = 0; tick < 480; tick += 6) {
    model.advanceTicks(6);
    const actors = model.getScene().actors;
    for (const actor of actors) kinds.add(actor.behavior.kind);
    individualsDiffer ||= new Set(actors.map(actor => actor.behavior.kind)).size > 1;
  }
  for (const kind of ['forage', 'groom', 'inspect']) assert(kinds.has(kind), `missing autonomous ${kind}`);
  assert(individualsDiffer, 'residents must not run identical synchronized idle loops');
});

test('explicit shelter cue has retreat, hiding, checking and recovery stages; repeats do not restart it', () => {
  const model = manual(), control = manual();
  for (const m of [model, control]) { m.setBeat('forage'); m.cue('shelter', 0); m.advanceTicks(50); }
  model.cue('shelter', 0);
  model.cue('signal', 0);
  assert.deepEqual(model.getScene(), control.getScene());
  assert.equal(model.getScene().actors[0].behavior.kind, 'retreat');
  model.advanceTicks(61);
  assert.equal(model.getScene().actors[0].behavior.kind, 'shelter');
  model.advanceTicks(70);
  assert.equal(model.getScene().actors[0].behavior.kind, 'inspect');
  model.advanceTicks(45);
  assert.equal(model.getScene().actors[0].behavior.kind, 'return');
  model.advanceTicks(374);
  const actor = model.getScene().actors[0];
  assert(['forage', 'groom', 'inspect'].includes(actor.behavior.kind));
  assert(distance(actor, actor.patch) < 0.04);
  assert(actor.crouch < 0.01);
});

test('a targeted claw call earns staggered replies which finish instead of creating a permanent queue', () => {
  const model = manual();
  model.setBeat('forage');
  model.cue('signal', 0);
  const firstSignal = new Map();
  for (let tick = 1; tick <= 480; tick++) {
    model.advanceTicks(1);
    for (const actor of model.getScene().actors) {
      if (actor.behavior.kind === 'signal' && !firstSignal.has(actor.id)) firstSignal.set(actor.id, tick);
    }
  }
  assert.equal(firstSignal.size, 3);
  assert.equal(firstSignal.get(0), 1);
  assert(firstSignal.get(1) > firstSignal.get(0));
  assert(firstSignal.get(2) > firstSignal.get(1));
  assert(model.getScene().actors.every(actor => actor.behavior.kind !== 'signal'));
  model.advanceTicks(480);
  assert(model.getScene().actors.every(actor => actor.behavior.kind !== 'signal'));
});

test('a sand lure causes approach, claw-sifting and return after guidance is released', () => {
  const model = manual({ count: 1 });
  model.setBeat('forage');
  const patch = model.getScene().actors[0].patch;
  model.guide(patch.x + 0.14, patch.y + 0.04);
  model.cue('forage', 0);
  model.advanceTicks(30);
  assert.equal(model.getScene().actors[0].behavior.kind, 'scuttle');
  model.clearGuide();
  model.advanceTicks(80);
  const sifting = model.getScene().actors[0];
  assert.equal(sifting.behavior.kind, 'forage');
  assert(sifting.x > patch.x + 0.08, 'the crab must reach the sand lure');
  assert(sifting.leftClaw < 0, 'foraging lowers the working claw');
  model.advanceTicks(120);
  assert.equal(model.getScene().actors[0].behavior.kind, 'return');
  model.advanceTicks(370);
  assert(distance(model.getScene().actors[0], patch) < 0.04);
});

test('equal ordered events replay identically regardless of advanceTicks batching', () => {
  const play = chunk => {
    const model = createCrabModel({ scene: 'tide', count: 5, seed: 91, actDuration: 120, formation: 'terraces' });
    const step = n => { while (n > 0) { const k = Math.min(chunk, n); model.advanceTicks(k); n -= k; } };
    step(47); model.guide(-0.4, 0.35); model.select(3); model.cue('forage');
    step(83); model.clearGuide(); model.cue('signal', 2);
    step(160); model.configure({ current: -0.6, tide: 0.75 });
    step(190);
    return model;
  };
  const a = play(1), b = play(600);
  assert.deepEqual(a.getState(), b.getState());
  assert.deepEqual(a.getScene(), b.getScene());
  assert.deepEqual(a.frame(), b.frame());
  const before = a.getScene(); a.advanceTicks(0); assert.deepEqual(a.getScene(), before);
});

test('director and cast validation is atomic for configuration, actors, selection and frame', () => {
  const model = manual();
  model.advanceTicks(37); model.select(2); model.guide(0.2, 0.4);
  const options = model.getOptions(), state = model.getState(), scene = model.getScene(), frame = model.frame();
  const invalid = [
    { count: 0 }, { count: 6 }, { count: 1.5 }, { count: NaN },
    { actDuration: 119 }, { actDuration: 721 }, { actDuration: 200.5 },
    { tide: -0.1 }, { tide: 1.1 }, { current: Infinity }, { current: -1.1 },
    { scene: 'school' }, { formation: 'spiral' }, { director: 'random' }, { labels: 'yes' },
    { cast: null }, { cast: 'crabs' }, { cast: Array(6).fill({}) }, { cast: [null] }, { cast: new Array(1) },
    { cast: [{ role: 'leader' }] }, { cast: [{ label: '' }] }, { cast: [{ label: ' ' }] },
    { cast: [{ label: 'abcdefghijklmn' }] }, { cast: [{ label: 'one\ntwo' }] },
    { cast: [{ size: 0.79 }] }, { cast: [{ size: 1.21 }] }, { cast: [{ size: NaN }] },
    { cast: [{ position: 0 }] },
  ];
  for (const patch of invalid) {
    assert.throws(() => model.configure({ scene: 'tide', labels: true, ...patch }));
    assert.equal(model.getOptions(), options);
    assert.deepEqual(model.getState(), state);
    assert.deepEqual(model.getScene(), scene);
    assert.deepEqual(model.frame(), frame);
  }
  for (const id of [-1, 3, 0.5, NaN]) {
    assert.throws(() => model.select(id)); assert.throws(() => model.cue('forage', id));
  }
  assert.throws(() => model.cue('ink'));
  assert.throws(() => model.setBeat('shelter'));
  assert.deepEqual(model.getScene(), scene);
});

test('caller cast mutations cannot alter configuration and snapshots are deeply immutable', () => {
  const input = [{ role: 'curious', label: 'Pip', size: 1 }];
  const options = normalizeCrabOptions({ cast: input, scene: 'forage' });
  const model = createCrabModel(options);
  input[0].label = 'Changed'; input.push({ role: 'shy' });
  assert.equal(options.cast.length, 1);
  assert.equal(model.getOptions().cast[0].label, 'Pip');
  const scene = model.getScene(), actor = scene.actors[0], frame = model.frame();
  for (const value of [options, options.cast, options.cast[0], scene, scene.beats, scene.guide,
    scene.actors, actor, actor.home, actor.patch, actor.behavior, actor.feet, actor.feet[0],
    frame, frame.cells, frame.cells.find(cell => cell.owner === 0)]) assert(Object.isFrozen(value));
  assert.throws(() => { actor.x = 8; });
  assert.throws(() => { actor.feet[0].x = 8; });
  assert.throws(() => { options.cast[0].label = 'Changed'; });
  model.advanceTicks(1);
  assert.equal(scene.actors[0], actor, 'an old snapshot remains an independent immutable value');
});

test('ensemble counts stay bounded and every visible owner belongs to the active cast', () => {
  for (const count of [1, 2, 3, 4, 5]) for (const [columns, rows] of [[80, 32], [120, 50], [180, 90]]) {
    const model = createCrabModel({ scene: 'forage', count, columns, rows, scale: 1.3, labels: true });
    model.advanceTicks(75);
    const scene = model.getScene(), frame = model.frame();
    assert.equal(scene.actors.length, count);
    assert.equal(new Set(scene.actors.map(actor => actor.id)).size, count);
    for (const actor of scene.actors) {
      assert.equal(actor.feet.length, 8);
      assert(Number.isFinite(actor.x) && Number.isFinite(actor.y));
      assert(actor.feet.every(foot => Number.isFinite(foot.x) && Number.isFinite(foot.y) && foot.lift >= 0));
    }
    assert.equal(frame.cells.length, columns * rows);
    assert(frame.text.split('\n').every(line => line.length === columns));
    assert.match(frame.text, /^[\x20-\x7e\n]+$/);
    assert(frame.cells.every(cell => cell.owner === undefined || Number.isInteger(cell.owner) && cell.owner >= 0 && cell.owner < count));
    for (let id = 0; id < count; id++) assert(frame.cells.some(cell => cell.layer === 'crab' && cell.owner === id), `missing actor ${id} in ${count}-crab composition`);
  }
  const model = manual({ count: 5 }); model.select(4); model.configure({ count: 2 });
  assert.equal(model.getScene().actors.length, 2);
  assert.equal(model.getScene().selectedId, 1);
});

test('feet stay planted in world space during stance while the crab moves', () => {
  const model = manual();
  model.setBeat('forage');
  let previous = model.getScene(), movingSamples = 0, stableContacts = 0, lifts = 0;
  for (let tick = 0; tick < 120; tick++) {
    model.advanceTicks(1);
    const current = model.getScene();
    for (let id = 0; id < current.actors.length; id++) {
      const before = previous.actors[id], after = current.actors[id];
      if (distance(before, after) > 0.00001) {
        movingSamples++;
        for (let k = 0; k < 8; k++) {
          const a = before.feet[k], b = after.feet[k];
          if (a.planted && b.planted) {
            assert.equal(b.x, a.x); assert.equal(b.y, a.y); stableContacts++;
          }
          if (!b.planted && b.lift > 0) lifts++;
        }
      }
    }
    previous = current;
  }
  assert(movingSamples > 20);
  assert(stableContacts > 100);
  assert(lifts > 10);
});

test('palette, label and no-op configuration preserve planted feet and movement state', () => {
  const model = manual(); model.setBeat('forage'); model.advanceTicks(17);
  const before = model.getScene();
  assert(distance(before.actors[0], before.actors[0].home) > 0.01, 'exercise a resident in mid-stride');
  model.configure({ palette: 'rose' }); assert.deepEqual(model.getScene(), before);
  model.configure({ labels: true }); assert.deepEqual(model.getScene(), before);
  model.configure({}); assert.deepEqual(model.getScene(), before);
});

test('current reverses retreat displacement and tide changes the rendered waterline', () => {
  const left = manual({ scene: 'tide', current: -1 }), right = manual({ scene: 'tide', current: 1 });
  left.setBeat('retreat', true); right.setBeat('retreat', true);
  assert.equal(left.getScene().tideLevel, right.getScene().tideLevel);
  assert(right.getScene().actors[1].x > left.getScene().actors[1].x + 0.05);
  assert.notEqual(left.frame().text, right.frame().text);
  const low = manual({ tide: 0 }), high = manual({ tide: 1 });
  const waterRow = frame => frame.cells.reduce((sum, cell, i) => sum + (cell.layer === 'water' && cell.glyph === '~' ? Math.floor(i / frame.columns) : 0), 0);
  assert(high.getScene().tideLevel > low.getScene().tideLevel);
  assert(waterRow(high.frame()) > waterRow(low.frame()));
});

test('injected frame source remains caller-owned through suspension, recovery and disposal', () => {
  const h = fakeBrowser(), canvas = h.canvas(), callbacks = new Set();
  let removals = 0, schedulerDisposals = 0;
  const frameSource = {
    subscribe(callback) { callbacks.add(callback); return () => { if (callbacks.delete(callback)) removals++; }; },
    dispose() { schedulerDisposals++; },
  };
  const art = createCrabArtwork(canvas, { scene: 'tide', count: 3, frameSource });
  const emit = timestamp => { for (const callback of [...callbacks]) callback(timestamp); };
  h.intersect(canvas, true);
  assert.equal(callbacks.size, 1); assert.equal(h.pending, 0);
  emit(1000); emit(1000 + 1000 / 60);
  assert.equal(art.getStatus().tick, 1);
  emit(10000);
  assert.equal(art.getStatus().tick, 7); assert(art.getStatus().droppedSeconds > 8);
  art.pause(); assert.equal(callbacks.size, 0);
  const pausedTick = art.getStatus().tick;
  art.cue('shelter'); art.nextBeat(); art.guide(0.4, 0.2);
  assert.equal(art.getStatus().tick, pausedTick); assert.equal(callbacks.size, 0);
  art.play(); h.hide(true); assert.equal(callbacks.size, 0);
  h.hide(false); emit(90000); assert.equal(art.getStatus().tick, pausedTick);
  h.intersect(canvas, false); assert.equal(callbacks.size, 0);
  h.intersect(canvas, true); h.setReduced(true); assert.equal(callbacks.size, 0);
  h.setReduced(false); assert.equal(callbacks.size, 1);
  emit(Infinity); emit(120000); assert.equal(art.getStatus().tick, pausedTick);
  art.dispose(); art.dispose();
  assert.equal(callbacks.size, 0); assert.equal(schedulerDisposals, 0); assert(removals >= 4);
  assert.equal(canvas.listenerCount, 0);
  assert.equal(h.document.listenerCount, 0); assert.equal(h.motion.listenerCount, 0);
  assert.equal(h.resizes.size, 0); assert.equal(h.intersections.size, 0);
});

test('status subscriptions follow actions and are bounded during playback, with no second scheduler', () => {
  const h = fakeBrowser(), canvas = h.canvas(), art = createCrabArtwork(canvas, { scene: 'forage', count: 3 });
  h.intersect(canvas, true);
  const seen = [];
  const off = art.subscribe(status => seen.push(status));
  assert.equal(seen.length, 1);
  h.frame(); for (let n = 0; n < 60; n++) h.frame();
  assert(seen.length <= 6, 'no more than five playback updates per 60 model ticks, plus initial value');
  assert.equal(h.pending, 1);
  art.select(2); assert.equal(seen.at(-1).selectedId, 2);
  art.pause(); assert(seen.at(-1).paused);
  const n = seen.length; off(); off(); art.nextBeat(); assert.equal(seen.length, n);
  art.dispose(); assert.equal(h.pending, 0);
});

test('an initial subscriber failure rolls back that subscription', () => {
  const h = fakeBrowser(), art = createCrabArtwork(h.canvas(), { paused: true });
  let calls = 0;
  assert.throws(() => art.subscribe(() => { calls++; throw new Error('consumer failed'); }), /consumer failed/);
  assert.doesNotThrow(() => art.update({ palette: 'rose' }));
  assert.equal(calls, 1, 'a failed subscribe must not leak a callback with no unsubscribe handle');
  art.dispose();
});

test('identical callback subscriptions each own only their own removal', () => {
  const h = fakeBrowser(), art = createCrabArtwork(h.canvas(), { paused: true });
  let calls = 0;
  const callback = () => { calls++; };
  const removeFirst = art.subscribe(callback), removeSecond = art.subscribe(callback);
  assert.equal(calls, 2);
  removeFirst(); removeFirst();
  art.update({ palette: 'rose' });
  assert.equal(calls, 3, 'removing one subscription must preserve the other');
  removeSecond(); art.update({ palette: 'lagoon' });
  assert.equal(calls, 3);
  art.dispose();
});

test('visible crab glyph hits target that resident before the guide overlay is drawn', () => {
  const h = fakeBrowser(), canvas = h.canvas(), art = createCrabArtwork(canvas, { scene: 'forage', count: 3, paused: true });
  h.intersect(canvas, true);
  const frame = art.getFrame();
  const index = frame.cells.findIndex(cell => cell.layer === 'crab' && cell.owner === 2);
  assert(index >= 0);
  canvas.emit('pointerdown', {
    isPrimary: true, pointerType: 'touch',
    clientX: index % frame.columns / (frame.columns - 1) * canvas.rect.width,
    clientY: Math.floor(index / frame.columns) / (frame.rows - 1) * canvas.rect.height,
  });
  assert.equal(art.getScene().selectedId, 2, 'hitting a territorial resident must not fall through to the curious sand-forager');
  assert.equal(art.getScene().actors[2].behavior.kind, 'signal');
  assert(art.getScene().guide.active);
  canvas.emit('pointerup', { pointerType: 'touch' });
  assert.equal(art.getScene().guide.active, false);
  assert.equal(h.pending, 0);
  art.dispose();
});

test('touch cancellation clears guidance, nonprimary pointers are ignored and keyboard has equivalent cues', () => {
  const h = fakeBrowser(), canvas = h.canvas(), art = createCrabArtwork(canvas, { scene: 'tide', count: 3, paused: true });
  h.intersect(canvas, true);
  canvas.emit('pointermove', { clientX: 0, clientY: 0, isPrimary: false });
  assert.equal(art.getScene().guide.active, false);
  canvas.emit('pointermove', { clientX: 100, clientY: 200, isPrimary: true });
  assert(art.getScene().guide.active);
  canvas.emit('pointercancel'); assert.equal(art.getScene().guide.active, false);
  let prevented = 0;
  const key = value => canvas.emit('keydown', { key: value, preventDefault() { prevented++; } });
  key('3'); assert.equal(art.getScene().selectedId, 2);
  key('s'); assert.equal(art.getScene().actors[2].behavior.kind, 'signal');
  key('ArrowLeft'); assert(art.getScene().guide.x < 0);
  key('Escape'); assert.equal(art.getScene().guide.active, false);
  const beat = art.getScene().beat; key('n'); assert.notEqual(art.getScene().beat, beat);
  assert.equal(prevented, 5);
  assert.equal(h.pending, 0); assert.equal(art.getStatus().tick, 0);
  art.dispose();
  const frozen = art.getScene();
  key('1'); art.cue('signal'); art.nextBeat(); art.clearGuide(); art.select(1);
  assert.deepEqual(art.getScene(), frozen); assert.equal(canvas.listenerCount, 0);
});

test('system reduced motion exposes distinct still cues and scene poses without advancing or resuming', () => {
  const h = fakeBrowser({ reducedMotion: true }), canvas = h.canvas();
  const art = createCrabArtwork(canvas, { scene: 'tide', count: 3 });
  h.intersect(canvas, true);
  const first = art.getFrame().text;
  art.setBeat('shelter');
  assert.notEqual(art.getFrame().text, first);
  assert(art.getScene().actors.every(actor => actor.crouch > 0.7));
  art.cue('signal', 0);
  assert.equal(art.getScene().actors[0].behavior.kind, 'signal');
  art.play(); art.guide(0.4, 0.2); art.nextBeat();
  assert.equal(art.getStatus().tick, 0);
  assert.equal(h.pending, 0); assert(art.getStatus().paused);
  art.pause(); art.restart(); h.setReduced(false);
  assert.equal(h.pending, 0, 'explicit pause survives reduced-motion preference changes');
  art.dispose();
});
