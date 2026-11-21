// Span-aware simulated DOM/observers with real core, variant and shared scheduler.
// These checks prove text/input/resource contracts, not browser paint or device speed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountOwl } from '../build/browser.js';
import { createLanternWardenArtwork } from '../build/variants/lantern-warden/index.js';
import { createScheduler } from '../../../src/core/scheduler.js';

const STEP = 1000 / 60;
class TrackedTarget extends EventTarget {
  listeners = new Map();
  addEventListener(type, callback, options) {
    super.addEventListener(type, callback, options);
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback, options) {
    super.removeEventListener(type, callback, options);
    this.listeners.get(type)?.delete(callback);
  }
  get listenerCount() { return [...this.listeners.values()].reduce((n, set) => n + set.size, 0); }
}

function harness() {
  const queue = new Map(), elements = [], observers = { resize: new Set(), intersection: new Set() };
  let nextFrame = 1, time = 0;
  const view = new TrackedTarget(), doc = new TrackedTarget(), media = new TrackedTarget();
  view.innerWidth = 390; view.innerHeight = 844;
  view.requestAnimationFrame = callback => { const id = nextFrame++; queue.set(id, callback); return id; };
  view.cancelAnimationFrame = id => queue.delete(id);
  view.matchMedia = () => media;
  doc.defaultView = view; doc.hidden = false; media.matches = false;
  class Element extends TrackedTarget {
    children = []; parentNode = null; ownerDocument = doc; style = {}; attributes = new Map(); ownText = '';
    rect = { left: 10, top: 10, width: 326, height: 470 };
    constructor(tag = 'div') { super(); this.tagName = tag.toUpperCase(); elements.push(this); }
    get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { for (const child of this.children) child.parentNode = null; this.children = []; this.ownText = String(value); }
    set innerHTML(_value) { throw new Error('ASCII must be written as text, not HTML'); }
    appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; }
    replaceChildren(...children) { this.textContent = ''; for (const child of children) this.appendChild(child); }
    remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    focus() { doc.activeElement = this; }
    getBoundingClientRect() { const r = this.rect; return { ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height }; }
  }
  doc.createElement = tag => new Element(tag);
  class ResizeObserver {
    constructor(callback) { this.callback = callback; observers.resize.add(this); }
    observe(target) { this.target = target; }
    disconnect() { observers.resize.delete(this); }
  }
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; observers.intersection.add(this); }
    observe(target) { this.target = target; }
    disconnect() { observers.intersection.delete(this); }
  }
  const environment = { document: doc, requestFrame: view.requestAnimationFrame, cancelFrame: view.cancelAnimationFrame,
    matchMedia: () => media, ResizeObserver, IntersectionObserver };
  const scheduler = createScheduler({ requestFrame: view.requestAnimationFrame, cancelFrame: view.cancelAnimationFrame });
  const host = new Element();
  const frame = timestamp => { const callbacks = [...queue.values()]; queue.clear(); for (const callback of callbacks) callback(timestamp); };
  return { host, doc, media, queue, scheduler, environment, Element, observers,
    mount(factory = createLanternWardenArtwork, options = {}) { return factory(host, { environment, frameSource: scheduler, ...options }); },
    start() { frame(time); },
    step(count = 1) { for (let n = 0; n < count; n++) { time += STEP; frame(time); } },
    jump(ms) { time += ms; frame(time); },
    intersect(value = true) { for (const observer of [...observers.intersection]) observer.callback([{ target: observer.target, isIntersecting: value, intersectionRatio: value ? 1 : 0 }]); },
    resize(width, height) { host.rect.width = width; host.rect.height = height; for (const observer of [...observers.resize]) observer.callback([{ target: host }]); },
    hidden(value) { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); },
    reduced(value) { media.matches = value; media.dispatchEvent(new Event('change')); },
    key(key, extra = {}, target = host) {
      const event = new Event('keydown', { cancelable: true });
      Object.assign(event, { key, ...extra });
      if (target !== host) Object.defineProperty(event, 'target', { value: target });
      host.dispatchEvent(event); return event;
    },
    touch(type, x = 210, y = 200, pointerId = 11) {
      const event = new Event(type, { cancelable: true });
      Object.assign(event, { pointerType: 'touch', pointerId, button: 0, clientX: x, clientY: y });
      host.dispatchEvent(event); assert.equal(event.defaultPrevented, false, 'artwork must not trap touch scrolling');
    },
    get pre() { return host.children[0]?.children[0]; },
    get resourceCount() { return queue.size + scheduler.size + observers.resize.size + observers.intersection.size
      + view.listenerCount + doc.listenerCount + media.listenerCount + elements.reduce((n, element) => n + element.listenerCount, 0); },
  };
}

function assertStyled(pre, controller) {
  assert.equal(pre.getAttribute('role'), 'img');
  assert.equal(pre.textContent, controller.exportText());
  assert.match(pre.textContent, /^[\x20-\x7e\n]+$/);
  assert(pre.children.length > 1, 'exercise real color-span branch, not the plain mock fallback');
  assert(pre.children.every(child => child.tagName === 'SPAN' && child.textContent.length > 0));
  assert(pre.children.every(child => /^var\(--owl-[a-z]+, #[0-9a-f]{6}\)$/.test(child.style.color)));
  assert(pre.children.length <= pre.textContent.replace(/\s/g, '').length + 1);
}

test('Original → private variant → Original uses one renderer lifecycle and preserves Original output', () => {
  const h = harness();
  let current;
  const select = factory => {
    current?.dispose();
    assert.equal(h.host.children.length, 0); assert.equal(h.scheduler.size, 0);
    current = h.mount(factory); h.intersect();
    assert.equal(h.host.children.length, 1); assert.equal(h.scheduler.size, 1); assert.equal(h.queue.size, 1);
    return current;
  };
  const original = select(mountOwl), originalText = original.exportText();
  assert.equal(original.getDirectorSnapshot(), null);
  assert.equal(h.host.getAttribute('tabindex'), null);
  h.start(); h.step();
  const variant = select(createLanternWardenArtwork);
  assert.equal(variant.species, 'owl'); assert.equal(variant.variation, 'lantern-warden');
  assert.equal(variant.getDirectorSnapshot().config.count, 1);
  assert.equal(variant.getDirectorSnapshot().config.autonomous, false);
  assert.equal(h.host.getAttribute('tabindex'), '0');
  assert.notEqual(variant.exportText(), originalText);
  assertStyled(h.pre, variant);
  h.start(); variant.guide(.85, -.75); variant.cue({ kind: 'flight' }); h.step(125);
  assert(variant.getSnapshot().displayed.presentation.airborne > .9);
  const restored = select(mountOwl);
  assert.equal(restored.exportText(), originalText);
  assert.equal(restored.getDirectorSnapshot(), null);
  assert.equal(h.host.getAttribute('tabindex'), null);
  restored.dispose(); restored.dispose(); assert.equal(h.resourceCount, 0);
  // Borrowed scheduler remains usable after both implementations release it.
  let calls = 0; const unsubscribe = h.scheduler.subscribe(() => calls++);
  h.step(); assert.equal(calls, 1); unsubscribe(); h.scheduler.dispose();
  assert.equal(h.resourceCount, 0);
});

test('private mobile duet reuses colored spans while preserving exact text throughout flight', () => {
  const h = harness(); h.resize(326, 844);
  const c = h.mount(createLanternWardenArtwork, { director: { count: 2, autonomous: false, alertness: 1 } });
  h.intersect(); h.start();
  assert.equal(c.getStatus().cols, 80); assert.equal(c.getStatus().rows, 90);
  assert.equal(c.getSnapshot().grid.layout, 'stacked');
  const pre = h.pre;
  c.cue({ kind: 'flight', target: 1, x: .9, y: -.8 });
  let previous = [...pre.children]; const counts = new Set();
  for (let tick = 1; tick <= 361; tick++) {
    h.step(); assertStyled(pre, c); counts.add(pre.children.length);
    for (let i = 0; i < Math.min(previous.length, pre.children.length); i++) assert.equal(pre.children[i], previous[i]);
    previous = [...pre.children];
    assert.equal(h.scheduler.size, 1, 'duet is one artwork subscription');
  }
  assert(counts.size > 1); assert(c.getStatus().tick >= 360);
  c.dispose(); assert.equal(h.resourceCount, 0); h.scheduler.dispose();
});

test('private keyboard keeps diagonal aim, ignores child/modifier input and centres on release', () => {
  const h = harness(), c = h.mount(); h.host.focus(); h.intersect(); h.start();
  assert.equal(h.key('ArrowRight').defaultPrevented, true);
  assert.equal(h.key('ArrowUp').defaultPrevented, true);
  assert.throws(() => c.guide(Infinity, 0));
  h.key('F', { shiftKey: true }); h.step();
  const flight = c.getDirectorSnapshot().cue;
  assert.equal(flight.kind, 'flight'); assert.equal(flight.x, .85); assert.equal(flight.y, -.75);
  const child = new h.Element('button');
  for (const extra of [{ repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }])
    assert.equal(h.key('ArrowLeft', extra).defaultPrevented, false);
  assert.equal(h.key('f', {}, child).defaultPrevented, false);
  assert.equal(h.key('Tab').defaultPrevented, false);
  assert.equal(c.getStatus().queuedInputs, 0);
  for (const [key, kind] of [['C', 'call'], ['S', 'stretch']]) {
    c.reset(); h.start(); h.key(key, { shiftKey: true }); h.step();
    assert.equal(c.getDirectorSnapshot().cue.kind, kind);
  }
  c.reset(); h.start(); h.key('Escape'); h.key('Enter'); h.step();
  assert.equal(c.getDirectorSnapshot().cue.kind, 'rustle');
  assert.equal(c.getDirectorSnapshot().cue.x, 0); assert.equal(c.getDirectorSnapshot().cue.y, 0);
  h.key(' '); assert.equal(c.getStatus().paused, true); assert.equal(h.scheduler.size, 0);
  c.dispose(); assert.equal(h.resourceCount, 0); h.scheduler.dispose();
});

test('private touch listens only after stationary release; scrolling and cancellation never rustle', () => {
  for (const scenario of ['tap', 'scroll', 'return-after-scroll', 'pointercancel', 'other-contact']) {
    const h = harness(), c = h.mount(); h.intersect(); h.start();
    h.touch('pointerdown'); assert.equal(c.getStatus().queuedInputs, 0);
    if (scenario === 'tap') { h.touch('pointermove', 213, 203); h.touch('pointerup', 213, 203); }
    else if (scenario.includes('scroll')) {
      h.touch('pointermove', 210, 235);
      if (scenario === 'return-after-scroll') h.touch('pointermove');
      h.touch('pointerup', 210, scenario === 'scroll' ? 235 : 200);
    } else if (scenario === 'pointercancel') { h.touch('pointercancel'); h.touch('pointerup'); }
    else h.touch('pointerup', 210, 200, 22);
    h.step();
    if (scenario === 'tap') assert.equal(c.getDirectorSnapshot().cue.kind, 'rustle');
    else assert.equal(c.getDirectorSnapshot().cue, null, `${scenario} must not become a cue`);
    c.dispose(); assert.equal(h.resourceCount, 0); h.scheduler.dispose();
  }
});

test('private pause/reduced/visibility/size blockers compose and offscreen time is never caught up', () => {
  const h = harness(), c = h.mount();
  assert.deepEqual(c.getStatus().blockedBy, ['offscreen']); assert.equal(h.scheduler.size, 0);
  h.intersect(); h.start(); c.cue({ kind: 'flight', x: .8, y: -.7 }); h.step(120);
  const state = c.getDirectorSnapshot(), text = c.exportText();
  c.pause(); h.reduced(true); h.hidden(true); h.intersect(false); h.resize(0, 0);
  assert.equal(h.scheduler.size, 0); assert.equal(h.queue.size, 0);
  h.jump(60000);
  assert.equal(c.getDirectorSnapshot(), state); assert.equal(c.exportText(), text);
  assert.equal(c.cue({ kind: 'flight' }).kind, 'poster');
  for (const key of ['airborne', 'lift', 'travel']) assert.equal(c.getSnapshot().displayed.presentation[key], 0);
  assert.equal(c.getDirectorSnapshot(), state);
  c.play(); assert.equal(c.getStatus().running, false);
  h.hidden(false); h.intersect(); h.resize(326, 470);
  assert.deepEqual(c.getStatus().blockedBy, ['reduced-motion']);
  c.restart(); assert.equal(c.getStatus().paused, false); assert.equal(c.getStatus().tick, 0);
  assert.equal(h.scheduler.size, 0);
  h.reduced(false); h.start(); h.step();
  assert.equal(c.getStatus().tick, 1); assert.equal(c.getStatus().cols, 64); assert.equal(c.getStatus().rows, 36);
  h.resize(319, 470); assert(c.getStatus().blockedBy.includes('small-container')); assert.equal(h.queue.size, 0);
  h.resize(326, 470); h.start(); h.jump(1000);
  assert.equal(c.getStatus().tick, 6, 'catch-up is capped at five explicit ticks');
  assert(c.getStatus().droppedMs > 900);
  c.dispose(); assert.equal(h.resourceCount, 0); h.scheduler.dispose();
});

test('private wrapper releases keyboard and owned tabindex when the underlying host self-disposes', () => {
  const h = harness(); let fail = false;
  const c = h.mount(createLanternWardenArtwork, { onStatus() { if (fail) throw new Error('consumer status failure'); } });
  h.intersect(); h.start(); h.step();
  assert.equal(h.host.getAttribute('tabindex'), '0');
  fail = true;
  assert.throws(() => c.pause(), /consumer status failure/);
  assert.equal(c.getStatus().disposed, true);
  assert.equal(h.host.getAttribute('tabindex'), null);
  assert.equal(h.host.children.length, 0); assert.equal(h.resourceCount, 0);
  c.dispose(); h.scheduler.dispose();
});

test('private tabindex cleanup respects caller ownership and setup failures leave no resources', () => {
  for (const scenario of ['existing', 'changed', 'owned']) {
    const h = harness();
    if (scenario === 'existing') h.host.setAttribute('tabindex', '4');
    const c = h.mount();
    if (scenario === 'changed') h.host.setAttribute('tabindex', '7');
    c.dispose();
    assert.equal(h.host.getAttribute('tabindex'), scenario === 'existing' ? '4' : scenario === 'changed' ? '7' : null);
    assert.equal(h.resourceCount, 0); h.scheduler.dispose();
  }
  const h = harness();
  assert.throws(() => h.mount(createLanternWardenArtwork, { paused: 'yes' }), /boolean/);
  assert.equal(h.host.getAttribute('tabindex'), null); assert.equal(h.resourceCount, 0);
  assert.throws(() => h.mount(createLanternWardenArtwork, { onStatus() { throw new Error('setup failure'); } }), /setup failure/);
  assert.equal(h.host.getAttribute('tabindex'), null); assert.equal(h.resourceCount, 0);
  h.scheduler.dispose();
});
