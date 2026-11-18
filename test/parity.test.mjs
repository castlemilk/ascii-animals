import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { CuttlefishArtwork } from '../src/animals/cuttlefish.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

// The imported classic script remains unmodified as the numeric/artwork oracle.
const legacyText = readFileSync(new URL('./fixtures/legacy-artwork.cjs', import.meta.url), 'utf8');
function legacy(host) {
  const scope = { window: host.view, document: host.document, performance: host.view.performance,
    ResizeObserver: host.view.ResizeObserver, requestAnimationFrame: host.view.requestAnimationFrame,
    cancelAnimationFrame: host.view.cancelAnimationFrame, CustomEvent: class {}, console };
  vm.createContext(scope); vm.runInContext(legacyText, scope);
  return host.view.CuttlefishArtwork;
}
const digest = buffer => createHash('sha256').update(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)).digest('hex');
const snapshot = a => JSON.parse(JSON.stringify({ time: a.time, elapsed: a.elapsed,
  fish: a.fish, ink: a.ink, sampleCount: a.sampleCount,
  sampleHash: digest(a.samples), depthHash: digest(a.depth), ownersHash: digest(a.owners), glyphHash: digest(a.glyphs) }));

test('fixed input/time sequences preserve imported geometry, ownership and ink state', () => {
  for (const options of [
    { count: 1, scene: 'encounter', formation: 'independent', size: 1 },
    { count: 4, scene: 'reactive', formation: 'independent', size: .7 },
    { count: 12, scene: 'swimby', formation: 'horizontal', size: .7 }
  ]) {
    const baseHost = fakeBrowser(), candidateHost = fakeBrowser(), Legacy = legacy(baseHost);
    const before = new Legacy(baseHost.canvas(), options);
    const after = new CuttlefishArtwork(candidateHost.canvas(), { ...options, autoStart: false });
    let clock = 1000; before._tick(clock); after.advance(0);
    for (let frame = 0; frame < 80; frame++) {
      if (frame === 12 && options.scene !== 'swimby') { before.pulse(); after.pulse(); }
      const next = clock + 1000 / 60, dt = (next - clock) / 1000; clock = next;
      before._tick(clock); after.advance(dt);
      if (frame % 20 === 0 || frame === 79) assert.deepEqual(snapshot(after), snapshot(before), `${options.count} animals at frame ${frame}`);
    }
    before.destroy(); after.destroy();
  }
});

test('manual replay repeats the same reaction and particle state for the same step sequence', () => {
  function replay() {
    const host = fakeBrowser();
    const a = new CuttlefishArtwork(host.canvas(), { count: 1, scene: 'reactive', autoStart: false, paused: false });
    a.advance(0); a.pulse();
    for (let frame = 0; frame < 75; frame++) a.advance(1 / 60);
    const result = snapshot(a); a.destroy(); return result;
  }
  assert.deepEqual(replay(), replay());
});
