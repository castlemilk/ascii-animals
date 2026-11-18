import { GECKO_LIMITS, geckoShoulder, transformGeckoPoint } from './gecko.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
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
        const pads = Array.from({ length: 5 }, (_, i) => {
            // One critique loop: the first .51-radian fan merged pads at 112x50.
            // Wider angular/longitudinal separation preserves negative space at LOD.
            const a = foot.angle + (i - 2) * .66 * state.options.toeSpread;
            const reach = (.16 + .022 * (1 - Math.abs(i - 2) / 2)) * state.options.toeSpread;
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
export function sampleGecko(state, emit) {
    if (typeof emit !== 'function')
        throw new TypeError('emit must be a function');
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
                const lx = u * rx, ly = v * ry * (head ? (1 - .23 * Math.max(0, u)) : 1);
                const p = { x: center.x + lx * c - ly * s, y: center.y + lx * s + ly * c };
                const dome = Math.sqrt(Math.max(0, 1 - radius * radius));
                const texture = material === 'skin' ? .045 * Math.sin((u + state.seed * .001) * 29) * Math.cos(v * 23) : 0;
                put(p, z + dome * (material === 'skin' ? .055 : .012), tone + .17 * dome - .10 * v + texture, material, part);
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
            put({ x: p.x + nx * p.radius * v, y: p.y + ny * p.radius * v }, .018 + .025 * (1 - v * v), .50 + .22 * (1 - Math.abs(v)), 'skin', 'tail');
        }
    }
    // Raised swing feet are sampled above stance feet; all remain joint-connected.
    for (const limb of anatomy.limbs) {
        strip(limb.shoulder, limb.elbow, .040, .029, 18, 7, .026 + limb.lift * .3, 'limb');
        strip(limb.elbow, limb.palm, .029, .020, 18, 7, .024 + limb.lift * .7, 'limb');
        disk(limb.palm, .031, .028, limb.angle, 4, .025 + limb.lift, 'skin', 'limb', .64);
        for (const pad of limb.pads) {
            strip(limb.palm, pad, .008, .006, 12, 3, .025 + limb.lift, 'digit');
            disk(pad, .026, .023, limb.angle, 6, .032 + limb.lift, 'pad', 'pad', .72);
        }
    }
    const breathing = 1 + state.options.breathing * Math.sin(state.phase * 1.45);
    disk(state.position, .25, .115 * breathing, state.heading, 18, .061, 'skin', 'body', .55);
    disk(transformGeckoPoint(state.position, state.heading, .205, 0), .115, .077, state.heading, 8, .068, 'skin', 'neck', .58);
    disk(transformGeckoPoint(state.position, state.heading, .35, 0), .20, .155, state.heading, 15, .076, 'skin', 'head', .59, true);
    for (const side of [-1, 1]) {
        const eye = transformGeckoPoint(state.position, state.heading, .415, side * .105);
        disk(eye, .040, .030, state.heading, 6, .142, 'eye', 'eye', .80);
        disk(eye, .010, .021, state.heading, 3, .159, 'pupil', 'eye', .25);
    }
    return { samples: count, capacity: GECKO_LIMITS.samples };
}
