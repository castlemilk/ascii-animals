import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisibleActionRunner } from '../visible-action.mjs';

function host() {
  const frames = new Map(), timers = new Map(), observers = new Set(), messages = [];
  let sequence = 0, scrolls = 0;
  const status = { offscreen: false, zeroSize: false, disposed: false, paused: false, reducedMotion: false };
  const rect = { width: 356, height: 300, left: 0, right: 356, top: 0, bottom: 300 };
  const document = { hidden: false };
  const view = { innerWidth: 390, innerHeight: 844,
    requestAnimationFrame(fn) { const id = ++sequence; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(fn) { const id = ++sequence; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    IntersectionObserver: class { constructor(fn) { this.fn = fn; observers.add(this); } observe() {} disconnect() { observers.delete(this); } },
  };
  const canvas = { getBoundingClientRect: () => rect, scrollIntoView(options) { assert.equal(options.behavior, 'auto'); scrolls++; rect.top = 100; rect.bottom = 400; } };
  const controller = { getStatus: () => ({ ...status }) };
  const runner = createVisibleActionRunner({ canvas, controller, view, document, announce: text => messages.push(text) });
  const notify = () => { for (const observer of [...observers]) observer.fn([{ target: canvas, isIntersecting: true }]); };
  const flushFrames = () => { for (const [id, fn] of [...frames]) { frames.delete(id); fn(0); } };
  const expire = () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } };
  return { runner, frames, timers, observers, messages, status, rect, document, notify, flushFrames, expire, get scrolls() { return scrolls; } };
}
function clear(h) { assert.equal(h.frames.size + h.timers.size + h.observers.size, 0); }

test('visible deliberate input runs once without scheduling or scrolling', () => {
  const h = host(); let actions = 0;
  assert.equal(h.runner.run(() => actions++), true); assert.equal(actions, 1); assert.equal(h.scrolls, 0); clear(h);
});
test('offscreen input waits for the controller visibility gate, then runs only once', () => {
  const h = host(); h.status.offscreen = true; h.rect.top = 900; h.rect.bottom = 1200; let actions = 0;
  h.runner.run(() => actions++); assert.equal(actions, 0); assert.equal(h.scrolls, 1);
  assert.equal(h.frames.size, 1); assert.equal(h.timers.size, 1); assert.equal(h.observers.size, 1);
  h.notify(); assert.equal(actions, 0);
  h.status.offscreen = false; h.notify(); assert.equal(actions, 1); clear(h);
  h.notify(); h.flushFrames(); assert.equal(actions, 1);
});
test('replacement and explicit cancellation discard stale callbacks', () => {
  const h = host(); h.status.offscreen = true; let first = 0, second = 0;
  h.runner.run(() => first++); const stale = [...h.observers][0];
  h.runner.run(() => second++); h.status.offscreen = false; stale.fn([{ target: {}, isIntersecting: true }]);
  h.notify(); assert.equal(first, 0); assert.equal(second, 1); clear(h);
  h.status.offscreen = true; h.runner.run(() => first++); h.runner.cancel(); h.status.offscreen = false; h.notify(); assert.equal(first, 0); clear(h);
});
test('hidden, timed-out and disposed requests never fire later', () => {
  for (const reason of ['hidden', 'timeout', 'dispose']) {
    const h = host(); h.status.offscreen = true; let actions = 0;
    h.runner.run(() => actions++);
    if (reason === 'hidden') { h.document.hidden = true; h.notify(); }
    if (reason === 'timeout') h.expire();
    if (reason === 'dispose') { h.runner.dispose(); h.runner.dispose(); }
    h.status.offscreen = false; h.document.hidden = false; h.notify(); h.flushFrames();
    assert.equal(actions, 0); clear(h);
  }
});
test('visibility bridge does not change pause or reduced motion', () => {
  const h = host(); h.status.offscreen = true; h.status.paused = true; h.status.reducedMotion = true;
  let observed;
  h.runner.run(() => { observed = { ...h.status }; }); h.status.offscreen = false; h.notify();
  assert.equal(observed.paused, true); assert.equal(observed.reducedMotion, true); clear(h);
});
test('retry remains bounded while the controller stays suspended', () => {
  const h = host(); h.status.offscreen = true; let actions = 0;
  h.runner.run(() => actions++); h.flushFrames(); h.notify(); h.notify();
  assert.equal(h.frames.size, 0); assert.equal(h.observers.size, 1); assert.equal(h.timers.size, 1);
  h.expire(); assert.equal(actions, 0); assert.equal(h.messages.length, 1); clear(h);
});
