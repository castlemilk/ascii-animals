// Original procedural octopus; integrated from Track 3. No browser globals or side effects.
export const octopusDefinition = (() => {
  'use strict';
  const TAU = Math.PI * 2;
  const ARMS = 8, SEGMENTS = 40;
  const YAW_LIMIT = .082, PITCH_LIMIT = .026, JOINT_LIMIT = .087;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
  const mix = (a, b, f) => a + (b - a) * f;
  const smooth = (a, b, n) => {
    const q = clamp((n - a) / (b - a), 0, 1);
    return q * q * (3 - 2 * q);
  };
  const FANS = [-1.04, -.73, -.43, -.14, .14, .43, .73, 1.04];
  const LENGTHS = [1.60, 1.76, 1.94, 2.08, 2.08, 1.94, 1.76, 1.60];
  const RINGS = {};
  for (const n of [6, 8, 12, 16, 22, 24, 32, 48, 64]) {
    const ring = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      ring[i * 2] = Math.cos(TAU * i / n);
      ring[i * 2 + 1] = Math.sin(TAU * i / n);
    }
    RINGS[n] = ring;
  }

  function create(seed = 0) {
    const phase = ((finite(seed) % 1 + 1) % 1) * TAU;
    const state = {
      seed: finite(seed), phase, armCount: ARMS, segmentCount: SEGMENTS,
      jointLimitRad: JOINT_LIMIT,
      arms: Array.from({ length: ARMS }, () => new Float64Array((SEGMENTS + 1) * 3)),
      // Each chain has exactly forty equal-length links at every LOD.
      lengths: new Float64Array(ARMS), roots: new Float64Array(ARMS * 3),
      angles: Array.from({ length: ARMS }, () => new Float64Array(SEGMENTS * 2)),
      reachWeights: new Float64Array(ARMS), target: new Float64Array(3),
      diagnostics: {
        armCount: ARMS, segmentsPerArm: SEGMENTS, pointCount: ARMS * (SEGMENTS + 1),
        maxSegmentError: 0, maxJointAngle: 0, sampleCount: 0,
        attention: 0, reachArms: [-1, -1], mode: 'idle'
      }
    };
    for (let k = 0; k < ARMS; k++) {
      const lateral = (k - 3.5) / 3.5, i = k * 3;
      // A shallow, oblique crown around the head gives all eight roots their
      // own silhouette channel. The short root ends overlap the head surface.
      state.roots[i] = .29 + .10 * (1 - Math.abs(lateral));
      state.roots[i + 1] = lateral * .39;
      state.roots[i + 2] = .08 + .10 * (1 - lateral * lateral);
      state.lengths[k] = LENGTHS[k] * (.98 + .02 * Math.sin(phase + k * 2.17));
    }
    return state;
  }

  function pose(host, time, state, p) {
    const o = host.options || {}, fish = host.activeFish || {};
    const legacy = typeof host._legacySingle === 'function' && host._legacySingle();
    const beat = finite(host.sceneTime) % 23;
    const upright = o.formation !== 'independent' ? 0 : legacy && o.scene === 'swimby'
      ? smooth(2.3, 3.6, beat) * (1 - smooth(11.8, 13, beat))
      : ['hover', 'curious', 'encounter'].includes(fish.behavior) ? 1 : 0;
    if (!upright) return p; // School routes, cruise and orbit retain their heading.
    if (!p.reference) p.reference = [0, 0, 1];
    else { p.reference[0] *= 1 - upright; p.reference[1] *= 1 - upright; p.reference[2] += (1 - p.reference[2]) * upright; }
    if (host.reaction && host.reaction.active) return p;
    const pointer = host.pointer || {}, t = finite(time);
    const watching = o.followPointer || fish.behavior === 'curious';
    const interest = watching ? clamp(finite(pointer.interest), 0, 1) : 0;
    const fx = clamp(finite(pointer.x), -.5, .5) * .36 * interest;
    const fy = .99;
    const fz = .10 + .025 * Math.sin(t * .37 + state.phase);
    const inverse = 1 / Math.hypot(fx, fy, fz);
    p.forward[0] += (fx * inverse - p.forward[0]) * upright; p.forward[1] += (fy * inverse - p.forward[1]) * upright; p.forward[2] += (fz * inverse - p.forward[2]) * upright;
    p.bank += (.035 * Math.sin(t * .41 + state.phase) + fx * .18 - p.bank) * upright;
    return p;
  }

  function attentionTarget(host, state, tension, escape) {
    const o = host.options || {}, pointer = host.marineIntent?.attention || host.pointer || {}, fish = host.activeFish || {};
    const watching = Boolean(host.marineIntent) || o.followPointer || fish.behavior === 'curious';
    let attention = watching ? clamp(finite(pointer.interest), 0, 1) : 0;
    const scale = Math.max(.0001, finite(host.scale, 100));
    const objectScale = Math.max(.0001, finite(host.objectScale, 1));
    const width = Math.max(1, finite(host.width, 900)), height = Math.max(1, finite(host.height, 620));
    const denominator = Math.max(.24, 1 - finite(host.worldZ) * finite(host.perspectiveStrength));
    const dx = ((clamp(finite(pointer.x), -.5, .5) + .5) * width - finite(host.cx, width * .5))
      * denominator / scale - finite(host.worldX);
    const dy = ((clamp(finite(pointer.y), -.5, .5) + .5) * height - finite(host.cyScreen, height * .48))
      * denominator / scale - finite(host.worldY);
    // Inverse of the engine's CURRENT frame rotation, including _put's .30
    // local-X centering offset. A screen-plane point is an attention cue, not
    // a physical 3D contact target. Upright fallbacks also make Node mocks useful.
    const x = .30 + (dx * finite(host.r00, 0) + dy * finite(host.r10, 1)) / objectScale;
    const y = (dx * finite(host.r01, -1) + dy * finite(host.r11, 0)) / objectScale;
    const z = (dx * finite(host.r02, 0) + dy * finite(host.r12, 0)) / objectScale;
    state.target[0] = clamp(x, .52, 3.1);
    state.target[1] = clamp(y, -2.3, 2.3);
    state.target[2] = clamp(z, -.20, .35);
    const distance = Math.hypot(x - .35, y, z);
    attention *= (1 - smooth(2.8, 4.8, distance)) * smooth(-.4, .55, x);
    attention *= (1 - tension) * (1 - escape);
    const aim = clamp(Math.atan2(y, Math.max(.22, x - .35)), -1.04, 1.04);
    // Interpolation between adjacent fan channels selects at most two arms.
    // Weights meet continuously at boundaries; crossing the pointer over an
    // arm boundary never switches a full-strength reach discontinuously.
    let lower = 0;
    while (lower < ARMS - 2 && aim > FANS[lower + 1]) lower++;
    const blend = smooth(FANS[lower], FANS[lower + 1], aim);
    state.reachWeights.fill(0);
    state.reachWeights[lower] = attention * (1 - blend);
    state.reachWeights[lower + 1] = attention * blend;
    state.diagnostics.reachArms[0] = attention > .001 ? lower : -1;
    state.diagnostics.reachArms[1] = attention > .001 ? lower + 1 : -1;
    state.diagnostics.attention = attention;
    return attention;
  }

  function articulate(host, time, state, tension, escape) {
    const ripple = clamp(finite((host.options || {}).ripple, 1.3), .3, 2);
    const attention = attentionTarget(host, state, tension, escape);
    const cup = tension * (1 - .88 * escape);
    const beat = time * 1.08 + state.phase;
    const diagnostics = state.diagnostics;
    diagnostics.maxSegmentError = 0; diagnostics.maxJointAngle = 0;
    diagnostics.mode = escape > .15 ? 'stream' : cup > .15 ? 'cup' : attention > .05 ? 'reach' : 'idle';
    for (let k = 0; k < ARMS; k++) {
      const points = state.arms[k], angles = state.angles[k], ri = k * 3;
      const sign = k < 4 ? -1 : 1, step = state.lengths[k] / SEGMENTS;
      const reach = state.reachWeights[k], asymmetry = .16 * Math.sin(state.phase + k * 2.17);
      let x = state.roots[ri], y = state.roots[ri + 1], z = state.roots[ri + 2];
      points[0] = x; points[1] = y; points[2] = z;
      let yaw = FANS[k] * (1 - .85 * escape) * (1 - .63 * cup), pitch = .025 * Math.sin(k * .9 + state.phase);
      let lastTx = 0, lastTy = 0, lastTz = 0;
      for (let i = 0; i < SEGMENTS; i++) {
        const u = (i + .5) / SEGMENTS;
        const wave = Math.sin(beat - u * 4.1 + k * .38 + asymmetry);
        const tip = smooth(.42, 1, u);
        const curl = sign * (1.32 + .12 * Math.sin(k * 1.7 + state.phase)) * tip * tip;
        let desiredYaw = FANS[k] * (1 - .85 * escape)
          + wave * (.075 + .07 * ripple) * u * (1 - .82 * escape)
          + curl * (1 - .94 * escape);
        const aimYaw = clamp(Math.atan2(state.target[1] - y, Math.max(.15, state.target[0] - x)),
          FANS[k] - .72, FANS[k] + .72);
        desiredYaw = mix(desiredYaw, aimYaw + sign * .24 * tip * tip, reach * .82);
        // A startle cups every arm in a common enclosure; a jet releases the
        // cup into narrow trailing chains. Link lengths never change.
        desiredYaw = mix(desiredYaw, sign * (.10 + 3.90 * smooth(0, 1, u)), cup);
        let desiredPitch = .035 * Math.sin(beat * .73 - u * 3.2 + k * .51) * (1 - .8 * escape)
          + .055 * cup * Math.sin(Math.PI * u);
        desiredPitch += reach * clamp((state.target[2] - z) * .11, -.08, .08);
        desiredPitch = clamp(desiredPitch, -.16, .16);
        yaw += clamp(desiredYaw - yaw, -YAW_LIMIT, YAW_LIMIT);
        pitch += clamp(desiredPitch - pitch, -PITCH_LIMIT, PITCH_LIMIT);
        pitch = clamp(pitch, -.16, .16);
        angles[i * 2] = yaw; angles[i * 2 + 1] = pitch;
        const cp = Math.cos(pitch), tx = Math.cos(yaw) * cp, ty = Math.sin(yaw) * cp, tz = Math.sin(pitch);
        const nx = x + tx * step, ny = y + ty * step, nz = z + tz * step, pi = (i + 1) * 3;
        points[pi] = nx; points[pi + 1] = ny; points[pi + 2] = nz;
        diagnostics.maxSegmentError = Math.max(diagnostics.maxSegmentError, Math.abs(Math.hypot(nx - x, ny - y, nz - z) - step));
        if (i) diagnostics.maxJointAngle = Math.max(diagnostics.maxJointAngle,
          Math.acos(clamp(tx * lastTx + ty * lastTy + tz * lastTz, -1, 1)));
        lastTx = tx; lastTy = ty; lastTz = tz; x = nx; y = ny; z = nz;
      }
    }
    return attention;
  }

  function body(host, time, state, lod, tension, attention) {
    const nu = lod === 1 ? 48 : lod === 2 ? 24 : 16;
    const nv = lod === 1 ? 64 : lod === 2 ? 32 : 22, ring = RINGS[nv];
    const breath = (1 + .017 * Math.sin(time * 1.08 + state.phase)) * (1 - .055 * tension);
    const pulse = .038 * Math.sin(time * .92 + state.phase) + .07 * tension + .03 * attention;
    // A closed, pear-shaped mantle; its lower taper overlaps the smaller head.
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, theta = Math.PI * u, st = Math.sin(theta), ct = Math.cos(theta);
      const x = -.83 - .84 * ct;
      const ry = .70 * st * (1 - .24 * u) * breath, rz = .51 * st * (1 - .12 * u) * breath;
      for (let j = 0; j < nv; j++) {
        const ca = ring[j * 2], sa = ring[j * 2 + 1];
        const pigment = .035 * Math.sin(u * 24 + ca * 3 + state.phase) * Math.sin(sa * 5 + u * 7);
        host._put(x, ry * ca, rz * sa,
          host._shade(-ct / .84, st * ca / (.70 * (1 - .24 * u)), st * sa / (.51 * (1 - .12 * u)), pigment + pulse),
          0, 31000 + i * 71 + j);
      }
    }
    const hn = lod === 1 ? 28 : lod === 2 ? 14 : 10;
    const hv = lod === 1 ? 48 : lod === 2 ? 24 : 16, hr = RINGS[hv];
    for (let i = 0; i <= hn; i++) {
      const theta = Math.PI * i / hn, ct = Math.cos(theta), st = Math.sin(theta);
      for (let j = 0; j < hv; j++) {
        const ca = hr[j * 2], sa = hr[j * 2 + 1];
        host._put(.08 - .39 * ct, .46 * st * ca, .29 * st * sa,
          host._shade(-ct / .39, st * ca / .46, st * sa / .29, pulse * .65 - .025),
          0, 35000 + i * 53 + j);
      }
    }
    // Two raised eyes with horizontal pupils. Iris and pupil geometry, rather
    // than painted textures, remain part of the shared depth buffer.
    const ey = lod === 1 ? 10 : lod === 2 ? 6 : 4, ex = lod === 1 ? 12 : lod === 2 ? 7 : 5;
    for (const side of [-1, 1]) {
      for (let i = -ey; i <= ey; i++) {
        for (let j = -ex; j <= ex; j++) {
          const vx = i / ey, vy = j / ex, rr = vx * vx + vy * vy;
          if (rr > 1) continue;
          const dome = Math.sqrt(1 - rr), pupil = Math.abs(vx) < .21 && Math.abs(vy) < .79;
          const light = pupil ? .025 : .38 + .58 * host._shade(vx * .4, vy * .4, dome, .025);
          host._put(-.11 + vx * .125, side * .305 + vy * .165, .283 + dome * .095,
            light, pupil ? 0 : 2, 38000 + (side + 1) * 500 + (i + ey) * 31 + j + ex);
        }
      }
    }
  }

  function arms(host, time, state, lod, tension) {
    const nv = lod === 1 ? 12 : lod === 2 ? 8 : 6, ring = RINGS[nv];
    const cups = RINGS[6];
    const projection = Math.max(.24, 1 - finite(host.worldZ) * finite(host.perspectiveStrength));
    const cellsPerUnit = finite(host.scale, 100) * finite(host.objectScale, 1)
      / (projection * Math.max(1, finite(host.cellW, 5), finite(host.cellH, 7)));
    // At tiny grids a full-width tube touches adjacent cells on both sides of
    // its centerline, merging neighboring arms into one patch. Thin only the
    // rendered tube after its root; the same eight articulated chains remain.
    const thin = mix(.18, 1, smooth(4.5, 13, cellsPerUnit));
    for (let k = 0; k < ARMS; k++) {
      const p = state.arms[k], a = state.angles[k];
      for (let i = 0; i <= SEGMENTS; i++) {
        const u = i / SEGMENTS, pi = i * 3, ai = Math.min(i, SEGMENTS - 1) * 2;
        const yaw = a[ai], pitch = a[ai + 1], cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
        const tx = cy * cp, ty = sy * cp, tz = sp;
        const ux = -sy, uy = cy, uz = 0, vx = -sp * cy, vy = -sp * sy, vz = cp;
        const radius = (.100 * Math.pow(1 - u, .85) + .013) * (1 + .08 * tension * (1 - u))
          * mix(1, thin, smooth(0, .24, u));
        const pigment = .035 * Math.sin(u * 26 - time * 1.08 + state.phase + k * .38);
        for (let j = 0; j < nv; j++) {
          const ca = ring[j * 2], sa = ring[j * 2 + 1];
          const nx = ux * ca + vx * sa, ny = uy * ca + vy * sa, nz = uz * ca + vz * sa;
          host._put(p[pi] + nx * radius, p[pi + 1] + ny * radius, p[pi + 2] + nz * radius,
            host._shade(nx, ny, nz, pigment, false, true), k === 1 || k === 6 ? 1 : 0,
            42000 + k * 1000 + i * 17 + j);
        }
        // Paired, bounded sucker rows clarify the animal at large grids. At
        // lower LOD, retain sparse cup centers instead of adding more geometry.
        if (cellsPerUnit < 9 || i < 4 || i > 32 || i % (lod === 1 ? 4 : 8)) continue;
        for (const side of [-1, 1]) {
          const lift = radius * .93, across = radius * .38 * side, cup = radius * .235;
          const cx = p[pi] + vx * lift + ux * across, cy0 = p[pi + 1] + vy * lift + uy * across;
          const cz = p[pi + 2] + vz * lift;
          if (lod === 1) {
            for (let q = 0; q < 6; q++) {
              const ca = cups[q * 2], sa = cups[q * 2 + 1];
              host._put(cx + (ux * ca + tx * sa) * cup, cy0 + (uy * ca + ty * sa) * cup,
                cz + (uz * ca + tz * sa) * cup, .85, 2, 51000 + k * 800 + i * 17 + q);
            }
          }
          host._put(cx + vx * .002, cy0 + vy * .002, cz + vz * .002, lod === 1 ? .09 : .74, 2,
            58000 + k * 100 + i * 2 + (side + 1) / 2);
        }
      }
    }
  }

  function draw(host, time, state) {
    const t = finite(time), lod = clamp(Math.round(finite(host.geometryStep, 1)), 1, 3);
    const tension = clamp(finite(host.startleTension), 0, 1), escape = clamp(finite(host.escapeAmount), 0, 1);
    const before = finite(host.sampleCount);
    const attention = articulate(host, t, state, tension, escape);
    body(host, t, state, lod, tension, attention);
    arms(host, t, state, lod, tension);
    state.diagnostics.sampleCount = Math.max(0, finite(host.sampleCount) - before);
  }

  const definition = {
    id: 'octopus', label: 'Octopus', ink: true, inkOrigin: [.5, .15, .05],
    // Conservative analytic bounds, including tube radii and mantle breathing.
    bounds: { minX: -1.68, maxX: 2.62, maxY: 2.31, maxZ: .65 },
    create, pose, draw
  };
  return Object.freeze(definition);
})();
