import { mountAccepted } from './helpers/accepted-cuttlefish-baseline.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { fakeBrowser } from './helpers/fake-browser.mjs';
import { attachmentScope, attachmentPoses, attachmentContourPoses, protectedSourceFingerprint,
  captureAttachmentPose, attachmentFingerprints, assertAttachmentPreserved, captureAttachmentSupport,
  measureAttachmentContour, measuredSleeveJets, assertC2SleeveJets } from './helpers/cuttlefish-v71-attachment.mjs';

const source = process.env.CUTTLEFISH_V71_ATTACHMENT_SOURCE
  ? pathToFileURL(process.env.CUTTLEFISH_V71_ATTACHMENT_SOURCE)
  : new URL('../src/animals/cuttlefish.js', import.meta.url);
const { CuttlefishArtwork } = await import(source.href);
const oracle = JSON.parse(readFileSync(new URL('./fixtures/cuttlefish-v7-attachment-oracle.json', import.meta.url), 'utf8'));
const accepted = await mountAccepted('v7');
try {
  for (const entry of oracle.cases) {
    const measured = captureAttachmentPose(accepted, entry.pose);
    entry.fingerprints = attachmentFingerprints(measured);
    entry.rootShapes = measured.rootShapes;
  }
  for (const entry of oracle.support) entry.measurement = captureAttachmentSupport(accepted, entry.depthStrength);
  oracle.baselineSleeveJets = measuredSleeveJets(oracle.cases.find(c => c.pose.time === 2.4 && c.pose.lod === 1 && c.pose.grip === 0).rootShapes);
} finally { accepted.destroy(); }
const mount = () => new CuttlefishArtwork(fakeBrowser().canvas(1000, 650), {
  count: 1, species: 'cuttlefish', scene: 'reactive', size: 1.2, sizeVariation: 0,
  seed: 7, autoStart: false, paused: true, glow: false,
});
function identity() {
  assert.equal(oracle.sourceTree, '88a1a50e9f0691954c214d8a919f825209a38627');
  assert.equal(oracle.sourceSha256, '815dc158a2013a6590cdfce4d093e5092989eecfd0687ed952948583e56289ba');
  assert.equal(oracle.provenance.expectedGeometryImportedFromCandidate, false);
  assert.deepEqual(oracle.scope, attachmentScope);
  assert.deepEqual(oracle.cases.map(c => c.pose), attachmentPoses);
}

test('V7.1 protected source is historical or the exact reviewed Independent route revision', () => {
  identity();
  const candidate = readFileSync(source, 'utf8');
  const start = candidate.indexOf('      // The Overall size control governs');
  const end = candidate.indexOf('      const lx =', start);
  if (start !== -1) {
    assert(end > start);
    const cueHash = createHash('sha256').update(candidate.slice(start, end)).digest('hex');
    assert.equal(cueHash, '98191ef6df322712d9086c7cb7a60b8f8be77a5d639d5d378ae45090014674ad', 'Only the reviewed camera cue is excepted');
  }
  const anatomySource = start === -1 ? candidate : candidate.slice(0, start) + candidate.slice(end);
  const protectedHash = protectedSourceFingerprint(anatomySource);
  // This second exact source seal covers the reviewed Independent pose changes.
  // The separate exact geometry/raw-sample oracles still run unchanged.
  assert([oracle.protectedSourceSha256, '3d378f3fe130b84e3bba9b338f27d8b7c61b9d1f5364895e14fddfcf4d6de7c8'].includes(protectedHash),
    'Anything outside the reviewed attachment, framing and Independent path changes must remain protected');
});

test('V7.1 preserves exact V7 centerlines/frames, protected anatomy and all upper-arm geometry/normals from u=.40', t => {
  identity();
  const art = mount(); let samples = 0, frameCalls = 0, sections = 0, minimumWidthRatio = 1, minimumAreaRatio = 1;
  try {
    for (const expected of oracle.cases) {
      const measured = captureAttachmentPose(art, expected.pose);
      assertAttachmentPreserved(measured, expected.fingerprints, JSON.stringify(expected.pose));
      samples += Object.values(measured.parts).reduce((sum, p) => sum + p.length, 0);
      frameCalls += measured.rootInputs.length;
      assert.equal(measured.rootShapes.length, expected.rootShapes.length);
      for (let i = 0; i < measured.rootShapes.length; i++) {
        const current = measured.rootShapes[i], before = expected.rootShapes[i];
        assert.deepEqual([current.arm, current.i, current.u], [before.arm, before.i, before.u]);
        assert(current.convex, `arm ${current.arm}, u=${current.u}: nonconvex or collapsed section`);
        assert(current.centroidError < 1e-13, 'Actual complete cross-section remains centered on its unchanged path');
        if (attachmentScope.changedPrimaryArms.includes(current.arm)) {
          const widthRatio = current.minimumWidth / before.minimumWidth, areaRatio = current.area / before.area;
          minimumWidthRatio = Math.min(minimumWidthRatio, widthRatio); minimumAreaRatio = Math.min(minimumAreaRatio, areaRatio);
          assert(widthRatio >= .90 && areaRatio >= .90, `arm ${current.arm}, u=${current.u}: attachment shrank beyond 10%`);
        }
        sections++;
      }
    }
    t.diagnostic(JSON.stringify({ exactV7AttachmentPreservation: { poses: oracle.cases.length, samples, frameCalls,
      sections, minimumWidthRatio, minimumAreaRatio, upperDistalFromU: .40,
      changedParts: 'Only sleeve/root section surfaces of primary arms 1,2,3; proximal extras depending on their radius may change' } }));
  } finally { art.destroy(); }
});

test('V7.1 retains complete V7 head/crown support and both complete eye surfaces at every declared depth', t => {
  identity(); const art = mount();
  try {
    assert.deepEqual(oracle.support.map(s => s.depthStrength), [0, 1.2, 2]);
    for (const entry of oracle.support) assert.deepEqual(captureAttachmentSupport(art, entry.depthStrength), entry.measurement,
      `depth ${entry.depthStrength}: complete head/eye/crown support changed`);
    t.diagnostic(JSON.stringify({ exactSupportingBuffers: { depths: [0, 1.2, 2], hiddenCrownSupport: true, bothUnculledEyeViews: true } }));
  } finally { art.destroy(); }
});

test('upper sleeve has measured C2 endpoint jets; accepted V7 is a quantitative basal-curvature negative control', t => {
  identity(); const art = mount();
  try {
    const pose = { time: 2.4, lod: 1, grip: 0 };
    const measured = measuredSleeveJets(captureAttachmentPose(art, pose).rootShapes);
    assertC2SleeveJets(measured);
    assert.throws(() => assertC2SleeveJets(oracle.baselineSleeveJets), /zero first and second derivatives/,
      'Unchanged V7 must fail the new basal-curvature improvement gate');
    t.diagnostic(JSON.stringify({ measuredSleeveEndpointJets: measured,
      baselineNegativeControl: oracle.baselineSleeveJets, normalizedSecondDerivativeTolerance: 1e-5 }));
  } finally { art.destroy(); }
});

test('complete upper hand-off remains supported with fixed V7 normalization and no relocated cliff', t => {
  identity(); const art = mount(), records = [];
  try {
    art.setOptions({ depthStrength: 1.2 });
    const referenceDepth = oracle.support.find(s => s.depthStrength === 1.2).measurement.referenceDepth;
    for (const pose of attachmentContourPoses) {
      const measured = measureAttachmentContour(art, pose, referenceDepth);
      assert(measured.maximumDrop.drop <= .16,
        `${JSON.stringify(pose)}: upper cliff moved to x=${measured.maximumDrop.x}`);
      // Existing full silhouette and root-coverage tests retain their broader
      // multi-view fullness and crown-exposure constraints unchanged.
      records.push({ ...pose, maximumDrop: measured.maximumDrop });
    }
    // The initial upper-arm centers must remain embedded inside the unchanged
    // head/crown base; convex full sections cannot become detached stalks.
    const measured = captureAttachmentPose(art, { time: 2.4, lod: 1, grip: 0 });
    const a = art.crownSurface[1], b = art.crownSurface[22 * 6 + 2];
    for (const input of measured.rootInputs.filter(r => r.u === 0 && attachmentScope.changedPrimaryArms.includes(r.arm))) {
      assert.equal(input.center[0], art.crownSurface[0]);
      assert(Math.hypot(input.center[1] / a, input.center[2] / b) < 1,
        `arm ${input.arm}: attachment center must be embedded in the crown base`);
    }
    t.diagnostic(JSON.stringify({ completeUpperContour: { referenceDepth, x: [1, 1.6], primaryArmThroughU: .50,
      dropWindowX: .05, maximumAllowedDrop: .16, records } }));
  } finally { art.destroy(); }
});

test('the separate basal radial adjustment returns C2 at u=.16 in the actual section sampler', t => {
  const art = mount();
  try {
    // Hold a regular frame and section size fixed, so this probes only the
    // endpoint behavior of the actual sampler. No fade formula is repeated.
    art._rootRing = Array.from({ length: 28 }, (_, j) => [Math.cos(j / 28 * Math.PI * 2), Math.sin(j / 28 * Math.PI * 2)]);
    const sample = u => {
      const row = art._storeRootSection(0, 2, u, [0,0,0], [1,0,0], [0,1,0], [0,0,1], .25, .12, 0, 0);
      return Array.from(row.points);
    };
    const endpoint = sample(.16);
    assert.deepEqual(sample(.17), endpoint, 'Radial correction is exactly absent beyond its declared boundary');
    const distances = [.004, .002, .001].map(h => {
      const before = sample(.16 - h), norm = Math.hypot(...before.map((v,i) => v - endpoint[i]));
      return { h, residual: norm };
    });
    assert(distances[0].residual > 1e-10, 'Exercise a real radial rounding, not an absent correction');
    for (let i = 1; i < distances.length; i++) {
      const ratio = distances[i].residual / distances[i-1].residual;
      assert(ratio > .10 && ratio < .16, 'Endpoint position residual must converge cubically; a C1-only fade fails');
    }
    t.diagnostic(JSON.stringify({ radialReturnC2: { boundaryU:.16, controlledFrame:true, distances,
      expectedOrder:3, ratioBand:[.10,.16] } }));
  } finally { art.destroy(); }
});

test('a real .01 center displacement fails the exact-path guard and changes emitted arm geometry', t => {
  identity(); const art = mount(), pose = { time: 2.4, lod: 1, grip: 0 };
  try {
    const expected = oracle.cases.find(c => c.pose.time === pose.time && c.pose.lod === pose.lod && c.pose.grip === pose.grip);
    const original = captureAttachmentPose(art, pose);
    const shifted = captureAttachmentPose(art, pose, { transformRootArguments: args => {
      if (args[1] === 2 && args[2] === 0) args[3][0] += .01;
    } });
    assert.throws(() => assertAttachmentPreserved(shifted, expected.fingerprints, 'negative control'), /centerlines\/tangents\/frames changed/);
    const displacement = shifted.arms[2][0].ring[0][0] - original.arms[2][0].ring[0][0];
    assert(Math.abs(displacement - .01) < 1e-12, 'Mutation must reach actual emitted root geometry');
    assert.notDeepEqual(attachmentFingerprints(shifted).rootInputs, expected.fingerprints.rootInputs);
    t.diagnostic(JSON.stringify({ centerShiftNegativeControl: { arm: 2, u: 0, requestedX: .01,
      actualEmittedXChange: displacement, guardRejected: true } }));
  } finally { art.destroy(); }
});
