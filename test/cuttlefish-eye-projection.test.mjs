import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { fakeBrowser } from './helpers/fake-browser.mjs';
import { captureEyeHost, eyeHostReference, sampleEyeHost } from './helpers/cuttlefish-eye-host.mjs';

// Optional diagnostic: point at the *actual* prior source to demonstrate that
// the regression catches its protruding eye. Normal npm test uses this source.
const source = process.env.CUTTLEFISH_PROJECTION_SOURCE
  ? pathToFileURL(process.env.CUTTLEFISH_PROJECTION_SOURCE)
  : new URL('../src/animals/cuttlefish.js', import.meta.url);
const { CuttlefishArtwork } = await import(source.href);
const unit = v => { const length = Math.hypot(...v); return v.map(n => n / length); };
const dot = (a, b) => a.reduce((n, value, i) => n + value * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function mounted() {
  const browser = fakeBrowser();
  const art = new CuttlefishArtwork(browser.canvas(1000, 650), {
    species: 'cuttlefish', count: 1, scene: 'reactive', size: 1,
    sizeVariation: 0, autoStart: false, paused: true, glow: false,
  });
  return art;
}

function pose(art, direction, options = {}) {
  const view = unit(direction);
  const right = unit(cross(Math.abs(view[2]) < .95 ? [0, 0, 1] : [0, 1, 0], view));
  const down = cross(view, right);
  Object.assign(art, {
    r00: right[0], r01: right[1], r02: right[2],
    r10: down[0], r11: down[1], r12: down[2],
    r20: view[0], r21: view[1], r22: view[2],
    worldX: 0, worldY: 0, worldZ: 0, objectScale: 1,
    perspectiveStrength: 0, scale: 140, cellW: 5, cellH: 7, geometryStep: 1,
    ...options,
  });
}

function capture(art) {
  const put = art._put, shade = art._shade, points = [];
  let normal;
  try {
    art._shade = (nx, ny, nz) => { normal = unit([nx, ny, nz]); return .5; };
    art._put = (x, y, z, light) => points.push({ position: [x, y, z], normal, light });
    art._eye(-1); art._eye(1);
  } finally { art._put = put; art._shade = shade; }
  return points;
}

// Independent reference: reconstructed from head skin and the intact sampled
// crown grid, never the eye center, footprint, lid formula or depression depth. The separate head
// profile regression rejects a pinched head even if its eyes follow that pinch.
const directions = Array.from({ length: 96 }, (_, i) => [Math.cos(i / 96 * Math.PI * 2), Math.sin(i / 96 * Math.PI * 2)]);
function supports(points) {
  const values = directions.map(() => -Infinity);
  for (const [x, y] of points) for (let i = 0; i < directions.length; i++) {
    const [dx, dy] = directions[i];
    values[i] = Math.max(values[i], x * dx + y * dy);
  }
  return values;
}
function projectedHead(art, profile) {
  // Dense reconstruction: the <=0.12px allowance accounts for finite head-ring
  // interpolation/angular sampling, not a whole character-cell protrusion.
  return supports(sampleEyeHost(profile).map(point => art._project(...point)));
}
function outwardPixels(art, points, head) {
  const eye = supports(points.map(p => art._project(...p.position)));
  return Math.max(...eye.map((value, i) => value - head[i]));
}

const cameras = [
  ['broadside', [0, 1, 0]],
  ['opposite broadside', [0, -1, 0]],
  ['three-quarter', [1, 1, .35]],
  ['opposite three-quarter', [1, -1, .35]],
  ['head-on', [1, 0, 0]],
  ['dorsal', [0, 0, 1]],
  ['rear oblique', [-1, 1, .35]],
];

test('paired eye footprints move forward from the exact approved V5 placement without changing their size', t => {
  const baseline = JSON.parse(readFileSync(new URL('./fixtures/cuttlefish-crown-roots-v5-head-oracle.json', import.meta.url), 'utf8'));
  assert.equal(baseline.sourceCommit, 'd638880513978c63b8cb1dfc97101463baa22966');
  const art = mounted(), measurements = [];
  try {
    for (const before of baseline.eyeFootprints) {
      pose(art, [0, before.side, 0], { scale: 400, cellW: 5, cellH: 5 });
      const points = capture(art).filter(point => Math.sign(point.position[1]) === before.side);
      const xs = points.map(point => point.position[0]), minimumX = Math.min(...xs), maximumX = Math.max(...xs);
      const centerX = (minimumX + maximumX) / 2, spanX = maximumX - minimumX;
      const advance = centerX - before.centerX;
      measurements.push({ side: before.side, baselineCenterX: before.centerX, centerX, advance, spanX,
        baselineSpanX: before.spanX });
      assert(points.length > 1000, 'measure a resolving-scale surface footprint');
      // A visible but local authored advance (~8 native desktop pixels at the
      // lower bound), not a distance inferred from the reference photograph.
      assert(advance >= .05 && advance <= .14, 'move the whole socket forward rather than changing only its dark pupil');
      assert(Math.abs(spanX / before.spanX - 1) <= .05, 'forward placement must not shrink or enlarge the eye footprint');
    }
    assert(Math.abs(measurements[0].advance - measurements[1].advance) < 1e-9, 'both eyes move together');
    t.diagnostic(JSON.stringify({ forwardEyePlacement: { baselineCommit: baseline.sourceCommit, measurements } }));
  } finally { art.destroy(); }
});

test('recessed eye samples stay inside the emitted head envelope and follow its local normal', t => {
  const art = mounted(), profile = captureEyeHost(art);
  let samples = 0, maximumOutward = -Infinity, maximumInward = 0, maximumLevel = 0, minimumNormalAlignment = 1;
  try {
    for (const [name, direction] of cameras) {
      pose(art, direction, { scale: 400, cellW: 5, cellH: 5 });
      for (const point of capture(art)) {
        const [x] = point.position;
        assert(x > .30 && x < 1.24, `${name}: eye remains in head span`);
        const reference = eyeHostReference(profile, point.position);
        maximumOutward = Math.max(maximumOutward, reference.outward);
        maximumInward = Math.max(maximumInward, -reference.outward);
        maximumLevel = Math.max(maximumLevel, reference.level);
        minimumNormalAlignment = Math.min(minimumNormalAlignment, dot(point.normal, reference.normal));
        samples++;
      }
    }
    t.diagnostic(JSON.stringify({ samples, maximumOutwardModelUnits: maximumOutward, hostInterpolationAllowance: .00004,
      maximumInwardModelUnits: maximumInward, maximumNormalizedHeadRadius: maximumLevel, minimumNormalAlignment }));
    assert(samples > 1000, 'test measures actual emitted surfaces');
    assert(maximumOutward <= .00004,
      `eye projects ${maximumOutward.toFixed(6)} model units beyond the supporting head`);
    assert(maximumInward <= .025, 'socket is shallow and stays attached to head tissue');
    assert(minimumNormalAlignment >= .85,
      'eye normals follow the local head rather than a separate spherical cap');
    assert(maximumInward > .0001, 'some aperture/socket is recessed, rather than an unchanged raised eye');
  } finally { art.destroy(); }
});

test('eyes add no outward silhouette at demo/mobile scale, including perspective and off-axis cameras', t => {
  const art = mounted(), profile = captureEyeHost(art), measurements = [];
  try {
    for (const [name, direction] of cameras) {
      for (const lens of [
        { name: 'demo', scale: 140, cellW: 5, cellH: 7, perspectiveStrength: 0 },
        { name: 'mobile', scale: 45, cellW: 5, cellH: 7, geometryStep: 3, perspectiveStrength: 0 },
        { name: 'close off-axis', scale: 170, worldX: 1.1, worldY: .7, worldZ: .8,
          objectScale: 1.4, perspectiveStrength: .20 },
      ]) {
        pose(art, direction, lens);
        const points = capture(art);
        if (!points.length) { measurements.push({ view: name, camera: lens.name, samples: 0 }); continue; }
        const head = projectedHead(art, profile), maximumOutwardPixels = outwardPixels(art, points, head);
        measurements.push({ view: name, camera: lens.name, samples: points.length,
          maximumOutwardPixels: Number(maximumOutwardPixels.toFixed(6)) });
      }
    }
    // Independent sensitivity control: an exposed lateral button should fail
    // this same metric, even though its rim could be embedded in the head.
    pose(art, [1, 0, 0]);
    // Locate the control beyond the measured host, so a legitimate wider head
    // cannot turn the fixed sensitivity point into an internal point.
    const control = [{ position: [.78, Math.max(...profile.profile.map(ring => ring.a)) + .12, 0] }];
    assert(outwardPixels(art, control, projectedHead(art, profile)) > 10,
      'silhouette metric must reject a protruding eye, not merely record zero');
    t.diagnostic(JSON.stringify({ tolerancePixels: .12, measurements }));
    for (const measurement of measurements) if (measurement.samples) {
      assert(measurement.maximumOutwardPixels <= .12,
        `${measurement.view}/${measurement.camera}: eye enlarges head silhouette by ${measurement.maximumOutwardPixels.toFixed(3)}px`);
    }
  } finally { art.destroy(); }
});
