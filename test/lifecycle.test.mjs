import test from 'node:test';
import assert from 'node:assert/strict';
import { CuttlefishArtwork } from '../src/animals/cuttlefish.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';
const options = { count: 1, scene: 'reactive', size: 1, sizeVariation: 0 };

test('instances share scheduling; paused/hidden/offscreen scenes have no subscriptions', () => {
  const host = fakeBrowser(), ca = host.canvas(), cb = host.canvas();
  const a = new CuttlefishArtwork(ca, options), b = new CuttlefishArtwork(cb, options);
  assert.equal(host.pending, 1);
  a.setPaused(true); b.setPaused(true); assert.equal(host.pending, 0);
  a.setPaused(false); host.frame(); host.frame(); const before = a.time;
  host.hide(true); assert.equal(host.pending, 0); assert.equal(a.getStats().running, false);
  host.frame(300000); host.hide(false); assert.equal(host.pending, 1);
  host.frame(); assert.equal(a.time, before);
  host.intersect(ca, false); assert.equal(host.pending, 0);
  a.setOptions({ observeVisibility: false }); assert.equal(host.pending, 1);
  a.destroy(); b.destroy(); assert.equal(host.pending, 0);
  assert.equal(host.document.listenerCount + host.view.listenerCount + host.motion.listenerCount + ca.listenerCount + cb.listenerCount, 0);
  assert.equal(host.resizes.size + host.intersections.size, 0);
});

test('system reduced motion pauses by default and never resumes automatically', () => {
  const host = fakeBrowser({ reducedMotion: true });
  const a = new CuttlefishArtwork(host.canvas(), options);
  assert.equal(a.paused, true); assert.equal(host.pending, 0);
  a.pulse(); assert.equal(a.paused, true); assert.equal(host.pending, 0);
  a.setPaused(false); assert.equal(a.options.paused, false); assert.equal(host.pending, 1);
  host.setReduced(false); assert.equal(a.paused, false);
  host.setReduced(true); assert.equal(a.paused, true);
  host.setReduced(false); assert.equal(a.paused, true);
  a.setOptions({ paused: false }); assert.equal(a.paused, false);
  a.setOptions({ paused: true }); assert.equal(a.options.paused, true);
  a.destroy();
  const b = new CuttlefishArtwork(host.canvas(), { ...options, reducedMotion: 'ignore' });
  host.setReduced(true); assert.equal(b.paused, false); b.destroy();
  const c = new CuttlefishArtwork(host.canvas(), { ...options, paused: false });
  assert.equal(c.paused, false); c.destroy();
});

test('resize is idempotent; zero-sized elements suspend and resource caps hold', () => {
  const host = fakeBrowser({ dpr: 4 }), canvas = host.canvas(0, 0);
  const a = new CuttlefishArtwork(canvas, options);
  assert.equal(a.width, 0); assert.equal(a.depth.length, 0); assert.equal(host.pending, 0);
  canvas.rect.width = 3840; canvas.rect.height = 2160;
  a.setOptions({ maxPixels: 2073600, maxCells: 4096 }); a.resize();
  assert(canvas.width * canvas.height <= 2073600); assert(a.depth.length <= 4096); assert(a.inkDensity.length <= 4096);
  const grid = a.depth, atlasWidth = a.atlas.width;
  a.resize(); assert.equal(a.depth, grid); assert.equal(a.atlas.width, atlasWidth);
  canvas.rect.width = 0; a.resize(); assert.equal(host.pending, 0); assert.equal(a.depth.length, 0);
  canvas.rect.width = 947; canvas.rect.height = 707; a.resize(); assert.equal(host.pending, 1);
  a.destroy();
});

test('destroy is idempotent, frees internal buffers and makes mutators inert', () => {
  const host = fakeBrowser(), canvas = host.canvas();
  const a = new CuttlefishArtwork(canvas, options), width = canvas.width;
  a.destroy(); a.destroy();
  const grid = a.depth; a.setOptions({ density: 1.5 }); a.resize(); a.restart(); a.setPaused(false); a.pulse(); a.advance(.01); a.render();
  assert.equal(a.depth, grid); assert.equal(a.samples.length, 0); assert.equal(a.atlas.width, 0);
  assert.equal(a.bodyNormals, null); assert.equal(a.headNormals, null); assert.equal(a._gripPoints, null);
  assert.equal(a.ink.length, 0); assert.equal(canvas.width, width); assert.equal(host.pending, 0);
  assert.equal(a.getStats().destroyed, true); assert.equal(a.getStats().running, false);
});

test('failed observer construction rolls back all installed handlers', () => {
  const host = fakeBrowser(), canvas = host.canvas();
  host.view.ResizeObserver = class { constructor() { throw new Error('observer failed'); } };
  assert.throws(() => new CuttlefishArtwork(canvas, options), /observer failed/);
  assert.equal(host.pending, 0);
  assert.equal(host.document.listenerCount + host.view.listenerCount + host.motion.listenerCount + canvas.listenerCount, 0);
});

test('manual stepping is explicit, bounded and does not start scheduling', () => {
  const host = fakeBrowser(), a = new CuttlefishArtwork(host.canvas(), { ...options, autoStart: false, paused: true });
  a.advance(1 / 60); assert(a.time > 0); assert.equal(host.pending, 0);
  assert.throws(() => a.advance(-1), RangeError); assert.throws(() => a.advance(1), RangeError);
  assert.throws(() => a.advance(NaN), RangeError);
  a.setPaused(false); assert.equal(host.pending, 0);
  a.setOptions({ autoStart: true }); assert.throws(() => a.advance(.01), /autoStart/);
  a.destroy();
});

test('frame cap uses elapsed time and reports discarded stall time', () => {
  const host = fakeBrowser(), a = new CuttlefishArtwork(host.canvas(), { ...options, maxFps: 30 });
  host.frame(); host.frame(10); assert.equal(a.time, 0);
  host.frame(24); assert(Math.abs(a.elapsed - .034) < 1e-9);
  host.frame(500); assert(Math.abs(a.elapsed - .134) < 1e-9); assert(Math.abs(a.droppedSeconds - .4) < 1e-9);
  a.destroy();
});

test('coarse grids cannot inflate glyph or ink atlases', () => {
  const host = fakeBrowser({ dpr: 4 }), canvas = host.canvas(3840, 2160);
  const a = new CuttlefishArtwork(canvas, { ...options, autoStart: false, maxCells: 1024, maxPixels: 16777216 });
  assert(a.depth.length <= 1024); assert(a.atlas.width <= 1600); assert(a.atlas.height <= 4608);
  assert(a.inkAtlas.width <= 640); assert(a.inkAtlas.height <= 64);
  assert(a.spriteDrawSize > a.sprite / a.dpr); assert(a.inkDrawSize > a.inkSprite / a.dpr);
  a.destroy();
});

test('long thin boxes respect auxiliary canvas dimension limits', () => {
  const host = fakeBrowser(), canvas = host.canvas(200000, 1);
  const a = new CuttlefishArtwork(canvas, { ...options, autoStart: false });
  assert(a.cols <= 8192); assert(a.rows <= 8192); assert(a.inkCols <= 8192); assert(a.inkRows <= 8192);
  canvas.rect.width = 1; canvas.rect.height = 200000; a.resize();
  assert(a.cols <= 8192); assert(a.rows <= 8192); assert(a.inkCols <= 8192); assert(a.inkRows <= 8192);
  a.destroy();
});

test('lowest supported frame cap advances real elapsed time without routine dropping', () => {
  const host = fakeBrowser(), a = new CuttlefishArtwork(host.canvas(), { ...options, maxFps: 1 });
  assert.equal(a.options.maxFps, 10); host.frame();
  for (let i = 0; i < 10; i++) host.frame(100);
  assert(Math.abs(a.elapsed - 1) < 1e-9); assert(Math.abs(a.droppedSeconds) < 1e-9); a.destroy();
});

test('live option, size and redundant play updates do not reset simulation time', () => {
  const host = fakeBrowser(), canvas = host.canvas();
  const a = new CuttlefishArtwork(canvas, options);
  host.frame(); host.frame(); const before = a.elapsed;
  for (let i = 0; i < 12; i++) {
    a.setOptions({ ripple: 1 + i / 100, paused: false });
    a.setPaused(false); canvas.rect.width += 1; a.resize(); host.frame();
  }
  assert(Math.abs(a.elapsed - before - 12 / 60) < 1e-9); a.destroy();
});

test('missing ResizeObserver falls back to window resize without a polyfill', () => {
  const host = fakeBrowser(), canvas = host.canvas(); delete host.view.ResizeObserver;
  const a = new CuttlefishArtwork(canvas, { ...options, autoStart: false });
  canvas.rect.width = 500; host.view.emit('resize'); assert.equal(a.width, 500); a.destroy();
});

test('invalid host fails clearly and separate documents retain their own scheduler', () => {
  assert.throws(() => new CuttlefishArtwork(null), /browser document/);
  const one = fakeBrowser(), two = fakeBrowser();
  const a = new CuttlefishArtwork(one.canvas(), options), b = new CuttlefishArtwork(two.canvas(), options);
  assert.equal(one.pending, 1); assert.equal(two.pending, 1); one.hide(true); assert.equal(two.pending, 1);
  a.destroy(); b.destroy();
});

test('non-finite pointer positions do not poison scene state', () => {
  const host = fakeBrowser(), canvas = host.canvas();
  const a = new CuttlefishArtwork(canvas, { ...options, autoStart: false });
  canvas.emit('pointermove', { clientX: NaN, clientY: 30 });
  canvas.emit('pointerdown', { clientX: 20, clientY: Infinity });
  a.advance(1 / 60);
  assert(Number.isFinite(a.pointer.tx)); assert(Number.isFinite(a.pointer.ty));
  assert.equal(a.fish.some(fish => fish.reaction.active), false); a.destroy();
});
