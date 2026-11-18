/** Original, species-local geometry. No renderer, clock, assets, or font reads. */
export const PUFFERFISH_MAX_SAMPLES = 16_000;
export const PUFFERFISH_SPINES = 42;
const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const smooth = (n) => {
    const x = clamp(n, 0, 1);
    return x * x * (3 - 2 * x);
};
function checkPoseState(state) {
    if (!state || state.version !== 'pufferfish-v1')
        throw new TypeError('Expected pufferfish-v1 state');
    if (!Number.isSafeInteger(state.tick) || state.tick < 0)
        throw new RangeError('tick must be a nonnegative safe integer');
    if (!Number.isFinite(state.inflation) || state.inflation < 0 || state.inflation > 1)
        throw new RangeError('inflation must be 0..1');
    if (!Number.isFinite(state.variation) || state.variation < 0 || state.variation >= TAU)
        throw new RangeError('variation must be radians in [0, 2*pi)');
    if (!state.config || !Number.isFinite(state.config.inflationScale)
        || state.config.inflationScale < 1.3 || state.config.inflationScale > 1.8)
        throw new RangeError('inflationScale must be 1.3..1.8');
    if (!Number.isFinite(state.config.wobble) || state.config.wobble < 0 || state.config.wobble > 1)
        throw new RangeError('wobble must be 0..1');
}
/** Body pose is applied by the adapter once; geometry stays in local coordinates.
 * Appendage phases run continuously through behavior changes. staticPose freezes
 * all phases at tick zero without changing the chosen inflation amount.
 */
export function posePufferfish(state, staticPose = false) {
    checkPoseState(state);
    if (typeof staticPose !== 'boolean')
        throw new TypeError('staticPose must be boolean');
    const seconds = (staticPose ? 0 : state.tick) / 60;
    // createPufferfish stores the seeded phase in radians, not a unit fraction.
    const phase = state.variation;
    const inflation = state.inflation;
    const strength = state.config.wobble;
    return Object.freeze({
        inflation,
        scale: 1 + (state.config.inflationScale - 1) * inflation,
        bob: strength * (Math.sin(seconds * 1.1 + phase) * 0.035
            + Math.sin(seconds * 1.7 + phase * 0.7) * 0.028 * inflation),
        roll: strength * (Math.sin(seconds * 0.85 + phase + 0.3) * 0.019
            + Math.sin(seconds * 1.55 + phase * 0.8) * 0.034 * inflation),
        leftFin: Math.sin(seconds * 4.1 + phase) * 0.78,
        rightFin: Math.sin(seconds * 4.1 + phase + 0.73) * 0.64,
        tail: Math.sin(seconds * 2.4 + phase + 0.26) * 0.085,
    });
}
/** A bounded closed ellipsoid, attached fans, raised eyes, a lip and 42 cones.
 * +z faces the observer; y points down. The painter owns camera/view/projection.
 * Every shape is authored parametrically here; no ASCII drawing is embedded.
 */
export function samplePufferfish(state, sink, options = {}) {
    if (typeof sink !== 'function')
        throw new TypeError('A geometry sink is required');
    if (!options || typeof options !== 'object' || Array.isArray(options))
        throw new TypeError('Invalid sample options');
    for (const key of Object.keys(options)) {
        if (!['quality', 'monochrome', 'staticPose', 'gaze', 'finEffort'].includes(key))
            throw new TypeError(`Unknown sample option: ${key}`);
    }
    const quality = options.quality ?? 'standard';
    if (!['small', 'standard', 'fine'].includes(quality))
        throw new TypeError('Unknown geometry quality');
    if (options.monochrome !== undefined && typeof options.monochrome !== 'boolean')
        throw new TypeError('monochrome must be boolean');
    if (Object.hasOwn(options, 'gaze') && options.gaze === undefined)
        throw new TypeError('gaze cannot be undefined');
    const gaze = options.gaze === undefined ? { x: 0, y: 0 } : options.gaze;
    if (!gaze || typeof gaze !== 'object' || Array.isArray(gaze)
        || Object.keys(gaze).some(key => key !== 'x' && key !== 'y')
        || !Number.isFinite(gaze.x) || !Number.isFinite(gaze.y)
        || Math.abs(gaze.x) > 1 || Math.abs(gaze.y) > 1)
        throw new RangeError('gaze requires finite x/y in -1..1');
    if (Object.hasOwn(options, 'finEffort') && options.finEffort === undefined)
        throw new TypeError('finEffort cannot be undefined');
    const finEffort = options.finEffort === undefined ? 0 : options.finEffort;
    if (typeof finEffort !== 'number' || !Number.isFinite(finEffort) || finEffort < 0 || finEffort > 1)
        throw new RangeError('finEffort must be finite in 0..1');
    const pose = posePufferfish(state, options.staticPose ?? false);
    const detail = quality === 'small' ? 0 : quality === 'fine' ? 2 : 1;
    const latitudes = [28, 44, 60][detail];
    const longitudes = [56, 88, 120][detail];
    const eyeRings = [9, 13, 17][detail];
    const eyeSegments = [22, 30, 38][detail];
    const fanSteps = [9, 13, 17][detail];
    const fanRays = [14, 18, 24][detail];
    const coneSteps = [4, 5, 6][detail];
    const coneSides = 5;
    const rx = 0.92 * pose.scale, ry = 0.78 * pose.scale, rz = 0.72 * pose.scale;
    let count = 0;
    const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
    const emit = (x, y, z, light, material, seed, part) => {
        if (++count > PUFFERFISH_MAX_SAMPLES)
            throw new RangeError('Pufferfish sample capacity exceeded');
        if (![x, y, z, light].every(Number.isFinite))
            throw new RangeError('Nonfinite pufferfish geometry');
        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxY = Math.max(bounds.maxY, y);
        bounds.minZ = Math.min(bounds.minZ, z);
        bounds.maxZ = Math.max(bounds.maxZ, z);
        // Monochrome is a neutral material review, retaining eye/pupil contrast.
        sink({ x, y, z, light: clamp(light, 0.025, 1), material: options.monochrome ? 2 : material, seed, part });
    };
    // Closed latitude rings. The fixed skin pattern changes with identity only,
    // never per frame; it cannot shimmer independently of the moving surface.
    for (let row = 0; row <= latitudes; row++) {
        const theta = row / latitudes * Math.PI;
        const sy = -Math.cos(theta), band = Math.sin(theta);
        for (let column = 0; column < longitudes; column++) {
            const phi = column / longitudes * TAU;
            const sx = Math.cos(phi) * band, sz = Math.sin(phi) * band;
            const normalLength = Math.hypot(sx / rx, sy / ry, sz / rz);
            const diffuse = Math.max(0, (-0.34 * sx / rx - 0.53 * sy / ry + 0.78 * sz / rz) / normalLength);
            const belly = smooth((sy + 0.05) / 0.65) * 0.09;
            const pattern = Math.cos(phi * 7 + state.variation * 2) * Math.cos(theta * 6) * 0.035;
            const light = 0.27 + diffuse * 0.58 + belly + pattern;
            emit(rx * sx, ry * sy, rz * sz, light, 0, row * 131 + column, 'body');
        }
    }
    // Raised eyes and forward pupils. Centers follow the growing surface, while
    // only a small fraction of body inflation enlarges the eyes themselves.
    const eyeRadius = 0.205 + pose.inflation * 0.025;
    for (const side of [-1, 1]) {
        const ex = side * 0.33 * pose.scale;
        const ey = -0.22 * pose.scale;
        const ez = rz * Math.sqrt(1 - (ex / rx) ** 2 - (ey / ry) ** 2) + eyeRadius * 0.24 + 0.03;
        const eyeId = side < 0 ? 20_000 : 24_000;
        for (let row = 0; row <= eyeRings; row++) {
            const angle = row / eyeRings * Math.PI;
            const rr = Math.sin(angle) * eyeRadius;
            const localZ = Math.cos(angle) * eyeRadius;
            for (let column = 0; column < eyeSegments; column++) {
                const phi = column / eyeSegments * TAU;
                emit(ex + rr * Math.cos(phi), ey + rr * Math.sin(phi), ez + localZ, 0.82 + 0.14 * Math.max(0, Math.cos(angle)), 2, eyeId + row * 41 + column, 'eye');
            }
        }
        const pupilRadius = eyeRadius * 0.49;
        for (let row = 0; row <= 7; row++) {
            const r = row / 7 * pupilRadius;
            for (let column = 0; column < eyeSegments; column++) {
                const phi = column / eyeSegments * TAU;
                const localX = r * Math.cos(phi), localY = r * Math.sin(phi);
                const pupilX = localX + gaze.x * eyeRadius * 0.22;
                const pupilY = localY + gaze.y * eyeRadius * 0.20;
                // A dark disk follows the front spherical cap rather than floating
                // ahead of the eye. One tiny off-center highlight keeps the pupil clear.
                // Preserve the old floating-point path exactly when gaze is omitted.
                const squaredRadius = gaze.x === 0 && gaze.y === 0 ? r * r : pupilX * pupilX + pupilY * pupilY;
                const z = ez + Math.sqrt(Math.max(0, eyeRadius * eyeRadius - squaredRadius)) + 0.008;
                const highlight = (localX + pupilRadius * 0.35) ** 2 + (localY + pupilRadius * 0.34) ** 2 < (pupilRadius * 0.18) ** 2;
                emit(ex + pupilX, ey + pupilY, z, highlight ? 0.98 : 0.035, 2, eyeId + 1000 + row * 41 + column, 'pupil');
            }
        }
    }
    // Small puckered lip, plus a dark center on top of the body surface.
    const mouthY = 0.16 * pose.scale;
    const mouthZ = rz * Math.sqrt(1 - (mouthY / ry) ** 2) + 0.028;
    const mouthRadius = 0.10 + pose.inflation * 0.018;
    const lipSteps = quality === 'fine' ? 42 : 32;
    for (let i = 0; i < lipSteps; i++) {
        const angle = i / lipSteps * TAU;
        for (let j = 0; j < 8; j++) {
            const tube = j / 8 * TAU;
            const radius = mouthRadius + Math.cos(tube) * 0.027;
            emit(Math.cos(angle) * radius, mouthY + Math.sin(angle) * radius * 0.78, mouthZ + Math.sin(tube) * 0.027, 0.61 + Math.sin(tube) * 0.13, 2, 29_000 + i * 9 + j, 'mouth');
        }
    }
    for (let ring = 0; ring <= 6; ring++) {
        for (let i = 0; i < lipSteps; i++) {
            const angle = i / lipSteps * TAU, radius = ring / 6 * mouthRadius * 0.69;
            emit(Math.cos(angle) * radius, mouthY + Math.sin(angle) * radius * 0.78, mouthZ + 0.004, 0.035, 2, 30_000 + ring * 43 + i, 'mouth');
        }
    }
    // Broad, bounded side fans begin inside the shell so there is no detached
    // root at any inflation amount. The two waves deliberately differ in phase.
    for (const side of [-1, 1]) {
        const beat = (side < 0 ? pose.leftFin : pose.rightFin) * (1 + finEffort * 0.45);
        const finId = side < 0 ? 32_000 : 34_000;
        for (let step = 0; step <= fanSteps; step++) {
            const u = step / fanSteps;
            const spread = Math.sin(u * Math.PI * 0.68) * 0.33;
            for (let ray = 0; ray <= fanRays; ray++) {
                const v = ray / fanRays * 2 - 1;
                // The neutral capture showed the original short fins mostly occluded
                // at three-quarter yaw. A front-quadrant root remains inside the shell;
                // wider paddles follow inflation, and the curved end reads as a fin.
                const span = 0.59 + side * 0.03 + pose.inflation * 0.08;
                const x = side * (rx * 0.93 + u * span * (1 - 0.17 * v * v));
                const y = 0.07 * pose.scale + spread * v + u * 0.05;
                const z = 0.22 * pose.scale + u * (beat * 0.19) + v * u * 0.035;
                const edge = Math.abs(v) > 0.88 || u > 0.93;
                emit(x, y, z, edge ? 0.92 : 0.52 + 0.16 * Math.cos(v * Math.PI * 3), 1, finId + step * 31 + ray, 'fin');
            }
        }
    }
    // The short rear peduncle and fan are intentionally allowed to occlude in a
    // front view. Three-quarter views reveal them around the round body edge.
    for (let step = 0; step <= 10; step++) {
        const u = step / 10;
        const radius = 0.12 - u * 0.065;
        for (let ring = 0; ring < 16; ring++) {
            const angle = ring / 16 * TAU;
            emit(Math.cos(angle) * radius + pose.tail * u * 0.45, Math.sin(angle) * radius + 0.06 * pose.scale, -rz * 0.91 - u * 0.25, 0.55, 0, 36_000 + step * 17 + ring, 'tail');
        }
    }
    for (let step = 0; step <= fanSteps; step++) {
        const u = step / fanSteps;
        for (let ray = 0; ray <= fanRays; ray++) {
            const v = ray / fanRays * 2 - 1;
            emit(pose.tail * (0.45 + u) + v * u * 0.08, 0.06 * pose.scale + v * (0.055 + u * 0.25), -rz * 0.91 - 0.25 - u * 0.44 + Math.abs(v) * u * 0.075, Math.abs(v) > 0.9 || u > 0.92 ? 0.81 : 0.51, 1, 37_000 + step * 31 + ray, 'tail');
        }
    }
    // One contour ring and two offset rings retain the 42 fixed attachments.
    // The front ring is far outside the eyes and mouth, leaving a clear face.
    // Cones grow smoothly, with no spawning, deleting, or per-frame noise.
    const coneLength = 0.035 + 0.205 * smooth((pose.inflation - 0.18) / 0.82);
    for (let spine = 0; spine < PUFFERFISH_SPINES; spine++) {
        let angle, sz;
        if (spine < 18) {
            angle = spine / 18 * TAU + 0.065;
            sz = 0;
        }
        else if (spine < 30) {
            angle = (spine - 18) / 12 * TAU + 0.16;
            sz = 0.55;
        }
        else {
            angle = (spine - 30) / 12 * TAU + 0.36;
            sz = -0.60;
        }
        const radial = Math.sqrt(1 - sz * sz);
        const sx = Math.cos(angle) * radial, sy = Math.sin(angle) * radial;
        const normalLength = Math.hypot(sx / rx, sy / ry, sz / rz);
        const nx = sx / rx / normalLength, ny = sy / ry / normalLength, nz = sz / rz / normalLength;
        const tangentLength = Math.hypot(nx, ny);
        const ax = -ny / tangentLength, ay = nx / tangentLength;
        const bx = -nz * ay, by = nz * ax, bz = nx * ay - ny * ax;
        for (let step = 0; step <= coneSteps; step++) {
            const u = step / coneSteps;
            const length = coneLength * u;
            const radius = (1 - u) * (0.019 + pose.inflation * 0.010);
            for (let side = 0; side < coneSides; side++) {
                const phi = side / coneSides * TAU;
                const ca = Math.cos(phi) * radius, cb = Math.sin(phi) * radius;
                emit(rx * sx + nx * length + ax * ca + bx * cb, ry * sy + ny * length + ay * ca + by * cb, rz * sz + nz * length + bz * cb, 0.66 + u * 0.22, 0, 40_000 + spine * 101 + step * 6 + side, 'spine');
            }
        }
    }
    return Object.freeze({ count, spineCount: PUFFERFISH_SPINES, bounds: Object.freeze(bounds) });
}
