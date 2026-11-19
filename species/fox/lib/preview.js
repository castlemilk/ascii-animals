import { FOX_LIMITS, finite, integer, plain } from './config.js';
// Keep the original solo renderer's declared repertoire and glyph indices.
// The director may translate a guard-hair sample into a directional ASCII mark.
export const FOX_GLYPHS = ' .:-=+*#%@o';
export const FOX_COLORS = Object.freeze([
    '#10191e', '#c98049', '#eadbbb', '#766653', '#eed4a0',
    '#283c40', '#536a60', '#a8b2a3', '#c5aa77',
    '#93684f', '#dfa267', '#aaa18a', '#c78d57', '#765c4a',
    '#b8b098', '#635c50', '#b29166', '#f0dfbd', '#35494f',
    '#7a8067', '#34483f',
]);
const materialIndex = { fur: 1, cream: 2, shadow: 3, ink: 4 };
function coatMaterial(id, material) {
    if (id === 'back-guard' || id === 'shoulder-guard' || id === 'tail-dorsal')
        return 9;
    if (id === 'flank-light' || id === 'brow-light')
        return 10;
    if (id === 'belly-undercoat')
        return 11;
    if (id === 'tail-flank' || id === 'haunch-ruff')
        return 12;
    if (id === 'tail-undercoat')
        return 13;
    if (id === 'tail-tip-shade')
        return 14;
    if (id === 'ear-far' || id === 'ear-near')
        return 15;
    if (id.endsWith('ankle-light'))
        return 16;
    if (id === 'tail-tip')
        return 17;
    if (id.endsWith('inner'))
        return 12;
    return materialIndex[material];
}
function inside(x, y, points) {
    let hit = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i], b = points[j];
        if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)
            hit = !hit;
    }
    return hit;
}
export function buildFoxGrid(pose, options = {}) {
    plain(options, 'grid options');
    for (const key of Object.keys(options))
        if (!['cols', 'rows', 'monochrome'].includes(key))
            throw new TypeError(`Unknown grid option ${key}`);
    const cols = integer(options.cols ?? 112, FOX_LIMITS.minCols, FOX_LIMITS.maxCols, 'cols');
    const rows = integer(options.rows ?? 44, FOX_LIMITS.minRows, FOX_LIMITS.maxRows, 'rows');
    if (options.monochrome !== undefined && typeof options.monochrome !== 'boolean')
        throw new TypeError('monochrome must be boolean');
    if (!pose || pose.species !== 'fox' || !Array.isArray(pose.polygons) || pose.polygons.length > FOX_LIMITS.maxPolygons)
        throw new TypeError('Expected a bounded FoxPose');
    let vertices = 0;
    for (const polygon of pose.polygons) {
        if (!polygon || !Object.hasOwn(materialIndex, polygon.material) || !Array.isArray(polygon.points) || polygon.points.length < 3)
            throw new TypeError('Invalid fox polygon');
        finite(polygon.depth, 'polygon depth');
        vertices += polygon.points.length;
        if (vertices > FOX_LIMITS.maxVertices)
            throw new RangeError('Too many fox vertices');
        for (const p of polygon.points) {
            finite(p.x, 'vertex x');
            finite(p.y, 'vertex y');
            if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1)
                throw new RangeError('Fox vertex outside normalized bounds');
        }
    }
    const glyphs = new Uint8Array(cols * rows), materials = new Uint8Array(cols * rows);
    const depths = new Float64Array(cols * rows).fill(-Infinity);
    // A cell is half as wide as it is tall. Uniform physical scale prevents
    // arbitrary cols/rows from stretching the authored fox anatomy.
    const units = Math.min(cols * .5 / 2, rows / 1.6), cw = .5 / units, ch = 1 / units;
    const originY = rows * .35;
    const right = pose.landmarks.muzzle.x > pose.landmarks.tailRoot.x;
    for (const p of pose.polygons) {
        const xs = p.points.map(q => q.x), ys = p.points.map(q => q.y);
        const left = Math.min(...xs), top = Math.min(...ys), spanX = Math.max(...xs) - left, spanY = Math.max(...ys) - top;
        const color = coatMaterial(p.id, p.material);
        // One visible side-profile eye and one nose. Small filled ellipses used to
        // straddle several cells, creating two eyes and a blocky 2x2 nose in stills.
        if (p.id === 'eye' || p.id === 'nose') {
            const x = (Math.min(...xs) + Math.max(...xs)) / 2, y = (Math.min(...ys) + Math.max(...ys)) / 2;
            const col = Math.floor(cols / 2 + x / cw), row = Math.floor(originY + y / ch);
            if (col >= 0 && col < cols && row >= 0 && row < rows) {
                const index = row * cols + col;
                depths[index] = p.depth;
                materials[index] = 4;
                glyphs[index] = options.monochrome ? 7 : p.id === 'eye' ? 10 : 9;
            }
            continue;
        }
        const minCol = Math.max(0, Math.floor(cols / 2 + Math.min(...xs) / cw) - 1);
        const maxCol = Math.min(cols - 1, Math.ceil(cols / 2 + Math.max(...xs) / cw));
        const minRow = Math.max(0, Math.floor(originY + Math.min(...ys) / ch) - 1);
        const maxRow = Math.min(rows - 1, Math.ceil(originY + Math.max(...ys) / ch));
        for (let row = minRow; row <= maxRow; row++)
            for (let col = minCol; col <= maxCol; col++) {
                const index = row * cols + col;
                if (p.depth < depths[index])
                    continue;
                const x = (col + .5 - cols / 2) * cw, y = (row + .5 - originY) * ch;
                // Four stable subsamples keep thin paws and ear tips present at 80x32.
                let coverage = 0;
                for (const dy of [-.25, .25])
                    for (const dx of [-.25, .25])
                        if (inside(x + dx * cw, y + dy * ch, p.points))
                            coverage++;
                if (!coverage)
                    continue;
                depths[index] = p.depth;
                materials[index] = color;
                // Hair runs within the moving coat patch, not in a global checkerboard.
                // At the minimum grid the broad tone planes do the work; only larger
                // patches receive separated guard-hair strokes.
                const u = (x - left) / Math.max(spanX, cw), v = (y - top) / Math.max(spanY, ch);
                const strand = (Math.floor((right ? 1 - u : u) * 19 + v * 3) + Math.floor(v * 6) * 2) % 7;
                const fine = cols >= 112 && spanX / cw > 9 && spanY / ch > 2;
                const hair = 7;
                glyphs[index] = options.monochrome ? 7 : p.material === 'ink' ? 9 :
                    p.id.endsWith('paw') ? (coverage > 2 ? 7 : 4) :
                        p.id.includes('bone') ? (coverage > 2 ? 8 : 5) :
                            p.material === 'cream' ? (coverage > 2 ? (p.id === 'tail-tip' || strand < 3 ? 6 : 4) : 4) :
                                coverage < 2 ? 5 : color === 9 ? (fine && strand === 1 ? hair : strand === 4 ? 5 : 6) :
                                    fine && strand === 1 ? hair : coverage === 2 || strand === 4 ? 5 : 6;
            }
    }
    let occupied = 0;
    const lines = [];
    for (let row = 0; row < rows; row++) {
        let line = '';
        for (let col = 0; col < cols; col++) {
            const g = glyphs[row * cols + col];
            line += FOX_GLYPHS[g];
            if (g)
                occupied++;
        }
        lines.push(line);
    }
    return { cols, rows, glyphs, materials, text: lines.join('\n'), occupied };
}
export function paintFoxGrid(context, grid, width, height, options = {}) {
    finite(width, 'paint width');
    finite(height, 'paint height');
    if (width <= 0 || height <= 0 || width > 1280 || height > 768)
        throw new RangeError('Paint dimensions outside 1..1280 x 1..768');
    integer(grid.cols, FOX_LIMITS.minCols, FOX_LIMITS.maxCols, 'grid cols');
    integer(grid.rows, FOX_LIMITS.minRows, FOX_LIMITS.maxRows, 'grid rows');
    if (grid.glyphs.length !== grid.cols * grid.rows || grid.materials.length !== grid.glyphs.length)
        throw new RangeError('Invalid grid buffers');
    const ch = Math.min(height / grid.rows, width / (grid.cols * .5)), cw = ch * .5;
    const offsetX = (width - grid.cols * cw) / 2, offsetY = (height - grid.rows * ch) / 2;
    const size = Math.min(ch * .88, cw * 1.6);
    context.fillStyle = FOX_COLORS[0];
    context.fillRect(0, 0, width, height);
    context.font = `600 ${size}px ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let i = 0; i < grid.glyphs.length; i++) {
        const glyph = grid.glyphs[i];
        if (!glyph)
            continue;
        context.fillStyle = options.monochrome ? '#eadbbb' : FOX_COLORS[grid.materials[i]];
        context.fillText(FOX_GLYPHS[glyph], offsetX + ((i % grid.cols) + .5) * cw, offsetY + (Math.floor(i / grid.cols) + .5) * ch);
    }
}
