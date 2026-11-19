// Numerical test reference reconstructed from the actual emitted head skin.
// No candidate headProfile/eye formula or authored radius constants are imported.
// Separate shape tests constrain the profile itself, so agreeing head/eye bugs
// cannot pass merely by sharing an incorrect implementation.
export function captureHeadEnvelope(art, time = 2.4, { includeCrownBase = false } = {}) {
  const savedPut = art._put, savedEye = art._eye, savedCrown = art._crown, savedStep = art.geometryStep;
  const points = [];
  try {
    art.geometryStep = 1; art._cacheNormals(); art._eye = () => {}; art._crown = () => {};
    art._put = (x, y, z) => {
      // The older delivered implementation has no separate head draw hook;
      // beyond .50 the mantle/fin samplers have ended and only head remains.
      if (typeof art._head === 'function' || x > .50) points.push([x, y, z]);
    };
    if (typeof art._head === 'function') art._head(time);
    else art._body(time);
    // The crown can have angular lobes, so it is not an elliptical eye support.
    // Fullness tests may additionally measure its actual rear join ring.
    if (includeCrownBase && typeof savedCrown === 'function') {
      const crown = [];
      art._put = (x, y, z) => crown.push([x, y, z]); savedCrown.call(art, time);
      const start = Math.min(...crown.map(point => point[0]));
      points.push(...crown.filter(point => Math.abs(point[0] - start) < 1e-9));
    }
  } finally { art._put = savedPut; art._eye = savedEye; art._crown = savedCrown; art.geometryStep = savedStep; }
  const groups = new Map();
  for (const point of points) {
    const key = point[0].toFixed(10), ring = groups.get(key) || [];
    ring.push(point); groups.set(key, ring);
  }
  const rings = [...groups.values()].map(points => {
    const x = points[0][0];
    if (Math.max(...points.map(p => Math.hypot(p[1], p[2]))) < 1e-7) return { x, a: 0, b: 0, residual: 0 };
    // Fit the transverse ellipse from the surviving skin around the socket.
    // Missing eye-region samples do not bias its width/depth as extrema would.
    let yy = 0, yz = 0, zz = 0, sy = 0, sz = 0;
    for (const [, y, z] of points) {
      const y2 = y * y, z2 = z * z;
      yy += y2 * y2; yz += y2 * z2; zz += z2 * z2; sy += y2; sz += z2;
    }
    const determinant = yy * zz - yz * yz;
    const inverseA2 = (sy * zz - sz * yz) / determinant;
    const inverseB2 = (sz * yy - sy * yz) / determinant;
    const a = 1 / Math.sqrt(inverseA2), b = 1 / Math.sqrt(inverseB2);
    const residual = Math.max(...points.map(([, y, z]) => Math.abs((y / a) ** 2 + (z / b) ** 2 - 1)));
    return { x, a, b, residual };
  }).sort((a, b) => a.x - b.x);
  if (rings.length < 4 || rings.some(r => ![r.x, r.a, r.b, r.residual].every(Number.isFinite))) {
    throw new Error('Head sampler did not emit an adequate finite ellipse profile');
  }
  return rings;
}

// Cubic interpolation of measured rings, with its derivative. In the eye region
// this is an independent reconstruction of the surface, not its source formula.
export function headEnvelopeAt(rings, x) {
  let index = rings.findIndex(ring => ring.x >= x);
  if (index < 0) index = rings.length - 1;
  const selected = rings.slice(Math.max(0, Math.min(rings.length - 4, index - 2)), Math.max(0, Math.min(rings.length - 4, index - 2)) + 4);
  const result = { a: 0, b: 0, ax: 0, bx: 0 };
  for (let i = 0; i < selected.length; i++) {
    let weight = 1, derivative = 0;
    for (let j = 0; j < selected.length; j++) if (i !== j) weight *= (x - selected[j].x) / (selected[i].x - selected[j].x);
    for (let j = 0; j < selected.length; j++) if (i !== j) {
      let term = 1 / (selected[i].x - selected[j].x);
      for (let k = 0; k < selected.length; k++) if (k !== i && k !== j) term *= (x - selected[k].x) / (selected[i].x - selected[k].x);
      derivative += term;
    }
    result.a += selected[i].a * weight; result.b += selected[i].b * weight;
    result.ax += selected[i].a * derivative; result.bx += selected[i].b * derivative;
  }
  return result;
}

export function headSurfaceReference(rings, [x, y, z]) {
  const { a, b, ax, bx } = headEnvelopeAt(rings, x);
  const level = Math.hypot(y / a, z / b);
  const normal = [-y * y * ax / (a ** 3) - z * z * bx / (b ** 3), y / (a * a), z / (b * b)];
  const length = Math.hypot(...normal);
  return { level, outward: Math.hypot(y, z) * (1 - 1 / level),
    normal: normal.map(value => value / length) };
}

export function sampleHeadEnvelope(rings, longitudinal = 160, angular = 192) {
  const points = [], start = rings[0].x, end = rings.at(-1).x;
  for (let i = 0; i <= longitudinal; i++) {
    const x = start + (end - start) * i / longitudinal;
    const { a, b } = headEnvelopeAt(rings, x);
    for (let j = 0; j < angular; j++) {
      const angle = j / angular * Math.PI * 2;
      points.push([x, Math.max(0, a) * Math.cos(angle), Math.max(0, b) * Math.sin(angle)]);
    }
  }
  return points;
}
