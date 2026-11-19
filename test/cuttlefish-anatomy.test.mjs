import test from 'node:test';
import assert from 'node:assert/strict';
import { CuttlefishArtwork } from '../src/animals/cuttlefish.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';
import { captureEyeHost, eyeHostReference } from './helpers/cuttlefish-eye-host.mjs';

// Geometry/lighting/depth tests against the actual renderer. The fake browser
// deliberately makes no claim about glyph pixels, anatomy recognition or FPS.
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const unit = a => { const length = Math.hypot(...a); return a.map(value => value / length); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const close = (a, b, message, epsilon = 1e-9) => assert(Math.abs(a - b) <= epsilon, `${message}: ${a} versus ${b}`);
const pupil = point => point.light < .03;

function mounted(options = {}, width = 1200, height = 800) {
  const browser = fakeBrowser();
  const art = new CuttlefishArtwork(browser.canvas(width, height), {
    count: 1, species: 'cuttlefish', scene: 'reactive', size: 1,
    sizeVariation: 0, autoStart: false, paused: true, glow: false,
    ...options,
  });
  return { art, browser };
}

function pose(art, direction, overrides = {}) {
  const view = unit(direction);
  const right = unit(cross(Math.abs(view[2]) < .95 ? [0, 0, 1] : [0, 1, 0], view));
  const down = cross(view, right);
  Object.assign(art, {
    r00: right[0], r01: right[1], r02: right[2],
    r10: down[0], r11: down[1], r12: down[2],
    r20: view[0], r21: view[1], r22: view[2],
    worldX: 0, worldY: 0, worldZ: 0, objectScale: 1,
    perspectiveStrength: 0, scale: 400, cellW: 5, cellH: 5, geometryStep: 1,
    ...overrides,
  });
}

function captureEye(art, side, actualLighting = false) {
  const savedPut = art._put, savedShade = art._shade;
  const points = [];
  let normal;
  try {
    art._shade = (nx, ny, nz) => {
      normal = [nx, ny, nz];
      return actualLighting ? savedShade.call(art, nx, ny, nz) : .5;
    };
    art._put = (x, y, z, light, kind, seed) => {
      assert([x, y, z, light, kind, seed, ...normal].every(Number.isFinite));
      points.push({ position: [x, y, z], normal, light, kind, seed });
    };
    art._eye(side);
  } finally {
    art._put = savedPut; art._shade = savedShade;
  }
  return points;
}

function headLevel(position, profile) {
  return eyeHostReference(profile, position).level ** 2;
}

test('cuttlefish eyes have equal paired footprints and follow each local head/crown surface', () => {
  const { art } = mounted();
  const profile = captureEyeHost(art);
  try {
    const tilt = 20 * Math.PI / 180;
    pose(art, [0, Math.cos(tilt), Math.sin(tilt)]);
    const right = captureEye(art, 1);
    pose(art, [0, -Math.cos(tilt), Math.sin(tilt)]);
    const left = captureEye(art, -1);
    assert(right.length > 1000, 'adequate-scale eye has a sampled surface');
    assert.equal(left.length, right.length, 'paired eyes receive the same detail');
    for (let i = 0; i < right.length; i++) {
      close(left[i].position[0], right[i].position[0], 'paired anterior eye placement');
      if (right[i].position[0] <= profile.crown.joinX) {
        for (let axis = 0; axis < 3; axis++) {
          const reflection = axis === 1 ? -1 : 1;
          close(left[i].position[axis], reflection * right[i].position[axis], 'mirrored head-supported eye position');
          close(left[i].normal[axis], reflection * right[i].normal[axis], 'mirrored head-supported eye normal');
        }
      } else {
        // The anterior rim follows the existing slight left/right crown
        // stagger. Compare its chart coordinates and recess, not false world
        // symmetry that would force one eye off its actual support surface.
        const l = eyeHostReference(profile, left[i].position), r = eyeHostReference(profile, right[i].position);
        const foldedAngle = angle => Math.atan2(Math.sin(angle), Math.abs(Math.cos(angle)));
        close(foldedAngle(l.angle), foldedAngle(r.angle), 'paired crown-supported eye angle', .00005);
        close(l.level, r.level, 'paired crown-supported recess', .00005);
        const disparity = Math.hypot(left[i].position[0] - right[i].position[0],
          left[i].position[1] + right[i].position[1], left[i].position[2] - right[i].position[2]);
        assert(disparity < .002, 'host stagger cannot create visibly unequal eye sizes');
      }
      assert.equal(left[i].light, right[i].light, 'the aperture is mirrored with its surface');
    }
    for (const [side, points] of [[1, right], [-1, left]]) {
      const dark = points.filter(pupil);
      assert(dark.length > 50);
      assert(dark.every(p => side * p.position[1] > .30), 'pupil lies on a lateral head surface');
      assert(dark.every(p => p.position[0] > .30 && p.position[0] < 1.24), 'pupil stays between mantle and arm crown');
      assert(dark.every(p => {
        const angle = eyeHostReference(profile, p.position).angle;
        return Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));
      }), 'pupil stays on the measured lateral quadrant, not on the dorsal centerline');
      assert(dark.every(p => eyeHostReference(profile, p.position).outward <= .00004), 'aperture stays within the actual sampled host envelope');
      assert(dark.some(p => headLevel(p.position, profile) < .995), 'aperture is actually recessed into its socket');
    }

    // Each sampled patch blends back into the original envelope. A separate
    // spherical cap can bury its perimeter while its center still protrudes;
    // therefore test the entire patch, not just a tangent rim (the old check).
    const levels = right.map(p => headLevel(p.position, profile));
    assert(right.every(p => eyeHostReference(profile, p.position).outward <= .00004),
      'neither iris nor lid adds a raised button (sampled-host interpolation budget .00004 model units)');
    assert(Math.max(...levels) > .995, 'the patch meets the surrounding head surface');
    assert(Math.min(...levels) < .995, 'the socket contains an inward depression');
  } finally { art.destroy(); }
});

test('eye surfaces cull against the actual perspective camera, including off-axis close views', () => {
  const { art } = mounted();
  try {
    let checked = 0;
    const counts = new Set();
    for (const direction of [[0, 1, .35], [0, -1, .35], [1, .1, .2], [-1, .2, -.1], [.2, .3, 1]]) {
      for (const perspectiveStrength of [0, .2]) for (const worldX of [-1.3, 1.3]) {
        pose(art, direction, { perspectiveStrength, worldX, worldY: .8, worldZ: .9, objectScale: 1.4 });
        for (const side of [-1, 1]) {
          const points = captureEye(art, side);
          counts.add(points.length);
          for (const point of points) {
            const [nx, ny, nz] = point.normal;
            const normal = [
              nx * art.r00 + ny * art.r01 + nz * art.r02,
              nx * art.r10 + ny * art.r11 + nz * art.r12,
              nx * art.r20 + ny * art.r21 + nz * art.r22,
            ];
            const world = art._world(...point.position);
            const towardCamera = perspectiveStrength
              ? [-world[0], -world[1], 1 / perspectiveStrength - world[2]] : [0, 0, 1];
            assert(dot(normal, towardCamera) > -1e-9, 'no rear-facing surface reaches the depth buffer');
            checked++;
          }
        }
      }
    }
    assert(checked > 10000);
    assert(counts.size >= 3 && counts.has(0), 'camera changes distinguish culled, partial and visible eye surfaces');
    pose(art, [0, 1, 0]);
    assert(captureEye(art, 1).filter(pupil).length > 50, 'near lateral aperture remains visible');
    assert.equal(captureEye(art, -1).filter(pupil).length, 0, 'far pupil cannot paint through the head');
    pose(art, [0, -1, 0]);
    assert(captureEye(art, -1).filter(pupil).length > 50);
    assert.equal(captureEye(art, 1).filter(pupil).length, 0);
  } finally { art.destroy(); }
});

test('adequate-scale pupil has two subtle W troughs; tiny pupils simplify along the same head surface', () => {
  const { art } = mounted();
  try {
    pose(art, [0, Math.cos(Math.PI / 9), Math.sin(Math.PI / 9)]);
    const points = captureEye(art, 1), dark = points.filter(pupil);
    // Unwrap the emitted head section independently of the eye implementation.
    // This separates the aperture shape from the curvature of the head itself.
    const profile = captureEyeHost(art);
    const angle = p => eyeHostReference(profile, p.position).angle;
    const xs = dark.map(p => p.position[0]);
    const center = (Math.min(...xs) + Math.max(...xs)) / 2;
    const radius = (Math.max(...xs) - Math.min(...xs)) / 2;
    function band(offset) {
      const selected = dark.filter(p => Math.abs((p.position[0] - center) / radius - offset) < .10);
      assert(selected.length >= 5, `pupil band ${offset} has adequate samples`);
      return selected.reduce((sum, p) => sum + angle(p), 0) / selected.length;
    }
    const leftEdge = band(-.9), leftTrough = band(-.5), middle = band(0), rightTrough = band(.5), rightEdge = band(.9);
    assert(middle - leftTrough > .04 && middle - rightTrough > .04,
      'two resolved troughs flank the center peak');
    assert(leftEdge - leftTrough > .035 && rightEdge - rightTrough > .035,
      'both pupil ends rise toward the corners');
    close(leftTrough, rightTrough, 'mirrored trough angular heights', .025);
    assert(points.filter(p => !pupil(p)).every(p => p.light > .03),
      'the iris and surrounding tissue remain distinct from the dark aperture');

    pose(art, [0, Math.cos(Math.PI / 9), Math.sin(Math.PI / 9)], { scale: 30, cellW: 6, cellH: 8, geometryStep: 3 });
    const small = captureEye(art, 1).filter(pupil);
    assert(small.length >= 5, 'coarse detail retains a bounded aperture');
    // A subcell slit may be widened to survive the final depth raster. Check
    // that its centerline simplifies rather than prescribing an invisible
    // physical thickness at low resolution.
    const columns = new Map();
    for (const point of small) {
      const key = point.position[0].toFixed(8);
      const values = columns.get(key) || [];
      values.push(angle(point)); columns.set(key, values);
    }
    assert(columns.size >= 3, 'simplified opening spans multiple lateral samples');
    const midpoints = [...columns.values()].map(values => (Math.min(...values) + Math.max(...values)) / 2);
    assert(Math.max(...midpoints) - Math.min(...midpoints) < .10,
      'tiny opening has a level centerline without false W troughs');
    const centerline = midpoints.reduce((sum, value) => sum + value, 0) / midpoints.length;
    const socketAngles = points.map(angle);
    const socketCenter = (Math.min(...socketAngles) + Math.max(...socketAngles)) / 2;
    assert(Math.abs(centerline - socketCenter) < .05,
      'the simplified aperture stays centered on its measured socket after the surface turn');
  } finally { art.destroy(); }
});

test('ASCII/particle mode and palette changes preserve the same eye geometry and depth', () => {
  const { art } = mounted({ size: 1.4, density: 1.5 });
  try {
    art.time = 4.2; art.fish[0].sceneTime = 4.2;
    let reference;
    for (const mode of ['ascii', 'points']) for (const palette of ['lagoon', 'ultraviolet', 'ember']) {
      art.setOptions({ mode, palette }); art.render();
      const state = { samples: Array.from(art.samples.subarray(0, art.sampleCount * 6)),
        depth: Array.from(art.depth), tones: Array.from(art.tones), glyphs: Array.from(art.glyphs), owners: Array.from(art.owners) };
      if (reference) assert.deepEqual(state, reference, `${mode}/${palette} changes appearance without relocating anatomy`);
      else reference = state;
    }
  } finally { art.destroy(); }
});

test('local eye normals respond to lighting while the pupil remains a dark opening', () => {
  const { art } = mounted();
  try {
    const axis = unit([0, 1, .35]);
    pose(art, axis);
    Object.assign(art, { vx: axis[0], vy: axis[1], vz: axis[2] });
    // Identify the aperture under neutral light. A real lid crease can become
    // dark in shadow, so brightness in a lit/shaded render is not its identity.
    const neutral = captureEye(art, 1);
    const captures = [];
    for (const sign of [1, -1]) {
      Object.assign(art, {
        lx: sign * axis[0], ly: sign * axis[1], lz: sign * axis[2],
        hx: sign * axis[0], hy: sign * axis[1], hz: sign * axis[2],
      });
      captures.push(captureEye(art, 1, true));
    }
    const [lit, shaded] = captures;
    assert.equal(lit.length, shaded.length);
    let response = 0, litSurfaces = 0;
    for (let i = 0; i < lit.length; i++) {
      assert.deepEqual(lit[i].position, shaded[i].position, 'lighting does not relocate the eye');
      assert.deepEqual(lit[i].normal, shaded[i].normal, 'normals belong to the geometry');
      if (pupil(neutral[i])) {
        assert.equal(shaded[i].light, lit[i].light, 'dark aperture is not filled by a highlight');
      } else {
        assert(lit[i].light >= shaded[i].light, 'head-facing illumination brightens the iris and lid tissue');
        response += lit[i].light - shaded[i].light; litSurfaces++;
      }
    }
    assert(response / litSurfaces > .2, 'curved iris and skin respond to the surface light direction');
  } finally { art.destroy(); }
});

test('eye geometry remains finite and within the existing per-animal sample budget in large moving scenes', () => {
  const { art, browser } = mounted({ size: 1.4, sizeVariation: 1, density: 1.5, depthStrength: 2, count: 4 });
  const originalPut = art._put, originalRasterize = art._rasterize;
  let total = 0, maxSamples = 0, rasterized = 0;
  try {
    art._put = function (...args) {
      assert(args.every(Number.isFinite), 'all anatomy samples are finite');
      assert(this.sampleCount < 36000, 'no anatomy is silently truncated by the sample capacity');
      total++; return originalPut.apply(this, args);
    };
    art._rasterize = function () {
      maxSamples = Math.max(maxSamples, this.sampleCount); rasterized++;
      return originalRasterize.call(this);
    };
    for (const scene of ['reactive', 'swimby', 'encounter']) {
      art.setOptions({ scene, behaviors: scene === 'encounter' ? ['encounter'] : [] });
      for (const time of [2.5, 6.8, 10.2]) {
        art.time = time;
        for (const fish of art.fish) fish.sceneTime = time;
        art.render();
        for (const z of art.depth) assert(z === -Infinity || Number.isFinite(z));
      }
    }
    assert(rasterized >= 36); assert(total > 100000); assert(maxSamples > 15000 && maxSamples < 36000);
  } finally {
    art._put = originalPut; art._rasterize = originalRasterize; art.destroy();
  }
  assert.equal(browser.pending, 0);
});


// This regression follows aperture samples through the *real* depth raster.
// Merely emitting dark samples is insufficient: adjacent iris samples can win
// the same character cell and erase an otherwise valid low-resolution slit.
function finalApertureCells(art, scenario) {
  const camera = art._camera.bind(art);
  if (scenario.direction) {
    const view = unit(scenario.direction);
    const right = unit(cross(view, [0, 0, 1]));
    const down = cross(view, right);
    art._camera = time => {
      camera(time);
      [art.r00, art.r01, art.r02, art.r10, art.r11, art.r12, art.r20, art.r21, art.r22] = [...right, ...down, ...view];
      [art.worldX, art.worldY, art.worldZ] = scenario.position || [-.45, 0, -.6];
      art.scale = scenario.scale || Math.min(art.width / 7.4, art.height / 4.6);
      art.objectScale = scenario.objectScale || 1.2;
      art.perspectiveStrength = .2;
      const radius = art.objectScale * art.scale / Math.max(.24, 1 - art.worldZ * art.perspectiveStrength);
      art.geometryStep = radius > 105 ? 1 : radius > 46 ? 2 : 3;
      art.encounterGrip = 0; art.encounterFront = 0; art.subjectVisibility = 1;
      for (const [prefix, vector] of [['l', [-.38, -.48, .790]], ['h', [-.204, -.258, .944]]]) {
        art[`${prefix}x`] = art.r00 * vector[0] + art.r10 * vector[1] + art.r20 * vector[2];
        art[`${prefix}y`] = art.r01 * vector[0] + art.r11 * vector[1] + art.r21 * vector[2];
        art[`${prefix}z`] = art.r02 * vector[0] + art.r12 * vector[1] + art.r22 * vector[2];
      }
      art.vx = art.r20; art.vy = art.r21; art.vz = art.r22;
    };
  }
  const eye = art._eye.bind(art), put = art._put.bind(art), rasterize = art._rasterize.bind(art);
  let side = 0;
  const apertureSamples = [], eyePositions = [], results = [];
  art._eye = value => {
    side = value;
    try { eye(value); } finally { side = 0; }
  };
  art._put = (...args) => {
    const sample = art.sampleCount;
    put(...args);
    if (side && art.sampleCount > sample) {
      eyePositions.push(art._project(...args.slice(0, 3)));
      if (args[3] < .03) apertureSamples.push({ sample, side });
    }
  };
  art._rasterize = () => {
    rasterize();
    const candidateCells = new Set(), winningCells = new Map();
    for (const { sample, side: eyeSide } of apertureSamples) {
      const offset = sample * 6;
      const col = Math.floor((art.cx + art.samples[offset] * art.scale) / art.cellW);
      const row = Math.floor((art.cyScreen + art.samples[offset + 1] * art.scale) / art.cellH);
      if (col < 0 || col >= art.cols || row < 0 || row >= art.rows) continue;
      const index = row * art.cols + col;
      candidateCells.add(index);
      // The final cell must still have this aperture's exact depth *and* dark
      // tone. We do not duplicate the renderer's competing-sample selection.
      if (art.depth[index] === art.samples[offset + 2] && art.tones[index] <= 1) {
        winningCells.set(index, { col, row, side: eyeSide });
      }
    }
    const xs = eyePositions.map(point => point[0]), ys = eyePositions.map(point => point[1]);
    results.push({ name: scenario.name, mode: art.options.mode,
      footprintCells: [(Math.max(...xs) - Math.min(...xs)) / art.cellW,
        (Math.max(...ys) - Math.min(...ys)) / art.cellH],
      emittedApertureSamples: apertureSamples.length, candidateCells: candidateCells.size,
      winningCells: [...winningCells.values()] });
  };
  art.time = 2.4; art.elapsed = 2.4;
  for (const fish of art.fish) fish.sceneTime = 2.4;
  art.render();
  assert.equal(results.length, 1);
  return results[0];
}

test('resolved W and simplified native/mobile slit survive the final ASCII and points depth cells', t => {
  const scenarios = [
    { name: 'resolving-oblique', direction: [0, 1, .18], width: 1000, height: 650,
      density: 1.5, scale: 400, objectScale: 1, position: [-.48, .085, -.6], minCells: 12 },
    { name: 'resolving-broadside', direction: [0, 1, 0], width: 1000, height: 650,
      density: 1.5, scale: 400, objectScale: 1, position: [-.48, .085, -.6], minCells: 12 },
    { name: 'native-broadside', direction: [0, 1, 0], width: 1000, height: 650, density: 1.1, minCells: 2 },
    { name: 'native-reactive', width: 1000, height: 650, density: 1.1, minCells: 2 },
    { name: 'mobile-broadside', direction: [0, 1, 0], width: 349, height: 440, density: 1.1, minCells: 1 },
    { name: 'mobile-reactive', width: 349, height: 440, density: 1.1, minCells: 1 },
  ];
  const records = [];
  for (const scenario of scenarios) {
    let reference;
    for (const mode of ['ascii', 'points']) {
      const { art } = mounted({ size: 1.2, seed: 7, density: scenario.density, mode }, scenario.width, scenario.height);
      try {
        const result = finalApertureCells(art, scenario);
        records.push({ ...result, winningCells: result.winningCells.length });
        assert(result.footprintCells[0] >= 3 && result.footprintCells[1] >= 2,
          `${scenario.name}: this case must resolve an eye footprint, not an arbitrarily tiny specimen`);
        assert(result.winningCells.length >= scenario.minCells,
          `${scenario.name}/${mode}: only ${result.winningCells.length} pupil cells survived the actual depth buffer`);
        assert(result.winningCells.every(cell => cell.side === 1), 'far-side pupil cannot bleed through the head');
        if (reference) assert.deepEqual(result.winningCells, reference, 'ASCII and points retain identical aperture cells');
        else reference = result.winningCells;
      } finally { art.destroy(); }
    }
  }
  t.diagnostic(JSON.stringify({ finalApertureRaster: records }));
});
