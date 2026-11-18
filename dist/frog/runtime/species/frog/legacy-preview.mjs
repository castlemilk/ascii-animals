/**
 * Integrated frog-local typed rasterizer, derived from the original glyph
 * projection math. The pond extends this existing pass: one atlas, one cell
 * field, and one sample workspace reused for each actor and environment pass.
 * Self-contained: does not read browser globals or depend on Cuttlefish internals.
 * Its buffer/layout contract remains internal; the public factory owns lifecycle.
 */
import { clamp, finite, integer, landingTarget, ownKeys } from './frog.mjs';
import { sampleFrog, sampleFrogPose } from './geometry.mjs';
import { pondPointToWorld, posePondFrog } from './pond.mjs';
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
            // Equal-depth cells belong to the lower stable actor ID. For the original
            // single owner this retains exactly the former first-sample tie behavior.
            if (zz < this.depth[index] || (zz === this.depth[index] && this.activeFish.id >= this.owners[index]))
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
export function validatePreview(patch = {}, base = { cols: 144, rows: 80, view: 'front', silhouette: false, labels: true, trajectories: false, renderFps: 20 }) {
    ownKeys(patch, ['cols', 'rows', 'view', 'silhouette', 'labels', 'trajectories', 'renderFps'], 'preview');
    const next = { ...base, ...patch };
    integer(next.cols, 72, 180, 'cols');
    integer(next.rows, 40, 100, 'rows');
    if (!['front', 'left', 'right', 'profile'].includes(next.view))
        throw new TypeError('Unknown view');
    if (typeof next.silhouette !== 'boolean')
        throw new TypeError('silhouette must be boolean');
    if (typeof next.labels !== 'boolean' || typeof next.trajectories !== 'boolean')
        throw new TypeError('labels and trajectories must be boolean');
    finite(next.renderFps, 'renderFps');
    if (next.renderFps < 12 || next.renderFps > 30)
        throw new RangeError('renderFps must be in 12..30');
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
    let pondFrame = false, pondContactHeight = .62;
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
        pondFrame = false;
    }
    function project(x, y, z = 0) { return methods._projectWorld.call(h, x, y, z); }
    function draw(state, geometryOptions = {}) {
        alive();
        lastSize = state.config.size;
        pondFrame = false;
        h.activeFish.id = 0;
        h.cx = h.width * .5;
        h.cyScreen = h.height * .56;
        h.scale = Math.min(h.width / 6.2, h.height / 4.8);
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
            // Preserve the integrated renderer's coordinate compensation and mapping.
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
    /** Compose the complete pond through the existing atlas/depth implementation. */
    function drawPond(state, geometryOptions = {}) {
        alive();
        if (!state || state.species !== 'frog-pond' || !Array.isArray(state.actors)
            || state.actors.length < 1 || state.actors.length > 3 || state.actors.length !== state.config.count
            || !Array.isArray(state.pads) || state.pads.length > 6
            || !Array.isArray(state.ripples) || state.ripples.length > 6)
            throw new RangeError('Invalid bounded pond frame');
        const ids = new Set();
        for (const actor of state.actors) {
            integer(actor.id, 0, 2, 'frog ID');
            if (ids.has(actor.id))
                throw new RangeError('Duplicate pond frog ID');
            ids.add(actor.id);
        }
        if (!ids.has(state.selectedId))
            throw new RangeError('Selected pond frog is absent');
        const silhouette = geometryOptions.silhouette ?? settings.silhouette;
        const motion = geometryOptions.motion !== false && geometryOptions.staticPose === undefined && geometryOptions.pondStill === undefined;
        const resolvedGeometry = { ...geometryOptions, view: geometryOptions.view ?? settings.view, silhouette };
        const poses = new Map();
        for (const actor of state.actors)
            poses.set(actor.id, posePondFrog(state, actor, resolvedGeometry));
        const callStrength = new Map();
        for (const actor of state.actors) {
            const strength = geometryOptions.pondStill === 'call' && actor.id === state.selectedId ? 1
                : actor.motive.kind === 'call' ? Math.sin(Math.PI * clamp(actor.motive.age / actor.motive.duration, 0, 1)) ** 2 : 0;
            callStrength.set(actor.id, strength);
        }
        const commonScale = poses.get(state.selectedId).scale;
        pondContactHeight = .62 * commonScale;
        // Fixed camera for all motions in a scene. Flight never auto-fits the view.
        h.cx = h.width * .5;
        h.cyScreen = h.height * .53;
        h.scale = Math.min(h.width / 6.7, h.height / 4.7);
        h.depth.fill(-Infinity);
        h.owners.fill(-1);
        h.visibility.fill(0);
        h.sampleCount = 0;
        h.minX = h.minY = Infinity;
        h.maxX = h.maxY = -Infinity;
        h.activeFish.id = -1;
        let environmentSamples = 0, totalSamples = 0;
        const quietTick = motion ? state.tick : 0;
        const contact = (point) => {
            const p = pondPointToWorld(point);
            return { x: p.x, y: p.y + pondContactHeight, z: p.z };
        };
        function environment(x, y, z, light, material = 1) {
            if (++environmentSamples > 6246 || h.sampleCount >= 32000)
                throw new RangeError('Pond environment sample budget exceeded');
            if (![x, y, z, light].every(Number.isFinite))
                throw new TypeError('Non-finite pond environment sample');
            methods._put.call(h, x + .30, y, z, silhouette ? .30 : clamp(light, .025, 1), material, 100000 + environmentSamples);
        }
        function ring(point, radius, light, z = -2.7, segments = 64) {
            const c = contact(point);
            for (let i = 0; i < segments; i++) {
                const a = i / segments * Math.PI * 2;
                environment(c.x + Math.cos(a) * radius, c.y + Math.sin(a) * radius * .24, z, light, 1);
            }
        }
        // Original pad disks: an elliptical leaf with a radial notch, rim and veins.
        // These are glyph samples, always behind feet; no raster leaf image is used.
        for (const pad of state.pads) {
            const c = contact(pad.point), rx = 1.36 * commonScale, ry = .235 * commonScale;
            const slit = .35 + pad.id * .83, selected = state.previewPad === pad.id;
            for (let r = 0; r <= 10; r++)
                for (let i = 0; i < 44; i++) {
                    const a = i / 44 * Math.PI * 2;
                    const separation = Math.atan2(Math.sin(a - slit), Math.cos(a - slit));
                    if (Math.abs(separation) < .24 && r > 0)
                        continue;
                    const radius = r / 10, leaf = .14 + .07 * (1 - radius) + (selected ? .04 : 0);
                    environment(c.x + Math.cos(a) * rx * radius, c.y + Math.sin(a) * ry * radius, -3.10, leaf);
                }
            for (let i = 0; i < 76; i++) {
                const a = i / 76 * Math.PI * 2;
                if (Math.abs(Math.atan2(Math.sin(a - slit), Math.cos(a - slit))) < .24)
                    continue;
                environment(c.x + Math.cos(a) * rx, c.y + Math.sin(a) * ry, -3.04, selected ? .55 : .38);
            }
            for (let vein = 0; vein < 5; vein++) {
                const a = slit + .38 + vein * (Math.PI * 2 - .76) / 4;
                for (let i = 1; i <= 12; i++) {
                    const radius = i / 12;
                    environment(c.x + Math.cos(a) * rx * radius, c.y + Math.sin(a) * ry * radius, -2.99, .25 + radius * .04);
                }
            }
            // Both edges of the notch expose a recognizable lily-pad wedge.
            for (const direction of [-1, 1])
                for (let i = 1; i <= 12; i++) {
                    const a = slit + direction * .24, radius = i / 12;
                    environment(c.x + Math.cos(a) * rx * radius, c.y + Math.sin(a) * ry * radius, -2.98, .37);
                }
        }
        // A low bank and edge reeds leave the frogs' heads and legs unobscured.
        for (let i = 0; i < 136; i++) {
            const x = -3.15 + 6.3 * i / 135;
            const y = 1.43 + .095 * Math.cos(x * 1.3);
            environment(x, y, -3.5, .23);
            if (i % 3 === 0)
                environment(x, y + .075, -3.5, .12);
        }
        for (const side of [-1, 1])
            for (let stem = 0; stem < 4; stem++) {
                const baseX = side * (2.67 + stem * .11), length = .66 + .16 * (stem % 3);
                const bend = .025 * Math.sin(quietTick / 145 + stem * 1.4 + side);
                for (let i = 0; i <= 25; i++) {
                    const u = i / 25, x = baseX + side * (.09 + bend) * u * u;
                    environment(x, 1.40 - length * u, -3.4, .22 + u * .07);
                    if (i > 20)
                        environment(x + .025, 1.40 - length * u, -3.39, .34, 2);
                }
            }
        // Sparse water glints stay far below the contrast of eyes and limb edges.
        for (let i = 0; i < 42; i++) {
            const x = -2.9 + ((i * 53) % 97) / 96 * 5.8;
            const y = .15 + ((i * 31) % 79) / 78 * 1.1;
            environment(x, y, -3.6, .10 + (i % 3) * .018);
        }
        if (state.config.scene === 'moonlit-chorus') {
            // Two short crescent arcs, sampled as characters in the background.
            for (let i = 0; i < 44; i++) {
                const a = -.65 * Math.PI + i / 43 * 1.3 * Math.PI;
                environment(2.27 + Math.cos(a) * .22, -1.36 + Math.sin(a) * .22, -3.2, .45, 2);
                environment(2.32 + Math.cos(a) * .15, -1.36 + Math.sin(a) * .22, -3.19, .25, 2);
            }
        }
        for (const ripple of state.ripples) {
            const progress = clamp(ripple.age / ripple.ttl, 0, 1);
            const radius = .12 + progress * (.7 + ripple.strength * .35);
            ring(ripple.point, radius, (.22 + ripple.strength * .12) * (1 - progress) + .05);
        }
        if (geometryOptions.pondStill === 'ripple') {
            const p = state.target ?? state.actors.find(a => a.id === state.selectedId).model.position;
            ring(p, .62, .45);
            ring(p, .92, .25);
        }
        for (const actor of state.actors) {
            if (actor.motive.kind !== 'call' && !(geometryOptions.pondStill === 'call' && actor.id === state.selectedId))
                continue;
            const age = actor.motive.kind === 'call' ? actor.motive.age / actor.motive.duration : .45;
            const p = actor.model.position;
            ring(p, .33 + (age % .5) * 1.5, .30, -2.6, 48);
            // Small character wave arcs sit outside the cheeks. Unlike a ground ring,
            // they remain legible above the leaf and do not hide the eyes or forelegs.
            // Four 15-point arcs add exactly 60 bounded samples per calling frog.
            const pose = poses.get(actor.id), strength = callStrength.get(actor.id);
            for (const side of [-1, 1])
                for (let wave = 0; wave < 2; wave++)
                    for (let i = 0; i < 15; i++) {
                        const a = -.65 + i / 14 * 1.30;
                        environment(pose.origin.x + side * (.95 + wave * .18 + .18 * Math.cos(a)) * pose.scale, pose.origin.y + (-.18 + (.55 + wave * .10) * Math.sin(a)) * pose.scale, -2.5, (.20 + .38 * strength) * (1 - wave * .20), 2);
                    }
        }
        const selected = state.actors.find(a => a.id === state.selectedId);
        const stillHunt = geometryOptions.pondStill === 'hunt';
        if (state.firefly || stillHunt) {
            const insectPoint = state.firefly?.point ?? state.target ?? { x: clamp(selected.model.position.x + .3, -.9, .9), y: selected.model.position.y };
            const c = contact(insectPoint), flutter = quietTick / 11;
            const flyX = c.x + (motion ? .06 * Math.sin(flutter * .7) : 0);
            const flyY = c.y - .78 - (motion ? .06 * Math.cos(flutter) : 0);
            const caught = state.firefly?.phase === 'caught';
            const energy = caught ? .35 : .95;
            for (let i = 0; i < 24; i++) {
                const a = i / 24 * Math.PI * 2;
                environment(flyX + .070 * Math.cos(a), flyY + .070 * Math.sin(a), 2.0, energy, 2);
                if (!caught)
                    environment(flyX + .18 * Math.cos(a), flyY + .10 * Math.sin(a), 1.99, .48, 2);
            }
            if (!caught)
                for (let i = -4; i <= 4; i++) {
                    environment(flyX + i * .030, flyY, 2.01, .96, 2);
                    environment(flyX, flyY + i * .022, 2.01, .87, 2);
                }
        }
        if (environmentSamples !== h.sampleCount)
            throw new Error('Pond environment sample rejected');
        methods._rasterize.call(h);
        totalSamples += environmentSamples;
        let selectedGeometry;
        // Reuse the existing 32k workspace per frog, retaining all prior cell depth.
        // Sorted IDs make first-write order explicit as well as tie-safe.
        for (const actor of [...state.actors].sort((a, b) => a.id - b.id)) {
            h.activeFish.id = actor.id;
            h.sampleCount = 0;
            const geometry = sampleFrogPose(poses.get(actor.id), p => {
                if (h.sampleCount >= 32000)
                    throw new RangeError('Pond frog sample capacity exceeded');
                // Calling uses the same throat surface. The bounded expression light
                // makes the expanded sac readable without changing single-frog shading.
                const light = p.part === 'throat' && !silhouette ? clamp(p.light + callStrength.get(actor.id) * .28, .025, 1) : p.light;
                methods._put.call(h, p.x + .30, p.y, p.z, light, p.material, p.sampleId);
            }, resolvedGeometry);
            if (geometry.count !== h.sampleCount)
                throw new Error('Pond frog sample rejected');
            totalSamples += geometry.count;
            if (totalSamples > 60000)
                throw new RangeError('Pond frame sample budget exceeded');
            methods._rasterize.call(h);
            if (actor.id === state.selectedId)
                selectedGeometry = geometry;
        }
        ctx.setTransform(h.dpr, 0, 0, h.dpr, 0, 0);
        ctx.fillStyle = '#09120f';
        ctx.fillRect(0, 0, h.width, h.height);
        // Optional non-glyph guides are deliberately behind the glyph field.
        if (settings.trajectories) {
            ctx.strokeStyle = '#58714b';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 6]);
            for (const actor of state.actors) {
                const b = actor.model.behavior;
                if (b.kind !== 'crouch' && b.kind !== 'flight')
                    continue;
                const from = contact(b.plan.from), to = contact(b.plan.to);
                ctx.beginPath();
                for (let i = 0; i <= 32; i++) {
                    const u = i / 32;
                    const p = project(from.x + (to.x - from.x) * u, from.y + (to.y - from.y) * u - 4 * state.bodyConfig.jumpHeight * (commonScale / state.bodyConfig.size) * u * (1 - u));
                    if (i === 0)
                        ctx.moveTo(p[0], p[1]);
                    else
                        ctx.lineTo(p[0], p[1]);
                }
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }
        if (state.previewPad !== null) {
            const pad = state.pads.find(p => p.id === state.previewPad);
            if (pad) {
                const c = contact(pad.point), p = project(c.x, c.y);
                ctx.strokeStyle = '#b4d978';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.ellipse(p[0], p[1], h.scale * 1.43 * commonScale, h.scale * .27 * commonScale, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        const actorGlyphs = Array.from({ length: 3 }, () => 0);
        let glyphs = 0;
        const sprite = h.sprite, side = sprite / h.dpr;
        for (let i = 0; i < h.depth.length; i++) {
            if (h.depth[i] === -Infinity)
                continue;
            glyphs++;
            const owner = h.owners[i];
            if (owner >= 0 && owner < 3)
                actorGlyphs[owner] = actorGlyphs[owner] + 1;
            const x = (i % h.cols + .5) * h.cellW, y = (Math.floor(i / h.cols) + .5) * h.cellH;
            const frogSilhouette = silhouette && owner >= 0;
            const color = frogSilhouette ? 21 : h.kinds[i] * 24 + h.tones[i];
            ctx.drawImage(atlas, (frogSilhouette ? 22 : h.glyphs[i]) * sprite, color * sprite, sprite, sprite, x - side / 2, y - side / 2, side, side);
        }
        if (settings.labels) {
            ctx.font = '11px "Liberation Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            for (const actor of state.actors) {
                // Follow the actual head (including flight), rather than placing a rear
                // frog's name on the body of a nearer frog occupying the same column.
                const pose = poses.get(actor.id), p = project(pose.origin.x, pose.origin.y - .93 * pose.scale);
                ctx.fillStyle = actor.id === state.selectedId ? '#d4e9a8' : '#8eaa8d';
                ctx.fillText(`${actor.id + 1}  ${actor.name}`, p[0], Math.max(2, p[1] - 12));
            }
        }
        pondFrame = true;
        return Object.freeze({ glyphs, samples: totalSamples, cols: h.cols, rows: h.rows,
            geometry: selectedGeometry, actorGlyphs: Object.freeze(actorGlyphs), environmentSamples });
    }
    return Object.freeze({
        resize,
        update(patch) { alive(); const next = validatePreview(patch, settings); settings = next; resize(rawWidth, rawHeight, rawDpr); },
        draw, drawPond,
        pondTargetAt(p) {
            alive();
            finite(p.x, 'pointer.x');
            finite(p.y, 'pointer.y');
            const center = pondPointToWorld({ x: 0, y: 0 });
            const unitX = pondPointToWorld({ x: 1, y: 0 }), unitY = pondPointToWorld({ x: 0, y: 1 });
            const worldX = ((p.x + 1) * .5 * h.width - h.cx) / h.scale;
            const worldY = ((p.y + 1) * .5 * h.height - h.cyScreen) / h.scale;
            return Object.freeze({ x: clamp((worldX - center.x) / (unitX.x - center.x), -1, 1),
                y: clamp((worldY - center.y - pondContactHeight) / (unitY.y - center.y), -1, 1) });
        },
        pickPondFrog(p) {
            alive();
            finite(p.x, 'pointer.x');
            finite(p.y, 'pointer.y');
            if (!pondFrame || Math.abs(p.x) > 1 || Math.abs(p.y) > 1)
                return null;
            const x = Math.floor((p.x + 1) * .5 * h.width / h.cellW), y = Math.floor((p.y + 1) * .5 * h.height / h.cellH);
            if (x < 0 || y < 0 || x >= h.cols || y >= h.rows)
                return null;
            const id = h.owners[y * h.cols + x];
            return id >= 0 && id < 3 ? id : null;
        },
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
