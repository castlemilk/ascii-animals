import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { armSections } from './cuttlefish-arms.mjs';
import { bufferFingerprint, sampleFingerprint, v6PreservationPoses } from './cuttlefish-v6-preservation.mjs';

// Explicit scope, independent of the candidate's constants or geometry.
export const attachmentScope = Object.freeze({
  changedPrimaryArms: [1, 2, 3], sleeveEnds: [.38, .40, .39],
  completeDistalParityFromU: .40, basalRadialReturnU: .16,
  allCenterlinesAndFramesExact: true, headEyesMantleFinsBeakExact: true,
});
export const attachmentPoses = v6PreservationPoses;
export const attachmentContourPoses = [2.4, 4.641509433962264, 6.8]
  .flatMap(time => [0, .7].map(grip => ({ time, grip })));
const hash = value => createHash('sha256').update(value).digest('hex');
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

export function protectedSourceFingerprint(source) {
  // Only these two functions may change. Everything else, including all path,
  // director, eye, head, timing, light and boundary code, remains byte-exact.
  const remove = (text, start, end) => {
    const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
    assert(a >= 0 && b > a, `Cannot identify protected source boundary ${start}`);
    assert.equal(text.indexOf(start, a + start.length), -1, 'Ambiguous source boundary');
    return text.slice(0, a) + start + '\n<explicit attachment-surface scope>\n' + text.slice(b);
  };
  return hash(remove(remove(source, '  function rootSleeve(', '  function rootOffsetCorrection('),
    '    _storeRootSection(', '    _emitRootSections('));
}

export function setAttachmentPose(art, { time, lod, grip }) {
  art.time = time; art.elapsed = time;
  art._activateFish(art.fish[0]); art.sceneTime = time; art._camera(time);
  art.geometryStep = lod; art.encounterGrip = grip; art.encounterFront = grip;
  art.startleTension = .25; art.escapeAmount = .15; art._cacheNormals();
}
function capture(art, callback) {
  const put = art._put, shade = art._shade, points = [], normals = new Map();
  let normal = null;
  try {
    art._shade = (...args) => { normal = args.slice(0, 3); return shade.apply(art, args); };
    art._put = (...point) => { points.push(point); normals.set(point, normal?.slice()); };
    callback();
  } finally { art._put = put; art._shade = shade; }
  assert(points.every(p => p.length === 6 && p.every(Number.isFinite)), 'Finite complete emitted samples');
  return { points, normals };
}
function sectionShape(points, center, first, second) {
  const plane = points.map(p => { const d = p.map((v, i) => v - center[i]); return [dot(d, first), dot(d, second)]; });
  let area = 0, xx = 0, xy = 0, yy = 0, minimumCross = Infinity, maximumCross = -Infinity;
  for (let j = 0; j < plane.length; j++) {
    const p = plane[j], q = plane[(j + 1) % plane.length], r = plane[(j + 2) % plane.length];
    area += p[0] * q[1] - q[0] * p[1]; xx += p[0] ** 2; xy += p[0] * p[1]; yy += p[1] ** 2;
    const cross = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
    minimumCross = Math.min(minimumCross, cross); maximumCross = Math.max(maximumCross, cross);
  }
  xx /= plane.length; xy /= plane.length; yy /= plane.length;
  const root = Math.hypot(xx - yy, 2 * xy), minimumEigenvalue = (xx + yy - root) / 2;
  const centroid = [0, 1, 2].map(axis => points.reduce((s, p) => s + p[axis], 0) / points.length);
  return { minimumWidth: 2 * Math.sqrt(2 * minimumEigenvalue), area: Math.abs(area / 2),
    convex: minimumCross > 1e-12 || maximumCross < -1e-12,
    centroidError: Math.hypot(...centroid.map((v, i) => v - center[i])),
    top: Math.max(...points.map(p => p[2])) };
}
export function captureAttachmentPose(art, pose, { transformRootArguments } = {}) {
  setAttachmentPose(art, pose);
  const { time, lod } = pose, savedHead = art._head, savedEye = art._eye;
  let mantle;
  try { art._head = () => {}; art._eye = () => {}; mantle = capture(art, () => art._body(time)).points; }
  finally { art._head = savedHead; art._eye = savedEye; }
  const parts = { mantleAndFins: mantle,
    completeHeadAndCrown: capture(art, () => art._head(time)).points,
    eyeMinus: capture(art, () => art._eye(-1)).points, eyePlus: capture(art, () => art._eye(1)).points,
    beak: capture(art, () => art._beak(time)).points };
  const rootInputs = [], rootShapes = [], savedStore = art._storeRootSection;
  let emitted;
  try {
    art._storeRootSection = function (...incoming) {
      const args = incoming.map(value => Array.isArray(value) ? value.slice() : value);
      if (transformRootArguments) transformRootArguments(args);
      const [i, arm, u, center, tangent, first, second, radius, sleeve, texture, seed] = args;
      rootInputs.push({ i, arm, u, center, tangent, first, second, texture, seed });
      const row = savedStore.apply(this, args);
      const points = Array.from({ length: 28 }, (_, j) => Array.from(row.points.slice(j * 3, j * 3 + 3)));
      rootShapes.push({ i, arm, u, radius, sleeve, ...sectionShape(points, center, first, second) });
      return row;
    };
    emitted = capture(art, () => art._arms(time));
  } finally { art._storeRootSection = savedStore; }
  const arms = armSections(emitted.points, lod), ringNormals = {};
  assert.equal(arms.length, 10);
  const flatten = sections => sections.flatMap(section => [...section.ring, ...section.extras]);
  for (let arm = 0; arm < 10; arm++) {
    const changed = attachmentScope.changedPrimaryArms.includes(arm);
    const sections = changed ? arms[arm].filter(section => section.u >= .40) : arms[arm];
    const name = changed ? `distalPrimaryArm${arm}` : arm < 8 ? `completePrimaryArm${arm}` : `completeFeedingTentacle${arm}`;
    parts[name] = flatten(sections);
    ringNormals[name] = sections.flatMap(section => section.ring.map(p => ({ seed: p[5], normal: emitted.normals.get(p) })));
  }
  return { parts, ringNormals, rootInputs, rootShapes, arms };
}
export function attachmentFingerprints(measured) {
  return {
    parts: Object.fromEntries(Object.entries(measured.parts).map(([name, points]) => [name, sampleFingerprint(points)])),
    ringNormals: Object.fromEntries(Object.entries(measured.ringNormals).map(([name, points]) => [name, sampleFingerprint(points)])),
    rootInputs: sampleFingerprint(measured.rootInputs),
  };
}
export function assertAttachmentPreserved(actual, expected, context = '') {
  const current = attachmentFingerprints(actual);
  assert.deepEqual(current.rootInputs, expected.rootInputs, `${context}: centerlines/tangents/frames changed`);
  assert.deepEqual(current.parts, expected.parts, `${context}: protected position/light/material/seed changed`);
  assert.deepEqual(current.ringNormals, expected.ringNormals, `${context}: protected lighting normals changed`);
}
export function captureAttachmentSupport(art, depthStrength) {
  art.setOptions({ depthStrength }); setAttachmentPose(art, { time: 2.4, lod: 1, grip: 0 });
  const eyes = {};
  const fields = ['r00','r01','r02','r10','r11','r12','r20','r21','r22','perspectiveStrength'];
  const saved = Object.fromEntries(fields.map(key => [key, art[key]]));
  try {
    // Opposed orthographic views expose each complete eye surface. This is
    // independent of which side a particular animated camera happens to show.
    for (const side of [-1, 1]) {
      Object.assign(art, { r00: 1, r01: 0, r02: 0, r10: 0, r11: 0, r12: -side,
        r20: 0, r21: side, r22: 0, perspectiveStrength: 0 });
      eyes[side] = sampleFingerprint(capture(art, () => art._eye(side)).points);
      assert(eyes[side].samples > 100, 'Full eye surface must be exercised');
    }
  } finally { Object.assign(art, saved); }
  return { bodyNormals: bufferFingerprint(art.bodyNormals), headNormals: bufferFingerprint(art.headNormals),
    crownSurface: bufferFingerprint(art.crownSurface), eyes, referenceDepth: art.crownSurface[22 * 6 + 2] };
}
export function measureAttachmentContour(art, { time, grip }, referenceDepth) {
  setAttachmentPose(art, { time, grip, lod: 1 });
  art.startleTension = 0; art.escapeAmount = 0;
  const head = capture(art, () => art._head(time)).points;
  const arms = armSections(capture(art, () => art._arms(time)).points);
  const tissue = [...head, ...arms.slice(0, 8).flatMap(arm => arm.filter(s => s.u <= .50).flatMap(s => s.ring))];
  const profile = Array.from({ length: 121 }, (_, i) => {
    const x = 1 + i * .005, slice = tissue.filter(p => Math.abs(p[0] - x) < .02);
    return { x, upperRadius: Math.max(...slice.map(p => p[2])) / referenceDepth };
  });
  assert(profile.every(p => Number.isFinite(p.upperRadius)), 'Complete upper tissue in every contour slab');
  const drops = profile.slice(0, -10).map((p, i) => ({ x: p.x, drop: p.upperRadius - profile[i + 10].upperRadius }));
  return { time, grip, referenceDepth, maximumDrop: drops.reduce((a, b) => a.drop > b.drop ? a : b), profile };
}
function measuredDerivatives(points, x) {
  let value = 0, first = 0, second = 0;
  for (let i = 0; i < points.length; i++) {
    let w = 1, d = 0, dd = 0;
    for (let j = 0; j < points.length; j++) if (j !== i) w *= (x - points[j][0]) / (points[i][0] - points[j][0]);
    for (let j = 0; j < points.length; j++) if (j !== i) {
      let term = 1 / (points[i][0] - points[j][0]);
      for (let k = 0; k < points.length; k++) if (k !== i && k !== j) term *= (x - points[k][0]) / (points[i][0] - points[k][0]);
      d += term;
      for (let k = 0; k < points.length; k++) if (k !== i && k !== j) {
        let term2 = 1 / ((points[i][0] - points[j][0]) * (points[i][0] - points[k][0]));
        for (let l = 0; l < points.length; l++) if (l !== i && l !== j && l !== k) term2 *= (x - points[l][0]) / (points[i][0] - points[l][0]);
        dd += term2;
      }
    }
    value += w * points[i][1]; first += d * points[i][1]; second += dd * points[i][1];
  }
  return { value, first, second };
}
export function measuredSleeveJets(rootShapes) {
  return attachmentScope.changedPrimaryArms.map((arm, index) => {
    const end = attachmentScope.sleeveEnds[index], points = rootShapes.filter(p => p.arm === arm && p.u < end)
      .map(p => [p.u / end, p.sleeve]);
    assert(points.length >= 7, 'LOD 1 must provide independent six/seven-node sleeve stencils');
    const amplitude = points[0][1];
    const estimates = [6, 7].map(nodes => {
      const start = measuredDerivatives(points.slice(0, nodes), 0), finish = measuredDerivatives(points.slice(-nodes), 1);
      return { nodes, start: Object.fromEntries(Object.entries(start).map(([k,v]) => [k,v/amplitude])),
        finish: Object.fromEntries(Object.entries(finish).map(([k,v]) => [k,v/amplitude])) };
    });
    return { arm, end, estimates };
  });
}
export function assertC2SleeveJets(records) {
  for (const { arm, estimates } of records) for (const { start, finish } of estimates) {
    assert(Math.abs(start.first) < 1e-6 && Math.abs(start.second) < 1e-5, `arm ${arm}: sleeve must leave its basal fullness with zero first and second derivatives`);
    assert(Math.abs(finish.value) < 1e-8 && Math.abs(finish.first) < 1e-6 && Math.abs(finish.second) < 1e-5,
      `arm ${arm}: sleeve must return C2 at its unchanged boundary`);
  }
}
