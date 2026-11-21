import type { OwlGeometry, OwlLandmarks, OwlMaterial, OwlPart, OwlState, OwlSurface } from '../../types.js';
import { OWL_REST_PRESENTATION } from './choreography.js';

/** Original owl-local analytic surfaces. No renderer, clock, randomness or DOM. */
export const OWL_SURFACE_LIMIT = 96;
const radians = Math.PI / 180;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

function requireFinite(value: number, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

/** Both modest turning views retain the two facial landmarks. Full profile is not modeled. */
export function buildOwlGeometry(state: OwlState): OwlGeometry {
  if (!state || state.species !== 'owl' || state.version !== 1) throw new TypeError('Expected Owl state version 1');
  const yaw = requireFinite(state.headYawDeg, 'headYawDeg');
  const pitch = requireFinite(state.headPitchDeg, 'headPitchDeg');
  if (Math.abs(yaw) > 45 || Math.abs(pitch) > 20) throw new RangeError('Owl pose exceeds supported head bounds');
  const values = ['blink', 'ruffle', 'leftWing', 'rightWing'] as const;
  for (const name of values) {
    requireFinite(state[name], name);
    if (state[name] < 0 || state[name] > 1) throw new RangeError(`${name} must be 0..1`);
  }
  requireFinite(state.breath, 'breath');
  if (Math.abs(state.breath) > 1) throw new RangeError('breath must be -1..1');
  const contrast = requireFinite(state.config.featherContrast, 'featherContrast');
  if (contrast < 0 || contrast > 1) throw new RangeError('featherContrast must be 0..1');
  const motion = state.presentation ?? OWL_REST_PRESENTATION;
  const motionBounds = { headRollDeg: [-12, 12], airborne: [0, 1], lift: [0, .60], travel: [-.48, .48],
    bankDeg: [-5, 5], crouch: [0, .08], wingSweep: [-1, 1], tailFan: [0, 1], feetReach: [0, 1] } as const;
  for (const name of Object.keys(motionBounds) as (keyof typeof motionBounds)[]) {
    const n = requireFinite(motion[name], name), [lo, hi] = motionBounds[name];
    if (n < lo || n > hi) throw new RangeError(`${name} exceeds the Owl presentation bounds`);
  }
  const surfaces: OwlSurface[] = [];
  function add(part: OwlPart, material: OwlMaterial, cx: number, cy: number, rx: number, ry: number,
    z: number, tone: number, rotation = 0, depth = .015, pattern = 0, shape: OwlSurface['shape'] = 'ellipse') {
    if (surfaces.length >= OWL_SURFACE_LIMIT) throw new RangeError('Owl surface budget exceeded');
    surfaces.push(Object.freeze({ shape, part, material, cx, cy, rx, ry, z, tone, rotation, depth, pattern }));
  }
  const pair = (x: number, y: number): readonly [number, number] => Object.freeze([x, y]);
  const root = pair(0, .30);
  const neck = pair(0, -.15);
  const footLeft = pair(-.18, .915);
  const footRight = pair(.18, .915);

  // Tail and branch sit behind planted feet. Branch is a scene part, not owl ownership.
  add('tail', 'feather', -.07 - motion.tailFan * .05, .88, .078, .17, -.20, .43, .10 + motion.tailFan * .3, .03, 2);
  add('tail', 'feather', .06 + motion.tailFan * .05, .88, .078, .17, -.19, .49, -.08 - motion.tailFan * .3, .03, 2);
  add('perch', 'wood', -.015, .995, 1.075, .037, -.08, .47, -.012, .025, 3);
  add('perch', 'wood', .73, .918, .25, .022, -.081, .37, -.34, .018, 3);
  add('perch', 'wood', -.82, 1.046, .19, .018, -.082, .34, .36, .015, 3);
  add('perch', 'wood', .87, .827, .073, .039, -.079, .55, -.55, .005, 9, 'diamond');
  add('perch', 'wood', -.83, 1.105, .066, .035, -.079, .55, .50, .005, 9, 'diamond');

  // Lantern Warden: a broad, low breast overlaps the head. Five deliberate
  // breast marks replace a field of feather shading; the volume is still real
  // sampled geometry, including the quiet spaces inside its graphic contour.
  const expansion = 1 + state.ruffle * .025 + state.breath * .003;
  add('body', 'feather', 0, .315, .555 * expansion, .565, 0, .48, 0, .10, 0);
  add('body', 'feather', 0, .365, .357 * expansion, .450, .14, .68, 0, .035, 0);
  for (const [x, y] of [[-.14, .37], [.14, .37], [0, .52], [-.12, .67], [.12, .67]]) {
    add('body', 'feather', x!, y!, .043, .041, .285, .56, 0, .005, 6, 'diamond');
  }
  // The attached side feathers only widen the silhouette during a ruffle.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      const y = .30 + row * .20;
      const width = .555 * Math.sqrt(Math.max(.05, 1 - ((y - .315) / .565) ** 2));
      add('body', 'feather', side * (width - .026), y,
        .035 + state.ruffle * .025, .083, .05, .48,
        side * (.18 + state.ruffle * .24), .012, 0);
    }
  }

  // A wing rotates about a fixed shoulder. Feathers share that same local frame.
  function wing(side: -1 | 1, extension: number): readonly [number, number] {
    const part: OwlPart = side < 0 ? 'wing-left' : 'wing-right';
    // A shallow swept arc gives the flight a clear line of action. Keeping
    // both wings exactly horizontal made their low-resolution contours read
    // as rectangular paddles rather than rounded flight feathers.
    const angle = (7 + extension * 48 + motion.airborne * 22 + motion.wingSweep * 40) * radians;
    const shoulderX = side * .324, shoulderY = -.014;
    const dx = side * Math.sin(angle), dy = Math.cos(angle);
    const length = .69 + motion.airborne * .43;
    const rotation = -side * angle;
    add(part, 'feather', shoulderX + dx * length * .44, shoulderY + dy * length * .44,
      .132 + motion.airborne * .155, length * .56, .205, .40, rotation, .048, 2);
    for (let feather = 0; feather < 3; feather++) {
      const across = side * (feather - 1) * (.055 + motion.airborne * .047);
      const along = length * (.54 + feather * .035);
      const x = shoulderX + dx * along + Math.cos(angle) * across;
      const y = shoulderY + dy * along - side * Math.sin(angle) * across;
      add(part, 'feather', x, y, .055 + motion.airborne * .030, length * (.39 - feather * .03),
        .263 + feather * .002, .43 + feather * .048, rotation + side * (feather - 1) * motion.airborne * .05, .008, 2);
    }
    // Lesser coverts sit over the roots of the long feathers. The connected
    // shoulder pad keeps the wing readable as one surface even while braking.
    add(part, 'feather', shoulderX + dx * length * .21, shoulderY + dy * length * .21,
      .119 + motion.airborne * .085, length * .28, .29, .56, rotation, .014, 4);
    // The rounded trailing edge is built from overlapping secondaries. It
    // broadens the inner wing instead of adding a row of detached finger tips.
    if (motion.airborne > 0) for (let feather = 0; feather < 3; feather++) {
      const along = length * (.27 + feather * .15);
      const behind = .12 + Math.sin((feather + 1) * Math.PI / 4) * .12;
      add(part, 'feather', shoulderX + dx * along - Math.cos(angle) * side * behind,
        shoulderY + dy * along + Math.sin(angle) * behind,
        .078 * motion.airborne, length * .24 * motion.airborne, .253, .49 + feather * .055, rotation + side * .1,
        .009, 2);
    }
    return pair(shoulderX + dx * length, shoulderY + dy * length);
  }
  const wingTipLeft = wing(-1, state.leftWing);
  const wingTipRight = wing(1, state.rightWing);

  for (const side of [-1, 1]) {
    const part: OwlPart = side < 0 ? 'foot-left' : 'foot-right';
    const tuck = motion.airborne * (1 - motion.feetReach) * .12;
    const reach = motion.feetReach * .055;
    add(part, 'feather', side * .18, .839 - tuck + reach, .07, .096, .30, .61, 0, .025, 0);
    for (const offset of [-.045, 0, .045]) {
      add(part, 'foot', side * .18 + offset, .915 - tuck + reach, .017, .068,
        .40, .82, offset * -2.0, .01);
      add(part, 'foot', side * .18 + offset, .969 - tuck + reach, .019, .026,
        .415, .47, -.10 * side, .005, 0, 'diamond');
    }
  }

  // A fixed-in-head face is projected orthographically with conservative yaw/pitch.
  // A little lateral projection comes from the face being ahead of its neck pivot;
  // the body root and shoulder coordinates do not move with attention.
  const yawRad = yaw * radians, pitchRad = pitch * radians;
  const yawScale = Math.cos(yawRad), pitchScale = Math.cos(pitchRad);
  const headX = Math.sin(yawRad) * .13;
  const headY = -.280 + Math.sin(pitchRad) * .075;
  const faceRotation = Math.sin(yawRad) * .045;
  add('head', 'feather', headX, headY, .595 * (.90 + .10 * yawScale), .495,
    .34, .45, faceRotation, .055, 0);
  add('face', 'disk', headX + Math.sin(yawRad) * .018, headY + .012,
    .520 * yawScale, .413 * pitchScale, .455, .40, faceRotation, .022, 0);

  // Two disk lobes preserve broad facial structure without adding mammal-like ears.
  for (const side of [-1, 1]) {
    const localX = side * .235;
    add('face', 'disk', headX + localX * yawScale, headY + .025 + localX * faceRotation,
      .257 * yawScale, .330 * pitchScale, .515 - side * Math.sin(yawRad) * .018,
      .74, faceRotation, .018, 0);
  }
  const eyePositions: (readonly [number, number])[] = [];
  for (const side of [-1, 1]) {
    const eyePart: OwlPart = side < 0 ? 'eye-left' : 'eye-right';
    const pupilPart: OwlPart = side < 0 ? 'pupil-left' : 'pupil-right';
    const x = headX + side * .235 * yawScale + Math.sin(yawRad) * .035;
    const y = headY - .040 + Math.sin(pitchRad) * .030 + side * .235 * faceRotation;
    const depth = .57 - side * Math.sin(yawRad) * .018;
    const eyeWidth = .165 * yawScale;
    const open = 1 - state.blink;
    eyePositions.push(pair(x, y));
    // The upper/lower eye contour compresses into a lid, while its center and
    // both orbital landmarks stay attached to the turning facial disc.
    add(eyePart, 'feather', x, y, eyeWidth + .025, .043 + .131 * open, depth, .33, faceRotation, .004);
    add(eyePart, 'eye', x, y, eyeWidth, Math.max(.008, .147 * open), depth + .015,
      .60, faceRotation, .006);
    if (open > .15) {
      add(pupilPart, 'pupil', x, y + .008 * open, eyeWidth * .66, .132 * open,
        depth + .035, 0, faceRotation, .002);
      // Fixed highlight, not a detached eye that follows the pointer.
      add(pupilPart, 'highlight', x - .033 * yawScale, y - .045 * open,
        .026 * yawScale, .030 * open, depth + .045, 1, 0, .001);
    } else {
      add(eyePart, 'eye', x, y, eyeWidth, .035, depth + .040, .72, faceRotation, .001);
    }
    // These are feather ridges over the facial discs, never mammal-like ears.
    // The near ridge rises with attention; the far one lowers in concentration.
    // Their geometry stays attached to the head through a turn or listening cant.
    const attentive = Math.abs(yaw) / 45;
    const near = side * Math.sin(yawRad);
    const browLift = .018 + near * .045 + Math.max(0, -pitch) / 20 * .020;
    const browAngle = side * (-.11 - state.blink * .13) - near * .20;
    add('face', 'disk', x - side * .004, y - .188 - browLift, .177 * yawScale, .029,
      depth + .055, .77, browAngle + faceRotation, .004, 7);
    // A short lower disc crease lets a stronger turn read without a new texture.
    if (attentive > .15) add('face', 'disk', x + side * .012, y + .208, .09 * yawScale,
      .012 + attentive * .005, depth + .006, .52, side * .22 + faceRotation, .002, 8);
  }
  const beakX = headX + Math.sin(yawRad) * .072;
  const beakY = headY + .147 + Math.sin(pitchRad) * .025;
  add('beak', 'beak', beakX, beakY, .065 * yawScale, .100 * pitchScale,
    .665, .59, faceRotation, .02, 0, 'diamond');
  add('beak', 'beak', beakX, beakY + .042, .025 * yawScale, .062,
    .689, .24, faceRotation, .007, 0, 'diamond');

  const bank = motion.bankDeg * radians, roll = motion.headRollDeg * radians;
  let scale = 1 - motion.airborne * .32;
  const isFace = (part: OwlPart) => ['head', 'face', 'eye-left', 'eye-right', 'pupil-left', 'pupil-right', 'beak'].includes(part);
  const headPoint = (x: number, y: number): readonly [number, number] => pair(
    headX + (x - headX) * Math.cos(roll) - (y - headY) * Math.sin(roll),
    headY + (x - headX) * Math.sin(roll) + (y - headY) * Math.cos(roll));
  const forwardPitch = .28 * motion.airborne * (1 - motion.feetReach);
  const bodyPoint = (x: number, y: number, torso = false): readonly [number, number] => {
    // Frontal glide foreshortens the belly/tail; braking restores an upright
    // body as both feet reach. Wing roots keep the same shoulder transform.
    const axialY = torso ? -.014 + (y + .014) * (1 - forwardPitch) : y;
    const py = .915 + (axialY - .915) * (1 - motion.crouch) - .30;
    return pair(motion.travel + (x * Math.cos(bank) - py * Math.sin(bank)) * scale,
      .30 - motion.lift + (x * Math.sin(bank) + py * Math.cos(bank)) * scale);
  };
  const transform = (point: readonly [number, number], head = false, torso = false) => {
    const p = head ? headPoint(point[0], point[1]) : point;
    return bodyPoint(p[0], p[1], torso);
  };
  const moving = state.presentation !== undefined;
  if (moving) {
    // Travel is a real body excursion inside the fixed camera. A broad wing
    // passes farther into depth as the owl leaves its central perch, keeping
    // both the face and the attached wing tips in the minimum specimen window.
    // Fit the projected body, never the branch or camera, with a clear border.
    let fit = 1;
    for (const surface of surfaces) {
      if (surface.part === 'perch') continue;
      const torso = ['body', 'tail', 'foot-left', 'foot-right'].includes(surface.part);
      const face = isFace(surface.part);
      const point = transform(pair(surface.cx, surface.cy), face, torso);
      const rotation = surface.rotation + bank + (face ? roll : 0);
      const rx = surface.rx * scale;
      const ry = surface.ry * scale * (1 - motion.crouch) * (torso ? 1 - forwardPitch : 1);
      const halfWidth = Math.abs(Math.cos(rotation)) * rx + Math.abs(Math.sin(rotation)) * ry;
      const halfHeight = Math.abs(Math.sin(rotation)) * rx + Math.abs(Math.cos(rotation)) * ry;
      const x = point[0] - motion.travel, y = point[1] - (.30 - motion.lift);
      if (x + halfWidth > 0) fit = Math.min(fit, (1.075 - motion.travel) / (x + halfWidth));
      if (-x + halfWidth > 0) fit = Math.min(fit, (1.075 + motion.travel) / (-x + halfWidth));
      if (-y + halfHeight > 0) fit = Math.min(fit, (1.445 - motion.lift) / (-y + halfHeight));
      if (y + halfHeight > 0) fit = Math.min(fit, (.88 + motion.lift) / (y + halfHeight));
    }
    scale *= fit;
  }
  const transformed = moving ? surfaces.map(surface => {
    if (surface.part === 'perch') return surface; // The landing target never follows the bird.
    const torso = ['body', 'tail', 'foot-left', 'foot-right'].includes(surface.part);
    const point = transform(pair(surface.cx, surface.cy), isFace(surface.part), torso);
    return Object.freeze({ ...surface, cx: point[0], cy: point[1], rx: surface.rx * scale,
      ry: surface.ry * scale * (1 - motion.crouch) * (torso ? 1 - forwardPitch : 1), rotation: surface.rotation + bank + (isFace(surface.part) ? roll : 0) });
  }) : surfaces;
  const footMotion = -.12 * motion.airborne * (1 - motion.feetReach) + .055 * motion.feetReach;
  const landmarks: OwlLandmarks = Object.freeze({ root: moving ? transform(root, false, true) : root, neck: moving ? transform(neck) : neck,
    shoulderLeft: moving ? transform(pair(-.324, -.014)) : pair(-.324, -.014),
    shoulderRight: moving ? transform(pair(.324, -.014)) : pair(.324, -.014),
    wingTipLeft: moving ? transform(wingTipLeft) : wingTipLeft, wingTipRight: moving ? transform(wingTipRight) : wingTipRight,
    footLeft: moving ? transform(pair(footLeft[0], footLeft[1] + footMotion), false, true) : footLeft,
    footRight: moving ? transform(pair(footRight[0], footRight[1] + footMotion), false, true) : footRight,
    eyeLeft: moving ? transform(eyePositions[0]!, true) : eyePositions[0]!,
    eyeRight: moving ? transform(eyePositions[1]!, true) : eyePositions[1]! });
  return Object.freeze({ surfaces: Object.freeze(transformed), landmarks });
}

/** Owl-specific material shading, sampled in each original surface's local frame. */
export function owlSurfaceTone(surface: OwlSurface, u: number, v: number, dome: number, contrast: number): number {
  if (surface.material === 'pupil') return 0;
  if (surface.material === 'highlight') return 1;
  const relief = surface.material === 'eye' ? .01 : (dome - .55) * .13 - u * .025;
  let pattern = 0;
  if (surface.pattern === 1) {
    // Local plumage: irregular looking but deterministic vertical belly bars.
    const stripe = Math.cos(u * 29 + Math.sin(v * 10) * .65);
    pattern = (stripe > .50 ? -.20 : .035) * contrast;
  } else if (surface.pattern === 2) {
    pattern = (Math.cos(v * 23 + u * 1.7) > .3 ? -.16 : .065) * contrast;
  } else if (surface.pattern === 3) {
    pattern = Math.sin(u * 23 + v * 2) * .07;
  } else if (surface.pattern === 4) {
    // Fine shaft and scalloped tip: material follows the feather's own frame.
    const shaft = Math.abs(u) < .10 ? -.15 : .015;
    const edge = v > .38 && Math.abs(u) > .15 ? -.10 : 0;
    pattern = (shaft + edge + Math.cos(v * 18 + Math.abs(u) * 7) * .045) * contrast;
  } else if (surface.pattern === 5) {
    const radius = Math.hypot(u, v), angle = Math.atan2(v, u);
    const fine = Math.cos(angle * 22 + radius * 4) * .045;
    pattern = (fine - Math.max(0, radius - .7) * .24) * contrast;
  }
  return clamp(surface.tone + relief + pattern, .015, 1);
}
