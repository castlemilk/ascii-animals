// Original procedural octopus / the dim den. No browser globals or side effects.
// Anatomy, behavioural provenance and reproduction: species/octopus/review/.
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
  const SUPPORT = [0, 3, 7];
  const FEET = [[1.12, -1.42, .05], [2.03, -.34, .06], [1.22, 1.47, .05]];
  const ORAL = [-.20, .25, 1.15, 2.45, 2.65, 1.45, .28, -.25];
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
      contactArms: Array.from({ length: ARMS }, () => new Float64Array(SEGMENTS * 3)),
      // Each chain has exactly forty equal-length links at every LOD.
      lengths: new Float64Array(ARMS), roots: new Float64Array(ARMS * 3),
      angles: Array.from({ length: ARMS }, () => new Float64Array(SEGMENTS * 2)),
      reachWeights: new Float64Array(ARMS), target: new Float64Array(3),
      contactWeights: new Float64Array(ARMS), contacts: new Float64Array(ARMS * 3),
      contactLocal: new Float64Array(ARMS * 3),
      cueActive: false, pendingCue: false, cueStart: -100, releaseAt: -100, releaseReach: 0,
      releaseNotice: 0, releaseBand: 0, releaseAttention: 0, releaseTarget: new Float64Array(3),
      wasReacting: false, startleReach: 0, startleNotice: 0, startleBand: 0, recoveredAt: -100,
      cueTarget: [0, .18], observedTime: -1,
      performance: { age: -1, reach: 0, anticipation: 0, band: 0, explicit: false, releasing: false, releaseFade: 0, sequence: 'rest' },
      diagnostics: {
        armCount: ARMS, segmentsPerArm: SEGMENTS, pointCount: ARMS * (SEGMENTS + 1),
        maxSegmentError: 0, maxJointAngle: 0, sampleCount: 0,
        attention: 0, reachArms: [-1, -1], mode: 'idle', sequence: 'rest',
        maxContactError: 0, plantedContacts: 0, habitat: false, suckerPairs: 0
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

  function inDen(host) {
    const o = host.options || {}, f = host.activeFish || {};
    return (o.count === undefined || o.count === 1) && o.formation === 'independent'
      && o.scene === 'reactive' && !host._director && !host.marineIntent
      && ['hover', 'curious', 'auto'].includes(f.behavior || 'hover');
  }

  const reachAt = age => smooth(.55, 1.85, age) * (1 - smooth(3.5, 5.7, age));

  function release(time, state) {
    state.releaseAt = time; state.releaseReach = state.performance.reach;
    state.releaseNotice = state.performance.anticipation; state.releaseBand = state.performance.band;
    state.releaseAttention = state.diagnostics.attention;
    state.releaseTarget.set(state.target);
  }

  // Sampling may run twice in a frame. Only input edges capture a start time;
  // phases are analytic in the existing host clock, never render-count based.
  function performance(host, time, state) {
    const p = host.pointer || {}, o = host.options || {}, out = state.performance;
    const watching = o.followPointer || host.activeFish?.behavior === 'curious';
    const explicit = watching && (p.active === true || (p.active === undefined && finite(p.interest) > .02));
    if (time < state.observedTime) {
      state.cueActive = state.pendingCue = false; state.releaseAt = -100; state.cueStart = -100;
    }
    let releaseOngoing = time - state.releaseAt < 1.15;
    // A new invitation during an autonomous probe first peels from that
    // discovery. Preserve its target/strength instead of teleporting a limb.
    if (explicit && !state.cueActive && !releaseOngoing && !out.explicit && out.reach > .02 && inDen(host)) {
      release(time, state); state.cueStart = time - out.age;
      state.pendingCue = true; releaseOngoing = true;
    }
    const nextX = clamp(finite(p.tx, finite(p.x)), -.5, .5), nextY = clamp(finite(p.ty, finite(p.y)), -.5, .5);
    const newDiscovery = explicit && !state.pendingCue && time - state.cueStart >= 6.2
      && Math.hypot(nextX - state.cueTarget[0], nextY - state.cueTarget[1]) > .09;
    const begin = explicit && ((!state.cueActive && !releaseOngoing) || (state.pendingCue && !releaseOngoing) || newDiscovery);
    if (explicit && !state.cueActive && releaseOngoing) state.pendingCue = true;
    if (begin) {
      state.cueStart = time; state.releaseAt = -100;
      state.pendingCue = false;
      state.cueTarget[0] = nextX; state.cueTarget[1] = nextY;
    } else if (!explicit && state.cueActive) {
      if (!releaseOngoing) release(time, state);
      state.pendingCue = false;
    }
    state.cueActive = explicit; state.observedTime = time;
    const automaticAge = ((finite(host.sceneTime, time) + state.phase * .15) % 16 + 16) % 16 - 3;
    const releasing = (!explicit || state.pendingCue) && time - state.releaseAt < 1.15;
    const age = explicit || releasing ? time - state.cueStart : automaticAge;
    const strength = explicit || releasing ? 1 : .48 * smooth(1.15, 2.15, time - state.releaseAt);
    const releaseFade = 1 - smooth(0, 1.15, time - state.releaseAt);
    const reach = releasing ? state.releaseReach * releaseFade : reachAt(age) * strength;
    out.age = age; out.reach = reach; out.explicit = explicit || releasing;
    out.releasing = releasing; out.releaseFade = releaseFade;
    out.anticipation = releasing ? state.releaseNotice * releaseFade : smooth(0, .5, age) * (1 - smooth(1.4, 2.3, age)) * strength;
    out.band = releasing ? state.releaseBand * releaseFade : smooth(1.6, 2.1, age) * (1 - smooth(4.5, 5.2, age)) * strength;
    out.sequence = releasing || (!explicit && time - state.releaseAt < 2.15) ? 'peel-and-settle' : age < 0 || age >= 5.7 ? 'rest'
      : age < .55 ? 'notice' : age < 1.85 ? 'unfold' : age < 3.5 ? 'examine' : 'peel-and-settle';
    const r = host.reaction;
    if (r?.active) {
      if (!state.wasReacting) {
        state.startleReach = out.reach; state.startleNotice = out.anticipation; state.startleBand = out.band;
      }
      const gather = 1 - smooth(0, .34, finite(r.age));
      out.reach = state.startleReach * gather;
      out.anticipation = state.startleNotice * gather; out.band = state.startleBand * gather;
      out.sequence = r.age < .34 ? 'gather' : r.age < .94 ? 'release-and-ink'
        : r.age < 3.25 ? 'jet' : r.age < 6.6 ? 'return' : 'replant';
    } else {
      if (state.wasReacting) state.recoveredAt = time;
      const settled = smooth(0, .8, time - state.recoveredAt);
      out.reach *= settled; out.anticipation *= settled; out.band *= settled;
    }
    state.wasReacting = Boolean(r?.active);
    state.diagnostics.sequence = out.sequence;
    return out;
  }

  function pose(host, time, state, p) {
    const o = host.options || {}, fish = host.activeFish || {};
    const action = performance(host, finite(time), state);
    if (inDen(host)) {
      // The den is a station, not a formation. All public travel routes keep
      // their original headings. Contacts compensate for this small body lean.
      const amount = clamp(finite(o.motion, 1.2) / 1.2, 0, 1), t = finite(host.sceneTime, time);
      const cueX = clamp(finite(host.pointer?.x), -.5, .5);
      const notice = action.anticipation;
      p.position = [(.065 * Math.sin(t * .37 + state.phase) + cueX * (.12 * action.reach + .075 * notice)) * amount,
        .05 + (.035 * Math.sin(t * .51 + state.phase) + .065 * action.reach + .025 * notice) * amount, -.90];
      p.forward = [(.035 * Math.sin(t * .31 + state.phase) + cueX * .10 * notice) * amount, 1, .08];
      p.reference = [0, 0, 1]; p.bank = .018 * Math.sin(t * .43 + state.phase) * amount;
      return p;
    }
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
    const action = state.performance, den = inDen(host);
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
    if (den) {
      if (action.releasing) {
        state.target.set(state.releaseTarget);
        attention = state.releaseAttention * action.releaseFade;
      } else if (!action.explicit) {
        state.target[0] = 1.85;
        state.target[1] = .72 * Math.sin(state.phase + finite(host.sceneTime) * .15);
        state.target[2] = .24;
        attention = action.reach;
      } else attention *= action.reach;
    }
    attention *= (1 - tension) * (1 - escape);
    const aim = clamp(Math.atan2(state.target[1], Math.max(.22, state.target[0] - .35)), -1.04, 1.04);
    // Interpolation between adjacent fan channels selects at most two arms.
    // Weights meet continuously at boundaries; crossing the pointer over an
    // arm boundary never switches a full-strength reach discontinuously.
    let lower = 0;
    while (lower < ARMS - 2 && aim > FANS[lower + 1]) lower++;
    const blend = smooth(FANS[lower], FANS[lower + 1], aim);
    state.reachWeights.fill(0);
    state.reachWeights[lower] = attention * (1 - blend);
    state.reachWeights[lower + 1] = attention * blend;
    if (den) {
      const delayed = smooth(.85, 2.35, action.age), dominant = smooth(.30, .70, blend);
      state.reachWeights[lower] *= mix(1, delayed, dominant);
      state.reachWeights[lower + 1] *= mix(delayed, 1, dominant);
    }
    state.diagnostics.reachArms[0] = attention > .001 ? lower : -1;
    state.diagnostics.reachArms[1] = attention > .001 ? lower + 1 : -1;
    state.diagnostics.attention = attention;
    return attention;
  }

  function plant(host, state, k, rank, time) {
    const ri = k * 3, anchor = FEET[rank], size = Math.max(.001, finite(host.activeFish?.size, finite(host.objectScale, 1)));
    const fy = 1 / Math.hypot(1, .08), fz = .08 * fy;
    // Stable WORLD anchors, independent of body oscillation, pointer, resize,
    // and rendering cadence. Size changes deliberately rescale the den.
    const wx = -anchor[1] * size;
    const wy = .05 + ((anchor[0] - .30) * fy - anchor[2] * fz) * size;
    const wz = -.90 + ((anchor[0] - .30) * fz + anchor[2] * fy) * size;
    state.contacts[ri] = wx; state.contacts[ri + 1] = wy; state.contacts[ri + 2] = wz;
    const dx = wx - finite(host.worldX), dy = wy - finite(host.worldY), dz = wz - finite(host.worldZ);
    const s = Math.max(.001, finite(host.objectScale, 1));
    const x = .30 + (dx * finite(host.r00) + dy * finite(host.r10, 1) + dz * finite(host.r20)) / s;
    const y = (dx * finite(host.r01, -1) + dy * finite(host.r11) + dz * finite(host.r21)) / s;
    const z = (dx * finite(host.r02) + dy * finite(host.r12) + dz * finite(host.r22, 1)) / s;
    state.contactLocal[ri] = x; state.contactLocal[ri + 1] = y; state.contactLocal[ri + 2] = z;
    const vx = x - state.roots[ri], vy = y - state.roots[ri + 1], vz = z - state.roots[ri + 2];
    const distance = Math.hypot(vx, vy, vz), length = state.lengths[k], step = length / SEGMENTS;
    let weight = 1;
    const reaction = host.reaction;
    if (reaction?.active) {
      const age = finite(reaction.age);
      weight = age < 3.25 ? 1 - smooth(.07 + rank * .065, .32 + rank * .065, age)
        : smooth(6.15 + rank * .48, 7.15 + rank * .58, age);
    }
    weight *= 1 - smooth(.02, .5, state.reachWeights[k]);
    // A return can still be too far away to plant. Never stretch a chain to
    // fake a contact; smoothly wait for the body to enter the reachable zone.
    weight *= smooth(.61, .68, distance / length) * (1 - smooth(.95, .995, distance / length));
    if (weight < 1e-8) { state.contactWeights[k] = 0; return; }
    const bounded = clamp(distance, length * .61, length * .995);
    let lo = 0, hi = .082;
    for (let n = 0; n < 36; n++) {
      const a = (lo + hi) / 2;
      const chord = step * Math.sin(SEGMENTS * a / 2) / Math.sin(a / 2);
      if (chord > bounded) lo = a; else hi = a;
    }
    const theta = (lo + hi) / 2, ex = vx / distance, ey = vy / distance, ez = vz / distance;
    const side = k < 4 ? -1 : 1;
    // Small roll of the bend plane moves the elbow while the terminal contact
    // remains exact. Three arms have separate phases; no synchronized fan.
    const plane = k === 3 ? .10 : 1;
    let bx = -ey * side * plane, by = ex * side * plane;
    let bz = (k === 3 ? .65 : 0) + .12 * Math.sin(time * .47 + k * 1.31 + state.phase);
    const dot = bx * ex + by * ey + bz * ez;
    bx -= dot * ex; by -= dot * ey; bz -= dot * ez;
    const bi = 1 / Math.max(.0001, Math.hypot(bx, by, bz)); bx *= bi; by *= bi; bz *= bi;
    const vectors = state.contactArms[k];
    for (let i = 0; i < SEGMENTS; i++) {
      const angle = (i - (SEGMENTS - 1) / 2) * theta, ca = Math.cos(angle), sa = Math.sin(angle);
      vectors[i * 3] = ex * ca + bx * sa;
      vectors[i * 3 + 1] = ey * ca + by * sa;
      vectors[i * 3 + 2] = ez * ca + bz * sa;
    }
    const p = state.arms[k], angles = state.angles[k];
    let px = state.roots[ri], py = state.roots[ri + 1], pz = state.roots[ri + 2];
    let previousX = 0, previousY = 0, previousZ = 0;
    for (let i = 0; i < SEGMENTS; i++) {
      const ai = i * 2, vi = i * 3, cp = Math.cos(angles[ai + 1]);
      let tx = mix(Math.cos(angles[ai]) * cp, vectors[vi], weight);
      let ty = mix(Math.sin(angles[ai]) * cp, vectors[vi + 1], weight);
      let tz = mix(Math.sin(angles[ai + 1]), vectors[vi + 2], weight);
      let inverse = 1 / Math.max(.000001, Math.hypot(tx, ty, tz)); tx *= inverse; ty *= inverse; tz *= inverse;
      if (i) {
        const cosine = clamp(tx * previousX + ty * previousY + tz * previousZ, -1, 1);
        const angle = Math.acos(cosine);
        if (angle > .086) {
          const q = .086 / angle, sin = Math.sin(angle), a = Math.sin((1 - q) * angle) / sin, b = Math.sin(q * angle) / sin;
          tx = previousX * a + tx * b; ty = previousY * a + ty * b; tz = previousZ * a + tz * b;
          inverse = 1 / Math.hypot(tx, ty, tz); tx *= inverse; ty *= inverse; tz *= inverse;
        }
      }
      angles[ai] = Math.atan2(ty, tx); angles[ai + 1] = Math.asin(clamp(tz, -1, 1));
      px += tx * step; py += ty * step; pz += tz * step;
      const pi = (i + 1) * 3; p[pi] = px; p[pi + 1] = py; p[pi + 2] = pz;
      previousX = tx; previousY = ty; previousZ = tz;
    }
    state.contactWeights[k] = weight;
    if (weight > .999999) {
      state.diagnostics.plantedContacts++;
      state.diagnostics.maxContactError = Math.max(state.diagnostics.maxContactError, Math.hypot(px - x, py - y, pz - z) * s);
    }
  }

  function articulate(host, time, state, tension, escape) {
    const ripple = clamp(finite((host.options || {}).ripple, 1.3), .3, 2);
    const attention = attentionTarget(host, state, tension, escape);
    const cup = tension * (1 - .88 * escape);
    const beat = time * 1.08 + state.phase;
    const diagnostics = state.diagnostics;
    diagnostics.maxSegmentError = 0; diagnostics.maxJointAngle = 0;
    diagnostics.maxContactError = 0; diagnostics.plantedContacts = 0;
    state.contactWeights.fill(0);
    diagnostics.mode = escape > .15 ? 'stream' : cup > .15 ? 'cup' : attention > .05 ? 'reach' : 'idle';
    for (let k = 0; k < ARMS; k++) {
      const points = state.arms[k], angles = state.angles[k], ri = k * 3;
      const sign = k < 4 ? -1 : 1, step = state.lengths[k] / SEGMENTS;
      const lag = host.reaction?.active && host.reaction.age > 3.25
        ? .32 * (1 - smooth(4.7 + k * .13, 7.0 + k * .19, host.reaction.age)) : 0;
      const reach = state.reachWeights[k], asymmetry = .16 * Math.sin(state.phase + k * 2.17);
      let x = state.roots[ri], y = state.roots[ri + 1], z = state.roots[ri + 2];
      points[0] = x; points[1] = y; points[2] = z;
      let yaw = FANS[k] * (1 - .85 * escape) * (1 - .63 * cup), pitch = .025 * Math.sin(k * .9 + state.phase);
      let lastTx = 0, lastTy = 0, lastTz = 0;
      for (let i = 0; i < SEGMENTS; i++) {
        const u = (i + .5) / SEGMENTS;
        const wave = Math.sin(beat - u * 4.1 + k * .38 + asymmetry);
        const tip = smooth(.42, 1, u);
        const bendAt = clamp((state.performance.age - .45) / 1.6, 0, 1);
        const travellingBend = Math.exp(-(((u - bendAt) / .21) ** 2)) * reach;
        const curl = sign * (1.32 + .25 * Math.sin(k * 1.7 + state.phase) + lag) * tip * tip;
        let desiredYaw = FANS[k] * (1 - .85 * escape)
          + wave * (.075 + .07 * ripple) * u * (1 - .82 * escape)
          + curl * (1 - .94 * escape);
        desiredYaw += sign * travellingBend * .42;
        const aimYaw = clamp(Math.atan2(state.target[1] - y, Math.max(.15, state.target[0] - x)),
          FANS[k] - .72, FANS[k] + .72);
        desiredYaw = mix(desiredYaw, aimYaw + sign * .24 * tip * tip, reach * .82);
        // A startle cups every arm in a common enclosure; a jet releases the
        // cup into narrow trailing chains. Link lengths never change.
        desiredYaw = mix(desiredYaw, sign * (.10 + 3.90 * smooth(0, 1, u)), cup);
        let desiredPitch = .035 * Math.sin(beat * .73 - u * 3.2 + k * .51) * (1 - .8 * escape)
          + .055 * cup * Math.sin(Math.PI * u);
        desiredPitch += reach * clamp((state.target[2] - z) * .11, -.08, .08);
        desiredPitch += .045 * Math.sin(k * 1.7 + u * 3.8 + state.phase) * (1 - escape);
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
    if (inDen(host)) for (let rank = 0; rank < SUPPORT.length; rank++) plant(host, state, SUPPORT[rank], rank, time);
    return attention;
  }

  function body(host, time, state, lod, tension, attention) {
    const nu = lod === 1 ? 48 : lod === 2 ? 24 : 16;
    const nv = lod === 1 ? 64 : lod === 2 ? 32 : 22, ring = RINGS[nv];
    const age = host.reaction?.active ? finite(host.reaction.age) : -1;
    const fill = age >= 0 ? .045 * smooth(0, .16, age) * (1 - smooth(.22, .48, age)) : 0;
    const breath = (1 + .012 * Math.sin(time * 1.08 + state.phase) + fill) * (1 - .065 * tension);
    const pulse = .035 * tension + .015 * attention;
    // A closed, pear-shaped mantle; its lower taper overlaps the smaller head.
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, theta = Math.PI * u, st = Math.sin(theta), ct = Math.cos(theta);
      const x = -.74 - .73 * ct;
      const ry = .76 * st * (1 - .24 * u) * breath, rz = .54 * st * (1 - .12 * u) * breath;
      for (let j = 0; j < nv; j++) {
        const ca = ring[j * 2], sa = ring[j * 2 + 1];
        const patch = Math.sin(u * 22 + ca * 4 + state.phase) * Math.sin(sa * 8 + u * 9);
        const papilla = Math.max(0, patch) ** 3 * .038 * st;
        const cloud = state.performance.band * Math.exp(-(((x + 1.6 - (state.performance.age - 1.6) * 1.12) / .27) ** 2));
        const pigment = .065 * patch + .025 * Math.sin(u * 61 + sa * 15) - .15 * cloud;
        host._put(x, ry * ca * (1 + papilla), rz * sa * (1 + papilla),
          host._shade(-ct / .73, st * ca / (.76 * (1 - .24 * u)), st * sa / (.54 * (1 - .12 * u)), pigment + pulse),
          0, 31000 + i * 71 + j);
      }
    }
    const hn = lod === 1 ? 28 : lod === 2 ? 14 : 10;
    const hv = lod === 1 ? 48 : lod === 2 ? 24 : 16, hr = RINGS[hv];
    for (let i = 0; i <= hn; i++) {
      const theta = Math.PI * i / hn, ct = Math.cos(theta), st = Math.sin(theta);
      for (let j = 0; j < hv; j++) {
        const ca = hr[j * 2], sa = hr[j * 2 + 1];
        const x = .08 - .39 * ct;
        const cloud = state.performance.band * Math.exp(-(((x + 1.6 - (state.performance.age - 1.6) * 1.12) / .27) ** 2));
        host._put(x, .46 * st * ca, .31 * st * sa,
          host._shade(-ct / .39, st * ca / .46, st * sa / .31, pulse * .65 - .025 - cloud * .13),
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
          const gaze = clamp(finite(host.pointer?.x), -.5, .5) * state.performance.anticipation * .20;
          const dome = Math.sqrt(1 - rr), pupil = Math.abs(vx) < .25 && Math.abs(vy + gaze) < .76;
          const light = pupil ? .025 : .22 + .44 * host._shade(vx * .4, vy * .4, dome, .025);
          host._put(-.04 + vx * .105, side * .35 + vy * .125, .255 + dome * .075,
            light, 0, 38000 + (side + 1) * 500 + (i + ey) * 31 + j + ex);
        }
      }
    }
  }

  function web(host, state, lod) {
    // A shallow scalloped web overlaps arm roots, not a flat curtain across
    // the entire crown. It stops around the first 15 percent of each arm.
    const across = lod === 1 ? 10 : 6;
    for (let k = 0; k < ARMS - 1; k++) {
      const left = state.arms[k], right = state.arms[k + 1];
      for (let i = 0; i <= 6; i++) for (let j = 0; j <= across; j++) {
        const u = i / 6, v = j / across, scallop = Math.sin(v * Math.PI);
        const pi = i * 3, x = mix(left[pi], right[pi], v) - .07 * u * u * scallop;
        const y = mix(left[pi + 1], right[pi + 1], v);
        const z = mix(left[pi + 2], right[pi + 2], v) + .075 * (1 - .5 * u) - .025 * scallop;
        const tone = host._shade(-.1, 0, 1, -.08 - .04 * scallop);
        host._put(x, y, z, tone, 0, 61000 + k * 200 + i * 19 + j);
      }
    }
  }

  function arms(host, time, state, lod, tension) {
    const nv = lod === 1 ? 16 : lod === 2 ? 12 : 8, ring = RINGS[nv];
    const cups = RINGS[8];
    const projection = Math.max(.24, 1 - finite(host.worldZ) * finite(host.perspectiveStrength));
    const cellsPerUnit = finite(host.scale, 100) * finite(host.objectScale, 1)
      / (projection * Math.max(1, finite(host.cellW, 5), finite(host.cellH, 7)));
    // At tiny grids a full-width tube touches adjacent cells on both sides of
    // its centerline, merging neighboring arms into one patch. Thin only the
    // rendered tube after its root; the same eight articulated chains remain.
    const thin = mix(.26, 1, smooth(4.5, 13, cellsPerUnit));
    state.diagnostics.suckerPairs = 0;
    for (let k = 0; k < ARMS; k++) {
      const p = state.arms[k], a = state.angles[k];
      for (let i = 0; i <= SEGMENTS; i++) {
        const u = i / SEGMENTS, pi = i * 3, ai = Math.min(i, SEGMENTS - 1) * 2;
        const yaw = a[ai], pitch = a[ai + 1], cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
        const tx = cy * cp, ty = sy * cp, tz = sp;
        const ux = -sy, uy = cy, uz = 0, vx = -sp * cy, vy = -sp * sy, vz = cp;
        const radius = (.118 * Math.pow(1 - u, .82) + .011) * (1 + .08 * tension * (1 - u))
          * mix(1, thin, smooth(0, .24, u));
        const localBand = state.performance.band * Math.exp(-(((p[pi] + 1.6 - (state.performance.age - 1.6) * 1.12) / .27) ** 2));
        const pigment = .048 * Math.sin(u * 31 + state.phase + k * 1.38) - .12 * localBand;
        const roll = ORAL[k] + .16 * Math.sin(time * .43 - u * 3.1 + k * 1.71)
          - state.reachWeights[k] * .65 + tension * (u - .5) * .6;
        const cr = Math.cos(roll), sr = Math.sin(roll);
        const ox = vx * cr + ux * sr, oy = vy * cr + uy * sr, oz = vz * cr;
        const ax = ux * cr - vx * sr, ay = uy * cr - vy * sr, az = -vz * sr;
        for (let j = 0; j < nv; j++) {
          const ca = ring[j * 2], sa = ring[j * 2 + 1];
          const nx = ux * ca + vx * sa, ny = uy * ca + vy * sa, nz = uz * ca + vz * sa;
          const oral = smooth(.22, .90, nx * ox + ny * oy + nz * oz);
          host._put(p[pi] + nx * radius, p[pi + 1] + ny * radius, p[pi + 2] + nz * radius,
            host._shade(nx, ny, nz, pigment + oral * .085, false, true), 0,
            42000 + k * 1000 + i * 17 + j);
        }
        // Paired, bounded sucker rows clarify the animal at large grids. At
        // lower LOD, retain sparse cup centers instead of adding more geometry.
        if (cellsPerUnit < 6 || i < 4 || i > 34 || i % (lod === 1 ? 3 : lod === 2 ? 5 : 8)) continue;
        state.diagnostics.suckerPairs++;
        for (const side of [-1, 1]) {
          const lift = radius * .91, across = radius * .47 * side, cup = radius * .36;
          const stagger = side * .012 * (1 - u);
          const cx = p[pi] + ox * lift + ax * across + tx * stagger;
          const cy0 = p[pi + 1] + oy * lift + ay * across + ty * stagger;
          const cz = p[pi + 2] + oz * lift + az * across + tz * stagger;
          if (cellsPerUnit > 12) {
            for (let q = 0; q < 8; q++) {
              const ca = cups[q * 2], sa = cups[q * 2 + 1];
              host._put(cx + (ax * ca + tx * sa) * cup, cy0 + (ay * ca + ty * sa) * cup,
                cz + (az * ca + tz * sa) * cup, .31, 0, 51000 + k * 800 + i * 17 + q);
              host._put(cx + (ax * ca + tx * sa) * cup * .68 + ox * .009,
                cy0 + (ay * ca + ty * sa) * cup * .68 + oy * .009,
                cz + (az * ca + tz * sa) * cup * .68 + oz * .009, .91, 2, 52000 + k * 800 + i * 17 + q);
            }
          }
          host._put(cx + ox * .010, cy0 + oy * .010, cz + oz * .010, cellsPerUnit > 12 ? .16 : .83, 2,
            58000 + k * 100 + i * 2 + (side + 1) / 2);
        }
      }
    }
  }

  function habitat(host, state) {
    const c = host.ctx;
    state.diagnostics.habitat = Boolean(c && typeof c.fillText === 'function' && typeof host._projectWorld === 'function' && inDen(host));
    if (!state.diagnostics.habitat) return;
    const size = Math.max(.001, finite(host.activeFish?.size, 1));
    const project = (x, y, z = -1.25) => host._projectWorld(x * size, y * size + .05, z);
    const center = project(0, -.22), left = project(-2.3, 0), right = project(2.3, 0);
    const unit = (right[0] - left[0]) / 4.6;
    c.save();
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(3,10,13,.44)'; c.fillRect(0, 0, host.width, host.height);
    // The den opening stays fixed when the octopus jets away. A raster
    // shadow under sparse ASCII rock strata is intentional hybrid scenery.
    const shadow = c.createRadialGradient(center[0], center[1], unit * .24, center[0], center[1], unit * 2.5);
    shadow.addColorStop(0, '#04090b'); shadow.addColorStop(.62, '#070e11'); shadow.addColorStop(1, 'rgba(7,14,17,0)');
    c.fillStyle = shadow;
    c.fillRect(center[0] - unit * 3.1, center[1] - unit * 2.8, unit * 6.2, unit * 5.6);
    c.font = `${Math.max(5, Math.min(11, finite(host.cellH, 8) * .91))}px "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let row = 0; row < 28; row++) for (let col = 0; col < 37; col++) {
      const x = (col - 18) * .17, y = -2.35 + row * .19;
      const edge = (x / 2.16) ** 2 + ((y + .18) / 1.89) ** 2;
      const grain = Math.sin(col * 1.41 + row * 2.73 + state.phase) * Math.cos(row * .87 - col * .31);
      if (edge < 1.02 + .13 * grain || edge > 1.93 + .13 * grain || y > 1.65 || grain < -.6) continue;
      const q = project(x + .025 * Math.sin(row * 2.1), y, -1.55);
      c.fillStyle = edge < 1.22 ? '#66746d' : edge < 1.48 ? '#465956' : '#2d4445';
      c.globalAlpha = .66 + .16 * grain;
      c.fillText(grain > .57 ? ':' : grain > .12 ? '/' : grain > -.22 ? '-' : '.', q[0], q[1]);
    }
    // One irregular connected shelf supports all three contact points. Its
    // crest passes through their actual world heights; no floating foot pads.
    const crest = [[-3.25, 1.85], [-2.1, 1.45], [-1.47, .92], [-.85, 1.10], [.34, 1.73], [.85, 1.25], [1.42, .82], [2.05, 1.35], [3.25, 1.85]];
    const ledgeY = x => {
      let j = 0; while (j < crest.length - 2 && x > crest[j + 1][0]) j++;
      const a = crest[j], b = crest[j + 1];
      const u = clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
      return mix(a[1], b[1], smooth(0, 1, u)) + .018 * Math.sin(x * 21);
    };
    const top = project(0, .75, -.72)[1];
    const wash = c.createLinearGradient?.(0, top, 0, host.height + 20);
    if (wash?.addColorStop) {
      wash.addColorStop(0, 'rgba(27,45,48,.72)');
      wash.addColorStop(.50, 'rgba(17,30,33,.48)'); wash.addColorStop(1, 'rgba(8,14,17,0)');
    }
    const halfShelf = Math.max(3.3, host.width / (2 * unit) + .5);
    c.globalAlpha = 1; c.fillStyle = wash || 'rgba(17,30,33,.48)'; c.beginPath();
    for (let j = 0; j < 72; j++) {
      const x = (j / 71 - .5) * 2 * halfShelf, q = project(x, ledgeY(x) + .08, -.72);
      if (j) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]);
    }
    c.lineTo(host.width + unit, host.height + 20); c.lineTo(-unit, host.height + 20);
    c.closePath(); c.fill();
    // Shelf strata sit lower and closer than the cave. Empty rock never enters
    // _put(), the depth buffer, sample bounds or the animal owner hit map.
    for (let layer = 0; layer < 6; layer++) for (let j = 0; j < 68; j++) {
      const x = (j / 67 - .5) * 6.45;
      const y = ledgeY(x) + .06 + layer * .205 + .025 * Math.sin(x * 11 + layer * 1.7);
      const q = project(x, y, -.72);
      c.globalAlpha = layer === 0 ? .78 : .52 - layer * .045;
      c.fillStyle = layer === 0 ? '#75827a' : layer < 3 ? '#526565' : '#35474c';
      c.fillText(j % 7 ? (layer === 0 ? '_' : '.') : ':', q[0], q[1]);
    }
    // Flat shingle below each planted arm. These shadows remain visible
    // through the departure, showing exactly where the animal returns.
    for (const k of SUPPORT) {
      const ri = k * 3, q = host._projectWorld(state.contacts[ri], state.contacts[ri + 1], state.contacts[ri + 2]);
      c.globalAlpha = .82; c.fillStyle = '#26383c'; c.beginPath();
      c.moveTo(q[0] - unit * .20, q[1] + unit * .07);
      c.lineTo(q[0] - unit * .09, q[1] + unit * .015);
      c.lineTo(q[0] + unit * .15, q[1] + unit * .04);
      c.lineTo(q[0] + unit * .23, q[1] + unit * .13);
      c.lineTo(q[0] - unit * .17, q[1] + unit * .17); c.closePath(); c.fill();
      c.fillStyle = '#8a9687'; c.globalAlpha = .6;
      c.fillText('/_', q[0] - unit * .02, q[1] + unit * .07);
    }
    // Sparse shell midden; deliberately well below the brightest suckers.
    for (let i = 0; i < 9; i++) {
      const x = -1.43 + i * .28 + .07 * Math.sin(i * 3.1 + state.phase);
      const y = 2.58 + .11 * Math.sin(i * 2.13 + state.phase);
      const q = project(x, y, -.55);
      c.globalAlpha = .38; c.fillStyle = '#8b8874';
      c.fillText(i % 3 === 0 ? ')' : i % 3 === 1 ? '/' : '.', q[0], q[1]);
    }
    c.restore();
  }

  function draw(host, time, state) {
    const t = finite(time), lod = clamp(Math.round(finite(host.geometryStep, 1)), 1, 3);
    const tension = clamp(finite(host.startleTension), 0, 1), escape = clamp(finite(host.escapeAmount), 0, 1);
    const before = finite(host.sampleCount);
    performance(host, t, state);
    const attention = articulate(host, t, state, tension, escape);
    habitat(host, state);
    web(host, state, lod);
    body(host, t, state, lod, tension, attention);
    arms(host, t, state, lod, tension);
    state.diagnostics.sampleCount = Math.max(0, finite(host.sampleCount) - before);
    if (inDen(host)) {
      const labels = { rest: 'At rest · three arms braced', notice: 'Noticing · eyes before arms',
        unfold: 'Reaching · a bend travels outward', examine: 'Examining · suckers turn toward the discovery',
        'peel-and-settle': 'Releasing · one arm settles after another', gather: 'Alert · mantle fills, arms gather',
        'release-and-ink': 'Releasing the rock · ink screen', jet: 'Jetting mantle-first',
        return: 'Returning · searching for the ledge', replant: 'Replanting · unequal arms, quiet recovery' };
      host.phase = labels[state.performance.sequence];
    }
  }

  const definition = {
    id: 'octopus', label: 'Octopus', ink: true, inkOrigin: [.5, .15, .05],
    // Conservative analytic bounds, including tube radii and mantle breathing.
    bounds: { minX: -1.68, maxX: 2.62, maxY: 2.31, maxZ: .65 },
    create, pose, draw
  };
  return Object.freeze(definition);
})();
