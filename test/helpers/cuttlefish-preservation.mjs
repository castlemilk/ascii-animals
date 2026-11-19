import { createHash } from 'node:crypto';
import { armSections } from './cuttlefish-arms.mjs';

// V6 extends just the three upper proximal attachments. This is a declared
// local geometry change, not a newly recorded candidate oracle. The immutable
// V3 fixture remains intact; the derivative V5 fixture covers these boundaries.
export const v6PreservedPrimaryStart = Object.freeze([.30, .40, .40, .40, .30, .30, .30, .30]);

export function preservedCuttlefishParts(art, { time, lod, grip }, { primaryStart = null } = {}) {
  art.time = time; art.elapsed = time;
  art._activateFish(art.fish[0]); art.sceneTime = time; art._camera(time);
  art.geometryStep = lod; art.encounterGrip = grip; art.encounterFront = grip;
  art.startleTension = .25; art.escapeAmount = .15; art._cacheNormals();
  const savedPut = art._put, savedHead = art._head, savedEye = art._eye;
  const capture = callback => {
    const points = [];
    art._put = (...point) => points.push(point);
    callback();
    if (!points.every(point => point.every(Number.isFinite))) throw new Error('Preserved geometry contains a non-finite value');
    return points;
  };
  try {
    // V4 changes the head profile and primary proximal attachment only.
    // Preserve the entire mantle/fin system, including the wider shoulder.
    art._head = () => {}; art._eye = () => {};
    const mantleAndFins = capture(() => art._body(time));
    art._head = savedHead; art._eye = savedEye;
    // Head/eye XYZ and lighting intentionally follow the growing host surface.
    // Independent profile, aperture, culling and projection regressions protect
    // them; silently re-recording their absolute coordinates would be weaker.
    const arms = armSections(capture(() => art._arms(time)), lod);
    const feedingTentacles = arms.slice(8).flatMap(arm => arm.flatMap(section => [...section.ring, ...section.extras]));
    // No adjacent-frame exception is permitted at the selected boundary:
    // even the first coarse grip ring must keep its exact prior frame.
    const primaryDistalArms = arms.slice(0, 8).flatMap(arm => arm
      .filter(section => section.u >= (primaryStart?.[section.arm] ?? .30))
      .flatMap(section => [...section.ring, ...section.extras]));
    const beak = capture(() => art._beak(time));
    return { mantleAndFins, feedingTentacles, primaryDistalArms, beak };
  } finally { art._put = savedPut; art._head = savedHead; art._eye = savedEye; }
}

export function geometryFingerprint(points) {
  return { samples: points.length, sha256: createHash('sha256').update(JSON.stringify(points)).digest('hex') };
}
