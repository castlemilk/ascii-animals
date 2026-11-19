import { captureHeadEnvelope, headEnvelopeAt, headSurfaceReference, sampleHeadEnvelope } from './cuttlefish-profile.mjs';

// Numerical host reconstruction, independent of the eye chart implementation.
// V6 moves the anterior socket rim onto the crown. Its intact sampled grid is
// kept in crownSurface even where the renderer replaces skin with eye samples.
// Do not fit this lobed surface as an ellipse or extrapolate the head cylinder.
export function captureEyeHost(art) {
  const profile = captureHeadEnvelope(art);
  if (!art.crownSurface) return { profile, crown: null };
  const surface = Array.from(art.crownSurface), joinX = surface[0];
  let columns = 1;
  while (columns * 6 < surface.length && Math.abs(surface[columns * 6] - joinX) < 1e-10) columns++;
  const rows = surface.length / (columns * 6);
  if (columns < 16 || rows < 8 || !Number.isInteger(rows)) throw new Error('Unrecognized sampled crown grid');
  return { profile, crown: { surface, joinX, columns, rows } };
}

function weights(coordinates, value) {
  return coordinates.map((coordinate, i) => {
    let weight = 1, derivative = 0;
    for (let j = 0; j < coordinates.length; j++) if (j !== i) weight *= (value - coordinates[j]) / (coordinate - coordinates[j]);
    for (let j = 0; j < coordinates.length; j++) if (j !== i) {
      let term = 1 / (coordinate - coordinates[j]);
      for (let k = 0; k < coordinates.length; k++) if (k !== i && k !== j) term *= (value - coordinates[k]) / (coordinate - coordinates[k]);
      derivative += term;
    }
    return [weight, derivative];
  });
}

// Interpolate sampled positions, never eye formulas or cached normals. The
// crown's angular lobes need ten nodes around the upper-lateral socket: the
// former cubic fit can undershoot that intact skin by .000153 model units.
// Eight/ten/twelve-node and independent Fourier convergence retain the same
// .00004 outward allowance; derivatives still test analytic lighting normals.
export function sampledCrownAt(crown, row, phi) {
  const { surface, columns, rows } = crown, fraction = phi / (Math.PI * 2) * columns;
  const nodes = Math.min(10, rows, columns), half = Math.floor((nodes - 1) / 2);
  const first = Math.max(0, Math.min(rows - nodes, Math.floor(row) - half));
  const rowIndices = Array.from({ length: nodes }, (_, i) => first + i);
  const columnIndices = Array.from({ length: nodes }, (_, i) => Math.floor(fraction) - half + i);
  const rw = weights(rowIndices, row), cw = weights(columnIndices, fraction);
  const point = [0, 0, 0], along = [0, 0, 0], around = [0, 0, 0];
  for (let i = 0; i < nodes; i++) for (let j = 0; j < nodes; j++) {
    const column = (columnIndices[j] % columns + columns) % columns;
    const index = (rowIndices[i] * columns + column) * 6;
    for (let axis = 0; axis < 3; axis++) {
      const value = surface[index + axis];
      point[axis] += value * rw[i][0] * cw[j][0];
      along[axis] += value * rw[i][1] * cw[j][0];
      around[axis] += value * rw[i][0] * cw[j][1] * columns / (Math.PI * 2);
    }
  }
  return { point, along, around };
}

function crownAtX(crown, x, phi) {
  const first = sampledCrownAt(crown, 0, phi);
  let row = Math.max(0, Math.min(crown.rows - 1, (x - first.point[0]) / first.along[0]));
  let value;
  for (let iteration = 0; iteration < 12; iteration++) {
    value = sampledCrownAt(crown, row, phi);
    if (Math.abs(value.point[0] - x) < 1e-12) break;
    row = Math.max(0, Math.min(crown.rows - 1, row - (value.point[0] - x) / value.along[0]));
  }
  if (Math.abs(value.point[0] - x) > 1e-8) throw new Error(`Cannot reconstruct the eye-support crown at x=${x}`);
  const dx = value.along.map(component => component / value.along[0]);
  const dp = value.around.map((component, axis) => component - value.along[axis] * value.around[0] / value.along[0]);
  return { point: value.point, dx, dp };
}

export function eyeHostReference(host, position) {
  const [x, y, z] = position;
  if (!host.crown || x <= host.crown.joinX) {
    const reference = headSurfaceReference(host.profile, position), { a, b } = headEnvelopeAt(host.profile, x);
    return { ...reference, angle: Math.atan2(z / b, y / a) };
  }
  const near = headEnvelopeAt(host.profile, host.crown.joinX);
  let phi = Math.atan2(z / near.b, y / near.a), value;
  const target = Math.atan2(z, y);
  for (let iteration = 0; iteration < 10; iteration++) {
    value = crownAtX(host.crown, x, phi);
    const [, cy, cz] = value.point, actual = Math.atan2(cz, cy);
    const difference = Math.atan2(Math.sin(actual - target), Math.cos(actual - target));
    if (Math.abs(difference) < 1e-12) break;
    const derivative = (cy * value.dp[2] - cz * value.dp[1]) / (cy * cy + cz * cz);
    phi -= difference / derivative;
  }
  const [, cy, cz] = value.point, radius = Math.hypot(y, z), hostRadius = Math.hypot(cy, cz);
  const a = value.dp, b = value.dx;
  const normal = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const length = Math.hypot(...normal);
  return { level: radius / hostRadius, outward: radius - hostRadius,
    normal: normal.map(component => component / length), angle: phi };
}

export function sampleEyeHost(host) {
  const points = sampleHeadEnvelope(host.profile);
  if (host.crown) {
    const { rows, columns } = host.crown;
    for (let i = 0; i <= (rows - 1) * 3; i++) for (let j = 0; j < columns * 2; j++) {
      points.push(sampledCrownAt(host.crown, i / 3, j / (columns * 2) * Math.PI * 2).point);
    }
  }
  return points;
}
