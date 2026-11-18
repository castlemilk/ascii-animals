// Original procedural manta; integrated from Track 3. No browser globals or side effects.
export const mantaDefinition = (() => {
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
