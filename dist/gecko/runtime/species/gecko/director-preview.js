import { rasterizeGeckos } from './preview.js';
import { GECKO_DIRECTOR_LIMITS } from './director.js';
function line(put, a, b, glyph, material, spacing = .045) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / spacing);
    for (let i = 0; i <= n; i++) {
        const t = n ? i / n : 0;
        put(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, glyph, .4, material);
    }
}
function environment(state, put, viewport, focus) {
    // Original procedural masonry: sparse imperfect courses and vertical seams.
    for (let row = -3; row <= 3; row++) {
        const y = row * .61 + .10;
        for (let x = -3.25; x <= 3.25; x += .12)
            put(x, y + .025 * Math.sin(x * 4 + row), row % 2 ? '.' : '-', .25, 4);
        for (let brick = -2; brick <= 2; brick++) {
            const x = brick * 1.38 + (row % 2 ? .55 : 0);
            line(put, { x, y: y + .06 }, { x: x + .05, y: y + .53 }, ':', 4, .085);
        }
    }
    // A pale crescent and its clipped light on the wall.
    for (let r = .27; r <= .48; r += .05)
        for (let a = -2.9; a < 2.9; a += .10) {
            const x = -2.43 + Math.cos(a) * r, y = -1.36 + Math.sin(a) * r;
            if (Math.hypot(x + 2.23, y + 1.43) > .41)
                put(x, y, a < 0 ? '.' : ':', .6, 5);
        }
    // Three real cracks remain stationary references for planted climbing.
    for (const [x, y, sign] of [[-1.85, .68, 1], [.14, .72, -1], [1.78, -.55, 1]]) {
        line(put, { x, y }, { x: x + .18 * sign, y: y - .33 }, '/', 8);
        line(put, { x: x + .18 * sign, y: y - .33 }, { x: x - .06 * sign, y: y - .61 }, '|', 8);
    }
    if (state.options.scene === 'lantern-hunt' || state.moth.visible) {
        const lamp = { x: .78, y: -1.55 };
        line(put, { x: lamp.x - .16, y: lamp.y - .10 }, { x: lamp.x + .16, y: lamp.y - .10 }, '_', 7);
        line(put, { x: lamp.x - .16, y: lamp.y - .10 }, { x: lamp.x - .12, y: lamp.y + .18 }, '|', 7);
        line(put, { x: lamp.x + .16, y: lamp.y - .10 }, { x: lamp.x + .12, y: lamp.y + .18 }, '|', 7);
        put(lamp.x, lamp.y + .04, '*', 1, 7);
        for (let y = lamp.y + .24; y < .48; y += .13)
            for (let x = lamp.x - (y - lamp.y) * .42; x < lamp.x + (y - lamp.y) * .42; x += .18)
                put(x, y, '.', .2, 8);
    }
    if (state.options.showRoutes)
        for (const actor of state.individuals) {
            for (let i = 0; i < actor.route.length; i++)
                line(put, actor.route[i], actor.route[(i + 1) % actor.route.length], '.', 6, .12);
        }
    if (state.shadow.active) {
        const p = state.shadow.position, shift = (state.shadow.progress - .5) * 1.9;
        for (let y = -1.55; y <= 1.50; y += .065)
            for (let dx = -.33; dx <= .33; dx += .08) {
                const x = p.x + shift + y * .22 + dx;
                put(x, y, ':', .15, 8, -.5);
            }
        // Sparse leading/trailing edges make the cause readable on a dark wall;
        // the darker interior still leaves the animals' contrast and toes intact.
        for (let y = -1.55; y <= 1.50; y += .105)
            for (const edge of [-.36, .36])
                put(p.x + shift + y * .22 + edge, y, '/', .45, 6, -.4);
    }
    if (state.pointer) {
        const p = state.pointer;
        put(p.x, p.y, '+', .8, 7, .8);
        for (let a = 0; a < Math.PI * 2; a += .42)
            put(p.x + .13 * Math.cos(a), p.y + .13 * Math.sin(a), '.', .5, 6, -.1);
    }
    if (state.moth.visible) {
        const p = state.moth.position, wing = .10 + .035 * Math.sin(state.tick * .38);
        put(p.x, p.y, '*', 1, 7, 1);
        put(p.x - wing, p.y - .035, '/', 1, 7, 1);
        put(p.x + wing, p.y - .035, '\\', 1, 7, 1);
        put(p.x - wing * .7, p.y + .045, '\\', 1, 7, 1);
        put(p.x + wing * .7, p.y + .045, '/', 1, 7, 1);
    }
    const visible = focus ? state.individuals.filter(a => a.id === focus) : state.individuals;
    for (const actor of visible) {
        const body = actor.body, p = { x: body.position.x * actor.scale, y: body.position.y * actor.scale };
        // Labels are plain ASCII cells, sharing projection and export with the wall.
        const label = `${actor.id === state.selectedId ? '>' : ' '}${actor.label.toUpperCase()}`;
        const cell = viewport.width / (viewport.width < 4 ? 112 : 224);
        for (let j = 0; j < label.length; j++)
            put(p.x - .14 + j * cell, p.y + .58 * actor.scale, label[j], .8, 9, .5);
        if (actor.motive === 'strike') {
            const mouth = { x: p.x + Math.cos(body.heading) * .55 * actor.scale, y: p.y + Math.sin(body.heading) * .55 * actor.scale };
            line((x, y, g, t, m) => put(x, y, g, t, m, .6), mouth, { x: mouth.x + Math.cos(body.heading) * .18, y: mouth.y + Math.sin(body.heading) * .18 }, '-', 7, .03);
        }
    }
}
export function renderGeckoDirectorGrid(state, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options) || ![Object.prototype, null].includes(Object.getPrototypeOf(options)))
        throw new TypeError('Director preview must be a plain object');
    for (const key of Reflect.ownKeys(options))
        if (typeof key !== 'string' || !['cols', 'rows', 'neutral', 'focus'].includes(key))
            throw new TypeError(`Unknown director preview field ${String(key)}`);
    const cols = options.cols === undefined ? 224 : options.cols, rows = options.rows === undefined ? 144 : options.rows;
    if (!Number.isSafeInteger(cols) || cols < 112 || cols > 256 || !Number.isSafeInteger(rows) || rows < 50 || rows > 168)
        throw new RangeError('Director grid must be112..256 by50..168');
    if (options.neutral !== undefined && typeof options.neutral !== 'boolean')
        throw new TypeError('neutral must be boolean');
    const focused = options.focus == null ? null : state.individuals.find(a => a.id === options.focus);
    if (options.focus != null && !focused)
        throw new RangeError('Focus must name an active individual');
    const viewport = focused
        ? { width: 3.4, height: 2.6, centerX: focused.body.position.x * focused.scale, centerY: focused.body.position.y * focused.scale }
        : { width: GECKO_DIRECTOR_LIMITS.worldWidth, height: GECKO_DIRECTOR_LIMITS.worldHeight, centerX: 0, centerY: 0 };
    // The close view is a portrait: other residents keep simulating but do not
    // enter as clipped half-silhouettes at its edges.
    const layers = (focused ? [focused] : state.individuals).map(a => ({ state: { ...a.body, tailCurl: Math.max(a.body.tailCurl, a.tailExpression) }, scale: a.scale, blink: a.blink }));
    const grid = rasterizeGeckos(layers, cols, rows, viewport, options.neutral ?? false, put => environment(state, put, viewport, focused?.id ?? null));
    return { ...grid, viewport, theme: 'moonlight' };
}
