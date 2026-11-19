const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function outline(curves) {
    const points = [];
    for (const [a, b, c, d] of curves)
        for (let k = 0; k < 10; k++) {
            const t = k / 10, u = 1 - t;
            points.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
                u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
        }
    points.push(points[0]);
    let length = 0;
    const lengths = [0];
    for (let i = 1; i < points.length; i++) {
        length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        lengths.push(length);
    }
    return { points, lengths, length };
}
// Independently drawn dorsal outlines. The high forewing apex and scalloped
// hindwing are deliberately different shapes; both hinge at the thorax.
const FORE = outline([
    [[.10, -.18], [.27, -.56], [.87, -1.32], [1.53, -1.43]],
    [[1.53, -1.43], [1.64, -1.17], [1.54, -.68], [1.36, -.27]],
    [[1.36, -.27], [1.16, .08], [.69, .27], [.10, .17]],
    [[.10, .17], [.09, .05], [.09, -.08], [.10, -.18]],
]);
const HIND = outline([
    [[.11, .08], [.55, -.02], [1.12, .12], [1.27, .42]],
    [[1.27, .42], [1.35, .56], [1.23, .69], [1.15, .72]],
    [[1.15, .72], [1.15, .90], [1.01, 1.00], [.91, .99]],
    [[.91, .99], [.79, 1.19], [.61, 1.18], [.53, 1.10]],
    [[.53, 1.10], [.27, 1.08], [.11, .62], [.11, .08]],
]);
// A small discal cell with branches to the margin. No radial sine pattern,
// central eyespots, or viceroy-like bar crossing the hindwing.
const FORE_VEINS = [
    [[.13, -.08], [.42, -.40], [.78, -.72], [1.47, -1.34]],
    [[.13, -.08], [.51, -.04], [.91, -.25], [1.42, -.43]],
    [[.42, -.40], [.51, -.04]],
    [[.78, -.72], [.91, -.25]],
    [[.42, -.40], [.57, -.80], [.95, -1.22]],
    [[.78, -.72], [1.48, -.91]],
    [[.51, -.04], [.93, .13]],
    [[.91, -.25], [1.24, -.01]],
];
const HIND_VEINS = [
    [[.13, .13], [.42, .43], [.53, 1.08]],
    [[.13, .13], [.65, .22], [1.20, .37]],
    [[.65, .22], [.72, .47], [.42, .43]],
    [[.42, .43], [.91, .98]],
    [[.72, .47], [1.14, .72]],
    [[.72, .47], [1.27, .55]],
];
function contains(path, x, y) {
    let inside = false;
    for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1], b = path.points[i];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])
            inside = !inside;
    }
    return inside;
}
function segment(x, y, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return { distance: Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy), t, dx, dy };
}
function edge(path, x, y) {
    let distance = Infinity, along = 0;
    for (let i = 1; i < path.points.length; i++) {
        const s = segment(x, y, path.points[i - 1], path.points[i]);
        if (s.distance < distance) {
            distance = s.distance;
            along = (path.lengths[i - 1] + s.t * (path.lengths[i] - path.lengths[i - 1])) / path.length;
        }
    }
    return { distance, along };
}
function wingSample(x, y, resolution) {
    const upper = contains(FORE, x, y), path = upper ? FORE : HIND;
    if (!upper && !contains(HIND, x, y))
        return null;
    const rim = edge(path, x, y), fine = resolution >= 9;
    // A continuous dark perimeter containing a single, spaced row of pale spots.
    // The rim is wider than a vein and does not disappear on a folded wing.
    const border = .115 + (fine ? 0 : .02), veinWidth = Math.max(.026, .29 / resolution);
    if (rim.distance < border) {
        const spot = Math.cos(rim.along * TAU * (upper ? 15 : 12));
        if (x > .40 && rim.distance > .026 && spot > .60)
            return { glyph: fine ? 'o' : '.', tone: 9, material: 'ivory' };
        return { glyph: fine ? ':' : '+', tone: fine ? 5 : 7, material: 'vein' };
    }
    let best = { distance: Infinity, dx: 0, dy: 0 };
    const veins = upper ? FORE_VEINS : HIND_VEINS;
    for (let i = 0; i < veins.length; i++) {
        if (!fine && i > (upper ? 4 : 3))
            continue;
        const line = veins[i];
        for (let k = 1; k < line.length; k++) {
            const s = segment(x, y, line[k - 1], line[k]);
            if (s.distance < best.distance)
                best = s;
        }
    }
    if (best.distance < veinWidth) {
        const glyph = Math.abs(best.dx) < Math.abs(best.dy) * .4 ? '|' : Math.abs(best.dy) < Math.abs(best.dx) * .4 ? '-' : best.dx * best.dy > 0 ? '\\' : '/';
        return { glyph, tone: 5, material: 'vein' };
    }
    // Stable scale texture follows the wing, not the frame or cell index.
    const tone = upper ? 7 + clamp((-y + .2) / 1.7, 0, 1) : 6 + clamp((1.12 - y), 0, 1);
    const band = Math.floor((x * .7 + y) * 13);
    return { glyph: fine ? (band % 4 === 0 ? '+' : '=') : (band % 3 === 0 ? '+' : '#'), tone, material: 'pigment' };
}
function field(o) {
    const columns = o.columns, rows = o.rows, length = columns * rows;
    const glyphs = new Array(length).fill(' '), tones = new Uint8Array(length), inks = new Uint8Array(length), depths = new Uint8Array(length);
    const worldW = Math.max(6, 3.7 * columns * .56 / rows), worldH = worldW * rows / (columns * .56);
    function put(c, r, glyph, tone, ink, depth) {
        if (c < 0 || c >= columns || r < 0 || r >= rows)
            return;
        const i = r * columns + c;
        if (depth < depths[i])
            return;
        glyphs[i] = glyph;
        tones[i] = clamp(Math.round(tone), 1, 9);
        inks[i] = ink;
        depths[i] = depth;
    }
    function mark(x, y, glyph, tone, ink, depth) { put(Math.round((x * .5 + .5) * (columns - 1)), Math.round((y * .5 + .5) * (rows - 1)), glyph, tone, ink, depth); }
    function line(x, y, xx, yy, tone, ink, depth, glyph) {
        const dc = (xx - x) * columns * .5, dr = (yy - y) * rows * .5, n = Math.max(1, Math.ceil(Math.max(Math.abs(dc), Math.abs(dr))));
        const stroke = glyph ?? (Math.abs(dc) < .45 * Math.abs(dr) ? '|' : Math.abs(dr) < .4 * Math.abs(dc) ? '-' : dc * dr > 0 ? '\\' : '/');
        for (let k = 0; k <= n; k++) {
            const p = k / n;
            mark(x + (xx - x) * p, y + (yy - y) * p, stroke, tone, ink, depth);
        }
    }
    return { columns, rows, worldW, worldH, put, mark, line, frame(phase) {
            const cells = Object.freeze(glyphs.map((glyph, i) => Object.freeze({ glyph, tone: tones[i], ink: inks[i] })));
            const textRows = new Array(rows);
            for (let r = 0; r < rows; r++)
                textRows[r] = glyphs.slice(r * columns, (r + 1) * columns).join('');
            return Object.freeze({ columns, rows, cells, text: textRows.join('\n'), phase });
        } };
}
function drawAnimal(f, o, m, depth) {
    const { columns, rows, worldW, worldH } = f, scale = m.scale, co = Math.cos(m.heading), si = Math.sin(m.heading), mirror = o.facing === 'left' ? 1 : -1;
    const flying = ['flutter', 'inspect', 'recover'].includes(m.activity.kind), resolution = scale * (columns - 1) / worldW;
    const lag = flying ? Math.sin(m.clock * 5.1 + m.phase) * .026 : .01;
    const opening = clamp(m.opening, .25, 1), halfWing = Math.max(.41, 1.65 * clamp(opening + Math.abs(lag), .25, 1));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const x of [-halfWing, halfWing])
        for (const y of [-1.51, 1.18]) {
            const xx = (x * co - y * si) * scale, yy = (x * si + y * co) * scale;
            minX = Math.min(minX, xx);
            maxX = Math.max(maxX, xx);
            minY = Math.min(minY, yy);
            maxY = Math.max(maxY, yy);
        }
    const gutterX = worldW / (columns - 1) * 1.5, gutterY = worldH / (rows - 1) * 1.5;
    const rootX = clamp(m.x * worldW * .5, -worldW * .5 + gutterX - minX, worldW * .5 - gutterX - maxX);
    const rootY = clamp(m.y * worldH * .5, -worldH * .5 + gutterY - minY, worldH * .5 - gutterY - maxY);
    function point(x, y, tone, glyph, ink = m.ink, extraDepth = 1) {
        x *= mirror;
        f.mark((rootX + (x * co - y * si) * scale) * 2 / worldW, (rootY + (x * si + y * co) * scale) * 2 / worldH, glyph, tone, ink, depth + extraDepth);
    }
    function limb(x, y, xx, yy, tone, ink = m.ink, glyph) {
        const dx = xx - x, dy = yy - y, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) * resolution * 1.4));
        const gx = dx * co - dy * si, gy = dx * si + dy * co;
        const stroke = glyph ?? (Math.abs(gx) < .45 * Math.abs(gy) ? '|' : Math.abs(gy) < .4 * Math.abs(gx) ? '-' : gx * gy > 0 ? '\\' : '/');
        for (let k = 0; k <= n; k++) {
            const p = k / n;
            point(x + dx * p, y + dy * p, tone, stroke, ink);
        }
    }
    const radius = 2.12 * scale, left = clamp(Math.floor((rootX - radius) / worldW * (columns - 1) + (columns - 1) * .5), 0, columns - 1), right = clamp(Math.ceil((rootX + radius) / worldW * (columns - 1) + (columns - 1) * .5), 0, columns - 1);
    const top = clamp(Math.floor((rootY - radius) / worldH * (rows - 1) + (rows - 1) * .5), 0, rows - 1), bottom = clamp(Math.ceil((rootY + radius) / worldH * (rows - 1) + (rows - 1) * .5), 0, rows - 1);
    // One faint edge echo during the fastest part of a powered stroke. No frame
    // history or body trail, and an explicit still render contains no ink 12.
    const echo = m.blur && flying && resolution >= 6 && Math.abs(Math.sin(m.clock * 8.5 + m.phase)) > .78;
    for (let r = top; r <= bottom; r++)
        for (let c = left; c <= right; c++) {
            const wx = (c / (columns - 1) - .5) * worldW - rootX, wy = (r / (rows - 1) - .5) * worldH - rootY;
            const lx = (wx * co + wy * si) / scale * mirror, y = (-wx * si + wy * co) / scale, side = lx < 0 ? -1 : 1;
            const spread = clamp(opening + side * lag, .25, 1), x = Math.abs(lx) / spread;
            const sample = wingSample(x, y, resolution * spread);
            if (sample)
                f.put(c, r, sample.glyph, sample.tone, sample.material === 'pigment' ? m.ink : sample.material === 'ivory' ? 11 : 10, depth);
            else if (echo) {
                const ex = Math.abs(lx) / clamp(spread + .13, .25, 1.12);
                const path = contains(FORE, ex, y) ? FORE : contains(HIND, ex, y) ? HIND : null;
                if (path && edge(path, ex, y).distance < .065)
                    f.put(c, r, '.', 3, 12, depth - 1);
            }
        }
    // Six thoracic attachments, shortened front pair, two clearly clubbed antennae.
    const contact = m.activity.kind === 'nectar' || m.activity.kind === 'perch';
    for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
            const y = -.19 + k * .17, len = k === 0 ? .20 : .36;
            const foot = m.activity.kind === 'nectar' ? -.13 : contact ? .18 : .10;
            limb(side * .06, y, side * len, y + foot, 5, 10);
            if (resolution > 8)
                limb(side * len, y + foot, side * (len + .08), y + foot * 1.7, 6, 10);
        }
        limb(side * .06, -.53, side * .13, -.99, 7, 11);
        limb(side * .13, -.99, side * .30, -1.46, 7, 11);
        point(side * .30, -1.46, 9, 'o', 11);
    }
    limb(0, -.47, 0, .83, 9, 10, '|');
    if (resolution > 9) {
        limb(-.055, -.14, -.045, .53, 8, 10, '|');
        limb(.055, -.14, .045, .53, 8, 10, '|');
    }
    for (let k = 0; k < 5; k++)
        point(0, .08 + k * .14, 7, '=', 11);
    point(0, -.19, 9, '#', 10);
    point(0, -.49, 9, '@', 11);
    return { rootX, rootY, scale, co, si, minX, maxX, minY, maxY };
}
/** Same original wing geometry for the default close study and the garden. */
export function renderButterflySpecimen(o, s, phase, still = false) {
    const f = field(o), t = s.tick / 60 * o.speed, seedPhase = (o.seed % 997) / 997 * TAU;
    const age = s.responseTick === null ? 0 : s.tick - s.responseTick, lift = s.responseTick === null ? 0 : Math.sin(Math.PI * clamp(age / 180, 0, 1));
    const dx = o.behavior === 'curious' ? s.targetX * .3 : o.behavior === 'hover' ? Math.sin(t * .65 + seedPhase) * o.sway : 0;
    const bounce = o.behavior === 'perch' ? 0 : Math.sin(t * 1.2) * .06 + (o.behavior === 'curious' ? s.targetY * .15 : 0);
    const glide = (t + seedPhase / TAU * 2.8) % 3.8 > 1.25;
    const opening = o.behavior === 'perch' ? .81 : lift > .2 ? .95 : glide ? .9 + .035 * Math.sin(t * .9) : .32 + .66 * (.5 + .5 * Math.cos(t * 8.5 + seedPhase));
    drawAnimal(f, o, { x: dx * 2 / f.worldW, y: bounce * 2 / f.worldH, scale: o.scale, heading: Math.sin(t * .45 + seedPhase) * .05, opening, phase: seedPhase, ink: 1, activity: { kind: o.behavior === 'perch' ? 'bask' : glide ? 'glide' : 'flutter' }, clock: t, blur: !still }, 10);
    return f.frame(phase);
}
/** Bounded layered meadow; all marks remain printable ASCII logical cells. */
export function renderButterflyGarden(o, g, phase, still = false) {
    const f = field(o), { columns, rows, worldW, worldH } = f;
    for (let k = 0; k < 22; k++) {
        const n = (k * 37 + o.seed % 107) % 113, x = -.93 + 1.86 * n / 113 + Math.sin(g.clock * .16 + k * 2.1) * .012, y = -.78 + ((k * .127 + g.clock * .004) % 1.33);
        f.mark(x, y, k % 5 === 0 ? ':' : '.', k % 5 === 0 ? 3 : 2, 9, 1);
    }
    // Three distant seed-head stems establish depth, behind the focal flower row.
    for (let k = 0; k < 3; k++) {
        const x = -.82 + k * .76, y = .18 + (k % 2) * .12, bend = Math.sin(g.clock * .32 + k) * .025;
        f.line(x, .87, x + bend, y, 2, 7, 1);
        f.line(x + bend, y, x + bend - .045, y - .08, 2, 7, 1);
        for (let j = 0; j < 5; j++)
            f.mark(x + bend + (j % 2 ? -.018 : .018), y - .07 + j * .025, ':', 2, 7, 1);
    }
    const weather = g.cue === 'breeze' || (g.scene === 'breeze' && g.actIndex === 1) || (g.pointer.active && o.director.pointerMode === 'breeze');
    if (weather && !still) {
        const direction = o.director.breeze < 0 ? -1 : 1;
        for (let ribbon = 0; ribbon < 3; ribbon++)
            for (let k = 0; k < 23; k++) {
                const x = -.87 + k * .077, y = -.53 + ribbon * .27 + Math.sin(x * 4 - direction * g.clock * .7 + ribbon) * .055;
                f.mark(x, y, k % 4 === 0 ? '~' : '.', 3, 9, 2);
            }
    }
    // A low sparse ground plane, with two broad foreground leaf silhouettes.
    for (let k = 0; k < 17; k++) {
        const x = -.98 + k * .122, top = .96 - .020 * (1 + (k * 7 + o.seed) % 4);
        f.line(x, .99, x - .018, top, 3, 7, 2, '/');
        if (k % 3 === 0)
            f.line(x, .99, x + .025, top + .025, 3, 7, 2, '\\');
    }
    for (const side of [-1, 1])
        for (let k = 0; k < 3; k++) {
            const x = side * (.92 - k * .055), y = .96 - k * .025, tipX = x - side * (.14 + k * .025), tipY = y - .15 - k * .03;
            f.line(x, y, tipX, tipY, 5, 7, 4);
            f.line(x, y, tipX + side * .07, tipY + .015, 3, 7, 4);
            f.line(tipX, tipY, tipX + side * .07, tipY + .015, 4, 7, 4);
        }
    for (const flower of g.flowers) {
        const fx = flower.x, fy = flower.y, bend = Math.sin(g.clock * .46 + flower.id * 1.4) * .012 + o.director.breeze * .018, root = fx - bend * 1.2;
        const occupied = g.members.some(m => (m.activity.kind === 'nectar' || m.activity.kind === 'perch') && m.activity.flower === flower.id);
        let px = fx, py = fy;
        const steps = Math.max(1, Math.ceil((.96 - fy) * rows * .5));
        for (let k = 1; k <= steps; k++) {
            const p = k / steps, x = fx + (root - fx) * p + Math.sin(p * Math.PI) * bend, y = fy + (.96 - fy) * p;
            f.line(px, py, x, y, 4, 7, 3);
            px = x;
            py = y;
        }
        for (const [at, side] of [[.43, -1], [.70, 1]]) {
            const y = fy + (.96 - fy) * at, x = fx + (root - fx) * at + Math.sin(at * Math.PI) * bend, tx = x + side * .085;
            f.line(x, y, tx, y - .065, 5, 7, 3);
            f.line(tx, y - .065, x + side * .048, y + .005, 3, 7, 3);
        }
        // A modest coneflower-like head: fluted petals below a compact raised disk.
        for (let petal = 0; petal < 9; petal++) {
            const a = petal * TAU / 9, rx = Math.cos(a) * .19, ry = Math.sin(a) * .095 + .055;
            f.line(fx + rx * .45 * 2 / worldW, fy + ry * .35 * 2 / worldH, fx + rx * 2 / worldW, fy + ry * 2 / worldH, occupied ? 8 : 6, 8, 4, petal % 2 === 0 ? 'o' : ':');
        }
        f.mark(fx - .04 * 2 / worldW, fy, 'o', 8, 8, 5);
        f.mark(fx + .04 * 2 / worldW, fy, 'o', 8, 8, 5);
        f.mark(fx, fy - .04 * 2 / worldH, '@', occupied ? 9 : 8, 11, 5);
    }
    if (g.pointer.active && o.director.pointerMode !== 'off') {
        for (let k = 0; k < 8; k++) {
            const a = k * TAU / 8;
            f.mark(g.pointer.x + Math.cos(a) * .16 * 2 / worldW, g.pointer.y + Math.sin(a) * .16 * 2 / worldH, '.', 4, 9, 6);
        }
        f.mark(g.pointer.x, g.pointer.y, o.director.pointerMode === 'breeze' ? '~' : '+', 7, 9, 6);
    }
    const members = [...g.members].sort((a, b) => a.y - b.y || a.id - b.id);
    for (let order = 0; order < members.length; order++) {
        const m = members[order], scale = Math.max(m.scale * o.scale, worldW / (columns - 1) * 5.4), depth = 10 + order * 3;
        const root = drawAnimal(f, o, { ...m, scale, ink: m.id + 1, clock: g.clock, blur: !still }, depth);
        if (m.activity.kind === 'nectar') {
            const flowerId = m.activity.flower;
            const flower = g.flowers.find(item => item.id === flowerId);
            if (flower) {
                const hx = root.rootX + .53 * root.si * scale, hy = root.rootY - .53 * root.co * scale, fx = flower.x * worldW * .5, fy = flower.y * worldH * .5;
                // Physical reach gate also protects extreme scale/edge-fitting cases.
                // Never stretch a feeding tube across empty air while still arriving.
                if (Math.hypot(fx - hx, fy - hy) < scale * .69) {
                    const mx = (hx + fx) * .5 + .045 * scale, my = (hy + fy) * .5;
                    f.line(hx * 2 / worldW, hy * 2 / worldH, mx * 2 / worldW, my * 2 / worldH, 7, 11, depth + 1, '.');
                    f.line(mx * 2 / worldW, my * 2 / worldH, flower.x, flower.y, 7, 11, depth + 1, '.');
                }
            }
        }
        if (o.director.showLabels) {
            const c = clamp(Math.round(((root.rootX + root.maxX) / worldW + .5) * (columns - 1)) + 2, 1, columns - 2);
            const r = clamp(Math.round(((root.rootY + root.minY) / worldH + .5) * (rows - 1)) - 1, 1, rows - 2);
            f.put(c, r, String(m.id + 1), 7, m.id + 1, depth + 2);
        }
    }
    return f.frame(phase);
}
//# sourceMappingURL=render-garden.js.map