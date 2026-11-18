import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoxArtwork, createFox, resolveFoxOptions, FOX_DEFAULTS } from '../lib/public/fox.js';
import { CuttlefishArtwork } from '../lib/animals/cuttlefish.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';
import { buildFoxDemo } from '../scripts/build-fox.mjs';

test('fox and cuttlefish share scheduling without borrowing disposal authority', () => {
  const host = fakeBrowser();
  const canvas = host.canvas();
  const fish = new CuttlefishArtwork(host.canvas(), { count: 1 });
  const fox = createFoxArtwork(canvas, { fox: { seed: 17 } });
  host.intersect(canvas, true);
  assert.equal(host.pending, 1);
  host.frame(); host.frame();
  assert(fox.getState().tick > 0);
  fox.pause(); const tick = fox.getState().tick;
  fox.restart(); assert.equal(fox.getStatus().paused, true);
  fox.play(); fox.update({ tailSway: .1 }); assert.equal(fox.getOptions().tailSway, .1);
  assert.throws(() => fox.update({ scale: 100 })); assert.equal(fox.getOptions().scale, .7);
  fox.dispose(); fox.dispose(); assert.equal(fox.disposed, true);
  assert.equal(host.pending, 1); assert.throws(() => fox.play(), /disposed/);
  fish.destroy(); assert.equal(host.pending, 0);
});
test('fox reduced-motion action remains static and exposes explicit fixed-tick model', () => {
  const host = fakeBrowser({ reducedMotion: true }), canvas = host.canvas();
  const fox = createFoxArtwork(canvas); host.intersect(canvas, true);
  fox.play(); fox.pulse(); assert.equal(fox.getStatus().staticPose, 'crouch');
  assert.equal(host.pending, 0); assert.equal(fox.getState().tick, 0);
  const model = createFox({ seed: 2 });
  assert.equal(model.step(1, [{ type: 'pounce', tick: 1, seq: 0 }]).state.behavior.kind, 'crouch');
  assert.throws(() => resolveFoxOptions({}, { ...FOX_DEFAULTS, scale: 100 }));
  model.dispose(); fox.dispose();
});
test('Fox Pages modules and demo are reproducible from canonical typed sources', async () => {
  assert.equal((await buildFoxDemo({ check: true })).entry, 'dist/fox/index.html');
});
