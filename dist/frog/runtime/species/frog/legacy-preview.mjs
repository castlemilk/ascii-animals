/**
 * Frog-local typed rasterizer, derived from the original glyph projection math. Reuses methods from dist/artwork.js at
 * 0e446c47b491b751d484e40db753ec725652b515 (SHA-256 in INTEGRATION.md).
 * Self-contained: does not read browser globals or depend on Cuttlefish internals.
 * Its buffer/layout contract remains internal; the public factory owns lifecycle.
 */
import { clamp, finite, integer, landingTarget, ownKeys } from './frog.mjs';
import { sampleFrog } from './geometry.mjs';
export const LEGACY_GLYPHS = '.,:;!i1l+txzvcofnae0&%8B@';
export const LEGACY_SOURCE_SHA256 = '381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91';
const methods = {
    makeAtlas() {
        const sz = Math.min(64, Math.max(1, Math.ceil(this.cellH * 1.6 * this.dpr)));
        this.sprite = sz;
        this.atlas.width = LEGACY_GLYPHS.length * sz;
        this.atlas.height = 72 * sz;
        const a = this.atlasCtx;
        a.clearRect(0, 0, this.atlas.width, this.atlas.height);
        a.font = `${Math.max(6, this.cellH * .94) * this.dpr}px "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
        a.textAlign = 'center';
        a.textBaseline = 'middle';
        this.colors = [];
        this.colorBytes = [];
        for (let k = 0; k < 3; k++)
            for (let i = 0; i < 24; i++) {
                const t = i / 23, p = k === 2 ? { low: [17, 24, 24], middle: [139, 153, 139], high: [248, 241, 207], fin: [139, 153, 139] } : this.palette;
                const mid = k === 1 ? p.fin : p.middle;
                const rgb = p.low.map((v, j) => Math.round(t < .49 ? v + (mid[j] - v) * t / .49 : mid[j] + (p.high[j] - mid[j]) * (t - .49) / .51));
                const color = `rgb(${rgb.join(',')})`;
                this.colors.push(color);
                this.colorBytes.push(rgb);
                a.fillStyle = color;
                for (let g = 0; g < LEGACY_GLYPHS.length; g++)
                    a.fillText(LEGACY_GLYPHS[g], (g + .5) * sz, (k * 24 + i + .5) * sz + this.dpr * .25);
            }
    },
    _projectWorld(x, y, z) { const p = 1 / Math.max(.24, 1 - z * this.perspectiveStrength); return [this.cx + x * this.scale * p, this.cyScreen + y * this.scale * p, z]; },
    _put(x, y, z, light, kind, seed) {
        x = (x - .30) * this.objectScale;
        y *= this.objectScale;
        z *= this.objectScale;
        const xx = this.worldX + x * this.r00 + y * this.r01 + z * this.r02, yy = this.worldY + x * this.r10 + y * this.r11 + z * this.r12, zz = this.worldZ + x * this.r20 + y * this.r21 + z * this.r22;
        const distance = 1 - zz * this.perspectiveStrength;
        if (distance < .16 || this.sampleCount >= 32000)
            return;
        const perspective = 1 / Math.max(.24, distance), px = xx * perspective, py = yy * perspective;
        this.minX = Math.min(this.minX, px);
        this.maxX = Math.max(this.maxX, px);
        this.minY = Math.min(this.minY, py);
        this.maxY = Math.max(this.maxY, py);
        const n = this.sampleCount++ * 6;
        this.samples[n] = px;
        this.samples[n + 1] = py;
        this.samples[n + 2] = zz;
        this.samples[n + 3] = light;
        this.samples[n + 4] = kind;
        this.samples[n + 5] = seed;
    },
    _rasterize() {
        for (let i = 0; i < this.sampleCount; i++) {
            const n = i * 6, zz = this.samples[n + 2], col = Math.floor((this.cx + this.samples[n] * this.scale) / this.cellW), row = Math.floor((this.cyScreen + this.samples[n + 1] * this.scale) / this.cellH);
            if (col < 0 || col >= this.cols || row < 0 || row >= this.rows)
                continue;
            const index = row * this.cols + col;
            if (zz <= this.depth[index])
                continue;
            this.depth[index] = zz;
            this.owners[index] = this.activeFish.id;
            this.visibility[index] = this.subjectVisibility;
            const fog = clamp(Math.exp(Math.min(0, zz) * .085 * this.depthAmount), .18, 1) * (zz > 0 ? 1.04 : 1), light = clamp(this.samples[n + 3] * fog, .025, 1);
            this.tones[index] = Math.round(light * 23);
            this.kinds[index] = this.samples[n + 4];
            const variation = ((this.samples[n + 5] * 17) & 31) / 31 * .19;
            this.glyphs[index] = clamp(Math.floor((light * .76 + variation) * (LEGACY_GLYPHS.length - 1)), 0, LEGACY_GLYPHS.length - 1);
        }
    }
};
export function validatePreview(patch = {}, base = { cols: 144, rows: 80, view: 'front', silhouette: false }) {
    ownKeys(patch, ['cols', 'rows', 'view', 'silhouette'], 'preview');
    const next = { ...base, ...patch };
    integer(next.cols, 72, 180, 'cols');
    integer(next.rows, 40, 100, 'rows');
    if (!['front', 'left', 'right', 'profile'].includes(next.view))
        throw new TypeError('Unknown view');
    if (typeof next.silhouette !== 'boolean')
        throw new TypeError('silhouette must be boolean');
    return next;
}
export function createLegacyFrogPreview(canvas, options = {}) {
    let settings = validatePreview(options);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx)
        throw new Error('Canvas 2D unavailable. The static specimen and description remain available.');
    const atlas = canvas.ownerDocument.createElement('canvas'), atlasCtx = atlas.getContext('2d');
    if (!atlasCtx)
        throw new Error('Canvas atlas unavailable.');
    const h = {
        width: 1, height: 1, dpr: 1, cols: 1, rows: 1, cellW: 1, cellH: 1.35, atlas, atlasCtx, sprite: 1,
        palette: { low: [24, 63, 47], middle: [102, 183, 117], high: [230, 248, 190], fin: [145, 187, 115] },
        colors: [], colorBytes: [], samples: new Float32Array(32000 * 6), sampleCount: 0,
        depth: new Float32Array(1), tones: new Uint8Array(1), glyphs: new Uint8Array(1), kinds: new Uint8Array(1), owners: new Int16Array(1), visibility: new Float32Array(1),
        cx: 0, cyScreen: 0, scale: 1, worldX: 0, worldY: 0, worldZ: 0, objectScale: 1,
        r00: 1, r01: 0, r02: 0, r10: 0, r11: 1, r12: 0, r20: 0, r21: 0, r22: 1,
        perspectiveStrength: 0, depthAmount: 0, subjectVisibility: 1, activeFish: { id: 0 },
        minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity,
    };
    let disposed = false, rawWidth = 720, rawHeight = 540, rawDpr = 1, lastSize = 1;
    const alive = () => { if (disposed)
        throw new Error('Frog preview disposed'); };
    function resize(width, height, dpr) {
        alive();
        finite(width, 'width');
        finite(height, 'height');
        finite(dpr, 'DPR');
        if (width <= 0 || height <= 0 || dpr <= 0)
            throw new RangeError('Positive preview dimensions required');
        rawWidth = width;
        rawHeight = height;
        rawDpr = dpr;
        const fit = Math.min(1, 1200 / width, 700 / height);
        h.width = Math.max(1, width * fit);
        h.height = Math.max(1, height * fit);
        h.dpr = clamp(dpr, 1, 2);
        h.cellW = Math.max(h.width / settings.cols, h.height / (settings.rows * 1.35));
        h.cellH = h.cellW * 1.35;
        h.cols = Math.min(settings.cols, Math.ceil(h.width / h.cellW));
        h.rows = Math.min(settings.rows, Math.ceil(h.height / h.cellH));
        const n = h.cols * h.rows;
        h.depth = new Float32Array(n);
        h.tones = new Uint8Array(n);
        h.glyphs = new Uint8Array(n);
        h.kinds = new Uint8Array(n);
        h.owners = new Int16Array(n);
        h.visibility = new Float32Array(n);
        canvas.width = Math.round(h.width * h.dpr);
        canvas.height = Math.round(h.height * h.dpr);
        h.cx = h.width * .5;
        h.cyScreen = h.height * .56;
        h.scale = Math.min(h.width / 6.2, h.height / 4.8);
        methods.makeAtlas.call(h);
    }
    function project(x, y, z = 0) { return methods._projectWorld.call(h, x, y, z); }
    function draw(state, geometryOptions = {}) {
        alive();
        lastSize = state.config.size;
        h.sampleCount = 0;
        h.minX = h.minY = Infinity;
        h.maxX = h.maxY = -Infinity;
        h.depth.fill(-Infinity);
        h.owners.fill(-1);
        h.visibility.fill(0);
        const silhouette = geometryOptions.silhouette ?? settings.silhouette;
        const geometry = sampleFrog(state, p => {
            if (h.sampleCount >= 32000)
                throw new RangeError('Frog adapter sample capacity exceeded');
            // Frog coordinates are world-space. Undo only the legacy cuttlefish origin
            // shift, retaining its projection and depth/glyph mapping without copying it.
            methods._put.call(h, p.x + .30, p.y, p.z, p.light, p.material, p.sampleId);
        }, { ...geometryOptions, view: geometryOptions.view ?? settings.view, silhouette });
        if (geometry.count !== h.sampleCount)
            throw new Error('Legacy seam rejected a frog sample');
        methods._rasterize.call(h);
        ctx.setTransform(h.dpr, 0, 0, h.dpr, 0, 0);
        ctx.fillStyle = '#09120f';
        ctx.fillRect(0, 0, h.width, h.height);
        // Explicit non-glyph scenery: a quiet ground ellipse and landing UI reticle.
        const ground = project(state.position.x * 1.5, .2 + state.position.y * .5 + .62 * state.config.size);
        ctx.strokeStyle = '#233a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(ground[0], ground[1], h.scale * 1.05 * state.config.size, h.scale * .16, 0, 0, Math.PI * 2);
        ctx.stroke();
        const target = state.behavior.kind === 'crouch' || state.behavior.kind === 'flight' ? state.behavior.plan.to : state.target ? landingTarget(state) : null;
        if (target) {
            const p = project(target.x * 1.5, .2 + target.y * .5 + .62 * state.config.size);
            ctx.strokeStyle = '#b3cd6e';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 5]);
            ctx.beginPath();
            ctx.ellipse(p[0], p[1], h.scale * .25, h.scale * .09, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#bddc98';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('LAND', p[0], p[1] + h.scale * .22);
        }
        let glyphs = 0;
        const sprite = h.sprite, side = sprite / h.dpr;
        for (let i = 0; i < h.depth.length; i++) {
            if (h.depth[i] === -Infinity)
                continue;
            glyphs++;
            const x = (i % h.cols + .5) * h.cellW, y = (Math.floor(i / h.cols) + .5) * h.cellH;
            const color = silhouette ? 21 : h.kinds[i] * 24 + h.tones[i];
            ctx.drawImage(atlas, (silhouette ? 22 : h.glyphs[i]) * sprite, color * sprite, sprite, sprite, x - side / 2, y - side / 2, side, side);
        }
        return Object.freeze({ glyphs, samples: h.sampleCount, cols: h.cols, rows: h.rows, geometry });
    }
    return Object.freeze({
        resize,
        update(patch) { alive(); const next = validatePreview(patch, settings); settings = next; resize(rawWidth, rawHeight, rawDpr); },
        draw,
        targetAt(p) {
            alive();
            finite(p.x, 'pointer.x');
            finite(p.y, 'pointer.y');
            const x = ((p.x + 1) * .5 * h.width - h.cx) / h.scale / 1.5;
            const y = (((p.y + 1) * .5 * h.height - h.cyScreen) / h.scale - .2 - .62 * lastSize) / .5;
            return Object.freeze({ x: clamp(x, -1, 1), y: clamp(y, -1, 1) });
        },
        toText() {
            alive();
            const rows = [];
            for (let y = 0; y < h.rows; y++) {
                let row = '';
                for (let x = 0; x < h.cols; x++) {
                    const i = y * h.cols + x;
                    row += h.depth[i] === -Infinity ? ' ' : LEGACY_GLYPHS[h.glyphs[i]];
                }
                rows.push(row);
            }
            return rows.join('\n');
        },
        dispose() { if (disposed)
            return; disposed = true; canvas.width = canvas.height = atlas.width = atlas.height = 1; h.samples = new Float32Array(0); h.depth = new Float32Array(0); h.tones = h.glyphs = h.kinds = new Uint8Array(0); h.owners = new Int16Array(0); h.visibility = new Float32Array(0); },
    });
}
