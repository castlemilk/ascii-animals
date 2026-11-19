import { captureHeadEnvelope, headEnvelopeAt } from './cuttlefish-profile.mjs';

// Retained for reproducing the historical V4/V5 oracle. V6 intentionally moves
// the complete eye/socket patch forward; its unaffected skin is checked below.
export function preservedHeadSkinAndEyes(art, { time, lod, grip }) {
  art.time = time; art.elapsed = time;
  art._activateFish(art.fish[0]); art.sceneTime = time; art._camera(time);
  art.geometryStep = lod; art.encounterGrip = grip; art.encounterFront = grip;
  art.startleTension = .25; art.escapeAmount = .15; art._cacheNormals();
  const savedPut = art._put, savedCrown = art._crown;
  const capture = callback => {
    const points = [];
    art._put = (...point) => points.push(point);
    callback();
    if (!points.every(point => point.every(Number.isFinite))) throw new Error('Approved head/eye samples must remain finite');
    return points;
  };
  try {
    art._crown = () => {};
    const headSkin = capture(() => art._head(time));
    art._crown = savedCrown;
    const eyes = capture(() => { art._eye(-1); art._eye(1); });
    return { headSkin, eyes };
  } finally { art._put = savedPut; art._crown = savedCrown; }
}

// Exact union of the old and approved new socket holes in the skin chart.
// This exclusion authorizes no profile, material or sampling change elsewhere.
export const forwardEyeChangedRegion = {
  oldCenterX: .78, newCenterX: .87, halfX: .205,
  centerAngle: .18, halfAngle: .31, removedSkinRadius: .92,
};

export function preservedV5HeadSkin(art, pose) {
  const profile = captureHeadEnvelope(art, pose.time);
  const { headSkin } = preservedHeadSkinAndEyes(art, pose);
  const mask = forwardEyeChangedRegion;
  return headSkin.filter(point => {
    const [x, y, z] = point, { a, b } = headEnvelopeAt(profile, x);
    const angle = Math.atan2(z / b, Math.abs(y / a));
    const v = (angle - mask.centerAngle) / mask.halfAngle;
    return [mask.oldCenterX, mask.newCenterX].every(center =>
      ((x - center) / mask.halfX) ** 2 + v * v >= mask.removedSkinRadius ** 2 - 1e-12);
  });
}
