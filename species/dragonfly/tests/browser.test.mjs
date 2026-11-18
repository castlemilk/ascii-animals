import test from 'node:test';
import assert from 'node:assert/strict';
import { mountDragonfly, normalizeDragonflyPointer } from '../lib/browser.js';

// Explicit bookkeeping stubs. These do not rasterize, launch a browser, measure
// native performance, or prove real screen-reader/touch/heap behavior.
class Events {
  listeners = new Map();
  addEventListener(type, fn) { const set = this.listeners.get(type) ?? new Set(); set.add(fn); this.listeners.set(type, set); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type, fields = {}) {
    const event = { type, preventDefault() { this.defaultPrevented = true; }, ...fields };
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
    return event;
  }
  get count() { return [...this.listeners.values()].reduce((sum, values) => sum + values.size, 0); }
}
function fixture({ reduced = false, width = 900, height = 600, setupFailure = false, unsupported = false } = {}) {
  const win = new Events(), doc = new Events(), media = new Events();
  const frames = new Map(), resizers = [], intersections = [];
  let nextFrame = 1, now = 0, drawCalls = 0;
  win.devicePixelRatio = 1; doc.hidden = false; doc.fonts = new Events(); media.matches = reduced;
  win.matchMedia = () => media;
  win.requestAnimationFrame = fn => { const id = nextFrame++; frames.set(id, fn); return id; };
  win.cancelAnimationFrame = id => frames.delete(id);
  const context = { setTransform() {}, fillRect() {}, measureText: () => ({ width: 5 }), fillText() { drawCalls++; } };
  const canvas = new Events();
  canvas.ownerDocument = doc; canvas.width = 1; canvas.height = 1;
  canvas.rect = { left: 40, top: 30, width, height };
  canvas.getBoundingClientRect = () => canvas.rect;
  canvas.getContext = () => unsupported ? null : context;
  class Observer {
    constructor(callback) { this.callback = callback; this.target = null; this.disconnected = false; }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }
  class RO extends Observer {
    constructor(callback) { super(callback); resizers.push(this); }
    observe(target) { super.observe(target); if (setupFailure) throw new Error('Injected ResizeObserver setup failure'); }
  }
  class IO extends Observer { constructor(callback) { super(callback); intersections.push(this); } }
  return {
    canvas, win, doc, media, frames, resizers, intersections,
    environment: { window: win, document: doc, ResizeObserver: RO, IntersectionObserver: IO },
    frame(delta = 1000 / 60) { now += delta; const scheduled = [...frames.values()]; frames.clear(); for (const callback of scheduled) callback(now); },
    get draws() { return drawCalls; },
    get listeners() { return canvas.count + win.count + doc.count + media.count + doc.fonts.count; },
    resize(w, h) { canvas.rect = { ...canvas.rect, width: w, height: h }; for (const ro of resizers) ro.callback([]); },
    hidden(value) { doc.hidden = value; doc.emit('visibilitychange'); },
    intersect(value) { for (const io of intersections) io.callback([{ target: canvas, isIntersecting: value }]); },
    reduced(value) { media.matches = value; media.emit('change'); },
  };
}
function mount(f, options = {}) { return mountDragonfly(f.canvas, { environment: f.environment, ...options }); }
function advance(f, n = 5) { for (let i = 0; i < n; i++) f.frame(); }

test('CSS pointer normalization is bounded, offset-aware and independent of DPR', () => {
  const rect = { left: 100, top: 30, width: 400, height: 200 };
  assert.deepEqual(normalizeDragonflyPointer(300, 130, rect), { x: 0, y: 0 });
  assert.deepEqual(normalizeDragonflyPointer(-100, 999, rect), { x: -1, y: 1 });
  assert.equal(normalizeDragonflyPointer(0, 0, { ...rect, width: 0 }), null);
  assert.throws(() => normalizeDragonflyPointer(NaN, 0, rect));
  assert.throws(() => normalizeDragonflyPointer(0, 0, { ...rect, height: Infinity }));
});

test('one RAF, coalesced pointer flood, taps only guide, deliberate dart', () => {
  const f = fixture(), host = mount(f);
  assert.equal(f.frames.size, 1); advance(f, 2);
  for (let i = 0; i < 5000; i++) f.canvas.emit('pointermove', { clientX: 200 + i % 400, clientY: 100 });
  assert.equal(host.getStatus().pendingInputs, 1);
  f.canvas.emit('pointerdown', { clientX: 800, clientY: 300, button: 0, pointerType: 'touch' });
  f.frame();
  assert.equal(host.getStatus().behavior, 'approach');
  for (let i = 0; i < 500; i++) host.dart();
  assert.equal(host.getStatus().pendingInputs, 1);
  f.frame();
  assert.equal(host.getStatus().behavior, 'dart');
  assert.equal(f.frames.size, 1);
  host.dispose();
});

test('paused reset/configuration/preferences/visibility never clear user pause', () => {
  const f = fixture(), host = mount(f);
  advance(f); host.setPaused(true);
  const tick = host.getStatus().tick;
  assert.equal(f.frames.size, 0);
  host.configure({ wingHz: 2 }); host.reset();
  f.hidden(true); f.hidden(false); f.reduced(true); f.reduced(false);
  assert.equal(host.getStatus().paused, true); assert.equal(host.getStatus().tick, 0); assert(tick > 0);
  assert.equal(f.frames.size, 0);
  host.dart(); assert.equal(host.getStatus().tick, 0); assert.equal(f.frames.size, 0);
  host.setPaused(false); assert.equal(f.frames.size, 1);
  host.dispose();
});

test('reduced motion starts as meaningful static pose; pointer cannot opt into motion', () => {
  const f = fixture({ reduced: true }), host = mount(f);
  assert.equal(host.getStatus().motion, 'static'); assert.equal(f.frames.size, 0);
  assert(f.draws > 0); const initial = host.exportText();
  for (let i = 0; i < 100; i++) f.canvas.emit('pointermove', { clientX: 800, clientY: 300 });
  assert.equal(host.getStatus().pendingInputs, 0); assert.equal(host.getStatus().tick, 0);
  host.dart(); assert.notEqual(host.exportText(), initial); assert.equal(f.frames.size, 0);
  host.configure({ motion: 'slow' }); assert.equal(host.getStatus().motion, 'static');
  assert.equal(host.getStatus().requestedMotion, 'slow');
  f.reduced(false); assert.equal(host.getStatus().motion, 'slow'); assert.equal(f.frames.size, 1);
  f.reduced(true); assert.equal(f.frames.size, 0); assert.equal(host.getStatus().motion, 'static');
  host.dispose();
});

test('deliberate Change pose remains visibly effective while full motion is user-paused', () => {
  const f = fixture(), host = mount(f, { paused: true });
  const first = host.exportText(); const initialTick = host.getStatus().tick;
  host.dart();
  assert(host.exportText() !== first, 'Paused deliberate pose must change the logical character frame');
  assert.equal(host.getStatus().tick, initialTick); assert.equal(f.frames.size, 0);
  assert.equal(host.getStatus().paused, true); assert.equal(host.getOptions().motion, 'full');
  host.dispose();
});

test('hidden, offscreen and zero-size causes compose and resume drops elapsed wall time', () => {
  const f = fixture(), host = mount(f);
  advance(f); host.setTarget(0.9, 0.3); f.frame();
  const tick = host.getStatus().tick;
  f.hidden(true); assert.equal(f.frames.size, 0); assert.equal(host.getState().target, null);
  f.intersect(false); f.hidden(false); assert.equal(f.frames.size, 0);
  f.resize(0, 0); f.intersect(true); assert.equal(f.frames.size, 0);
  assert.equal(f.canvas.width, 0); assert.equal(f.canvas.height, 0);
  f.frame(60_000); f.resize(900, 600); assert.equal(f.frames.size, 1);
  f.frame(60_000); assert.equal(host.getStatus().tick, tick);
  f.frame(); assert.equal(host.getStatus().tick, tick + 1);
  host.dispose();
});

test('catch-up cap is five ticks, excess time is measured, pointer cancellation clears target', () => {
  const f = fixture(), host = mount(f);
  f.frame(); host.setTarget(0.8, -0.5); f.frame(5000);
  assert.equal(host.getStatus().tick, 5);
  assert(host.getStatus().droppedMilliseconds > 4900);
  assert.equal(host.getStatus().pendingInputs, 0);
  for (const type of ['pointerleave', 'pointercancel', 'lostpointercapture']) {
    host.setTarget(0.7, 0); f.frame(); assert.notEqual(host.getState().target, null);
    f.canvas.emit(type); assert.equal(host.getState().target, null);
  }
  host.dispose();
});

test('DPR/canvas/grid budgets hold across huge resize and system font redraw', () => {
  const f = fixture(), host = mount(f);
  f.win.devicePixelRatio = 3; f.resize(30_000, 12_000);
  const s = host.getStatus();
  assert.equal(s.dpr, 2); assert.equal(f.canvas.width, 2400); assert.equal(f.canvas.height, 1400);
  assert.equal(s.cols, 160); assert.equal(s.rows, 74); assert(s.cols * s.rows <= 160 * 88);
  const draws = f.draws; f.doc.fonts.emit('loadingdone'); assert(f.draws > draws);
  f.resize(360, 286); assert.equal(host.getStatus().cols, 72); assert.equal(host.getStatus().rows, 44);
  host.dispose();
});

test('keyboard handling is canvas-scoped and does not trap Tab or form keys', () => {
  const f = fixture(), host = mount(f); f.frame();
  const arrow = f.canvas.emit('keydown', { key: 'ArrowRight' }); assert.equal(arrow.defaultPrevented, true);
  f.frame(); assert(host.getState().target.x > 0);
  const tab = f.canvas.emit('keydown', { key: 'Tab' }); assert.equal(tab.defaultPrevented, undefined);
  const space = f.canvas.emit('keydown', { key: ' ', code: 'Space' }); assert.equal(space.defaultPrevented, true);
  assert.equal(host.getStatus().paused, true);
  assert.equal(f.doc.listeners.get('keydown'), undefined); assert.equal(f.win.listeners.get('keydown'), undefined);
  host.dispose();
});

test('invalid configuration/view/targets reject without changing prior host state', () => {
  const f = fixture(), host = mount(f, { paused: true });
  const before = host.getStatus(), options = host.getOptions();
  assert.throws(() => host.configure({ wingHz: NaN, motion: 'slow' }));
  assert.deepEqual(host.getOptions(), options);
  assert.equal(host.getStatus().requestedMotion, before.requestedMotion);
  assert.throws(() => host.setView('sideways')); assert.throws(() => host.setTarget(2, 0));
  assert.throws(() => host.setPaused('false')); assert.throws(() => host.setNeutral(1));
  assert.equal(host.getStatus().paused, true); assert.equal(f.frames.size, 0);
  host.dispose();
});

test('host exposes immutable snapshots instead of a mutable owned model', () => {
  const f = fixture(), host = mount(f);
  assert.equal('getModel' in host, false);
  assert(Object.isFrozen(host.getState())); assert(Object.isFrozen(host.getState().position));
  assert(Object.isFrozen(host.getOptions()));
  assert.throws(() => { host.getState().tick = 800; }, TypeError);
  assert.throws(() => { host.getOptions().motion = 'static'; }, TypeError);
  advance(f, 3); assert(host.getStatus().tick > 0); assert.equal(f.frames.size, 1);
  host.dispose();
  assert.equal(host.getState().tick, host.getStatus().tick);
});

test('dispose is idempotent, mutators reject, saved callbacks do no work', () => {
  const f = fixture(), host = mount(f);
  const savedFrame = [...f.frames.values()][0], savedResize = f.resizers[0].callback;
  const savedIntersection = f.intersections[0].callback, savedKey = [...f.canvas.listeners.get('keydown')][0];
  host.dispose(); host.dispose();
  assert.equal(f.listeners, 0); assert.equal(f.frames.size, 0);
  assert(f.resizers.every(x => x.disconnected)); assert(f.intersections.every(x => x.disconnected));
  assert.equal(f.canvas.width, 0); assert.equal(f.canvas.height, 0);
  const draws = f.draws;
  savedFrame(50); savedResize([]); savedIntersection([{ target: f.canvas, isIntersecting: true }]);
  savedKey({ key: 'ArrowRight', preventDefault() { throw new Error('late event must not act'); } });
  assert.equal(f.draws, draws); assert.equal(f.frames.size, 0);
  assert.equal(host.getStatus().disposed, true);
  for (const mutation of [() => host.setPaused(false), () => host.reset(), () => host.configure({}), () => host.setTarget(0, 0), () => host.dart(), () => host.render()]) assert.throws(mutation, /disposed/);
});

test('multiple hosts remain independent across disposal and repeated mounting', () => {
  const first = fixture(), second = fixture(); const a = mount(first), b = mount(second);
  advance(first); advance(second); a.dispose(); const before = b.getStatus().tick;
  advance(second); assert(b.getStatus().tick > before); assert.equal(second.frames.size, 1);
  b.dispose();
  for (let i = 0; i < 8; i++) {
    const f = fixture(), host = mount(f); advance(f, 2); host.dispose();
    assert.equal(f.listeners, 0); assert.equal(f.frames.size, 0);
  }
});

test('setup and consumer callback failures roll back owned resources', () => {
  const failed = fixture({ setupFailure: true });
  assert.throws(() => mount(failed), /Injected/); assert.equal(failed.listeners, 0); assert.equal(failed.frames.size, 0);
  assert(failed.resizers.every(x => x.disconnected));
  const unsupported = fixture({ unsupported: true }); assert.throws(() => mount(unsupported), /Canvas 2D/); assert.equal(unsupported.listeners, 0);
  const badCallback = fixture(); assert.throws(() => mount(badCallback, { onStatus() { throw new Error('consumer failure'); } }), /consumer failure/);
  assert.equal(badCallback.listeners, 0); assert.equal(badCallback.frames.size, 0);
  assert(badCallback.resizers.every(x => x.disconnected)); assert(badCallback.intersections.every(x => x.disconnected));
});
