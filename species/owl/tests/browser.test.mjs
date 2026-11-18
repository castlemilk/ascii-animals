// Simulated DOM/RAF/observers with the real Owl core and text sampler.
// These tests do not establish browser rendering, accessibility or device speed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountOwl } from '../build/browser.js';
import { createScheduler } from '../../../src/core/scheduler.js';

const STEP = 1000 / 60;

class TrackedTarget extends EventTarget {
  listeners = new Map();
  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener, options) {
    super.removeEventListener(type, listener, options);
    this.listeners.get(type)?.delete(listener);
  }
  get listenerCount() { return [...this.listeners.values()].reduce((total, set) => total + set.size, 0); }
}

function browserHarness() {
  const queue = new Map();
  let nextFrame = 1;
  const observers = { resize: new Set(), intersection: new Set() };
  const allObservers = [];
  const view = new TrackedTarget();
  view.innerWidth = 1400;
  view.innerHeight = 1000;
  view.requestAnimationFrame = callback => { const id = nextFrame++; queue.set(id, callback); return id; };
  view.cancelAnimationFrame = id => queue.delete(id);
  const media = new TrackedTarget();
  media.matches = false;
  view.matchMedia = () => media;
  const doc = new TrackedTarget();
  doc.hidden = false;
  doc.defaultView = view;
  class Element extends TrackedTarget {
    children = [];
    parentNode = null;
    style = {};
    textContent = '';
    attributes = new Map();
    ownerDocument = doc;
    rect = { left: 10, top: 10, width: 960, height: 540 };
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
    remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getBoundingClientRect() { const r = this.rect; return { ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height }; }
  }
  doc.createElement = () => new Element();
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.target = null; observers.resize.add(this); allObservers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { observers.resize.delete(this); }
  }
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; this.target = null; observers.intersection.add(this); allObservers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { observers.intersection.delete(this); }
  }
  const host = new Element();
  const environment = { document: doc, requestFrame: view.requestAnimationFrame, cancelFrame: view.cancelAnimationFrame,
    matchMedia: () => media, ResizeObserver, IntersectionObserver };
  return { host, view, doc, media, queue, observers, allObservers, environment, Element,
    mount(options = {}) { return mountOwl(host, { environment, ...options }); },
    frame(timestamp) { const callbacks = [...queue.values()]; queue.clear(); for (const callback of callbacks) callback(timestamp); },
    intersect(value = true) {
      for (const observer of [...observers.intersection]) observer.callback([{ target: observer.target, isIntersecting: value, intersectionRatio: value ? 1 : 0 }]);
    },
    resize(width, height) {
      host.rect.width = width; host.rect.height = height;
      for (const observer of [...observers.resize]) observer.callback([{ target: observer.target }]);
    },
    hidden(value) { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); },
    reduced(value) { media.matches = value; media.dispatchEvent(new Event('change')); },
    pointer(type, x = 720, y = 240) { const event = new Event(type); Object.assign(event, { clientX: x, clientY: y, pointerType: 'mouse' }); host.dispatchEvent(event); },
    get resourceCount() { return queue.size + observers.resize.size + observers.intersection.size + host.listenerCount + view.listenerCount + doc.listenerCount + media.listenerCount; },
  };
}

test('SSR-safe import, semantic text preview and initial intersection gate', () => {
  assert.equal(globalThis.document, undefined);
  const h = browserHarness();
  const c = h.mount();
  assert.equal(c.getStatus().running, false);
  assert.deepEqual(c.getStatus().blockedBy, ['offscreen']);
  assert.equal(h.queue.size, 0);
  const pre = h.host.children[0].children[0];
  assert.equal(pre.attributes.get('role'), 'img');
  assert.match(pre.attributes.get('aria-label'), /two forward-facing eyes/);
  assert.equal(pre.textContent, c.exportText());
  assert.equal(pre.textContent.split('\n').length, 54);
  h.intersect();
  assert.equal(c.getStatus().running, true);
  assert.equal(h.queue.size, 1);
  h.frame(0); h.frame(STEP);
  assert.equal(c.getSnapshot().simulation.tick, 1);
  c.dispose();
  assert.equal(h.resourceCount, 0);
});

test('independent playback, hidden, reduced-motion, size and viewport blockers compose', () => {
  const h = browserHarness();
  const c = h.mount({ paused: true });
  h.intersect(); h.reduced(true); h.hidden(true); h.resize(0, 0);
  assert.equal(h.queue.size, 0);
  assert.deepEqual(c.getStatus().blockedBy, ['paused', 'reduced-motion', 'hidden', 'zero-size']);
  c.reset(); c.update({ headYawLimitDeg: 30 });
  assert.equal(c.getStatus().paused, true);
  h.hidden(false); h.reduced(false); h.resize(960, 540);
  assert.deepEqual(c.getStatus().blockedBy, ['paused']);
  c.setPaused(false);
  assert.equal(h.queue.size, 1);
  h.intersect(false);
  assert.equal(h.queue.size, 0);
  h.intersect(true);
  h.frame(10000); h.frame(10000 + STEP);
  assert.equal(c.getStatus().tick, 1, 'no hidden/paused time is caught up');
  c.dispose(); assert.equal(h.resourceCount, 0);
});

test('pointer flooding and repeat react retain at most two next-tick actions', () => {
  const h = browserHarness();
  const c = h.mount(); h.intersect(); h.frame(0);
  for (let i = 0; i < 5000; i++) h.pointer('pointermove', i % 960 + 10, 240);
  for (let i = 0; i < 30; i++) c.react();
  assert.equal(c.getStatus().queuedInputs, 2);
  assert.equal(c.getStatus().tick, 0);
  h.frame(STEP);
  const state = c.getSnapshot().simulation;
  assert.equal(state.tick, 1);
  assert.equal(state.lastSequence, 1);
  assert.equal(state.behavior.kind, 'response');
  assert.equal(state.behavior.phase, 'blink');
  assert.equal(c.getStatus().queuedInputs, 0);
  c.dispose();
});

test('fixed-step catch-up is capped at five; time loss is reported; backward clocks do not rewind', () => {
  const h = browserHarness(); const c = h.mount(); h.intersect();
  h.frame(0); h.frame(1000);
  assert.equal(c.getStatus().tick, 5);
  assert(Math.abs(c.getStatus().droppedMs - 55 * STEP) < 1e-6);
  h.frame(900); h.frame(1000);
  assert.equal(c.getStatus().tick, 5);
  h.frame(1000 + STEP);
  assert.equal(c.getStatus().tick, 6);
  c.dispose();
});

test('reduced motion provides intentional still poses with an unchanged simulation', () => {
  const h = browserHarness(); h.media.matches = true;
  const c = h.mount(); h.intersect();
  const baseline = c.getSnapshot().simulation;
  assert.deepEqual(c.react(), { kind: 'poster', poster: 'react' });
  assert.equal(c.getSnapshot().displayed.leftWing > 0, true);
  assert.deepEqual(c.getSnapshot().simulation, baseline);
  const reactionText = c.exportText();
  h.pointer('pointermove'); h.pointer('pointerleave');
  assert.equal(c.exportText(), reactionText, 'live pointer cannot replace a deliberate still pose');
  assert.deepEqual(c.guide(100, -100), { kind: 'poster', poster: 'attention' });
  assert.equal(c.getSnapshot().displayed.headYawDeg, baseline.config.headYawLimitDeg);
  assert.equal(c.getSnapshot().displayed.headPitchDeg, -baseline.config.headPitchLimitDeg);
  assert.deepEqual(c.getSnapshot().simulation, baseline);
  assert.equal(h.queue.size, 0);
  c.dispose();
});

test('evidence-led pause correction freezes an in-progress wing stretch exactly', () => {
  const h = browserHarness(); const c = h.mount(); h.intersect(); h.frame(0);
  c.react();
  for (let tick = 1; tick <= 82; tick++) h.frame(tick * STEP);
  const before = c.getSnapshot();
  assert.equal(before.simulation.behavior.kind, 'response');
  assert.equal(before.simulation.behavior.phase, 'stretch');
  assert(before.simulation.leftWing > 0.1);
  const text = c.exportText();
  c.setPaused(true);
  assert.deepEqual(c.getSnapshot().displayed, before.displayed);
  assert.equal(c.exportText(), text);
  assert.equal(c.getStatus().displayedPoster, 'frozen');
  h.pointer('pointerleave'); h.pointer('pointermove');
  assert.equal(c.exportText(), text);
  assert.equal(h.queue.size, 0);
  c.setPaused(false); h.frame(10000);
  assert.equal(c.getStatus().tick, before.simulation.tick);
  assert.equal(c.exportText(), text);
  h.frame(10000 + STEP);
  assert.equal(c.getStatus().tick, before.simulation.tick + 1);
  c.dispose();
});

test('suspension clears stale inputs and the first resumed tick clears old attention', () => {
  const h = browserHarness(); const c = h.mount(); h.intersect(); h.frame(0);
  c.guide(0.8, 0.2); h.frame(STEP);
  assert.equal(c.getSnapshot().simulation.attention.active, true);
  c.guide(-0.9, -0.4); c.react();
  c.setPaused(true);
  assert.equal(c.getStatus().queuedInputs, 0);
  const frozenTick = c.getStatus().tick;
  c.setPaused(false); h.frame(1000); h.frame(1000 + STEP);
  assert.equal(c.getStatus().tick, frozenTick + 1);
  assert.equal(c.getSnapshot().simulation.attention.active, false);
  assert.notEqual(c.getSnapshot().simulation.behavior.kind, 'response');
  c.setPaused(true); c.setPaused(false);
  c.guide(-0.5, 0.4);
  h.frame(2000); h.frame(2000 + STEP);
  assert.equal(c.getSnapshot().simulation.attention.x, -0.5, 'new attention replaces the cleared stale target');
  c.dispose();
});

test('pointer cancellation clears attention; no background pointerdown starts a reaction', () => {
  const h = browserHarness(); const c = h.mount(); h.intersect(); h.frame(0);
  h.pointer('pointermove'); h.frame(STEP);
  assert.equal(c.getSnapshot().simulation.attention.active, true);
  h.pointer('pointercancel'); h.pointer('pointerdown'); h.frame(STEP * 2);
  assert.equal(c.getSnapshot().simulation.attention.active, false);
  assert.notEqual(c.getSnapshot().simulation.behavior.kind, 'response');
  c.dispose();
});

test('malformed options and static controls fail atomically', () => {
  const h = browserHarness(); const c = h.mount({ paused: true }); h.intersect();
  const before = c.getSnapshot();
  for (const action of [() => c.update({ headYawLimitDeg: NaN }), () => c.update({ unknown: 1 }),
    () => c.reset(-1), () => c.guide(Infinity, 0), () => c.setGrid({ cols: 1, rows: 1 }),
    () => c.setGrid({ cellAspect: 0.7 }), () => c.setPaused('yes')]) {
    assert.throws(action);
    assert.deepEqual(c.getSnapshot(), before);
  }
  c.update({ headYawLimitDeg: 20 }); c.reset(9);
  assert.equal(c.getStatus().paused, true);
  assert.equal(c.getSnapshot().simulation.config.seed, 9);
  assert.equal(c.getSnapshot().simulation.config.headYawLimitDeg, 20);
  c.dispose();
  assert.throws(() => h.mount({ paused: 'true' }), /boolean/);
  assert.throws(() => h.mount({ unexpected: true }), /Unknown/);
  assert.equal(h.resourceCount, 0);
});

test('small hosts remain static and scale a usable poster; explicit detail is validated', () => {
  const h = browserHarness(); h.host.rect.width = 320; h.host.rect.height = 300;
  const c = h.mount(); h.intersect();
  assert.deepEqual(c.getStatus().blockedBy, ['small-container']);
  assert.equal(c.getStatus().cols, 64);
  assert.equal(c.react().kind, 'poster');
  assert.equal(h.queue.size, 0);
  c.setGrid({ cols: 128, rows: 72 });
  assert.equal(c.exportText().split('\n').length, 72);
  assert(c.exportText().split('\n').every(row => row.length === 128));
  h.resize(960, 540);
  assert.equal(c.getStatus().running, true);
  assert.equal(c.getStatus().cols, 128);
  c.dispose();
});

test('disposal is idempotent, late callbacks do nothing, all other actions reject', () => {
  const h = browserHarness(); const c = h.mount(); h.intersect();
  const callback = [...h.queue.values()][0];
  const observerCallbacks = h.allObservers.map(observer => observer.callback);
  const pre = h.host.children[0].children[0];
  const text = pre.textContent;
  c.dispose(); c.dispose();
  callback(1000);
  for (const callback of observerCallbacks) callback([{ target: h.host, isIntersecting: true, intersectionRatio: 1 }]);
  assert.equal(pre.textContent, text);
  assert.equal(h.host.children.length, 0);
  assert.equal(h.resourceCount, 0);
  assert.equal(c.getStatus().disposed, true);
  for (const action of [() => c.setPaused(false), () => c.react(), () => c.guide(0, 0), () => c.leave(),
    () => c.reset(), () => c.update({}), () => c.setGrid({}), () => c.getSnapshot(), () => c.exportText()]) assert.throws(action, /disposed/);
});

test('setup and status-callback failures roll back all acquired host resources', () => {
  const h = browserHarness();
  assert.throws(() => h.mount({ onStatus() { throw new Error('consumer failure'); } }), /consumer failure/);
  assert.equal(h.resourceCount, 0);
  assert.equal(h.host.children.length, 0);
  const Base = h.environment.ResizeObserver;
  class BrokenObserver extends Base { observe() { throw new Error('observe failure'); } }
  assert.throws(() => h.mount({ environment: { ...h.environment, ResizeObserver: BrokenObserver } }), /observe failure/);
  assert.equal(h.resourceCount, 0);
  assert.equal(h.host.children.length, 0);
});

test('injected shared scheduler loses only this instance subscription', () => {
  const h = browserHarness(); const callbacks = new Set(); let disposeCalls = 0;
  const scheduler = { subscribe(callback) { callbacks.add(callback); return () => callbacks.delete(callback); }, dispose() { disposeCalls++; } };
  const a = h.mount({ frameSource: scheduler });
  const otherHost = new h.Element();
  const b = mountOwl(otherHost, { environment: h.environment, frameSource: scheduler });
  h.intersect();
  assert.equal(callbacks.size, 2);
  assert.equal(h.queue.size, 0);
  a.dispose();
  assert.equal(callbacks.size, 1);
  for (const callback of callbacks) callback(0);
  for (const callback of callbacks) callback(STEP);
  assert.equal(b.getStatus().tick, 1);
  b.dispose();
  assert.equal(callbacks.size, 0);
  assert.equal(disposeCalls, 0);
  assert.equal(otherHost.listenerCount, 0);
  assert.equal(h.resourceCount, 0);
});

test('merged shared scheduler drives two Owls and stops only at zero subscribers', () => {
  const h = browserHarness();
  // Execute the actual merged scheduler; only its host RAF is simulated.
  const scheduler = createScheduler({
    requestFrame: h.environment.requestFrame,
    cancelFrame: h.environment.cancelFrame,
  });
  const a = h.mount({ frameSource: scheduler });
  const otherHost = new h.Element();
  const b = mountOwl(otherHost, { environment: h.environment, frameSource: scheduler });
  h.intersect();
  assert.equal(scheduler.size, 2);
  assert.equal(h.queue.size, 1, 'two Owl subscriptions share one host RAF');
  h.frame(0); h.frame(STEP);
  assert.equal(a.getStatus().tick, 1);
  assert.equal(b.getStatus().tick, 1);

  a.setPaused(true);
  assert.equal(scheduler.size, 1, 'pausing removes only that Owl subscription');
  assert.equal(h.queue.size, 1);
  h.frame(STEP * 2);
  assert.equal(a.getStatus().tick, 1);
  assert.equal(b.getStatus().tick, 2, 'the other Owl still receives frames');
  a.setPaused(false);
  assert.equal(scheduler.size, 2);
  assert.equal(h.queue.size, 1);
  a.dispose();
  assert.equal(scheduler.size, 1, 'disposal leaves the other subscriber owned and live');
  h.frame(STEP * 3);
  assert.equal(b.getStatus().tick, 3);

  b.setPaused(true);
  assert.equal(scheduler.size, 0);
  assert.equal(h.queue.size, 0, 'the real scheduler cancels RAF when its last subscriber pauses');
  b.setPaused(false);
  assert.equal(scheduler.size, 1);
  assert.equal(h.queue.size, 1);
  h.frame(10000); h.frame(10000 + STEP);
  assert.equal(b.getStatus().tick, 4, 'resuming does not catch up the suspended interval');
  b.dispose();
  assert.equal(scheduler.size, 0);
  assert.equal(h.queue.size, 0, 'the last disposal cancels the shared host RAF');
  assert.equal(otherHost.listenerCount, 0);
  assert.equal(h.resourceCount, 0);

  // The host still owns the scheduler: an unrelated future subscriber works.
  let called = 0;
  const remove = scheduler.subscribe(() => { called++; });
  h.frame(20000);
  assert.equal(called, 1);
  remove();
  assert.equal(h.queue.size, 0);
  scheduler.dispose();
});

test('missing optional APIs have static or window-event fallbacks and clean up', () => {
  const h = browserHarness();
  const c = h.mount({ environment: { ...h.environment, matchMedia: null, ResizeObserver: null, IntersectionObserver: null, requestFrame: null } });
  assert.deepEqual(c.getStatus().blockedBy, ['animation-unavailable', 'motion-preference-unavailable']);
  assert.equal(c.guide(1, 0).kind, 'poster');
  assert.equal(h.view.listenerCount, 2);
  c.dispose(); assert.equal(h.resourceCount, 0);
});

test('invalid frame time disposes and prevents an unowned animation loop', () => {
  const h = browserHarness(); const c = h.mount(); h.intersect();
  assert.throws(() => h.frame(NaN), /timestamp/);
  assert.equal(c.getStatus().disposed, true);
  assert.equal(h.resourceCount, 0);
});
