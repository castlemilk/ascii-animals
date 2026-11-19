import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { handoffViews, handoffTimes, handoffGrips, handoffMethod, measureCrownHandoff } from './helpers/cuttlefish-handoff.mjs';
import { upperContourMethod, measureUpperContour } from './helpers/cuttlefish-upper-contour.mjs';
import { v6PreservedPrimaryStart } from './helpers/cuttlefish-preservation.mjs';

// Exact V5 is the negative control, selected without modifying test fixtures:
// CUTTLEFISH_FORWARD_ROOTS_SOURCE=/absolute/path/to/V5/src/animals/cuttlefish.js
const source = process.env.CUTTLEFISH_FORWARD_ROOTS_SOURCE
  ? pathToFileURL(process.env.CUTTLEFISH_FORWARD_ROOTS_SOURCE)
  : new URL('../src/animals/cuttlefish.js', import.meta.url);
const { CuttlefishArtwork } = await import(source.href);
const baseline = JSON.parse(readFileSync(new URL('./fixtures/cuttlefish-crown-roots-v5-handoff.json', import.meta.url), 'utf8'));
const contourBaseline = JSON.parse(readFileSync(new URL('./fixtures/cuttlefish-crown-roots-v5-upper-contour.json', import.meta.url), 'utf8'));
const key = ({ view, time, grip }) => `${view}/${time}/${grip}`;
const sum = (records, field) => records.reduce((total, record) => total + record.upper[field], 0);

function checkV5Identity(oracle) {
  assert.equal(oracle.sourceCommit, 'd638880513978c63b8cb1dfc97101463baa22966');
  assert.equal(oracle.sourceTree, 'cb01b581891142b9e4c31167e5776f762ef2408b');
  assert.equal(oracle.sourceSha256, 'b65cb598f9944c1d89e8564db6707b684632cadcfd416e1365e1eb0bf58071dd');
}

test('upper arm roots carry the brow forward with less exposed crown and more real proximal support than V5', t => {
  checkV5Identity(baseline);
  assert.deepEqual(baseline.method, { ...handoffMethod, primaryRootEndByArm: v6PreservedPrimaryStart },
    'same native scale, cameras, crown region and declared proximal boundaries as the V5 control');
  assert.equal(baseline.upperMinimumNormalizedHeight, .45);
  const poses = handoffViews.flatMap(([view]) => handoffTimes.flatMap(time => handoffGrips.map(grip => ({ view, time, grip }))));
  assert.deepEqual(baseline.cases.map(key), poses.map(key));
  const measured = poses.map(pose => measureCrownHandoff(CuttlefishArtwork, pose, { primaryRootEndByArm: v6PreservedPrimaryStart }));
  const beforeByPose = new Map(baseline.cases.map(record => [key(record), record]));
  const summary = handoffViews.map(([view]) => ({ view,
    phases: handoffGrips.map(grip => {
      const before = baseline.cases.filter(record => record.view === view && record.grip === grip);
      const after = measured.filter(record => record.view === view && record.grip === grip);
      return { grip, upperCrownBefore: sum(before, 'exposedForwardCrownCells'), upperCrownAfter: sum(after, 'exposedForwardCrownCells'),
        upperRootCellsBefore: sum(before, 'primaryRootCells'), upperRootCellsAfter: sum(after, 'primaryRootCells'),
        rootOccludesCrownBefore: sum(before, 'primaryRootOccludesCrownCells'), rootOccludesCrownAfter: sum(after, 'primaryRootOccludesCrownCells') };
    }) }));
  t.diagnostic(JSON.stringify({ upperRootHandoff: { baselineCommit: baseline.sourceCommit,
    minimumNormalizedHeight: .45, minimumSwimExposureReduction: .10, minimumSwimRootCoverageGain: .10,
    perPoseExposedCellQuantizationBudget: 1, summary } }));
  for (const record of measured) {
    const before = beforeByPose.get(key(record));
    assert(record.upper.exposedForwardCrownCells <= before.upper.exposedForwardCrownCells + 1,
      `${key(record)}: upper crown exposure worsened beyond one native cell`);
  }
  for (const record of summary) {
    if (!['broadside', 'dorsal', 'three-quarter'].includes(record.view)) continue;
    const swim = record.phases.find(phase => phase.grip === 0);
    assert(swim.upperCrownAfter <= swim.upperCrownBefore * .90,
      `${record.view}: upper forward-facing crown needs at least 10% less native exposure than V5`);
    assert(swim.upperRootCellsAfter >= swim.upperRootCellsBefore * 1.10,
      `${record.view}: actual primary roots need at least 10% more upper attachment coverage than V5`);
    const grip = record.phases.find(phase => phase.grip === .7);
    assert(grip.upperCrownAfter <= grip.upperCrownBefore + 1,
      `${record.view}: the already raised grip pose must not acquire a new upper cap`);
  }
});

test('upper-contour continuity extends through the unchanged distal handoff instead of moving the cliff forward', t => {
  checkV5Identity(contourBaseline);
  assert.deepEqual(contourBaseline.method, upperContourMethod);
  const measured = handoffTimes.flatMap(time => handoffGrips.map(grip => measureUpperContour(CuttlefishArtwork, { time, grip })));
  const summary = records => records.map(({ profile, ...record }) => ({ ...record,
    landmarks: profile.filter(point => [1, 1.2, 1.4, 1.6].some(x => Math.abs(x - point.x) < 1e-9)) }));
  t.diagnostic(JSON.stringify({ extendedUpperContour: { method: upperContourMethod,
    maximumAllowedDropOver05X: .16, minimumSwimDropReduction: .15, minimumUpperGainAt140: .10,
    baseline: summary(contourBaseline.cases), measured: summary(measured) } }));
  for (const record of measured) {
    assert(record.maximumDropOver05X.drop <= .16,
      `time ${record.time}, grip ${record.grip}: upper cliff moved to x=${record.maximumDropOver05X.x} (${record.maximumDropOver05X.drop})`);
    const before = contourBaseline.cases.find(candidate => candidate.time === record.time && candidate.grip === record.grip);
    if (record.grip === 0) {
      assert(record.maximumDropOver05X.drop <= before.maximumDropOver05X.drop * .85,
        `time ${record.time}: upper descent must be at least 15% gentler than V5 over the complete handoff window`);
      const height = points => points.find(point => Math.abs(point.x - 1.4) < 1e-9).upperRadius;
      assert(height(record.profile) >= height(before.profile) + .10,
        `time ${record.time}: upper arms must remain higher beyond the crown, not only change shading/occlusion`);
    } else assert(record.maximumDropOver05X.drop <= before.maximumDropOver05X.drop + .01,
      `time ${record.time}: already raised grip arms must not acquire a new step`);
  }
});
