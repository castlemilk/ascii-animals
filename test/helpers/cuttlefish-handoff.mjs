import assert from 'node:assert/strict';
import { fakeBrowser } from './fake-browser.mjs';
import { captureHeadEnvelope, headEnvelopeAt } from './cuttlefish-profile.mjs';
import { armSections } from './cuttlefish-arms.mjs';

// Native-scale geometric ownership, independent of material brightness and of
// any authored crown/root formula. The normal contract is checked separately
// against finite differences in cuttlefish-crown.test.mjs.
export const handoffViews = [
  ['broadside', [0, 1, 0]], ['dorsal', [0, 0, 1]],
  ['three-quarter', [.6, 1, .25]], ['frontal', [1, 0, 0]], ['rear', [-1, 0, 0]],
];
export const handoffTimes = [2.4, 4.641509433962264, 6.8];
export const handoffGrips = [0, .7];
export const handoffMethod = {
  nativeCanvas: [1000, 650], density: 1.1, geometryStep: 1,
  cameraScale: 1000 / 7.4, objectScale: 1.2, perspectiveStrength: .2,
  cameraPosition: [-.45, 0, -.6],
  region: { x: [1.02, 1.40], normalizedTransverseRadius: [.55, 1.05], minimumCrownNormalX: .65 },
};
const unit = vector => { const length = Math.hypot(...vector); return vector.map(value => value / length); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function maximumBand(cells, width) {
  let maximumRows = 0, maximumCellCount = 0, startColumn = null;
  for (const start of new Set(cells.map(cell => cell.col))) {
    const inside = cells.filter(cell => cell.col >= start && cell.col < start + width);
    const rows = new Set(inside.map(cell => cell.row));
    if (rows.size > maximumRows || (rows.size === maximumRows && inside.length > maximumCellCount)) {
      maximumRows = rows.size; maximumCellCount = inside.length; startColumn = start;
    }
  }
  return { widthColumns: width, maximumRows, maximumCellCount, startColumn };
}

export function measureCrownHandoff(CuttlefishArtwork, { view, time, grip }, { includeCells = false, primaryRootEndByArm = null } = {}) {
  const direction = handoffViews.find(([name]) => name === view)?.[1];
  assert(direction, `unknown handoff camera ${view}`);
  const host = fakeBrowser(), art = new CuttlefishArtwork(host.canvas(...handoffMethod.nativeCanvas), {
    species: 'cuttlefish', scene: 'reactive', count: 1, size: 1.2,
    sizeVariation: 0, seed: 7, density: handoffMethod.density, mode: 'points', glow: true,
    autoStart: false, paused: true,
  });
  const reference = headEnvelopeAt(captureHeadEnvelope(art), 1.02);
  const camera = art._camera.bind(art), shade = art._shade.bind(art);
  const put = art._put.bind(art), rasterize = art._rasterize.bind(art);
  const forward = unit(direction), right = Math.abs(forward[2]) > .99 ? [1, 0, 0] : unit(cross(forward, [0, 0, 1]));
  const down = cross(forward, right);
  let part = 'other', normal = [0, 0, 0], result;
  const samples = [], armCalls = [];
  for (const [method, label] of [['_body', 'mantle'], ['_head', 'head'], ['_crown', 'crown'],
    ['_eye', 'eye'], ['_arms', 'arms'], ['_beak', 'beak']]) {
    const original = art[method].bind(art);
    art[method] = (...parameters) => {
      const previous = part; part = label;
      try { return original(...parameters); } finally { part = previous; }
    };
  }
  art._camera = elapsed => {
    camera(elapsed);
    [art.r00, art.r01, art.r02, art.r10, art.r11, art.r12, art.r20, art.r21, art.r22] = [...right, ...down, ...forward];
    [art.worldX, art.worldY, art.worldZ] = handoffMethod.cameraPosition;
    art.scale = handoffMethod.cameraScale; art.objectScale = handoffMethod.objectScale;
    art.perspectiveStrength = handoffMethod.perspectiveStrength;
    art.geometryStep = 1; art.encounterGrip = grip; art.encounterFront = grip;
    art.startleTension = 0; art.escapeAmount = 0; art.subjectVisibility = 1;
    for (const [prefix, vector] of [['l', [-.38, -.48, .790]], ['h', [-.204, -.258, .944]]]) {
      art[`${prefix}x`] = art.r00 * vector[0] + art.r10 * vector[1] + art.r20 * vector[2];
      art[`${prefix}y`] = art.r01 * vector[0] + art.r11 * vector[1] + art.r21 * vector[2];
      art[`${prefix}z`] = art.r02 * vector[0] + art.r12 * vector[1] + art.r22 * vector[2];
    }
    [art.vx, art.vy, art.vz] = forward;
  };
  art._shade = (...parameters) => { normal = unit(parameters.slice(0, 3)); return shade(...parameters); };
  art._put = (...parameters) => {
    const sample = art.sampleCount, entry = { part, position: parameters.slice(0, 3), normal, parameters };
    put(...parameters);
    if (art.sampleCount > sample) { entry.sample = sample; samples.push(entry); }
    if (part === 'arms') armCalls.push(entry);
  };
  art._rasterize = () => {
    rasterize();
    assert(art.sampleCount < art.samples.length / 6, 'sample capacity must not clip supporting tissue');
    const armEntry = new Map(armCalls.map(entry => [entry.parameters, entry]));
    for (const arm of armSections(armCalls.map(entry => entry.parameters))) for (const section of arm) {
      for (const point of [...section.ring, ...section.extras]) {
        const rootEnd = primaryRootEndByArm?.[section.arm] ?? .30;
        armEntry.get(point).part = section.arm >= 8 ? 'feeding' : section.u <= rootEnd ? 'primary-root' : 'primary-distal';
      }
    }
    const winners = new Map(), crownPotential = new Map();
    for (const entry of samples) {
      const n = entry.sample * 6;
      const col = Math.floor((art.cx + art.samples[n] * art.scale) / art.cellW);
      const row = Math.floor((art.cyScreen + art.samples[n + 1] * art.scale) / art.cellH);
      if (col < 0 || col >= art.cols || row < 0 || row >= art.rows) continue;
      const index = row * art.cols + col, depth = art.samples[n + 2];
      const cell = { index, col, row, depth, part: entry.part, x: entry.position[0], z: entry.position[2],
        rho: Math.hypot(entry.position[1] / reference.a, entry.position[2] / reference.b), normalX: entry.normal[0] };
      // The real shared ASCII/points raster uses a strict depth comparison:
      // equal-depth ties belong to the first emitted sample.
      if (depth === art.depth[index] && !winners.has(index)) winners.set(index, cell);
      if (entry.part === 'crown' && (!crownPotential.has(index) || depth > crownPotential.get(index).depth)) crownPotential.set(index, cell);
    }
    assert.equal(winners.size, art.depth.reduce((count, depth) => count + (depth !== -Infinity), 0),
      'every real final depth cell must have exactly one identified owner');
    const { region } = handoffMethod;
    const peripheral = cell => cell.x >= region.x[0] && cell.x <= region.x[1]
      && cell.rho >= region.normalizedTransverseRadius[0] && cell.rho <= region.normalizedTransverseRadius[1];
    const forwardCrown = cell => peripheral(cell) && cell.part === 'crown' && cell.normalX >= region.minimumCrownNormalX;
    const potential = [...crownPotential.values()].filter(forwardCrown);
    const exposed = [...winners.values()].filter(forwardCrown);
    // Only actual proximal primary-arm winners count as root support. Distal
    // curls, feeding tentacles, and a brighter material cannot improve it.
    const supported = potential.filter(cell => winners.get(cell.index)?.part === 'primary-root' && winners.get(cell.index).depth > cell.depth);
    const localRoot = [...winners.values()].filter(cell => peripheral(cell) && cell.part === 'primary-root');
    const bandPopulation = [...winners.values()].filter(cell => peripheral(cell) && ['crown', 'primary-root'].includes(cell.part));
    const upper = cell => cell.z >= reference.b * .45;
    const upperPotential = potential.filter(upper), upperExposed = exposed.filter(upper), upperSupported = supported.filter(upper);
    result = { view, time, grip, grid: [art.cols, art.rows], cell: [art.cellW, art.cellH],
      emittedSamples: art.sampleCount, winningCells: winners.size, potentialForwardCrownCells: potential.length,
      exposedForwardCrownCells: exposed.length, primaryRootOccludesCrownCells: supported.length,
      primaryRootOcclusionFraction: potential.length ? supported.length / potential.length : null,
      localPrimaryRootCells: localRoot.length, localRootAndCrownCells: bandPopulation.length,
      exposedCrownFraction: bandPopulation.length ? exposed.length / bandPopulation.length : null,
      exposedDistinctRows: new Set(exposed.map(cell => cell.row)).size,
      bands: [1, 2, 3].map(width => maximumBand(exposed, width)),
      upper: { minimumNormalizedHeight: .45, potentialForwardCrownCells: upperPotential.length,
        exposedForwardCrownCells: upperExposed.length, primaryRootOccludesCrownCells: upperSupported.length,
        primaryRootOcclusionFraction: upperPotential.length ? upperSupported.length / upperPotential.length : null,
        primaryRootCells: localRoot.filter(upper).length, bands: [1, 2, 3].map(width => maximumBand(upperExposed, width)) } };
    if (includeCells) result.exposedCells = exposed.map(({ index, depth, part, ...cell }) => cell);
  };
  try {
    art.time = time; art.elapsed = time;
    for (const fish of art.fish) fish.sceneTime = time;
    art.render(); assert(result, 'the real renderer must produce a final cell buffer');
    return result;
  } finally { art.destroy(); }
}
