/** Species-local orthographic diagnostic preview; not a shared renderer fork. */
import { GECKO_LIMITS } from './gecko.js';
import { sampleGecko } from './geometry.js';
export const GECKO_GLYPHS = ' .:-=+*#%@oO';
export const GECKO_VIEW = Object.freeze({ width: 3.4, height: 2.6 });
const RAMP = '.:-=+*#%@';
const MATERIALS = { skin: 0, pad: 1, eye: 2, pupil: 3 };
export function renderGeckoGrid(state, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options) ||
        (Object.getPrototypeOf(options) !== Object.prototype && Object.getPrototypeOf(options) !== null))
        throw new TypeError('view must be a plain object');
    for (const key of Reflect.ownKeys(options))
        if (typeof key !== 'string' || !['cols', 'rows', 'neutral'].includes(key))
            throw new TypeError(`Unknown view option: ${String(key)}`);
    const cols = options.cols === undefined ? 176 : options.cols, rows = options.rows === undefined ? 78 : options.rows;
    if (!Number.isSafeInteger(cols) || cols < GECKO_LIMITS.minCols || cols > GECKO_LIMITS.maxCols ||
        !Number.isSafeInteger(rows) || rows < GECKO_LIMITS.minRows || rows > GECKO_LIMITS.maxRows)
        throw new RangeError('Grid must be 112..192 columns and 50..86 rows');
    if (options.neutral !== undefined && typeof options.neutral !== 'boolean')
        throw new TypeError('neutral must be boolean');
    const count = cols * rows, glyphs = new Uint8Array(count).fill(32), tones = new Float32Array(count), materials = new Uint8Array(count), depth = new Float64Array(count).fill(-Infinity);
    let occupied = 0;
    const result = sampleGecko(state, p => {
        const col = Math.floor((p.x / GECKO_VIEW.width + .5) * cols), row = Math.floor((p.y / GECKO_VIEW.height + .5) * rows);
        // The fixed stage intentionally never recenters to hide simulation drift.
        if (col < 0 || row < 0 || col >= cols || row >= rows)
            return;
        const index = row * cols + col;
        if (p.z <= depth[index])
            return;
        if (depth[index] === -Infinity)
            occupied++;
        depth[index] = p.z;
        tones[index] = options.neutral ? 1 : p.tone;
        materials[index] = options.neutral ? 0 : MATERIALS[p.material];
        const glyph = options.neutral ? '#' : p.material === 'pad' ? 'o' : p.material === 'eye' ? 'O' : p.material === 'pupil' ? '.' : RAMP[Math.min(RAMP.length - 1, Math.floor(p.tone * RAMP.length))];
        glyphs[index] = glyph.charCodeAt(0);
    });
    const lines = [];
    for (let row = 0; row < rows; row++)
        lines.push(String.fromCharCode(...glyphs.subarray(row * cols, (row + 1) * cols)));
    return { cols, rows, text: lines.join('\n'), glyphs, tones, materials, occupied, samples: result.samples };
}
/** Draw exactly the logical cell identities, with a fixed, letterboxed world aspect. */
export function drawGeckoGrid(ctx, grid, width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 1000 || height > 780)
        throw new RangeError('Preview size must be positive, at most 1000x780');
    const aspect = GECKO_VIEW.width / GECKO_VIEW.height;
    const w = Math.min(width, height * aspect), h = w / aspect, left = (width - w) / 2, top = (height - h) / 2;
    const cw = w / grid.cols, ch = h / grid.rows, fontSize = Math.min(cw / .6, ch) * .98;
    ctx.fillStyle = '#101c19';
    ctx.fillRect(0, 0, width, height);
    ctx.font = `${fontSize}px ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const palette = Array.from({ length: 24 }, (_, i) => {
        const t = i / 23;
        return `rgb(${Math.round(85 + 120 * t)},${Math.round(119 + 105 * t)},${Math.round(98 + 100 * t)})`;
    });
    for (let i = 0; i < grid.glyphs.length; i++) {
        const char = grid.glyphs[i];
        if (char === 32)
            continue;
        const material = grid.materials[i];
        ctx.fillStyle = material === 1 ? '#ead5a6' : material === 2 ? '#f4edcf' : material === 3 ? '#263e32' : palette[Math.min(23, Math.floor(grid.tones[i] * 23))];
        ctx.fillText(String.fromCharCode(char), left + (i % grid.cols + .5) * cw, top + (Math.floor(i / grid.cols) + .5) * ch);
    }
}
