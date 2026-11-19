import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fakeBrowser } from './helpers/fake-browser.mjs';
import { preservedCuttlefishParts, geometryFingerprint, v6PreservedPrimaryStart } from './helpers/cuttlefish-preservation.mjs';

// Optional negative control against a specific prior source snapshot.
const source = process.env.CUTTLEFISH_PRESERVATION_SOURCE
  ? pathToFileURL(process.env.CUTTLEFISH_PRESERVATION_SOURCE)
  : new URL('../src/animals/cuttlefish.js', import.meta.url);
const { CuttlefishArtwork } = await import(source.href);

// Compact numeric oracle recorded from exact V3, not from the candidate. The
// historical V2 head/eye fixture is retained, but absolute head/eye coordinates
// are now an intentional change protected by independent geometric tests.
const oracle = JSON.parse(readFileSync(new URL('./fixtures/cuttlefish-crown-v3-oracle.json', import.meta.url), 'utf8'));
const distalOracle = JSON.parse(readFileSync(new URL('./fixtures/cuttlefish-crown-roots-v5-distal-oracle.json', import.meta.url), 'utf8'));

test('V3 mantle, fins, complete feeding tentacles and beak stay exact', t => {
  const host = fakeBrowser();
  const art = new CuttlefishArtwork(host.canvas(1000, 650), {
    count: 1, species: 'cuttlefish', scene: 'reactive', size: 1.2,
    sizeVariation: 0, seed: 7, autoStart: false, paused: true, glow: false,
  });
  let samples = 0;
  const samplesByPart = {};
  try {
    assert.equal(oracle.sourceCommit, '8931bcc568cb5272f3a7b5eab0532c6c95c92858');
    assert.equal(oracle.sourceTree, 'ef45da059fb583c86e3561eaeb5b3bf810fc244f');
    assert.equal(oracle.sourceSha256, 'cd1dc0d1cb60310afdaa86f2743be336fa97078a464f74511d6bf7af2d0d0f10');
    for (const { pose, parts } of oracle.cases) {
      const measured = preservedCuttlefishParts(art, pose);
      for (const [name, expected] of Object.entries(parts)) {
        // V6 deliberately extends upper arms 1/2/3's proximal correction from
        // .30 to .40. The historical fixture is unchanged; exact distal parity
        // moves to the explicit V5-derived subset test below.
        if (name === 'primaryDistalArms') continue;
        assert.deepEqual(geometryFingerprint(measured[name]), expected,
          `${name}, time ${pose.time}, LOD ${pose.lod}, grip ${pose.grip}: approved geometry/light/seed changed`);
        samples += measured[name].length;
        samplesByPart[name] = (samplesByPart[name] || 0) + measured[name].length;
      }
    }
    assert(samples > 120000 && samplesByPart.feedingTentacles > 16000,
      'exercise all three LODs and multiple swim/grip phases');
    t.diagnostic(JSON.stringify({ approvedGeometryParity: { sourceCommit: oracle.sourceCommit,
      sourceSha256: oracle.sourceSha256, cases: oracle.cases.length, exactSamples: samples, samplesByPart } }));
  } finally { art.destroy(); }
});

test('exact V5 distal primary surfaces, lighting and suckers survive the declared upper-root extension', t => {
  assert.equal(distalOracle.sourceCommit, 'd638880513978c63b8cb1dfc97101463baa22966');
  assert.equal(distalOracle.sourceTree, 'cb01b581891142b9e4c31167e5776f762ef2408b');
  assert.equal(distalOracle.sourceSha256, 'b65cb598f9944c1d89e8564db6707b684632cadcfd416e1365e1eb0bf58071dd');
  assert.deepEqual(distalOracle.primaryStart, v6PreservedPrimaryStart,
    'only upper arms 1/2/3 gain the explicitly declared .30–.40 proximal region');
  const host = fakeBrowser(), art = new CuttlefishArtwork(host.canvas(1000, 650), {
    count: 1, species: 'cuttlefish', scene: 'reactive', size: 1.2,
    sizeVariation: 0, seed: 7, autoStart: false, paused: true, glow: false,
  });
  let samples = 0;
  try {
    for (const { pose, primaryDistalArms } of distalOracle.cases) {
      const measured = preservedCuttlefishParts(art, pose, { primaryStart: v6PreservedPrimaryStart }).primaryDistalArms;
      assert.deepEqual(geometryFingerprint(measured), primaryDistalArms,
        `time ${pose.time}, LOD ${pose.lod}, grip ${pose.grip}: exact V5 distal geometry/light/seed changed`);
      samples += measured.length;
    }
    assert(distalOracle.cases.length === 18 && samples > 35000,
      'all three LODs, first unchanged grip frames and multiple swim/grip phases');
    t.diagnostic(JSON.stringify({ exactV5DistalPrimary: { sourceCommit: distalOracle.sourceCommit,
      primaryStart: v6PreservedPrimaryStart, cases: distalOracle.cases.length, exactSamples: samples,
      intentionalExtension: { arms: [1, 2, 3], u: [.30, .40] }, adjacentFrameExceptions: 0 } }));
  } finally { art.destroy(); }
});
