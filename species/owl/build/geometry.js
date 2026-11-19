import { OWL_REST_PRESENTATION } from './choreography.js';
/** Original owl-local analytic surfaces. No renderer, clock, randomness or DOM. */
export const OWL_SURFACE_LIMIT = 96;
const radians = Math.PI / 180;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function requireFinite(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        throw new TypeError(`${name} must be finite`);
    return value;
}
/** Both modest turning views retain the two facial landmarks. Full profile is not modeled. */
export function buildOwlGeometry(state) {
    if (!state || state.species !== 'owl' || state.version !== 1)
        throw new TypeError('Expected Owl state version 1');
    const yaw = requireFinite(state.headYawDeg, 'headYawDeg');
    const pitch = requireFinite(state.headPitchDeg, 'headPitchDeg');
    if (Math.abs(yaw) > 45 || Math.abs(pitch) > 20)
        throw new RangeError('Owl pose exceeds supported head bounds');
    const values = ['blink', 'ruffle', 'leftWing', 'rightWing'];
    for (const name of values) {
        requireFinite(state[name], name);
        if (state[name] < 0 || state[name] > 1)
            throw new RangeError(`${name} must be 0..1`);
    }
    requireFinite(state.breath, 'breath');
    if (Math.abs(state.breath) > 1)
        throw new RangeError('breath must be -1..1');
    const contrast = requireFinite(state.config.featherContrast, 'featherContrast');
    if (contrast < 0 || contrast > 1)
        throw new RangeError('featherContrast must be 0..1');
    const motion = state.presentation ?? OWL_REST_PRESENTATION;
    const motionBounds = { headRollDeg: [-12, 12], airborne: [0, 1], lift: [0, .5], travel: [-.06, .06],
        bankDeg: [-5, 5], crouch: [0, .08], wingSweep: [-1, 1], tailFan: [0, 1], feetReach: [0, 1] };
    for (const name of Object.keys(motionBounds)) {
        const n = requireFinite(motion[name], name), [lo, hi] = motionBounds[name];
        if (n < lo || n > hi)
            throw new RangeError(`${name} exceeds the Owl presentation bounds`);
    }
    const surfaces = [];
    function add(part, material, cx, cy, rx, ry, z, tone, rotation = 0, depth = .015, pattern = 0, shape = 'ellipse') {
        if (surfaces.length >= OWL_SURFACE_LIMIT)
            throw new RangeError('Owl surface budget exceeded');
        surfaces.push(Object.freeze({ shape, part, material, cx, cy, rx, ry, z, tone, rotation, depth, pattern }));
    }
    const pair = (x, y) => Object.freeze([x, y]);
    const root = pair(0, .30);
    const neck = pair(0, -.15);
    const footLeft = pair(-.18, .915);
    const footRight = pair(.18, .915);
    // Tail and branch sit behind planted feet. Branch is a scene part, not owl ownership.
    add('tail', 'feather', -.07 - motion.tailFan * .05, .85, .082, .245, -.20, .43, .10 + motion.tailFan * .3, .03, 2);
    add('tail', 'feather', .06 + motion.tailFan * .05, .85, .082, .245, -.19, .49, -.08 - motion.tailFan * .3, .03, 2);
    add('perch', 'wood', -.015, .995, 1.075, .037, -.08, .47, -.012, .025, 3);
    add('perch', 'wood', .73, .918, .25, .022, -.081, .37, -.34, .018, 3);
    add('perch', 'wood', -.82, 1.046, .19, .018, -.082, .34, .36, .015, 3);
    const expansion = 1 + state.ruffle * .035 + state.breath * .003;
    add('body', 'feather', 0, .285, .431 * expansion, .602, 0, .48, 0, .18, 1);
    add('body', 'feather', 0, .276, .315 * expansion, .537, .14, .68, 0, .085, 1);
    // Broad overlapping contour feathers, not an added screen-space hatch.
    // Each lower tier covers the roots above it; the breast keeps a soft taper.
    for (let row = 0; row < 3; row++) {
        for (let feather = 0; feather < 3; feather++) {
            const x = (feather - 1) * (.16 - row * .015) + (row % 2 ? .018 : 0);
            add('body', 'feather', x, .22 + row * .18, .105 - row * .01, .153, .215 + row * .007, .63 + (feather === 1 ? .055 : 0), (feather - 1) * -.13, .018, 4);
        }
    }
    // A short shoulder cape overlaps beneath the chin. Tawny owls are compact;
    // the head must not appear balanced on a narrow, unfeathered neck.
    for (const side of [-1, 1])
        add('body', 'feather', side * .13, .055, .205, .15, .355, .60, side * -.22, .015, 4);
    // Ruffle is a bounded attached contour. All feather roots remain inside the body.
    for (const side of [-1, 1]) {
        for (let row = 0; row < 5; row++) {
            const y = .12 + row * .125;
            const width = .431 * Math.sqrt(Math.max(.05, 1 - ((y - .285) / .602) ** 2));
            add('body', 'feather', side * (width - .026), y, .047 + state.ruffle * .025, .092, .05, .48 + row * .015, side * (.18 + state.ruffle * .30), .02, 0);
        }
    }
    // A wing rotates about a fixed shoulder. Feathers share that same local frame.
    function wing(side, extension) {
        const part = side < 0 ? 'wing-left' : 'wing-right';
        const angle = (7 + extension * 48 + motion.airborne * 38 + motion.wingSweep * 40) * radians;
        const shoulderX = side * .324, shoulderY = -.014;
        const dx = side * Math.sin(angle), dy = Math.cos(angle);
        const length = .69 + motion.airborne * .43;
        const rotation = -side * angle;
        add(part, 'feather', shoulderX + dx * length * .44, shoulderY + dy * length * .44, .132 + motion.airborne * .155, length * .56, .205, .40, rotation, .048, 2);
        for (let feather = 0; feather < 5; feather++) {
            const across = side * (feather - 2) * (.039 + motion.airborne * .033);
            const along = length * (.52 + feather * .027);
            const x = shoulderX + dx * along + Math.cos(angle) * across;
            const y = shoulderY + dy * along - side * Math.sin(angle) * across;
            add(part, 'feather', x, y, .041 + motion.airborne * .025, length * (.39 - feather * .024), .263 + feather * .002, .43 + feather * .048, rotation + side * (feather - 2) * motion.airborne * .045, .008, 2);
        }
        // Lesser coverts sit over the roots of the long feathers. The connected
        // shoulder pad keeps the wing readable as one surface even while braking.
        add(part, 'feather', shoulderX + dx * length * .21, shoulderY + dy * length * .21, .119 + motion.airborne * .085, length * .28, .29, .56, rotation, .014, 4);
        // The rounded trailing edge is built from overlapping secondaries. It
        // broadens the inner wing instead of adding a row of detached finger tips.
        if (motion.airborne > 0)
            for (let feather = 0; feather < 3; feather++) {
                const along = length * (.27 + feather * .15);
                const behind = .12 + Math.sin((feather + 1) * Math.PI / 4) * .12;
                add(part, 'feather', shoulderX + dx * along - Math.cos(angle) * side * behind, shoulderY + dy * along + Math.sin(angle) * behind, .078 * motion.airborne, length * .24 * motion.airborne, .253, .49 + feather * .055, rotation + side * .1, .009, 2);
            }
        return pair(shoulderX + dx * length, shoulderY + dy * length);
    }
    const wingTipLeft = wing(-1, state.leftWing);
    const wingTipRight = wing(1, state.rightWing);
    for (const side of [-1, 1]) {
        const part = side < 0 ? 'foot-left' : 'foot-right';
        const tuck = motion.airborne * (1 - motion.feetReach) * .12;
        const reach = motion.feetReach * .055;
        add(part, 'feather', side * .18, .839 - tuck + reach, .07, .096, .30, .61, 0, .025, 0);
        for (const offset of [-.045, 0, .045]) {
            add(part, 'foot', side * .18 + offset, .915 - tuck + reach, .017, .068, .40, .82, offset * -2.0, .01);
            add(part, 'foot', side * .18 + offset, .969 - tuck + reach, .019, .026, .415, .47, -.10 * side, .005, 0, 'diamond');
        }
    }
    // A fixed-in-head face is projected orthographically with conservative yaw/pitch.
    // A little lateral projection comes from the face being ahead of its neck pivot;
    // the body root and shoulder coordinates do not move with attention.
    const yawRad = yaw * radians, pitchRad = pitch * radians;
    const yawScale = Math.cos(yawRad), pitchScale = Math.cos(pitchRad);
    const headX = Math.sin(yawRad) * .105;
    const headY = -.437 + Math.sin(pitchRad) * .063;
    const faceRotation = Math.sin(yawRad) * .035;
    add('head', 'feather', headX, headY, .540 * (.88 + .12 * yawScale), .448, .34, .45, faceRotation, .085, 4);
    add('face', 'disk', headX + Math.sin(yawRad) * .018, headY + .012, .479 * yawScale, .381 * pitchScale, .455, .40, faceRotation, .040, 5);
    // The sound-gathering ruff belongs to the perimeter of the WHOLE face.
    // These coarse layered feathers frame quieter fine radial disc plumage.
    for (const side of [-1, 1])
        for (let feather = 0; feather < 7; feather++) {
            const a = -.98 + feather * .31;
            const x = headX + side * Math.cos(a) * .438 * yawScale;
            const y = headY + .015 + Math.sin(a) * .333 * pitchScale;
            add('face', 'feather', x, y, .047 * yawScale, .089, .493, .51 + (feather % 3) * .035, side * (Math.PI / 2 - a), .009, 4);
        }
    // Two disk lobes preserve broad facial structure without adding mammal-like ears.
    for (const side of [-1, 1]) {
        const localX = side * .205;
        add('face', 'disk', headX + localX * yawScale, headY + .018 + localX * faceRotation, .221 * yawScale, .292 * pitchScale, .515 - side * Math.sin(yawRad) * .018, .74, faceRotation, .025, 5);
    }
    const eyePositions = [];
    for (const side of [-1, 1]) {
        const eyePart = side < 0 ? 'eye-left' : 'eye-right';
        const pupilPart = side < 0 ? 'pupil-left' : 'pupil-right';
        const x = headX + side * .204 * yawScale + Math.sin(yawRad) * .035;
        const y = headY - .035 + Math.sin(pitchRad) * .025 + side * .204 * faceRotation;
        const depth = .57 - side * Math.sin(yawRad) * .018;
        const eyeWidth = .122 * yawScale;
        const open = 1 - state.blink;
        eyePositions.push(pair(x, y));
        // Feathered orbital ring is always present; eye openings close within it.
        add(eyePart, 'feather', x, y, eyeWidth + .021, .128, depth, .33, faceRotation, .004);
        add(eyePart, 'eye', x, y, eyeWidth, Math.max(.008, .104 * open), depth + .015, .60, faceRotation, .006);
        if (open > .15) {
            add(pupilPart, 'pupil', x, y + .008 * open, eyeWidth * .60, .090 * open, depth + .035, 0, faceRotation, .002);
            // Fixed highlight, not a detached eye that follows the pointer.
            add(pupilPart, 'highlight', x - .024 * yawScale, y - .028 * open, .017 * yawScale, .018 * open, depth + .045, 1, 0, .001);
        }
        else {
            add(eyePart, 'eye', x, y, eyeWidth, .010, depth + .040, .72, faceRotation, .001);
        }
        // Short upper feather ridge, with no tuft outside the rounded head silhouette.
        add('face', 'disk', x - side * .008, y - .123, .144 * yawScale, .037, depth + .008, .77, side * -.17 + faceRotation, .004, 5);
    }
    const beakX = headX + Math.sin(yawRad) * .072;
    const beakY = headY + .122 + Math.sin(pitchRad) * .025;
    add('beak', 'beak', beakX, beakY, .052 * yawScale, .103 * pitchScale, .665, .59, faceRotation, .02, 0, 'diamond');
    add('beak', 'beak', beakX, beakY + .042, .025 * yawScale, .062, .689, .24, faceRotation, .007, 0, 'diamond');
    const scale = 1 - motion.airborne * .32, bank = motion.bankDeg * radians, roll = motion.headRollDeg * radians;
    const isFace = (part) => ['head', 'face', 'eye-left', 'eye-right', 'pupil-left', 'pupil-right', 'beak'].includes(part);
    const headPoint = (x, y) => pair(headX + (x - headX) * Math.cos(roll) - (y - headY) * Math.sin(roll), headY + (x - headX) * Math.sin(roll) + (y - headY) * Math.cos(roll));
    const forwardPitch = .28 * motion.airborne * (1 - motion.feetReach);
    const bodyPoint = (x, y, torso = false) => {
        // Frontal glide foreshortens the belly/tail; braking restores an upright
        // body as both feet reach. Wing roots keep the same shoulder transform.
        const axialY = torso ? -.014 + (y + .014) * (1 - forwardPitch) : y;
        const py = .915 + (axialY - .915) * (1 - motion.crouch) - .30;
        return pair(motion.travel + (x * Math.cos(bank) - py * Math.sin(bank)) * scale, .30 - motion.lift + (x * Math.sin(bank) + py * Math.cos(bank)) * scale);
    };
    const transform = (point, head = false, torso = false) => {
        const p = head ? headPoint(point[0], point[1]) : point;
        return bodyPoint(p[0], p[1], torso);
    };
    const moving = state.presentation !== undefined;
    const transformed = moving ? surfaces.map(surface => {
        if (surface.part === 'perch')
            return surface; // The landing target never follows the bird.
        const torso = ['body', 'tail', 'foot-left', 'foot-right'].includes(surface.part);
        const point = transform(pair(surface.cx, surface.cy), isFace(surface.part), torso);
        return Object.freeze({ ...surface, cx: point[0], cy: point[1], rx: surface.rx * scale,
            ry: surface.ry * scale * (1 - motion.crouch) * (torso ? 1 - forwardPitch : 1), rotation: surface.rotation + bank + (isFace(surface.part) ? roll : 0) });
    }) : surfaces;
    const footMotion = -.12 * motion.airborne * (1 - motion.feetReach) + .055 * motion.feetReach;
    const landmarks = Object.freeze({ root: moving ? transform(root, false, true) : root, neck: moving ? transform(neck) : neck,
        shoulderLeft: moving ? transform(pair(-.324, -.014)) : pair(-.324, -.014),
        shoulderRight: moving ? transform(pair(.324, -.014)) : pair(.324, -.014),
        wingTipLeft: moving ? transform(wingTipLeft) : wingTipLeft, wingTipRight: moving ? transform(wingTipRight) : wingTipRight,
        footLeft: moving ? transform(pair(footLeft[0], footLeft[1] + footMotion), false, true) : footLeft,
        footRight: moving ? transform(pair(footRight[0], footRight[1] + footMotion), false, true) : footRight,
        eyeLeft: moving ? transform(eyePositions[0], true) : eyePositions[0],
        eyeRight: moving ? transform(eyePositions[1], true) : eyePositions[1] });
    return Object.freeze({ surfaces: Object.freeze(transformed), landmarks });
}
/** Owl-specific material shading, sampled in each original surface's local frame. */
export function owlSurfaceTone(surface, u, v, dome, contrast) {
    if (surface.material === 'pupil')
        return 0;
    if (surface.material === 'highlight')
        return 1;
    const relief = surface.material === 'eye' ? .01 : (dome - .55) * .13 - u * .025;
    let pattern = 0;
    if (surface.pattern === 1) {
        // Local plumage: irregular looking but deterministic vertical belly bars.
        const stripe = Math.cos(u * 29 + Math.sin(v * 10) * .65);
        pattern = (stripe > .50 ? -.20 : .035) * contrast;
    }
    else if (surface.pattern === 2) {
        pattern = (Math.cos(v * 23 + u * 1.7) > .3 ? -.16 : .065) * contrast;
    }
    else if (surface.pattern === 3) {
        pattern = Math.sin(u * 23 + v * 2) * .07;
    }
    else if (surface.pattern === 4) {
        // Fine shaft and scalloped tip: material follows the feather's own frame.
        const shaft = Math.abs(u) < .10 ? -.15 : .015;
        const edge = v > .38 && Math.abs(u) > .15 ? -.10 : 0;
        pattern = (shaft + edge + Math.cos(v * 18 + Math.abs(u) * 7) * .045) * contrast;
    }
    else if (surface.pattern === 5) {
        const radius = Math.hypot(u, v), angle = Math.atan2(v, u);
        const fine = Math.cos(angle * 22 + radius * 4) * .045;
        pattern = (fine - Math.max(0, radius - .7) * .24) * contrast;
    }
    return clamp(surface.tone + relief + pattern, .015, 1);
}
