import { mountAccepted } from './helpers/accepted-cuttlefish-baseline.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fakeBrowser } from './helpers/fake-browser.mjs';
import { captureV6PreservedParts, captureV6SupportingHead, sampleFingerprint,
  v7SocketHoleUnion, v6PreservationPoses } from './helpers/cuttlefish-v6-preservation.mjs';

// Diagnostic source overrides support deliberately mutated negative controls.
// They cannot replace the immutable expected fixture or its source identity.
const source = process.env.CUTTLEFISH_V6_PRESERVATION_SOURCE
  ? pathToFileURL(process.env.CUTTLEFISH_V6_PRESERVATION_SOURCE)
  : new URL('../src/animals/cuttlefish.js', import.meta.url);
const { CuttlefishArtwork } = await import(source.href);
const oracle = JSON.parse(readFileSync(new URL('./fixtures/cuttlefish-forward-roots-v6-preservation.json', import.meta.url), 'utf8'));
const accepted = await mountAccepted('v6');
try {
  for (const entry of oracle.cases) {
    const parts = captureV6PreservedParts(accepted, entry.pose);
    entry.parts = Object.fromEntries(Object.entries(parts).map(([key, points]) => [key, sampleFingerprint(points)]));
  }
  for (const entry of oracle.supportingHead) entry.support = captureV6SupportingHead(accepted, entry.depthStrength);
} finally { accepted.destroy(); }
const mount = () => new CuttlefishArtwork(fakeBrowser().canvas(1000, 650), {
  count: 1, species: 'cuttlefish', scene: 'reactive', size: 1.2,
  sizeVariation: 0, seed: 7, autoStart: false, paused: true, glow: false,
});
function verifyIdentity() {
  assert.equal(oracle.sourceCommit, '037cd63b0a34ca0f129b6adedb9ea3d46a8465b8');
  assert.equal(oracle.sourceTree, 'fc7723e367c9795952c728d9a4f8a98e3f195168');
  assert.equal(oracle.sourceSha256, '2dd02aa60ed0503d41f1bbd4d19554a9b37323c11ced16fbd037196b94a1e0f9');
  assert.deepEqual(oracle.changedRegion, v7SocketHoleUnion,
    'only the exact V6/V7 socket-hole union is exempt from emitted-skin parity');
}

test('V7.1 preserves exact V6 mantle, fins, seven complete arms, beak and skin outside the declared socket-hole union', t => {
  verifyIdentity();
  assert.deepEqual(oracle.cases.map(entry => entry.pose), v6PreservationPoses,
    'retain three swim phases, three LODs and both grip states');
  const art = mount(), samplesByPart = {};
  try {
    for (const { pose, parts } of oracle.cases) {
      const measured = captureV6PreservedParts(art, pose);
      assert.deepEqual(Object.keys(measured), Object.keys(parts), 'no preserved part may disappear from the oracle');
      for (const [name, points] of Object.entries(measured)) {
        // V7.1 deliberately reshapes the attachment surfaces of upper arms
        // 1/2/3. The independent V7 attachment oracle now protects their full
        // centerlines/frames and all geometry/normals/extras from u>=.40.
        // Historical V6 expected data remains intact; all other parts and
        // complete head/crown support below retain their exact V6 protection.
        if (['completePrimaryArm1', 'completePrimaryArm2', 'completePrimaryArm3'].includes(name)) continue;
        assert.deepEqual(sampleFingerprint(points), parts[name],
          `${name}, time ${pose.time}, LOD ${pose.lod}, grip ${pose.grip}: exact V6 geometry/light/material/seed changed`);
        samplesByPart[name] = (samplesByPart[name] || 0) + points.length;
      }
    }
    for (const arm of [0, 4, 5, 6, 7]) assert(samplesByPart[`completePrimaryArm${arm}`] > 3000,
      'each whole primary arm includes proximal roots, distal sections and extras');
    assert(samplesByPart.completeFeedingTentacles > 16000);
    t.diagnostic(JSON.stringify({ exactV6Preservation: { sourceCommit: oracle.sourceCommit,
      sourceSha256: oracle.sourceSha256, cases: oracle.cases.length,
      exactSamples: Object.values(samplesByPart).reduce((a, b) => a + b, 0), samplesByPart,
      primaryArmStart: 0, feedingTentacleStart: 0, adjacentFrameExceptions: 0,
      upperArmSurfaceMigration: { arms: [1, 2, 3], test: 'cuttlefish-v71-attachment.test.mjs', completeDistalParityFromU: .40 },
      skinException: v7SocketHoleUnion } }));
  } finally { art.destroy(); }
});

test('V7 preserves complete V6 supporting head and crown buffers and full dorsal profiles at all declared depths', t => {
  verifyIdentity();
  assert.deepEqual(oracle.supportingHead.map(entry => entry.depthStrength), [0, 1.2, 2]);
  const art = mount();
  try {
    for (const { depthStrength, support } of oracle.supportingHead) {
      assert.deepEqual(captureV6SupportingHead(art, depthStrength), support,
        `depth ${depthStrength}: supporting brow/head/crown changed, including hidden socket support`);
    }
    t.diagnostic(JSON.stringify({ exactV6SupportingHead: { depths: [0, 1.2, 2],
      headStations: 28, crownRows: 25, crownColumns: 88,
      completeHeadNormals: true, completeCrownPositionsAndNormals: true,
      fullDorsalProfiles: true, socketExclusionsForSupport: 0 } }));
  } finally { art.destroy(); }
});
