/*
 * Cuttlefish / Field study
 * Original procedural artwork. Canvas 2D, projected parametric surfaces,
 * a character-cell depth buffer, and traveling waves. No models or assets.
 */
import { getBrowserScheduler } from '../core/scheduler.js';
import { mantaDefinition } from './manta.js';
import { octopusDefinition } from './octopus.js';
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
  // Eye footprint in the continuous head/crown (anterior X, angle) chart.
  // Turn the socket around the existing upper-lateral head surface; a small
  // anterior advance keeps the forward rim on the same continuous crown.
  // Retain the V6 footprint and shallow recess: the supporting brow is skin,
  // not a separate cap. Authored proportions, not reference-photo measurements.
  const EYE_X = .90, EYE_HALF_X = .205, EYE_ANGLE = .52, EYE_HALF_ANGLE = .31;
  const ARM_ROOT_Y = .56, ARM_ROOT_Z = .34;
  const PRIMARY_ROOT_Y = .64, PRIMARY_ROOT_Z = .43;
  const HEAD_RING = 88;
  // The eye-bearing skin grows into the arm crown. The separate crown rolls
  // forward into individual proximal sleeves instead of one transverse cap.
  const HEAD_STATIONS = Array.from({ length: 28 }, (_, i) => .30 + .94 * (i / 36));
  const ROOT_MERGE = [.26, .38, .40, .39, .27, .27, .29, .255];
  // The three upper primary roots need a longer local handoff to leave the
  // brow before descending. Other roots and both feeding paths keep their
  // approved boundary; the free-arm geometry beyond each boundary is exact.
  const rootEnd = arm => arm > 0 && arm < 4 ? .40 : .30;
  const ROOT_SECTION = [.18, .12, .24, .14, .18, .10, .22, .13];
  function rootSleeve(arm, u) {
    if (arm >= 8 || u >= ROOT_MERGE[arm]) return [0, 0];
    const q = u / ROOT_MERGE[arm], angle = arm / 8 * TAU;
    const fullness = .95 * (.125 + .070 * Math.cos(angle) ** 2);
    // Smooth endpoints match both radius and tangent of the existing tube.
    // Start the taper under the crown so its forward handoff stays gradual.
    // Different short merge lengths keep the crown from ending on one plane.
    // Keep the three upper attachments full through the early rollover, then
    // ease into the existing arm surface. The quintic matches position, slope
    // and curvature at both ends; its boundary and the arm paths are unchanged.
    if (arm > 0 && arm < 4) return [fullness * (1 - q ** 3 * (10 + q * (-15 + 6 * q))),
      -30 * fullness * q * q * (1 - q) ** 2 / ROOT_MERGE[arm]];
    return [fullness * (1 - q) ** 3 * (1 + 3 * q),
      -fullness * 12 * q * (1 - q) ** 2 / ROOT_MERGE[arm]];
  }
  function rootOffsetCorrection(arm, u) {
    const upper = arm > 0 && arm < 4, end = upper ? .38 : .28, span = upper ? .36 : .26;
    if (arm >= 8 || u <= .02 || u >= end) return [0, 0];
    const v = (u - .02) / span, b = v * (1 - v);
    // Flatten the middle of the spatial root blend, where inward center
    // motion and sleeve taper would otherwise form a second sharp shoulder.
    // Position and derivative return before the arm-specific distal boundary;
    // coarse distal frames retain the original neighbor coordinates.
    return [6 * b * b * (2 * v - 1), 12 * b * (5 * b - 1) / span];
  }
  // The mantle profile also supports the fins; keep its breathing and shape
  // independent of the increasing, eye-bearing head section below.
  function anteriorProfile(x, thickness) {
    const u = clamp((x + .55) / 1.57, 0, 1);
    return [.73 + .04 * u * u * (3 - 2 * u), thickness,
      .24 * u * (1 - u) / 1.57, 0];
  }
  function headProfile(x, thickness) {
    const [a, b, ax, bx] = anteriorProfile(x, thickness);
    const q = clamp((x - .30) / .72, 0, 1);
    // Distributed growth in both axes embeds the eye within tissue that
    // continues filling out toward the arm roots, rather than a level barrel.
    // The cubic starts tangent to the mantle and retains a forward slope at
    // the crown join. These are authored proportions, not photo measurements.
    const growth = q * q * (2 - q);
    const slope = x >= .30 && x <= 1.02 ? q * (4 - 3 * q) / .72 : 0;
    return [a + .12 * growth, b + .10 * growth,
      ax + .12 * slope, bx + .10 * slope];
  }
  // One crown chart supplies the closing skin and the forward part of each
  // eye. Position and both derivatives agree at the head/crown seam.
  function crownChart(theta, phi, profile, c = Math.cos(phi), sn = Math.sin(phi)) {
    const [crownY, crownZ, crownSlopeY, crownSlopeZ] = profile;
    const s = Math.sin(theta), r = Math.cos(theta);
    const blend = 4 * s * s * r * r, blendSlope = 8 * s * r * (r * r - s * s);
    const lobe = .5 + .5 * Math.cos(8 * phi), lobeSlope = -4 * Math.sin(8 * phi);
    const delay = .18 + .015 * c * c + .006 * c + .004 * sn;
    const delaySlope = -.030 * c * sn - .006 * sn + .004 * c;
    const dorsal = Math.max(0, sn);
    // Let the upper closing skin turn beneath the separate dorsal sleeves,
    // instead of remaining a high brow that drops in front of those roots.
    const turnOffset = .15 - delay * lobe * lobe + .25 * dorsal ** 4;
    const turn = theta + turnOffset * blend;
    const turnT = 1 + turnOffset * blendSlope;
    const turnP = (-(delaySlope * lobe * lobe + 2 * delay * lobe * lobeSlope)
      + 1.00 * dorsal ** 3 * c) * blend;
    const sr = Math.sin(turn), cr = Math.cos(turn);
    const a = cr * (crownY + .235 * crownSlopeY * sr);
    const b = cr * (crownZ + .235 * crownSlopeZ * sr);
    const ad = -crownY * sr + .235 * crownSlopeY * (cr * cr - sr * sr);
    const bd = -crownZ * sr + .235 * crownSlopeZ * (cr * cr - sr * sr);
    const at = ad * turnT, bt = bd * turnT, ap = ad * turnP, bp = bd * turnP;
    const reach = .05 + .02 * c * c + .006 * c + .004 * sn;
    const reachSlope = -.04 * c * sn - .006 * sn + .004 * c;
    const extension = reach * lobe * lobe;
    const extensionSlope = reachSlope * lobe * lobe + 2 * reach * lobe * lobeSlope;
    return [1.02 + .235 * s + extension * blend, a * c, b * sn,
      .235 * r + extension * blendSlope, at * c, bt * sn,
      extensionSlope * blend, ap * c - a * sn, bp * sn + b * c];
  }
  function eyeHeadChart(x, phi, side, thickness) {
    if (x <= 1.02) {
      const [a, b, ax, bx] = headProfile(x, thickness), c = Math.cos(phi), sn = Math.sin(phi);
      return [x, side * a * c, b * sn, 1, side * ax * c, bx * sn,
        0, -side * a * sn, b * c];
    }
    const angle = side === 1 ? phi : Math.PI - phi;
    const c = Math.cos(angle), sn = Math.sin(angle);
    const lobe = .5 + .5 * Math.cos(8 * angle);
    const extension = (.05 + .02 * c * c + .006 * c + .004 * sn) * lobe * lobe;
    // The eye occupies only the monotone, rear part of the crown chart. Solve
    // its anterior coordinate without flattening or clamping its forward lid.
    let theta = Math.asin((x - 1.02) / .235);
    for (let iteration = 0; iteration < 5; iteration++) {
      const s = Math.sin(theta), r = Math.cos(theta);
      theta -= (1.02 + .235 * s + extension * 4 * s * s * r * r - x)
        / (.235 * r + extension * 8 * s * r * (r * r - s * s));
    }
    const [px, y, z, xt, yt, zt, xp, yp, zp] = crownChart(theta, angle, headProfile(1.02, thickness), c, sn);
    return [px, y, z, 1, yt / xt, zt / xt,
      0, side * (yp - yt * xp / xt), side * (zp - zt * xp / xt)];
  }
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

// Marine-only choreography. Pure data and poses; the canonical host owns input,
// drawing, reactions and the existing shared scheduler. No private frame loop.
const MARINE_DIRECTOR = (() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const mix = (a, b, q) => a + (b - a) * q;
  const smooth = (a, b, n) => { const q = clamp((n - a) / (b - a), 0, 1); return q * q * (3 - 2 * q); };
  const unit = v => { const d = Math.hypot(...v); return d > .000001 ? v.map(n => n / d) : [0, -1, .12].map(n => n / Math.hypot(1, .12)); };
  const wrap = n => ((n % 1) + 1) % 1;
  const roles = Object.freeze(['auto', 'guide', 'forager', 'sentinel', 'companion']);
  const chapterIds = Object.freeze(['arrive', 'engage', 'explore', 'depart']);
  const scenes = Object.freeze([
    Object.freeze({ id: 'reef-rendezvous', title: 'Reef rendezvous',
      description: 'A glider, a watcher and an arm-led explorer arrive at a shared reef, exchange attention, then drift apart.',
      chapters: Object.freeze(['Gather at the reef', 'Exchange a glance', 'Follow separate curiosities', 'Dissolve into the current']) }),
    Object.freeze({ id: 'upwelling-ballet', title: 'Upwelling ballet',
      description: 'Mantas ride a rising current in banked loops while companions hold different stations around the flow.',
      chapters: Object.freeze(['Find the rising water', 'Trace the spiral', 'Glide across the light', 'Release the turn']) }),
    Object.freeze({ id: 'tidepool-investigation', title: 'Tidepool investigation',
      description: 'An octopus searches a ledge with its arms, inspects an invitation, and retreats while its neighbors give it room.',
      chapters: Object.freeze(['Approach the ledge', 'Inspect a small discovery', 'Probe the next crevice', 'Return to shelter']) })
  ]);
  const defaults = Object.freeze({ scene: 'reef-rendezvous', duration: 40, current: .35,
    spread: 1, intimacy: 1, autonomy: 1, focus: 1, roles: Object.freeze([]), backdrop: true });
  const ranges = Object.freeze({ duration: [20, 80], current: [-1, 1], spread: [.65, 1.5], intimacy: [0, 1.5], autonomy: [0, 1.5], focus: [1, 12] });

  function normalize(patch = {}, base = defaults) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Marine director options must be an object.');
    for (const key of Object.keys(patch)) if (!Object.hasOwn(defaults, key)) throw new TypeError(`Unknown marine director option: ${key}`);
    const next = { ...base };
    for (const key of Object.keys(defaults)) {
      const value = patch[key];
      if (value === undefined) continue;
      if (key === 'scene') {
        if (!scenes.some(scene => scene.id === value)) throw new TypeError('Unknown marine director scene.');
      } else if (key === 'roles') {
        if (!Array.isArray(value) || value.length > 12 || !Array.from(value).every(role => roles.includes(role))) throw new TypeError('Director roles must contain at most 12 supported motives.');
      } else if (key === 'backdrop') {
        if (typeof value !== 'boolean') throw new TypeError('Director backdrop must be Boolean.');
      } else {
        const [low, high] = ranges[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high || (key === 'focus' && !Number.isInteger(value))) throw new RangeError(`Director ${key} must be ${low}..${high}${key === 'focus' ? ' and an integer' : ''}.`);
      }
      next[key] = value;
    }
    next.roles = Object.freeze([...next.roles]);
    return Object.freeze(next);
  }

  function create(config) {
    return { time: config.duration * .25, cycle: 0, cue: { x: 0, y: 0, active: false, interest: 0 } };
  }

  function step(state, config, dt, cueDt = dt) {
    if (!Number.isFinite(dt) || dt < 0 || dt > .1) throw new RangeError('Director step must be 0..0.1 seconds.');
    if (!Number.isFinite(cueDt) || cueDt < 0 || cueDt > .1) throw new RangeError('Director cue step must be 0..0.1 seconds.');
    const total = state.time + dt;
    const cycles = Math.floor(total / config.duration);
    state.time = total - cycles * config.duration;
    state.cycle = (state.cycle + cycles) % 4294967296;
    if (!state.cue.active) state.cue.interest *= Math.exp(-cueDt * 3.5);
  }

  function seek(state, config, chapter) {
    const index = chapterIds.indexOf(chapter);
    if (index < 0) throw new TypeError('Unknown marine director chapter.');
    state.time = config.duration * [.10, .34, .63, .88][index];
    state.cycle = 0;
    state.cue = { x: 0, y: 0, active: false, interest: 0 };
  }

  function cue(state, config, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Director cue must be an object.');
    if (input.type === 'release') {
      if (Object.keys(input).some(key => key !== 'type')) throw new TypeError('Release has no coordinate fields.');
      state.cue.active = false;
      return;
    }
    if (input.type !== 'invite' || Object.keys(input).some(key => !['type', 'x', 'y'].includes(key))) throw new TypeError('Expected an invite or release cue.');
    if (![input.x, input.y].every(n => typeof n === 'number' && Number.isFinite(n) && n >= -.5 && n <= .5)) throw new RangeError('Invitation coordinates must be normalized -0.5..0.5.');
    // A deliberate cue also composes a still; it never advances time or starts
    // scheduling. Continuous pointer easing stays with the canonical host.
    state.cue.x = input.x; state.cue.y = input.y; state.cue.active = true; state.cue.interest = 1;
  }

  function chapterAt(progress) {
    return progress < .20 ? 0 : progress < .48 ? 1 : progress < .78 ? 2 : 3;
  }

  function roleFor(config, member) {
    const selected = config.roles[member.id];
    if (selected && selected !== 'auto') return selected;
    if (member.role && member.role !== 'auto' && roles.includes(member.role)) return member.role;
    if (member.species === 'octopus') return 'forager';
    if (member.species === 'manta') return member.id > 2 ? 'companion' : 'guide';
    return member.id > 2 ? 'companion' : 'sentinel';
  }

  function layout(member, context, config) {
    const count = clamp(Math.round(member.count || 1), 1, 12);
    const width = context.width || 900, height = context.height || 620;
    const aspect = Math.max(.2, width / Math.max(1, height)), portrait = aspect < .85;
    const viewHeight = height / Math.min(width / 9.8, height / 6.8);
    let anchor, crowd;
    if (count === 1) {
      anchor = [0, member.species === 'octopus' ? .15 : -.55]; crowd = 1.04;
    } else if (portrait && count <= 3) {
      // Full-height stations preserve room for the mantle and trailing arms;
      // no scene subsequently compresses these anchors back toward the centre.
      const step = clamp(viewHeight * .29, 3.5, 6.1);
      anchor = [count === 2 ? (member.id ? .45 : -.45) : [-.35, .55, -.30][member.id],
        (member.id - (count - 1) / 2) * (count === 2 ? step * 1.2 : step)];
      crowd = .84;
    } else if (count === 2) {
      anchor = [member.id ? 2.65 : -2.65, -.60]; crowd = .94;
    } else if (count === 3) {
      const spots = config.scene === 'tidepool-investigation'
        ? [[-2.65, .50], [0, -1.80], [2.65, .60]]
        : [[-2.65, -.60], [2.55, 1.05], [2.55, -1.75]];
      anchor = spots[member.id].slice(); crowd = .88;
    } else {
      const columns = portrait ? 2 : Math.min(4, Math.ceil(Math.sqrt(count * 1.3)));
      const rows = Math.ceil(count / columns), row = Math.floor(member.id / columns), col = member.id % columns;
      const used = Math.min(columns, count - row * columns);
      const xStep = portrait ? 5.0 : columns === 2 ? 5.2 : columns === 3 ? 3.2 : 2.5;
      const yRange = portrait ? clamp(viewHeight * .30, 3.6, 6.2) : rows > 2 ? 2.15 : 1.60;
      anchor = [(col - (used - 1) / 2) * xStep, (row - (rows - 1) / 2) * (2 * yRange / Math.max(1, rows - 1))];
      crowd = clamp(Math.sqrt(3 / count) * .96, .60, .82);
    }
    // Tight spacing also reduces envelopes. Portrait spread primarily changes
    // horizontal breathing room; vertical stations remain safely in the view.
    anchor[0] *= config.spread;
    anchor[1] *= portrait ? clamp(config.spread, .88, 1.10) : config.spread;
    crowd *= Math.min(1, Math.max(.76, config.spread));
    return { count, portrait, anchor, crowd, lane: count > 3 ? .64 : 1 };
  }

  function pointAt(p, config, member, info, role) {
    const seed = Number.isFinite(member.seed) ? member.seed : .5;
    const phase = seed * TAU, u = p * TAU, id = member.id;
    const a = info.anchor, direction = config.current < 0 ? -1 : 1;
    const current = .75 + Math.abs(config.current) * .45;
    const freedom = config.autonomy * (role === 'sentinel' ? .25 : role === 'forager' ? .78 : role === 'companion' ? .64 : 1);
    const travel = freedom * info.lane * clamp(config.spread, .75, 1.10);
    let x = a[0], y = a[1], z = -1.05 - (id % 3) * .16;
    if (config.scene === 'reef-rendezvous') {
      if (member.species === 'manta') {
        x += .24 * travel * Math.sin(u * direction + phase);
        y += (.48 - p) * 1.30 * travel * direction + .06 * travel * Math.sin(u * 2 + phase);
        z += -.20 + .25 * Math.cos(u + phase);
      } else if (member.species === 'octopus') {
        x += .26 * travel * Math.sin(u * 2 + phase);
        y += .10 * travel * Math.cos(u * 2 + phase);
        z += .12 * Math.sin(u + phase);
      } else {
        x += .16 * travel * Math.sin(u + phase);
        y += .16 * travel * Math.sin(u * 2 + phase);
        z += .15 * config.intimacy * Math.sin(Math.PI * p) ** 2;
      }
    } else if (config.scene === 'upwelling-ballet') {
      if (member.species === 'manta') {
        // Each glider owns a separate narrow rising spiral. Their depth and
        // beat differ, but no orbit silently replaces the allocated station.
        const theta = u * direction + phase;
        x += .44 * travel * Math.cos(theta) * (info.portrait ? .65 : 1);
        y += (.50 - p) * 2.0 * travel * current * direction + .10 * travel * Math.sin(theta * 2);
        z += -.35 + .50 * Math.sin(theta + .5);
      } else if (member.species === 'octopus') {
        x += .12 * travel * Math.sin(u * 2 + phase);
        y += .08 * travel * Math.sin(u * 2);
        z -= .20;
      } else {
        x += .22 * travel * Math.cos(u * direction + phase);
        y += .14 * travel * Math.sin(u * direction + phase);
        z += -.50 + .20 * Math.sin(u + phase);
      }
    } else {
      if (member.species === 'octopus') {
        x += .35 * travel * Math.sin(u - .8 + phase * .25);
        y += .10 * travel * Math.sin(u * 2 + phase);
        z += -.25 + .18 * config.intimacy * smooth(.18, .32, p) * (1 - smooth(.55, .75, p));
      } else if (member.species === 'manta') {
        x += .25 * travel * Math.sin(u * direction + phase);
        y += -.15 + (.50 - p) * travel * direction;
        z += -1.30 - .30 * Math.cos(u + phase);
      } else {
        x += .22 * travel * Math.sin(u + phase);
        y += -.10 + .10 * travel * Math.cos(u * 2 + phase);
        z += -.35 + .15 * Math.sin(u + phase);
      }
    }
    // Arrival/departure retain each animal's lane at depth. Both the blend
    // and its derivative vanish at the seam; no central pile-up or teleport.
    const presence = smooth(0, .18, p) * (1 - smooth(.78, 1, p));
    const side = Math.sign(a[0] || (id % 2 ? 1 : -1));
    const originX = a[0] + side * .90 + .05 * Math.sin(phase), originY = a[1] - .12;
    return [mix(originX, x, presence), mix(originY, y, presence), mix(-6.2 - seed, z, presence)];
  }

  function sample(state, config, member, context = {}) {
    const id = member.id, seed = Number.isFinite(member.seed) ? member.seed : .5;
    const info = layout(member, context, config), role = roleFor(config, member);
    const p = wrap(state.time / config.duration + id * .018);
    const ci = chapterAt(p), scene = scenes.find(s => s.id === config.scene);
    const position = pointAt(p, config, member, info, role);
    const h = .001, before = pointAt(wrap(p - h), config, member, info, role), after = pointAt(wrap(p + h), config, member, info, role);
    const velocity = after.map((n, j) => (n - before[j]) / (2 * h));
    const acceleration = after.map((n, j) => (n - 2 * position[j] + before[j]) / (h * h));
    const presence = smooth(0, .18, p) * (1 - smooth(.78, 1, p));
    const pointer = context.pointer || {}, cue = state.cue;
    const pointerInterest = context.pointerEnabled ? clamp(Number.isFinite(pointer.interest) ? pointer.interest : 0, 0, 1) : 0;
    const cueInterest = clamp(cue.interest, 0, 1), focused = config.focus === id + 1;
    const explicit = Math.max(cueInterest, pointerInterest);
    const destination = cueInterest > pointerInterest ? cue : pointer;
    const weight = explicit * config.intimacy * presence * (focused ? 1 : role === 'forager' ? .28 : .14);
    // A point of interest changes the blocking as well as a decorative label.
    // Companions make room; only the selected animal fully investigates it.
    const px = clamp(Number.isFinite(destination.x) ? destination.x : 0, -.5, .5);
    const py = clamp(Number.isFinite(destination.y) ? destination.y : 0, -.5, .5);
    position[0] += clamp(px * 6.8 - position[0], -.85, .85) * weight * (member.species === 'octopus' ? .30 : .42);
    position[1] += clamp(py * (info.portrait ? 11 : 5.4) - position[1], -.70, .70) * weight * .22;
    if (!focused && cueInterest > .05 && info.count > 1) position[0] += Math.sign(position[0] || (id % 2 ? 1 : -1)) * .12 * cueInterest;
    let forward, bank;
    const angle = p * TAU + seed * TAU;
    if (member.species === 'manta') {
      // Derive steering from the route tangent, then limit its presentation
      // angle: an overhead glider can bank without turning its broad wing span
      // into a vertical needle at a slow turn or a depth-only arrival.
      const steering = Math.atan2(velocity[0], Math.abs(velocity[1]) + .65);
      const heading = clamp(steering * .60 + .055 * Math.sin(angle) + px * weight * .30, -.55, .55);
      forward = unit([Math.sin(heading), -Math.cos(heading), .14 + .035 * Math.sin(angle)]);
      const curvature = (velocity[0] * acceleration[1] - velocity[1] * acceleration[0]) / (velocity[0] ** 2 + velocity[1] ** 2 + 4);
      bank = clamp(Math.tanh(curvature * .04) * .08 + heading * .20 + px * weight * .22, -.24, .24);
    } else if (member.species === 'octopus') {
      forward = unit([.14 * Math.sin(angle * 2) + px * weight * .38, 1, .09]);
      bank = clamp(.035 * Math.sin(angle * 2) + px * weight * .09, -.16, .16);
    } else {
      const display = .5 + .5 * Math.sin(angle * 2);
      forward = unit([.8 - display * .28 + px * weight * .3, -.08 + .12 * Math.cos(angle), .38 + display * .25 + weight * .15]);
      bank = .09 * Math.sin(angle * 2) + px * weight * .10;
    }
    // Autonomous foraging supplies a slowly moving screen-space attention cue
    // even when nobody touches the page. Explicit input takes priority smoothly.
    const scale = Math.min((context.width || 900) / 9.8, (context.height || 620) / 6.8);
    const width = context.width || 900, height = context.height || 620;
    const denominator = 1 - position[2] * .2;
    const autoX = clamp((position[0] + .65 * Math.sin(angle * 2)) * scale / denominator / width, -.42, .42);
    const autoY = clamp((position[1] + (member.species === 'octopus' ? .8 : .25)) * scale / denominator / height - .02, -.40, .43);
    const exploring = ci === 2 || role === 'forager';
    const autoInterest = config.autonomy * (exploring ? .72 : .24) * presence;
    const attention = { x: mix(autoX, px, explicit), y: mix(autoY, py, explicit), interest: clamp(Math.max(autoInterest, weight), 0, 1) };
    const motifs = member.species === 'manta'
      ? ['Riding in from deep water', role === 'sentinel' ? 'Holding the outer current' : 'Guiding a banked pass', config.scene === 'upwelling-ballet' ? 'Gliding through the rising spiral' : 'Tracing the reef edge', 'Releasing into deeper water']
      : member.species === 'octopus'
        ? ['Feeling for a safe ledge', 'Inspecting with neighboring arms', 'Searching the next crevice', 'Gathering back toward shelter']
        : ['Arriving with the current', role === 'guide' ? 'Leading the exchange' : 'Watching and changing display', role === 'forager' ? 'Investigating a nearby patch' : 'Turning toward a companion', 'Fading into open water'];
    const motive = explicit > .18 && focused && presence > .5 ? member.species === 'octopus' ? 'Investigating your invitation' : member.species === 'manta' ? 'Banking toward your invitation' : 'Answering your invitation' : motifs[ci];
    return {
      position, forward, bank, reference: [0, 0, 1], visibility: .28 + .72 * presence,
      scale: clamp(info.crowd * (focused ? 1.04 : .96) * (config.scene === 'tidepool-investigation' && member.species === 'manta' ? .94 : 1), .60, 1.15),
      chapter: chapterIds[ci], chapterLabel: scene.chapters[ci], progress: p, role, motive,
      label: `${String(id + 1).padStart(2, '0')} · ${role}`,
      attention, armBias: explicit > .18 && focused ? 'inspect' : exploring ? 'search' : 'rest',
      wingEnergy: clamp(.78 + Math.abs(config.current) * .40 + (ci === 0 ? .14 : ci === 3 ? -.12 : 0), .65, 1.35)
    };
  }

  function describe(state, config, members = []) {
    const progress = wrap(state.time / config.duration), index = chapterAt(progress);
    const scene = scenes.find(s => s.id === config.scene);
    return Object.freeze({ scene: config.scene, title: scene.title,
      chapter: chapterIds[index], chapterLabel: scene.chapters[index], progress,
      time: state.time, cycle: state.cycle,
      cue: Object.freeze({ ...state.cue }),
      members: Object.freeze(members.slice(0, 12).map(member => Object.freeze({
        id: member.id + 1, species: member.species, role: roleFor(config, member),
        focused: config.focus === member.id + 1,
        motive: member.directorIntent?.motive || sample(state, config, { ...member, count: members.length }, {}).motive
      }))) });
  }
  return Object.freeze({ scenes, defaults, roles, chapters: chapterIds, normalize, create, step, seek, cue, sample, describe });
})();

export class CuttlefishArtwork {
    static get directorScenes() { return MARINE_DIRECTOR.scenes; }
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
      this._director = null; this._directorConfig = null; this.marineIntent = null;
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
        if (this._director) {
          const owner = this._hitFish(x, y);
          if (owner >= 0) {
            this.setDirector({ focus: owner + 1 });
            this.cueDirector({ type: 'disturb', id: owner + 1 });
          } else this.cueDirector({ type: 'invite', x: this.pointer.tx, y: this.pointer.ty });
          return;
        }
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
      this.marineIntent = this._director ? f.directorIntent || null : null;
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
      if (this._directorConfig && this._directorConfig.focus > this.fish.length) {
        this._directorConfig = MARINE_DIRECTOR.normalize({ focus: this.fish.length }, this._directorConfig);
      }
      if (reset || oldSpecies !== this.options.species || oldChoices !== this.options.speciesByAnimal.join() || oldSeed !== this.options.seed) { this.ink = []; this.lastPointer = null; }
      if (patch.paused !== undefined) this.paused = Boolean(patch.paused);
      else if (patch.reducedMotion === 'system' && this._motionQuery?.matches) this.paused = true;
      this.options.paused = this.paused;
      if (oldPalette !== this.options.palette) { this.palette = PALETTES[this.options.palette] || PALETTES.lagoon; this.makeAtlas(); }
      if (oldDensity !== this.options.density || oldBudget !== [this.options.maxDpr, this.options.maxPixels, this.options.maxCells].join(':')) this.resize();
      else this.render();
      this._syncLoop();
    }

    /** Additive marine choreography; the inherited options remain available
     * when disabled. No new scheduler or package-wide contract is introduced. */
    setDirector(patch) {
      if (this.destroyed) return;
      if (patch === null) {
        this._director = null; this._directorConfig = null; this.marineIntent = null;
        for (const fish of this.fish) delete fish.directorIntent;
        this.render(); return;
      }
      const before = this._directorConfig;
      const next = MARINE_DIRECTOR.normalize(patch, before || MARINE_DIRECTOR.defaults);
      if (next.focus > this.fish.length) throw new RangeError('Director focus must name an existing cast member.');
      if (!before || next.scene !== before.scene) {
        this._director = MARINE_DIRECTOR.create(next);
        this.ink.length = 0;
        for (const fish of this.fish) { fish.reaction = this._newReaction(); fish.agitation = 0; }
      } else this._director.time = this._director.time / before.duration * next.duration;
      this._directorConfig = next;
      this.render();
    }

    getDirector() {
      if (!this._director) return Object.freeze({ enabled: false, config: null,
        scene: null, title: 'Classic current', chapter: null, chapterLabel: 'Original scene and formation',
        progress: 0, time: this.time, cycle: 0, focused: 1,
        cue: Object.freeze({ x: 0, y: 0, active: false, interest: 0 }), members: Object.freeze([]) });
      const summary = MARINE_DIRECTOR.describe(this._director, this._directorConfig, this.fish);
      return Object.freeze({ ...summary, enabled: true, config: this._directorConfig, focused: this._directorConfig.focus,
        members: Object.freeze(summary.members.map((member, i) => Object.freeze({ ...member,
          visible: this.fish[i].visible, phase: this.fish[i].phase }))) });
    }

    cueDirector(input) {
      if (this.destroyed || !this._director) return false;
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Director cue must be an object.');
      if (input.type === 'disturb') {
        if (Object.keys(input).some(key => !['type', 'id'].includes(key))) throw new TypeError('Disturb accepts only an optional cast ID.');
        const id = input.id === undefined ? this._directorConfig.focus : input.id;
        if (!Number.isInteger(id) || id < 1 || id > this.fish.length) throw new RangeError('Disturb must name an existing cast member.');
        if (this.paused) return false;
        return this._startle('director', id - 1);
      }
      MARINE_DIRECTOR.cue(this._director, this._directorConfig, input);
      if (input.type === 'release' && this.paused) this._director.cue.interest = 0;
      // Explicit cues may compose a paused still. Pointer movement cannot.
      this.render(); return true;
    }

    showDirectorStill(chapter) {
      if (this.destroyed || !this._director) return false;
      const still = MARINE_DIRECTOR.create(this._directorConfig);
      MARINE_DIRECTOR.seek(still, this._directorConfig, chapter); // validate before mutation
      this.setPaused(true); this._director = still;
      this.time = still.time; this.elapsed = 0; this.ink.length = 0;
      this.pointer.x = this.pointer.y = this.pointer.tx = this.pointer.ty = 0;
      this.pointer.active = false; this.pointer.interest = 0; this.lastPointer = null;
      for (const fish of this.fish) {
        fish.reaction = this._newReaction(); fish.sceneTime = still.time;
        fish.agitation = fish.movingTime = fish.motionTravel = fish.motionTurns = 0;
        fish.motionVector = null;
      }
      this.render(); return true;
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
      if (this._director) { this._director = MARINE_DIRECTOR.create(this._directorConfig); this._director.time = 0; }
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
    _canReact(f) { return !f.reaction.active && Boolean(this._director || !this._legacySingle() || this.options.scene !== 'swimby'); }

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
      if (this._director) { this.cueDirector({ type: 'disturb' }); return; }
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
      if (this._director) this._director.response = { id: this.activeFish.id, age: 0, x: this.worldX, y: this.worldY };
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
      if (this._director) {
        const reach = this.activeFish.species === 'octopus' ? .36 : this.activeFish.species === 'manta' ? .72 : .55;
        return offset.map(value => value * reach);
      }
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
        // A composed encounter keeps the plume near its owner and clears it
        // before the return. Classic lens-facing ink retains its original arc.
        const speed = (3.0 + 1.6 * Math.sin(Math.PI * sprayProgress) + hash(seed + 70) * .55) * (this._director ? .60 : 1);
        this.ink.push({ x: origin[0] + radial[0] * .027, y: origin[1] + radial[1] * .027, z: origin[2] + radial[2] * .027,
          vx: aim[0] * speed + radial[0] * cone, vy: aim[1] * speed + radial[1] * cone, vz: aim[2] * speed + radial[2] * cone,
          radius: .029 + hash(seed + 110) * .028, mass: .38 + hash(seed + 52) * .22,
          life: this._director ? 3.0 + hash(seed + 90) : 6.7 + hash(seed + 90) * 2.7,
          age: 0, phase: angle, axis: aim,
          ...(this._director ? { directorInk: true } : {}),
          ...(this.activeFish.species === 'octopus' ? { lightInk: true } : {}) });
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
        if (this._director) {
          MARINE_DIRECTOR.step(this._director, this._directorConfig, dt * Math.min(1, this.options.motion / 1.2), dt);
          if (this._director.response) {
            this._director.response.age += dt;
            if (this._director.response.age >= REACTION.recover) delete this._director.response;
          }
        }

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
        const x = -1.85 + 2.34 * u, front = anteriorProfile(x, thickness);
        for (let j = 0; j < 88; j++) {
          const ny = this._rings[88][j][0] / .73, nz = this._rings[88][j][1] / thickness;
          const c = this._rings[88][j][0], s = this._rings[88][j][1];
          const fx = x > -.55 ? -front[2] / front[0] * c * c : nx;
          const fy = x > -.55 ? c / front[0] : ny, fz = x > -.55 ? s / front[1] : nz;
          const inv = 1 / Math.sqrt(fx * fx + fy * fy + fz * fz), n = (i * 88 + j) * 3;
          this.bodyNormals[n] = fx * inv; this.bodyNormals[n + 1] = fy * inv; this.bodyNormals[n + 2] = fz * inv;
        }
      }
      this.headNormals ||= new Float32Array(HEAD_STATIONS.length * HEAD_RING * 3);
      for (let i = 0; i < HEAD_STATIONS.length; i++) {
        const [a, b, ax, bx] = headProfile(HEAD_STATIONS[i], thickness);
        for (let j = 0; j < HEAD_RING; j++) {
          const [c, s] = this._rings[HEAD_RING][j];
          const nx = -(b * ax * c * c + a * bx * s * s), ny = b * c, nz = a * s;
          const inv = 1 / Math.max(.00001, Math.hypot(nx, ny, nz)), n = (i * HEAD_RING + j) * 3;
          this.headNormals[n] = nx * inv;
          this.headNormals[n + 1] = ny * inv;
          this.headNormals[n + 2] = nz * inv;
        }
      }
      this.crownSurface ||= new Float64Array(25 * HEAD_RING * 6);
      const crownProfile = headProfile(1.02, thickness);
      for (let i = 0; i <= 24; i++) {
        const theta = i / 24 * Math.PI / 2;
        for (let j = 0; j < HEAD_RING; j++) {
          const [c, sn] = this._rings[HEAD_RING][j], phi = j / HEAD_RING * TAU;
          const point = crownChart(theta, phi, crownProfile, c, sn);
          const [x, y, z, xt, yt, zt, xp, yp, zp] = point;
          const n = (i * HEAD_RING + j) * 6;
          this.crownSurface[n] = x;
          this.crownSurface[n + 1] = y;
          this.crownSurface[n + 2] = z;
          // Cross derivatives include the angular relief and the upper roll.
          // At the central pole the beak remains in front at 1.258+.
          this.crownSurface[n + 3] = i === 24 ? 1 : yp * zt - zp * yt;
          this.crownSurface[n + 4] = i === 24 ? 0 : zp * xt - xp * zt;
          this.crownSurface[n + 5] = i === 24 ? 0 : xp * yt - yp * xt;
          const inv = 1 / Math.max(.000001, Math.hypot(...this.crownSurface.subarray(n + 3, n + 6)));
          this.crownSurface[n + 3] *= inv;
          this.crownSurface[n + 4] *= inv;
          this.crownSurface[n + 5] *= inv;
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
      if (this._director) {
        const fish = this.activeFish;
        const intent = MARINE_DIRECTOR.sample(this._director, this._directorConfig,
          { id: fish.id, species: fish.species, seed: hash(fish.id + 910 + this.options.seed * .123), size: fish.size,
            behavior: fish.behavior, count: this.fish.length },
          { width: this.width, height: this.height, pointer: this.pointer, pointerEnabled: this.options.followPointer });
        position = intent.position; forward = intent.forward; bank = intent.bank; reference = intent.reference;
        this.objectScale = fish.size * intent.scale;
        this.subjectVisibility = intent.visibility; this.phase = intent.motive; this.progress = intent.progress;
        this.encounterGrip = this.encounterFront = 0;
        const response = this._director.response;
        if (response && response.id !== fish.id) {
          const distance = Math.hypot(position[0] - response.x, position[1] - response.y);
          const space = smooth(0, .9, response.age) * (1 - smooth(2, 5.5, response.age)) * Math.exp(-distance * .28);
          position[0] += Math.sign(position[0] - response.x || fish.id - response.id) * space * .60;
          position[2] -= space * .30;
        }
        fish.directorIntent = intent; this.marineIntent = intent;
      } else this.marineIntent = null;
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
      if (!this._director && !definition && this._legacySingle() && scene !== 'reactive' && !r.active) bank = clamp(Math.atan2(dot(acceleration, lateral), 2.4), -.3, .3) * (1 - .85 * lingering);
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
        const x = -1.85 + 2.34 * u;
        const front = anteriorProfile(x, thickness);
        const breath = (1 + .037 * Math.sin(t * 2.8 - u * 3.2)) * (1 - this.startleTension * .09);
        const ry = (x > -.55 ? front[0] : .73 * profile) * breath;
        const rz = x > -.55 ? front[1] : thickness * profile;
        const flex = .035 * Math.sin(t * 2.2 - u * 3.8);
        for (let j = 0; j < nv; j += lod) {
          const phi = j / nv * TAU, c = ring[j][0], sn = ring[j][1];
          const stripe = Math.sin(u * 35 + Math.sin(phi * 5 + t * .65) * 1.8 - t * 1.25);
          const mottling = Math.sin(u * 79 + phi * 13) * Math.cos(phi * 19 - u * 25 + t * .3);
          const relief = 1 + .013 * stripe;
          const ni = (i * nv + j) * 3, bn = this.bodyNormals;
          const display = this.marineIntent ? .09 * Math.sin(u * 18 - t * 2.4 + this.activeFish.seed * TAU)
            * (this.marineIntent.chapter === 'engage' ? 1 : .35) : 0;
          const light = this._shade(bn[ni], bn[ni + 1], bn[ni + 2], .11 * stripe + .045 * mottling + display, false, true);
          this._put(x, ry * c * relief, rz * sn * relief + flex, light, 0, i * 101 + j);
        }
      }
      // The tail tapers to a true point. A solid shoulder cap closes the
      // front of the mantle underneath the overlapping head.
      const frontProfile = anteriorProfile(.49, thickness);
      for (let ir = 0; ir <= 12; ir += this.geometryStep || 1) {
        const r = ir / 12;
        for (let j = 0; j < 48; j += this.geometryStep || 1) {
          const a = this._rings[48][j];
          this._put(.49, frontProfile[0] * r * a[0], frontProfile[1] * r * a[1], this._shade(1, 0, 0, -.035), 0, ir * 51 + j);
        }
      }
      // A broad, very thin skirt fin: out-of-plane traveling waves make
      // its near and far edges trade occlusion naturally as the animal turns.
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i <= 116; i += lod) {
          const u = i / 116;
          const x = -1.85 + 2.34 * u;
          const profile = Math.pow(Math.max(0, Math.sin(Math.PI * .9 * u)), .72);
          const ry = (x > -.55 ? anteriorProfile(x, thickness)[0] : .73 * profile)
            * (1 + .037 * Math.sin(t * 2.8 - u * 3.2));
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
      this._head(t);
      this._eye(-1);
      this._eye(1);
    }

    _head(t) {
      const lod = this.geometryStep || 1, thickness = .43 + .055 * this.depthAmount;
      // A broad continuation of the anterior mantle carries the eye into the
      // crown. Match mantle angular density so the wider head stays continuous
      // at native demo scale. Socket patches replace small lateral interiors.
      for (let i = 0; i < HEAD_STATIONS.length; i += lod) {
        const x = HEAD_STATIONS[i], u = i / 36;
        const [ry, rz] = headProfile(x, thickness);
        for (let j = 0; j < HEAD_RING; j += lod) {
          const a = this._rings[HEAD_RING][j];
          const eyeU = (x - EYE_X) / EYE_HALF_X;
          const eyeV = (Math.atan2(a[1], Math.abs(a[0])) - EYE_ANGLE) / EYE_HALF_ANGLE;
          if (eyeU * eyeU + eyeV * eyeV < .92 * .92) continue;
          const ni = (i * HEAD_RING + j) * 3, hn = this.headNormals;
          const light = this._shade(hn[ni], hn[ni + 1], hn[ni + 2], Math.sin(u * 30 + j * .7) * .035, false, true);
          this._put(x, a[0] * ry, a[1] * rz, light, 0, i * 101 + j);
        }
      }
      this._crown(t);
    }

    _crown(t) {
      const lod = this.geometryStep || 1, surface = this.crownSurface;
      for (let i = 0; i <= 24; i += lod) {
        for (let j = 0; j < HEAD_RING; j += lod) {
          const n = (i * HEAD_RING + j) * 6;
          const [c, sn] = this._rings[HEAD_RING][j];
          const eyeU = (surface[n] - EYE_X) / EYE_HALF_X;
          const eyeV = (Math.atan2(sn, Math.abs(c)) - EYE_ANGLE) / EYE_HALF_ANGLE;
          if (eyeU * eyeU + eyeV * eyeV < .92 * .92) continue;
          const light = this._shade(surface[n + 3], surface[n + 4], surface[n + 5],
            Math.sin(i * .73 + j * .7) * .035, false, true);
          this._put(surface[n], surface[n + 1], surface[n + 2], light, 0, 50000 + i * 101 + j);
        }
      }
    }

    _eye(side) {
      // +X is anterior, ±Y lateral and +Z dorsal. The socket, lid and iris
      // share the head's curved parameterization: no sphere, stalk or tangent
      // disc can extend the outline. A shallow inward dish meets a flush lid.
      // The W is a light-adapted aperture on that surface, never a glyph.
      // Biology, view/LOD limits and reference provenance: MARINE-EYE-ANATOMY.md.
      const surface = (u, v) => {
        const x = EYE_X + EYE_HALF_X * u, phi = EYE_ANGLE + EYE_HALF_ANGLE * v;
        return eyeHeadChart(x, phi, side, .43 + .055 * this.depthAmount).slice(0, 3);
      };
      const left = this._project(...surface(-1, 0)), right = this._project(...surface(1, 0));
      const top = this._project(...surface(0, 1)), bottom = this._project(...surface(0, -1));
      const width = Math.hypot((right[0] - left[0]) / this.cellW, (right[1] - left[1]) / this.cellH);
      const height = Math.hypot((top[0] - bottom[0]) / this.cellW, (top[1] - bottom[1]) / this.cellH);
      // Fade the two troughs into a simple slit when too few cells can carry
      // them. This is continuous under scale/turns and changes no attachment.
      const detail = smooth(4, 8, width) * smooth(2, 4, height);
      const lod = this.geometryStep || 1;
      // Center both grids on zero at every LOD, so coarse sampling still
      // carries the slit instead of stepping over its entire dark band.
      const nu = Math.ceil(Math.min(32, Math.max(12, Math.ceil(width * 1.2))) / lod) * lod;
      const nv = Math.ceil(Math.min(24, Math.max(10, Math.ceil(height * 1.2))) / lod) * lod;
      // Local camera direction, multiplied by perspectiveStrength. Unlike a
      // fixed +Z test this also culls the far surface during close/off-axis
      // passes. At zero perspective it reduces to the orthographic view vector.
      const p = this.perspectiveStrength, k = p * this.objectScale;
      const wx = -p * this.worldX, wy = -p * this.worldY, wz = 1 - p * this.worldZ;
      const cx = wx * this.r00 + wy * this.r10 + wz * this.r20;
      const cy = wx * this.r01 + wy * this.r11 + wz * this.r21;
      const cz = wx * this.r02 + wy * this.r12 + wz * this.r22;
      for (let iy = -nv; iy <= nv; iy += lod) {
        for (let ix = -nu; ix <= nu; ix += lod) {
          const u = ix / nu, v = iy / nv, rr = u * u + v * v;
          if (rr > 1) continue;
          const q = Math.sqrt(rr), px = EYE_X + EYE_HALF_X * u;
          const phi = EYE_ANGLE + EYE_HALF_ANGLE * v;
          const [, sy, sz, , sxy, sxz, , spy, spz] = eyeHeadChart(px, phi, side, .43 + .055 * this.depthAmount);
          // At most .0108 model units inward; the perimeter is exactly flush.
          // Analytic derivatives keep the recessed iris and lid in the same
          // lighting field as the head, without a spherical specular button.
          const blend = clamp((q - .55) / .42, 0, 1);
          const recess = .014 * (1 - blend * blend * (3 - 2 * blend));
          const recessSlope = -.014 * 6 * blend * (1 - blend) / .42;
          const r = 1 - recess;
          const rx = -recessSlope * u / (EYE_HALF_X * Math.max(q, .00001));
          const rp = -recessSlope * v / (EYE_HALF_ANGLE * Math.max(q, .00001));
          const py = sy * r, pz = sz * r;
          const ty = sxy * r + sy * rx, tz = sxz * r + sz * rx;
          const ay = spy * r + sy * rp, az = spz * r + sz * rp;
          const nx = side * (ay * tz - az * ty), ny = side * az, nz = -side * ay;
          const dx = cx - k * (px - .30), dy = cy - k * py, dz = cz - k * pz;
          // The supporting head also occludes the recessed surface.
          // Test both normals so a far socket cannot show through sparse cells.
          const facing = side * ((spy * sxz - spz * sxy) * dx + spz * dy - spy * dz);
          if (facing <= 0 || nx * dx + ny * dy + nz * dz <= 0) continue;
          const iris = 1 - smooth(.66, .84, q);
          const slit = .015 + .17 * detail * Math.cos(u / .76 * TAU);
          // A subcell dark band can lose every depth-buffer cell to adjacent
          // iris samples. Give the unresolved slit bounded pixel coverage;
          // at resolving scale the authored aperture is already wide enough.
          const slitWidth = Math.max(.070 + .035 * (1 - detail), Math.min(.32, 1.2 / Math.max(1, height)));
          const halfSlit = slitWidth * Math.sqrt(Math.max(0, 1 - (u / .76) ** 2));
          const pupil = q < .82 && Math.abs(u) < .76 && Math.abs(v - slit) < halfSlit;
          const shade = this._shade(nx, ny, nz, 0);
          const crease = smooth(.64, .74, q) * (1 - smooth(.78, .94, q));
          // Restrained iris contrast and an upper lid shadow, not a luminous
          // round surround. The outer skin blends back into head lighting.
          const irisLight = .10 + .58 * Math.min(shade, .82);
          const light = pupil ? .025 : Math.max(.065, mix(shade, irisLight, iris) - crease * (.07 + .045 * smooth(-.2, .7, v)));
          this._put(px, py, pz, light, 0, 30000 + (side + 1) * 6000 + (iy + nv) * 81 + ix + nu);
        }
      }
    }

    _storeRootSection(i, arm, u, center, tangent, first, second, radius, sleeve, texture, seed) {
      // Reuse a small strip cache for one arm at a time. The extra terminal
      // row is a derivative neighbor only: distal samples use their original
      // emission path unchanged.
      this._rootSections ||= Array.from({ length: 32 }, () => ({
        points: new Float64Array(28 * 3), extras: [], texture: 0, seed: 0, kind: 0,
      }));
      const row = this._rootSections[i], angle = arm / 8 * TAU;
      let radial = [0, Math.cos(angle), Math.sin(angle)];
      const projection = dot(radial, tangent);
      radial = unit(radial.map((value, axis) => value - projection * tangent[axis]));
      const across = cross(tangent, radial);
      // Broad root faces carry the brow and cheek into individual arms. Extra
      // tangential width on the three upper roots exposes separate sloping
      // faces. The oval vanishes with each sleeve, before its distal boundary.
      const dorsal = Math.max(0, Math.sin(angle));
      // Round the tissue where the three upper arms emerge through the brow.
      // Only the radial section changes; centers, trajectories and distal
      // arm surfaces keep their accepted V7 coordinates. The short quintic
      // returns to the existing section with two derivatives before u=.16.
      const joinU = clamp(u / .16, 0, 1);
      const joinBlend = 1 - joinU ** 3 * (10 + joinU * (-15 + 6 * joinU));
      const radialChange = (-.055 - .12 * dorsal * dorsal * joinBlend) * sleeve;
      const tangentialChange = (ROOT_SECTION[arm] + .35 * dorsal * dorsal) * sleeve;
      for (let j = 0; j < 28; j++) {
        const [ca, sa] = this._rootRing[j];
        const dx = first[0] * ca + second[0] * sa, dy = first[1] * ca + second[1] * sa, dz = first[2] * ca + second[2] * sa;
        const along = (dx * radial[0] + dy * radial[1] + dz * radial[2]) * radialChange;
        const wide = (dx * across[0] + dy * across[1] + dz * across[2]) * tangentialChange;
        row.points[j * 3] = center[0] + dx * radius + radial[0] * along + across[0] * wide;
        row.points[j * 3 + 1] = center[1] + dy * radius + radial[1] * along + across[1] * wide;
        row.points[j * 3 + 2] = center[2] + dz * radius + radial[2] * along + across[2] * wide;
      }
      row.texture = texture; row.seed = seed; row.kind = arm % 3 === 0 ? 1 : 0;
      row.extras.length = 0;
      return row;
    }

    _emitRootSections(count, lod) {
      const rows = this._rootSections;
      for (let i = 0; i < count; i++) {
        const row = rows[i], previous = rows[Math.max(0, i - 1)].points, next = rows[i + 1].points;
        for (let j = 0; j < 28; j += lod) {
          const offset = j * 3, before = ((j + 27) % 28) * 3, after = ((j + 1) % 28) * 3;
          const ax = row.points[after] - row.points[before], ay = row.points[after + 1] - row.points[before + 1], az = row.points[after + 2] - row.points[before + 2];
          const ux = next[offset] - previous[offset], uy = next[offset + 1] - previous[offset + 1], uz = next[offset + 2] - previous[offset + 2];
          // Surface differences include taper, the ellipse and the moving
          // frame. A circular tube normal would light these broad faces as
          // rounded buttons and omit the curvature of the root trajectory.
          let nx = ay * uz - az * uy, ny = az * ux - ax * uz, nz = ax * uy - ay * ux;
          const length = Math.hypot(nx, ny, nz);
          if (length > .00001) { nx /= length; ny /= length; nz /= length; }
          else { nx = 1; ny = 0; nz = 0; }
          this._put(row.points[offset], row.points[offset + 1], row.points[offset + 2],
            this._shade(nx, ny, nz, row.texture, false, true), row.kind, row.seed + j);
        }
        for (const extra of row.extras) this._put(...extra);
      }
    }

    _arms(t) {
      this._rootRing ||= Array.from({ length: 28 }, (_, j) => [Math.cos(j / 28 * TAU), Math.sin(j / 28 * TAU)]);
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
            let ct = Math.cos(theta), st = Math.sin(theta), cb = Math.cos(beta), sb = Math.sin(beta);
            if (i > 0) { x += ct * cb * step; y += st * cb * step; z += sb * step; }
            // Blend the proximal attachment into the crown over each root
            // interval. The underlying free-arm waves, curl and escape keep
            // their existing coordinates and timing beyond that interval.
            const rootStart = feeding ? .02 : .06, rootSpan = feeding ? .28 : rootEnd(k) - .06;
            const rootU = clamp((u - rootStart) / rootSpan, 0, 1);
            const [rootOffset, rootSlope] = rootOffsetCorrection(k, u);
            const root = 1 - rootU * rootU * (3 - 2 * rootU) + rootOffset;
            const rootY = ((feeding ? ARM_ROOT_Y : PRIMARY_ROOT_Y) - .20) * Math.cos(angle);
            const rootZ = ((feeding ? ARM_ROOT_Z : PRIMARY_ROOT_Z) - .17) * Math.sin(angle);
            const py = y + rootY * root, pz = z + rootZ * root;
            let centerSpeed = 1;
            if ((rootU > 0 && rootU < 1) || rootSlope !== 0) {
              const slope = -6 * rootU * (1 - rootU) / (rootSpan * length) + rootSlope / length;
              const tx = ct * cb, ty = st * cb + rootY * slope, tz = sb + rootZ * slope;
              const radial = Math.hypot(tx, ty), total = Math.hypot(radial, tz);
              centerSpeed = total;
              ct = tx / radial; st = ty / radial; cb = radial / total; sb = tz / total;
            }
            const club = feeding ? .054 * Math.exp(-Math.pow((u - .89) / .1, 2)) : 0;
            const [sleeve, sleeveSlope] = rootSleeve(k, u);
            const radius = (feeding ? .035 : .064) * Math.pow(1 - u, .65) + .007 + club + sleeve;
            if (!feeding && (u < rootEnd(k) || (i - 1) / segments < rootEnd(k))) {
              const row = this._storeRootSection(i, k, u, [x, py, pz], [ct * cb, st * cb, sb],
                [-st, ct, 0], [-sb * ct, -sb * st, cb], radius, sleeve, .06 * Math.sin(u * 55 - t), i * 19 + k * 90);
              if (u < rootEnd(k)) {
                if (i % 5 === 0 && u > .12 && u < .96) row.extras.push(
                  [x - sb * ct * radius, py - sb * st * radius, pz + cb * radius * 1.05, .97, 0, i + k]);
                continue;
              }
              this._emitRootSections(i, this.geometryStep || 1);
            }
            const section = sleeve > 0 ? this._rootRing : ring;
            const taper = sleeveSlope / (length * centerSpeed);
            for (let j = 0; j < section.length; j += this.geometryStep || 1) {
              const ca = section[j][0], sa = section[j][1];
              const nx = -st * ca - sb * ct * sa, ny = ct * ca - sb * st * sa, nz = cb * sa;
              const light = this._shade(nx - ct * cb * taper, ny - st * cb * taper, nz - sb * taper,
                .06 * Math.sin(u * 55 - t), false, sleeve === 0);
              this._put(x + nx * radius, py + ny * radius, pz + nz * radius, light, k % 3 === 0 ? 1 : 0, i * 19 + j + k * 90);
            }
            if (i % 5 === 0 && u > .12 && u < .96) this._put(x - sb * ct * radius, py - sb * st * radius, pz + cb * radius * 1.05, .97, 0, i + k);
          }
        }
        return;
      }

      if (!this._gripPoints) {
        this._gripPoints = Array.from({ length: 10 }, () => new Float32Array(85 * 3));
        this._gripFramePoints = Array.from({ length: 10 }, () => new Float32Array(85 * 3));
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
        const points = this._gripPoints[k], framePoints = this._gripFramePoints[k];
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
          const originalRoot = 1 - smooth(.02, .30, u);
          const root = (feeding ? originalRoot : 1 - smooth(.06, rootEnd(k), u)) + rootOffsetCorrection(k, u)[0];
          points[n] = nx + (ex - nx) * g;
          points[n + 1] = ny + (ey - ny) * g + ((feeding ? ARM_ROOT_Y : PRIMARY_ROOT_Y) - .20) * Math.cos(normalAngle) * root;
          points[n + 2] = nz + (ez - nz) * g + ((feeding ? ARM_ROOT_Z : PRIMARY_ROOT_Z) - .17) * Math.sin(normalAngle) * root;
          // Preserve the original Float32 neighbor positions as well as the
          // positions of the new proximal tissue. At coarse LOD the first
          // distal frame can otherwise reach back into a corrected root.
          framePoints[n] = points[n];
          framePoints[n + 1] = ny + (ey - ny) * g + (ARM_ROOT_Y - .20) * Math.cos(normalAngle) * originalRoot;
          framePoints[n + 2] = nz + (ez - nz) * g + (ARM_ROOT_Z - .17) * Math.sin(normalAngle) * originalRoot;
        }

        for (let i = 0; i <= segments; i++) {
          const u = i / segments, n = i * 3;
          const prev = Math.max(0, i - 1) * 3, next = Math.min(segments, i + 1) * 3;
          const frame = u >= rootEnd(k) ? framePoints : points;
          let tx = frame[next] - frame[prev], ty = frame[next + 1] - frame[prev + 1], tz = frame[next + 2] - frame[prev + 2];
          const centerSpeed = Math.hypot(tx, ty, tz) * segments * 3 / Math.max(3, next - prev);
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
          const [sleeve, sleeveSlope] = rootSleeve(k, u);
          const radius = normalRadius + (gripRadius - normalRadius) * g + sleeve;
          const taper = sleeveSlope / Math.max(.00001, centerSpeed);
          const x = points[n], y = points[n + 1], z = points[n + 2];
          const section = sleeve > 0 ? this._rootRing : this._gripRing;
          let rootRow = null;
          if (!feeding && (u < rootEnd(k) || (i - 1) / segments < rootEnd(k))) {
            const row = this._storeRootSection(i, k, u, [x, y, z], [tx, ty, tz], [rx, ry, rz], [bx, by, bz],
              radius, sleeve, .045 * Math.sin(u * 65 - t * .7 + k), i * 19 + k * 90);
            if (u < rootEnd(k)) rootRow = row;
            else this._emitRootSections(i, this.geometryStep || 1);
          }
          if (!rootRow) for (let j = 0; j < section.length; j += this.geometryStep || 1) {
            const ca = section[j][0], sa = section[j][1];
            const sx = rx * ca + bx * sa, sy = ry * ca + by * sa, sz = rz * ca + bz * sa;
            const texture = .045 * Math.sin(u * 65 - t * .7 + k);
            this._put(x + sx * radius, y + sy * radius, z + sz * radius,
              this._shade(sx - tx * taper, sy - ty * taper, sz - tz * taper, texture, false, sleeve === 0), k % 3 === 0 ? 1 : 0, i * 19 + j + k * 90);
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
              const cup = [x + cx * lift + (tx * ca + ux * sa) * cupRadius,
                y + cy * lift + (ty * ca + uy * sa) * cupRadius,
                z + cz * lift + (tz * ca + uz * sa) * cupRadius,
                light, 0, 17000 + k * 200 + i * 8 + j];
              if (rootRow) rootRow.extras.push(cup); else this._put(...cup);
            }
            const center = [x + cx * (lift - .009), y + cy * (lift - .009), z + cz * (lift - .009), .075, 0, k * 600 + i];
            if (rootRow) rootRow.extras.push(center); else this._put(...center);
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
        const radius = (p.radius + Math.sqrt(p.age) * (p.directorInk ? .073 : .105)) * this.scale * perspective;
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

    _drawMarineBackdrop() {
      if (!this._directorConfig.backdrop) return;
      const c = this.ctx, w = this.width, h = this.height, config = this._directorConfig;
      const t = this._director.time, color = this.palette.middle.join(',');
      c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `${Math.max(7, Math.min(11, this.cellH * .85))}px monospace`;
      if (config.scene === 'upwelling-ballet') {
        // Three bounded strands describe the water column, behind the animals.
        for (let strand = 0; strand < 3; strand++) for (let j = 0; j < 44; j++) {
          const u = j / 43, phase = u * TAU * 1.4 + strand * TAU / 3 + t * config.current * .15;
          const x = w * (.43 + Math.sin(phase) * (.08 + u * .06));
          const y = h * (.91 - u * .81);
          c.fillStyle = `rgba(${color},${.10 + .14 * (1 - Math.abs(u - .5) * 2)})`;
          c.fillText(j % 4 ? '.' : ':', x, y);
        }
      } else {
        // Sparse ASCII contour shelves give the octopus a legible place to
        // investigate. No filled mesh, texture, extra canvas or physics loop.
        for (let ridge = 0; ridge < 3; ridge++) for (let j = 0; j < 88; j++) {
          const u = j / 87;
          const rise = .035 * Math.sin(u * 13 + ridge * .9) + .018 * Math.sin(u * 31 + ridge);
          const y = h * ((config.scene === 'tidepool-investigation' ? .73 : .84) + ridge * .045 + rise);
          c.fillStyle = `rgba(${color},${.20 - ridge * .045})`;
          c.fillText(j % 6 === 0 ? ':' : '.', w * (.03 + u * .94), y);
        }
      }
      // The signed current changes visible drift without growing a trail list.
      for (let i = 0; i < 28; i++) {
        const x = ((hash(i + 17) + t * config.current * .008) % 1 + 1) % 1 * w;
        const y = (.12 + hash(i + 22) * .68) * h;
        c.fillStyle = `rgba(${color},.22)`; c.fillText(config.current < 0 ? '<' : config.current > 0 ? '>' : '.', x, y);
      }
      c.restore();
    }

    _drawMarineInvitation() {
      const cue = this._director.cue;
      if (cue.interest < .03) return;
      const c = this.ctx, x = (cue.x + .5) * this.width, y = (cue.y + .5) * this.height;
      c.save(); c.globalAlpha = cue.interest * .72;
      c.strokeStyle = '#d4ead5'; c.lineWidth = 1;
      c.beginPath(); c.arc(x, y, 13, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x + 4, y); c.moveTo(x, y - 4); c.lineTo(x, y + 4); c.stroke();
      c.restore();
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
      if (this._director) this._drawMarineBackdrop();
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
          const label = this._director ? fish.directorIntent.label : String(fish.id + 1).padStart(2, '0');
          const halfWidth = this._director ? 57 : 14;
          const x = clamp(q[0], halfWidth + 6, w - halfWidth - 6), y = clamp(q[1] - 26, 18, h - 18);
          c.fillStyle = 'rgba(5,14,16,.82)'; c.fillRect(x - halfWidth, y - 10, halfWidth * 2, 20);
          c.fillStyle = this._directorConfig?.focus === fish.id + 1 ? '#f4edc6' : '#c8f8e8'; c.fillText(label, x, y);
        }
      }
      this._drawInk();
      if (this._director) this._drawMarineInvitation();
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
      this.bodyNormals = null; this.headNormals = null; this.crownSurface = null; this._rootRing = null;
      this._rootSections = null;
      this._gripPoints = null; this._gripFramePoints = null;
      // Keep the caller's visible canvas and its last frame. Ownership stays
      // with the host; only internal buffers and subscriptions are released.
    }
  }

export function createCuttlefish(canvas, options) { return new CuttlefishArtwork(canvas, options); }

/** Marine-only opt-in on the existing /cuttlefish entry. Import is SSR-safe. */
export function normalizeMarineDirector(options = {}) { return MARINE_DIRECTOR.normalize(options); }

export function createMarineDirector(canvas, director = {}, artwork = {}) {
  const config = normalizeMarineDirector(director); // Fail before allocating browser resources.
  const options = { scene: 'reactive', species: 'manta', count: 3, speciesByAnimal: ['manta', 'octopus', 'cuttlefish'],
    behaviors: ['hover', 'hover', 'curious'], size: .76, sizeVariation: .20, followPointer: true, ...artwork };
  const requestedCount = Number(options.count);
  const count = clamp(Math.round(Number.isFinite(requestedCount) ? requestedCount : 4), 1, 12);
  if (config.focus > count) throw new RangeError('Director focus must name an existing cast member.');
  const engine = new CuttlefishArtwork(canvas, options);
  try { engine.setDirector(config); } catch (error) { engine.destroy(); throw error; }
  return engine;
}
