import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fakeBrowser } from '../../../../test/helpers/fake-browser.mjs';
import { createOctopusTrickster } from '../browser.mjs';
import { createOctopusState } from '../core.mjs';
import { rasterizeOctopus } from '../render.mjs';

// Resource and input bookkeeping tests against the actual core and renderer.
// This fake DOM is not pixel, trusted-touch, or real-device performance evidence.
function mount(options = {}, config = {}) {
  const host = config.host || fakeBrowser(config);
  const canvas = host.canvas(config.width || 390, config.height || 460);
  const artwork = createOctopusTrickster(canvas, options);
  return { host, canvas, artwork };
}

function emitPoint(canvas, type, x, y, patch = {}) {
  const r = canvas.rect, scale = Math.min(r.width * .44, r.height * .48);
  canvas.emit(type, { target: canvas, button: 0, pointerType: 'mouse',
    clientX: r.left + r.width * .5 + x * scale,
    clientY: r.top + r.height * .49 + y * scale, ...patch });
}

function resized(host, canvas) {
  for (const observer of host.resizes) if (observer.target === canvas) observer.callback([{ target: canvas }]);
}

function key(canvas, value, patch = {}) {
  const event = { target: canvas, key: value, prevented: false,
    preventDefault() { this.prevented = true; }, ...patch };
  canvas.emit('keydown', event); return event;
}

test('isolated browser module imports without DOM globals or scheduling side effects', () => {
  const moduleURL = new URL('../browser.mjs', import.meta.url).href;
  const result = execFileSync(process.execPath, ['--input-type=module', '-e',
    `await import(${JSON.stringify(moduleURL)}); console.log(typeof window, typeof document);`], { encoding: 'utf8' });
  assert.equal(result.trim(), 'undefined undefined');
});

test('manual replay accepts next-tick input and matches 1/2/5-tick rendering groups', () => {
  const results = [];
  for (const grouping of [1, 2, 5]) {
    const { artwork: a, host } = mount({ autoStart: false, reducedMotion: 'ignore' });
    assert.equal(host.pending, 0);
    a.invite(.7, .33);
    assert.equal(a.getStats().tick, 0);
    for (let tick = 0; tick < 120; tick += grouping) a.advance(grouping / 60);
    const stats = a.getStats();
    assert.equal(stats.tick, 120);
    assert.equal(stats.stage, 'contact');
    assert.equal(stats.pose.contact.active, true);
    assert.equal(stats.pose.contact.x, .7);
    results.push(JSON.stringify(stats.pose));
    a.destroy();
  }
  assert.equal(results[0], results[1]); assert.equal(results[1], results[2]);
});

test('automatic stepping drops excess wall time after at most five catch-up ticks', () => {
  const { artwork: a, host } = mount();
  assert.equal(host.pending, 1);
  host.frame();
  host.frame(5000);
  assert.equal(a.getStats().tick, 5);
  assert(a.getStats().droppedSeconds >= 4.9);
  assert.equal(host.pending, 1);
  a.destroy(); assert.equal(host.pending, 0);
});

test('reduced motion and user pause survive inputs, restart, options and visibility changes', () => {
  const { artwork: a, host, canvas } = mount({}, { reducedMotion: true });
  assert.equal(a.paused, true); assert.equal(host.pending, 0);
  assert.equal(a.invite(.7, .3), false); assert.equal(a.pulse(-.6, 0), false);
  emitPoint(canvas, 'pointermove', .7, .33);
  emitPoint(canvas, 'pointerdown', .8, -.6, { pointerType: 'touch' });
  key(canvas, 'Enter'); key(canvas, 'j');
  a.advance(1); assert.equal(a.getStats().tick, 0);
  a.restart(); a.setOptions({ seed: 18 });
  host.hide(true); host.hide(false); host.intersect(canvas, false); host.intersect(canvas, true);
  assert.equal(a.paused, true); assert.equal(host.pending, 0);
  a.setPaused(false); assert.equal(a.paused, false); assert.equal(host.pending, 1);
  host.frame(); host.frame(17); assert.equal(a.getStats().tick, 1);
  host.setReduced(true); assert.equal(host.pending, 0);
  host.setReduced(false); assert.equal(a.paused, true); assert.equal(host.pending, 0);
  a.setOptions({ paused: false, reducedMotion: 'ignore' });
  assert.equal(a.paused, true, 'options must not clear an existing preference hold');
  a.setPaused(false); a.setPaused(true); a.restart();
  assert.equal(a.paused, true); assert.equal(host.pending, 0);
  a.destroy();
});

test('hidden, offscreen and zero-size causes cancel RAF independently and resume without time jumps', () => {
  const { artwork: a, host, canvas } = mount();
  host.frame(); host.frame(17); const tick = a.getStats().tick;
  host.hide(true); assert.equal(host.pending, 0);
  host.frame(120000); assert.equal(a.getStats().tick, tick);
  host.intersect(canvas, false); host.hide(false);
  assert.equal(host.pending, 0, 'clearing hidden does not clear offscreen');
  host.intersect(canvas, true); assert.equal(host.pending, 1);
  host.frame(10000); assert.equal(a.getStats().tick, tick, 'first resumed callback resets wall clock');
  host.frame(17); assert.equal(a.getStats().tick, tick + 1);
  canvas.rect.width = 0; resized(host, canvas); assert.equal(host.pending, 0);
  const emptyTick = a.getStats().tick; a.advance(2); assert.equal(a.getStats().tick, emptyTick);
  a.setPaused(true); canvas.rect.width = 320; resized(host, canvas);
  assert.equal(host.pending, 0); assert.equal(a.paused, true);
  a.setPaused(false); assert.equal(host.pending, 1);
  a.destroy();
});

test('resizing allocates bounded backing pixels and never advances state', () => {
  const { artwork: a, host, canvas } = mount({ autoStart: false }, { dpr: 3, width: 1440, height: 900 });
  assert.equal(a.getStats().dpr, 2);
  assert.equal(canvas.width, 2880); assert.equal(canvas.height, 1800);
  a.invite(-.7, .3); a.advance(1);
  const pose = JSON.stringify(a.getStats().pose);
  canvas.rect.width = 390; canvas.rect.height = 460;
  resized(host, canvas); a.render(); a.render();
  assert.equal(JSON.stringify(a.getStats().pose), pose);
  canvas.rect.width = 20000; canvas.rect.height = 20000; resized(host, canvas);
  assert(canvas.width * canvas.height <= 8_294_400);
  assert(a.getStats().cellCount <= 4096);
  a.destroy();
});

test('touch input uses CSS coordinates and actual visible owner cells', () => {
  const { artwork: a, canvas } = mount({ autoStart: false }, { dpr: 2 });
  canvas.rect.left = 83; canvas.rect.top = 47;
  const grid = rasterizeOctopus(createOctopusState(17), { width: 390, height: 460 });
  assert.equal(grid.hitTest(.8, -.6), false);
  emitPoint(canvas, 'pointerdown', .8, -.6, { pointerType: 'touch' });
  a.advance(1 / 60); assert.equal(a.getStats().stage, 'notice');
  assert(Math.abs(a.getStats().pose.target.x - .8) < 1e-12);
  a.restart();
  const n = grid.owners.findIndex(value => value === 1);
  assert(n >= 0);
  const col = n % grid.cols, row = Math.floor(n / grid.cols);
  const x = ((col + .5) * grid.cellW - grid.cx) / grid.scale;
  const y = ((row + .5) * grid.cellH - grid.cy) / grid.scale;
  emitPoint(canvas, 'pointerdown', x, y, { pointerType: 'touch' });
  a.advance(1 / 60); assert.equal(a.getStats().stage, 'gather');
  a.destroy();
});

test('focused keyboard controls preserve Tab and modified shortcuts and pause never resumes on input', () => {
  const { artwork: a, canvas } = mount({ autoStart: false });
  assert.equal(key(canvas, 'Tab').prevented, false);
  assert.equal(key(canvas, 'j', { ctrlKey: true }).prevented, false);
  key(canvas, 'Enter', { target: {} }); assert.equal(a.getStats().queuedEvents, 0);
  assert.equal(key(canvas, 'ArrowLeft').prevented, true);
  assert.equal(key(canvas, 'Enter').prevented, true);
  a.advance(1 / 60); assert.equal(a.getStats().stage, 'notice');
  key(canvas, ' '); assert.equal(a.paused, true);
  const tick = a.getStats().tick;
  key(canvas, 'j'); key(canvas, 'Enter'); key(canvas, 'ArrowRight'); key(canvas, 'Escape');
  a.advance(1); assert.equal(a.getStats().tick, tick); assert.equal(a.getStats().queuedEvents, 0);
  key(canvas, ' '); assert.equal(a.paused, false);
  key(canvas, 'j'); a.advance(1 / 60); assert.equal(a.getStats().stage, 'gather');
  a.destroy();
});

test('high-rate pointer input is bounded and cancellation releases an active reach', () => {
  const { artwork: a, canvas } = mount({ autoStart: false });
  for (let i = 0; i < 3000; i++) emitPoint(canvas, 'pointermove', .2 + (i % 90) / 100, .3);
  assert(a.getStats().queuedEvents <= 64);
  assert(a.getStats().discardedEvents > 0);
  a.advance(1); assert.equal(a.getStats().stage, 'reach');
  canvas.emit('pointercancel'); a.advance(1 / 60);
  assert.equal(a.getStats().stage, 'recoil');
  a.advance(1.3); assert.equal(a.getStats().stage, 'idle');
  a.destroy();
});

test('invalid inputs and options fail atomically before allocating or changing state', () => {
  const { artwork: a, host } = mount({ autoStart: false });
  const before = JSON.stringify(a.getStats().pose);
  for (const patch of [{ seed: -1 }, { seed: .2 }, { seed: Infinity }, { maxDpr: NaN },
    { paused: 'false' }, { unexpected: true }, { reducedMotion: 'maybe' }]) {
    assert.throws(() => a.setOptions(patch));
    assert.equal(JSON.stringify(a.getStats().pose), before);
  }
  for (const value of [NaN, Infinity, -1, 6, '1']) assert.throws(() => a.advance(value));
  assert.throws(() => a.invite(NaN, .2)); assert.throws(() => a.pulse(.2, Infinity));
  assert.equal(a.getStats().queuedEvents, 0); assert.equal(host.pending, 0);
  a.destroy();
});

test('two instances share one RAF and disposing one cannot remove the sibling subscription', () => {
  const host = fakeBrowser();
  const first = mount({}, { host }), second = mount({}, { host });
  assert.equal(host.pending, 1);
  assert.equal(host.resizes.size, 2); assert.equal(host.intersections.size, 2);
  const staleResize = [...host.resizes].find(observer => observer.target === first.canvas).callback;
  const staleIntersection = [...host.intersections].find(observer => observer.target === first.canvas).callback;
  first.artwork.destroy(); first.artwork.destroy();
  assert.equal(first.canvas.listenerCount, 0);
  assert.equal(host.pending, 1); assert.equal(host.resizes.size, 1); assert.equal(host.intersections.size, 1);
  staleResize(); staleIntersection([{ target: first.canvas, isIntersecting: true }]);
  first.artwork.restart(); first.artwork.render(); first.artwork.advance(1); first.artwork.setPaused(false);
  assert.equal(first.artwork.getStats().destroyed, true);
  host.frame(); host.frame(17); assert.equal(second.artwork.getStats().tick, 1);
  second.artwork.dispose();
  assert.equal(host.pending, 0); assert.equal(host.resizes.size, 0); assert.equal(host.intersections.size, 0);
  assert.equal(host.document.listenerCount, 0); assert.equal(host.view.listenerCount, 0);
  assert.equal(host.motion.listenerCount, 0); assert.equal(second.canvas.listenerCount, 0);
});

test('pagehide preserves bfcache instances and ordinary navigation releases all owned resources', () => {
  const { artwork: a, canvas, host } = mount();
  host.view.emit('pagehide', { persisted: true }); assert.equal(a.getStats().destroyed, false);
  host.frame(); host.frame(17); assert(a.getStats().tick > 0);
  host.view.emit('pagehide', { persisted: false });
  assert.equal(a.getStats().destroyed, true); assert.equal(canvas.listenerCount, 0); assert.equal(host.pending, 0);
});

test('construction failure rolls back observers/listeners without harming an existing instance', () => {
  const host = fakeBrowser();
  const sibling = mount({}, { host });
  const broken = host.canvas(390, 460), ctx = broken.getContext('2d');
  ctx.fillText = () => { throw new Error('test renderer failure'); };
  assert.throws(() => createOctopusTrickster(broken), /test renderer failure/);
  assert.equal(broken.listenerCount, 0);
  assert.equal(host.resizes.size, 1); assert.equal(host.intersections.size, 1); assert.equal(host.pending, 1);
  sibling.artwork.destroy(); assert.equal(host.pending, 0);
});
