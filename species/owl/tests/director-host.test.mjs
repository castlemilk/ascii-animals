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

test('director is opt-in and the original host rejects scene-only commands', () => {
  const h = browserHarness(), c = h.mount();
  assert.equal(c.getDirectorSnapshot(), null);
  assert.equal(c.getStatus().director, null);
  assert.equal(c.getSnapshot().director, null);
  assert.throws(() => c.cue({ kind: 'call' }), /director/i);
  assert.throws(() => c.updateDirector({ scene: 'roost' }), /director/i);
  assert.throws(() => c.guide(0, 0, 1), /director/i);
  h.intersect(); h.frame(0); h.frame(STEP);
  assert.equal(c.getSnapshot().simulation.tick, 1);
  c.dispose(); assert.equal(h.resourceCount, 0);
});

test('duet shares the real scheduler with independent artwork ownership', () => {
  const h = browserHarness();
  const scheduler = createScheduler({ requestFrame: h.environment.requestFrame, cancelFrame: h.environment.cancelFrame });
  const a = h.mount({ director: { scene: 'duet' }, frameSource: scheduler });
  const other = new h.Element();
  const b = mountOwl(other, { director: { scene: 'lookout' }, frameSource: scheduler, environment: h.environment });
  h.intersect();
  assert.equal(a.getDirectorSnapshot().actors.length, 2);
  assert.equal(b.getDirectorSnapshot().actors.length, 2);
  assert.equal(scheduler.size, 2, 'one subscription per artwork, not per owl');
  assert.equal(h.queue.size, 1, 'four actors still share one host RAF');
  h.frame(0); h.frame(STEP);
  a.dispose();
  assert.equal(scheduler.size, 1);
  h.frame(STEP * 2);
  assert.equal(b.getDirectorSnapshot().tick, 2);
  b.setPaused(true); assert.equal(scheduler.size, 0); assert.equal(h.queue.size, 0);
  b.dispose(); scheduler.dispose(); assert.equal(h.resourceCount, 0);
});

test('director pause freezes the whole current composition through wing motion', () => {
  const h = browserHarness(), c = h.mount({ director: { autonomous: false } });
  h.intersect(); h.frame(0); c.cue({ kind: 'stretch', target: 0 });
  let tick = 0;
  do { tick++; h.frame(tick * STEP); } while (tick < 350 && c.getSnapshot().displayed.leftWing < .1);
  assert(c.getSnapshot().displayed.leftWing >= .1, 'the directed stretch must become visible');
  const scene = c.getDirectorSnapshot(), displayed = c.getSnapshot().director, text = c.exportText();
  c.setPaused(true);
  assert.deepEqual(c.getSnapshot().director, displayed);
  assert.equal(c.exportText(), text);
  h.pointer('pointermove'); h.pointer('pointerleave');
  assert.equal(c.exportText(), text);
  assert.equal(h.queue.size, 0);
  c.setPaused(false); h.frame(10000);
  assert.equal(c.getDirectorSnapshot(), scene);
  assert.equal(c.exportText(), text);
  h.frame(10000 + STEP);
  assert.equal(c.getDirectorSnapshot().tick, scene.tick + 1);
  c.dispose();
});

test('reduced-motion cues are intentional still scenes and never advance either owl', () => {
  const h = browserHarness(); h.media.matches = true;
  const c = h.mount({ director: { scene: 'duet' } }); h.intersect();
  const simulation = c.getDirectorSnapshot();
  const texts = new Set([c.exportText()]);
  for (const cue of [{ kind: 'rustle', target: 0, x: -.8, y: -.6 }, { kind: 'call', target: 1 }, { kind: 'stretch', target: 0 }]) {
    assert.equal(c.cue(cue).kind, 'poster');
    assert.equal(c.getDirectorSnapshot(), simulation);
    assert.equal(c.getSnapshot().director.poster, true);
    assert.equal(c.getStatus().director, c.getSnapshot().director);
    texts.add(c.exportText());
  }
  assert(texts.size >= 3, 'different explicit scene cues must have visibly different logical output');
  c.guide(.8, -.4, 1);
  const text = c.exportText();
  h.pointer('pointermove'); h.pointer('pointercancel');
  assert.equal(c.exportText(), text, 'ambient pointer motion cannot replace a deliberate still');
  c.setPaused(false); c.reset();
  assert.equal(c.getStatus().running, false); assert.equal(c.getDirectorSnapshot().tick, 0);
  assert.equal(h.queue.size, 0);
  c.dispose();
});

test('director pointer and cue floods remain bounded; cancellation clears pending tap', () => {
  const h = browserHarness(), c = h.mount({ director: { autonomous: false } });
  h.intersect(); h.frame(0);
  for (let i = 0; i < 1500; i++) h.pointer('pointermove', 20 + i % 900, 200);
  for (let i = 0; i < 40; i++) c.cue({ kind: i % 2 ? 'call' : 'rustle', target: i % 2 });
  assert.equal(c.getStatus().queuedInputs, 2);
  h.frame(STEP);
  assert.equal(c.getDirectorSnapshot().lastSequence, 1);
  assert.equal(c.getStatus().queuedInputs, 0);
  h.pointer('pointerdown');
  assert.equal(c.getStatus().queuedInputs, 1);
  h.pointer('pointercancel');
  assert.equal(c.getStatus().queuedInputs, 1, 'only the leave event remains after canceled touch');
  h.frame(STEP * 2);
  assert.equal(c.getStatus().queuedInputs, 0);
  c.dispose();
});

test('pointer ownership follows the actual centered text bounds instead of the outer stage', () => {
  const h = browserHarness(), c = h.mount({ director: { autonomous: false } });
  h.intersect(); h.frame(0);
  const pre = h.host.children[0].children[0];
  pre.rect = { left: 100, top: 70, width: 120, height: 240 };
  const grid = c.getSnapshot().grid;
  const index = grid.owners.findIndex(id => id === 1);
  assert(index >= 0);
  const col = index % grid.cols, row = Math.floor(index / grid.cols);
  const x = pre.rect.left + col / (grid.cols - 1) * pre.rect.width;
  const y = pre.rect.top + row / (grid.rows - 1) * pre.rect.height;
  h.pointer('pointerdown', x, y);
  h.frame(STEP);
  assert.equal(c.getDirectorSnapshot().cue.target, 1, 'visible Ember glyph belongs to Ember even in a large letterbox');
  c.dispose();
});

test('wide and stacked pointers use the selected owl local direction, including tap cues', () => {
  for (const layout of ['wide', 'stacked']) {
    const h = browserHarness();
    if (layout === 'stacked') { h.host.rect.width = 600; h.host.rect.height = 660; }
    const c = h.mount({ director: { autonomous: false } });
    h.intersect(); h.frame(0);
    const pre = h.host.children[0].children[0];
    pre.rect = { left: 100, top: 80, width: 440, height: 520 };
    const grid = c.getSnapshot().grid, rect = grid.actorRects.find(actor => actor.id === 0);
    assert.equal(grid.layout, layout);
    const col = rect.left + .75 * (rect.width - 1);
    const row = rect.top + .75 * (rect.height - 1);
    if (layout === 'wide') assert(col < (grid.cols - 1) / 2, 'point is right of Ash yet left of the whole scene center');
    else assert(row < (grid.rows - 1) / 2, 'point is below Ash yet above the whole scene center');
    const x = pre.rect.left + col / (grid.cols - 1) * pre.rect.width;
    const y = pre.rect.top + row / (grid.rows - 1) * pre.rect.height;
    h.pointer('pointermove', x, y); h.frame(STEP);
    const state = c.getDirectorSnapshot();
    assert.equal(state.pointer.target, 0);
    assert(Math.abs(state.pointer.x - .5) < 1e-9);
    assert(Math.abs(state.pointer.y - .5) < 1e-9);
    assert(state.actors[0].pose.headYawDeg > 0, 'the selected owl looks right');
    assert(state.actors[0].pose.headPitchDeg > 0, 'the selected owl looks down');
    h.pointer('pointerdown', x, y); h.frame(STEP * 2);
    const cue = c.getDirectorSnapshot().cue;
    assert.equal(cue.target, 0);
    assert(Math.abs(cue.x - .5) < 1e-9);
    assert(Math.abs(cue.y - .5) < 1e-9);
    c.dispose();
  }
});

test('explicit guide uses actor-local coordinates and defaults to Ash', () => {
  const h = browserHarness(), c = h.mount({ director: { autonomous: false } });
  h.intersect(); h.frame(0);
  c.guide(.8, .4); h.frame(STEP);
  assert.deepEqual(c.getDirectorSnapshot().pointer, { active: true, target: 0, x: .8, y: .4 });
  c.guide(-.8, -.4, 1); h.frame(STEP * 2);
  assert.deepEqual(c.getDirectorSnapshot().pointer, { active: true, target: 1, x: -.8, y: -.4 });
  c.dispose();
});

test('invalid director updates and cues preserve configuration, frames and pause atomically', () => {
  const h = browserHarness(), c = h.mount({ director: { count: 1 }, grid: { cols: 96, rows: 54 }, paused: true });
  h.intersect();
  const scene = c.getDirectorSnapshot(), text = c.exportText(), frames = c.getStatus().frames;
  for (const action of [() => c.updateDirector({ count: 3 }), () => c.updateDirector({ tempo: NaN }),
    () => c.updateDirector({ roles: ['sentinel', 'wizard'] }), () => c.updateDirector({ unknown: true }),
    () => c.updateDirector({ count: 2 }), () => c.cue({ kind: 'call', target: 1 }),
    () => c.cue({ kind: 'spin' }), () => c.guide(Infinity, 0), () => c.guide(0, 0, 2),
    () => c.setGrid({ cols: 400, rows: 90 })]) assert.throws(action);
  assert.equal(c.getDirectorSnapshot(), scene);
  assert.equal(c.exportText(), text);
  assert.equal(c.getStatus().frames, frames);
  assert.equal(c.getStatus().paused, true);
  c.updateDirector({ scene: 'roost', tempo: .7 });
  assert.equal(c.getDirectorSnapshot().config.scene, 'roost');
  assert.equal(c.getStatus().paused, true);
  c.reset(73);
  assert.equal(c.getDirectorSnapshot().config.scene, 'roost');
  assert.equal(c.getStatus().paused, true);
  assert.equal(c.getSnapshot().simulation.config.seed, 73);
  c.dispose();
});

test('narrow duet uses stacked composition without reducing actor count and handles zero-size suspension', () => {
  const h = browserHarness(), c = h.mount({ director: { count: 2 } });
  h.intersect(); h.frame(0); h.frame(STEP);
  assert.equal(c.getSnapshot().grid.layout, 'wide');
  h.resize(600, 660);
  assert.equal(c.getSnapshot().grid.layout, 'stacked');
  assert.equal(c.getStatus().cols, 80); assert.equal(c.getStatus().rows, 90);
  assert.equal(c.getSnapshot().director.actors.length, 2);
  h.resize(0, 0);
  assert(c.getStatus().blockedBy.includes('zero-size')); assert.equal(h.queue.size, 0);
  const tick = c.getDirectorSnapshot().tick;
  h.resize(600, 660); h.frame(10000); h.frame(10000 + STEP);
  assert.equal(c.getDirectorSnapshot().tick, tick + 1);
  c.dispose();
});

test('director updates retain sparse status, lifecycle policy and late-callback safety', () => {
  const h = browserHarness(), statuses = [];
  const c = h.mount({ director: { autonomous: false }, onStatus: status => statuses.push(status) });
  h.intersect(); h.frame(0);
  for (let tick = 1; tick <= 120; tick++) h.frame(tick * STEP);
  assert(statuses.length < 30, 'status must announce meaning, not every animation frame');
  c.updateDirector({ scene: 'duet', roles: ['curious', 'sentinel'] });
  assert.equal(statuses.at(-1).director.config.scene, 'duet');
  c.setPaused(true); h.hidden(true); h.reduced(true);
  c.reset(); c.update({ featherContrast: .7 });
  assert.deepEqual(c.getStatus().blockedBy, ['paused', 'reduced-motion', 'hidden']);
  const saved = [...h.allObservers];
  c.dispose(); c.dispose();
  for (const observer of saved) observer.callback([{ target: h.host, isIntersecting: true, intersectionRatio: 1 }]);
  assert.equal(h.resourceCount, 0);
  assert.equal(c.getStatus().disposed, true);
  assert.throws(() => c.getDirectorSnapshot(), /disposed/);
  assert.throws(() => c.updateDirector({ scene: 'roost' }), /disposed/);
  assert.throws(() => c.cue({ kind: 'call' }), /disposed/);
});

test('flight freezes in place on pause and reduced motion, with grounded deliberate stills and complete disposal', () => {
  const h = browserHarness(), c = h.mount({ director: { count: 1, autonomous: false } });
  h.intersect(); h.frame(0);
  assert.equal(c.cue({ kind: 'flight' }).kind, 'queued');
  for (let frame = 1; frame <= 125; frame++) h.frame(frame * STEP);
  assert(c.getSnapshot().displayed.presentation.airborne > .9);
  const simulation = c.getDirectorSnapshot(), text = c.exportText();
  c.setPaused(true); h.reduced(true);
  assert.deepEqual(c.getStatus().blockedBy, ['paused', 'reduced-motion']);
  assert.equal(c.getDirectorSnapshot(), simulation);
  assert.equal(c.exportText(), text, 'suspension freezes the complete flight composition');
  assert.equal(h.queue.size, 0);
  h.pointer('pointermove'); h.frame(10000);
  assert.equal(c.exportText(), text);
  assert.equal(c.cue({ kind: 'flight' }).kind, 'poster');
  assert.equal(c.getDirectorSnapshot(), simulation);
  assert.equal(c.getSnapshot().director.poster, true);
  assert.equal(c.getSnapshot().displayed.presentation.airborne, 0);
  assert.equal(c.getSnapshot().displayed.presentation.lift, 0);
  c.reset(); c.setPaused(false);
  assert.equal(c.getDirectorSnapshot().tick, 0);
  assert.equal(c.getStatus().running, false, 'Play/Reset do not override reduced motion');
  assert.equal(h.queue.size, 0);
  h.reduced(false);
  const savedCallbacks = [...h.queue.values()], savedObservers = [...h.allObservers];
  c.dispose(); c.dispose();
  for (const callback of savedCallbacks) callback(20000);
  for (const observer of savedObservers) observer.callback([{ target: h.host, isIntersecting: true, intersectionRatio: 1 }]);
  assert.equal(h.resourceCount, 0);
  assert.equal(h.host.children.length, 0);
  assert.throws(() => c.cue({ kind: 'flight' }), /disposed/);
});

test('a 326px host keeps solo and stacked duet running with their intended minimum grids', () => {
  for (const count of [1, 2]) {
    const h = browserHarness(); h.host.rect.width = 326; h.host.rect.height = count === 1 ? 470 : 844;
    const c = h.mount({ director: { count, autonomous: false } });
    h.intersect(); h.frame(0); h.frame(STEP);
    assert.equal(c.getStatus().running, true);
    assert.equal(c.getDirectorSnapshot().tick, 1);
    assert(!c.getStatus().blockedBy.includes('small-container'));
    assert.equal(c.getStatus().cols, count === 1 ? 64 : 80);
    assert.equal(c.getStatus().rows, count === 1 ? 36 : 90);
    assert.equal(c.getSnapshot().grid.layout, count === 1 ? 'solo' : 'stacked');
    assert.equal(c.getSnapshot().director.actors.length, count);
    h.resize(319, 470); assert(c.getStatus().blockedBy.includes('small-container'));
    h.resize(326, count === 1 ? 470 : 844); assert.equal(c.getStatus().running, true);
    c.dispose(); assert.equal(h.resourceCount, 0);
  }
});

test('touch rustles only after a stationary pointerup and never prevents the pointer default', () => {
  const h = browserHarness(), c = h.mount({ director: { autonomous: false } });
  h.intersect(); h.frame(0);
  const touch = (type, x, y) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerType: 'touch', pointerId: 11, button: 0, clientX: x, clientY: y });
    h.host.dispatchEvent(event); assert.equal(event.defaultPrevented, false);
  };
  touch('pointerdown', 220, 200);
  assert.equal(c.getStatus().queuedInputs, 0, 'contact alone is not a deliberate tap');
  h.frame(STEP); assert.equal(c.getDirectorSnapshot().cue, null);
  touch('pointermove', 225, 203);
  touch('pointerup', 225, 203);
  assert.equal(c.getStatus().queuedInputs, 2, 'one coalesced guide plus the completed tap');
  h.frame(STEP * 2);
  assert.equal(c.getDirectorSnapshot().cue.kind, 'rustle');
  assert.equal(c.getDirectorSnapshot().cue.target, 0);
  c.dispose(); assert.equal(h.resourceCount, 0);
});

test('touch scrolling, cancellation and mismatched contacts do not enqueue a rustle', () => {
  for (const scenario of ['scroll', 'return-after-scroll', 'pointercancel', 'lostpointercapture', 'pointerleave', 'other-contact']) {
    const h = browserHarness(), c = h.mount({ director: { autonomous: false } });
    h.intersect(); h.frame(0);
    const touch = (type, x = 220, y = 200, pointerId = 11) => {
      const event = new Event(type, { cancelable: true });
      Object.assign(event, { pointerType: 'touch', pointerId, button: 0, clientX: x, clientY: y });
      h.host.dispatchEvent(event); assert.equal(event.defaultPrevented, false);
    };
    touch('pointerdown');
    if (scenario.includes('scroll')) {
      touch('pointermove', 220, 235);
      if (scenario === 'return-after-scroll') touch('pointermove');
      touch('pointerup', 220, scenario === 'scroll' ? 235 : 200);
    } else if (scenario === 'other-contact') touch('pointerup', 220, 200, 22);
    else { touch(scenario); touch('pointerup'); }
    h.frame(STEP);
    assert.equal(c.getDirectorSnapshot().cue, null, `${scenario} must not become a tap`);
    c.dispose(); assert.equal(h.resourceCount, 0);
  }
});

test('pause, reset and reduced-motion changes discard an unfinished touch before pointerup', () => {
  for (const interruption of ['pause', 'reset', 'reduced-motion']) {
    const h = browserHarness(), c = h.mount({ director: { count: 1, autonomous: false } });
    h.intersect(); h.frame(0);
    const touch = type => {
      const event = new Event(type, { cancelable: true });
      Object.assign(event, { pointerType: 'touch', pointerId: 11, button: 0, clientX: 220, clientY: 200 });
      h.host.dispatchEvent(event);
    };
    touch('pointerdown');
    if (interruption === 'pause') c.setPaused(true);
    else if (interruption === 'reset') c.reset();
    else h.reduced(true);
    const before = c.exportText();
    touch('pointerup');
    assert.equal(c.getStatus().queuedInputs, 0, `${interruption} must discard contact begun before it`);
    assert.equal(c.exportText(), before, 'a stale release must not select a deliberate still');
    assert.equal(c.getSnapshot().director.poster, false);
    c.setPaused(false); h.reduced(false); h.frame(10000); h.frame(10000 + STEP);
    assert.equal(c.getDirectorSnapshot().cue, null);
    c.dispose(); assert.equal(h.resourceCount, 0);
  }
});

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
