import test from 'node:test';
import assert from 'node:assert/strict';
import { createArtwork, DEFAULT_OPTIONS, normalizeOptions } from '../lib/public/index.js';
import { CuttlefishArtwork } from '../src/animals/cuttlefish.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

test('strict config rejects unknown/invalid fields atomically and copies role arrays', () => {
  const roles = ['hover']; const config = normalizeOptions({ behaviors: roles });
  roles[0] = 'orbit'; assert.deepEqual(config.behaviors, ['hover']);
  assert(Object.isFrozen(config)); assert(Object.isFrozen(config.behaviors)); assert(Object.isFrozen(DEFAULT_OPTIONS));
  for (const patch of [null, [], { speed: NaN }, { count: 1.5 }, { count: 13 }, { speed: Symbol() }, { glow: 'false' }, { species: 'ray' }, { madeUp: 1 }, { behaviors: ['dance'] }, { behaviors: new Array(2) }]) assert.throws(() => normalizeOptions(patch));
  assert.equal(normalizeOptions({ count: undefined }).count, DEFAULT_OPTIONS.count);
});
test('facade system pause, controls, atomic update, manual drive and disposal', () => {
  const host = fakeBrowser({ reducedMotion: true });
  const art = createArtwork(host.canvas(), { count: 1, autoStart: false });
  assert.equal(art.getOptions().paused, true); art.pulse(); assert.equal(art.getOptions().paused, true);
  art.play(); art.update({ size: 1 }); assert.equal(art.getOptions().paused, false); art.update({ reducedMotion: 'system' }); assert.equal(art.getOptions().paused, true);
  art.update({ paused: false, count: 2, formation: 'vertical' });
  assert.equal(art.getStats().count, 2); assert.equal(art.getOptions().paused, false);
  assert.throws(() => art.update({ count: 3, speed: Symbol() }));
  assert.equal(art.getOptions().count, 2); assert.equal(art.getStats().count, 2);
  art.pause(); art.restart(); assert.equal(art.getOptions().paused, true);
  art.advance(1 / 60); assert(art.getStats().time > 0); assert.equal(host.pending, 0);
  art.dispose(); art.dispose(); art.update({ count: 4 }); art.play();
  assert.equal(art.disposed, true); assert.equal(host.pending, 0); assert.equal(art.getStats().count, 2);
});
test('raw API undefined pause respects OS and invalid patches cannot poison state', () => {
  const host = fakeBrowser({ reducedMotion: true });
  const art = new CuttlefishArtwork(host.canvas(), { count: 1, paused: undefined });
  assert.equal(art.paused, true); assert.equal(host.pending, 0);
  assert.throws(() => art.setOptions({ count: 3, speed: Symbol() }));
  assert.equal(art.options.count, 1); assert.equal(art.getStats().count, 1);
  art.setOptions({ size: 1 }); assert.equal(art.options.size, 1);
  for (const patch of [null, [], 1]) assert.throws(() => art.setOptions(patch));
  art.destroy();
});
