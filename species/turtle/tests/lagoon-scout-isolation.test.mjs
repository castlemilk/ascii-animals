import test from 'node:test';
import assert from 'node:assert/strict';
import * as original from '../../../lib/public/turtle.js';
import * as publicPackage from '../../../lib/index.js';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';
import { loadLagoonScout } from '../scripts/build-lagoon-scout.mjs';

const variant = await loadLagoonScout();
const implementations = [
  ['Original', original.createTurtleModel, original.createTurtleArtwork],
  ['Lagoon Scout', variant.createLagoonScoutModel, variant.createLagoonScoutArtwork]
];

// These are contract and synthetic-host lifecycle tests. They make no browser
// pixel, real touch, responsive CSS or achieved-frame-rate claim.
function borrowedClock() {
  const callbacks = new Set(), history = [];
  let subscriptions = 0, removals = 0, disposals = 0;
  return {
    source: {
      subscribe(callback) {
        callbacks.add(callback); history.push(callback); subscriptions++;
        let active = true;
        return () => {
          if (active) { active = false; callbacks.delete(callback); removals++; }
        };
      },
      dispose() { disposals++; }
    },
    get active() { return callbacks.size; },
    get subscriptions() { return subscriptions; },
    get removals() { return removals; },
    get disposals() { return disposals; },
    history,
    frame(time) { for (const callback of [...callbacks]) callback(time); }
  };
}
function assertReleased(h, canvas, clock) {
  assert.equal(clock.active, 0);
  assert.equal(clock.disposals, 0, 'a controller must never dispose a borrowed clock');
  assert.equal(h.pending, 0, 'the controller must not create a second animation loop');
  assert.equal(canvas.listenerCount, 0);
  assert.equal(h.resizes.size, 0);
  assert.equal(h.intersections.size, 0);
  assert.equal(h.motion.listenerCount, 0);
  assert.equal(h.document.listenerCount, 0);
  assert.equal(h.view.listenerCount, 0);
}

test('Lagoon Scout is an explicit private factory and Original remains the public turtle', () => {
  assert.deepEqual(Object.keys(variant).sort(), ['createLagoonScoutArtwork', 'createLagoonScoutModel']);
  assert.deepEqual(Object.keys(original).sort(), [
    'TURTLE_DEFAULTS', 'createTurtleArtwork', 'createTurtleModel', 'normalizeTurtleOptions'
  ]);
  for (const [name, value] of Object.entries(original)) assert.equal(publicPackage[name], value);
  assert(!('createLagoonScoutArtwork' in publicPackage));
  assert(!('createLagoonScoutModel' in publicPackage));
  const a = original.createTurtleModel(), b = variant.createLagoonScoutModel();
  assert.deepEqual(a.getOptions(), b.getOptions());
  assert.notEqual(a.frame().text, b.frame().text, 'the alternative must not resolve to Original');
  assert.equal(original.createTurtleModel().frame().text, a.frame().text);
});

test('both models preserve atomic validation and undefined-as-no-change configuration', () => {
  const config = { scene: 'reef-passage', count: 3, speed: 1.4, palette: 'rose',
    individuals: [{ id: 2, label: 'Reef Scout', size: 1.1, interest: .8 }] };
  const models = implementations.map(([, createModel]) => createModel(config));
  for (const model of models) {
    model.stage('linger'); model.inspect(.2, -.1, 2); model.advanceTicks(35);
    model.configure({ speed: undefined, palette: 'lagoon' });
    assert.equal(model.getOptions().speed, 1.4);
    const options = model.getOptions(), state = model.getState(), scene = model.getDirectorState();
    const text = model.frame().text;
    for (const patch of [null, [], { speed: NaN }, { count: 6 }, { unknown: 1 },
      { speed: Symbol() }, { individuals: new Array(2) },
      { individuals: [{ id: 1 }, { id: 1 }] }, { individuals: [{ id: 0, label: '<bad>' }] }]) {
      assert.throws(() => model.configure(patch));
      assert.equal(model.getOptions(), options);
      assert.deepEqual(model.getState(), state);
      assert.deepEqual(model.getDirectorState(), scene);
      assert.equal(model.frame().text, text);
    }
  }
  assert.deepEqual(models[0].getOptions(), models[1].getOptions());
});

test('Original and alternative can replace one controller on one canvas without leftover work', () => {
  const h = fakeBrowser(), canvas = h.canvas(342, 320), clock = borrowedClock();
  let active = null;
  // This exercises the factory seam only. No shared selector or route is added.
  for (const [, , createArtwork] of [...implementations, implementations[0]]) {
    if (active) { active.dispose(); assertReleased(h, canvas, clock); }
    active = createArtwork(canvas, { paused: true, frameSource: clock.source });
    assert.equal(active.canvas, canvas);
    assert.equal(clock.active, 0, 'mounting a replacement must preserve paused intent');
    h.intersect(canvas, true); active.play();
    assert.equal(clock.active, 1);
    clock.frame(0); clock.frame(20);
    assert(active.getStatus().tick > 0);
  }
  const state = active.getDirectorState();
  active.dispose(); active.dispose();
  for (const stale of clock.history) stale(1e9);
  assert.deepEqual(active.getDirectorState(), state);
  assert.equal(clock.subscriptions, clock.removals);
  assertReleased(h, canvas, clock);
});

test('both controllers compose pause, reduced motion, hidden, offscreen and zero-size blockers', () => {
  for (const [name, , createArtwork] of implementations) {
    const h = fakeBrowser({ dpr: 3 }), canvas = h.canvas(342, 320), clock = borrowedClock();
    const art = createArtwork(canvas, { frameSource: clock.source });
    assert.equal(clock.active, 0, `${name} waits for intersection`);
    h.intersect(canvas, true); assert.equal(clock.active, 1);
    clock.frame(0); clock.frame(20);
    art.pause(); h.hide(true); h.intersect(canvas, false); h.setReduced(true);
    h.hide(false); h.intersect(canvas, true);
    assert.equal(clock.active, 0, `${name} must retain pause/reduced blockers`);
    art.play(); assert.equal(clock.active, 0);
    h.intersect(canvas, false); h.setReduced(false); assert.equal(clock.active, 0);
    canvas.rect.width = 0; canvas.rect.height = 0; art.resize();
    h.intersect(canvas, true); assert.equal(clock.active, 0);
    assert.equal(canvas.width, 0); assert.equal(canvas.height, 0);
    const tick = art.getStatus().tick;
    for (let i = 0; i < 100; i++) canvas.emit('pointermove', { clientX: i, clientY: 12 });
    clock.frame(1e6); assert.equal(art.getStatus().tick, tick);
    canvas.rect.width = 342; canvas.rect.height = 320; art.resize();
    assert.equal(clock.active, 1);
    clock.frame(1e6); assert.equal(art.getStatus().tick, tick, 'resume must discard the blocked wall-clock interval');
    clock.frame(1e6 + 1000); assert(art.getStatus().tick - tick <= 6);
    assert(canvas.width <= 684 && canvas.height <= 640, 'DPR must stay bounded');
    art.dispose(); assertReleased(h, canvas, clock);
  }
});

test('both controllers preserve mobile coordinates, keyboard escape and static posters', () => {
  for (const [name, , createArtwork] of implementations) {
    const h = fakeBrowser({ reducedMotion: true, dpr: 2 }), canvas = h.canvas(342, 320);
    canvas.rect.left = 31; canvas.rect.top = 87;
    const clock = borrowedClock();
    const art = createArtwork(canvas, { frameSource: clock.source });
    h.intersect(canvas, true);
    let prevented = 0;
    const key = (key, extra = {}) => canvas.emit('keydown', { key, ...extra, preventDefault() { prevented++; } });
    key('Tab'); key('ArrowUp', { ctrlKey: true }); assert.equal(prevented, 0);
    key('ArrowRight'); key('ArrowUp'); key('Enter');
    assert.equal(prevented, 3); assert.equal(art.getStatus().tick, 0);
    assert(art.getDirectorState().marker.active);
    key('Escape'); assert.equal(art.getDirectorState().marker.active, false);
    const cell = art.getFrame().cells.findIndex(c => c.ownerId === 0 && c.glyph !== ' ');
    assert(cell >= 0, `${name} remains visible at the phone-sized canvas`);
    const frame = art.getFrame(), x = (cell % frame.columns) / (frame.columns - 1);
    const y = Math.floor(cell / frame.columns) / (frame.rows - 1);
    canvas.emit('pointerdown', { pointerType: 'touch', button: 0,
      clientX: canvas.rect.left + x * canvas.rect.width,
      clientY: canvas.rect.top + y * canvas.rect.height });
    assert.equal(art.getDirectorState().selectedId, 0);
    assert.equal(art.getStatus().tick, 0); assert.equal(clock.active, 0);
    const poster = art.getFrame().text;
    canvas.emit('pointermove', { clientX: 40, clientY: 90 });
    h.frame(10000); assert.equal(art.getFrame().text, poster);
    art.dispose(); assertReleased(h, canvas, clock);
  }
});

test('new invitation keys belong only to Lagoon Scout and leave Original unchanged', () => {
  for (const [name, , createArtwork] of implementations) {
    const h = fakeBrowser(), canvas = h.canvas(342, 320);
    const art = createArtwork(canvas, { paused: true });
    let prevented = 0;
    const before = art.getFrame().text;
    for (const key of ['p', 'g']) canvas.emit('keydown', { key, preventDefault() { prevented++; } });
    assert.equal(prevented, name === 'Original' ? 0 : 2);
    if (name === 'Original') assert.equal(art.getFrame().text, before);
    assert.equal(art.getStatus().tick, 0); assert.equal(h.pending, 0);
    art.dispose();
  }
});

test('both constructors roll back failed subscriptions and dispose every owned listener', () => {
  for (const [, , createArtwork] of implementations) {
    const h = fakeBrowser(), canvas = h.canvas(342, 320);
    delete h.view.IntersectionObserver;
    assert.throws(() => createArtwork(canvas, {
      frameSource: { subscribe() { throw new Error('failed clock'); } }
    }), /failed clock/);
    assert.equal(canvas.listenerCount, 0); assert.equal(h.pending, 0);
    assert.equal(h.resizes.size, 0); assert.equal(h.document.listenerCount, 0);
    assert.equal(h.motion.listenerCount, 0); assert.equal(h.view.listenerCount, 0);
  }
});
