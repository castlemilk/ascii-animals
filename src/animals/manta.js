// Original procedural reef manta. No browser globals, copied mesh, or side effects.
// Dorsal anatomy reconciles the earlier no-eye candidate; see species/manta/ART-DIRECTION.md.
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
  const bounds = Object.freeze({ minX: -3.16, maxX: 1.48, maxY: 2.72, maxZ: 1.05 });

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
        lobeRoots: new Float64Array(6), lobeTips: new Float64Array(6),
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
    // The optional study supplies a sampled pose, not a second animation clock.
    // Existing createArtwork and combined marine-director consumers need no new option.
    const motion = host.mantaMotion;
    const time = finite(motion?.time, finite(t, 0)), ripple = clamp(finite(host.options.ripple, 1.3), .3, 2);
    const lod = Math.round(clamp(finite(host.geometryStep, 1), 1, 3));
    const tension = clamp(finite(host.startleTension, 0), 0, 1);
    const escape = clamp(finite(host.escapeAmount, 0), 0, 1);
    const phase = time * (1.26 + .05 * state.seed) + state.seed * TAU;
    const intent = host.marineIntent;
    if (intent) state.turn = clamp(intent.bank * .85, -.38, .38);
    if (motion) state.turn = clamp(finite(motion.turn, 0), -.55, .55);
    // The director varies propulsion energy without changing the phase clock
    // at a chapter boundary. Preserve the existing analytic geometry envelope.
    const energy = motion ? clamp(finite(motion.wingEnergy, 1), .45, 1.10)
      : intent ? clamp(intent.wingEnergy, .65, 1.10) : 1;
    const dihedral = clamp(finite(motion?.dihedral, 0), -.12, .20);
    const amplitude = .29 * ripple * (1 - .25 * tension + .12 * escape) * energy;
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
        const leading = 1.02 - 1.05 * s + .25 * Math.sin(Math.PI * s) * (1 - .38 * s);
        const trailing = -.93 + .90 * s - .23 * Math.sin(Math.PI * s);
        const chord = leading - trailing;
        const asymmetry = 1 + side * state.turn * .19;
        for (let j = 0; j <= chords; j++) {
          const v = j / chords, x = trailing + chord * v;
          // The anterior base leads; the flexible tip and trailing edge lag.
          const wavePhase = phase - s * 1.90 - (1 - v) * .52 + side * state.turn * .22;
          const wave = Math.sin(wavePhase) * amplitude * spanEnvelope * asymmetry;
          const camber = .065 * Math.sin(Math.PI * v) * (1 - .66 * s);
          const thickness = .025 * Math.sqrt(Math.max(0, 1 - s)) * Math.sin(Math.PI * v);
          const z = wave + camber + dihedral * s * s;
          const dzdx = chord > .015
            ? (.52 * Math.cos(wavePhase) * amplitude * spanEnvelope * asymmetry
              + .065 * Math.PI * Math.cos(Math.PI * v) * (1 - .66 * s)) / chord : 0;
          const dzdy = side * amplitude * asymmetry *
            (1.65 * Math.pow(Math.max(.0001, s), .65) * Math.sin(wavePhase)
              - 1.90 * spanEnvelope * Math.cos(wavePhase)) / 2.50 + side * 2 * dihedral * s / 2.50;
          const edge = (j === 0 || j === chords || i === spans) ? .075 : 0;
          // Broad, soft shoulder fields leave a dark central V. These are
          // material patches across a wing, never circular facial highlights.
          const shoulder = smooth(.025, .16, s) * (1 - smooth(.44, .68, s))
            * Math.exp(-Math.pow((v - (.76 - .19 * s)) / .19, 2));
          const grain = .012 * Math.sin(s * 17 + v * 11) * Math.sin(v * 27 - s * 5);
          const light = .13 + .40 * host._shade(-dzdx, -dzdy, 1) + .40 * shoulder + edge + grain;
          // Reuse the host's neutral material ramp: charcoal disc, diffuse
          // ivory shoulders and pale ventrum, suspended in blue-green water.
          put(x, y, z + thickness, light, 2, 1100 + (side + 1) * 3400 + i * 41 + j);
          // The underside is a different material; its pale rim appears in a
          // bank without a two-sided emissive fin or a glowing outline.
          put(x, y, z - thickness - .014, .39 + .47 * host._shade(dzdx, dzdy, -1) + edge, 2,
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
      const forehead = smooth(.63, .91, u);
      const halfWidth = Math.max(.455 * profile, .315 * forehead);
      const halfDepth = Math.max(.145 * profile, .074 * forehead);
      const lift = .035 * Math.sin(theta);
      for (let j = 0; j < 40; j += lod) {
        const ca = bodyRing[j * 2], sa = bodyRing[j * 2 + 1];
        const nx = -Math.cos(theta) * .46;
        const light = sa >= 0 ? .15 + .40 * host._shade(nx, ca * .70, sa * 1.4)
          : .38 + .48 * host._shade(nx, ca * .70, sa * 1.4);
        put(x, ca * halfWidth, sa * halfDepth + lift, light, 2, 18000 + i * 40 + j);
      }
    }

    // A broad terminal head closes the disk between the two cephalic roots.
    // The mouth is a restrained ventral crease, not a pair of dorsal eye marks.
    for (let iy = -12; iy <= 12; iy++) {
      const y = iy / 12 * .315;
      const depth = .074 * Math.sqrt(Math.max(0, 1 - Math.pow(y / .315, 2)));
      for (let iz = -5; iz <= 5; iz++) {
        const z = iz / 5 * depth;
        const lip = iz === -2 && Math.abs(iy) < 10;
        put(1.06, y, z, lip ? .17 : .17 + .38 * host._shade(1, y, z * 3), 2, 20500 + (iy + 12) * 11 + iz + 5);
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
          host._shade(0, ca, sa, .11, false, true), 2, 22000 + i * 8 + j);
      }
      // Preserve a continuous legible tip when its tube is sub-cell sized.
      put(tail[n], tail[n + 1], tail[n + 2] + radius, .55, 2, 23000 + i);
    }
    for (let j = 0; j < 3; j++) {
      d.tailRoot[j] = tail[j]; d.tailTip[j] = tail[tailSteps * 3 + j];
    }

    // Rolled cephalic lobes: thick attached roots and curled, flattened tips.
    // Limited opening is attention/steering art, not a ram-feeding simulation.
    const lobeSteps = Math.ceil(32 / lod), open = clamp(finite(motion?.lobeOpen, .12), 0, 1);
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i <= lobeSteps; i++) {
        const u = i / lobeSteps, bend = u * Math.PI * .88;
        const x = .85 + .59 * u - .035 * u * u;
        const y = side * (.27 + (.11 + .065 * open) * Math.sin(bend) - .065 * u);
        const z = .035 + .085 * u * u + .018 * u * Math.sin(phase - .8 + side * .2);
        const radius = .10 * (1 - .32 * u);
        if (i === 0 || i === lobeSteps) {
          const target = i === 0 ? d.lobeRoots : d.lobeTips, offset = side < 0 ? 0 : 3;
          target[offset] = x; target[offset + 1] = y; target[offset + 2] = z;
        }
        for (let j = 0; j < 12; j += Math.min(lod, 2)) {
          const ca = state.rings[12][j * 2], sa = state.rings[12][j * 2 + 1];
          put(x, y + ca * radius * (1 + open * .75 * u), z + sa * radius * (1 - .42 * open),
            .22 + .45 * host._shade(-.15, ca, sa) + .10 * Math.max(0, sa), 2,
            24000 + (side + 1) * 400 + i * 12 + j);
        }
      }
      // Lateral eyes are intentionally omitted from this dorsal study. The
      // removed candidate's bright raised disks must not return as decoration.
    }
  }

  return Object.freeze({ id: 'manta', label: 'Manta ray', ink: false, bounds, create, pose, draw });
})();
