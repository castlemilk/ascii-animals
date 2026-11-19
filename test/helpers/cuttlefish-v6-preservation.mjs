import { createHash } from 'node:crypto';
import { armSections } from './cuttlefish-arms.mjs';

// Explicitly authorized V6 -> V7 socket-hole union. These coordinates are a
// scope declaration, never read from candidate eye constants or formulas.
export const v7SocketHoleUnion = Object.freeze({
  before: Object.freeze({ x: .87, angle: .18 }),
  after: Object.freeze({ x: .90, angle: .52 }),
  halfX: .205, halfAngle: .31, removedSkinRadius: .92,
});
export const v6PreservationPoses = Object.freeze(
  [2.4, 4.641509433962264, 6.8].flatMap(time =>
    [1, 2, 3].flatMap(lod => [0, .7].map(grip => Object.freeze({ time, lod, grip })))),
);

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function sampleFingerprint(points) {
  return { samples: points.length, sha256: hash(JSON.stringify(points)) };
}
export function bufferFingerprint(array) {
  const width = array.BYTES_PER_ELEMENT;
  if (width !== 4 && width !== 8) throw new Error('Expected floating-point geometry buffer');
  // Canonical little-endian serialization preserves every IEEE bit (including
  // signed zero), independent of the machine's native byte order.
  const bytes = Buffer.alloc(array.length * width);
  for (let i = 0; i < array.length; i++) {
    if (!Number.isFinite(array[i])) throw new Error('Non-finite cached host sample');
    if (width === 4) bytes.writeFloatLE(array[i], i * width);
    else bytes.writeDoubleLE(array[i], i * width);
  }
  return { elements: array.length, bytes: bytes.length, encoding: `float${width * 8}-le`, sha256: hash(bytes) };
}

function pose(art, { time, lod, grip }) {
  art.time = time; art.elapsed = time;
  art._activateFish(art.fish[0]); art.sceneTime = time; art._camera(time);
  art.geometryStep = lod; art.encounterGrip = grip; art.encounterFront = grip;
  art.startleTension = .25; art.escapeAmount = .15; art._cacheNormals();
}
function capture(art, callback) {
  const saved = art._put, points = [];
  try {
    art._put = (...point) => points.push(point);
    callback();
    if (!points.every(point => point.length === 6 && point.every(Number.isFinite))) {
      throw new Error('Expected complete finite emitted samples');
    }
  } finally { art._put = saved; }
  return points;
}
function headSkin(art, time) {
  const savedCrown = art._crown;
  try { art._crown = () => {}; return capture(art, () => art._head(time)); }
  finally { art._crown = savedCrown; }
}
function outsideSocketUnion(sample, seedOffset) {
  // Recover the angular station from the stable sampling seed. Using its
  // chart angle avoids fitting a lobed crown as an ellipse or inferring angle
  // from candidate normals. The 88-column, 101-stride seed schema is pinned
  // to this exact V6 fixture and asserted rather than silently generalized.
  const seed = sample[5] - seedOffset, column = seed % 101;
  if (!Number.isInteger(seed) || seed < 0 || column < 0 || column >= 88) {
    throw new Error('Head/crown station seed schema changed');
  }
  const phi = column / 88 * Math.PI * 2;
  const angle = Math.atan2(Math.sin(phi), Math.abs(Math.cos(phi)));
  const mask = v7SocketHoleUnion;
  return [mask.before, mask.after].every(center => {
    const u = (sample[0] - center.x) / mask.halfX;
    const v = (angle - center.angle) / mask.halfAngle;
    return u * u + v * v >= mask.removedSkinRadius ** 2 - 1e-12;
  });
}
function flatten(sections) { return sections.flatMap(section => [...section.ring, ...section.extras]); }

export function captureV6PreservedParts(art, requestedPose) {
  pose(art, requestedPose);
  const { time, lod } = requestedPose, savedHead = art._head, savedEye = art._eye;
  let mantleAndFins;
  try {
    art._head = () => {}; art._eye = () => {};
    mantleAndFins = capture(art, () => art._body(time));
  } finally { art._head = savedHead; art._eye = savedEye; }
  const arms = armSections(capture(art, () => art._arms(time)), lod);
  if (arms.length !== 10) throw new Error('All eight arms and both feeding tentacles must be sampled');
  const primary = Object.fromEntries(arms.slice(0, 8).map((sections, arm) => [`completePrimaryArm${arm}`, flatten(sections)]));
  return {
    mantleAndFins,
    ...primary,
    completeFeedingTentacles: arms.slice(8).flatMap(flatten),
    beak: capture(art, () => art._beak(time)),
    headSkinOutsideSocketUnion: headSkin(art, time).filter(point => outsideSocketUnion(point, 0)),
    crownSkinOutsideSocketUnion: capture(art, () => art._crown(time)).filter(point => outsideSocketUnion(point, 50000)),
  };
}

export function captureV6SupportingHead(art, depthStrength) {
  art.setOptions({ depthStrength });
  pose(art, { time: 2.4, lod: 1, grip: 0 });
  const head = headSkin(art, 2.4), rings = new Map();
  for (const point of head) {
    const key = point[0].toFixed(12), current = rings.get(key);
    if (!current || point[2] > current[2]) rings.set(key, point);
  }
  const dorsalHead = [...rings.values()].map(point => point.slice(0, 3));
  if (dorsalHead.length !== 28) throw new Error('Expected all 28 V6 head stations');
  const crown = art.crownSurface, dorsalCrown = [];
  if (crown.length !== 25 * 88 * 6) throw new Error('Expected complete V6 crown grid');
  for (let row = 0; row < 25; row++) {
    const offset = (row * 88 + 22) * 6;
    dorsalCrown.push(Array.from(crown.subarray(offset, offset + 3)));
  }
  return {
    headNormals: bufferFingerprint(art.headNormals),
    crownSurfacePositionsAndNormals: bufferFingerprint(crown),
    fullDorsalHeadProfile: dorsalHead,
    fullDorsalCrownProfile: dorsalCrown,
  };
}
