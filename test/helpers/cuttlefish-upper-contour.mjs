import { fakeBrowser } from './fake-browser.mjs';
import { captureHeadEnvelope, headEnvelopeAt } from './cuttlefish-profile.mjs';
import { armSections } from './cuttlefish-arms.mjs';
import { v6PreservedPrimaryStart } from './cuttlefish-preservation.mjs';

export const upperContourMethod = {
  x: [1, 1.60], stepX: .005, slabHalfWidth: .02, dropWindowX: .05,
  primaryArmMaximumU: .50, normalizationStationX: 1.02,
  primaryRootEndByArm: v6PreservedPrimaryStart,
  excluded: 'Feeding tentacles, distal curls after u=.50, and all eye samples.',
};

// The window extends past the proximal correction's u=.30/.40 boundary into its
// unchanged continuation. A smoother-looking first shoulder must not merely
// displace the same sharp step to the front edge of a smaller test mask.
export function measureUpperContour(CuttlefishArtwork, { time, grip }) {
  const host = fakeBrowser(), art = new CuttlefishArtwork(host.canvas(1000, 650), {
    species: 'cuttlefish', count: 1, size: 1.2, sizeVariation: 0, seed: 7,
    autoStart: false, paused: true, glow: false,
  });
  try {
    art.geometryStep = 1; art._cacheNormals();
    art.encounterGrip = grip; art.encounterFront = grip;
    art.startleTension = 0; art.escapeAmount = 0;
    const reference = headEnvelopeAt(captureHeadEnvelope(art), upperContourMethod.normalizationStationX);
    const savedPut = art._put;
    const capture = callback => {
      const points = [];
      try { art._put = (...point) => points.push(point); callback(); }
      finally { art._put = savedPut; }
      return points;
    };
    const head = capture(() => art._head(time));
    const arms = armSections(capture(() => art._arms(time)));
    const roots = arms.slice(0, 8).flatMap(arm => arm.filter(section => section.u <= v6PreservedPrimaryStart[section.arm]).flatMap(section => section.ring));
    const continuation = arms.slice(0, 8).flatMap(arm => arm
      .filter(section => section.u <= upperContourMethod.primaryArmMaximumU).flatMap(section => section.ring));
    const tissue = [...head, ...continuation];
    const count = Math.round((upperContourMethod.x[1] - upperContourMethod.x[0]) / upperContourMethod.stepX);
    const profile = Array.from({ length: count + 1 }, (_, i) => {
      const x = upperContourMethod.x[0] + i * upperContourMethod.stepX;
      const slice = tissue.filter(point => Math.abs(point[0] - x) < upperContourMethod.slabHalfWidth);
      const rootSlice = roots.filter(point => Math.abs(point[0] - x) < upperContourMethod.slabHalfWidth);
      return { x, upperRadius: Math.max(...slice.map(point => point[2])) / reference.b,
        rootUpperRadius: rootSlice.length ? Math.max(...rootSlice.map(point => point[2])) / reference.b : null };
    });
    if (profile.some(point => !Number.isFinite(point.upperRadius))) throw new Error('Missing upper tissue in the continuity window');
    const offset = Math.round(upperContourMethod.dropWindowX / upperContourMethod.stepX);
    const drops = profile.slice(0, -offset).map((point, i) => ({ x: point.x, drop: point.upperRadius - profile[i + offset].upperRadius }));
    return { time, grip, referenceDepth: reference.b,
      maximumDropOver05X: drops.reduce((a, b) => a.drop > b.drop ? a : b),
      profile: profile.filter((point, i) => i % 10 === 0) };
  } finally { art.destroy(); }
}
