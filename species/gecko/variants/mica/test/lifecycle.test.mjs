// Numerical DOM/Canvas lifecycle harness. These checks are not native-browser evidence.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fakeBrowser } from '../../../../../test/helpers/fake-browser.mjs';
import { createGeckoArtwork } from '../../../../../lib/public/gecko.js';
import { getGeckoAnatomy } from '../../../compiled/geometry.js';
import { createMicaGeckoArtwork } from '../compiled/artwork.js';
import { mountMicaGecko } from '../compiled/browser.js';

function emit(canvas, type, fields = {}) {
  const event = { type, target: canvas, key: '', prevented: false,
    preventDefault() { this.prevented = true; }, ...fields };
  canvas.emit(type, event);
  return event;
}
function resize(env, canvas) {
  for (const observer of env.resizes) if (observer.target === canvas) observer.callback([{ target: canvas }]);
}
function footprint(env, canvas) {
  return { canvas: canvas.listenerCount, document: env.document.listenerCount, view: env.view.listenerCount,
    media: env.motion.listenerCount, resize: env.resizes.size, intersection: env.intersections.size };
}
function released(env, canvas) {
  assert.deepEqual(footprint(env, canvas), { canvas: 0, document: 0, view: 0, media: 0, resize: 0, intersection: 0 });
  assert.equal(env.pending, 0);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
}
function gridSize(artwork) {
  const lines = artwork.exportText().split('\n');
  assert(lines.every(line => line.length === lines[0].length));
  return { cols: lines[0].length, rows: lines.length };
}
function fixedContacts(before, after) {
  assert.equal(after.feet.length, 4);
  assert(after.feet.filter(foot => foot.phase === 'stance').length >= 3);
  const oldAnatomy = getGeckoAnatomy(before), anatomy = getGeckoAnatomy(after);
  for (const foot of after.feet) {
    const old = before.feet.find(candidate => candidate.id === foot.id);
    if (old.phase === 'stance' && foot.phase === 'stance' && old.plantedAt === foot.plantedAt) {
      assert.deepEqual(foot.position, old.position, 'a planted palm cannot slide between presentations');
      assert.equal(foot.angle, old.angle, 'a planted toe fan cannot rotate');
      assert.deepEqual(anatomy.limbs.find(limb => limb.id === foot.id).pads,
        oldAnatomy.limbs.find(limb => limb.id === foot.id).pads, 'all five planted toe contacts stay fixed');
    }
  }
}

function replay(kind, cadence) {
  const env = fakeBrowser();
  const options = { config: { seed: 37, options: { toeSpread: 1.08 } },
    ...(kind === 'director' ? { director: { population: 1, autonomy: false } } : {}) };
  const original = createGeckoArtwork(env.canvas(720, 560), options);
  const mica = createMicaGeckoArtwork(env.canvas(720, 560), options);
  const snapshot = artwork => kind === 'director' ? artwork.getDirectorSnapshot() : artwork.getSnapshot();
  try {
    assert.equal(env.pending, 1, 'both factories must borrow the same scheduler module');
    assert.notEqual(original.exportText(), mica.exportText());
    env.frame(); // Establish the timestamp without advancing the fixed-step models.
    let before = original.getSnapshot();
    const total = kind === 'director' ? 360 : 240;
    for (let tick = 0; tick < total; tick += cadence) {
      for (const artwork of [original, mica]) {
        if (kind === 'solo') {
          if (tick === 0) artwork.guide(.8, -.5);
          if (tick === 30) artwork.pulse();
          if (tick === 150) artwork.guide(-.5, .4);
          if (tick === 180) artwork.update({ toeSpread: .95, creepSpeed: .12 });
          if (tick === 210) artwork.clearGuide();
        } else {
          if (tick === 0) artwork.direct({ type: 'inspect', id: 'mica', x: -1.94 / 3.3, y: -.10 / 2.2 });
          if (tick === 120) artwork.direct({ type: 'moth', id: 'mica', x: -2 / 3.3, y: 1 / 2.2 });
          if (tick === 240) artwork.direct({ type: 'return', id: 'mica' });
        }
      }
      env.frame(cadence * 1000 / 60);
      assert.equal(original.getStatus().tick, tick + cadence);
      assert.deepEqual(snapshot(mica), snapshot(original), `same ${kind} inputs at tick ${tick + cadence}`);
      fixedContacts(before, mica.getSnapshot());
      before = mica.getSnapshot();
      assert.equal(env.pending, 1);
    }
    return snapshot(mica);
  } finally {
    original.dispose(); mica.dispose();
    assert.equal(env.pending, 0);
    assert.equal(env.resizes.size + env.intersections.size, 0);
  }
}

for (const kind of ['solo', 'director']) test(`Original and Mica preserve identical ${kind} replay and contacts under 1/2/5-tick frames`, () => {
  const one = replay(kind, 1);
  assert.deepEqual(replay(kind, 2), one);
  assert.deepEqual(replay(kind, 5), one);
});

test('private 320px profiles run at 64x40 solo and 64x48 focus while Original keeps its own cutoff', () => {
  for (const director of [undefined, { population: 1, autonomy: false }]) {
    const env = fakeBrowser({ dpr: 3 }), canvas = env.canvas(320, 360);
    const art = mountMicaGecko(canvas, director ? { director } : {});
    assert.equal(art.getStatus().tooSmall, false);
    assert.equal(art.getStatus().running, true);
    assert.equal(art.getStatus().dimensions.dpr, 2);
    assert.deepEqual(gridSize(art), { cols: 64, rows: director ? 48 : 40 });
    assert.match(art.exportText(), /^[\x20-\x7e\n]+$/);
    assert.equal(canvas.width, 640);
    canvas.rect.width = 319; resize(env, canvas);
    assert.equal(art.getStatus().tooSmall, true);
    assert.equal(env.pending, 0);
    assert.equal(canvas.width, 0);
    const draws = art.getStatus().renderedFrames;
    env.frame(10_000); art.redraw();
    assert.equal(art.getStatus().renderedFrames, draws);
    canvas.rect.width = 320; resize(env, canvas);
    assert.equal(env.pending, 1);
    art.dispose(); released(env, canvas);
  }
  const env = fakeBrowser(), canvas = env.canvas(320, 360);
  const original = createGeckoArtwork(canvas);
  assert.equal(original.getStatus().tooSmall, true);
  assert.equal(env.pending, 0);
  original.dispose(); released(env, canvas);
});

test('stage-local keyboard, CSS pointer coordinates and touch hover guard survive the private host', () => {
  const env = fakeBrowser({ dpr: 3 }), canvas = env.canvas(320, 360);
  canvas.rect.left = 120; canvas.rect.top = 210;
  const art = mountMicaGecko(canvas);
  try {
    assert.equal(emit(canvas, 'keydown', { key: 'ArrowLeft', target: {} }).prevented, false);
    assert.equal(emit(canvas, 'keydown', { key: 'ArrowLeft', ctrlKey: true }).prevented, false);
    emit(canvas, 'pointermove', { pointerType: 'touch', buttons: 0, clientX: 440, clientY: 210 });
    assert.equal(art.getStatus().pendingInputs, 0);
    emit(canvas, 'pointerdown', { pointerType: 'touch', buttons: 1, clientX: 440, clientY: 210 });
    env.frame(); env.frame();
    assert(art.getSnapshot().target.x > 0 && art.getSnapshot().target.y < 0);
    for (const departure of ['pointerleave', 'pointercancel', 'lostpointercapture']) {
      art.guide(.7, -.4); env.frame();
      emit(canvas, departure); env.frame();
      assert.equal(art.getSnapshot().target, null);
    }
    for (const [key, axis, sign] of [['ArrowLeft', 'x', -1], ['ArrowRight', 'x', 1], ['ArrowUp', 'y', -1], ['ArrowDown', 'y', 1]]) {
      assert.equal(emit(canvas, 'keydown', { key }).prevented, true);
      env.frame();
      assert(art.getSnapshot().target[axis] * sign > 0);
    }
    assert.equal(emit(canvas, 'keydown', { key: 'Escape' }).prevented, true);
    env.frame(); assert.equal(art.getSnapshot().target, null);
    assert.equal(emit(canvas, 'keydown', { key: ' ', code: 'Space' }).prevented, true);
    assert.equal(art.getStatus().paused, true);
    assert.equal(env.pending, 0);
    assert.equal(emit(canvas, 'keydown', { key: 'Tab' }).prevented, false);
  } finally { art.dispose(); released(env, canvas); }
});

test('focused pointer input uses its visible world and C/M keyboard cues do not repeat', () => {
  const env = fakeBrowser(), canvas = env.canvas(320, 360);
  const art = createMicaGeckoArtwork(canvas, { director: { population: 1, autonomy: false } });
  try {
    emit(canvas, 'pointerdown', { pointerType: 'touch', buttons: 1, clientX: 160, clientY: 180 });
    env.frame(); env.frame();
    assert.deepEqual(art.getDirectorSnapshot().pointer, { x: -1.6, y: .68 });
    emit(canvas, 'pointercancel'); env.frame();
    assert.equal(art.getDirectorSnapshot().pointer, null);
    assert.equal(emit(canvas, 'keydown', { key: 'm', repeat: true }).prevented, false);
    assert.equal(art.getStatus().pendingInputs, 0);
    assert.equal(emit(canvas, 'keydown', { key: 'm' }).prevented, true);
    env.frame(); assert.equal(art.getDirectorSnapshot().lastAction.type, 'moth');
    assert.equal(emit(canvas, 'keydown', { key: 'c', repeat: true }).prevented, false);
    assert.equal(art.getStatus().pendingInputs, 0);
    assert.equal(emit(canvas, 'keydown', { key: 'c' }).prevented, true);
    env.frame(); assert.equal(art.getDirectorSnapshot().lastAction.type, 'inspect');
  } finally { art.dispose(); released(env, canvas); }
});

test('pause, hidden, offscreen, zero-size, reduced motion and bfcache remain independent rest causes', () => {
  const env = fakeBrowser(), canvas = env.canvas(320, 360);
  const art = createMicaGeckoArtwork(canvas);
  try {
    art.guide(.8, -.5); env.frame(); env.frame();
    assert.notEqual(art.getSnapshot().target, null);
    art.pause(); env.hide(true); env.intersect(canvas, false); env.setReduced(true);
    canvas.rect.width = 0; resize(env, canvas);
    const tick = art.getStatus().tick, draws = art.getStatus().renderedFrames;
    env.frame(100_000); art.redraw();
    assert.equal(art.getStatus().tick, tick);
    assert.equal(art.getStatus().renderedFrames, draws);
    assert.equal(env.pending, 0);
    env.hide(false); assert.equal(env.pending, 0);
    env.intersect(canvas, true); assert.equal(env.pending, 0);
    canvas.rect.width = 320; resize(env, canvas); assert.equal(env.pending, 0);
    art.play(); assert.equal(env.pending, 0);
    env.setReduced(false); assert.equal(env.pending, 1);
    env.frame(100_000); assert.equal(art.getStatus().tick, tick, 'hidden time is discarded');
    env.frame(); assert.equal(art.getStatus().tick, tick + 1);
    assert.equal(art.getSnapshot().target, null, 'stale pointer guidance is released');
    assert.equal(art.getStatus().droppedMilliseconds, 0);
    env.view.emit('pagehide', { persisted: true });
    assert.equal(art.getStatus().pageSuspended, true); assert.equal(env.pending, 0);
    art.pause(); env.view.emit('pageshow');
    assert.equal(art.getStatus().pageSuspended, false); assert.equal(env.pending, 0);
    art.play(); assert.equal(env.pending, 1);
  } finally { art.dispose(); released(env, canvas); }
});

test('reduced-motion and paused alternatives change only the still artwork, then reset without reviving motion', () => {
  for (const director of [undefined, { population: 1, autonomy: false }]) {
    const env = fakeBrowser({ reducedMotion: true }), canvas = env.canvas(320, 360);
    const art = createMicaGeckoArtwork(canvas, director ? { director } : {});
    try {
      const state = director ? art.getDirectorSnapshot() : art.getSnapshot(), text = art.exportText();
      const receipt = director ? art.direct({ type: 'moth', id: 'mica', x: -1.4 / 3.3, y: 0 }) : art.pulse();
      assert.equal(receipt.outcome, 'static');
      assert.notEqual(art.exportText(), text);
      assert.deepEqual(director ? art.getDirectorSnapshot() : art.getSnapshot(), state);
      art.play(); env.frame(100_000);
      assert.equal(art.getStatus().tick, 0); assert.equal(env.pending, 0);
      art.pause(); art.update({ tailLength: .9 }); art.restart();
      assert.equal(art.getStatus().paused, true);
      assert.equal(art.getStatus().reducedMotion, true);
      assert.equal(art.getSnapshot().options.tailLength, .9);
      assert.equal(art.getStatus().directorPoster, 'none');
      assert.equal(art.getStatus().poster, 'current');
      env.setReduced(false); assert.equal(env.pending, 0);
    } finally { art.dispose(); released(env, canvas); }
  }
});

test('Original and Mica coexist on one scheduler; disposing either releases only that artwork', () => {
  for (const first of ['original', 'mica']) {
    const env = fakeBrowser(), a = env.canvas(), b = env.canvas();
    const original = createGeckoArtwork(a), mica = createMicaGeckoArtwork(b);
    assert.equal(mica.variation, 'mica'); assert.equal(mica.species, 'gecko'); assert.equal(mica.canvas, b);
    assert.equal(env.pending, 1);
    env.frame(); env.frame();
    const removed = first === 'original' ? original : mica, survivor = first === 'original' ? mica : original;
    removed.dispose(); removed.dispose();
    assert.equal(removed.disposed, true); assert.equal(env.pending, 1);
    const tick = survivor.getStatus().tick; env.frame();
    assert.equal(survivor.getStatus().tick, tick + 1);
    survivor.dispose();
    assert.equal(a.listenerCount + b.listenerCount, 0);
    released(env, first === 'original' ? b : a);
  }
});

test('repeated dispose-before-mount selection preserves current intent with one lifecycle on the same canvas', () => {
  const env = fakeBrowser(), canvas = env.canvas(720, 560);
  let options = { config: { seed: 51, options: { creepSpeed: .12, toeSpread: 1.04 } },
    director: { population: 1, autonomy: false }, paused: false, view: { grid: 'auto', maxDpr: 1.5 } };
  let active, expectedFootprint, actorSeed;
  const retired = [];
  try {
    for (let selection = 0; selection < 12; selection++) {
      if (active) { active.dispose(); active.dispose(); retired.push(active); released(env, canvas); }
      active = (selection % 2 ? createMicaGeckoArtwork : createGeckoArtwork)(canvas, options);
      expectedFootprint ??= footprint(env, canvas);
      assert.deepEqual(footprint(env, canvas), expectedFootprint, 'switching cannot accumulate listeners or observers');
      assert.equal(env.resizes.size, 1); assert.equal(env.intersections.size, 1);
      assert.equal(env.pending, options.paused ? 0 : 1);
      assert.equal(active.getDirectorSnapshot().seed, options.config.seed);
      actorSeed ??= active.getSnapshot().seed;
      assert.equal(active.getSnapshot().seed, actorSeed, 'the scene seed derives the same actor seed across selections');
      // Actor pace is tempo-scaled. The recipe retains the user's base settings.
      assert.equal(active.exportScene().animal.creepSpeed, options.config.options.creepSpeed);
      assert.equal(active.exportScene().animal.toeSpread, options.config.options.toeSpread);
      assert.equal(active.getStatus().paused, options.paused);
      assert.equal(active.getDirectorSnapshot().options.autonomy, false);
      if (options.director.tempo !== undefined) assert.equal(active.getDirectorSnapshot().options.tempo, options.director.tempo);
      env.frame(); env.frame();
      assert.equal(active.getStatus().tick, options.paused ? 0 : 1);
      const animal = active.update({ tailLength: .82 + selection * .01, creepSpeed: .1 + selection * .002 });
      const director = active.configureDirector({ tempo: .8 + (selection % 3) * .2, boldness: .4 + (selection % 2) * .1 });
      const view = active.setView({ grid: 'auto', maxDpr: 1.5, neutral: selection % 2 === 1 });
      const paused = selection % 3 === 0;
      active.setPaused(paused);
      options = { config: { seed: active.getDirectorSnapshot().seed, options: animal }, director, view, paused };
      assert(retired.every(artwork => artwork.disposed));
    }
  } finally { active?.dispose(); released(env, canvas); }
  for (const artwork of retired) assert.throws(() => artwork.play(), /disposed/);
});

test('private cleanup is final even when old observers run or mount setup fails', () => {
  const env = fakeBrowser(), canvas = env.canvas(320, 360);
  const art = createMicaGeckoArtwork(canvas);
  const resizeCallbacks = [...env.resizes].map(observer => observer.callback);
  const intersectionCallbacks = [...env.intersections].map(observer => observer.callback);
  art.dispose(); art.dispose();
  const draws = art.getStatus().renderedFrames;
  for (const callback of resizeCallbacks) callback([{ target: canvas }]);
  for (const callback of intersectionCallbacks) callback([{ target: canvas, isIntersecting: true }]);
  emit(canvas, 'keydown', { key: 'm' }); env.frame(100_000);
  assert.equal(art.getStatus().renderedFrames, draws);
  released(env, canvas);
  assert.throws(() => art.exportText(), /disposed/);
  const failed = env.canvas(320, 360);
  assert.throws(() => createMicaGeckoArtwork(failed, { onStatus() { throw new Error('host callback failed'); } }), /host callback failed/);
  released(env, failed);
});
