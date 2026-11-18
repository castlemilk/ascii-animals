import { buildOwlGeometry, owlSurfaceTone } from './geometry.js';
/** Only a local review fixture. Not a shared engine, Canvas renderer or npm export. */
export const GLYPHS = ' .,:;+=ox%#@-v';
const RAMP = ' .,:;+=ox%#@';
export const OWL_GRID_LIMITS = Object.freeze({ minCols: 64, maxCols: 160, minRows: 36, maxRows: 90, maxCells: 14400 });
const allowedKeys = new Set(['cols', 'rows', 'cellAspect', 'silhouette']);
function integer(value, min, max, label) {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
        throw new RangeError(`${label} must be an integer in ${min}..${max}`);
    }
    return value;
}
/** Grid resolution may vary; framing never follows the owl or zooms during motion. */
export function renderOwlGrid(state, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options))
        throw new TypeError('Expected grid options');
    for (const key of Object.keys(options))
        if (!allowedKeys.has(key))
            throw new TypeError(`Unknown grid option: ${key}`);
    const cols = integer(options.cols ?? 96, 64, 160, 'cols');
    const rows = integer(options.rows ?? 54, 36, 90, 'rows');
    const cellAspect = options.cellAspect ?? .55;
    if (typeof cellAspect !== 'number' || !Number.isFinite(cellAspect) || cellAspect < .45 || cellAspect > .70) {
        throw new RangeError('cellAspect must be finite in .45.. .70');
    }
    if (options.silhouette !== undefined && typeof options.silhouette !== 'boolean')
        throw new TypeError('silhouette must be boolean');
    const physicalAspect = cols * cellAspect / rows;
    // Extreme grids would erase or crop silhouette anchors. Fixed framing deliberately
    // accepts only useful portrait-to-landscape specimen windows.
    if (physicalAspect < .92 || physicalAspect > 1.90)
        throw new RangeError('Grid physical aspect must be .92..1.90');
    const size = cols * rows;
    const geometry = buildOwlGeometry(state);
    const owners = new Int16Array(size).fill(-1);
    const depth = new Float64Array(size).fill(-Infinity);
    const tones = new Float64Array(size);
    const worldHeight = 2.40, worldWidth = worldHeight * physicalAspect;
    const dx = worldWidth / cols, dy = worldHeight / rows;
    const top = -1.18, left = -worldWidth / 2;
    const contrast = state.config.featherContrast;
    // Rasterize only the small analytic surface bounding boxes, not every surface
    // at every cell. This is deliberately specialised to the owl's two primitives.
    for (let surfaceIndex = 0; surfaceIndex < geometry.surfaces.length; surfaceIndex++) {
        const surface = geometry.surfaces[surfaceIndex];
        const c = Math.cos(surface.rotation), s = Math.sin(surface.rotation);
        const halfWidth = Math.abs(c) * surface.rx + Math.abs(s) * surface.ry;
        const halfHeight = Math.abs(s) * surface.rx + Math.abs(c) * surface.ry;
        const firstCol = Math.max(0, Math.floor((surface.cx - halfWidth - left) / dx));
        const lastCol = Math.min(cols - 1, Math.ceil((surface.cx + halfWidth - left) / dx));
        const firstRow = Math.max(0, Math.floor((surface.cy - halfHeight - top) / dy));
        const lastRow = Math.min(rows - 1, Math.ceil((surface.cy + halfHeight - top) / dy));
        for (let row = firstRow; row <= lastRow; row++) {
            const y = top + (row + .5) * dy;
            for (let col = firstCol; col <= lastCol; col++) {
                const x = left + (col + .5) * dx;
                const px = x - surface.cx, py = y - surface.cy;
                const u = (c * px + s * py) / surface.rx;
                const v = (-s * px + c * py) / surface.ry;
                const q = surface.shape === 'ellipse' ? u * u + v * v : Math.abs(u) + Math.abs(v);
                if (q > 1)
                    continue;
                const dome = Math.sqrt(Math.max(0, 1 - q));
                const z = surface.z + surface.depth * dome;
                const index = row * cols + col;
                // Stable surface order resolves exact-depth overlaps consistently.
                if (z <= depth[index])
                    continue;
                depth[index] = z;
                owners[index] = surfaceIndex;
                tones[index] = owlSurfaceTone(surface, u, v, dome, contrast);
            }
        }
    }
    const samples = new Array(size).fill(null);
    const parts = new Array(size).fill(null);
    const lines = [];
    let occupied = 0;
    for (let row = 0; row < rows; row++) {
        let line = '';
        for (let col = 0; col < cols; col++) {
            const index = row * cols + col;
            const owner = owners[index];
            if (owner < 0) {
                line += ' ';
                continue;
            }
            const surface = geometry.surfaces[owner];
            const tone = tones[index];
            occupied++;
            parts[index] = surface.part;
            samples[index] = Object.freeze({ x: left + (col + .5) * dx, y: top + (row + .5) * dy,
                z: depth[index], tone, part: surface.part, material: surface.material });
            line += options.silhouette ? '#' : glyph(surface, tone, state.blink);
        }
        lines.push(line);
    }
    return Object.freeze({ cols, rows, text: lines.join('\n'), occupied,
        parts: Object.freeze(parts), samples: Object.freeze(samples) });
}
function glyph(surface, tone, blink) {
    if (surface.material === 'pupil')
        return ' ';
    if (surface.material === 'highlight')
        return '@';
    if (surface.material === 'eye' && blink > .85)
        return '-';
    if (surface.material === 'beak' && tone < .35)
        return 'v';
    const level = Math.max(1, Math.min(RAMP.length - 1, Math.round(tone * (RAMP.length - 1))));
    return RAMP[level];
}
