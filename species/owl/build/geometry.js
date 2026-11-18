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
    add('tail', 'feather', -.07, .85, .082, .245, -.20, .43, .10, .03, 2);
    add('tail', 'feather', .06, .85, .082, .245, -.19, .49, -.08, .03, 2);
    add('perch', 'wood', -.015, .995, 1.075, .037, -.08, .47, -.012, .025, 3);
    add('perch', 'wood', .73, .918, .25, .022, -.081, .37, -.34, .018, 3);
    add('perch', 'wood', -.82, 1.046, .19, .018, -.082, .34, .36, .015, 3);
    const expansion = 1 + state.ruffle * .035 + state.breath * .003;
    add('body', 'feather', 0, .285, .431 * expansion, .602, 0, .48, 0, .18, 1);
    add('body', 'feather', 0, .276, .315 * expansion, .537, .14, .68, 0, .085, 1);
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
        const angle = (7 + extension * 48) * radians;
        const shoulderX = side * .324, shoulderY = -.014;
        const dx = side * Math.sin(angle), dy = Math.cos(angle);
        const length = .69;
        const rotation = -side * angle;
        add(part, 'feather', shoulderX + dx * length * .44, shoulderY + dy * length * .44, .132, length * .56, .205, .40, rotation, .048, 2);
        for (let feather = 0; feather < 4; feather++) {
            const across = (feather - 1.5) * .045;
            const along = .365 + feather * .019;
            const x = shoulderX + dx * along + Math.cos(angle) * across;
            const y = shoulderY + dy * along - side * Math.sin(angle) * across;
            add(part, 'feather', x, y, .035, .278 - feather * .015, .263 + feather * .002, .43 + feather * .07, rotation, .008, 2);
        }
        return pair(shoulderX + dx * length, shoulderY + dy * length);
    }
    const wingTipLeft = wing(-1, state.leftWing);
    const wingTipRight = wing(1, state.rightWing);
    for (const side of [-1, 1]) {
        const part = side < 0 ? 'foot-left' : 'foot-right';
        add(part, 'feather', side * .18, .839, .07, .096, .30, .61, 0, .025, 0);
        for (const offset of [-.045, 0, .045]) {
            add(part, 'foot', side * .18 + offset, .915, .017, .068, .40, .82, offset * -2.0, .01);
            add(part, 'foot', side * .18 + offset, .969, .019, .026, .415, .47, -.10 * side, .005, 0, 'diamond');
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
    add('head', 'feather', headX, headY, .540 * (.88 + .12 * yawScale), .448, .34, .48, faceRotation, .085, 0);
    add('face', 'disk', headX + Math.sin(yawRad) * .018, headY + .012, .479 * yawScale, .381 * pitchScale, .455, .77, faceRotation, .040, 0);
    // Two disk lobes preserve broad facial structure without adding mammal-like ears.
    for (const side of [-1, 1]) {
        const localX = side * .205;
        add('face', 'disk', headX + localX * yawScale, headY + .018 + localX * faceRotation, .225 * yawScale, .294 * pitchScale, .49 - side * Math.sin(yawRad) * .018, .81, faceRotation, .025, 0);
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
        add(eyePart, 'feather', x, y, eyeWidth + .034, .137, depth, .40, faceRotation, .004);
        add(eyePart, 'eye', x, y, eyeWidth, Math.max(.008, .104 * open), depth + .015, .94, faceRotation, .006);
        if (open > .15) {
            add(pupilPart, 'pupil', x, y + .008 * open, eyeWidth * .60, .090 * open, depth + .035, 0, faceRotation, .002);
            // Fixed highlight, not a detached eye that follows the pointer.
            add(pupilPart, 'highlight', x - .024 * yawScale, y - .028 * open, .017 * yawScale, .018 * open, depth + .045, 1, 0, .001);
        }
        else {
            add(eyePart, 'eye', x, y, eyeWidth, .010, depth + .040, .72, faceRotation, .001);
        }
        // Short upper feather ridge, with no tuft outside the rounded head silhouette.
        add('face', 'disk', x - side * .008, y - .123, .144 * yawScale, .037, depth + .008, .92, side * -.17 + faceRotation, .004);
    }
    const beakX = headX + Math.sin(yawRad) * .072;
    const beakY = headY + .122 + Math.sin(pitchRad) * .025;
    add('beak', 'beak', beakX, beakY, .052 * yawScale, .103 * pitchScale, .665, .59, faceRotation, .02, 0, 'diamond');
    add('beak', 'beak', beakX, beakY + .042, .025 * yawScale, .062, .689, .24, faceRotation, .007, 0, 'diamond');
    const landmarks = Object.freeze({ root, neck,
        shoulderLeft: pair(-.324, -.014), shoulderRight: pair(.324, -.014),
        wingTipLeft, wingTipRight, footLeft, footRight,
        eyeLeft: eyePositions[0], eyeRight: eyePositions[1] });
    return Object.freeze({ surfaces: Object.freeze(surfaces), landmarks });
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
    return clamp(surface.tone + relief + pattern, .015, 1);
}
