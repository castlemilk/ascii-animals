/** Explicit DOM/Canvas mocks: lifecycle and input checks, not browser evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeBrowser } from '../../../../../test/helpers/fake-browser.mjs';
import { original, ember } from './modules.mjs';

function environment(options = {}) {
  const host = fakeBrowser(options), makeCanvas = host.canvas, canvases = [];
  host.document.activeElement = null;
  host.canvas = (width = 390, height = 390) => {
    const canvas = makeCanvas(width, height), emit = canvas.emit.bind(canvas), attributes = new Map();
    Object.assign(canvas, {
      getAttribute: name => attributes.get(name) ?? null,
      setAttribute: (name, value) => attributes.set(name, String(value)),
      removeAttribute: name => attributes.delete(name),
      focus: () => { host.document.activeElement = canvas; },
      blur: () => { host.document.activeElement = null; canvas.emit('blur'); },
      emit(type, fields = {}) {
        const event = { type, target: canvas, defaultPrevented: false,
          preventDefault() { this.defaultPrevented = true; }, ...fields };
        emit(type, event); return event;
      },
    });
    canvases.push(canvas); return canvas;
  };
  host.resources = () => host.pending + host.resizes.size + host.intersections.size
    + host.view.listenerCount + host.document.listenerCount + host.motion.listenerCount
    + canvases.reduce((count, canvas) => count + canvas.listenerCount, 0);
  return host;
}
function advance(host, steps = 1) { for (let n = 0; n <= steps; n++) host.frame(); }

test('private import is SSR-safe; Original → Ember → Original replaces one controller on the same shared scheduler', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  const host = environment(), canvas = host.canvas(), neighbourCanvas = host.canvas();
  const neighbour = original.createFoxArtwork(neighbourCanvas); host.intersect(neighbourCanvas, true);
  let originalText;
  for (const factory of [original.createFoxArtwork, ember.createEmberFoxArtwork, original.createFoxArtwork]) {
    const artwork = factory(canvas, { fox: { seed: 17 } }); host.intersect(canvas, true);
    assert.equal(host.pending, 1, 'Original and the active variation borrow one RAF multiplexer');
    assert.equal(artwork.getStatus().ownAnimationFrames, 0);
    assert.equal(artwork.getStatus().subscribed, true);
    const text = artwork.exportText();
    if (!originalText) originalText = text;
    else if (factory === original.createFoxArtwork) assert.equal(text, originalText, 'returning to Original restores its exact cells');
    else assert.notEqual(text, originalText, 'explicit opt-in selects different artwork');
    advance(host, 3); assert(artwork.getState().tick > 0);
    artwork.dispose(); artwork.dispose();
    assert.equal(artwork.disposed, true); assert.equal(canvas.listenerCount, 0);
    assert.equal(canvas.getAttribute('tabindex'), null);
    assert.equal(canvas.getAttribute('aria-keyshortcuts'), null);
    assert.equal(host.pending, 1, 'disposing the active choice leaves the neighbour alive');
    assert.throws(() => artwork.play(), /disposed/);
  }
  neighbour.dispose(); assert.equal(host.resources(), 0);
});

test('phone-sized Ember clicks and keyboard commands choose targets without stealing Space or Tab', () => {
  for (const input of ['click', 'keyboard']) {
    const host = environment({ dpr: 3 }), canvas = host.canvas(), batches = [];
    canvas.setAttribute('aria-keyshortcuts', 'Space');
    const fox = ember.createEmberFoxArtwork(canvas, { onInputs: batch => batches.push(batch) }); host.intersect(canvas, true);
    assert.equal(canvas.emit('keydown', { key: 'p' }).defaultPrevented, false, 'unfocused canvas does not own shortcuts');
    canvas.focus();
    for (const key of [' ', 'Tab']) assert.equal(canvas.emit('keydown', { key }).defaultPrevented, false);
    for (const fields of [{ key: 'p', ctrlKey: true }, { key: 'p', isComposing: true }, { key: 'Enter', repeat: true }]) {
      canvas.emit('keydown', fields); assert.equal(fox.getStatus().pendingInputs, 0);
    }
    if (input === 'click') {
      const click = canvas.emit('pointerdown', { clientX: 39, clientY: 195, pointerType: 'mouse', button: 0, isPrimary: true });
      assert.equal(click.defaultPrevented, false);
    } else {
      for (let index = 0; index < 20; index++) canvas.emit('keydown', { key: 'ArrowLeft', repeat: index > 0 });
      assert.equal(canvas.emit('keydown', { key: 'P' }).defaultPrevented, true);
    }
    assert.equal(fox.getStatus().pendingInputs, 2);
    advance(host);
    assert.equal(batches[0].length, 2); assert.equal(batches[0][0].type, 'guide');
    assert.equal(batches[0][1].type, 'pounce'); assert(batches[0][0].x < 0);
    assert(fox.getState().behavior.plan.toX < 0);
    assert.equal(fox.getStatus().backingWidth, 780, 'DPR stays capped while coordinates stay in CSS pixels');
    canvas.emit('keydown', { key: 'ArrowRight' }); canvas.blur(); assert.equal(fox.getStatus().pendingInputs, 0);
    fox.dispose(); assert.equal(canvas.getAttribute('aria-keyshortcuts'), 'Space'); assert.equal(host.resources(), 0);
  }
});

test('touch release commits one tap; drag, cancellation and a second finger do not pounce or suppress scrolling', () => {
  for (const gesture of ['tap', 'drag', 'cancel', 'second-finger']) {
    const host = environment(), canvas = host.canvas(), fox = ember.createEmberFoxArtwork(canvas);
    host.intersect(canvas, true);
    const touch = { pointerType: 'touch', pointerId: 7, isPrimary: true, button: 0, clientX: 351, clientY: 195 };
    assert.equal(canvas.emit('pointerdown', touch).defaultPrevented, false);
    assert.equal(fox.getStatus().pendingInputs, 1);
    if (gesture === 'drag') canvas.emit('pointermove', { ...touch, clientY: 220 });
    if (gesture === 'cancel') canvas.emit('pointercancel', touch);
    if (gesture === 'second-finger') canvas.emit('pointerdown', { ...touch, pointerId: 8, isPrimary: false });
    assert.equal(canvas.emit('pointerup', touch).defaultPrevented, false);
    if (gesture === 'tap') { canvas.emit('lostpointercapture', touch); canvas.emit('pointerleave', touch); }
    assert.equal(fox.getStatus().pendingInputs, gesture === 'tap' ? 2 : 0);
    advance(host); assert.equal(fox.getState().behavior.kind === 'crouch', gesture === 'tap');
    fox.dispose(); assert.equal(host.resources(), 0);
  }
});

test('Original and Ember retain live reduced-motion authority and user pause across restart', () => {
  for (const factory of [original.createFoxArtwork, ember.createEmberFoxArtwork]) {
    const host = environment({ reducedMotion: true }), canvas = host.canvas(), fox = factory(canvas);
    host.intersect(canvas, true); fox.play(); fox.pulse();
    assert.equal(fox.getStatus().staticPose, 'crouch');
    const text = fox.exportText();
    canvas.emit('pointermove', { clientX: 350, clientY: 195 }); assert.equal(fox.exportText(), text);
    assert.equal(fox.getState().tick, 0); assert.equal(host.pending, 0);
    fox.pause(); fox.restart(); host.setReduced(false);
    assert.equal(fox.getStatus().paused, true); assert.equal(host.pending, 0);
    fox.play(); advance(host, 3); assert(fox.getState().tick > 0);
    host.setReduced(true); const tick = fox.getState().tick;
    fox.play(); host.frame(300000); assert.equal(fox.getState().tick, tick); assert.equal(host.pending, 0);
    fox.dispose(); assert.equal(host.resources(), 0);
  }
});

test('Original and Ember drop blocked input and spend no ticks offscreen, hidden or at zero size', () => {
  for (const factory of [original.createFoxArtwork, ember.createEmberFoxArtwork]) {
    const host = environment(), canvas = host.canvas(), fox = factory(canvas);
    host.intersect(canvas, true); advance(host, 3);
    const tick = fox.getState().tick;
    fox.guide(.8, .3); fox.pulse(); host.intersect(canvas, false);
    assert.equal(fox.getStatus().pendingInputs, 0); assert.equal(host.pending, 0);
    host.hide(true); canvas.rect.width = 0;
    for (const observer of host.resizes) observer.callback([]);
    fox.pulse(); host.frame(300000); assert.equal(fox.getState().tick, tick);
    host.hide(false); host.intersect(canvas, true); assert.equal(host.pending, 0);
    canvas.rect.width = 390; for (const observer of host.resizes) observer.callback([]);
    host.frame(300000); assert.equal(fox.getState().tick, tick, 'resume anchors the clock instead of catching up');
    host.frame(); assert.equal(fox.getState().tick, tick + 1);
    assert.equal(fox.getStatus().droppedMilliseconds, 0);
    assert.notEqual(fox.getState().behavior.kind, 'crouch', 'blocked action is not replayed');
    fox.dispose(); assert.equal(host.resources(), 0);
  }
});

test('Ember director mobile grid and reduced-motion tableaux stay within the one mount', () => {
  const host = environment({ reducedMotion: true }), canvas = host.canvas(390, 446);
  const fox = ember.createEmberFoxArtwork(canvas, { director: { count: 2 } }); host.intersect(canvas, true);
  assert.equal(fox.getStatus().cols, 112); assert.equal(fox.getStatus().rows, 64);
  const rest = fox.exportText(); fox.selectFox(1); fox.cue('rustle', 1, { x: -.8, y: .7 });
  const listen = fox.exportText(); assert.equal(fox.getStatus().tableau, 'listen');
  fox.cue('pounce', 1, { x: .8, y: .7 }); const pounce = fox.exportText();
  assert.equal(fox.getStatus().tableau, 'pounce'); assert.notEqual(rest, listen); assert.notEqual(listen, pounce);
  assert.equal(fox.getDirectorState().selectedId, 1);
  assert.equal(fox.getDirectorState().tick, 0); assert.equal(host.pending, 0);
  assert.equal(fox.getStatus().pendingInputs, 0);
  fox.dispose(); assert.equal(host.resources(), 0);
});

test('Ember disposal rejects late borrowed callbacks and releases only its own subscription', () => {
  const host = environment(), canvas = host.canvas(), subscribers = new Set();
  const neighbour = () => {}; subscribers.add(neighbour);
  const frameSource = { subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); } };
  const fox = ember.createEmberFoxArtwork(canvas, { frameSource }); host.intersect(canvas, true);
  assert.equal(subscribers.size, 2); assert.equal(host.pending, 0);
  const late = [...subscribers].find(callback => callback !== neighbour);
  late(1000); late(1000 + 1000 / 60); assert.equal(fox.getState().tick, 1);
  fox.dispose(); const status = fox.getStatus(); late(1000000);
  assert.deepEqual(fox.getStatus(), status); assert.deepEqual([...subscribers], [neighbour]);
  assert.equal(host.resources(), 0);
});
