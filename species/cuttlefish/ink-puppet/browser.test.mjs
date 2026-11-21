import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';
import { createInkPuppet } from './browser.mjs';

// These are model/cell/lifecycle tests with a fake Canvas sink, not browser proof.
function mount(options = {}, environment = {}) {
  const host = fakeBrowser(environment), canvas = host.canvas(390, 410);
  const art = createInkPuppet(canvas, options);
  return { host, canvas, art };
}
function assertClean(host, canvas) {
  assert.equal(host.pending, 0);
  assert.equal(canvas.listenerCount + host.document.listenerCount + host.view.listenerCount + host.motion.listenerCount, 0);
  assert.equal(host.resizes.size + host.intersections.size, 0);
}

test('same fixed input and tick log yields the same model and cell output across presentation groups', () => {
  const snapshots = [1, 2, 5, 6].map(group => {
    const { host, canvas, art } = mount({ autoStart: false });
    assert.equal(art.cue({ type: 'investigate', x: -.3, y: -.2 }), true);
    for (let tick = 0; tick < 180; tick += group) art.advance(group / 60);
    const result = { state: art.getState(), glyphs: [...art.grid.glyphs], colors: [...art.grid.colors] };
    art.destroy(); assertClean(host, canvas);
    return result;
  });
  snapshots.slice(1).forEach(value => assert.deepEqual(value, snapshots[0]));
});

test('pause causes compose and an offscreen/hidden resume drops the old clock', () => {
  const { host, canvas, art } = mount();
  host.frame(); host.frame();
  const first = art.getStats().tick;
  assert.ok(first > 0);
  host.intersect(canvas, false);
  assert.equal(host.pending, 0);
  host.frame(60000);
  assert.equal(art.getStats().tick, first);
  art.setPaused(true);
  host.hide(true); host.intersect(canvas, true); host.hide(false);
  assert.equal(host.pending, 0);
  assert.equal(art.paused, true);
  art.setPaused(false);
  host.frame(60000);
  assert.equal(art.getStats().tick, first, 'first resumed frame establishes a new clock');
  host.frame();
  assert.equal(art.getStats().tick, first + 1);
  art.destroy(); assertClean(host, canvas);
});

test('reduced motion cannot be overridden by pointer, restart, visibility or Play', () => {
  const { host, canvas, art } = mount({}, { reducedMotion: true });
  assert.equal(art.paused, true); assert.equal(host.pending, 0);
  canvas.emit('pointermove', { clientX: 200, clientY: 200 });
  art.restart(); art.setPaused(false); host.hide(true); host.hide(false);
  assert.equal(art.getStats().tick, 0); assert.equal(host.pending, 0);
  canvas.emit('pointerdown', { clientX: 270, clientY: 150 });
  assert.equal(art.paused, true); assert.equal(host.pending, 0);
  assert.equal(art.getStats().action, 'investigate');
  assert.ok(art.getStats().tick > 0, 'deliberate static action composes an interesting poster');
  const still = art.getStats().tick;
  host.frame(1000); assert.equal(art.getStats().tick, still);
  host.setReduced(false);
  assert.equal(art.paused, true, 'static action owns an explicit pause');
  assert.equal(host.pending, 0);
  art.destroy(); assertClean(host, canvas);
});

test('live preference change and pointer cancellation do not retain transient interest', () => {
  const { host, canvas, art } = mount();
  canvas.emit('pointermove', { clientX: 300, clientY: 150 });
  assert.equal(art.getState().pointer, true);
  canvas.emit('pointercancel'); assert.equal(art.getState().pointer, false);
  canvas.emit('pointermove', { clientX: 300, clientY: 150 });
  canvas.emit('lostpointercapture'); assert.equal(art.getState().pointer, false);
  host.setReduced(true); assert.equal(host.pending, 0);
  canvas.emit('pointermove', { clientX: 300, clientY: 150 });
  assert.equal(art.getState().pointer, false);
  art.destroy(); assertClean(host, canvas);
});

test('a thousand pointer events coalesce without a thousand rasterizations', () => {
  const { host, canvas, art } = mount();
  let renders = 0;
  const render = art.render.bind(art);
  art.render = () => { renders++; render(); };
  for (let index = 0; index < 1000; index++) {
    canvas.emit('pointermove', { clientX: index % 390, clientY: index % 410 });
  }
  assert.equal(renders, 0, 'input does not request immediate glyph work');
  assert.deepEqual(art.getState().point, { x: 219 / 390 - .5, y: 179 / 410 - .5 });
  host.frame(); host.frame();
  assert.equal(renders, 1, 'one scheduled presentation paints the latest target');
  art.destroy(); assertClean(host, canvas);
});

test('CSS-rectangle touch coordinates select different committed targets at DPR 2', () => {
  const { host, canvas, art } = mount({ autoStart: false }, { dpr: 2 });
  canvas.rect = { width: 390, height: 410, left: 100, top: 200 };
  art.setTool('retreat');
  canvas.emit('pointerdown', { clientX: 100 + 390 * .8, clientY: 200 + 410 * .25, pointerType: 'touch' });
  assert.deepEqual(art.getState().action.target, { x: .30000000000000004, y: -.25 });
  assert.equal(art.getState().action.kind, 'retreat');
  const committed = art.getState().action;
  canvas.emit('pointerdown', { clientX: 105, clientY: 400 });
  assert.deepEqual(art.getState().action, committed, 'rapid taps do not interrupt a gesture');
  art.destroy(); assertClean(host, canvas);
});

test('zero-size suspends work, oversize backing store is bounded, and resize retains pause', () => {
  const { host, canvas, art } = mount();
  art.setPaused(true);
  canvas.rect.width = 0; art.resize();
  assert.equal(host.pending, 0); assert.equal(canvas.width, 0); assert.equal(art.grid, null);
  canvas.rect.width = 10000; canvas.rect.height = 10000; art.resize();
  assert.ok(canvas.width * canvas.height <= 4194304);
  assert.ok(canvas.width <= 4096 && canvas.height <= 4096);
  assert.equal(art.paused, true); assert.equal(host.pending, 0);
  art.destroy(); assertClean(host, canvas);
});

test('a long foreground stall advances at most six ticks and reports dropped wall time', () => {
  const { host, canvas, art } = mount();
  host.frame(); host.frame(10000);
  assert.equal(art.getStats().tick, 6);
  assert.ok(art.getStats().droppedSeconds >= 9.89);
  art.destroy(); assertClean(host, canvas);
});

test('instances share a scheduler without sharing state or teardown', () => {
  const host = fakeBrowser(), left = host.canvas(390, 410), right = host.canvas(390, 410);
  const a = createInkPuppet(left), b = createInkPuppet(right, { seed: 11 });
  assert.equal(host.pending, 1);
  a.cue({ type: 'retreat', x: .2, y: 0 });
  assert.equal(b.getStats().action, null);
  a.destroy(); a.destroy();
  assert.equal(host.pending, 1);
  host.frame(); host.frame();
  assert.equal(b.getStats().tick, 1);
  b.destroy(); assertClean(host, left); assert.equal(right.listenerCount, 0);
});

test('invalid options and still inputs are atomic; destroyed callbacks remain inert', () => {
  const { host, canvas, art } = mount({ autoStart: false });
  const before = art.getState();
  assert.throws(() => art.setOptions({ seed: 12, size: NaN }), RangeError);
  assert.deepEqual(art.getState(), before); assert.equal(art.options.seed, 7);
  assert.throws(() => art.setOptions({ count: 4 }), TypeError);
  assert.throws(() => art.showStill('retreat', Infinity), RangeError);
  assert.equal(art.showStill('retreat', 2, { x: 5, y: 0 }), false);
  assert.equal(art.showStill('retreat', 2, { x: .2, y: 0, type: 'point' }), false);
  let getterRead = false;
  assert.equal(art.showStill('retreat', 2, { get x() { getterRead = true; return .2; }, y: 0 }), false);
  assert.equal(getterRead, false);
  assert.deepEqual(art.getState(), before);
  const handlers = [...canvas.listeners.get('pointerdown')];
  art.destroy();
  handlers.forEach(callback => callback({ clientX: 100, clientY: 100 }));
  art.restart(); art.render(); art.resize(); art.advance(.1);
  assert.equal(art.cue({ type: 'retreat', x: 0, y: 0 }), false);
  assertClean(host, canvas);
});

test('constructor rejects unsupported Canvas before registering resources', () => {
  const host = fakeBrowser(), canvas = host.canvas(); canvas.getContext = () => null;
  assert.throws(() => createInkPuppet(canvas), /Canvas 2D/);
  assertClean(host, canvas);
});
