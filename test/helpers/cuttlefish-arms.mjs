// Recover the stable arm-station ordering from emitted sample seeds. Ring
// length is measured, so denser proximal sleeves do not weaken distal parity.
// This knows no centerline, root radius, taper, normal or lighting formula.
export function armSections(samples, lod = 1) {
  const arms = [];
  let cursor = 0;
  for (let arm = 0; arm < 10; arm++) {
    const segments = Math.round((arm >= 8 ? 84 : 68) / lod), sections = [];
    for (let i = 0; i <= segments; i++) {
      const seed = i * 19 + arm * 90;
      if (samples[cursor]?.[5] !== seed) throw new Error(`Unidentified arm ${arm} station ${i} at sample ${cursor}`);
      const ring = [], extras = [];
      while (samples[cursor]?.[5] === seed + ring.length * lod) ring.push(samples[cursor++]);
      if (ring.length < 3) throw new Error(`Incomplete arm ${arm} station ${i}`);
      const next = i < segments ? (i + 1) * 19 + arm * 90 : (arm + 1) * 90;
      while (cursor < samples.length && samples[cursor][5] !== next) extras.push(samples[cursor++]);
      sections.push({ arm, i, u: i / segments, segments, ring, extras });
    }
    arms.push(sections);
  }
  if (cursor !== samples.length) throw new Error('Unidentified samples after the last arm');
  return arms;
}

function resampleRing(ring, count) {
  return Array.from({ length: count }, (_, i) => {
    const fraction = i / count * ring.length, index = Math.floor(fraction), t = fraction - index;
    return ring[index].slice(0, 3).map((value, axis) =>
      value + (ring[(index + 1) % ring.length][axis] - value) * t);
  });
}

export function armSectionAt(sections, u, count = 64) {
  const fraction = u * (sections.length - 1), index = Math.floor(fraction), t = fraction - index;
  const first = resampleRing(sections[index].ring, count);
  const second = resampleRing(sections[Math.min(index + 1, sections.length - 1)].ring, count);
  return first.map((point, i) => point.map((value, axis) => value + (second[i][axis] - value) * t));
}

function insidePolygon([x, y], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Fraction of the links between neighboring root centers covered by actual
// tube cross-sections, viewed along the mouth axis. A large solid cap behind
// thin detached-looking strands cannot improve this independent measurement.
export function rootCoverage(arms, u) {
  const rings = arms.slice(0, 8).map(arm => armSectionAt(arm, u));
  const centers = rings.map(ring => [1, 2].map(axis => ring.reduce((sum, point) => sum + point[axis], 0) / ring.length));
  const polygons = rings.map(ring => ring.map(point => point.slice(1, 3)));
  const links = centers.map((center, i) => {
    const next = centers[(i + 1) % centers.length];
    let covered = 0;
    for (let j = 0; j < 64; j++) {
      const t = (j + .5) / 64, point = center.map((value, axis) => value + (next[axis] - value) * t);
      if (polygons.some(polygon => insidePolygon(point, polygon))) covered++;
    }
    return covered / 64;
  });
  return { u, coverage: links.reduce((sum, value) => sum + value, 0) / links.length, minimumLinkCoverage: Math.min(...links), links };
}
