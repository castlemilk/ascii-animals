import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from '../src/core/index.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

test('scheduler shares one frame and removes each subscription independently', () => {
  const host = fakeBrowser(), scheduler = createScheduler({ requestFrame: host.view.requestAnimationFrame, cancelFrame: host.view.cancelAnimationFrame });
  let calls = 0; const callback = () => calls++;
  const one = scheduler.subscribe(callback), two = scheduler.subscribe(callback);
  assert.equal(host.pending, 1); assert.equal(scheduler.size, 2);
  host.frame(); assert.equal(calls, 2); assert.equal(host.pending, 1);
  one(); one(); assert.equal(scheduler.size, 1);
  two(); assert.equal(host.pending, 0);
  scheduler.dispose(); scheduler.dispose();
  assert.throws(() => scheduler.subscribe(callback), /disposed/);
});

test('subscriptions added during dispatch wait until the next frame', () => {
  const host = fakeBrowser(), scheduler = createScheduler({ requestFrame: host.view.requestAnimationFrame, cancelFrame: host.view.cancelAnimationFrame });
  const calls = []; let stopFirst;
  stopFirst = scheduler.subscribe(() => {
    calls.push('first'); stopFirst(); scheduler.subscribe(() => calls.push('new'));
  });
  host.frame(); assert.deepEqual(calls, ['first']);
  host.frame(); assert.deepEqual(calls, ['first', 'new']);
  scheduler.dispose(); assert.equal(host.pending, 0);
});

test('one failing callback does not strand peers or a pending frame', () => {
  const host = fakeBrowser(), errors = [];
  const scheduler = createScheduler({ requestFrame: host.view.requestAnimationFrame, cancelFrame: host.view.cancelAnimationFrame, onError: error => errors.push(error.message) });
  let healthy = 0;
  scheduler.subscribe(() => { throw new Error('intentional'); });
  scheduler.subscribe(() => healthy++);
  host.frame(); assert.deepEqual(errors, ['intentional']); assert.equal(healthy, 1);
  scheduler.dispose(); assert.equal(host.pending, 0);
});

test('a rejected frame request rolls back a new subscription', () => {
  const scheduler = createScheduler({ requestFrame: () => { throw new Error('request failed'); }, cancelFrame() {} });
  assert.throws(() => scheduler.subscribe(() => {}), /request failed/);
  assert.equal(scheduler.size, 0); scheduler.dispose();
});
