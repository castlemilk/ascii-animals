// GENERATED from src/core/scheduler.js, src/animals/cuttlefish.js, src/animals/manta.js, src/animals/octopus.js. Do not edit.
// source-sha256: 26c9c778714e45cd3259248461fc1fff650fd80639d21cfc55e0b0c9c08805d9
(function () {
'use strict';
/** A framework-neutral, injectable requestAnimationFrame multiplexer. */
function createScheduler({ requestFrame, cancelFrame, onError = error => { throw error; } }) {
  if (typeof requestFrame !== 'function' || typeof cancelFrame !== 'function') {
    throw new TypeError('createScheduler requires requestFrame and cancelFrame functions.');
  }
  const listeners = new Set();
  const batch = [];
  let pending = null, dispatching = false, disposed = false;
  const schedule = () => {
    if (!disposed && !dispatching && listeners.size && pending === null) pending = requestFrame(frame);
  };
  function frame(timestamp) {
    pending = null;
    if (disposed) return;
    dispatching = true;
    let firstError;
    try {
      // Reuse one snapshot buffer. New subscriptions start on the next frame;
      // removals still take effect immediately during the current dispatch.
      for (const listener of listeners) batch.push(listener);
      for (const listener of batch) {
        if (!listeners.has(listener)) continue;
        try { listener(timestamp); } catch (error) {
          try { onError(error); } catch (reported) { firstError ??= reported; }
        }
      }
    } finally { batch.length = 0; dispatching = false; schedule(); }
    if (firstError !== undefined) throw firstError;
  }
  return {
    subscribe(listener) {
      if (disposed) throw new Error('Cannot subscribe to a disposed scheduler.');
      if (typeof listener !== 'function') throw new TypeError('Subscriber must be a function.');
      // Each subscription owns its removal even when callbacks are identical.
      const entry = timestamp => listener(timestamp);
      listeners.add(entry);
      try { schedule(); } catch (error) { listeners.delete(entry); throw error; }
      let active = true;
      return () => {
        if (!active) return;
        active = false; listeners.delete(entry);
        if (!listeners.size && pending !== null) { cancelFrame(pending); pending = null; }
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true; listeners.clear();
      if (pending !== null) cancelFrame(pending);
      pending = null;
    },
    get size() { return listeners.size; }
  };
}

// Weak keys allow detached browsing contexts to be collected. No browser globals
// are accessed while importing this module, including on a server.
const browserSchedulers = new WeakMap();
function getBrowserScheduler(view) {
  let scheduler = browserSchedulers.get(view);
  if (!scheduler) {
    scheduler = createScheduler({
      requestFrame: callback => view.requestAnimationFrame(callback),
      cancelFrame: handle => view.cancelAnimationFrame(handle),
      onError: error => view.setTimeout(() => { throw error; }, 0)
    });
    browserSchedulers.set(view, scheduler);
  }
  return scheduler;
}

// Original procedural manta; integrated from Track 3. No browser globals or side effects.
const mantaDefinition = (() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
  const finite = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const smooth = (a, b, value) => { const x = clamp((value - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  const ring = n => {
    const data = new Float64Array(n * 2);
    for (let j = 0; j < n; j++) {
      data[j * 2] = Math.cos(j / n * TAU);
      data[j * 2 + 1] = Math.sin(j / n * TAU);
    }
    return data;
  };

  // Coordinates are in the existing engine's local units, before x -= .30.
  // Conservative envelopes include the maximum allowed ripple and tail sway.
  const bounds = Object.freeze({ minX: -3.16, maxX: 1.48, maxY: 2.72, maxZ: .90 });

  function create(seed = 0) {
    seed = finite(seed, 0);
    return {
      seed: seed - Math.floor(seed),
      rings: { 8: ring(8), 12: ring(12), 40: ring(40) },
      tail: new Float64Array(97 * 3),
      turn: 0,
      diagnostics: {
        wingSpan: 5.4, heading: 0, bank: 0, maxWingDisplacement: 0,
        sampleCount: 0, tailRoot: new Float64Array(3), tailTip: new Float64Array(3),
        leftTip: new Float64Array(3), rightTip: new Float64Array(3),
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }
      }
    };
  }

  function pose(host, t, state, result) {
    const time = finite(t, 0), fish = host.activeFish;
    const role = fish?.behavior || 'hover';
    const legacySwim = host._legacySingle?.() && host.options.scene === 'swimby';
    const beat = (host.sceneTime || 0) % 23;
    const presentation = host.options.formation !== 'independent' ? 0 : legacySwim
      ? smooth(2.3, 3.6, beat) * (1 - smooth(11.8, 13, beat))
      : ['hover', 'curious', 'encounter'].includes(role) ? 1 : 0;
    const watching = host.options.followPointer || role === 'curious';
    const interest = watching ? clamp(finite(host.pointer?.interest, 0), 0, 1) : 0;
    const px = clamp(finite(host.pointer?.x, 0), -.5, .5) * interest;
    const py = clamp(finite(host.pointer?.y, 0), -.5, .5) * interest;
    state.turn = px * .76;
    if (presentation) {
      const heading = .085 * Math.sin(time * .26 + state.seed * TAU) + state.turn;
      const pitch = .16 + .035 * Math.sin(time * .31) - py * .13;
      const portrait = [Math.sin(heading) * Math.cos(pitch), -Math.cos(heading) * Math.cos(pitch), Math.sin(pitch)];
      result.forward = result.forward.map((v, i) => v + (portrait[i] - v) * presentation);
      result.reference = [0, -.22 * (1 - presentation), .9755 + .0245 * presentation];
      const portraitBank = clamp(.045 * Math.sin(time * .43 + state.seed * TAU) + state.turn * .68, -.33, .33);
      result.bank += (portraitBank - result.bank) * presentation;
      state.diagnostics.heading = heading;
    } else {
      // A school route retains its own forward direction and world trajectory.
      // The modest dorsal reference keeps the broad wing plane legible.
      result.reference = [0, -.22, .9755];
      state.diagnostics.heading = Math.atan2(result.forward[0], -result.forward[1]);
    }
    state.diagnostics.bank = result.bank;
    return result;
  }

  function draw(host, t, state) {
    const time = finite(t, 0), ripple = clamp(finite(host.options.ripple, 1.3), .3, 2);
    const lod = Math.round(clamp(finite(host.geometryStep, 1), 1, 3));
    const tension = clamp(finite(host.startleTension, 0), 0, 1);
    const escape = clamp(finite(host.escapeAmount, 0), 0, 1);
    const phase = time * (2.05 + .07 * state.seed) + state.seed * TAU;
    const amplitude = .29 * ripple * (1 - .25 * tension + .12 * escape);
    const d = state.diagnostics, measured = d.bounds;
    d.sampleCount = 0; d.maxWingDisplacement = 0;
    measured.minX = measured.minY = measured.minZ = Infinity;
    measured.maxX = measured.maxY = measured.maxZ = -Infinity;
    const put = (x, y, z, light, kind, seed) => {
      d.sampleCount++;
      measured.minX = Math.min(measured.minX, x); measured.maxX = Math.max(measured.maxX, x);
      measured.minY = Math.min(measured.minY, y); measured.maxY = Math.max(measured.maxY, y);
      measured.minZ = Math.min(measured.minZ, z); measured.maxZ = Math.max(measured.maxZ, z);
      host._put(x, y, z, light, kind, seed);
    };

    // Two continuous swept wing surfaces. Spanwise and chordwise phase lag
    // deform the complete wing rather than rotating a rigid triangle.
    // Dividing segment counts, rather than skipping a last index, retains tips
    // and both chord edges at every supported level of detail.
    const spans = Math.ceil(64 / lod), chords = Math.ceil(38 / lod);
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i <= spans; i++) {
        const s = i / spans, spanEnvelope = Math.pow(s, 1.65);
        const y = side * (.20 + 2.50 * s);
        const leading = 1.02 - 1.05 * s + .14 * Math.sin(Math.PI * s);
        const trailing = -.93 + .90 * s - .13 * Math.sin(Math.PI * s);
        const chord = leading - trailing;
        const asymmetry = 1 + side * state.turn * .19;
        for (let j = 0; j <= chords; j++) {
          const v = j / chords, x = trailing + chord * v;
          const wavePhase = phase - s * 1.78 - v * .36 + side * state.turn * .16;
          const wave = Math.sin(wavePhase) * amplitude * spanEnvelope * asymmetry;
          const camber = .065 * Math.sin(Math.PI * v) * (1 - .66 * s);
          const thickness = .025 * Math.sqrt(Math.max(0, 1 - s)) * Math.sin(Math.PI * v);
          const z = wave + camber;
          const dzdx = chord > .015
            ? (-.36 * Math.cos(wavePhase) * amplitude * spanEnvelope * asymmetry
              + .065 * Math.PI * Math.cos(Math.PI * v) * (1 - .66 * s)) / chord : 0;
          const dzdy = side * amplitude * asymmetry *
            (1.65 * Math.pow(Math.max(.0001, s), .65) * Math.sin(wavePhase)
              - 1.78 * spanEnvelope * Math.cos(wavePhase)) / 2.50;
          const edge = (j === 0 || j === chords || i === spans) ? .12 : 0;
          const markings = .025 * Math.cos(s * 11 + v * 4) + .04 * tension;
          const light = host._shade(-dzdx, -dzdy, 1, -.055 + edge + markings, true);
          put(x, y, z + thickness, light, 1, 1100 + (side + 1) * 3400 + i * 41 + j);
          put(x, y, z - thickness - .014, host._shade(dzdx, dzdy, -1, -.10 + edge, true), 0,
            8100 + (side + 1) * 3400 + i * 41 + j);
          d.maxWingDisplacement = Math.max(d.maxWingDisplacement, Math.abs(wave));
          if (i === spans && j === Math.floor(chords / 2)) {
            const tip = side < 0 ? d.leftTip : d.rightTip;
            tip[0] = x; tip[1] = y; tip[2] = z;
          }
        }
      }
    }
    d.wingSpan = d.rightTip[1] - d.leftTip[1];

    // The stout central disk overlaps each wing root. Its upper keel and
    // tapered rear make the head-tail axis clear on coarse character grids.
    const bodySteps = Math.ceil(48 / lod), bodyRing = state.rings[40];
    for (let i = 0; i <= bodySteps; i++) {
      const u = i / bodySteps, theta = Math.PI * u;
      const x = -.99 + 2.05 * u;
      const profile = Math.pow(Math.max(0, Math.sin(theta)), .57);
      const halfWidth = .455 * profile, halfDepth = .205 * profile;
      const lift = .035 * Math.sin(theta);
      for (let j = 0; j < 40; j += lod) {
        const ca = bodyRing[j * 2], sa = bodyRing[j * 2 + 1];
        const nx = -Math.cos(theta) * .46;
        const light = host._shade(nx, ca * .70, sa * 1.4, .035 + .045 * tension);
        put(x, ca * halfWidth, sa * halfDepth + lift, light, 0, 18000 + i * 40 + j);
      }
    }

    // A slender trailing tail is anchored inside the rear of the central disk.
    // Fixed sample count and a zero envelope at the root guarantee attachment.
    const tailSteps = 96, tail = state.tail;
    for (let i = 0; i <= tailSteps; i++) {
      const u = i / tailSteps;
      tail[i * 3] = -.88 - 2.23 * u;
      tail[i * 3 + 1] = .13 * u * u * Math.sin(phase * .73 - u * 3.4) - state.turn * .20 * u * u;
      tail[i * 3 + 2] = -.012 + .10 * u * u * Math.sin(phase * .61 - u * 3.0);
    }
    for (let i = 0; i <= tailSteps; i++) {
      const u = i / tailSteps, n = i * 3;
      const radius = .040 * Math.pow(1 - u, .72) + .009;
      for (let j = 0; j < 8; j++) {
        const ca = state.rings[8][j * 2], sa = state.rings[8][j * 2 + 1];
        put(tail[n], tail[n + 1] + radius * ca, tail[n + 2] + radius * sa,
          host._shade(0, ca, sa, .11, false, true), 0, 22000 + i * 8 + j);
      }
      // Preserve a continuous legible tip when its tube is sub-cell sized.
      put(tail[n], tail[n + 1], tail[n + 2] + radius, .74, 0, 23000 + i);
    }
    for (let j = 0; j < 3; j++) {
      d.tailRoot[j] = tail[j]; d.tailTip[j] = tail[tailSteps * 3 + j];
    }

    // Paired cephalic lobes join the head. They are short and deliberately
    // distinct from the one long rear tail; no borrowed outline or mesh.
    const lobeSteps = Math.ceil(28 / lod);
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i <= lobeSteps; i++) {
        const u = i / lobeSteps, bend = u * Math.PI * .68;
        const x = .86 + .54 * u - .05 * u * u;
        const y = side * (.24 + .10 * Math.sin(bend) - .055 * u);
        const z = .055 + .08 * u * u;
        const radius = .070 * (1 - .73 * u);
        for (let j = 0; j < 12; j += Math.min(lod, 2)) {
          const ca = state.rings[12][j * 2], sa = state.rings[12][j * 2 + 1];
          put(x, y + ca * radius, z + sa * radius,
            host._shade(-.15, ca, sa, .12), 0, 24000 + (side + 1) * 400 + i * 12 + j);
        }
      }
      // Small raised eye with a dark central pupil, rendered through the same
      // depth buffer. Ring thickness remains meaningful on a small grid.
      const eyeSteps = lod === 1 ? 10 : 7;
      for (let iy = -eyeSteps; iy <= eyeSteps; iy++) {
        for (let ix = -eyeSteps; ix <= eyeSteps; ix++) {
          const u = ix / eyeSteps, v = iy / eyeSteps, rr = u * u + v * v;
          if (rr > 1) continue;
          const dome = Math.sqrt(1 - rr), pupil = rr < .26;
          put(.82 + .090 * u, side * .32 + .080 * v, .145 + .065 * dome,
            pupil ? .035 : .86 + .08 * dome, 0, 26000 + (side + 1) * 250 + iy * 21 + ix);
        }
      }
    }
  }

  return Object.freeze({ id: 'manta', label: 'Manta ray', ink: false, bounds, create, pose, draw });
})();

// Original procedural octopus; integrated from Track 3. No browser globals or side effects.
const octopusDefinition = (() => {
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
    const o = host.options || {}, pointer = host.pointer || {}, fish = host.activeFish || {};
    const watching = o.followPointer || fish.behavior === 'curious';
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

/*
 * Cuttlefish / Field study
 * Original procedural artwork. Canvas 2D, projected parametric surfaces,
 * a character-cell depth buffer, and traveling waves. No models or assets.
 */



const SPECIES = new Map([['manta', mantaDefinition], ['octopus', octopusDefinition]]);

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const unit = (v, fallback = [1, 0, 0]) => { const n = Math.hypot(...v); return n > .00001 ? v.map(x => x / n) : fallback.slice(); };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // Timed, closed Hermite routes. Tangents agree at every join, including
  // the loop seam. The diver stays still; actual world-space distance sets size.
  const SWIM_ROUTE = [
    [0, -11, .18, -1.1], [1.1, -4.4, -.05, -.45], [2.3, -.75, -.08, -.15],
    [3.6, -.35, -.02, -.25], [5.8, .15, -.13, -.05], [8, .38, .08, -.35],
    [10, -.18, .13, -.45], [11.8, -.45, -.03, -.25], [13, .25, -.04, -.12],
    [14.5, 5.2, -.2, -.35], [16, 12, -.4, -1.8], [18, 24, .1, -8],
    [19.5, 0, -.5, -19], [21, -24, .3, -8], [23, -11, .18, -1.1]
  ];
  const ENCOUNTER_ROUTE = [
    [0, 2.3, .12, -3.8], [3, 1.1, -.1, -2.7], [7, .06, 0, -.2],
    [10, 0, 0, .92], [15, 0, 0, .92], [18, .06, -.05, -1.1],
    [21, 1.2, -.15, -3.3], [24, 3.1, .12, -4.6], [28, 2.3, .12, -3.8]
  ];
  function routeAt(route, time) {
    const last = route.length - 1, duration = route[last][0];
    const t = ((time % duration) + duration) % duration;
    let i = 0;
    while (i < last - 1 && t >= route[i + 1][0]) i++;
    const a = route[i], b = route[i + 1];
    const prev = i === 0 ? route[last - 1] : route[i - 1];
    const next = i + 2 > last ? route[1] : route[i + 2];
    const pt = prev[0] - (i === 0 ? duration : 0), nt = next[0] + (i + 2 > last ? duration : 0);
    const span = b[0] - a[0], u = (t - a[0]) / span, u2 = u * u, u3 = u2 * u;
    return [1, 2, 3].map(j => (2 * u3 - 3 * u2 + 1) * a[j]
      + (u3 - 2 * u2 + u) * span * (b[j] - prev[j]) / (b[0] - pt)
      + (-2 * u3 + 3 * u2) * b[j]
      + (u3 - u2) * span * (next[j] - a[j]) / (nt - a[0]));
  }
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); };
  const GLYPHS = '.,:;!i1l+txzvcofnae0&%8B@';
  const INK_GLYPHS = '.,:;+=x%#@';
  const REACTION = { react: .34, spray: .94, escape: 3.25, recover: 8.8 };
  const FORMATIONS = ['independent', 'horizontal', 'vertical', 'diagonal', 'random'];
  const BEHAVIORS = ['auto', 'cruise', 'hover', 'orbit', 'curious', 'encounter'];
  // Each animal owns its clocks and response. Geometry, glyph atlases, the
  // camera, and the depth buffer belong to the whole school.
  const FISH_STATE = ['sceneTime', 'reaction', 'agitation', 'movingTime', 'motionTravel', 'motionTurns',
    'motionVector', 'lastMotionAt', 'startleTension', 'escapeAmount', 'encounterGrip', 'encounterFront',
    'phase', 'progress', 'subjectVisibility', 'worldX', 'worldY', 'worldZ',
    'r00', 'r01', 'r02', 'r10', 'r11', 'r12', 'r20', 'r21', 'r22'];
  const PALETTES = {
    lagoon: { low: [26, 79, 106], middle: [58, 202, 190], high: [235, 255, 242], fin: [72, 144, 224], ink: [99, 180, 184], atmosphere: [40, 142, 140] },
    ultraviolet: { low: [55, 40, 116], middle: [142, 101, 222], high: [244, 215, 255], fin: [85, 155, 255], ink: [200, 129, 236], atmosphere: [119, 62, 179] },
    ember: { low: [103, 40, 42], middle: [218, 105, 66], high: [255, 231, 175], fin: [190, 80, 124], ink: [246, 152, 97], atmosphere: [179, 83, 47] }
  };

class CuttlefishArtwork {
    constructor(canvas, options = {}) {
      if (!canvas || typeof canvas.getContext !== 'function' || !canvas.ownerDocument?.defaultView) {
        throw new TypeError('CuttlefishArtwork requires an HTML canvas in a browser document. Importing the module is SSR-safe; construct it after mount.');
      }
      this._document = canvas.ownerDocument;
      this._view = this._document.defaultView;
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      if (!this.ctx) throw new Error('Canvas 2D is unavailable in this browser.');
      if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Options must be an object.');
      options = Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
      this.options = Object.assign({ scene: 'swimby', palette: 'lagoon', speed: 1.05, ripple: 1.3, density: 1.1, motion: 1.2, depthStrength: 1.2, mode: 'ascii', followPointer: false, glow: true, paused: false, count: 4, formation: 'independent', size: .7, sizeVariation: .45, spacing: 1, reverse: false, showLabels: false, behaviors: [], species: 'cuttlefish', speciesByAnimal: [], seed: 0, autoStart: true, reducedMotion: 'system', maxDpr: 2, maxPixels: 8294400, maxCells: 65536, maxFps: 60, observeVisibility: true }, options);
      this._normalizeOptions();
      this._motionQuery = this._view.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.paused = Object.hasOwn(options, 'paused') ? Boolean(options.paused)
        : this.options.reducedMotion === 'system' && Boolean(this._motionQuery?.matches);
      this.options.paused = this.paused;
      this._unsubscribe = null; this._lastFrame = null; this._accumulated = 0;
      this._inView = true; this._ready = false; this.droppedSeconds = 0;
      this.time = 0; this.sceneTime = 0; this.elapsed = 0; this.last = 0; this.fps = 0; this.frameCount = 0; this.fpsElapsed = 0; this.glyphCount = 0;
      this.pointer = { x: 0, y: 0, tx: 0, ty: 0, active: false, interest: 0 };
      this.burst = 0; this.ink = []; this.destroyed = false;
      this.reaction = this._newReaction();
      this.agitation = 0; this.movingTime = 0; this.startleTension = 0; this.escapeAmount = 0;
      this.motionTravel = 0; this.motionTurns = 0; this.motionVector = null; this.lastMotionAt = 0;
      this.phase = 'Approaching'; this.progress = 0;
      this.encounterGrip = 0; this.encounterFront = 0;
      this.glowCanvas = this._document.createElement('canvas');
      this.glowCtx = this.glowCanvas.getContext('2d');
      this.haloCanvas = this._document.createElement('canvas');
      this.haloCtx = this.haloCanvas.getContext('2d');
      this.atlas = this._document.createElement('canvas');
      this.atlasCtx = this.atlas.getContext('2d');
      this.inkAtlas = this._document.createElement('canvas');
      if (!this.glowCtx || !this.haloCtx || !this.atlasCtx || !this.inkAtlas.getContext('2d')) {
        throw new Error('Canvas 2D is unavailable for an offscreen buffer.');
      }
      this.palette = PALETTES[this.options.palette] || PALETTES.lagoon;
      this.motionAmount = 1.2; this.depthAmount = 1.2;
      this.samples = new Float32Array(36000 * 6); this.sampleCount = 0;
      this._rings = {};
      for (const n of [10, 48, 88]) this._rings[n] = Array.from({ length: n }, (_, i) => [Math.cos(i / n * TAU), Math.sin(i / n * TAU)]);
      this.plankton = Array.from({ length: 95 }, (_, i) => ({ x: hash(i + 2), y: hash(i + 170), phase: hash(i + 410) * TAU, size: hash(i + 810), char: '.·+*'[i % 4] }));
      this.fish = []; this._syncFish(true);
      this._move = e => this._pointerMove(e);
      this._leave = () => { this.pointer.tx = 0; this.pointer.ty = 0; this.pointer.active = false; this.lastPointer = null; };
      this._touch = e => {
        if (this.destroyed || !this.width || !this.height) return;
        if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
        const r = this.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        if (r.width <= 0 || r.height <= 0) return;
        this.pointer.tx = clamp(x / r.width - .5, -.5, .5); this.pointer.ty = clamp(y / r.height - .5, -.5, .5);
        if (this.paused) return;
        const hit = this._hitFish(x, y);
        const lensFish = this.options.scene === 'encounter' ? this.fish.find(f => f.behavior === 'encounter' || this._legacySingle()) : null;
        const target = hit >= 0 ? this.fish[hit] : lensFish;
        if (target && this._canReact(target)) this._startle('touch', target.id);
      };
      this._tick = this._tick.bind(this);
      this._visibility = () => {
        this._resetFrameClock();
        if (!this._document.hidden) this.render();
        this._syncLoop();
      };
      this._windowResize = () => this.resize();
      this._motionChange = event => {
        if (this.options.reducedMotion === 'system' && event.matches) this.setPaused(true);
      };
      // Register only after initial allocation succeeds; roll back if an observer
      // or subscription throws. Construction must not leak on a failed mount.
      try {
        this.resize();
        this.canvas.addEventListener('pointermove', this._move, { passive: true });
        this.canvas.addEventListener('pointerleave', this._leave, { passive: true });
        this.canvas.addEventListener('pointercancel', this._leave, { passive: true });
        this.canvas.addEventListener('pointerdown', this._touch, { passive: true });
        this._document.addEventListener('visibilitychange', this._visibility);
        this._view.addEventListener('resize', this._windowResize, { passive: true });
        this._motionQuery?.addEventListener?.('change', this._motionChange);
        if (typeof this._view.ResizeObserver === 'function') {
          this.observer = new this._view.ResizeObserver(() => this.resize());
          this.observer.observe(canvas);
        }
        if (typeof this._view.IntersectionObserver === 'function') {
          this.intersectionObserver = new this._view.IntersectionObserver(entries => {
            if (this.destroyed) return;
            for (const entry of entries) if (entry.target === canvas) this._inView = entry.isIntersecting;
            this._syncLoop();
          });
          this.intersectionObserver.observe(canvas);
        }
        this._ready = true; this._syncLoop();
      } catch (error) { this.destroy(); throw error; }
    }

    resize() {
      if (this.destroyed) return;
      const r = this.canvas.getBoundingClientRect();
      const width = Number.isFinite(r.width) ? Math.max(0, r.width) : 0;
      const height = Number.isFinite(r.height) ? Math.max(0, r.height) : 0;
      if (!width || !height) {
        this.width = 0; this.height = 0; this.dpr = 1; this._sizeKey = null;
        this.canvas.width = this.canvas.height = 0;
        this._releaseGrid(); this._syncLoop(); return;
      }
      const deviceDpr = Number(this._view.devicePixelRatio) || 1;
      // Backing-store limits are independent of CSS dimensions and grid density.
      // The per-axis bound also prevents an exceptionally long strip canvas.
      const dpr = Math.min(Math.max(.5, deviceDpr), this.options.maxDpr,
        Math.sqrt(this.options.maxPixels / (width * height)), 8192 / width, 8192 / height);
      const key = [width, height, dpr, this.options.density, this.options.maxCells].join(':');
      if (key === this._sizeKey) return;
      this._sizeKey = key; this.width = width; this.height = height; this.dpr = dpr;
      this.canvas.width = Math.max(1, Math.floor(width * dpr));
      this.canvas.height = Math.max(1, Math.floor(height * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const grid = (cell, ratio) => {
        let cols = Math.ceil(width / cell), rows = Math.ceil(height / (cell * ratio));
        while (cols * rows > this.options.maxCells || cols > 8192 || rows > 8192) {
          cell *= Math.max(1.001, Math.sqrt(cols * rows / this.options.maxCells), cols / 8192, rows / 8192);
          cols = Math.ceil(width / cell); rows = Math.ceil(height / (cell * ratio));
        }
        return { cell, cols, rows };
      };
      const main = grid((width < 520 ? 4.4 : 5.8) / this.options.density, 1.35);
      this.cellW = main.cell; this.cellH = main.cell * 1.35; this.cols = main.cols; this.rows = main.rows;
      const n = this.cols * this.rows;
      this.depth = new Float32Array(n); this.tones = new Uint8Array(n); this.glyphs = new Uint8Array(n); this.kinds = new Uint8Array(n);
      this.owners = new Int16Array(n); this.visibility = new Float32Array(n);
      const inkGrid = grid(width < 520 ? 6.2 : 8.2, 1.25);
      this.inkCellW = inkGrid.cell; this.inkCellH = inkGrid.cell * 1.25;
      this.inkCols = inkGrid.cols; this.inkRows = inkGrid.rows;
      this.inkDensity = new Float32Array(this.inkCols * this.inkRows);
      const inkNaturalSize = Math.max(1, Math.ceil(this.inkCellH * 1.5 * dpr));
      this.inkSprite = Math.min(64, inkNaturalSize);
      this.inkDrawSize = inkNaturalSize / dpr;
      this.inkAtlas.width = this.inkSprite * INK_GLYPHS.length; this.inkAtlas.height = this.inkSprite * 2;
      const ink = this.inkAtlas.getContext('2d');
      ink.font = `600 ${this.inkCellH * .96 * dpr * this.inkSprite / inkNaturalSize}px "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
      ink.textAlign = 'center'; ink.textBaseline = 'middle'; ink.fillStyle = '#010304';
      for (let i = 0; i < INK_GLYPHS.length; i++) ink.fillText(INK_GLYPHS[i], (i + .5) * this.inkSprite, this.inkSprite * .5);
      // A light violet ASCII plume stays legible on the dark octopus demo.
      // Keep the original cuttlefish ink row unchanged.
      ink.fillStyle = '#b8a6dc';
      for (let i = 0; i < INK_GLYPHS.length; i++) ink.fillText(INK_GLYPHS[i], (i + .5) * this.inkSprite, this.inkSprite * 1.5);
      this.glowCanvas.width = this.cols; this.glowCanvas.height = this.rows;
      this.haloCanvas.width = this.cols; this.haloCanvas.height = this.rows;
      this.glowPixels = this.glowCtx.createImageData(this.cols, this.rows);
      this.makeAtlas(); this.render(); this._syncLoop();
    }

    _releaseGrid() {
      this.depth = new Float32Array(0); this.tones = new Uint8Array(0);
      this.glyphs = new Uint8Array(0); this.kinds = new Uint8Array(0);
      this.owners = new Int16Array(0); this.visibility = new Float32Array(0);
      this.inkDensity = new Float32Array(0); this.glowPixels = null;
      this.cols = this.rows = this.inkCols = this.inkRows = 0;
      for (const buffer of [this.glowCanvas, this.haloCanvas, this.atlas, this.inkAtlas]) {
        if (buffer) buffer.width = buffer.height = 0;
      }
    }

    makeAtlas() {
      if (this.destroyed || !this.width || !this.height) return;
      const naturalSize = Math.max(1, Math.ceil(this.cellH * 1.6 * this.dpr));
      // A coarser grid makes larger logical glyphs, not larger atlas allocations.
      // Each raster sprite is capped independently of CSS size and DPR.
      const sz = Math.min(64, naturalSize);
      this.spriteDrawSize = naturalSize / this.dpr;
      this.sprite = sz;
      this.atlas.width = GLYPHS.length * sz; this.atlas.height = 72 * sz;
      const a = this.atlasCtx;
      a.clearRect(0, 0, this.atlas.width, this.atlas.height);
      a.font = `${Math.max(6, this.cellH * .94) * this.dpr * sz / naturalSize}px "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
      a.textAlign = 'center'; a.textBaseline = 'middle';
      this.colors = []; this.colorBytes = [];
      for (let k = 0; k < 3; k++) {
        for (let i = 0; i < 24; i++) {
          const t = i / 23, p = k === 2 ? { low: [17, 24, 24], middle: [139, 153, 139], high: [248, 241, 207] } : this.palette;
          const mid = k === 1 ? p.fin : p.middle;
          const rgb = p.low.map((v, j) => Math.round(t < .49 ? mix(v, mid[j], t / .49) : mix(mid[j], p.high[j], (t - .49) / .51)));
          const color = `rgb(${rgb.join(',')})`;
          this.colors.push(color); this.colorBytes.push(rgb); a.fillStyle = color;
          for (let g = 0; g < GLYPHS.length; g++) a.fillText(GLYPHS[g], (g + .5) * sz, (k * 24 + i + .5) * sz + this.dpr * .25 * sz / naturalSize);
        }
      }
    }

    _normalizeOptions(o = this.options) {
      const number = (key, fallback, low, high) => { const n = Number(o[key]); o[key] = clamp(Number.isFinite(n) ? n : fallback, low, high); };
      if (!['swimby', 'encounter', 'reactive'].includes(o.scene)) o.scene = 'swimby';
      if (!FORMATIONS.includes(o.formation)) o.formation = 'independent';
      number('speed', 1.05, .3, 2); number('ripple', 1.3, .3, 2); number('density', 1.1, .6, 1.5);
      number('motion', 1.2, 0, 2); number('depthStrength', 1.2, 0, 2);
      number('count', 4, 1, 12); o.count = Math.round(o.count);
      number('size', .7, .35, 1.4); number('sizeVariation', .45, 0, 1); number('spacing', 1, .65, 1.6);
      o.reverse = Boolean(o.reverse); o.showLabels = Boolean(o.showLabels);
      for (const key of ['paused', 'followPointer', 'glow', 'autoStart', 'observeVisibility']) o[key] = Boolean(o[key]);
      if (!Object.hasOwn(PALETTES, o.palette)) o.palette = 'lagoon';
      if (!['ascii', 'points'].includes(o.mode)) o.mode = 'ascii';
      if (!['system', 'ignore'].includes(o.reducedMotion)) o.reducedMotion = 'system';
      number('maxDpr', 2, .5, 2); number('maxPixels', 8294400, 65536, 16777216);
      number('maxCells', 65536, 1024, 262144); number('maxFps', 60, 10, 120);
      o.maxPixels = Math.floor(o.maxPixels); o.maxCells = Math.floor(o.maxCells);
      if (!['cuttlefish', ...SPECIES.keys()].includes(o.species)) throw new RangeError('Unknown species.');
      if (!Array.isArray(o.speciesByAnimal) || o.speciesByAnimal.length > 12 || !Array.from(o.speciesByAnimal).every(id => ['cuttlefish', ...SPECIES.keys()].includes(id))) throw new TypeError('Invalid speciesByAnimal.');
      o.speciesByAnimal = o.speciesByAnimal.slice();
      number('seed', 0, 0, 4294967295); o.seed = Math.floor(o.seed);
      o.behaviors = Array.from({ length: 12 }, (_, i) => BEHAVIORS.includes(o.behaviors?.[i]) ? o.behaviors[i] : 'auto');
    }

    _legacySingle() { return this.options.count === 1 && this.options.formation === 'independent' && this.options.behaviors[0] === 'auto'; }

    _behaviorFor(id) {
      const choice = this.options.behaviors[id];
      if (choice !== 'auto') return choice;
      if (this._legacySingle()) return this.options.scene === 'encounter' ? 'encounter' : this.options.scene === 'reactive' ? 'curious' : 'cruise';
      if (this.options.scene === 'encounter' && id === 0) return 'encounter';
      const roles = this.options.scene === 'reactive' ? ['curious', 'hover', 'orbit', 'cruise'] : ['cruise', 'hover', 'orbit', 'curious'];
      return roles[id % roles.length];
    }

    _syncFish(reset = false, changedRoles = []) {
      const previous = this.fish || [];
      const old = reset ? [] : previous;
      this.fish = Array.from({ length: this.options.count }, (_, id) => {
        const species = this.options.speciesByAnimal[id] || this.options.species;
        const previousFish = old[id];
        const reusable = !changedRoles.includes(id) && previousFish?.species === species && previousFish?.moduleSeed === this.options.seed;
        const f = (reusable && previousFish) || { id, sceneTime: 0, reaction: this._newReaction(), agitation: 0, movingTime: 0,
          motionTravel: 0, motionTurns: 0, motionVector: null, lastMotionAt: 0, startleTension: 0, escapeAmount: 0,
          encounterGrip: 0, encounterFront: 0, phase: 'Finding the current', progress: 0, subjectVisibility: 1,
          visible: false, worldX: 0, worldY: 0, worldZ: -1,
          r00: 1, r01: 0, r02: 0, r10: 0, r11: 1, r12: 0, r20: 0, r21: 0, r22: 1 };
        f.behavior = this._behaviorFor(id);
        f.seed = hash(id + 910); f.offset = id * 2.37; f.pace = .84 + hash(id + 501) * .31;
        f.species = species; f.definition = SPECIES.get(species) || null;
        f.moduleSeed = this.options.seed;
        if (!reusable) f.speciesState = f.definition ? f.definition.create(hash(id + 910 + this.options.seed * .123)) : null;
        // Stable variation: moving a control never randomly changes an animal.
        f.size = this.options.size * (1 + (hash(id + 602) * 2 - 1) * this.options.sizeVariation * .55);
        const columns = Math.ceil(Math.sqrt(this.options.count * 1.3)), rows = Math.ceil(this.options.count / columns);
        const column = id % columns, row = Math.floor(id / columns);
        f.anchor = [(column - (columns - 1) / 2) * (5.5 / Math.max(1, columns - 1)),
          (row - (rows - 1) / 2) * (2.6 / Math.max(1, rows - 1)), -.65 - hash(id + 710) * 1.75];
        if (this.options.count === 1) f.anchor = [0, 0, -.8];
        return f;
      });
      for (const f of previous) if (!this.fish.includes(f)) f.definition?.dispose?.(f.speciesState);
      this._activateFish(this.fish[0]);
    }

    _activateFish(f) {
      this.activeFish = f;
      for (const key of FISH_STATE) this[key] = f[key];
      this.objectScale = f.size;
    }

    _saveFish() {
      if (!this.activeFish) return;
      for (const key of FISH_STATE) this.activeFish[key] = this[key];
    }

    setOptions(patch) {
      if (this.destroyed) return;
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Options patch must be an object.');
      patch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
      const candidate = { ...this.options, ...patch };
      this._normalizeOptions(candidate);
      const oldDensity = this.options.density, oldPalette = this.options.palette;
      const oldBudget = [this.options.maxDpr, this.options.maxPixels, this.options.maxCells].join(':');
      const oldScene = this.options.scene, oldFormation = this.options.formation;
      const oldBehaviors = this.options.behaviors.slice();
      const oldSpecies = this.options.species, oldChoices = this.options.speciesByAnimal.join(), oldSeed = this.options.seed;
      this.options = candidate;
      const reset = oldScene !== this.options.scene || oldFormation !== this.options.formation;
      const changedRoles = this.options.behaviors.flatMap((behavior, id) => behavior !== oldBehaviors[id] ? [id] : []);
      this._syncFish(reset, changedRoles);
      if (reset || oldSpecies !== this.options.species || oldChoices !== this.options.speciesByAnimal.join() || oldSeed !== this.options.seed) { this.ink = []; this.lastPointer = null; }
      if (patch.paused !== undefined) this.paused = Boolean(patch.paused);
      else if (patch.reducedMotion === 'system' && this._motionQuery?.matches) this.paused = true;
      this.options.paused = this.paused;
      if (oldPalette !== this.options.palette) { this.palette = PALETTES[this.options.palette] || PALETTES.lagoon; this.makeAtlas(); }
      if (oldDensity !== this.options.density || oldBudget !== [this.options.maxDpr, this.options.maxPixels, this.options.maxCells].join(':')) this.resize();
      else this.render();
      this._syncLoop();
    }

    setPaused(value) {
      if (this.destroyed) return;
      if (this.paused === Boolean(value)) { this.options.paused = this.paused; return; }
      this.paused = Boolean(value); this.options.paused = this.paused;
      this._resetFrameClock(); if (this.paused) this.fps = 0;
      this.render(); this._syncLoop();
    }
    getStats() {
      const reacting = this.fish.find(f => f.reaction.active && f.reaction.age < REACTION.escape) || this.fish.find(f => f.reaction.active);
      const leader = reacting || this.fish[0];
      const stage = this._stageOf(leader.reaction);
      const formation = this.options.formation;
      const visibleCount = this.fish.filter(f => f.visible).length;
      const phase = reacting || this._legacySingle() ? leader.phase : formation === 'independent' ? 'Independent lives in the current'
        : formation === 'random' ? 'Wandering through open water' : `${formation[0].toUpperCase() + formation.slice(1)} current${this.options.reverse ? ' · reversed' : ''}`;
      return { fps: this._unsubscribe ? Math.round(this.fps) : 0, glyphs: this.glyphCount,
        paused: this.paused, running: Boolean(this._unsubscribe), destroyed: this.destroyed,
        droppedSeconds: this.droppedSeconds, width: this.width, height: this.height, dpr: this.dpr, cells: this.depth?.length || 0,
        time: this.time, phase, progress: leader.progress, agitation: Math.max(0, ...this.fish.map(f => clamp(f.agitation, 0, 1))),
        reactionStage: stage, inkGlyphs: this.inkGlyphCount || 0, count: this.fish.length, visibleCount, formation,
        species: this.options.species, fish: this.fish.map(f => ({ id: f.id + 1, species: f.species, behavior: f.behavior, phase: f.phase,
          reactionStage: this._stageOf(f.reaction), visible: f.visible, size: f.size })) };
    }

    _newReaction() {
      return { active: false, age: 99, emitted: 0, remainder: 0, start: [0, 0, 0],
        forward: [.86, -.04, .51], aim: [0, 0, 1], escapeDir: [-.7, 0, -.7], side: -1, grip: 0, front: 0 };
    }

    _reactionStage() { return this._stageOf(this.reaction); }

    _stageOf(r) {
      return !r.active ? 'idle' : r.age < REACTION.react ? 'react' : r.age < REACTION.spray ? 'spray'
        : r.age < REACTION.escape ? 'escape' : 'recover';
    }

    restart() {
      if (this.destroyed) return;
      this.time = 0; this.elapsed = 0; this.last = 0; this.burst = 0; this.ink = [];
      this._resetFrameClock(); this.droppedSeconds = 0; this.frameCount = 0; this.fpsElapsed = 0; this.fps = 0;
      this.pointer.x = this.pointer.y = this.pointer.tx = this.pointer.ty = 0;
      this.pointer.active = false; this.pointer.interest = 0;
      this.lastPointer = null; this._syncFish(true); this.render();
    }

    _hitFish(x, y) {
      if (!this.owners) return -1;
      const cx = Math.floor(x / this.cellW), cy = Math.floor(y / this.cellH);
      let owner = -1, distance = Infinity;
      // The shared z-buffer determines the visible animal when silhouettes
      // overlap. Empty water, plankton, and the ink cloud have no owner.
      for (let oy = -1; oy <= 1; oy++) for (let ox = -2; ox <= 2; ox++) {
        const xx = cx + ox, yy = cy + oy;
        if (xx < 0 || xx >= this.cols || yy < 0 || yy >= this.rows) continue;
        const index = yy * this.cols + xx, id = this.owners[index];
        if (id >= 0 && this.visibility[index] >= .2 && ox * ox + oy * oy < distance) { owner = id; distance = ox * ox + oy * oy; }
      }
      return owner;
    }

    _hitTest(x, y) { return this._hitFish(x, y) >= 0; }
    _canReact(f) { return !f.reaction.active && (!this._legacySingle() || this.options.scene !== 'swimby'); }

    _nearestFish(x, y) {
      let selected = null, nearest = Infinity;
      for (const f of this.fish) {
        if (!f.visible || !this._canReact(f)) continue;
        const q = this._projectWorld(f.worldX, f.worldY, f.worldZ);
        const distance = Math.hypot(q[0] / this.width - .5 - x, q[1] / this.height - .5 - y);
        if (distance < nearest) { selected = f; nearest = distance; }
      }
      return selected;
    }

    _pointerMove(e) {
      if (this.destroyed || this.paused || this._document.hidden || !this.width || !this.height) return;
      if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
      const r = this.canvas.getBoundingClientRect(), now = this._view.performance.now();
      if (r.width <= 0 || r.height <= 0) return;
      const x = clamp((e.clientX - r.left) / r.width - .5, -.5, .5);
      const y = clamp((e.clientY - r.top) / r.height - .5, -.5, .5);
      this.pointer.tx = x; this.pointer.ty = y; this.pointer.active = true;
      const prev = this.lastPointer;
      this.lastPointer = { x, y, time: now };
      if (!prev || this.paused || e.pointerType === 'touch' || (this._legacySingle() && this.options.scene !== 'reactive')) return;
      const dt = (now - prev.time) / 1000;
      if (dt <= 0 || dt > .16) return;
      const fish = this._nearestFish(x, y);
      if (!fish) return;
      this._activateFish(fish); this._camera(this.time + fish.offset);
      const distance = Math.hypot(x - prev.x, y - prev.y), speed = distance / Math.max(.004, dt);
      const body = this._project(.35, 0, 0);
      const distanceFromAnimal = Math.hypot(x + .5 - body[0] / this.width, y + .5 - body[1] / this.height);
      const proximity = .24 + .76 * Math.exp(-distanceFromAnimal * distanceFromAnimal / .15);
      if (speed > .24 && distance > .0007) {
        this.agitation += distance * clamp((speed - .20) * 1.15, 0, 2.4) * proximity;
        this.movingTime = Math.min(1.2, this.movingTime + Math.min(dt, .045));
        this.motionTravel += distance * proximity;
        const direction = [(x - prev.x) / distance, (y - prev.y) / distance];
        if (this.motionVector && this.motionVector[0] * direction[0] + this.motionVector[1] * direction[1] < -.45) this.motionTurns++;
        this.motionVector = direction; this.lastMotionAt = this.elapsed;
      }
      const repeatedSweeps = this.motionTurns >= 2 && this.motionTravel > .85;
      const triggered = this.agitation >= 1 && (this.movingTime >= .38 || repeatedSweeps) && this._startleFish('disturbance');
      this.agitation = Math.min(1.15, this.agitation); this._saveFish();
      if (triggered) this.render();
    }

    pulse() {
      if (this.destroyed || this.paused || !this.width || !this.height) return;
      if (this.options.scene === 'swimby') { this.restart(); return; }
      this._startle('button');
    }

    _aimAtPointer(origin) {
      const lens = this.perspectiveStrength;
      const near = lens > .01 ? .72 / lens : 3.8;
      const targetZ = this.encounterFront > .5 ? near - .22 : Math.min(near - .4, origin[2] + 1.8);
      const perspective = 1 / Math.max(.24, 1 - targetZ * lens);
      const target = [((this.pointer.tx + .5) * this.width - this.cx) / (this.scale * perspective),
        ((this.pointer.ty + .5) * this.height - this.cyScreen) / (this.scale * perspective), targetZ];
      return unit(target.map((v, j) => v - origin[j]), [0, 0, 1]);
    }

    _startle(reason, id) {
      const fish = Number.isInteger(id) ? this.fish[id] : this._nearestFish(this.pointer.tx, this.pointer.ty) || this.fish.find(f => this._canReact(f));
      if (!fish || this.paused || !this._canReact(fish)) return false;
      this._activateFish(fish); this._camera(this.time + fish.offset);
      const result = this._startleFish(reason); this._saveFish(); this.render(); return result;
    }

    _startleFish(reason) {
      if (this.paused || this.reaction.active) return false;
      const origin = this._world(...(this.activeFish.definition?.inkOrigin || [.93, .02, -.10])), aim = this._aimAtPointer(origin);
      const side = Math.abs(aim[0]) > .12 ? -Math.sign(aim[0]) : (Math.sin(this.time + 1.2) > 0 ? -1 : 1);
      this.reaction = { active: true, age: 0, emitted: 0, remainder: 0, reason,
        start: [this.worldX, this.worldY, this.worldZ], forward: [this.r00, this.r10, this.r20],
        aim, side, escapeDir: unit([-aim[0] * 1.15 + side * .52, -aim[1] * .58, -.83]),
        grip: this.encounterGrip, front: this.encounterFront,
        rotation: [this.r00, this.r01, this.r02, this.r10, this.r11, this.r12, this.r20, this.r21, this.r22] };
      this.agitation = 0; this.movingTime = 0; this.lastPointer = null;
      this.motionTravel = 0; this.motionTurns = 0; this.motionVector = null;
      // No particles and no travel impulse here: first the animal notices.
      return true;
    }

    _escapeOffset(age) {
      const r = this.reaction, e = clamp(age - REACTION.spray, 0, REACTION.escape - REACTION.spray);
      const ramp = .22, peak = 12.4, drag = 1.05;
      const distance = e < ramp ? peak * (e * .5 - ramp / (2 * Math.PI) * Math.sin(Math.PI * e / ramp))
        : peak * ramp * .5 + peak / drag * (1 - Math.exp(-drag * (e - ramp)));
      const offset = r.escapeDir.map(v => v * distance);
      offset[0] += r.side * 2.6 * smooth(.35, 2.1, e);
      return offset;
    }

    _emitInk(count, sprayProgress) {
      if (this.activeFish.definition?.ink === false) return;
      const r = this.reaction, origin = this._world(...(this.activeFish.definition?.inkOrigin || [.93, .02, -.10])), aim = r.aim;
      const radialA = unit(cross(aim, Math.abs(aim[1]) > .85 ? [1, 0, 0] : [0, 1, 0]));
      const radialB = cross(aim, radialA);
      for (let j = 0; j < count; j++) {
        const i = r.emitted++, seed = i + this.elapsed * 31;
        const angle = hash(seed + 3) * TAU, cone = .13 + hash(seed + 14) * .38;
        const radial = radialA.map((v, k) => v * Math.cos(angle) + radialB[k] * Math.sin(angle));
        const speed = 3.0 + 1.6 * Math.sin(Math.PI * sprayProgress) + hash(seed + 70) * .55;
        this.ink.push({ x: origin[0] + radial[0] * .027, y: origin[1] + radial[1] * .027, z: origin[2] + radial[2] * .027,
          vx: aim[0] * speed + radial[0] * cone, vy: aim[1] * speed + radial[1] * cone, vz: aim[2] * speed + radial[2] * cone,
          radius: .029 + hash(seed + 110) * .028, mass: .38 + hash(seed + 52) * .22,
          life: 6.7 + hash(seed + 90) * 2.7, age: 0, phase: angle, axis: aim, ...(this.activeFish.species === 'octopus' ? { lightInk: true } : {}) });
      }
      if (this.ink.length > 1150) this.ink.splice(0, this.ink.length - 1150);
    }

    _advanceReaction(dt) {
      const r = this.reaction;
      if (!r.active) return;
      const previousAge = r.age; r.age += dt;
      if (previousAge < REACTION.react) {
        r.aim = this._aimAtPointer(this._world(...(this.activeFish.definition?.inkOrigin || [.93, .02, -.10])));
        if (Math.abs(r.aim[0]) > .16) r.side = -Math.sign(r.aim[0]);
        r.escapeDir = unit([-r.aim[0] * 1.15 + r.side * .52, -r.aim[1] * .58, -.83]);
      }
      const emissionTime = Math.max(0, Math.min(r.age, REACTION.spray) - Math.max(previousAge, REACTION.react));
      if (emissionTime > 0) {
        r.remainder += emissionTime * 760;
        const n = Math.floor(r.remainder); r.remainder -= n;
        if (n) this._emitInk(n, clamp((r.age - REACTION.react) / (REACTION.spray - REACTION.react), 0, 1));
      }
      if (r.age >= REACTION.recover) {
        r.active = false;
        if (this.activeFish.behavior === 'encounter' && this.options.formation === 'independent') this.sceneTime = 0;
        this.lastPointer = null;
      }
    }

    _advanceInk(dt) {
      const near = this.perspectiveStrength > .01 ? .72 / this.perspectiveStrength : 3.8;
      for (const p of this.ink) {
        p.age += dt;
        // Curl of a smooth vector potential: neighboring glyphs advect
        // together into eddies instead of scattering as independent confetti.
        const f = 1.38, phase = this.time * .24;
        const a = Math.cos((p.x + p.y) * f + phase * .8);
        const b = Math.cos((p.z + p.x) * f - phase * .7);
        const c = Math.cos((p.y + p.z) * f + phase);
        const strength = .10 + .10 * smooth(.15, 1.8, p.age);
        const flow = [.06 + (a - b) * strength, -.016 + (c - a) * strength, (b - c) * strength * .65];
        const drag = Math.exp(-dt * (1.12 + p.age * .11));
        p.vx *= drag; p.vy *= drag; p.vz *= drag;
        p.x += (p.vx + flow[0]) * dt; p.y += (p.vy + flow[1]) * dt; p.z += (p.vz + flow[2]) * dt;
        if (p.z > near) {
          p.z = near; p.vz = Math.min(0, p.vz) * .15;
          p.vx += Math.cos(p.phase) * dt * .45; p.vy += Math.sin(p.phase) * dt * .45;
        }
      }
      // Stable in-place compaction retains survivor order without a new array.
      let alive = 0;
      for (let i = 0; i < this.ink.length; i++) {
        const particle = this.ink[i];
        if (particle.age < particle.life) this.ink[alive++] = particle;
      }
      this.ink.length = alive;
    }

    _resetFrameClock() { this.last = 0; this._lastFrame = null; this._accumulated = 0; }

    _shouldRun() {
      return this._ready && !this.destroyed && this.options.autoStart && !this.paused && !this._document.hidden
        && (!this.options.observeVisibility || this._inView) && this.width > 0 && this.height > 0;
    }

    _syncLoop() {
      if (this._shouldRun()) {
        if (!this._unsubscribe) {
          this._resetFrameClock();
          this._unsubscribe = getBrowserScheduler(this._view).subscribe(this._tick);
        }
      } else if (this._unsubscribe) {
        this._unsubscribe(); this._unsubscribe = null; this._resetFrameClock(); this.fps = 0;
      }
    }

    _tick(now) {
      if (!this._shouldRun()) { this._syncLoop(); return; }
      if (this._lastFrame === null) { this._lastFrame = now; return; }
      this._accumulated += Math.max(0, (now - this._lastFrame) / 1000);
      this._lastFrame = now;
      if (this._accumulated + 1e-9 < 1 / this.options.maxFps) return;
      const dt = Math.min(this._accumulated, .1);
      this.droppedSeconds += Math.max(0, this._accumulated - dt);
      this._accumulated = 0; this._simulate(dt);
    }

    // Explicit fixed-step control for tests, recording and host schedulers.
    // Repeat the same dt + input sequence for reproducible state. This is not
    // an analytic seek or a promise of identical ink at different frame rates.
    advance(dtSeconds) {
      if (this.destroyed) return;
      if (this.options.autoStart) throw new Error('advance() requires autoStart: false.');
      if (!Number.isFinite(dtSeconds) || dtSeconds < 0 || dtSeconds > .1) {
        throw new RangeError('advance() expects seconds between 0 and 0.1.');
      }
      if (!this.width || !this.height) return;
      this._simulate(dtSeconds);
    }

    _simulate(dt) {
        this.elapsed += dt; this.time += dt * this.options.speed;

        this.frameCount++; this.fpsElapsed += dt;
        if (this.fpsElapsed > .6) { this.fps = this.frameCount / this.fpsElapsed; this.frameCount = 0; this.fpsElapsed = 0; }
        const ease = 1 - Math.exp(-dt * 3);
        this.pointer.x += (this.pointer.tx - this.pointer.x) * ease; this.pointer.y += (this.pointer.ty - this.pointer.y) * ease;
        this.pointer.interest += ((this.pointer.active ? 1 : 0) - this.pointer.interest) * ease;
        for (const fish of this.fish) {
          this._activateFish(fish);
          if (!this.reaction.active) this.sceneTime += dt * this.options.speed;
          if (fish.behavior === 'encounter' && this.options.formation === 'independent') this.sceneTime = Math.min(11.5, this.sceneTime);
          this.agitation *= Math.exp(-dt * .95); this.movingTime *= Math.exp(-dt * .45);
          this.motionTravel *= Math.exp(-dt * .7);
          if (this.elapsed - this.lastMotionAt > .65) { this.motionTurns = 0; this.motionVector = null; }
          this._camera(this.time + fish.offset); this._advanceReaction(dt); this._saveFish();
        }
        this._advanceInk(dt);
        this.render();
    }

    _world(x, y, z) {
      x = (x - .30) * this.objectScale; y *= this.objectScale; z *= this.objectScale;
      return [this.worldX + x * this.r00 + y * this.r01 + z * this.r02,
        this.worldY + x * this.r10 + y * this.r11 + z * this.r12,
        this.worldZ + x * this.r20 + y * this.r21 + z * this.r22];
    }

    _projectWorld(x, y, z) {
      const perspective = 1 / Math.max(.24, 1 - z * this.perspectiveStrength);
      return [this.cx + x * this.scale * perspective, this.cyScreen + y * this.scale * perspective, z];
    }

    _project(x, y, z) { const p = this._world(x, y, z); return this._projectWorld(p[0], p[1], p[2]); }

    _shade(nx, ny, nz, detail = 0, fin = false, unit = false) {
      // Light, half-vector, and camera direction are transformed by R^-1
      // once per frame. Their dot products equal camera-space normal lighting.
      if (!unit) {
        const inv = 1 / Math.max(.0001, Math.sqrt(nx * nx + ny * ny + nz * nz));
        nx *= inv; ny *= inv; nz *= inv;
      }
      let diffuse = nx * this.lx + ny * this.ly + nz * this.lz;
      if (fin) diffuse = Math.abs(diffuse) * .85 + .15;
      else diffuse = Math.max(0, diffuse);
      let spec = Math.max(0, nx * this.hx + ny * this.hy + nz * this.hz);
      spec *= spec; spec *= spec; spec *= spec; spec *= spec;
      const view = Math.abs(nx * this.vx + ny * this.vy + nz * this.vz);
      let rim = 1 - Math.min(1, view); rim = rim * rim * rim;
      return .10 + .64 * diffuse + .32 * spec + .20 * rim + detail;
    }

    _put(x, y, z, light, kind = 0, seed = 0) {
      x = (x - .30) * this.objectScale; y *= this.objectScale; z *= this.objectScale;
      const xx = this.worldX + x * this.r00 + y * this.r01 + z * this.r02;
      const yy = this.worldY + x * this.r10 + y * this.r11 + z * this.r12;
      const zz = this.worldZ + x * this.r20 + y * this.r21 + z * this.r22;
      const distance = 1 - zz * this.perspectiveStrength;
      if (distance < .16 || this.sampleCount >= 36000) return;
      const perspective = 1 / Math.max(.24, distance);
      const px = xx * perspective, py = yy * perspective;
      this.minX = Math.min(this.minX, px); this.maxX = Math.max(this.maxX, px);
      this.minY = Math.min(this.minY, py); this.maxY = Math.max(this.maxY, py);
      const n = this.sampleCount++ * 6, samples = this.samples;
      samples[n] = px; samples[n + 1] = py; samples[n + 2] = zz;
      samples[n + 3] = light; samples[n + 4] = kind; samples[n + 5] = seed;
    }

    _rasterize() {
      // A fixed observer: never re-fit or re-center the moving organism.
      // Foreground arms and a close pass can intentionally leave the frame.
      const fit = this.scale;
      const samples = this.samples;
      for (let i = 0; i < this.sampleCount; i++) {
        const n = i * 6, zz = samples[n + 2];
        const col = Math.floor((this.cx + samples[n] * fit) / this.cellW);
        const row = Math.floor((this.cyScreen + samples[n + 1] * fit) / this.cellH);
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) continue;
        const index = row * this.cols + col;
        if (zz <= this.depth[index]) continue;
        this.depth[index] = zz; this.owners[index] = this.activeFish.id; this.visibility[index] = this.subjectVisibility;
        const fog = clamp(Math.exp(Math.min(0, zz) * .085 * this.depthAmount), .18, 1) * (zz > 0 ? 1.04 : 1);
        const light = clamp(samples[n + 3] * fog, .025, 1);
        this.tones[index] = Math.round(light * 23); this.kinds[index] = samples[n + 4];
        const variation = ((samples[n + 5] * 17) & 31) / 31 * .19;
        this.glyphs[index] = clamp(Math.floor((light * .76 + variation) * (GLYPHS.length - 1)), 0, GLYPHS.length - 1);
      }
    }

    _cacheNormals() {
      if (this.normalDepth === this.depthAmount) return;
      this.normalDepth = this.depthAmount;
      const thickness = .43 + .055 * this.depthAmount;
      this.bodyNormals = new Float32Array(83 * 88 * 3);
      for (let i = 0; i <= 82; i++) {
        const u = i / 82, theta = Math.PI * .90 * u;
        const sine = Math.max(.00001, Math.sin(theta));
        const nx = -.72 * Math.pow(sine, -.28) * Math.cos(theta) * Math.PI * .90 / 2.34;
        for (let j = 0; j < 88; j++) {
          const ny = this._rings[88][j][0] / .73, nz = this._rings[88][j][1] / thickness;
          const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz), n = (i * 88 + j) * 3;
          this.bodyNormals[n] = nx * inv; this.bodyNormals[n + 1] = ny * inv; this.bodyNormals[n + 2] = nz * inv;
        }
      }
      if (!this.headNormals) {
        this.headNormals = new Float32Array(37 * 48 * 3);
        for (let i = 0; i <= 36; i++) {
          const nx = -Math.cos(Math.PI * i / 36) * Math.PI / .94;
          for (let j = 0; j < 48; j++) {
            const ny = this._rings[48][j][0] / .40, nz = this._rings[48][j][1] / .36;
            const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz), n = (i * 48 + j) * 3;
            this.headNormals[n] = nx * inv; this.headNormals[n + 1] = ny * inv; this.headNormals[n + 2] = nz * inv;
          }
        }
      }
    }

    _schoolPose(t) {
      const fish = this.activeFish, id = fish.id, o = this.options;
      const travelScale = clamp(this.motionAmount / 1.2, 0, 1.2);
      const clock = this.sceneTime * fish.pace * travelScale, phase = fish.offset, a = fish.anchor;
      const formation = o.formation, direction = o.reverse ? -1 : 1;
      const aspect = this.width / Math.max(1, this.height);
      // A fixed camera is shared by every animal. Depth changes their apparent
      // scale and natural occlusion; the camera never fits individual bounds.
      const scale = Math.min(this.width / 9.8, this.height / 6.8);
      const lens = .28 * this.depthAmount / (1 + .55 * this.depthAmount);
      const z = a[2], denominator = 1 - z * lens;
      const halfW = this.width / (2 * scale) * denominator, halfH = this.height / (2 * scale) * denominator;
      const anchor = [a[0] * o.spacing, a[1] * o.spacing * Math.min(1.6, 1.6 / aspect), z];
      let position, forward, bank = 0;
      if (formation === 'horizontal' || formation === 'vertical' || formation === 'diagonal') {
        const v = formation === 'horizontal' ? [1, 0] : formation === 'vertical' ? [0, -1] : [Math.SQRT1_2, -Math.SQRT1_2];
        const normal = [-v[1], v[0]];
        const lane = this.fish.length > 1 ? (id / (this.fish.length - 1) - .5) : 0;
        const laneWidth = formation === 'horizontal' ? halfH * 1.02 : formation === 'vertical' ? halfW * 1.02 : Math.min(halfW, halfH) * 1.14;
        const extent = Math.abs(v[0]) * halfW + Math.abs(v[1]) * halfH + 3.5 * fish.size + 1;
        // Wrapping happens beyond the full silhouette, never in the diver's view.
        const travel = ((clock * 1.25 * direction + (id / Math.max(1, this.fish.length) - .5) * extent * 1.2 + extent) % (2 * extent) + 2 * extent) % (2 * extent) - extent;
        const laneOffset = lane * laneWidth * o.spacing;
        position = [v[0] * travel + normal[0] * laneOffset, v[1] * travel + normal[1] * laneOffset, z + Math.sin(t * .32 + phase) * .08];
        forward = unit([v[0] * direction, v[1] * direction, Math.cos(t * .24 + phase) * .065]);
        bank = Math.sin(t * .39 + phase) * .045;
        this.phase = `${formation[0].toUpperCase() + formation.slice(1)} swimmer`; this.progress = (travel + extent) / (2 * extent);
      } else if (formation === 'random') {
        const u = clock * .19 * direction + phase;
        const rx = Math.max(.6, halfW - 2.2 * fish.size) * o.spacing, ry = Math.max(.45, halfH - 1.55 * fish.size) * o.spacing;
        position = [rx * (.69 * Math.sin(u) + .17 * Math.sin(u * 1.73 + id)),
          ry * (.64 * Math.sin(u * .83 + id * 1.7) + .15 * Math.sin(u * 1.51)),
          -1.3 + .95 * Math.sin(u * .69 + phase)];
        forward = unit([rx * (.69 * Math.cos(u) + .2941 * Math.cos(u * 1.73 + id)),
          ry * (.5312 * Math.cos(u * .83 + id * 1.7) + .2265 * Math.cos(u * 1.51)), .6555 * Math.cos(u * .69 + phase)]);
        if (o.reverse) forward = forward.map(v => -v);
        bank = Math.sin(u * .8 + id) * .15;
        this.phase = 'Wandering'; this.progress = ((u / TAU) % 1 + 1) % 1;
      } else if (fish.behavior === 'encounter') {
        const beat = this._reactionStage() === 'recover' ? 0 : this.sceneTime;
        const front = smooth(1.4, 6.5, beat), hold = smooth(7.5, 10, beat);
        position = routeAt(ENCOUNTER_ROUTE, beat);
        this.encounterFront = front; this.encounterGrip = smooth(4.8, 9.5, beat);
        forward = unit([1 - front, -.04 * (1 - front), .3 + front]);
        const isLead = id === 0 && o.scene === 'encounter';
        const target = isLead ? [0, 0, .92] : [anchor[0] * .45, anchor[1] * .45, .74];
        position = position.map((v, j) => mix(v + (j < 2 && !isLead ? anchor[j] * .35 : 0), target[j], hold));
        position[0] -= forward[0] * 1.11 * fish.size * front; position[1] -= forward[1] * 1.11 * fish.size * front;
        this.phase = beat < 3.8 ? 'Turning toward you' : beat < 7.5 ? 'Coming closer' : beat < 10 ? 'Finding a hold' : 'Exploring the lens';
        this.progress = Math.min(1, beat / 10);
      } else if (fish.behavior === 'cruise') {
        const extent = halfW + 3.5 * fish.size + 1;
        const cruiseDirection = (id % 2 ? -1 : 1) * direction;
        const travel = ((clock * 1.05 + phase * 1.1 + extent * .55) % (2 * extent)) - extent;
        position = [travel * cruiseDirection, anchor[1] + Math.sin(clock * .34 + phase) * .17, z + Math.sin(clock * .24 + phase) * .22];
        forward = unit([cruiseDirection, Math.cos(clock * .34 + phase) * .055, Math.cos(clock * .24 + phase) * .052]);
        this.phase = 'Passing through'; this.progress = (travel + extent) / (2 * extent);
      } else if (fish.behavior === 'orbit') {
        const u = clock * .39 * direction + phase, radius = .75 + fish.seed * .45;
        position = [anchor[0] + Math.cos(u) * radius, anchor[1] + Math.sin(u) * radius * .48, z + Math.sin(u) * .7];
        forward = unit([-Math.sin(u) * radius * direction, Math.cos(u) * radius * .48 * direction, Math.cos(u) * .7 * direction]);
        bank = -.18 * direction;
        this.phase = 'Circling'; this.progress = ((u / TAU) % 1 + 1) % 1;
      } else {
        position = [anchor[0] + Math.sin(clock * .31 + phase) * .22, anchor[1] + Math.sin(clock * .43 + phase) * .13, z + Math.sin(clock * .25 + phase) * .15];
        if (fish.behavior === 'curious') {
          position[0] += this.pointer.x * .85; position[1] += this.pointer.y * .48;
          forward = unit([.62 + this.pointer.x * .7, this.pointer.y * .42, .62]);
          this.phase = this.agitation > .3 ? 'Noticing your movement' : 'Watching the diver';
        } else {
          forward = unit([.82 * (id % 2 ? -1 : 1), -.04 + Math.sin(t * .33) * .06, .52 + Math.sin(t * .27 + phase) * .16]);
          this.phase = 'Hovering in the current';
        }
        bank = Math.sin(t * .37 + phase) * .05; this.progress = (Math.sin(clock * .25) + 1) * .5;
      }
      return { position, forward, bank, anchor };
    }

    _camera(t) {
      const m = clamp(Number(this.options.motion), 0, 2), d = clamp(Number(this.options.depthStrength), 0, 2);
      this.motionAmount = Number.isFinite(m) ? m : 1.2; this.depthAmount = Number.isFinite(d) ? d : 1.2;
      const motion = this.motionAmount <= 1.2 ? this.motionAmount / 1.2 : 1 + (this.motionAmount - 1.2) * .25;
      const scene = this.options.scene, follow = this.options.followPointer ? 1 : 0;
      const r = this.reaction, stage = this._reactionStage();
      this.encounterGrip = 0; this.encounterFront = 0; this.startleTension = 0; this.escapeAmount = 0;
      this.subjectVisibility = 1;
      let position, forward, acceleration = [0, 0, 0], bank = 0, lingering = 0;
      let schoolAnchor = null;
      if (!this._legacySingle()) {
        const pose = this._schoolPose(t); position = pose.position; forward = pose.forward; bank = pose.bank; schoolAnchor = pose.anchor;
      } else if (scene === 'reactive') {
        position = [Math.sin(t * .24) * .38 + this.pointer.x * .16,
          Math.sin(t * .38) * .11 + this.pointer.y * .09, -.75 + Math.sin(t * .21) * .22];
        forward = unit([.88, -.045 + Math.sin(t * .4) * .045, .48 + Math.sin(t * .22) * .13 + this.pointer.x * .18]);
        bank = Math.sin(t * .35) * .035;
        this.phase = this.agitation > .3 ? 'Noticing your movement' : 'Calm · watching you';
        this.progress = this.agitation;
      } else {
        const route = scene === 'encounter' ? ENCOUNTER_ROUTE : SWIM_ROUTE;
        const clock = scene === 'encounter' && stage === 'recover' ? 0 : this.sceneTime;
        const duration = route[route.length - 1][0], beat = clock % duration;
        position = routeAt(route, clock);
        const before = routeAt(route, clock - .06), after = routeAt(route, clock + .06);
        forward = unit(after.map((v, j) => v - before[j]));
        acceleration = after.map((v, j) => (v - 2 * position[j] + before[j]) / (.06 * .06));
        this.progress = beat / duration;
        if (scene === 'encounter') {
          const front = smooth(1.4, 6.5, beat), hold = smooth(7.5, 10, beat);
          this.encounterFront = front;
          this.encounterGrip = smooth(4.8, 9.5, beat) * Math.min(1, motion);
          position = position.map((v, j) => mix(v, j === 2 ? .92 : 0, hold));
          forward = unit(forward.map((v, j) => mix(v, j === 2 ? 1 : 0, front)), [0, 0, 1]);
          position[0] -= forward[0] * 1.11 * front; position[1] -= forward[1] * 1.11 * front;
          this.phase = beat < 3.8 ? 'Turning toward you' : beat < 7.5 ? 'Coming closer' : beat < 10 ? 'Finding a hold' : 'Exploring the lens';
          this.progress = Math.min(1, beat / 10);
        } else {
          lingering = smooth(1.8, 3.3, beat) * (1 - smooth(11.5, 13.3, beat));
          const hovering = unit([.91, -.035 + Math.sin(t * .42) * .05, .39 + Math.sin(t * .32) * .21]);
          forward = unit(forward.map((v, j) => mix(v, hovering[j], lingering)));
          this.subjectVisibility = smooth(0, .6, beat) * (1 - smooth(16.2, 17.3, beat));
          this.phase = beat < 2.5 ? 'Arriving in a hurry' : beat < 11.8 ? 'Hanging in the current' : beat < 13.3 ? 'Getting ready to leave' : beat < 17.3 ? 'Swimming out of view' : 'Open water';
        }
      }
      const rest = schoolAnchor || [-.35, 0, -.7], restForward = unit([.9, -.06, .34]);
      const throughRoute = !this._legacySingle() && (['horizontal', 'vertical', 'diagonal'].includes(this.options.formation)
        || (this.options.formation === 'independent' && this.activeFish.behavior === 'cruise'));
      // A through-route slows down with Motion; it never shrinks its wrapping
      // boundary into the view. Zero Motion holds a distributed resting pose.
      const positionAmount = throughRoute && motion > .001 ? 1 : motion;
      position = position.map((v, j) => mix(rest[j], v, positionAmount));
      forward = unit(forward.map((v, j) => mix(restForward[j], v, Math.min(1, positionAmount))));
      if (scene !== 'reactive') {
        const curiosity = follow * (1 - this.encounterFront) * .45;
        position[0] += this.pointer.x * curiosity; position[1] += this.pointer.y * curiosity * .6;
      }
      const definition = this.activeFish.definition;
      let reference = [0, -.70710678, .70710678];
      if (definition?.pose) {
        const pose = definition.pose(this, t, this.activeFish.speciesState, { position, forward, bank, reference });
        position = pose.position; forward = unit(pose.forward); bank = pose.bank; reference = pose.reference;
      }
      if (r.active) {
        this.subjectVisibility = 1;
        const age = r.age, amount = Math.min(1, motion);
        this.startleTension = smooth(0, REACTION.react, age) * (1 - smooth(REACTION.spray, 1.55, age));
        this.escapeAmount = smooth(.70, 1.45, age) * (1 - smooth(REACTION.escape, REACTION.recover, age));
        this.encounterGrip = r.grip * (1 - smooth(REACTION.spray, 1.5, age));
        this.encounterFront = r.front * (1 - smooth(.94, 2.15, age));
        const escape = this._escapeOffset(age).map(v => v * amount);
        const facingThreat = definition?.ink === false
          ? unit(r.forward.map((v, j) => mix(v, r.escapeDir[j], smooth(REACTION.react, 1.35, age))))
          : unit(r.forward.map((v, j) => mix(v, r.aim[j], smooth(REACTION.spray, 1.8, age) * .72)));
        if (stage === 'recover') {
          const u = smooth(REACTION.escape, REACTION.recover, age);
          const far = r.start.map((v, j) => v + escape[j]);
          position = far.map((v, j) => mix(v, position[j], u));
          position[2] -= Math.sin(u * Math.PI) * 2.4 * amount;
          forward = unit(facingThreat.map((v, j) => mix(v, forward[j], u)));
          bank = -r.side * .24 * (1 - u);
        } else {
          // Mantle-first jet: notice and contract, then spray while nearly
          // stationary, then accelerate away with the arms streaming behind.
          position = r.start.map((v, j) => v + escape[j] - r.forward[j] * .045 * this.startleTension * amount);
          forward = facingThreat;
          bank = -r.side * .24 * smooth(definition?.ink === false ? REACTION.react : REACTION.spray, 1.55, age);
        }
        this.phase = stage === 'react' ? 'Reacting · gathering arms' : stage === 'spray' ? 'Spraying ASCII ink' : stage === 'escape' ? 'Jetting away' : scene === 'encounter' ? 'Circling back' : 'Returning quietly';
        if (definition?.ink === false) this.phase = stage === 'react' ? 'Alert · wings drawing in' : stage === 'spray' ? 'Preparing to bank away' : stage === 'escape' ? 'Gliding away' : 'Returning to the current';
        this.progress = age / REACTION.recover;
      }
      if (motion < .001) { this.phase = r.active ? this.phase : 'Holding position'; this.subjectVisibility = 1; }
      let dorsal = unit(reference.map((v, j) => v - forward[j] * dot(reference, forward)), [0, -1, 0]);
      let lateral = unit(cross(dorsal, forward), [0, 1, 0]);
      if (!definition && this._legacySingle() && scene !== 'reactive' && !r.active) bank = clamp(Math.atan2(dot(acceleration, lateral), 2.4), -.3, .3) * (1 - .85 * lingering);
      bank *= (1 - this.encounterFront) * Math.min(1, motion);
      const cb = Math.cos(bank), sb = Math.sin(bank), l = lateral.slice(), z = dorsal.slice();
      lateral = l.map((v, j) => v * cb - z[j] * sb); dorsal = z.map((v, j) => v * cb + l[j] * sb);
      this.r00 = forward[0]; this.r10 = forward[1]; this.r20 = forward[2];
      this.r01 = lateral[0]; this.r11 = lateral[1]; this.r21 = lateral[2];
      this.r02 = dorsal[0]; this.r12 = dorsal[1]; this.r22 = dorsal[2];
      if (r.active && r.age <= (definition?.ink === false ? REACTION.react : REACTION.spray) && r.rotation) {
        // A stationary warning and spray, including at the largest body size.
        // Turning starts with the escape, so near-plane protection cannot pull
        // the animal backward before its ink jet has finished.
        [this.r00, this.r01, this.r02, this.r10, this.r11, this.r12, this.r20, this.r21, this.r22] = r.rotation;
      }
      const lx = -.38, ly = -.48, lz = .790, hx = -.204, hy = -.258, hz = .944;
      this.lx = this.r00 * lx + this.r10 * ly + this.r20 * lz; this.ly = this.r01 * lx + this.r11 * ly + this.r21 * lz; this.lz = this.r02 * lx + this.r12 * ly + this.r22 * lz;
      this.hx = this.r00 * hx + this.r10 * hy + this.r20 * hz; this.hy = this.r01 * hx + this.r11 * hy + this.r21 * hz; this.hz = this.r02 * hx + this.r12 * hy + this.r22 * hz;
      this.vx = this.r20; this.vy = this.r21; this.vz = this.r22;
      this.perspectiveStrength = .28 * this.depthAmount / (1 + .55 * this.depthAmount);
      if (this.perspectiveStrength > 0) {
        // Keep the complete scaled surface in front of the near plane, even
        // when a large wanderer turns its feeding arms straight at the diver.
        const grip = clamp(this.encounterGrip, 0, 1);
        const maxX = mix(2.78, 2.02, grip), maxY = mix(1.8, 3.25, grip), maxZ = mix(1.4, 2.5, grip);
        const b = definition?.bounds;
        const frontExtent = b
          ? (Math.max((b.minX - .30) * this.r20, (b.maxX - .30) * this.r20) + b.maxY * Math.abs(this.r21) + b.maxZ * Math.abs(this.r22)) * this.objectScale
          : (Math.max(-2.15 * this.r20, maxX * this.r20) + maxY * Math.abs(this.r21) + maxZ * Math.abs(this.r22)) * this.objectScale;
        position[2] = Math.min(position[2], .72 / this.perspectiveStrength - frontExtent);
      }
      this.worldX = position[0]; this.worldY = position[1]; this.worldZ = position[2];
      this.cx = this.width * .5; this.cyScreen = this.height * .48;
      this.scale = this._legacySingle() ? Math.min(this.width / 7.4, this.height / 4.6) : Math.min(this.width / 9.8, this.height / 6.8);
      if (definition && this.options.count === 1) this.scale = Math.min(this.width / 8, this.height / 6.8);
      const projectedRadius = this.objectScale * this.scale / Math.max(.24, 1 - this.worldZ * this.perspectiveStrength);
      this.geometryStep = projectedRadius > 105 || this.encounterGrip > .3 ? 1 : projectedRadius > 46 ? 2 : 3;
      if (!definition) this._cacheNormals();
    }

    _body(t) {
      const ripple = this.options.ripple, lod = this.geometryStep || 1;
      const nu = 82, nv = 88, ring = this._rings[88];
      const thickness = .43 + .055 * this.depthAmount;
      for (let i = 0; i <= nu; i += lod) {
        const u = i / nu, theta = Math.PI * .90 * u;
        const sine = Math.max(.00001, Math.sin(theta));
        const profile = i === 0 ? 0 : Math.pow(sine, .72);
        const slope = .72 * Math.pow(sine, -.28) * Math.cos(theta) * Math.PI * .90 / 2.34;
        const x = -1.85 + 2.34 * u;
        const breath = (1 + .037 * Math.sin(t * 2.8 - u * 3.2)) * (1 - this.startleTension * .09);
        const ry = .73 * profile * breath, rz = thickness * profile;
        const flex = .035 * Math.sin(t * 2.2 - u * 3.8);
        for (let j = 0; j < nv; j += lod) {
          const phi = j / nv * TAU, c = ring[j][0], sn = ring[j][1];
          const stripe = Math.sin(u * 35 + Math.sin(phi * 5 + t * .65) * 1.8 - t * 1.25);
          const mottling = Math.sin(u * 79 + phi * 13) * Math.cos(phi * 19 - u * 25 + t * .3);
          const relief = 1 + .013 * stripe;
          const ni = (i * nv + j) * 3, bn = this.bodyNormals;
          const light = this._shade(bn[ni], bn[ni + 1], bn[ni + 2], .11 * stripe + .045 * mottling, false, true);
          this._put(x, ry * c * relief, rz * sn * relief + flex, light, 0, i * 101 + j);
        }
      }
      // The tail tapers to a true point. A solid shoulder cap closes the
      // front of the mantle underneath the overlapping head.
      const frontProfile = Math.pow(Math.sin(Math.PI * .9), .72);
      for (let ir = 0; ir <= 12; ir += this.geometryStep || 1) {
        const r = ir / 12;
        for (let j = 0; j < 48; j += this.geometryStep || 1) {
          const a = this._rings[48][j];
          this._put(.49, .73 * frontProfile * r * a[0], thickness * frontProfile * r * a[1], this._shade(1, 0, 0, -.035), 0, ir * 51 + j);
        }
      }
      // A broad, very thin skirt fin: out-of-plane traveling waves make
      // its near and far edges trade occlusion naturally as the animal turns.
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i <= 116; i += lod) {
          const u = i / 116;
          const x = -1.85 + 2.34 * u;
          const profile = Math.pow(Math.max(0, Math.sin(Math.PI * .9 * u)), .72);
          const ry = .73 * profile * (1 + .037 * Math.sin(t * 2.8 - u * 3.2));
          const spread = .31 * Math.pow(Math.sin(Math.PI * u), .65) * (1 - this.escapeAmount * .48);
          const phase = u * 20 - t * 4.8 + side * .85;
          const wave = (Math.sin(phase) * .18 + Math.sin(phase * 1.8 + 1.1) * .035) * ripple;
          const flex = .035 * Math.sin(t * 2.2 - u * 3.8);
          for (let j = 0; j <= 15; j += lod) {
            const v = j / 15;
            const y = side * (ry + spread * v + Math.sin(phase) * .04 * v);
            const z = flex + .015 + wave * Math.pow(v, 1.35) - .045 * v;
            const nx = -Math.cos(phase) * .65 * ripple * v;
            const ny = -side * wave * 2.5 * v;
            const edge = j === 15 ? .32 : .03;
            const light = this._shade(nx, ny, 1, -.12 + .10 * v + edge, true);
            this._put(x, y, z, light, 1, i * 29 + j + side);
          }
        }
      }
      // A closed ellipsoidal head and two raised, rounded eyes.
      for (let i = 0; i <= 36; i += lod) {
        const u = i / 36, x = .30 + .94 * u;
        const r = Math.sin(Math.PI * u), slope = Math.cos(Math.PI * u) * Math.PI / .94;
        for (let j = 0; j < 48; j += this.geometryStep || 1) {
          const a = this._rings[48][j];
          const ni = (i * 48 + j) * 3, hn = this.headNormals;
          const light = this._shade(hn[ni], hn[ni + 1], hn[ni + 2], Math.sin(u * 30 + j * .7) * .035, false, true);
          this._put(x, a[0] * .40 * r, a[1] * .36 * r, light, 0, i * 71 + j);
        }
      }
      this._eye(.75, -.31, .35, .145, t);
      this._eye(.79, .33, .43, .20, t);
    }

    _eye(x, y, z, radius, t) {
      // The luminous crescent and a W-shaped dark slit distinguish the eye.
      for (let iy = -12; iy <= 12; iy += this.geometryStep || 1) {
        for (let ix = -14; ix <= 14; ix += this.geometryStep || 1) {
          const u = ix / 14, v = iy / 12, rr = u * u + v * v;
          if (rr > 1) continue;
          const dome = Math.sqrt(1 - rr);
          const slit = -.03 + .20 * Math.cos(u * Math.PI * 2);
          const pupil = Math.abs(v - slit) < .19 && Math.abs(u) < .82;
          const light = pupil ? .025 : .46 + this._shade(u * .45, v * .45, dome, 0) * .54;
          this._put(x + u * radius * 1.1, y + v * radius * .72, z + .1 * dome, light, 0, ix * 17 + iy * 9);
        }
      }
    }

    _arms(t) {
      const requestedGrip = Number(this.encounterGrip);
      const tension = clamp(Number(this.startleTension) || 0, 0, 1);
      const escape = clamp(Number(this.escapeAmount) || 0, 0, 1);
      const grip = Number.isFinite(requestedGrip)
        ? clamp(requestedGrip, 0, 1) * (1 - .9 * escape) : 0;
      // Ordinary swimming retains its trailing waves. A jet bundles the arms
      // into the slipstream; a short startle contracts them before release.
      if (grip <= .001) {
        const ring = this._rings[10];
        for (let k = 0; k < 10; k++) {
          const feeding = k >= 8, angle = (k % 8) / 8 * TAU;
          const side = feeding ? (k === 8 ? -1 : 1) : Math.cos(angle);
          const length = feeding ? 2.05 : 1.36 + .21 * Math.sin(k * 2.1);
          const segments = Math.round((feeding ? 84 : 68) / (this.geometryStep || 1)), step = length / segments;
          let x = 1.02, y = Math.cos(angle) * .20, z = Math.sin(angle) * .17;
          const fan = side * (feeding ? .20 : .48) * (1 - .72 * escape) * (1 - .14 * tension);
          const curlSign = feeding ? side : (k % 2 === 0 ? 1 : -1);
          for (let i = 0; i <= segments; i++) {
            const u = i / segments, delayed = t * 2.25 - u * 5.2 + k * .83;
            const wave = Math.sin(delayed) * (.23 + .19 * this.options.ripple) * u * (1 - .68 * escape);
            const curl = curlSign * (feeding ? 1.7 : 5.4) * Math.pow(u, 4.1) * (1 - .84 * escape + .1 * tension);
            const theta = fan + wave + curl;
            const beta = Math.sin(angle) * .15 + Math.sin(delayed * .82) * (.22 + .13 * this.options.ripple) * u * (1 - .66 * escape);
            const ct = Math.cos(theta), st = Math.sin(theta), cb = Math.cos(beta), sb = Math.sin(beta);
            if (i > 0) { x += ct * cb * step; y += st * cb * step; z += sb * step; }
            const club = feeding ? .054 * Math.exp(-Math.pow((u - .89) / .1, 2)) : 0;
            const radius = (feeding ? .035 : .064) * Math.pow(1 - u, .65) + .007 + club;
            for (let j = 0; j < 10; j += this.geometryStep || 1) {
              const ca = ring[j][0], sa = ring[j][1];
              const nx = -st * ca - sb * ct * sa, ny = ct * ca - sb * st * sa, nz = cb * sa;
              const light = this._shade(nx, ny, nz, .06 * Math.sin(u * 55 - t), false, true);
              this._put(x + nx * radius, y + ny * radius, z + nz * radius, light, k % 3 === 0 ? 1 : 0, i * 19 + j + k * 90);
            }
            if (i % 5 === 0 && u > .12 && u < .96) this._put(x - sb * ct * radius, y - sb * st * radius, z + cb * radius * 1.05, .97, 0, i + k);
          }
        }
        return;
      }

      if (!this._gripPoints) {
        this._gripPoints = Array.from({ length: 10 }, () => new Float32Array(85 * 3));
        this._gripRing = Array.from({ length: 12 }, (_, j) => [Math.cos(j / 12 * TAU), Math.sin(j / 12 * TAU)]);
        this._cupRing = Array.from({ length: 8 }, (_, j) => [Math.cos(j / 8 * TAU), Math.sin(j / 8 * TAU)]);
      }
      if (!this._crawlArms) {
        // Angular sectors, reach, bend, phase and pace differ deliberately.
        // Neighbors alternate between holding purchase and exploring the lens.
        this._crawlArms = [
          [ .10, 1.38,  .52, .02, .151, 1.08],
          [ .63, 1.19, -.72, .47, .177,  .94],
          [1.68, 1.53,  .66, .19, .129, 1.05],
          [2.29, 1.30, -.44, .71, .163,  .91],
          [3.29, 1.50, -.62, .38, .142, 1.12],
          [3.84, 1.18,  .77, .90, .184,  .97],
          [4.83, 1.58, -.55, .61, .136, 1.00],
          [5.64, 1.29,  .68, .26, .169,  .92],
          [ .40, 1.76, -.43, .79, .113,  .86],
          [3.57, 1.87,  .57, .11, .121,  .90]
        ];
      }
      const ease = (a, b, x) => {
        const q = clamp((x - a) / (b - a), 0, 1);
        return q * q * (3 - 2 * q);
      };
      const g = grip * grip * (3 - 2 * grip);
      const aspect = this.width / Math.max(1, this.height);
      const spreadY = clamp(aspect, 1, 1.55), spreadZ = clamp(1 / aspect, 1, 1.30);

      for (let k = 0; k < 10; k++) {
        const feeding = k >= 8, normalAngle = (k % 8) / 8 * TAU;
        const cfg = this._crawlArms[k];
        const cycle = ((t * cfg[4] + cfg[3]) % 1 + 1) % 1;
        const contact = ease(.09, .23, cycle) * (1 - ease(.69, .86, cycle));
        const creep = ease(.20, .69, cycle) * (1 - ease(.86, 1, cycle));
        const lifted = 1 - contact;
        const angle = cfg[0] + .075 * Math.sin(t * (.31 + k * .013) + k * 1.77);
        const curlSign = Math.sign(cfg[2]);
        const tipAngle = angle + curlSign * (.10 + .28 * creep)
          + .045 * Math.sin(t * .67 + k * 1.19) * lifted;
        const reach = cfg[1] * (1 - .12 * lifted + .045 * Math.sin(TAU * cycle - .4))
          * (1 - .12 * tension);
        const bendAngle = tipAngle - cfg[2] * (.72 + .46 * lifted)
          + .07 * Math.sin(t * .53 + k * 1.4);
        const outerReach = reach + (.30 + .13 * lifted) * (feeding ? .72 : 1);
        const midAngle = angle - cfg[2] * .28 + .10 * Math.sin(t * .46 - k * .71);
        // The distal contact patch is almost still in depth while it creeps.
        // Peeling lifts that arm off the glass, retracts it, then reaches again.
        const tipX = 2.08 - .45 * lifted - .15 * tension;
        const p0x = 1.02, p0y = Math.cos(normalAngle) * .20, p0z = Math.sin(normalAngle) * .17;
        const p1x = 1.52 + .08 * Math.sin(t * .65 + k),
          p1y = Math.cos(midAngle) * .55 * spreadY,
          p1z = Math.sin(midAngle) * .55 * spreadZ;
        const p2x = 2.26 - .10 * lifted - .12 * tension,
          p2y = Math.cos(bendAngle) * outerReach * spreadY,
          p2z = Math.sin(bendAngle) * outerReach * spreadZ;
        const p3x = tipX,
          p3y = Math.cos(tipAngle) * reach * spreadY,
          p3z = Math.sin(tipAngle) * reach * spreadZ;
        const side = feeding ? (k === 8 ? -1 : 1) : Math.cos(normalAngle);
        const segments = Math.round((feeding ? 84 : 68) / (this.geometryStep || 1));
        const length = feeding ? 2.05 : 1.36 + .21 * Math.sin(k * 2.1), step = length / segments;
        const normalCurlSign = feeding ? side : (k % 2 === 0 ? 1 : -1);
        const points = this._gripPoints[k];
        let nx = p0x, ny = p0y, nz = p0z;

        for (let i = 0; i <= segments; i++) {
          const u = i / segments, delayed = t * 2.25 - u * 5.2 + k * .83;
          const theta = side * (feeding ? .20 : .48) * (1 - .72 * escape) * (1 - .14 * tension)
            + Math.sin(delayed) * (.23 + .19 * this.options.ripple) * u * (1 - .68 * escape)
            + normalCurlSign * (feeding ? 1.7 : 5.4) * Math.pow(u, 4.1) * (1 - .84 * escape + .1 * tension);
          const beta = Math.sin(normalAngle) * .15
            + Math.sin(delayed * .82) * (.22 + .13 * this.options.ripple) * u * (1 - .66 * escape);
          if (i > 0) {
            nx += Math.cos(theta) * Math.cos(beta) * step;
            ny += Math.sin(theta) * Math.cos(beta) * step;
            nz += Math.sin(beta) * step;
          }
          const v = 1 - u, b0 = v * v * v, b1 = 3 * v * v * u, b2 = 3 * v * u * u, b3 = u * u * u;
          // Local muscular waves travel down an arm. Their endpoint envelope
          // is zero, so the moving elbow does not drag an attached tip around.
          const envelope = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 1.3);
          const localWave = Math.sin(t * (1.17 + k * .047) - u * 7.1 + k * 1.91);
          const crossWave = Math.sin(t * (.83 + k * .023) - u * 4.7 - k * 1.13);
          const wave = envelope * (.055 + .025 * this.options.ripple) * localWave;
          const ex = p0x * b0 + p1x * b1 + p2x * b2 + p3x * b3
            + envelope * .055 * crossWave;
          const ey = p0y * b0 + p1y * b1 + p2y * b2 + p3y * b3
            - Math.sin(angle) * wave * spreadY;
          const ez = p0z * b0 + p1z * b1 + p2z * b2 + p3z * b3
            + Math.cos(angle) * wave * spreadZ;
          const n = i * 3;
          points[n] = nx + (ex - nx) * g;
          points[n + 1] = ny + (ey - ny) * g;
          points[n + 2] = nz + (ez - nz) * g;
        }

        for (let i = 0; i <= segments; i++) {
          const u = i / segments, n = i * 3;
          const prev = Math.max(0, i - 1) * 3, next = Math.min(segments, i + 1) * 3;
          let tx = points[next] - points[prev], ty = points[next + 1] - points[prev + 1], tz = points[next + 2] - points[prev + 2];
          let inv = 1 / Math.max(.00001, Math.hypot(tx, ty, tz));
          tx *= inv; ty *= inv; tz *= inv;
          let rx = 0, ry = Math.cos(angle), rz = Math.sin(angle);
          let dp = rx * tx + ry * ty + rz * tz;
          rx -= dp * tx; ry -= dp * ty; rz -= dp * tz;
          if (rx * rx + ry * ry + rz * rz < .00001) {
            rx = 0; ry = -Math.sin(angle); rz = Math.cos(angle);
            dp = ry * ty + rz * tz; rx -= dp * tx; ry -= dp * ty; rz -= dp * tz;
          }
          inv = 1 / Math.max(.00001, Math.hypot(rx, ry, rz)); rx *= inv; ry *= inv; rz *= inv;
          const bx = ty * rz - tz * ry, by = tz * rx - tx * rz, bz = tx * ry - ty * rx;
          const club = feeding ? .054 * Math.exp(-Math.pow((u - .89) / .1, 2)) : 0;
          const normalRadius = (feeding ? .035 : .064) * Math.pow(1 - u, .65) + .007 + club;
          const gripRadius = ((feeding ? .061 : .096) * cfg[5] * (1 - .68 * u) + .014 + club * .75)
            * (1 + .12 * tension) * (1 + .045 * Math.sin(t * 1.5 - u * 8 + k));
          const radius = normalRadius + (gripRadius - normalRadius) * g;
          const x = points[n], y = points[n + 1], z = points[n + 2];
          for (let j = 0; j < 12; j += this.geometryStep || 1) {
            const ca = this._gripRing[j][0], sa = this._gripRing[j][1];
            const sx = rx * ca + bx * sa, sy = ry * ca + by * sa, sz = rz * ca + bz * sa;
            const texture = .045 * Math.sin(u * 65 - t * .7 + k);
            this._put(x + sx * radius, y + sy * radius, z + sz * radius,
              this._shade(sx, sy, sz, texture, false, true), k % 3 === 0 ? 1 : 0, i * 19 + j + k * 90);
          }
          if (i % 6 === 0 && u > .10 && u < .95) {
            let cx = g, cy = 0, cz = 1 - g;
            dp = cx * tx + cy * ty + cz * tz;
            cx -= dp * tx; cy -= dp * ty; cz -= dp * tz;
            if (cx * cx + cy * cy + cz * cz < .00001) { cx = -rx; cy = -ry; cz = -rz; }
            inv = 1 / Math.max(.00001, Math.hypot(cx, cy, cz)); cx *= inv; cy *= inv; cz *= inv;
            const ux = cy * tz - cz * ty, uy = cz * tx - cx * tz, uz = cx * ty - cy * tx;
            const cupRadius = radius * (.27 + .09 * g), lift = radius * 1.02;
            const light = clamp(.25 + this._shade(cx, cy, cz, 0, false, true) * .86, .38, .98);
            for (let j = 0; j < 8; j++) {
              const ca = this._cupRing[j][0], sa = this._cupRing[j][1];
              this._put(x + cx * lift + (tx * ca + ux * sa) * cupRadius,
                y + cy * lift + (ty * ca + uy * sa) * cupRadius,
                z + cz * lift + (tz * ca + uz * sa) * cupRadius,
                light, 0, 17000 + k * 200 + i * 8 + j);
            }
            this._put(x + cx * (lift - .009), y + cy * (lift - .009), z + cz * (lift - .009), .075, 0, k * 600 + i);
          }
        }
      }
    }

    _beak(t) {
      // A small, stylized two-jaw beak. Its focal center is on the +X mouth
      // axis (y=z=0), so the scene director can aim the mouth at the viewport.
      const f = Number(this.encounterFront), g = Number(this.encounterGrip);
      const reveal = clamp(Math.max(Number.isFinite(f) ? f : 0, Number.isFinite(g) ? g : 0), 0, 1);
      const size = .72 + .28 * reveal;
      const ring = this._rings[48];
      const mouthX = 1.255;

      // Outer lip and shadowed oral disk; both occlude the closed head tip.
      for (let ir = 0; ir <= 12; ir += this.geometryStep || 1) {
        const radius = ir / 12 * .285 * size;
        const lip = ir > 9;
        for (let j = 0; j < 48; j += this.geometryStep || 1) {
          const ca = ring[j][0], sa = ring[j][1];
          const x = mouthX + (lip ? .008 * Math.sin((ir - 9) / 3 * Math.PI) : .003);
          const light = lip ? .14 + this._shade(1, ca * .25, sa * .25, 0) * .30 : .025;
          this._put(x, ca * radius, sa * radius, light, lip ? 0 : 2, 22000 + ir * 48 + j);
        }
      }

      const gape = .010 + reveal * .012 * (.5 + .5 * Math.sin(t * .75));
      for (let jaw = 0; jaw < 2; jaw++) {
        const sign = jaw === 0 ? 1 : -1, length = jaw === 0 ? .275 : .225;
        for (let i = 0; i <= 26; i += this.geometryStep || 1) {
          const u = i / 26, one = 1 - u;
          const x = 1.27 + length * Math.pow(u, .85) * size;
          const z = sign * ((.095 + gape) * one - .018 * u + .025 * Math.sin(Math.PI * u)) * size;
          const dx = length * .85 * Math.pow(Math.max(u, .001), -.15);
          const dz = sign * (-.113 - gape + .025 * Math.PI * Math.cos(Math.PI * u));
          const inv = 1 / Math.hypot(dx, dz), tx = dx * inv, tz = dz * inv;
          const wide = (.174 * Math.pow(one, .68) + .006) * size;
          const thick = (.053 * Math.pow(one, .6) + .003) * size;
          for (let j = 0; j < 24; j += this.geometryStep || 1) {
            const a = j / 24 * TAU, ca = Math.cos(a), sa = Math.sin(a);
            const nx = -tz * sa / thick, ny = ca / wide, nz = tx * sa / thick;
            const horn = .18 + .64 * this._shade(nx, ny, nz, .025 * Math.sin(u * 33));
            this._put(x - tz * sa * thick, ca * wide, z + tx * sa * thick,
              horn, 2, 24000 + jaw * 1000 + i * 24 + j);
          }
          if (i === 26) this._put(x, 0, z, .22, 0, 28000 + jaw);
        }
      }
    }

    _drawInk() {
      this.inkGlyphCount = this._drawInkLayer(false) + (this.ink.some(p => p.lightInk) ? this._drawInkLayer(true) : 0);
      this.ctx.globalAlpha = 1;
    }

    _drawInkLayer(lightInk) {
      const c = this.ctx, density = this.inkDensity;
      if (!this.ink.length) return 0;
      density.fill(0);
      for (const p of this.ink) {
        if (Boolean(p.lightInk) !== lightInk) continue;
        const perspective = 1 / Math.max(.24, 1 - p.z * this.perspectiveStrength);
        const q = this._projectWorld(p.x, p.y, p.z);
        const radius = (p.radius + Math.sqrt(p.age) * .105) * this.scale * perspective;
        const cx = q[0] / this.inkCellW, cy = q[1] / this.inkCellH;
        const rx = clamp(radius / this.inkCellW, .75, 9), ry = clamp(radius / this.inkCellH, .65, 8);
        const fade = 1 - smooth(p.life * .28, p.life, p.age);
        const mass = p.mass * fade / (1 + p.age * .13);
        const left = Math.max(0, Math.floor(cx - rx)), right = Math.min(this.inkCols - 1, Math.ceil(cx + rx));
        const top = Math.max(0, Math.floor(cy - ry)), bottom = Math.min(this.inkRows - 1, Math.ceil(cy + ry));
        for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
          const dx = (col + .5 - cx) / rx, dy = (row + .5 - cy) / ry, rr = dx * dx + dy * dy;
          if (rr < 1) density[row * this.inkCols + col] += mass * (1 - rr) * (1 - rr);
        }
      }
      const sz = this.inkSprite, drawSize = this.inkDrawSize;
      let glyphCount = 0;
      for (let i = 0; i < density.length; i++) {
        if (density[i] < .065) continue;
        const concentration = 1 - Math.exp(-density[i] * .38);
        const glyph = clamp(Math.floor(Math.pow(concentration, .55) * INK_GLYPHS.length), 0, INK_GLYPHS.length - 1);
        const x = (i % this.inkCols + .5) * this.inkCellW, y = (Math.floor(i / this.inkCols) + .5) * this.inkCellH;
        c.globalAlpha = .40 + .60 * Math.min(1, concentration * 1.8);
        // Only character sprites are drawn: no shaded disk, smoke
        // bitmap, blur or filled silhouette underneath the ASCII plume.
        c.drawImage(this.inkAtlas, glyph * sz, lightInk ? sz : 0, sz, sz, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
        glyphCount++;
      }
      return glyphCount;
    }

    render() {
      if (!this.width || this.destroyed) return;
      const c = this.ctx, w = this.width, h = this.height, t = this.time;
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c.globalAlpha = 1; c.filter = 'none'; c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#080d0f'; c.fillRect(0, 0, w, h);
      const atmosphere = this.palette.atmosphere;
      const g = c.createRadialGradient(w * .48, h * .44, 0, w * .48, h * .44, Math.max(w, h) * .66);
      g.addColorStop(0, `rgba(${atmosphere.join(',')},${this.options.scene === 'swimby' ? .10 : .23})`); g.addColorStop(1, `rgba(${atmosphere.join(',')},0)`);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.font = '10px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let i = 0; i < this.plankton.length; i++) {
        const p = this.plankton[i];
        // A gentle independent current provides a stable visual reference.
        const px = ((p.x - t * (.0007 + p.size * .0009)) % 1 + 1) % 1 * w;
        const py = ((p.y + Math.sin(t * .16 + p.phase) * .006) % 1 + 1) % 1 * h;
        c.fillStyle = `rgba(${this.palette.middle.join(',')},${.08 + p.size * .24})`;
        if (p.size > .76) c.fillText(p.char, px, py); else c.fillRect(px, py, p.size > .5 ? 1.5 : .8, p.size > .5 ? 1.5 : .8);
      }
      this.depth.fill(-Infinity); this.tones.fill(0); this.owners.fill(-1); this.visibility.fill(0);
      for (const fish of this.fish) {
        this._activateFish(fish);
        const localTime = t + fish.offset;
        this._camera(localTime);
        this.sampleCount = 0; this.minX = Infinity; this.maxX = -Infinity; this.minY = Infinity; this.maxY = -Infinity;
        if (this.subjectVisibility > .005) {
          if (fish.definition) fish.definition.draw(this, localTime, fish.speciesState);
          else { this._body(localTime); this._arms(localTime); this._beak(localTime); }
          this._rasterize();
        }
        fish.visible = false; this._saveFish();
      }
      for (let i = 0; i < this.owners.length; i++) if (this.owners[i] >= 0) this.fish[this.owners[i]].visible = true;
      const glow = this.glowCtx;
      let count = 0;
      if (this.options.glow) {
        // Blur only the tiny character grid, not the full high-DPI canvas.
        // One pixel upload also replaces thousands of fillStyle/fillRect calls.
        const pixels = this.glowPixels.data;
        pixels.fill(0);
        for (let i = 0; i < this.depth.length; i++) {
          if (this.depth[i] === -Infinity) continue;
          count++;
          if (this.tones[i] < 6) continue;
          const rgb = this.colorBytes[this.kinds[i] * 24 + this.tones[i]], p = i * 4;
          pixels[p] = rgb[0]; pixels[p + 1] = rgb[1]; pixels[p + 2] = rgb[2]; pixels[p + 3] = Math.round(160 * this.visibility[i]);
        }
        glow.putImageData(this.glowPixels, 0, 0);
        const hc = this.haloCtx;
        hc.clearRect(0, 0, this.cols, this.rows);
        hc.filter = 'blur(1.25px)'; hc.drawImage(this.glowCanvas, 0, 0);
        hc.filter = 'none';
        c.globalAlpha = .52; c.imageSmoothingEnabled = true;
        c.drawImage(this.haloCanvas, 0, 0, this.cols * this.cellW, this.rows * this.cellH);
        c.globalAlpha = 1;
      }
      c.globalAlpha = 1;
      const points = this.options.mode === 'points';
      const sz = this.sprite, drawSize = this.spriteDrawSize;
      for (let i = 0; i < this.depth.length; i++) {
        if (this.depth[i] === -Infinity) continue;
        if (!this.options.glow) count++;
        const x = (i % this.cols + .5) * this.cellW;
        const y = (Math.floor(i / this.cols) + .5) * this.cellH;
        c.globalAlpha = this.visibility[i];
        const color = this.kinds[i] * 24 + this.tones[i];
        if (points) {
          c.fillStyle = this.colors[color];
          const radius = this.cellW * (.13 + this.tones[i] / 23 * .13);
          c.beginPath(); c.arc(x, y, radius, 0, TAU); c.fill();
        } else {
          c.drawImage(this.atlas, this.glyphs[i] * sz, color * sz, sz, sz, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
        }
      }
      c.globalAlpha = 1;
      if (this.options.showLabels) {
        c.font = '600 11px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
        for (const fish of this.fish) {
          if (!fish.visible) continue;
          const q = this._projectWorld(fish.worldX, fish.worldY, fish.worldZ);
          const x = clamp(q[0], 20, w - 20), y = clamp(q[1] - 26, 18, h - 18);
          c.fillStyle = 'rgba(5,14,16,.82)'; c.fillRect(x - 14, y - 10, 28, 20);
          c.fillStyle = '#c8f8e8'; c.fillText(String(fish.id + 1).padStart(2, '0'), x, y);
        }
      }
      this._drawInk();
      this.glyphCount = count;
      this._activateFish(this.fish[0]);
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true; this._ready = false;
      this._unsubscribe?.(); this._unsubscribe = null; this._resetFrameClock();
      this.observer?.disconnect(); this.intersectionObserver?.disconnect();
      this.canvas.removeEventListener('pointermove', this._move);
      this.canvas.removeEventListener('pointerleave', this._leave);
      this.canvas.removeEventListener('pointercancel', this._leave);
      this.canvas.removeEventListener('pointerdown', this._touch);
      this._document.removeEventListener('visibilitychange', this._visibility);
      this._view.removeEventListener('resize', this._windowResize);
      this._motionQuery?.removeEventListener?.('change', this._motionChange);
      this._releaseGrid(); this.samples = new Float32Array(0);
      for (const f of this.fish) f.definition?.dispose?.(f.speciesState);
      this.ink.length = 0; this.plankton.length = 0; this.lastPointer = null;
      this._rings = {}; this.colors = []; this.colorBytes = []; this.fps = 0;
      this.bodyNormals = null; this.headNormals = null; this._gripPoints = null;
      // Keep the caller's visible canvas and its last frame. Ownership stays
      // with the host; only internal buffers and subscriptions are released.
    }
  }

function createCuttlefish(canvas, options) { return new CuttlefishArtwork(canvas, options); }

window.CuttlefishArtwork = CuttlefishArtwork;
window.createCuttlefish = createCuttlefish;
})();
