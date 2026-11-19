import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { CuttlefishArtwork } from '../src/animals/cuttlefish.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';
import { armSections } from './helpers/cuttlefish-arms.mjs';
import { v6PreservedPrimaryStart } from './helpers/cuttlefish-preservation.mjs';

// The imported classic script stays immutable. It remains the exact posterior
// artwork/simulation oracle outside the revised anterior mantle/head/root area.
// Separate checks below preserve the fins, beak and distal arm motion while the
// independent profile tests constrain the intentional anterior geometry change.
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
  fish: a.fish.map(({species, definition, moduleSeed, speciesState, ...state}) => state), ink: a.ink, sampleCount: a.sampleCount,
  sampleHash: digest(a.samples), depthHash: digest(a.depth), ownersHash: digest(a.owners), glyphHash: digest(a.glyphs) }));

// Fixed review boundary at the old mantle's widest section. It is independent
// of the candidate profile. The excluded fins/arms/beak are checked separately.
const inAnteriorRegion = x => x > -.55;

test('fixed input/time sequences preserve posterior geometry, ownership, animation and ink state', () => {
  for (const options of [
    { count: 1, scene: 'encounter', formation: 'independent', size: 1 },
    { count: 4, scene: 'reactive', formation: 'independent', size: .7 },
    { count: 12, scene: 'swimby', formation: 'horizontal', size: .7 }
  ]) {
    const baseHost = fakeBrowser(), candidateHost = fakeBrowser(), Legacy = legacy(baseHost);
    // Suppress the intentional anterior revision from the first render,
    // including unused buffer tails. Keep the full raster/behavior oracle.
    class LegacyWithoutEyes extends Legacy {
      _eye() {}
      _put(x, y, z, ...rest) { if (!inAnteriorRegion(x)) super._put(x, y, z, ...rest); }
    }
    class CurrentWithoutEyes extends CuttlefishArtwork {
      _eye() {}
      _put(x, y, z, ...rest) { if (!inAnteriorRegion(x)) super._put(x, y, z, ...rest); }
    }
    const before = new LegacyWithoutEyes(baseHost.canvas(), options);
    const after = new CurrentWithoutEyes(candidateHost.canvas(), { ...options, autoStart: false });
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

function partPair() {
  const baseHost = fakeBrowser(), candidateHost = fakeBrowser(), Legacy = legacy(baseHost);
  const options = { count: 1, scene: 'reactive', size: 1, sizeVariation: 0 };
  return [new Legacy(baseHost.canvas(), options), new CuttlefishArtwork(candidateHost.canvas(), { ...options, autoStart: false })];
}
function partPose(art, time, lod, grip = 0) {
  art.time = time; art.elapsed = time;
  art._activateFish(art.fish[0]); art.sceneTime = time; art._camera(time);
  art.geometryStep = lod; art.encounterGrip = grip; art.encounterFront = grip;
  art.startleTension = .25; art.escapeAmount = .15;
}
function partSamples(art, method, time) {
  const put = art._put, samples = [];
  try { art._put = (...args) => samples.push(args); art[method](time); }
  finally { art._put = put; }
  return samples;
}

test('fin wave geometry and light stay exact while only anterior lateral attachment widens', () => {
  const pair = partPair();
  let checked = 0, widened = 0;
  try {
    for (const time of [0, 2.4, 6.8]) for (const lod of [1, 3]) {
      for (const art of pair) partPose(art, time, lod);
      const [before, after] = pair.map(art => partSamples(art, '_body', time).filter(point => point[4] === 1));
      assert.equal(after.length, before.length, 'fin sampling/choreography stays unchanged');
      for (let i = 0; i < before.length; i++) {
        const old = before[i], current = after[i];
        assert.deepEqual([current[0], ...current.slice(2)], [old[0], ...old.slice(2)],
          'fin phase, out-of-plane displacement, lighting and seeds are exact');
        if (old[0] <= -.55) assert.equal(current[1], old[1], 'posterior fin is entirely unchanged');
        else if (current[1] !== old[1]) widened++;
        checked++;
      }
    }
    assert(checked > 10000 && widened > 1000, 'measure both unchanged waves and intended wider attachment');
  } finally { for (const art of pair) art.destroy(); }
});

test('distal arm surfaces, lights and sucker geometry remain exact after proximal root revisions', t => {
  const pair = partPair();
  let checked = 0, changedRoots = 0;
  const records = [];
  try {
    for (const time of [2.4, 6.8]) for (const lod of [1, 3]) for (const grip of [0, .45, 1]) {
      for (const art of pair) partPose(art, time, lod, grip);
      const [before, after] = pair.map(art => partSamples(art, '_arms', time));
      const [oldArms, newArms] = [before, after].map(samples => armSections(samples, lod));
      assert(after.every(point => point.every(Number.isFinite)), 'all revised arm samples stay finite');
      let distal = 0, proximal = 0;
      for (const sections of newArms) for (const section of sections) {
        const { u, arm, i, segments } = section, previous = oldArms[arm][i];
        assert.equal(sections.length, oldArms[arm].length, 'arm longitudinal stations remain unchanged');
        const oldSamples = [...previous.ring, ...previous.extras], newSamples = [...section.ring, ...section.extras];
        // The original legacy comparison retained one neighboring segment
        // for grip frames. V6 explicitly extends upper arms 1/2/3's proximal
        // region to .40; the exact pinned-V5 test permits no frame exception.
        const boundary = v6PreservedPrimaryStart[arm] ?? .30;
        const cutoff = grip ? Math.max(boundary + .02, boundary + 1 / segments) : boundary;
        if (u >= cutoff) {
          assert.deepEqual(newSamples, oldSamples, `arm ${arm}, u=${u}: distal geometry/light changed`);
          checked += newSamples.length; distal += newSamples.length;
        } else if (JSON.stringify(newSamples) !== JSON.stringify(oldSamples)) {
          changedRoots += newSamples.length; proximal += newSamples.length;
        }
      }
      records.push({ time, lod, grip, exactDistalSamples: distal, revisedProximalSamples: proximal });
    }
    assert(checked > 30000 && changedRoots > 1000, 'exercise moving/encounter arms at full and coarse LOD');
    t.diagnostic(JSON.stringify({ armSurfaceParity: records, exactDistalSamples: checked }));
  } finally { for (const art of pair) art.destroy(); }
});

test('beak and oral detail stay exact through static and encounter poses', () => {
  const pair = partPair();
  let checked = 0;
  try {
    for (const time of [0, 2.4, 6.8]) for (const grip of [0, .45, 1]) {
      for (const art of pair) partPose(art, time, 1, grip);
      const [before, after] = pair.map(art => partSamples(art, '_beak', time));
      assert.deepEqual(after, before, 'beak geometry, light and reveal are unchanged');
      checked += after.length;
    }
    assert(checked > 10000);
  } finally { for (const art of pair) art.destroy(); }
});
