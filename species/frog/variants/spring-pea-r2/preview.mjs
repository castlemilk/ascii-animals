/**
 * Spring Pea R2 — private, opt-in character-cell presentation.
 *
 * The canonical controller owns input, fixed-step state, visibility and lifetime.
 * This adapter owns only bounded reusable cell fields and synchronous drawing.
 * Every visible subject, tongue and habitat mark is a printable ASCII glyph.
 * Direct text avoids a second canvas/atlas and its native allocation lifetime.
 */
import { clamp, finite, integer, landingTarget } from '../../generated/frog.mjs';
import { validatePreview as validateCanonicalPreview } from '../../generated/legacy-preview.mjs';
import { pondPointToWorld } from '../../generated/pond.mjs';
import { insectHover, tongueMotion, tonguePoint, tongueTarget } from '../../generated/choreography.mjs';
import { sampleSpringPea, sampleSpringPeaPose, springPeaMouthPoint } from './geometry.mjs';
import { poseSpringPeaPondFrog } from './pose.mjs';

export const SPRING_PEA_GLYPHS = ' .:-=+*#@oO/\\_|()';
export const SPRING_PEA_FONT = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';
const DEFAULTS = Object.freeze({ cols: 96, rows: 60, view: 'front', silhouette: false,
    labels: false, trajectories: false, renderFps: 30 });
const BACKGROUND = '#071c19';
const COLORS = Object.freeze(['#819f48', '#abc94d', '#cbe75c', '#f5edcc', '#0b2820',
    '#24594f', '#397a67', '#ee8b73', '#f7df9b', '#194133']);
const PART = Object.freeze({ 'torso': 1, 'head': 2, 'throat': 3, 'eye-left': 4,
    'eye-right': 5, 'mouth': 6, 'rear-left': 7, 'rear-right': 8,
    'fore-left': 9, 'fore-right': 10 });

/** Private settings validate by the same strict canonical option contract. */
export function validateSpringPeaPreview(patch = {}, base = DEFAULTS) {
    return validateCanonicalPreview(patch, base);
}

/**
 * Fixed for a configuration, never fitted to a moving frame. The envelope includes
 * a jump made after arriving at any legal corner, not only the initial position.
 * Exported privately so a geometry sweep can check the actual projection.
 */
export function springPeaCamera(width, height, config, pond = false) {
    finite(width, 'camera width'); finite(height, 'camera height');
    const size = config.size, jump = config.jumpHeight;
    finite(size, 'camera size'); finite(jump, 'camera jump height');
    const extraSize = Math.max(0, size - 1), extraJump = Math.max(0, jump - .85);
    const worldWidth = (pond ? 7.4 : 6.15) + extraSize * 2.8;
    const worldHeight = (pond ? 5.35 : 5.40) + extraSize * 2.7 + extraJump * 2.1;
    return Object.freeze({ cx: width * .5, cy: height * .55,
        scale: Math.min(width / worldWidth, height / worldHeight) });
}

export function createSpringPeaPreview(canvas, options = {}) {
    let settings = validateSpringPeaPreview(options);
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('A Canvas 2D surface is required');
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D unavailable. The static specimen and description remain available.');
    let disposed = false, rawWidth = 720, rawHeight = 540, rawDpr = 1;
    let width = 1, height = 1, dpr = 1, cols = 1, rows = 1, cellW = 1, cellH = 1.35;
    let camera = { cx: .5, cy: .55, scale: 1 }, lastSize = 1, pondContactHeight = .62, pondFrame = false;
    let depth = new Float64Array(1), owners = new Int16Array(1), tones = new Float32Array(1);
    let materials = new Uint8Array(1), parts = new Uint8Array(1), chars = new Uint8Array(1), colors = new Uint8Array(1);
    let totalSamples = 0, environmentSamples = 0;
    const alive = () => { if (disposed) throw new Error('Spring Pea preview disposed'); };

    function resize(nextWidth, nextHeight, nextDpr) {
        alive();
        finite(nextWidth, 'width'); finite(nextHeight, 'height'); finite(nextDpr, 'DPR');
        if (nextWidth <= 0 || nextHeight <= 0 || nextDpr <= 0) throw new RangeError('Positive preview dimensions required');
        rawWidth = nextWidth; rawHeight = nextHeight; rawDpr = nextDpr;
        const fit = Math.min(1, 1200 / nextWidth, 700 / nextHeight);
        width = Math.max(1, nextWidth * fit); height = Math.max(1, nextHeight * fit);
        dpr = clamp(nextDpr, 1, 2);
        // Preserve desktop requested density; keep phone glyphs at a readable floor.
        const requestedCols = width < 500 ? Math.min(settings.cols, 72) : settings.cols;
        cellW = Math.max(width / requestedCols, height / (settings.rows * 1.35), width < 500 ? 6 : 0);
        cellH = cellW * 1.35;
        cols = Math.min(requestedCols, Math.ceil(width / cellW));
        rows = Math.min(settings.rows, Math.ceil(height / cellH));
        const count = cols * rows;
        depth = new Float64Array(count); owners = new Int16Array(count); tones = new Float32Array(count);
        materials = new Uint8Array(count); parts = new Uint8Array(count); chars = new Uint8Array(count); colors = new Uint8Array(count);
        depth.fill(-Infinity); owners.fill(-1);
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
        camera = springPeaCamera(width, height, { size: lastSize, jumpHeight: .85 });
        pondFrame = false;
    }
    const project = (x, y) => ({ x: camera.cx + x * camera.scale, y: camera.cy + y * camera.scale });
    function begin(config, pond) {
        camera = springPeaCamera(width, height, config, pond); lastSize = config.size;
        depth.fill(-Infinity); owners.fill(-1); chars.fill(0); parts.fill(0); colors.fill(0);
        totalSamples = 0; environmentSamples = 0; pondFrame = false;
    }
    function put(x, y, z, light, material, owner, part = 0, char = '', color = 0) {
        if (![x, y, z, light].every(Number.isFinite)) throw new TypeError('Non-finite Spring Pea sample');
        if (++totalSamples > 60000) throw new RangeError('Spring Pea frame sample budget exceeded');
        const p = project(x, y), col = Math.floor(p.x / cellW), row = Math.floor(p.y / cellH);
        if (col < 0 || col >= cols || row < 0 || row >= rows) return;
        const index = row * cols + col;
        // Stable IDs settle exact ties; the first sample of one owner wins.
        if (z < depth[index] || (z === depth[index] && owner >= owners[index])) return;
        depth[index] = z; owners[index] = owner; tones[index] = light;
        materials[index] = material; parts[index] = part;
        chars[index] = char ? char.charCodeAt(0) : 0; colors[index] = color;
    }
    function environment(x, y, z, light = .4, char = '-', color = 5) {
        if (++environmentSamples > 6246) throw new RangeError('Spring Pea environment sample budget exceeded');
        put(x, y, z, light, 1, -1, 0, char, color);
    }
    function ring(center, rx, ry, color = 5, z = -3, segments = 60, notch = null) {
        for (let i = 0; i < segments; i++) {
            const a = i / segments * Math.PI * 2;
            if (notch !== null && Math.abs(Math.atan2(Math.sin(a - notch), Math.cos(a - notch))) < .23) continue;
            const char = Math.abs(Math.sin(a)) > .58 ? '_' : Math.cos(a) < 0 ? '(' : ')';
            environment(center.x + Math.cos(a) * rx, center.y + Math.sin(a) * ry, z, .4, char, color);
        }
    }
    function frogSample(owner) {
        let samples = 0;
        return p => {
            if (++samples > 32000) throw new RangeError('Spring Pea actor sample budget exceeded');
            // At coarse cells, a cheek sample from the cell's upper edge can
            // otherwise cover the shallow lip seam. The tiny facial depth bias
            // leaves its projected position and shared tongue root unchanged.
            put(p.x, p.y, p.z + (p.part === 'mouth' ? .12 : 0), p.light, p.material, owner, PART[p.part] ?? 0);
        };
    }
    function skinOutline(index) {
        const col = index % cols, row = Math.floor(index / cols), owner = owners[index];
        const same = i => i >= 0 && i < owners.length && depth[i] !== -Infinity && owners[i] === owner;
        const left = col > 0 && same(index - 1), right = col < cols - 1 && same(index + 1);
        const above = row > 0 && same(index - cols), below = row < rows - 1 && same(index + cols);
        if (!left && !right) return '|';
        if (!above && !left) return '/';
        if (!above && !right) return '\\';
        if (!below && !left) return '\\';
        if (!below && !right) return '/';
        if (!left) return '(';
        if (!right) return ')';
        if (!above || !below) return '_';
        return '';
    }
    function paint(silhouette) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = BACKGROUND; ctx.fillRect(0, 0, width, height);
        ctx.font = `700 ${Math.max(6, cellH * 1.02)}px ${SPRING_PEA_FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let glyphs = 0;
        const actorGlyphs = [0, 0, 0];
        for (let i = 0; i < depth.length; i++) {
            if (depth[i] === -Infinity) continue;
            let char = chars[i] ? String.fromCharCode(chars[i]) : '', color = colors[i];
            if (owners[i] >= 0) {
                const outline = skinOutline(i), light = tones[i], part = parts[i];
                if (silhouette) { char = outline || '#'; color = 3; }
                // A light lip curve is visible over sparse ASCII skin; a dark
                // seam on an already dark cell background would disappear.
                else if (part === 6) { char = '_'; color = 3; }
                else if (materials[i] === 2) {
                    if (light < .12) { char = '@'; color = 4; }
                    else { char = part === 3 ? ':' : '@'; color = 3; }
                }
                else {
                    // A sparse seam separates folded haunches from the belly even
                    // when two parts happen to share one silhouette at phone scale.
                    const inner = part === 7 && i % cols < cols - 1 && owners[i + 1] === owners[i] && parts[i + 1] < 7
                        ? ')' : part === 8 && i % cols > 0 && owners[i - 1] === owners[i] && parts[i - 1] < 7 ? '(' : '';
                    char = outline || inner || (part === 2 && light > .55 ? '+' : ':');
                    color = light > .78 ? 2 : light > .55 ? 1 : 0;
                }
                actorGlyphs[owners[i]]++;
            }
            chars[i] = char.charCodeAt(0); colors[i] = color;
            ctx.fillStyle = COLORS[color];
            ctx.fillText(char, (i % cols + .5) * cellW, (Math.floor(i / cols) + .5) * cellH);
            glyphs++;
        }
        return { glyphs, actorGlyphs: Object.freeze(actorGlyphs) };
    }
    function draw(state, geometryOptions = {}) {
        alive(); begin(state.config, false);
        const resolved = { ...geometryOptions, view: geometryOptions.view ?? settings.view,
            silhouette: geometryOptions.silhouette ?? settings.silhouette };
        const ground = { x: state.position.x * 1.5, y: .2 + state.position.y * .5 + .62 * state.config.size };
        ring(ground, 1.42 * state.config.size, .18 * state.config.size, 5, -3.1, 84, .64);
        const target = ['crouch', 'flight'].includes(state.behavior.kind) ? state.behavior.plan.to : state.target ? landingTarget(state) : null;
        if (target) ring({ x: target.x * 1.5, y: .2 + target.y * .5 + .62 * state.config.size }, .27, .075, 6, -3, 36);
        const geometry = sampleSpringPea(state, frogSample(0), resolved);
        const frame = paint(resolved.silhouette);
        return Object.freeze({ glyphs: frame.glyphs, samples: totalSamples, cols, rows, geometry });
    }
    function drawPond(state, geometryOptions = {}) {
        alive();
        if (!state || state.species !== 'frog-pond' || !Array.isArray(state.actors)
            || state.actors.length < 1 || state.actors.length > 3 || state.actors.length !== state.config.count
            || !Array.isArray(state.pads) || state.pads.length > 6 || !Array.isArray(state.ripples) || state.ripples.length > 6)
            throw new RangeError('Invalid bounded pond frame');
        const ids = new Set();
        for (const actor of state.actors) {
            integer(actor.id, 0, 2, 'frog ID');
            if (ids.has(actor.id)) throw new RangeError('Duplicate pond frog ID');
            ids.add(actor.id);
        }
        if (!ids.has(state.selectedId)) throw new RangeError('Selected pond frog is absent');
        const resolved = { ...geometryOptions, view: geometryOptions.view ?? settings.view,
            silhouette: geometryOptions.silhouette ?? settings.silhouette };
        const motion = geometryOptions.motion !== false && geometryOptions.staticPose === undefined && geometryOptions.pondStill === undefined;
        const poses = new Map(state.actors.map(actor => [actor.id, poseSpringPeaPondFrog(state, actor, resolved)]));
        const selected = state.actors.find(actor => actor.id === state.selectedId);
        const commonScale = poses.get(selected.id).scale;
        begin(state.bodyConfig, true); pondContactHeight = .62 * commonScale;
        const quietTick = motion ? state.tick : 0;
        const contact = point => { const p = pondPointToWorld(point); return { ...p, y: p.y + pondContactHeight }; };
        // Pad contour, radial notch and two short veins: leaf grammar without fill.
        for (const pad of state.pads) {
            const occupied = state.actors.some(actor => actor.padId === pad.id || actor.reservedPad === pad.id);
            const active = occupied || state.previewPad === pad.id;
            const c = contact(pad.point), rx = (active ? 1.37 : .69) * commonScale, ry = (active ? .23 : .115) * commonScale;
            const notch = .45 + pad.id * .83, color = state.previewPad === pad.id ? 6 : 5;
            ring(c, rx, ry, color, -3.1, 84, notch);
            for (const edge of [-1, 1]) for (let i = 2; i <= 14; i++) {
                const a = notch + edge * .23, u = i / 14;
                environment(c.x + Math.cos(a) * rx * u, c.y + Math.sin(a) * ry * u, -3.05, .4, '-', color);
            }
            if (active) for (const offset of [1.7, 3.8]) for (let i = 3; i < 9; i++) {
                const a = notch + offset, u = i / 10;
                environment(c.x + Math.cos(a) * rx * u, c.y + Math.sin(a) * ry * u, -3.08, .3, '-', 5);
            }
        }
        // Two clusters of reeds and a few grouped water strokes. Empty sky stays empty.
        for (const side of [-1, 1]) for (let stem = 0; stem < 3; stem++) {
            const bx = side * (2.75 + stem * .13), length = .53 + .16 * (stem % 2);
            const sway = .022 * Math.sin(quietTick / 145 + stem * 1.4 + side);
            for (let i = 0; i <= 18; i++) {
                const u = i / 18;
                environment(bx + side * (.10 + sway) * u * u, 1.43 - length * u, -3.4, .3,
                    i > 14 ? '|' : side < 0 ? '/' : '\\', 5);
            }
        }
        for (let group = 0; group < 8; group++) {
            const x = -2.8 + group * .78, y = 1.30 + .12 * (group % 2);
            for (let i = 0; i < 4; i++) environment(x + i * .05, y, -3.5, .3, '_', 5);
        }
        if (state.config.scene === 'moonlit-chorus') {
            for (let i = 0; i < 24; i++) {
                const a = -.65 * Math.PI + i / 23 * 1.3 * Math.PI;
                environment(2.40 + .18 * Math.cos(a), -1.23 + .22 * Math.sin(a), -3.3, .4, ')', 6);
            }
        }
        for (const ripple of state.ripples) {
            const u = clamp(ripple.age / ripple.ttl, 0, 1);
            if (u > .92) continue;
            const c = contact(ripple.point), radius = .13 + u * (.7 + ripple.strength * .35);
            ring(c, radius, radius * .22, 6, -2.8, 48);
            if (ripple.kind === 'landing' && ripple.age < 24) {
                const t = ripple.age / 24;
                // Four readable landing droplets, anchored to the contact plane.
                for (const side of [-1, 1]) for (let drop = 0; drop < 2; drop++) {
                    const spread = commonScale * (1.21 + .45 * t + drop * .14);
                    const lift = 4 * (.34 + .12 * drop) * commonScale * t * (1 - t);
                    for (let bead = 0; bead < 3; bead++) environment(c.x + side * spread,
                        c.y - lift + bead * .024, 1.9, .8, bead === 0 ? 'o' : '.', 8);
                }
            }
        }
        if (geometryOptions.pondStill === 'ripple') {
            const c = contact(state.target ?? selected.model.position);
            ring(c, .62, .14, 6); ring(c, .92, .21, 5);
        }
        for (const actor of state.actors) {
            if (actor.motive.kind !== 'call' && !(geometryOptions.pondStill === 'call' && actor.id === selected.id)) continue;
            const pose = poses.get(actor.id), age = actor.motive.kind === 'call' ? actor.motive.age / actor.motive.duration : .45;
            ring(contact(actor.model.position), .33 + (age % .5) * 1.5, .15, 6, -2.6, 48);
            for (const side of [-1, 1]) for (let wave = 0; wave < 2; wave++) for (let i = 0; i < 12; i++) {
                const a = -.65 + i / 11 * 1.3;
                environment(pose.origin.x + side * (1.32 + wave * .15 + .13 * Math.cos(a)) * pose.scale,
                    pose.origin.y + (-.26 + (.40 + wave * .09) * Math.sin(a)) * pose.scale,
                    -2.5, .5, side < 0 ? '(' : ')', 6);
            }
        }
        if (settings.trajectories) for (const actor of state.actors) {
            const b = actor.model.behavior;
            if (!['crouch', 'flight'].includes(b.kind)) continue;
            const from = contact(b.plan.from), to = contact(b.plan.to);
            for (let i = 0; i <= 20; i++) {
                const u = i / 20;
                environment(from.x + (to.x - from.x) * u,
                    from.y + (to.y - from.y) * u - 4 * state.bodyConfig.jumpHeight * (commonScale / state.bodyConfig.size) * u * (1 - u),
                    -3.2, .35, '.', 6);
            }
        }
        const stillHunt = geometryOptions.pondStill === 'hunt';
        if (state.firefly || stillHunt) {
            const hunter = stillHunt ? selected : state.actors.find(actor => actor.id === state.firefly.ownerId);
            if (!hunter) throw new RangeError('Firefly owner is absent');
            const pose = poses.get(hunter.id);
            const insectPoint = state.firefly?.point ?? state.target ?? { x: clamp(selected.model.position.x + .3, -.9, .9), y: selected.model.position.y };
            const strike = hunter.motive.kind === 'strike' ? hunter.motive : null;
            const caught = state.firefly?.phase === 'caught';
            const envelope = stillHunt ? { reach: 1, contact: true, phase: 'contact' }
                : strike ? tongueMotion(strike.age, strike.duration, state.firefly?.phase === 'hover') : null;
            const hoverTick = caught && strike ? state.tick - strike.age + Math.ceil(strike.duration * .3) : quietTick;
            const hover = insectHover(contact(stillHunt ? hunter.model.position : insectPoint), pose.scale,
                hoverTick, hunter.id === 2 ? -1 : 1, motion);
            const mouth = springPeaMouthPoint(pose, resolved.view);
            const aim = tongueTarget(mouth, hover, pose.scale);
            if (envelope && envelope.reach > .001) {
                for (let i = 0; i <= 48; i++) {
                    const u = i / 48, p = tonguePoint(mouth, aim, envelope.reach, u, pose.scale);
                    const half = pose.scale * (.018 + .018 * Math.exp(-(((u - .93) / .14) ** 2)));
                    const slope = (aim.y - mouth.y) / Math.max(.001, Math.abs(aim.x - mouth.x));
                    const char = Math.abs(slope) < .22 ? '=' : (aim.x - mouth.x) * (aim.y - mouth.y) < 0 ? '/' : '\\';
                    for (const edge of [-1, 0, 1]) environment(p.x, p.y + edge * half, 2.12, .9, char, 7);
                }
            }
            const prey = caught && envelope ? tonguePoint(mouth, aim, envelope.reach, 1, pose.scale) : aim;
            if (!(caught && envelope?.phase === 'swallow')) {
                for (let i = 0; i < 14; i++) {
                    const a = i / 14 * Math.PI * 2;
                    environment(prey.x + .045 * pose.scale * Math.cos(a), prey.y + .045 * pose.scale * Math.sin(a), 2.16, 1, '@', 8);
                }
                if (!caught) for (const side of [-1, 1]) environment(prey.x + side * .11 * pose.scale,
                    prey.y - .055 * pose.scale, 2.15, .8, side < 0 ? '\\' : '/', 3);
            }
        }
        let geometry;
        for (const actor of [...state.actors].sort((a, b) => a.id - b.id)) {
            const result = sampleSpringPeaPose(poses.get(actor.id), frogSample(actor.id), resolved);
            if (actor.id === state.selectedId) geometry = result;
        }
        const frame = paint(resolved.silhouette);
        if (settings.labels) {
            ctx.font = `11px ${SPRING_PEA_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            for (const actor of state.actors) {
                const pose = poses.get(actor.id), p = project(pose.origin.x, pose.origin.y - 1.09 * pose.scale);
                ctx.fillStyle = actor.id === selected.id ? '#f5edcc' : '#819f73';
                ctx.fillText(`${actor.id + 1} ${actor.name}`, p.x, Math.max(13, p.y - 6));
            }
        }
        pondFrame = true;
        return Object.freeze({ glyphs: frame.glyphs, samples: totalSamples, cols, rows, geometry,
            actorGlyphs: frame.actorGlyphs, environmentSamples });
    }
    resize(rawWidth, rawHeight, rawDpr);
    return Object.freeze({
        resize,
        update(patch) { alive(); settings = validateSpringPeaPreview(patch, settings); resize(rawWidth, rawHeight, rawDpr); },
        draw, drawPond,
        targetAt(p) {
            alive(); finite(p.x, 'pointer.x'); finite(p.y, 'pointer.y');
            const x = ((p.x + 1) * .5 * width - camera.cx) / camera.scale / 1.5;
            const y = (((p.y + 1) * .5 * height - camera.cy) / camera.scale - .2 - .62 * lastSize) / .5;
            return Object.freeze({ x: clamp(x, -1, 1), y: clamp(y, -1, 1) });
        },
        pondTargetAt(p) {
            alive(); finite(p.x, 'pointer.x'); finite(p.y, 'pointer.y');
            const center = pondPointToWorld({ x: 0, y: 0 });
            const unitX = pondPointToWorld({ x: 1, y: 0 }), unitY = pondPointToWorld({ x: 0, y: 1 });
            const wx = ((p.x + 1) * .5 * width - camera.cx) / camera.scale;
            const wy = ((p.y + 1) * .5 * height - camera.cy) / camera.scale;
            return Object.freeze({ x: clamp((wx - center.x) / (unitX.x - center.x), -1, 1),
                y: clamp((wy - center.y - pondContactHeight) / (unitY.y - center.y), -1, 1) });
        },
        pickPondFrog(p) {
            alive(); finite(p.x, 'pointer.x'); finite(p.y, 'pointer.y');
            if (!pondFrame || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return null;
            const col = Math.floor((p.x + 1) * .5 * width / cellW), row = Math.floor((p.y + 1) * .5 * height / cellH);
            if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
            const id = owners[row * cols + col];
            return id >= 0 && id < 3 ? id : null;
        },
        toText() {
            alive(); const text = [];
            for (let y = 0; y < rows; y++) {
                let line = '';
                for (let x = 0; x < cols; x++) line += chars[y * cols + x] ? String.fromCharCode(chars[y * cols + x]) : ' ';
                text.push(line);
            }
            return text.join('\n');
        },
        dispose() {
            if (disposed) return;
            disposed = true; canvas.width = canvas.height = 1;
            depth = new Float64Array(0); owners = new Int16Array(0); tones = new Float32Array(0);
            materials = parts = chars = colors = new Uint8Array(0);
        },
    });
}
