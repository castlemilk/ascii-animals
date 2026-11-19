import { rasterizeGeckos } from './preview.js';
import { GECKO_DIRECTOR_LIMITS } from './director.js';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function line(put, a, b, glyph, material, spacing = .045, depth = -5) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / spacing);
    for (let i = 0; i <= n; i++) {
        const t = n ? i / n : 0;
        put(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, glyph, .4, material, depth);
    }
}
function environment(state, put, focus) {
    // The masonry, mineral grains and chips are immutable wall coordinates.
    // Three distinct depth layers establish contact without a moving wallpaper.
    for (let row = -2; row <= 3; row++) {
        const y = row * .62 + .13;
        for (let x = -3.28; x <= 3.28; x += .095) {
            const edge = y + .018 * Math.sin(x * 4 + row);
            if (Math.sin(x * 8 + row * 3) > .12) {
                put(x, edge + .026, '_', .18, 11, -6);
                put(x, edge, row % 2 === 0 ? '-' : '.', .32, 4, -5.8);
            }
        }
        for (let brick = -2; brick <= 2; brick++) {
            const x = brick * 1.38 + (row % 2 ? .57 : 0);
            line(put, { x, y: y + .08 }, { x: x + .04, y: y + .53 }, ':', 8, .085, -6);
            put(x + .05, y + .10, '-', .45, 12, -5.7);
        }
    }
    // Chipped lime plaster reveals small sections of the darker courses beneath.
    for (let iy = 0; iy < 39; iy++)
        for (let ix = 0; ix < 68; ix++) {
            const x = -3.2 + ix * .096, y = -1.12 + iy * .081;
            const noise = (Math.imul(ix + 7, 73856093) ^ Math.imul(iy + 17, 19349663) ^ state.seed) >>> 0;
            const patch = Math.sin(x * 2.1 + .3) * .27 + Math.cos(y * 2.7 - x) * .20;
            const weathered = (x < -2.35 + patch) || (x > 2.4 + patch) || (y > 1.35 + patch * .55);
            if (weathered && noise % 3 === 0)
                put(x, y, noise % 5 === 0 ? ':' : '.', .26, 8, -5.6);
            else if (noise % 31 === 0)
                put(x, y, '.', .26, 4, -5.5);
        }
    // A continuous broken edge, not an outline rectangle around the scene.
    for (let x = -3.3; x <= 3.3; x += .055) {
        const y = -1.26 + .035 * Math.sin(x * 3) + .018 * Math.sin(x * 11);
        if (x < -.95 || x > 1.85)
            put(x, y, x < 0 ? '_' : '.', .42, 12, -5.2);
    }
    for (let r = .25; r <= .43; r += .04)
        for (let a = -2.9; a < 2.9; a += .16) {
            const x = -2.48 + Math.cos(a) * r, y = -1.78 + Math.sin(a) * r;
            if (Math.hypot(x + 2.31, y + 1.86) > .36)
                put(x, y, ':', .6, 5, -5.1);
        }
    for (const p of [{ x: -1.51, y: -1.86 }, { x: -2.98, y: -1.65 }, { x: -.68, y: -1.98 }])
        put(p.x, p.y, '.', .4, 5, -5.1);
    const cracks = [
        [{ x: -1.87, y: 1.08 }, { x: -1.76, y: .73 }, { x: -1.86, y: .49 }, { x: -1.68, y: .19 }, { x: -1.77, y: -.06 }, { x: -1.61, y: -.36 }],
        [{ x: .17, y: .92 }, { x: .06, y: .67 }, { x: .23, y: .39 }, { x: .15, y: .09 }, { x: .32, y: -.14 }],
        [{ x: 1.75, y: -.72 }, { x: 1.90, y: -.42 }, { x: 1.78, y: -.18 }, { x: 1.88, y: .16 }, { x: 1.78, y: .40 }]
    ];
    for (const points of cracks)
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1], b = points[i], g = b.x > a.x ? '\\' : '/';
            line(put, { x: a.x + .025, y: a.y + .025 }, { x: b.x + .025, y: b.y + .025 }, g, 11, .038, -4.9);
            line(put, a, b, g, i % 2 === 0 ? 12 : 4, .063, -4.8);
            if (i % 2 === 0)
                line(put, b, { x: b.x + .11, y: b.y - .07 }, '-', 12, .055, -4.8);
        }
    // Two short lips of surviving plaster remain close to the climbing routes.
    // These landmarks are fixed to the wall, so a planted fan has a visible
    // reference even in the selected portrait. They never follow the camera.
    for (const [x, y] of [[-2.03, .72], [-.16, .10]])
        for (let i = 0; i < 16; i++) {
            const px = x + i * .043, py = y + .025 * Math.sin(i * .4);
            put(px, py + .035, '_', .2, 11, -4.7);
            put(px, py, '_', .5, 12, -4.6);
        }
    // A quiet fern lives at the edge, clear of the routes and toe silhouettes.
    const stem = { x: 2.87, y: 1.95 };
    for (let branch = 0; branch < 3; branch++) {
        const end = { x: 2.45 + branch * .22, y: .83 + branch * .14 };
        line(put, stem, end, '/', 6, .07, -3);
        for (let i = 1; i < 7; i++) {
            const t = i / 7, p = { x: stem.x + (end.x - stem.x) * t, y: stem.y + (end.y - stem.y) * t };
            const width = .23 * Math.sin(Math.PI * t);
            line(put, p, { x: p.x - width, y: p.y - .09 }, '/', 6, .06, -3);
            line(put, p, { x: p.x + width * .8, y: p.y - .12 }, '\\', 6, .06, -3);
        }
    }
    if (state.options.scene === 'lantern-hunt' || state.moth.visible) {
        const lamp = { x: .78, y: -1.53 };
        line(put, { x: lamp.x, y: -1.93 }, { x: lamp.x, y: lamp.y - .13 }, '|', 4, .05);
        line(put, { x: lamp.x - .16, y: lamp.y - .11 }, { x: lamp.x + .16, y: lamp.y - .11 }, '_', 12);
        line(put, { x: lamp.x - .16, y: lamp.y - .10 }, { x: lamp.x - .12, y: lamp.y + .18 }, '|', 7);
        line(put, { x: lamp.x + .16, y: lamp.y - .10 }, { x: lamp.x + .12, y: lamp.y + .18 }, '|', 7);
        line(put, { x: lamp.x - .12, y: lamp.y + .18 }, { x: lamp.x + .12, y: lamp.y + .18 }, '_', 12);
        put(lamp.x, lamp.y + .04, '*', 1, 7);
        for (let y = lamp.y + .29; y < -.35; y += .15)
            for (let x = lamp.x - (y - lamp.y) * .34; x < lamp.x + (y - lamp.y) * .34; x += .20)
                put(x, y, '.', .2, 8, -5.4);
    }
    if (state.options.showRoutes)
        for (const actor of state.individuals) {
            for (let i = 0; i < actor.route.length; i++)
                line(put, actor.route[i], actor.route[(i + 1) % actor.route.length], '.', 6, .15, -3);
        }
    if (state.shadow.active) {
        const p = state.shadow.position, shift = (state.shadow.progress - .5) * 1.9;
        for (let y = -1.15; y <= 1.50; y += .075)
            for (let dx = -.33; dx <= .33; dx += .09)
                put(p.x + shift + y * .22 + dx, y, ':', .15, 11, -.5);
        for (let y = -1.15; y <= 1.50; y += .13)
            for (const edge of [-.36, .36])
                put(p.x + shift + y * .22 + edge, y, '/', .4, 8, -.4);
    }
    const visible = focus ? state.individuals.filter(a => a.id === focus) : state.individuals;
    for (const actor of visible) {
        const body = actor.body, p = { x: body.position.x * actor.scale, y: body.position.y * actor.scale };
        // Low, narrow contact shadows. Each planted palm uses its actual immutable
        // anchor; there are no screen-space offsets applied to the animal itself.
        for (const foot of body.feet)
            if (foot.phase === 'stance') {
                const x = foot.position.x * actor.scale, y = foot.position.y * actor.scale;
                put(x + .023, y + .036, '.', .15, 11, -.2);
            }
        for (let i = -7; i <= 7; i++) {
            const t = i / 7, x = p.x + Math.cos(body.heading) * t * .26 * actor.scale + .055;
            const y = p.y + Math.sin(body.heading) * t * .26 * actor.scale + .075;
            put(x, y, ':', .15, 11, -.2);
        }
    }
    if (state.pointer) {
        const p = state.pointer;
        put(p.x, p.y, '+', .8, 7, .8);
        put(p.x - .10, p.y, '.', .5, 7, -.1);
        put(p.x + .10, p.y, '.', .5, 7, -.1);
    }
    if (state.moth.visible) {
        const p = state.moth.position, fold = (Math.sin(state.tick * .38) + 1) / 2, wing = .07 + .04 * fold;
        put(p.x, p.y, 'o', 1, 7, 1);
        put(p.x - wing, p.y - .025, '/', 1, 7, 1);
        put(p.x + wing, p.y - .025, '\\', 1, 7, 1);
        put(p.x - wing * .65, p.y + .04, '\\', 1, 7, 1);
        put(p.x + wing * .65, p.y + .04, '/', 1, 7, 1);
    }
}
export function renderGeckoDirectorGrid(state, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options) || ![Object.prototype, null].includes(Object.getPrototypeOf(options)))
        throw new TypeError('Director preview must be a plain object');
    for (const key of Reflect.ownKeys(options))
        if (typeof key !== 'string' || !['cols', 'rows', 'neutral', 'focus'].includes(key))
            throw new TypeError(`Unknown director preview field ${String(key)}`);
    const cols = options.cols === undefined ? 224 : options.cols, rows = options.rows === undefined ? 112 : options.rows;
    if (!Number.isSafeInteger(cols) || cols < 112 || cols > 256 || !Number.isSafeInteger(rows) || rows < 50 || rows > 168)
        throw new RangeError('Director grid must be112..256 by50..168');
    if (options.neutral !== undefined && typeof options.neutral !== 'boolean')
        throw new TypeError('neutral must be boolean');
    const focused = options.focus == null ? null : state.individuals.find(a => a.id === options.focus);
    if (options.focus != null && !focused)
        throw new RangeError('Focus must name an active individual');
    const viewport = focused
        ? { width: 2.55, height: 2.75, centerX: focused.body.position.x * focused.scale, centerY: focused.body.position.y * focused.scale }
        : { width: GECKO_DIRECTOR_LIMITS.worldWidth, height: GECKO_DIRECTOR_LIMITS.worldHeight, centerX: 0, centerY: 0 };
    const layers = (focused ? [focused] : state.individuals).map(a => {
        const p = { x: a.body.position.x * a.scale, y: a.body.position.y * a.scale };
        const target = ['stalk', 'poise', 'strike'].includes(a.motive) ? state.moth.position : a.goal;
        const delta = target ? Math.atan2(target.y - p.y, target.x - p.x) - a.body.heading : 0;
        const headTurn = clamp(Math.atan2(Math.sin(delta), Math.cos(delta)), -.18, .18);
        return { state: { ...a.body, tailCurl: Math.max(a.body.tailCurl, a.tailExpression) }, scale: a.scale,
            pose: { headTurn, crouch: a.motive === 'poise' ? 1 : 0, headReach: a.motive === 'strike' ? .022 : a.motive === 'poise' ? -.016 : 0, jawOpen: a.motive === 'strike' ? 1 : 0 } };
    });
    const grid = rasterizeGeckos(layers, cols, rows, viewport, options.neutral ?? false, put => environment(state, put, focused?.id ?? null));
    return { ...grid, viewport, theme: 'moonlight' };
}
