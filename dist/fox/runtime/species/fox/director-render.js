/** Species-local composition: reuse the existing bounded Fox polygon rasterizer. */
import { buildFoxGrid, FOX_GLYPHS } from './preview.js';
import { finite, integer, plain, clamp } from './config.js';
import { FOX_DIRECTOR_LIMITS } from './director.js';
const PALETTE = ['#10191c', '#da9754', '#f6e5bb', '#947656', '#f6d399', '#30463f', '#66806a', '#b7bc9d', '#c69e5c'];
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
    // Stable, sparse scenery has a fixed allocation budget and no particle pool.
    const horizon = Math.floor(rows * (portrait && count > 1 ? .17 : .30));
    for (let col = 2; col < cols - 2; col += 3) {
        const ridge = horizon + Math.round(Math.sin(col * .065) * 1.3);
        mark(col, ridge, '.', 5);
    }
    for (let i = 0; i < FOX_DIRECTOR_LIMITS.maxAccents; i++) {
        const col = (i * 37 + frame.state.seed % cols) % (cols - 4) + 2;
        const row = horizon + 3 + (i * 11) % Math.max(1, Math.floor(rows * .93) - horizon - 3);
        const sway = Math.sin(time / 90 + i * .9) * wind;
        mark(col, row, sway < -.25 ? '\\' : sway > .25 ? '/' : '|', i % 3 ? 5 : 6);
        if (i % 3 === 0)
            mark(col + (sway > 0 ? 1 : -1), row - 1, "'", 6);
    }
    const moonX = Math.floor(cols * .82), moonY = Math.floor(rows * .13);
    for (let dy = -2; dy <= 2; dy++)
        for (let dx = -3; dx <= 3; dx++)
            if ((dx * dx / 9 + dy * dy / 4) < 1.2 && dx + dy < 2)
                mark(moonX + dx, moonY + dy, dy === -2 || dy === 2 ? '.' : dx === -3 ? '(' : dx === 3 ? ')' : 'o', 7);
    for (let i = 0; i < 11; i++)
        mark((i * 29 + 13) % (cols - 8) + 4, 3 + (i * 7) % Math.max(1, Math.floor(rows * .25)), i % 4 === 0 ? '+' : '.', i % 4 === 0 ? 7 : 5);
    const arranged = frame.actors.map(({ actor, pose }) => {
        let x = actor.x, ground = actor.y, size = actor.size;
        if (portrait && count > 1) {
            x = actor.x * .42;
            ground = count === 2 ? [.22, .88][actor.id] : [-.08, .42, .92][actor.id];
            size = count === 2 ? .76 : .65;
        }
        const shown = transformed(pose, x, ground, size);
        return { actor, pose: shown, ground, size, origin: { x: shown.root.x - pose.root.x * size, y: shown.root.y - (pose.root.y - .55) * size } };
    }).sort((a, b) => a.ground - b.ground || a.actor.id - b.actor.id);
    const anchors = arranged.map(item => Object.freeze({ id: item.actor.id,
        center: Object.freeze({ x: (item.pose.bounds.minX + item.pose.bounds.maxX) / 2, y: (item.pose.bounds.minY + item.pose.bounds.maxY) / 2 }),
        origin: Object.freeze(item.origin), logical: Object.freeze({ x: item.actor.x, y: item.actor.y }), scale: item.size }));
    // Stable contact marks establish three ground lanes even while a fox is airborne.
    // At most 3 marks x 3 glyphs; scenery never replaces an animal cell.
    for (const item of arranged) {
        const q = at(item.origin.x, item.origin.y + .025);
        for (const dx of [-3, 0, 3])
            mark(q.col + dx, q.row, '_', 5);
    }
    for (const item of arranged) {
        const grid = buildFoxGrid(item.pose, { cols, rows, monochrome: options.monochrome ?? false });
        for (let i = 0; i < grid.glyphs.length; i++)
            if (grid.glyphs[i]) {
                glyphs[i] = FOX_GLYPHS[grid.glyphs[i]].charCodeAt(0);
                materials[i] = grid.materials[i];
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
        context.fillText(String.fromCharCode(glyph), ox + (i % grid.cols + .5) * cw, oy + (Math.floor(i / grid.cols) + .5) * ch);
    }
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
