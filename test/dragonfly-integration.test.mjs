import test from 'node:test';
import assert from 'node:assert/strict';
import { createDragonflyArtwork } from '../lib/public/dragonfly.js';
import { createFoxArtwork } from '../lib/public/fox.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';
import { buildDragonflyDemo } from '../scripts/build-dragonfly.mjs';

test('Dragonfly and Fox adapters share one scheduler and preserve individual lifecycle', () => {
  const host = fakeBrowser(), canvas = host.canvas(), foxCanvas = host.canvas();
  canvas.getContext('2d').measureText = () => ({ width: 5 });
  const fly = createDragonflyArtwork(canvas, { model: { seed: 17 } });
  const fox = createFoxArtwork(foxCanvas); host.intersect(foxCanvas, true);
  assert.equal(host.pending, 1); host.frame(); host.frame();
  assert(fly.getState().tick > 0); fly.dart(); host.frame(); assert.equal(fly.getState().behavior.kind, 'dart');
  fly.pause(); fly.restart(); assert.equal(fly.getStatus().paused, true);
  const before = fly.getState().tick; host.frame(); assert.equal(fly.getState().tick, before);
  fly.update({ motion: 'slow' }); fly.play(); host.frame(); host.frame();
  fly.dispose(); fly.dispose(); assert.equal(fly.disposed, true); assert.equal(host.pending, 1);
  assert.throws(() => fly.dart(), /disposed/); fox.dispose(); assert.equal(host.pending, 0);
});
test('Dragonfly static actions never override reduced motion and invalid options reject', () => {
  const host = fakeBrowser({ reducedMotion: true }), canvas = host.canvas();
  canvas.getContext('2d').measureText = () => ({ width: 5 });
  const fly = createDragonflyArtwork(canvas); fly.play(); const before = fly.getState().staticPose; fly.pulse();
  assert.notEqual(fly.getState().staticPose, before); assert.equal(fly.getState().tick, 0); assert.equal(host.pending, 0);
  assert.throws(() => fly.update({ wingHz: NaN })); assert.equal(fly.getState().tick, 0);
  fly.dispose(); assert.throws(() => createDragonflyArtwork(canvas, { unknown: true }));
});
test('Dragonfly real-adapter Pages demo is reproducible', async () => {
  assert.equal((await buildDragonflyDemo({ check: true })).entry, 'dist/dragonfly/index.html');
});
