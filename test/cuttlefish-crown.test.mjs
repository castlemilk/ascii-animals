import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { fakeBrowser } from './helpers/fake-browser.mjs';
import { captureHeadEnvelope, headEnvelopeAt, headSurfaceReference } from './helpers/cuttlefish-profile.mjs';
import { armSections, rootCoverage } from './helpers/cuttlefish-arms.mjs';
import { v7SocketHoleUnion } from './helpers/cuttlefish-v6-preservation.mjs';

// The exact previously delivered fuller-head source is the negative control:
// CUTTLEFISH_CROWN_SOURCE=/absolute/path/to/30e674b/src/animals/cuttlefish.js
// No candidate profile, crown, sleeve or normal formula is imported here.
const source = process.env.CUTTLEFISH_CROWN_SOURCE
  ? pathToFileURL(process.env.CUTTLEFISH_CROWN_SOURCE)
  : new URL('../src/animals/cuttlefish.js', import.meta.url);
const { CuttlefishArtwork } = await import(source.href);
// Include the native motion evidence's midpoint: it was a stricter outline
// sample than either endpoint and must remain covered during the V4 loft.
const reviewTimes = [2.4, 4.641509433962264, 6.8];

function mounted() {
  const host = fakeBrowser();
  const art = new CuttlefishArtwork(host.canvas(1000, 650), {
    species: 'cuttlefish', count: 1, size: 1.2, sizeVariation: 0, seed: 7,
    autoStart: false, paused: true, glow: false,
  });
  art.geometryStep = 1; art._cacheNormals();
  return art;
}
function pose(art, grip) {
  art.encounterGrip = grip; art.encounterFront = grip;
  art.startleTension = 0; art.escapeAmount = 0;
}
function capture(art, method, time) {
  const saved = art._put, points = [];
  try { art._put = (...point) => points.push(point); art[method](time); }
  finally { art._put = saved; }
  return points;
}
// The upper-lateral V7 socket replaces a few crown samples. Reconstruct the intact
// sampled support, while verifying that the renderer uses those exact cached
// points/normals everywhere except the explicitly authorized socket hole.
function completeCrown(art, time) {
  const surface = art.crownSurface;
  if (!surface) return capture(art, '_head', time).map(point => ({ position: point.slice(0, 3), seed: point[5] }));
  const savedPut = art._put, savedShade = art._shade, emitted = new Map();
  let normal;
  try {
    art._shade = (...args) => { normal = args.slice(0, 3); return savedShade.apply(art, args); };
    art._put = (x, y, z, light, kind, seed) => emitted.set(seed, { position: [x, y, z], normal });
    art._crown(time);
  } finally { art._put = savedPut; art._shade = savedShade; }
  let columns = 1;
  while (columns * 6 < surface.length && Math.abs(surface[columns * 6] - surface[0]) < 1e-10) columns++;
  const result = [], rows = surface.length / (columns * 6), mask = v7SocketHoleUnion;
  assert(columns >= 32 && Number.isInteger(rows) && rows >= 12, 'complete sampled crown grid');
  for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
    const index = (i * columns + j) * 6, seed = 50000 + i * 101 + j;
    const point = { position: Array.from(surface.slice(index, index + 3)), normal: Array.from(surface.slice(index + 3, index + 6)), seed };
    if (emitted.has(seed)) assert.deepEqual(emitted.get(seed), { position: point.position, normal: point.normal },
      'actual crown emission uses its sampled geometry and lighting normals');
    else {
      const phi = j / columns * Math.PI * 2;
      const u = (point.position[0] - mask.after.x) / mask.halfX;
      const v = (Math.atan2(Math.sin(phi), Math.abs(Math.cos(phi))) - mask.after.angle) / mask.halfAngle;
      assert(u * u + v * v < mask.removedSkinRadius ** 2 + 1e-12,
        'no crown tissue disappears outside the moved socket hole');
    }
    result.push(point);
  }
  assert(emitted.size > result.length * .95, 'the socket removes only a small local part of the crown');
  return result;
}
function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b), f = q * (sorted.length - 1), i = Math.floor(f);
  return sorted[i] + (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]) * (f - i);
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = vector => { const length = Math.hypot(...vector); return vector.map(value => value / length); };

test('proximal arms cover the crown attachment and separate gradually into individual strands', t => {
  const art = mounted(), records = [];
  try {
    for (const time of reviewTimes) for (const grip of [0, .7]) {
      pose(art, grip);
      const arms = armSections(capture(art, '_arms', time));
      records.push({ time, grip, stations: [0, .04, .08, .12, .20, .30].map(u => rootCoverage(arms, u)) });
    }
    t.diagnostic(JSON.stringify({ proximalRootCoverage: records }));
    for (const { time, grip, stations } of records) {
      for (const station of stations.slice(0, 4)) {
        const nearBase = station.u <= .04, firstTenth = station.u <= .08;
        assert(station.coverage >= (nearBase ? .80 : firstTenth ? .75 : .60),
          `time ${time}, grip ${grip}, u=${station.u}: thin strands leave most of the crown attachment unsupported`);
        // The polygon-link integral uses 64 midpoint samples. Half a sample
        // is the estimate's reporting precision, rather than a tissue gap.
        assert(station.minimumLinkCoverage + 1 / 128 >= (nearBase ? .50 : firstTenth ? .40 : .30),
          `time ${time}, grip ${grip}, u=${station.u}: an individual neighboring-root gap dominates the attachment`);
      }
      assert(stations.at(-1).coverage < .70, 'separate distal arms remain distinct beyond the short proximal tissue');
    }
  } finally { art.destroy(); }
});

// Recover where the actual closing surface crosses fixed fractions of the
// eye-bearing head radius, for every emitted angular column. Comparing its
// angular distribution rejects moving an otherwise identical transverse cap.
function closingReach(head, reference, fraction) {
  const rings = [];
  for (const point of head) {
    if (point[0] <= 1.005) continue;
    // Recover emitted ring columns by their stable consecutive sample seeds.
    // Normalized polar angle is not a valid column identifier when the crown
    // changes aspect ratio along its length to match a growing head profile.
    if (!rings.length || point[5] !== rings.at(-1).at(-1)[5] + 1) rings.push([]);
    rings.at(-1).push(point);
  }
  assert(rings.length >= 4 && rings.every(ring => ring.length === rings[0].length),
    'measure complete emitted closing-surface rings without an angular-count assumption');
  const columns = rings[0].map((_, j) => rings.map(ring => {
    const point = ring[j], y = point[1] / reference.a, z = point[2] / reference.b;
    return { position: point.slice(0, 3), radius: Math.hypot(y, z) };
  }));
  const crossings = [];
  for (const column of columns) {
    column.sort((a, b) => b.radius - a.radius);
    for (let i = 1; i < column.length; i++) {
      const first = column[i - 1], next = column[i];
      if (first.radius >= fraction && next.radius < fraction) {
        const t = (first.radius - fraction) / (first.radius - next.radius);
        crossings.push(first.position.map((value, axis) => value + (next.position[axis] - value) * t));
        break;
      }
    }
  }
  const xs = crossings.map(point => point[0]);
  return { fraction, columns: crossings.length, minimumX: Math.min(...xs), maximumX: Math.max(...xs),
    medianX: quantile(xs, .5), interquartileSpread: quantile(xs, .75) - quantile(xs, .25), crossings };
}

function nativeProjectedStagger(art, reach) {
  return [['broadside', [0, 1, 0]], ['dorsal', [0, 0, 1]], ['three-quarter', [.6, 1, .25]]].map(([view, direction]) => {
    const forward = unit(direction), right = Math.abs(forward[2]) > .99 ? [1, 0, 0] : unit(cross(forward, [0, 0, 1]));
    const down = cross(forward, right);
    [art.r00, art.r01, art.r02, art.r10, art.r11, art.r12, art.r20, art.r21, art.r22] = [...right, ...down, ...forward];
    art.scale = 1000 / 7.4; art.objectScale = 1.2; art.perspectiveStrength = .2;
    [art.worldX, art.worldY, art.worldZ] = [-.45, 0, -.6];
    // Subtract a common-X plane at the *same* measured Y/Z positions. Thus
    // perspective/obliqueness cannot make an unchanged flat cap appear lobed.
    const shifts = reach.crossings.map(point => art._project(...point)[0] - art._project(reach.medianX, point[1], point[2])[0]);
    const interquartilePixels = quantile(shifts, .75) - quantile(shifts, .25);
    const spanPixels = Math.max(...shifts) - Math.min(...shifts);
    return { fraction: reach.fraction, view, interquartilePixels, spanPixels,
      interquartileCells: interquartilePixels / art.cellW, spanCells: spanPixels / art.cellW };
  });
}

test('crown closure is rounded and staggered around the arm bases instead of ending on one common wall', t => {
  const art = mounted();
  try {
    const reference = headEnvelopeAt(captureHeadEnvelope(art), 1.0);
    const head = completeCrown(art, 2.4).map(point => [...point.position, 0, 0, point.seed]);
    const reaches = [.95, .85, .70, .50].map(fraction => closingReach(head, reference, fraction));
    const medianClosureLength = reaches.at(-1).medianX - reaches[0].medianX;
    const projectedStagger = reaches.slice(1, 3).flatMap(reach => nativeProjectedStagger(art, reach));
    t.diagnostic(JSON.stringify({ closingSurface: { reaches: reaches.map(({ crossings, ...record }) => record),
      medianClosureLength, projectedStagger } }));
    assert(reaches.every(reach => reach.columns >= 32), 'measure the closing tissue all around the mouth axis');
    for (const record of projectedStagger) {
      // Native-scale resolution, not a candidate coefficient: the angular
      // stagger spans several CSS pixels and grows as roots separate inward.
      const outer = record.fraction === .85;
      assert(record.interquartileCells >= (outer ? .75 : 1),
        `${record.view}: a substantial part of the crown must hand off at visibly different axial positions`);
      assert(record.spanCells >= (outer ? 1.5 : 2), `${record.view}: rounded angular relief must span multiple native columns`);
    }
    assert(medianClosureLength >= .12,
      'the outer crown rolls into the roots over a substantial axial distance rather than a steep short cap');
  } finally { art.destroy(); }
});

const outlineDirections = [
  ['broadside upper', 0, 1], ['broadside lower', 0, -1],
  ['dorsal left', 1, 0], ['dorsal right', -1, 0],
  ['diagonal upper', Math.SQRT1_2, Math.SQRT1_2],
  ['diagonal lower', -Math.SQRT1_2, -Math.SQRT1_2],
];

test('composite crown and proximal-arm silhouettes retain fullness without moving a sharp cutoff forward', t => {
  const art = mounted(), records = [];
  try {
    const reference = headEnvelopeAt(captureHeadEnvelope(art), 1.0);
    for (const time of reviewTimes) for (const grip of [0, .7]) {
      pose(art, grip);
      const head = capture(art, '_head', time);
      const arms = armSections(capture(art, '_arms', time));
      // Returning distal curls can sit behind the crown in projection. They
      // cannot be allowed to conceal an unsupported cap or narrow root here.
      const proximal = arms.slice(0, 8).flatMap(arm => arm.filter(section => section.u <= .30).flatMap(section => section.ring));
      const points = [...head, ...proximal];
      assert(Math.max(...head.map(point => point[0])) <= 1.40,
        'crown tissue stays in the proximal region measured by the continuity check');
      for (const [view, dy, dz] of outlineDirections) {
        const radius = Math.hypot(reference.a * dy, reference.b * dz);
        // A .02 axial half-slab bridges finite sampling without filling a
        // missing root. Each signed side is checked independently: the fuller
        // opposite side must not hide a local cliff in the silhouette.
        const profile = Array.from({ length: 81 }, (_, i) => {
          const x = 1 + i * .005, slice = points.filter(point => Math.abs(point[0] - x) < .02);
          return { x, radius: Math.max(...slice.map(point => point[1] * dy + point[2] * dz)) / radius };
        });
        const drops = profile.slice(0, -10).map((point, i) => ({ x: point.x, drop: point.radius - profile[i + 10].radius }));
        records.push({ time, grip, view, maximumDropOver05X: drops.reduce((a, b) => a.drop > b.drop ? a : b),
          radiusAt120: profile[40].radius, profile: profile.filter((point, i) => i % 10 === 0) });
      }
    }
    t.diagnostic(JSON.stringify({ crownSilhouetteProfiles: records, maximumAllowedDrop: .16 }));
    for (const record of records) {
      assert(record.profile.every(point => Number.isFinite(point.radius)), 'all sampled crown slices have finite supporting tissue');
      assert(record.radiusAt120 >= .82, `${record.view}, time ${record.time}: the arm attachment must retain at least 82% of head fullness`);
      // .005 steps resolve subpixel changes at native demo scale. The old cap
      // loses up to .162 over .05X; the ceiling also catches a moved cliff at
      // the *forward* lobe-to-sleeve join, rather than only testing its rear C1.
      assert(record.maximumDropOver05X.drop <= .16,
        `${record.view}, time ${record.time}, grip ${record.grip}: an abrupt ${record.maximumDropOver05X.drop.toFixed(4)} radius loss remains at x=${record.maximumDropOver05X.x}`);
    }
  } finally { art.destroy(); }
});

const subtract = (a, b) => a.map((value, axis) => value - b[axis]);

test('crown and sleeve lighting uses valid normals that agree with the emitted surface', t => {
  const art = mounted(), savedShade = art._shade, savedPut = art._put;
  const headProfile = captureHeadEnvelope(art);
  let markedUnitSamples = 0, maximumUnitError = 0, minimumNormalLength = Infinity;
  let currentNormal, crownNormalSamples = 0, minimumSurfaceAgreement = 1;
  let minimumJoinNormalAgreement = 1, maximumJoinLevelError = 0;
  try {
    art._shade = (...args) => {
      const normal = args.slice(0, 3), length = Math.hypot(...normal);
      assert(normal.every(Number.isFinite), 'all skin/sleeve lighting normals are finite');
      minimumNormalLength = Math.min(minimumNormalLength, length);
      if (args[5] === true) {
        markedUnitSamples++;
        maximumUnitError = Math.max(maximumUnitError, Math.abs(length - 1));
      }
      currentNormal = unit(normal);
      return savedShade.apply(art, args);
    };
    art._put = () => {};
    for (const time of reviewTimes) for (const grip of [0, .7]) for (const lod of [1, 3]) {
      pose(art, grip); art.geometryStep = lod;
      art._head(time); art._arms(time);
    }
    if (typeof art._crown === 'function') {
      art.geometryStep = 1;
      const points = completeCrown(art, 2.4);
      const rings = [];
      for (const point of points) {
        if (!rings.length || point.seed !== rings.at(-1).at(-1).seed + 1) rings.push([]);
        rings.at(-1).push(point);
      }
      assert(rings.length >= 12 && rings.every(ring => ring.length === rings[0].length), 'measure a complete crown grid');
      for (const point of rings[0]) {
        const reference = headSurfaceReference(headProfile, point.position);
        maximumJoinLevelError = Math.max(maximumJoinLevelError, Math.abs(reference.level - 1));
        const agreement = reference.normal.reduce((sum, value, axis) => sum + value * point.normal[axis], 0);
        minimumJoinNormalAgreement = Math.min(minimumJoinNormalAgreement, agreement);
      }
      for (let i = 1; i < rings.length - 1; i++) for (let j = 0; j < rings[i].length; j++) {
        const ring = rings[i], around = subtract(ring[(j + 1) % ring.length].position, ring[(j + ring.length - 1) % ring.length].position);
        const along = subtract(rings[i + 1][j].position, rings[i - 1][j].position);
        const expected = unit(cross(around, along));
        const agreement = expected.reduce((sum, value, axis) => sum + value * ring[j].normal[axis], 0);
        minimumSurfaceAgreement = Math.min(minimumSurfaceAgreement, agreement); crownNormalSamples++;
      }
      assert(crownNormalSamples > 1000, 'finite differences cover the actual closing surface');
    }
    t.diagnostic(JSON.stringify({ crownLighting: { markedUnitSamples, maximumUnitError, minimumNormalLength,
      crownNormalSamples, minimumSurfaceAgreement, minimumJoinNormalAgreement, maximumJoinLevelError } }));
    assert(markedUnitSamples > 10000 && minimumNormalLength > 1e-8, 'exercise head and moving arm lighting at full/coarse sampling');
    assert(maximumUnitError < 1e-6, 'unit=true must never pass a short cross product or a lengthened taper normal to lighting');
    assert(minimumSurfaceAgreement > .94, 'crown shading normals must agree with finite differences of the emitted tissue');
    assert(maximumJoinLevelError < 1e-6 && minimumJoinNormalAgreement > .9999,
      'crown rear ring must continue the measured growing head surface and tangent without a lighting seam');
  } finally { art._shade = savedShade; art._put = savedPut; art.destroy(); }
});
