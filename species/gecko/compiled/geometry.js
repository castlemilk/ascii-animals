import { GECKO_LIMITS, geckoShoulder, transformGeckoPoint } from './gecko.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
/** Original attached centerline + four two-bone limbs, with world-fixed stance pads. */
export function getGeckoAnatomy(state) {
    if (state.feet.length !== 4 || ![state.position.x, state.position.y, state.heading, state.phase, state.tailCurl, state.options.tailLength, state.options.toeSpread].every(Number.isFinite)) {
        throw new TypeError('Expected a finite four-foot GeckoState snapshot');
    }
    const tail = [];
    let x = -.23, y = 0;
    const curlSign = (state.seed & 1) ? 1 : -1, segments = 72, length = .85 * state.options.tailLength;
    for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        if (i > 0) {
            const mid = (i - .5) / segments;
            const bend = mid * mid * (3 - 2 * mid);
            const a = Math.PI + curlSign * 5.2 * state.tailCurl * bend
                + Math.sin(state.phase * 1.1 - mid * 4) * state.options.tailSway * mid;
            x += Math.cos(a) * length / segments;
            y += Math.sin(a) * length / segments;
        }
        tail.push({ ...transformGeckoPoint(state.position, state.heading, x, y), radius: .004 + .074 * Math.pow(1 - u, .9) });
    }
    const limbs = state.feet.map((foot) => {
        const shoulder = geckoShoulder(state.position, state.heading, foot), palm = foot.position;
        const dx = palm.x - shoulder.x, dy = palm.y - shoulder.y, d = Math.hypot(dx, dy);
        if (!Number.isFinite(d) || d < .000001 || d > GECKO_LIMITS.limbReach + .000001)
            throw new RangeError('Foot exceeds declared limb reach');
        const ux = dx / d, uy = dy / d, upper = .19, lower = .25;
        const along = (upper * upper - lower * lower + d * d) / (2 * d), height = Math.sqrt(Math.max(0, upper * upper - along * along));
        const bend = foot.side * (foot.front ? 1 : -1);
        const elbow = { x: shoulder.x + ux * along - uy * height * bend, y: shoulder.y + uy * along + ux * height * bend };
        const spread = foot.toeSpread ?? state.options.toeSpread;
        // Digital hyperextension: a raised foot folds its fan before transferring.
        // Stance tips depend only on the latched contact, never on body movement.
        const peel = foot.phase === 'swing' ? Math.sin(Math.PI * clamp((state.tick - foot.since) / foot.duration, 0, 1)) : 0;
        const pads = Array.from({ length: 5 }, (_, i) => {
            const a = foot.angle + (i - 2) * .66 * spread * (1 - .46 * peel);
            const reach = (.16 + .022 * (1 - Math.abs(i - 2) / 2)) * spread * (1 - .22 * peel);
            return { x: palm.x + Math.cos(a) * reach, y: palm.y + Math.sin(a) * reach };
        });
        return { id: foot.id, shoulder, elbow, palm: { ...palm }, angle: foot.angle, lift: foot.phase === 'swing' ? foot.lift : 0, pads };
    });
    return { tail, limbs };
}
/**
 * Bounded surface samples. This knows no camera, cell grid, Canvas or host clock.
 * Material names are gecko-local; the proposed writer adapter maps them explicitly.
 */
export function sampleGecko(state, emit, pose = {}) {
    if (typeof emit !== 'function')
        throw new TypeError('emit must be a function');
    const headTurn = clamp(pose.headTurn ?? 0, -.24, .24), headReach = clamp(pose.headReach ?? 0, -.025, .025);
    const crouch = clamp(pose.crouch ?? 0, 0, 1), jawOpen = clamp(pose.jawOpen ?? 0, 0, 1);
    if (![headTurn, headReach, crouch, jawOpen].every(Number.isFinite))
        throw new TypeError('Expected finite Gecko expression');
    const anatomy = getGeckoAnatomy(state);
    let count = 0;
    const put = (p, z, tone, material, part) => {
        if (++count > GECKO_LIMITS.samples)
            throw new RangeError('Gecko sample capacity exceeded');
        if (![p.x, p.y, z, tone].every(Number.isFinite))
            throw new TypeError('Non-finite gecko sample');
        emit({ x: p.x, y: p.y, z, tone: clamp(tone, 0, 1), material, part, stableId: count - 1 });
    };
    const disk = (center, rx, ry, angle, rings, z, material, part, tone = .7, head = false) => {
        const c = Math.cos(angle), s = Math.sin(angle);
        for (let ir = 0; ir <= rings; ir++) {
            const radius = ir / rings, steps = ir === 0 ? 1 : ir * 8;
            for (let j = 0; j < steps; j++) {
                const theta = j / steps * TAU, u = Math.cos(theta) * radius, v = Math.sin(theta) * radius;
                const lx = u * rx, ly = v * ry * (head ? (1 - .30 * Math.max(0, u) + .035 * Math.cos(u * 3)) : 1);
                const p = { x: center.x + lx * c - ly * s, y: center.y + lx * s + ly * c };
                const dome = Math.sqrt(Math.max(0, 1 - radius * radius));
                // Skin markings are locked to anatomy, not screen cells or frame time.
                // Sparse warm islands are encoded in the low skin-tone band; the rest
                // remains a cool, quiet surface with a continuous lit dorsal contour.
                const gx = u * (head ? 5 : 6), gy = v * 3, ix = Math.floor(gx + .5), iy = Math.floor(gy + .5);
                const hash = (Math.imul(ix + 19, 73856093) ^ Math.imul(iy + 31, 19349663) ^ state.seed) >>> 0;
                const offsetX = ((hash & 255) / 255 - .5) * .33, offsetY = (((hash >>> 8) & 255) / 255 - .5) * .33;
                const spot = material === 'skin' && (part === 'body' || part === 'head') && radius < .91 &&
                    ((hash >>> 16) % 5 !== 0) && Math.hypot((gx - ix - offsetX) * 1.25, gy - iy - offsetY) < .25;
                const texture = material === 'skin' ? .018 * Math.cos(u * 67 + state.seed) * Math.cos(v * 53) : 0;
                const value = spot ? .29 + .035 * dome : tone + .16 * dome - .12 * v + texture;
                put(p, z + dome * (material === 'skin' ? .055 : .012), value, material, part);
            }
        }
    };
    const strip = (a, b, ra, rb, segments, widthSamples, z, part) => {
        const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy), nx = length > 0 ? -dy / length : 0, ny = length > 0 ? dx / length : 1;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments, r = ra + (rb - ra) * t;
            for (let j = 0; j < widthSamples; j++) {
                const v = j / (widthSamples - 1) * 2 - 1;
                put({ x: a.x + dx * t + nx * r * v, y: a.y + dy * t + ny * r * v }, z + .018 * (1 - v * v), .55 + .23 * (1 - Math.abs(v)), 'skin', part);
            }
        }
    };
    // The tail begins at the pelvis every frame; there is never a detached curve.
    for (let i = 0; i < anatomy.tail.length; i++) {
        const p = anatomy.tail[i], prev = anatomy.tail[Math.max(0, i - 1)], next = anatomy.tail[Math.min(anatomy.tail.length - 1, i + 1)];
        const dx = next.x - prev.x, dy = next.y - prev.y, length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
        for (let j = 0; j < 9; j++) {
            const v = j / 4 - 1;
            const band = smooth((Math.cos(i * .59) - .45) * 3) * .095;
            put({ x: p.x + nx * p.radius * v, y: p.y + ny * p.radius * v }, .018 + .025 * (1 - v * v), .51 + .23 * (1 - Math.abs(v)) - band, 'skin', 'tail');
        }
    }
    // Raised swing feet are sampled above stance feet; all remain joint-connected.
    for (const limb of anatomy.limbs) {
        strip(limb.shoulder, limb.elbow, .040, .029, 18, 7, .026 + limb.lift * .3, 'limb');
        strip(limb.elbow, limb.palm, .029, .020, 18, 7, .024 + limb.lift * .7, 'limb');
        disk(limb.palm, .031, .028, limb.angle, 4, .025 + limb.lift, 'skin', 'limb', .64);
        for (const pad of limb.pads) {
            const angle = Math.atan2(pad.y - limb.palm.y, pad.x - limb.palm.x);
            const knuckle = { x: limb.palm.x + (pad.x - limb.palm.x) * .55, y: limb.palm.y + (pad.y - limb.palm.y) * .55 };
            strip(limb.palm, knuckle, .010, .008, 6, 3, .025 + limb.lift, 'digit');
            strip(knuckle, pad, .008, .007, 7, 3, .027 + limb.lift, 'digit');
            disk(pad, .029, .017, angle, 6, .034 + limb.lift, 'pad', 'pad', .79);
        }
    }
    const breathing = 1 + state.options.breathing * Math.sin(state.phase * 1.45);
    disk(state.position, .265 - .012 * crouch, (.126 + .008 * crouch) * breathing, state.heading, 19, .061 - .012 * crouch, 'skin', 'body', .57);
    const neck = transformGeckoPoint(state.position, state.heading, .20, 0), faceHeading = state.heading + headTurn;
    disk(neck, .108, .074, state.heading, 8, .068, 'skin', 'neck', .61);
    const face = transformGeckoPoint(neck, faceHeading, .145 + headReach, 0);
    disk(face, .202, .165, faceHeading, 17, .076, 'skin', 'head', .64, true);
    // A small mouth gap and attached lower-jaw lip sit above the head surface.
    // Drawing the jaw underneath the skull made a strike invisible at phone size.
    if (jawOpen > 0) {
        const mouth = transformGeckoPoint(face, faceHeading, .145, 0);
        disk(mouth, .048 * jawOpen, .080, faceHeading, 5, .147, 'pupil', 'head', .18);
        const lip = transformGeckoPoint(face, faceHeading, .194 + headReach * .3, 0);
        disk(lip, .016, .083, faceHeading, 4, .157, 'skin', 'head', .72);
    }
    for (const side of [-1, 1]) {
        const eye = transformGeckoPoint(face, faceHeading, .058, side * .126);
        disk(eye, .043, .034, faceHeading, 6, .142, 'eye', 'eye', .86);
        disk(eye, .008, .024, faceHeading, 3, .159, 'pupil', 'eye', .20);
        const nostril = transformGeckoPoint(face, faceHeading, .168, side * .047);
        disk(nostril, .009, .007, faceHeading, 2, .144, 'pupil', 'head', .25);
    }
    return { samples: count, capacity: GECKO_LIMITS.samples };
}
