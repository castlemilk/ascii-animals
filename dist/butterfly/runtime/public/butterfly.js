import { getBrowserScheduler } from '../core/scheduler.js';
export const BUTTERFLY_DEFAULTS = Object.freeze({ columns: 120, rows: 50, seed: 7,
    speed: 1, scale: 1, sway: .18, facing: 'left', behavior: 'hover', palette: 'brass', paused: false, reducedMotion: 'system' });
const ranges = { columns: [80, 180], rows: [32, 90], seed: [0, 2147483647], speed: [.25, 2], scale: [.6, 1.3], sway: [0, .4] };
function resolve(patch, base) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch))
        throw new TypeError('Butterfly options must be an object');
    for (const key of Object.keys(patch))
        if (!Object.hasOwn(BUTTERFLY_DEFAULTS, key))
            throw new TypeError(`Unknown butterfly option ${key}`);
    const candidate = { ...base };
    for (const key of Object.keys(BUTTERFLY_DEFAULTS)) {
        const value = patch[key];
        if (value !== undefined)
            Object.defineProperty(candidate, key, { value, enumerable: true, writable: true, configurable: true });
    }
    for (const [key, [lo, hi]] of Object.entries(ranges)) {
        const value = candidate[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < lo || value > hi || (['columns', 'rows', 'seed'].includes(key) && !Number.isInteger(value)))
            throw new RangeError(`Invalid ${key}`);
    }
    if (!['left', 'right'].includes(candidate.facing) || !['hover', 'curious', 'perch'].includes(candidate.behavior) || !['brass', 'lagoon', 'rose'].includes(candidate.palette) || !['system', 'ignore'].includes(candidate.reducedMotion) || typeof candidate.paused !== 'boolean')
        throw new TypeError('Invalid butterfly setting');
    return Object.freeze(candidate);
}
/** The base-taking merge helper is private; all public configuration is validated. */
export function normalizeButterflyOptions(patch = {}) { return resolve(patch, BUTTERFLY_DEFAULTS); }
const TAU = Math.PI * 2, clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function createButterflyModel(input = {}) {
    let options = normalizeButterflyOptions(input), tick = 0, responseTick = null, targetX = 0, targetY = 0;
    const state = () => Object.freeze({ tick, responseTick, targetX, targetY });
    const phase = () => responseTick === null ? 'idle' : tick - responseTick < 45 ? 'approach' : tick - responseTick < 110 ? 'display' : 'settle';
    return Object.freeze({ getOptions: () => options, getState: state, getPhase: phase,
        configure(patch) { options = resolve(patch, options); },
        advanceTicks(ticks) { if (!Number.isInteger(ticks) || ticks < 0 || ticks > 600)
            throw new RangeError('Ticks must be an integer0..600'); tick += ticks; if (responseTick !== null && tick - responseTick >= 180)
            responseTick = null; },
        guide(x, y) { if (!Number.isFinite(x) || !Number.isFinite(y))
            throw new TypeError('Guide requires finite normalized coordinates'); targetX = clamp(x, -1, 1); targetY = clamp(y, -1, 1); },
        greet(poster = false) { if (responseTick === null)
            responseTick = tick - (poster ? 70 : 0); }, reset() { tick = 0; responseTick = null; targetX = targetY = 0; },
        frame() { return renderButterfly(options, state(), phase()); } });
}
/** Pure logical-cell rendering; no DOM, font, random or wall-clock dependency. */
function renderButterfly(o, s, phase) {
    const cols = o.columns, rows = o.rows, worldW = Math.max(6, 3.7 * cols * .56 / rows), worldH = worldW * rows / (cols * .56);
    const glyphs = new Array(cols * rows).fill(' '), tones = new Uint8Array(cols * rows);
    const t = s.tick / 60 * o.speed, seedPhase = (o.seed % 997) / 997 * TAU;
    const age = s.responseTick === null ? 0 : s.tick - s.responseTick;
    const lift = s.responseTick === null ? 0 : Math.sin(Math.PI * clamp(age / 180, 0, 1));
    const dx = o.behavior === 'curious' ? s.targetX * .3 : o.behavior === 'hover' ? Math.sin(t * .65 + seedPhase) * o.sway : 0;
    const bounce = o.behavior === 'perch' ? 0 : Math.sin(t * 1.2) * .08 + (o.behavior === 'curious' ? s.targetY * .15 : 0);
    const mirror = o.facing === 'left' ? 1 : -1, chars = '.,:;+=*#%@';
    function point(x, y, tone, glyph) {
        x = x * o.scale * mirror + dx;
        y = y * o.scale + bounce;
        const c = Math.round((x / worldW + .5) * (cols - 1)), r = Math.round((y / worldH + .5) * (rows - 1));
        if (c < 0 || c >= cols || r < 0 || r >= rows)
            return;
        const i = r * cols + c;
        glyphs[i] = glyph ?? chars[clamp(Math.round(tone), 0, 9)];
        tones[i] = clamp(Math.round(tone), 1, 9);
    }
    const step = worldH / rows * .32;
    function disk(cx, cy, r, tone, glyph) { for (let y = -r; y <= r; y += step)
        for (let x = -r; x <= r; x += step)
            if (x * x + y * y <= r * r)
                point(cx + x, cy + y, tone, glyph); point(cx, cy, tone, glyph); }
    function line(x, y, xx, yy, r, tone, glyph) { const n = Math.max(1, Math.ceil(Math.hypot(xx - x, yy - y) / step)); for (let k = 0; k <= n; k++) {
        const a = k / n;
        disk(x + (xx - x) * a, y + (yy - y) * a, r, tone, glyph);
    } }
    function ellipse(cx, cy, rx, ry, tone) { for (let y = -ry; y <= ry; y += step)
        for (let x = -rx; x <= rx; x += step) {
            const q = x * x / (rx * rx) + y * y / (ry * ry);
            if (q <= 1)
                point(cx + x, cy + y, tone + (1 - q) * 1.8 - y / ry * .4);
        } }
    // Four separate lobes: tall pointed forewings above rounded hindwings.
    // Projection stays at least 38% open so the small-grid silhouette remains legible.
    const opening = o.behavior === 'perch' ? .72 : lift > .2 ? .96 : .38 + .62 * (.5 + .5 * Math.cos(t * 7 + seedPhase));
    function wing(side, upper) {
        const cx = upper ? .70 : .61, cy = upper ? -.48 : .55, rx = upper ? .83 : .64, ry = upper ? .80 : .57;
        const angle = upper ? -.45 : .32, co = Math.cos(angle), si = Math.sin(angle);
        for (let y = -ry; y <= ry; y += step)
            for (let x = -rx; x <= rx; x += step) {
                const q = x * x / (rx * rx) + y * y / (ry * ry);
                if (q > 1)
                    continue;
                const xx = cx + x * co - y * si, yy = cy + x * si + y * co;
                if (xx < .13 + Math.max(0, -yy - .4) * .22)
                    continue;
                const edge = q > .79;
                const vein = Math.abs(Math.sin(Math.atan2(yy, xx) * 8)) < .16;
                const eye = ((x + .05) / (.20)) ** 2 + ((y - (upper ? -.1 : .06)) / .23) ** 2;
                let tone = edge ? 8 : vein ? 3 : 5 + (1 - q) * 1.4;
                let glyph;
                if (eye < 1.0) {
                    tone = eye < .35 ? 3 : 9;
                    glyph = eye < .35 ? 'o' : '@';
                }
                if (edge && Math.floor((Math.atan2(y, x) + Math.PI) * 11) % 3 === 0) {
                    tone = 9;
                    glyph = '.';
                }
                point(side * xx * opening, yy, tone, glyph);
            }
    }
    for (const side of [-1, 1]) {
        wing(side, false);
        wing(side, true);
    }
    // Six fine legs fan from the thorax; clubbed antennae curve above the head.
    for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
            const y = -.04 + k * .17;
            line(side * .07, y, side * .28, y + .12, .014, 5);
            line(side * .28, y + .12, side * .40, y + .08, .012, 5);
        }
        line(side * .05, -.57, side * .16, -1.15, .018, 8);
        line(side * .16, -1.15, side * .30, -1.47, .018, 8);
        disk(side * .31, -1.49, .047, 9, 'o');
    }
    ellipse(0, .28, .09, .54, 6.4);
    for (let k = 0; k < 6; k++)
        line(-.07, .05 + k * .13, .07, .05 + k * .13, .014, 8, '=');
    ellipse(0, -.16, .15, .25, 7);
    ellipse(0, -.48, .12, .13, 8);
    point(-.075, -.50, 9, 'o');
    point(.075, -.50, 9, 'o');
    const cells = Object.freeze(glyphs.map((glyph, i) => Object.freeze({ glyph, tone: tones[i] })));
    let text = '';
    for (let r = 0; r < rows; r++)
        text += glyphs.slice(r * cols, (r + 1) * cols).join('') + (r === rows - 1 ? '' : '\n');
    return Object.freeze({ columns: cols, rows, cells, text, phase });
}
/** Browser-only mount, SSR-safe import. Reduced-motion policy stays authoritative. */
export function createButterflyArtwork(canvas, input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new TypeError('Options must be an object');
    const { frameSource, ...raw } = input;
    const model = createButterflyModel(raw), view = canvas?.ownerDocument?.defaultView, doc = canvas?.ownerDocument;
    if (!view || !doc)
        throw new TypeError('Canvas must belong to a browser document');
    const context = canvas.getContext('2d');
    if (!context)
        throw new Error('Canvas2D unavailable');
    const ctx = context;
    const scheduler = frameSource ?? getBrowserScheduler(view);
    const media = view.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false, requestedPaused = model.getOptions().paused, inViewport = true, width = 0, height = 0, droppedSeconds = 0, last = null, accumulator = 0;
    let unsubscribe = null;
    let ro, io;
    const reduced = () => model.getOptions().reducedMotion === 'system' && media.matches;
    const blocked = () => disposed || requestedPaused || reduced() || doc.hidden || !inViewport || width <= 0 || height <= 0;
    const status = () => Object.freeze({ paused: blocked(), reducedMotion: reduced(), hidden: doc.hidden, inViewport, disposed, phase: model.getPhase(), tick: model.getState().tick, droppedSeconds });
    function draw() {
        if (disposed || width <= 0 || height <= 0)
            return;
        const frame = model.frame(), o = model.getOptions(), cw = width / frame.columns, ch = height / frame.rows;
        ctx.fillStyle = '#09151b';
        ctx.fillRect(0, 0, width, height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${Math.max(5, ch * .93)}px ui-monospace,SFMono-Regular,Consolas,monospace`;
        const palette = o.palette === 'brass' ? [232, 185, 105] : o.palette === 'lagoon' ? [119, 218, 204] : [227, 154, 180];
        for (let i = 0; i < frame.cells.length; i++) {
            const cell = frame.cells[i];
            if (cell.glyph === ' ')
                continue;
            const b = .25 + cell.tone / 12;
            ctx.fillStyle = `rgb(${palette.map(c => Math.round(c * b)).join(',')})`;
            ctx.fillText(cell.glyph, (i % frame.columns + .5) * cw, (Math.floor(i / frame.columns) + .5) * ch);
        }
    }
    function frame(now) { if (disposed || blocked()) {
        sync();
        return;
    } if (last === null) {
        last = now;
        return;
    } const dt = Math.max(0, (now - last) / 1000); last = now; droppedSeconds += Math.max(0, dt - .1); accumulator += Math.min(.1, dt); const ticks = Math.min(6, Math.floor((accumulator + 1e-10) * 60)); if (ticks) {
        accumulator -= ticks / 60;
        model.advanceTicks(ticks);
        draw();
    } }
    function sync() { if (disposed)
        return; if (blocked()) {
        unsubscribe?.();
        unsubscribe = null;
        last = null;
        accumulator = 0;
    }
    else if (!unsubscribe) {
        last = null;
        unsubscribe = scheduler.subscribe(frame);
    } draw(); }
    function resize() { if (disposed)
        return; const r = canvas.getBoundingClientRect(); width = Math.max(0, Math.min(2048, Number.isFinite(r.width) ? r.width : 0)); height = Math.max(0, Math.min(2048, Number.isFinite(r.height) ? r.height : 0)); const dpr = Math.min(2, Math.max(1, view.devicePixelRatio || 1)); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); sync(); }
    function motion() { sync(); }
    function visibility() { sync(); }
    function pointer(e) { if (disposed)
        return; const r = canvas.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0)
        return; const x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1; if (Number.isFinite(x) && Number.isFinite(y)) {
        model.guide(x, y);
        draw();
    } }
    function leave() { if (disposed)
        return; model.guide(0, 0); draw(); }
    function greet() { if (disposed)
        return; model.greet(blocked()); draw(); }
    function dispose() { if (disposed)
        return; disposed = true; unsubscribe?.(); unsubscribe = null; ro?.disconnect(); io?.disconnect(); media.removeEventListener('change', motion); doc.removeEventListener('visibilitychange', visibility); view.removeEventListener('resize', resize); canvas.removeEventListener('pointermove', pointer); canvas.removeEventListener('pointerdown', greet); canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('pointercancel', leave); }
    try {
        media.addEventListener('change', motion);
        doc.addEventListener('visibilitychange', visibility);
        view.addEventListener('resize', resize);
        canvas.addEventListener('pointermove', pointer);
        canvas.addEventListener('pointerdown', greet);
        canvas.addEventListener('pointerleave', leave);
        canvas.addEventListener('pointercancel', leave);
        const host = view;
        if (host.ResizeObserver) {
            ro = new host.ResizeObserver(resize);
            ro.observe(canvas);
        }
        if (host.IntersectionObserver) {
            inViewport = false;
            io = new host.IntersectionObserver(entries => { if (disposed)
                return; inViewport = entries.some(e => e.isIntersecting); sync(); });
            io.observe(canvas);
        }
        resize();
    }
    catch (error) {
        dispose();
        throw error;
    }
    return Object.freeze({ species: 'butterfly', canvas, get disposed() { return disposed; }, getOptions: () => Object.freeze({ ...model.getOptions(), paused: requestedPaused }), getStatus: status, getFrame: () => model.frame(),
        update(patch) { if (disposed)
            return; model.configure(patch); if (patch.paused !== undefined)
            requestedPaused = patch.paused; sync(); }, play() { if (disposed)
            return; requestedPaused = false; sync(); }, pause() { if (disposed)
            return; requestedPaused = true; sync(); }, restart() { if (disposed)
            return; model.reset(); last = null; accumulator = 0; sync(); }, pulse: greet, guide(x, y) { if (disposed)
            return; model.guide(x, y); draw(); }, resize, dispose });
}
//# sourceMappingURL=butterfly.js.map