/** Species-local composition: reuse the existing bounded Fox polygon rasterizer. */
import { buildFoxGrid, FOX_GLYPHS, FOX_COLORS } from './preview.js';
import { finite, integer, plain, clamp } from './config.js';
import { FOX_DIRECTOR_LIMITS } from './director.js';
const PALETTE = FOX_COLORS;
/** A stable coordinate perturbation, never ambient/frame-dependent randomness. */
function meadowSeed(seed, index) {
    let n = Math.imul(seed ^ (index + 1) * 0x45d9f3b, 0x27d4eb2d);
    n ^= n >>> 15;
    return (n >>> 0) / 0x100000000;
}
function transformed(pose, x, ground, size) {
    let shiftX = x, shiftY = ground;
    const minX = x + pose.bounds.minX * size, maxX = x + pose.bounds.maxX * size;
    if (minX < -.97)
        shiftX += -.97 - minX;
    if (maxX > .97)
        shiftX -= maxX - .97;
    const minY = ground + (pose.bounds.minY - .55) * size, maxY = ground + (pose.bounds.maxY - .55) * size;
    if (minY < -.94)
        shiftY += -.94 - minY;
    if (maxY > .94)
        shiftY -= maxY - .94;
    const point = (p) => ({ x: shiftX + p.x * size, y: shiftY + (p.y - .55) * size });
    const polygons = pose.polygons.map(p => ({ ...p, points: p.points.map(point) }));
    const all = polygons.flatMap(p => p.points);
    return { ...pose, root: point(pose.root), polygons, legs: pose.legs.map(l => ({ ...l, joints: l.joints.map(point) })),
        landmarks: Object.fromEntries(Object.entries(pose.landmarks).map(([key, p]) => [key, point(p)])),
        bounds: { minX: Math.min(...all.map(p => p.x)), maxX: Math.max(...all.map(p => p.x)), minY: Math.min(...all.map(p => p.y)), maxY: Math.max(...all.map(p => p.y)) } };
}
/** Glyph buffers contain printable ASCII character codes, with 0 for empty cells. */
export function buildFoxSceneGrid(frame, options = {}) {
    plain(options, 'scene grid options');
    for (const key of Object.keys(options))
        if (!['cols', 'rows', 'monochrome'].includes(key))
            throw new TypeError(`Unknown scene grid option: ${key}`);
    const cols = integer(options.cols ?? 160, 112, 160, 'scene cols'), rows = integer(options.rows ?? 64, 48, 64, 'scene rows');
    if (options.monochrome !== undefined && typeof options.monochrome !== 'boolean')
        throw new TypeError('monochrome must be boolean');
    if (!frame || frame.state?.schemaVersion !== 1 || !Array.isArray(frame.actors) || frame.actors.length < 1 || frame.actors.length > 3)
        throw new TypeError('Expected a bounded FoxDirectorFrame');
    const glyphs = new Uint8Array(cols * rows), materials = new Uint8Array(cols * rows), owners = new Int8Array(cols * rows).fill(-1);
    const units = Math.min(cols * .5 / 2, rows / 1.6), cw = .5 / units, ch = 1 / units, originY = rows * .35;
    const at = (x, y) => ({ col: Math.floor(cols / 2 + x / cw), row: Math.floor(originY + y / ch) });
    function mark(col, row, char, material) {
        if (col < 0 || col >= cols || row < 0 || row >= rows)
            return;
        const i = row * cols + col;
        if (owners[i] !== -1)
            return;
        glyphs[i] = char.charCodeAt(0);
        materials[i] = material;
    }
    const time = frame.tableau ? 0 : frame.state.tick, wind = frame.options.wind;
    const count = frame.actors.length, portrait = cols < 128;
    // Dusk has three deliberate depth planes: a low ridge, two grass banks and
    // sparse foreground tussocks. The clear middle lane belongs to the foxes.
    // The stem budget is unchanged and no scenery pool grows with elapsed time.
    const horizon = Math.floor(rows * (portrait && count > 1 ? .18 : .29));
    for (let col = 1; col < cols - 1; col++) {
        const u = col / cols;
        const ridge = horizon - Math.round(2.4 * Math.exp(-Math.pow((u - .23) / .22, 2))
            + 1.8 * Math.exp(-Math.pow((u - .82) / .18, 2)));
        if (col % 3 !== 1)
            mark(col, ridge, col % 5 === 0 ? "'" : '.', 18);
        if (col % 4 === 0)
            mark(col, ridge + 2, '.', 5);
    }
    // Soft distant stems are confined to the edges; they never cut a line
    // across the ears or divide the scene into a uniform background grid.
    for (const edge of [0, 1])
        for (let branch = 0; branch < 5; branch++) {
            const col = Math.round((edge ? .88 : .045) * cols) + branch * 2;
            const height = 2 + branch % 3;
            for (let up = 0; up < height; up++)
                mark(col, horizon + 2 - up, up === height - 1 ? '^' : '|', 5);
            mark(col - 1, horizon + 1, '/', 5);
            mark(col + 1, horizon + 1, '\\', 5);
        }
    const banks = portrait ? [[.08, .47], [.90, .45], [.08, .85], [.89, .90]] :
        [[.10, .75], [.89, .65], [.06, .94], [.93, .94]];
    for (let i = 0; i < FOX_DIRECTOR_LIMITS.maxAccents; i++) {
        const bank = banks[i % banks.length], u = meadowSeed(frame.state.seed, i), v = meadowSeed(frame.state.seed, i + 71);
        const col = Math.round((bank[0] + (u - .5) * .14) * cols);
        const row = Math.min(rows - 2, Math.round((bank[1] + (v - .5) * .10) * rows));
        const height = 1 + Math.floor(v * 3), sway = Math.sin(time / 110 + i * .73) * wind;
        const lean = sway < -.3 ? -1 : sway > .3 ? 1 : 0;
        for (let up = 0; up < height; up++)
            mark(col + (up === height - 1 ? lean : 0), row - up, up === height - 1 ? (lean < 0 ? '\\' : lean > 0 ? '/' : "'") : '|', row > rows * .8 ? 6 : 5);
        if (i % 4 === 0)
            mark(col + lean, row - height, "'", row > rows * .8 ? 19 : 6);
    }
    // Broken ground strokes suggest a path without adding a floor-wide carpet.
    for (let i = 0; i < 15; i++) {
        const col = Math.round(cols * (.18 + i * .043)), row = Math.round(rows * (.89 + .03 * Math.sin(i * .7)));
        if (i % 3 !== 1)
            mark(col, row, i % 2 ? '_' : '.', 5);
    }
    const moonX = Math.floor(cols * .79), moonY = Math.floor(rows * .10);
    for (let dy = -2; dy <= 2; dy++)
        for (let dx = -3; dx <= 3; dx++)
            if ((dx * dx / 9 + dy * dy / 4) < 1.2 && dx + dy < 2)
                mark(moonX + dx, moonY + dy, dy === -2 || dy === 2 ? '.' : dx === -3 ? '(' : dx === 3 ? ')' : 'o', 7);
    for (let i = 0; i < 6; i++)
        mark((i * 29 + 13) % (cols - 8) + 4, 3 + (i * 7) % Math.max(1, Math.floor(rows * .20)), i === 2 ? '+' : '.', i === 2 ? 7 : 5);
    const arranged = frame.actors.map(({ actor, pose }) => {
        let x = actor.x, ground = actor.y, size = actor.size;
        if (!portrait && count === 2 && actor.id === 0) {
            x += .08;
            size *= 1.12;
        }
        // A phone gives each of the first two foxes its own wide lane. Merely
        // shrinking the landscape cast made flank texture and paws disappear.
        if (portrait && count <= 2) {
            x = 0;
            ground = count === 1 ? .72 : [.22, .90][actor.id];
            size = count === 1 ? 1.02 : actor.id === 0 ? 1 : .94;
        }
        else if (portrait) {
            x = actor.x * .42;
            ground = [-.08, .42, .92][actor.id];
            size = .65;
        }
        const shown = transformed(pose, x, ground, size);
        return { actor, pose: shown, ground, size, origin: { x: shown.root.x - pose.root.x * size, y: shown.root.y - (pose.root.y - .55) * size } };
    }).sort((a, b) => a.ground - b.ground || a.actor.id - b.actor.id);
    const anchors = arranged.map(item => Object.freeze({ id: item.actor.id,
        center: Object.freeze({ x: (item.pose.bounds.minX + item.pose.bounds.maxX) / 2, y: (item.pose.bounds.minY + item.pose.bounds.maxY) / 2 }),
        origin: Object.freeze(item.origin), logical: Object.freeze({ x: item.actor.x, y: item.actor.y }), scale: item.size }));
    // A broad soft shadow remains on the ground during the leap; smaller contact
    // strokes follow only planted paws. These are fixed marks, not particle trails.
    for (const item of arranged) {
        const q = at(item.origin.x + item.actor.state.rootX * item.size, item.origin.y + .025);
        for (const dx of [-6, -4, -2, 0, 2, 4, 6])
            mark(q.col + dx, q.row, dx % 4 === 0 ? '_' : '.', 20);
        for (const leg of item.pose.legs)
            if (leg.planted) {
                const foot = leg.joints[leg.joints.length - 1], p = at(foot.x, foot.y + .025);
                mark(p.col, p.row, '_', 19);
                mark(p.col + 1, p.row, '_', 20);
            }
    }
    for (const item of arranged) {
        const grid = buildFoxGrid(item.pose, { cols, rows, monochrome: options.monochrome ?? false });
        const right = item.pose.landmarks.muzzle.x > item.pose.landmarks.tailRoot.x;
        for (let i = 0; i < grid.glyphs.length; i++)
            if (grid.glyphs[i]) {
                const material = grid.materials[i], sample = grid.glyphs[i];
                const guard = !options.monochrome && sample === 7 && [1, 9, 10, 12].includes(material);
                glyphs[i] = (guard ? (right ? '/' : '\\') : FOX_GLYPHS[sample]).charCodeAt(0);
                materials[i] = material;
                owners[i] = item.actor.id;
            }
        if (frame.options.showLabels) {
            const anchor = at((item.pose.bounds.minX + item.pose.bounds.maxX) / 2, item.pose.bounds.maxY + .065);
            const label = `${item.actor.id === frame.state.selectedId ? '>' : ' '}${item.actor.name.toUpperCase()}`;
            for (let i = 0; i < label.length; i++)
                mark(anchor.col - Math.floor(label.length / 2) + i, anchor.row, label[i], item.actor.id === frame.state.selectedId ? 2 : 6);
        }
    }
    if (frame.state.rustle && !frame.tableau) {
        const r = frame.state.rustle, owner = arranged.find(a => a.actor.id === r.owner);
        const x = portrait && owner ? (owner.pose.bounds.minX + owner.pose.bounds.maxX) / 2 : r.x;
        const y = portrait && owner ? owner.pose.bounds.maxY + .04 : clamp(r.y, .1, .85), q = at(x, y);
        if (r.age < 150) {
            mark(q.col, q.row, r.age < 55 ? '*' : '+', 8);
            mark(q.col - 2, q.row, '.', 8);
            mark(q.col + 2, q.row, '.', 8);
        }
    }
    else if (frame.options.scene === 'moon-play') {
        const q = at(.12 + Math.sin(time / 170) * .25, .32 + Math.cos(time / 140) * .07);
        mark(q.col, q.row, '~', 8);
        mark(q.col + 1, q.row, "'", 8);
    }
    let occupied = 0;
    const lines = [];
    for (let row = 0; row < rows; row++) {
        let line = '';
        for (let col = 0; col < cols; col++) {
            const code = glyphs[row * cols + col];
            line += code ? String.fromCharCode(code) : ' ';
            if (code)
                occupied++;
        }
        lines.push(line);
    }
    return { cols, rows, glyphs, materials, owners, anchors: Object.freeze(anchors), text: lines.join('\n'), occupied };
}
export function paintFoxSceneGrid(context, grid, width, height, options = {}) {
    finite(width, 'paint width');
    finite(height, 'paint height');
    if (width <= 0 || height <= 0 || width > 1280 || height > 768)
        throw new RangeError('Scene backing dimensions exceed budget');
    integer(grid.cols, 112, 160, 'scene cols');
    integer(grid.rows, 48, 64, 'scene rows');
    if (grid.glyphs.length !== grid.cols * grid.rows || grid.materials.length !== grid.glyphs.length || grid.owners.length !== grid.glyphs.length)
        throw new RangeError('Invalid scene buffers');
    const ch = Math.min(height / grid.rows, width / (grid.cols * .5)), cw = ch * .5, ox = (width - grid.cols * cw) / 2, oy = (height - grid.rows * ch) / 2;
    context.fillStyle = PALETTE[0];
    context.fillRect(0, 0, width, height);
    context.font = `600 ${Math.min(ch * .9, cw * 1.7)}px ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let i = 0; i < grid.glyphs.length; i++) {
        const glyph = grid.glyphs[i];
        if (!glyph)
            continue;
        context.fillStyle = options.monochrome ? '#f6e5bb' : PALETTE[grid.materials[i]] ?? PALETTE[2];
        context.globalAlpha = grid.owners[i] > 0 ? .93 : 1;
        context.fillText(String.fromCharCode(glyph), ox + (i % grid.cols + .5) * cw, oy + (Math.floor(i / grid.cols) + .5) * ch);
    }
    context.globalAlpha = 1;
}
/** Coordinates within the painted cell rectangle, not the surrounding letterbox. */
export function hitFoxScene(grid, x, y) {
    finite(x, 'hit x');
    finite(y, 'hit y');
    if (x < -1 || x > 1 || y < -1 || y > 1)
        return null;
    const col = Math.min(grid.cols - 1, Math.floor((x + 1) * .5 * grid.cols)), row = Math.min(grid.rows - 1, Math.floor((y + 1) * .5 * grid.rows));
    const owner = grid.owners[row * grid.cols + col];
    return owner !== undefined && owner >= 0 ? owner : null;
}
/** Map a painted-cell point back into the selected actor's logical director space.
 * Visible ownership wins for clicks; empty space selects the nearest presented fox.
 * A preferred ID keeps hover attention on the deliberate selection. No pose is rebuilt.
 */
export function routeFoxScenePointer(grid, x, y, preferredId) {
    finite(x, 'pointer x');
    finite(y, 'pointer y');
    if (preferredId !== undefined)
        integer(preferredId, 0, 2, 'preferred fox id');
    if (x < -1 || x > 1 || y < -1 || y > 1)
        return null;
    const units = Math.min(grid.cols * .5 / 2, grid.rows / 1.6);
    const world = { x: x * grid.cols * .25 / units, y: ((y + 1) * grid.rows * .5 - grid.rows * .35) / units };
    const owner = preferredId ?? hitFoxScene(grid, x, y);
    let anchor = owner === null ? undefined : grid.anchors.find(a => a.id === owner);
    if (preferredId !== undefined && !anchor)
        throw new RangeError('Preferred fox is not in this scene');
    if (!anchor) {
        let distance = Infinity;
        for (const a of grid.anchors) {
            const d = Math.hypot(world.x - a.center.x, world.y - a.center.y);
            if (d < distance) {
                distance = d;
                anchor = a;
            }
        }
    }
    if (!anchor)
        return null;
    return { id: anchor.id, point: { x: clamp(anchor.logical.x + (world.x - anchor.origin.x) / anchor.scale, -1, 1),
            y: clamp(anchor.logical.y + (world.y - anchor.origin.y) / anchor.scale, -1, 1) } };
}
