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
        leftFin: Math.sin(seconds * 5.1 + phase) * 0.78 * (1 - inflation * .48),
        rightFin: Math.sin(seconds * 5.1 + phase + 0.73) * 0.64 * (1 - inflation * .44),
        tail: Math.sin(seconds * 2.4 + phase + 0.26) * 0.085 * (1 - inflation * .68),
    });
}
/** An oblong Arothron-inspired trunk, fine skin relief and 42 short spine roots.
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
    const latitudes = [26, 42, 58][detail];
    const longitudes = [56, 88, 120][detail];
    const eyeRings = [8, 11, 14][detail];
    const eyeSegments = [20, 28, 34][detail];
    const fanSteps = [9, 13, 17][detail];
    const fanRays = [14, 18, 24][detail];
    const coneSteps = [4, 5, 6][detail];
    const coneSides = 4;
    const f = pose.inflation, growth = state.config.inflationScale - 1;
    // Inflation changes proportions. The abdomen unfolds far more than the
    // rostrocaudal axis; eyes, muzzle and fin spans do not scale with the trunk.
    const rx = .74 + growth * .99 * f, ryTop = .60 + growth * .77 * f;
    const ry = .62 + growth * 1.10 * f, rz = .98 + growth * .28 * f;
    const centerY = .035 * f;
    const seconds = (options.staticPose ? 0 : state.tick) / 60;
    const gillBeat = .5 + .5 * Math.sin(seconds * 3.6 + state.variation);
    const pump = !options.staticPose && state.phase.kind === 'inflating'
        ? Math.sin(state.phase.age / (state.phase.stage === 'belly' ? state.config.bellyTicks : state.config.spineTicks) * Math.PI * 3) ** 2
        : gillBeat * .12;
    const shell = (sx, sy, sz) => {
        const rear = Math.max(0, -sz), taper = 1 - rear * rear * .25 * (1 - .75 * f);
        return [rx * sx * taper, centerY + sy * (sy < 0 ? ryTop : ry) * taper, rz * sz];
    };
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
            const normalLength = Math.hypot(sx / rx, sy / (sy < 0 ? ryTop : ry), sz / rz);
            const diffuse = Math.max(0, (-.32 * sx / rx - .48 * sy / ry + .81 * sz / rz) / normalLength);
            const belly = smooth((sy + .02) / .70);
            // A fixed surface-space field, carried by the stretching skin. Irregular
            // spot islands stay attached instead of being regenerated each frame.
            const islands = Math.sin(sx * 17 + Math.sin(sz * 5 + state.variation))
                * Math.sin(sy * 16 + Math.sin(sx * 6)) * Math.sin(sz * 14 + state.variation * 2);
            const spots = smooth((islands - .45) / .35) * (sz > .86 ? .3 : 1);
            const grain = Math.sin(phi * 41 + Math.sin(theta * 13)) * Math.sin(theta * 37) * .018;
            const light = .25 + diffuse * .43 + belly * .20 - spots * .40 + grain * (1 - f * .5);
            const [x, y, z] = shell(sx, sy, sz);
            emit(x, y, z, light, belly > .65 ? 2 : 0, row * 131 + column, 'body');
        }
    }
    // Small lateral eyes sit on the forward shoulder. Their outward-facing iris
    // caps turn with the head, and the far eye naturally occludes in profile.
    const eyeRadius = .160 + f * .009;
    for (const side of [-1, 1]) {
        const [ex, ey, ez] = shell(side * .65, -.30, Math.sqrt(1 - .65 ** 2 - .30 ** 2));
        const nx = side * .65, nz = Math.sqrt(1 - .65 ** 2);
        const eyeId = side < 0 ? 20_000 : 24_000;
        for (let row = 0; row <= eyeRings; row++) {
            const angle = row / eyeRings * Math.PI;
            const rr = Math.sin(angle) * eyeRadius;
            const localZ = Math.cos(angle) * eyeRadius;
            for (let column = 0; column < eyeSegments; column++) {
                const phi = column / eyeSegments * TAU;
                emit(ex + rr * Math.cos(phi), ey + rr * Math.sin(phi), ez + localZ, .36 + .23 * Math.max(0, Math.cos(angle)), 0, eyeId + row * 41 + column, 'eye');
            }
        }
        const pupilRadius = eyeRadius * .59;
        for (let row = 0; row <= 7; row++) {
            // Reuse the existing cap samples for a narrow warm iris rim. At a phone
            // grid the rim and one catchlight retain the lateral eye's direction.
            const r = row / 7 * eyeRadius * .88;
            for (let column = 0; column < eyeSegments; column++) {
                const phi = column / eyeSegments * TAU;
                const localX = r * Math.cos(phi), localY = r * Math.sin(phi);
                // Keep the outer iris attached while the pupil attends. A full corner
                // gaze must not translate the rim beyond the small eye's spherical cap.
                const gazeWeight = 1 - smooth((r - pupilRadius) / (eyeRadius * .88 - pupilRadius));
                const pupilX = localX + gaze.x * eyeRadius * .18 * gazeWeight;
                const pupilY = localY + gaze.y * eyeRadius * .18 * gazeWeight;
                const cap = Math.sqrt(Math.max(0, eyeRadius * eyeRadius - pupilX * pupilX - pupilY * pupilY)) + .008;
                const iris = r > pupilRadius;
                const highlight = (localX + pupilRadius * 0.35) ** 2 + (localY + pupilRadius * 0.34) ** 2 < (pupilRadius * 0.28) ** 2;
                emit(ex + pupilX * nz + nx * cap, ey + pupilY, ez - pupilX * nx + nz * cap, iris ? .72 + .09 * Math.cos(phi + .8) : highlight ? .98 : .035, iris ? 0 : 2, eyeId + 1000 + row * 41 + column, iris ? 'eye' : 'pupil');
            }
        }
    }
    // A short blunt muzzle joins continuously to the nose. Its narrow pale bar
    // and dark lip leave a clean face instead of covering it in quills.
    for (let ring = 0; ring <= 8; ring++)
        for (let j = 0; j < 24; j++) {
            const u = ring / 8, angle = j / 24 * TAU;
            const breadth = .29 * (1 - u) + .115 * u;
            const height = .19 * (1 - u) + .085 * u;
            const top = Math.sin(angle) < -.35;
            emit(Math.cos(angle) * breadth, -.025 + Math.sin(angle) * height, rz * .86 + u * (rz * .14 + .045), top && u > .25 && u < .65 ? .78 : .28 + (1 - u) * .16, top && u > .25 && u < .65 ? 2 : 0, 28_000 + ring * 24 + j, 'body');
        }
    // Small puckered lip, plus a dark center on top of the muzzle.
    const mouthY = -.025 + f * .015;
    const mouthZ = rz + .045;
    const mouthRadius = .085 + pump * .020;
    const lipSteps = quality === 'fine' ? 42 : 32;
    for (let i = 0; i < lipSteps; i++) {
        const angle = i / lipSteps * TAU;
        for (let j = 0; j < 8; j++) {
            const tube = j / 8 * TAU;
            const radius = mouthRadius + Math.cos(tube) * .035;
            emit(Math.cos(angle) * radius, mouthY + Math.sin(angle) * radius * 0.78, mouthZ + Math.sin(tube) * .035, .39 + Math.sin(tube) * .15, 0, 29_000 + i * 9 + j, 'mouth');
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
            const spread = Math.sin(u * Math.PI * .72) * .24;
            for (let ray = 0; ray <= fanRays; ray++) {
                const v = ray / fanRays * 2 - 1;
                const span = .43 + side * .025 - f * .07;
                const x = side * (rx * .88 + u * span * (1 - .20 * v * v));
                const y = centerY + .04 + spread * v + u * .035;
                const z = .23 + u * (beat * .18 - .16) + v * u * .035;
                const edge = Math.abs(v) > 0.88 || u > 0.93;
                emit(x, y, z, edge ? .77 : .42 + .21 * Math.cos(v * Math.PI * 6), 1, finId + step * 31 + ray, 'fin');
            }
        }
    }
    // A gill slit immediately ahead of each pectoral root remains active during
    // inflation. These are surface details, not detached breathing bubbles.
    for (const side of [-1, 1])
        for (let j = 0; j <= 12; j++) {
            const u = j / 12, y = -.12 + u * .23;
            const x = side * rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2 - (.29 / rz) ** 2));
            emit(x + side * .008, centerY + y, .29 + Math.sin(u * Math.PI) * (.014 + gillBeat * .008), .13 + gillBeat * .035, 0, 35_000 + (side + 1) * 20 + j, 'body');
        }
    // Small dorsal/anal stabilisers share the rear trunk, not the pectoral roots.
    // The opposite phases keep the rigid plump body stable during slow drift.
    for (const side of [-1, 1])
        for (let step = 0; step <= 7; step++) {
            const u = step / 7;
            for (let ray = 0; ray <= 10; ray++) {
                const v = ray / 10 * 2 - 1;
                emit(Math.sin(seconds * 4.1 + state.variation + side) * .085 * u, centerY + side * ((side < 0 ? ryTop : ry) * .83 + u * .24), -.42 + v * (.07 + u * .19), Math.abs(v) > .85 ? .78 : .42 + .17 * Math.cos(v * Math.PI * 4), 1, 35_100 + (side + 1) * 100 + step * 11 + ray, 'fin');
            }
        }
    // The short rear peduncle and fan are intentionally allowed to occlude in a
    // front view. Three-quarter views reveal them around the round body edge.
    for (let step = 0; step <= 10; step++) {
        const u = step / 10;
        const radius = .17 - u * .095;
        for (let ring = 0; ring < 16; ring++) {
            const angle = ring / 16 * TAU;
            emit(Math.cos(angle) * radius + pose.tail * u * 0.45, Math.sin(angle) * radius + .04, -rz * .68 - u * .45, .50, 0, 36_000 + step * 17 + ring, 'tail');
        }
    }
    for (let step = 0; step <= fanSteps; step++) {
        const u = step / fanSteps;
        for (let ray = 0; ray <= fanRays; ray++) {
            const v = ray / fanRays * 2 - 1;
            emit(pose.tail * (0.45 + u) + v * u * 0.08, .04 + v * (.075 + u * .25), -rz * .68 - .45 - u * .63 + Math.abs(v) * u * .075, Math.abs(v) > .9 || u > .92 ? .81 : .43 + .17 * Math.cos(v * Math.PI * 5), 1, 37_000 + step * 31 + ray, 'tail');
        }
    }
    // Keep the 42 explicit attachment identities, but use fine spinules instead
    // of porcupine quills. They lie along the skin while calm and stand up later
    // than belly expansion; on recovery their angle relaxes slightly after skin.
    const recoveryLag = !options.staticPose && state.phase.kind === 'recovering'
        ? .08 * Math.sin(Math.PI * state.phase.age / state.config.recoveryTicks) * state.phase.from : 0;
    const erect = smooth((f + recoveryLag - .18) / .82);
    const coneLength = .016 + .083 * erect;
    for (let spine = 0; spine < PUFFERFISH_SPINES; spine++) {
        let angle, sz;
        if (spine < 18) {
            angle = spine / 18 * TAU + .065;
            sz = 0;
        }
        else if (spine < 30) {
            angle = (spine - 18) / 12 * TAU + .16;
            sz = .50;
        }
        else {
            angle = (spine - 30) / 12 * TAU + .36;
            sz = -.55;
        }
        const radial = Math.sqrt(1 - sz * sz);
        const sx = Math.cos(angle) * radial, sy = Math.sin(angle) * radial;
        const normalLength = Math.hypot(sx / rx, sy / (sy < 0 ? ryTop : ry), sz / rz);
        const nx = sx / rx / normalLength, ny = sy / (sy < 0 ? ryTop : ry) / normalLength, nz = sz / rz / normalLength;
        const tangentLength = Math.hypot(nx, ny);
        const ax = -ny / tangentLength, ay = nx / tangentLength;
        const bx = -nz * ay, by = nz * ax, bz = nx * ay - ny * ax;
        const root = shell(sx, sy, sz);
        for (let step = 0; step <= coneSteps; step++) {
            const u = step / coneSteps;
            const length = coneLength * u * (sy > .2 ? 1.12 : .85);
            const radius = (1 - u) * (.010 + f * .003);
            const lay = .028 * (1 - erect) * u;
            for (let side = 0; side < coneSides; side++) {
                const phi = side / coneSides * TAU;
                const ca = Math.cos(phi) * radius, cb = Math.sin(phi) * radius;
                emit(root[0] + nx * length + ax * (ca + lay) + bx * cb, root[1] + ny * length + ay * (ca + lay) + by * cb, root[2] + nz * length + bz * cb, .57 + u * .23, sy > .2 ? 2 : 0, 40_000 + spine * 101 + step * 6 + side, 'spine');
            }
        }
    }
    // A second, finer skin layer uses 84 fixed follicle sites. Three connected
    // samples each provide relief inside the silhouette without extra quill rings.
    // The face and caudal tip stay bare; lower sites show more relief. Tiny sites
    // collapse into their parent glyph naturally at low detail, without flicker.
    for (let site = 0; site < 84; site++) {
        const sz = -.72 + (site + .5) / 84 * 1.40;
        const angle = site * 2.399963229728653 + state.variation;
        const radial = Math.sqrt(1 - sz * sz), sx = Math.cos(angle) * radial, sy = Math.sin(angle) * radial;
        const root = shell(sx, sy, sz), lift = (.007 + erect * .037) * (sy > 0 ? 1.2 : .7);
        for (let j = 0; j <= 2; j++) {
            const u = j / 2;
            emit(root[0] + sx * lift * u, root[1] + sy * lift * u, root[2] + sz * lift * u, .42 + .27 * u + Math.max(0, sy) * .12, sy > .2 ? 2 : 0, 48_000 + site * 3 + j, 'body');
        }
    }
    return Object.freeze({ count, spineCount: PUFFERFISH_SPINES, bounds: Object.freeze(bounds) });
}
