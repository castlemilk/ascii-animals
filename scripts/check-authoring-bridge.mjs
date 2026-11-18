// Run with Node: node scripts/check-authoring-bridge.mjs [path/to/dist/artwork.js]
// The actually verified Node version is recorded with the test evidence.
// Executes the actual browser IIFE in an isolated VM with a stub Canvas/DOM.
// These tests make no browser, frame-rate, visual, or accessibility claim.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {test} from 'node:test';
import {createLegacyCuttlefishController} from '../examples/authoring/legacy-controller.mjs';

const rendererPath = process.argv[2] || fileURLToPath(new URL('../test/fixtures/legacy-artwork.cjs', import.meta.url));
const source = readFileSync(rendererPath, 'utf8');
console.log('# Renderer source:', rendererPath);
console.log('# Renderer SHA-256:', createHash('sha256').update(source).digest('hex'));

function fixture() {
  const targets = [], observers = [], scheduled = new Set(), calls = [];
  let nextFrame = 0, nextInstance = 0;
  const noop = () => {};
  function target() {
    const events = new Map();
    const obj = {
      addEventListener(type, fn) { if (!events.has(type)) events.set(type, new Set()); events.get(type).add(fn); },
      removeEventListener(type, fn) { events.get(type)?.delete(fn); },
      emit(type, event = {}) { for (const fn of [...(events.get(type) || [])]) fn(event); },
      listenerCount() { return [...events.values()].reduce((n, set) => n + set.size, 0); },
    };
    targets.push(obj); return obj;
  }
  function canvas() {
    const rect = {left: 0, top: 0, width: 320, height: 240};
    const ctx = new Proxy({
      createRadialGradient: () => ({addColorStop: noop}),
      createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4)}),
    }, {get: (obj, key) => key in obj ? obj[key] : noop});
    return Object.assign(target(), {rect, getBoundingClientRect: () => ({...rect}), getContext: () => ctx, dispatchEvent: noop});
  }
  function observerClass(kind) {
    return class {
      constructor(callback) { this.callback = callback; this.kind = kind; this.targets = new Set(); this.disconnected = false; observers.push(this); }
      observe(element) { this.targets.add(element); }
      disconnect() { this.disconnected = true; this.targets.clear(); }
    };
  }
  const document = Object.assign(target(), {hidden: false, createElement: canvas});
  const media = Object.assign(target(), {matches: false});
  const ResizeObserver = observerClass('size'), IntersectionObserver = observerClass('intersection');
  const scope = {
    console, document, window: {devicePixelRatio: 1}, performance: {now: () => 1000},
    ResizeObserver, CustomEvent: class {},
    requestAnimationFrame() { const id = ++nextFrame; scheduled.add(id); return id; },
    cancelAnimationFrame(id) { scheduled.delete(id); },
  };
  vm.createContext(scope); vm.runInContext(source, scope, {filename: rendererPath});
  const RealArtwork = scope.window.CuttlefishArtwork;
  assert.equal(typeof RealArtwork, 'function');
  function Artwork(element, options) {
    const id = ++nextInstance;
    calls.push({id, method: 'constructor', options});
    const real = new RealArtwork(element, options);
    const methods = ['setPaused', 'setOptions', 'getStats', 'restart', 'pulse', 'destroy'];
    return Object.fromEntries(methods.map(method => [method, (...args) => {
      calls.push({id, method, args});
      return real[method](...args);
    }]));
  }
  const environment = {document, matchMedia: () => media, ResizeObserver, IntersectionObserver};
  function mount(overrides = {}) {
    const element = canvas(), states = [];
    const controller = createLegacyCuttlefishController(element, {
      Artwork, options: {scene: 'reactive', count: 1, glow: false},
      environment, onStateChange: state => states.push(state), ...overrides,
    });
    return {element, controller, states};
  }
  function show(element, shown) {
    for (const o of observers) if (!o.disconnected && o.kind === 'intersection' && o.targets.has(element)) {
      o.callback([{target: element, isIntersecting: shown, intersectionRatio: shown ? 1 : 0}]);
    }
  }
  function resize(element, width, height) {
    Object.assign(element.rect, {width, height});
    for (const o of observers) if (!o.disconnected && o.kind === 'size' && o.targets.has(element)) o.callback([{target: element}]);
  }
  return {mount, show, resize, environment, Artwork, canvas, media, document, observers, scheduled, calls,
    listenerCount: () => targets.reduce((n, t) => n + t.listenerCount(), 0),
    callCount: method => calls.filter(c => c.method === method).length};
}

test('starts paused even if constructor options request playback; waits for intersection', t => {
  const f = fixture(), {controller: c, element} = f.mount({options: {count: 1, scene: 'reactive', paused: false}});
  t.after(() => c.destroy());
  assert.equal(f.calls[0].options.paused, true);
  assert.equal(c.getState().requestedPlay, false);
  assert.equal(c.play(), false);
  assert.equal(c.pulse(), false);
  assert.equal(f.callCount('pulse'), 0);
  f.show(element, true);
  assert.equal(c.getState().running, true);
  assert.equal(c.pulse(), true);
  assert.equal(f.callCount('pulse'), 1);
  assert.equal(c.getStats().reactionStage, 'react');
  c.pause();
  assert.equal(c.getState().running, false);
  assert.equal(c.pulse(), false);
});

test('composes reduced motion, visibility, viewport and zero-size policy', t => {
  const f = fixture(), {controller: c, element} = f.mount();
  t.after(() => c.destroy());
  f.show(element, true); c.play();
  f.media.matches = true; f.media.emit('change');
  assert.equal(c.getState().running, false);
  assert.equal(c.pulse(), false);
  f.document.hidden = true; f.document.emit('visibilitychange');
  f.media.matches = false; f.media.emit('change');
  assert.equal(c.getState().running, false, 'clearing one blocker must not clear another');
  f.document.hidden = false; f.document.emit('visibilitychange');
  assert.equal(c.getState().running, true);
  f.show(element, false);
  assert.equal(c.getState().running, false);
  f.resize(element, 0, 240); f.show(element, true);
  assert.equal(c.getState().running, false);
  f.resize(element, 320, 240);
  assert.equal(c.getState().running, true, 'remembered Play resumes when every blocker clears');
  c.pause(); f.show(element, false); f.show(element, true);
  assert.equal(c.getState().running, false, 'explicit Pause stays paused');
  assert.equal(f.scheduled.size, 1, 'the existing engine still owns a scheduled RAF while paused');
});

test('rechecks synchronous policy before pulse even before a change event arrives', t => {
  const f = fixture(), {controller: c, element} = f.mount();
  t.after(() => c.destroy());
  f.show(element, true); c.play();
  f.media.matches = true; // Deliberately omit the queued media event.
  assert.equal(c.pulse(), false);
  assert.equal(c.getState().running, false);
  f.media.matches = false; c.play();
  f.document.hidden = true; // Deliberately omit the visibility event.
  assert.equal(c.pulse(), false);
  f.document.hidden = false; c.play();
  element.rect.height = 0; // Deliberately omit ResizeObserver notification.
  assert.equal(c.pulse(), false);
  assert.equal(f.callCount('pulse'), 0);
});

test('setOptions cannot bypass pause policy; valid options and restart use the real API', t => {
  const f = fixture(), {controller: c, element} = f.mount();
  t.after(() => c.destroy());
  assert.throws(() => c.setOptions({paused: false}), /play\(\) or pause/);
  assert.throws(() => c.setOptions(null), /option patch/);
  assert.throws(() => c.setOptions([]), /option patch/);
  assert.equal(f.callCount('setOptions'), 0);
  c.setOptions({count: 2, formation: 'vertical'});
  assert.equal(c.getStats().count, 2);
  assert.equal(c.getStats().formation, 'vertical');
  c.restart();
  assert.equal(c.getState().running, false);
  f.show(element, true); c.play(); c.restart();
  assert.equal(c.getState().running, true);
  assert.equal(f.callCount('restart'), 2);
  f.document.hidden = true; // No visibility event has arrived yet.
  c.restart();
  assert.equal(c.getState().running, false);
  assert.deepEqual(f.calls.slice(-2).map(call => call.method), ['setPaused', 'restart']);
});

test('a consumer state callback failure after mount disposes resources and preserves the original error', () => {
  const f = fixture(), expected = new Error('consumer update failed');
  let fail = false;
  const {controller: c, element} = f.mount({onStateChange() { if (fail) throw expected; }});
  f.show(element, true);
  fail = true;
  assert.throws(() => c.play(), error => error === expected);
  assert.equal(c.getState().disposed, true);
  assert.equal(c.getState().running, false);
  assert.equal(f.callCount('destroy'), 1);
  assert.equal(f.scheduled.size, 0);
  assert.equal(f.listenerCount(), 0);
  assert(f.observers.every(o => o.disconnected));
  c.destroy();
  assert.equal(f.callCount('destroy'), 1);
});

test('multiple instances dispose independently; repeated destroy and delayed callbacks are harmless', () => {
  const f = fixture(), first = f.mount(), second = f.mount();
  f.show(first.element, true); f.show(second.element, true);
  first.controller.play(); second.controller.play();
  assert.equal(f.scheduled.size, 2);
  const late = f.observers.find(o => o.kind === 'intersection' && o.targets.has(first.element)).callback;
  first.controller.destroy(); first.controller.destroy();
  assert.equal(f.callCount('destroy'), 1);
  assert.equal(f.scheduled.size, 1);
  assert.equal(second.controller.getState().running, true);
  const callsBeforeLateCallback = f.calls.length;
  late([{target: first.element, isIntersecting: true, intersectionRatio: 1}]);
  assert.equal(f.calls.length, callsBeforeLateCallback);
  assert.throws(() => first.controller.play(), /destroyed/);
  assert.throws(() => first.controller.getStats(), /destroyed/);
  second.controller.destroy();
  assert.equal(f.callCount('destroy'), 2);
  assert.equal(f.scheduled.size, 0);
  assert.equal(f.listenerCount(), 0);
  assert(f.observers.every(o => o.disconnected));
});

test('missing capabilities fail before construction; partial adapter construction cleans up', () => {
  const f = fixture(), element = f.canvas();
  assert.throws(() => createLegacyCuttlefishController(element, {
    Artwork: f.Artwork, environment: {...f.environment, IntersectionObserver: undefined},
  }), /requires/);
  assert.equal(f.callCount('constructor'), 0);
  assert.throws(() => createLegacyCuttlefishController(element, {
    Artwork: f.Artwork, options: {count: 1}, environment: {...f.environment,
      IntersectionObserver: class {constructor() {throw new Error('injected observer failure');}},
    },
  }), /injected observer failure/);
  assert.equal(f.callCount('destroy'), 1);
  assert.equal(f.listenerCount(), 0);
  assert.equal(f.scheduled.size, 0);
  assert(f.observers.every(o => o.disconnected));
});
