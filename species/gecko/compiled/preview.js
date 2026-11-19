/** Species-local orthographic diagnostic preview; not a shared renderer fork. */
import { GECKO_LIMITS } from './gecko.js';
import { sampleGecko } from './geometry.js';
export const GECKO_GLYPHS = ' .:-=+*#%@oO|';
export const GECKO_VIEW = Object.freeze({ width: 3.4, height: 2.6 });
const RAMP = '.:-=+*#%@';
const MATERIALS = { skin: 0, pad: 1, eye: 2, pupil: 3 };
/** The same Gecko sample/depth/glyph seam serves solo and the opt-in wall. */
export function rasterizeGeckos(layers, cols, rows, viewport, neutral, environment) {
    const count = cols * rows, glyphs = new Uint8Array(count).fill(32), tones = new Float32Array(count), materials = new Uint8Array(count), depth = new Float64Array(count).fill(-Infinity);
    let occupied = 0, samples = 0, marks = 0;
    function write(x, y, z, glyph, tone, material) {
        const col = Math.floor(((x - viewport.centerX) / viewport.width + .5) * cols), row = Math.floor(((y - viewport.centerY) / viewport.height + .5) * rows);
        if (col < 0 || row < 0 || col >= cols || row >= rows)
            return;
        const index = row * cols + col;
        if (z <= depth[index])
            return;
        if (depth[index] === -Infinity)
            occupied++;
        depth[index] = z;
        tones[index] = tone;
        materials[index] = material;
        glyphs[index] = glyph.charCodeAt(0);
    }
    if (environment && !neutral)
        environment((x, y, glyph, tone, material, z = -5) => {
            if (marks++ >= 4096)
                return;
            write(x, y, z, glyph, Math.max(0, Math.min(1, tone)), material);
        });
    layers.forEach((layer, index) => {
        const result = sampleGecko(layer.state, p => {
            const spotted = p.material === 'skin' && p.tone < .36;
            const tone = neutral ? 1 : p.tone, material = neutral ? 0 : spotted ? 10 : MATERIALS[p.material];
            // Tokay eyelids are fused transparent spectacles: retain the legacy blink
            // flag in snapshots, but never erase the eye behind a mammalian blink.
            const glyph = neutral ? '#' : p.material === 'pad' ? 'o' : p.material === 'eye' ? 'O' : p.material === 'pupil' ? '|' : spotted ? '*' : RAMP[Math.min(RAMP.length - 1, Math.floor(p.tone * RAMP.length))];
            write(p.x * layer.scale, p.y * layer.scale, p.z * layer.scale + index * .00001, glyph, tone, material);
        }, layer.pose);
        samples += result.samples;
    });
    const lines = [];
    for (let row = 0; row < rows; row++)
        lines.push(String.fromCharCode(...glyphs.subarray(row * cols, (row + 1) * cols)));
    return { cols, rows, text: lines.join('\n'), glyphs, tones, materials, occupied, samples };
}
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
    return rasterizeGeckos([{ state, scale: 1 }], cols, rows, { ...GECKO_VIEW, centerX: 0, centerY: 0 }, options.neutral ?? false);
}
/** Draw exactly the logical cell identities, with a fixed, letterboxed world aspect. */
export function drawGeckoGrid(ctx, grid, width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 1000 || height > 780)
        throw new RangeError('Preview size must be positive, at most 1000x780');
    const viewport = grid.viewport ?? GECKO_VIEW, aspect = viewport.width / viewport.height;
    const w = Math.min(width, height * aspect), h = w / aspect, left = (width - w) / 2, top = (height - h) / 2;
    const cw = w / grid.cols, ch = h / grid.rows, fontSize = Math.min(cw / .6, ch) * .98;
    ctx.fillStyle = grid.theme === 'moonlight' ? '#101d21' : '#101c19';
    ctx.fillRect(0, 0, width, height);
    ctx.font = `${fontSize}px ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const palette = Array.from({ length: 24 }, (_, i) => {
        const t = i / 23;
        return `rgb(${Math.round(75 + 118 * t)},${Math.round(117 + 111 * t)},${Math.round(116 + 102 * t)})`;
    });
    for (let i = 0; i < grid.glyphs.length; i++) {
        const char = grid.glyphs[i];
        if (char === 32)
            continue;
        const material = grid.materials[i];
        ctx.fillStyle = material === 1 ? '#f1dcad' : material === 2 ? '#f5d58a' : material === 3 ? '#101d21' : material === 4 ? '#64736d' : material === 5 ? '#8f9c89' : material === 6 ? '#496752' : material === 7 ? '#f0c078' : material === 8 ? '#2e4245' : material === 9 ? '#c5d7bc' : material === 10 ? '#c98e64' : material === 11 ? '#091517' : material === 12 ? '#919583' : palette[Math.min(23, Math.floor(grid.tones[i] * 23))];
        ctx.fillText(String.fromCharCode(char), left + (i % grid.cols + .5) * cw, top + (Math.floor(i / grid.cols) + .5) * ch);
    }
}
/** Map CSS input through the identical painter letterbox into world space. */
export function geckoPointFromCanvas(grid, width, height, clientX, clientY, rect) {
    if (![width, height, clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || width <= 0 || height <= 0 || rect.width <= 0 || rect.height <= 0)
        return null;
    const viewport = grid.viewport ?? { ...GECKO_VIEW, centerX: 0, centerY: 0 }, aspect = viewport.width / viewport.height;
    const w = Math.min(width, height * aspect), h = w / aspect, left = (width - w) / 2, top = (height - h) / 2;
    const px = (clientX - rect.left) / rect.width * width, py = (clientY - rect.top) / rect.height * height;
    if (px < left || py < top || px > left + w || py > top + h)
        return null;
    return { x: viewport.centerX + ((px - left) / w - .5) * viewport.width, y: viewport.centerY + ((py - top) / h - .5) * viewport.height };
}
