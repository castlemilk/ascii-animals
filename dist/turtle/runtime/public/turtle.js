import { getBrowserScheduler } from '../core/scheduler.js';
export const TURTLE_DEFAULTS = Object.freeze({ columns: 120, rows: 50, seed: 7,
    speed: 1, scale: 1, sway: .18, facing: 'left', behavior: 'glide', palette: 'brass', paused: false, reducedMotion: 'system',
    scene: 'study', count: 1, route: 'shelf', spacing: 1, depth: .5, current: -.25, director: 'loop',
    arrivalSeconds: 8, lingerSeconds: 18, departureSeconds: 10, showLabels: false, showRoute: false, individuals: Object.freeze([]) });
const ranges = { columns: [80, 180], rows: [32, 90], seed: [0, 2147483647], speed: [.25, 2], scale: [.6, 1.3], sway: [0, .4],
    count: [1, 5], spacing: [.6, 1.6], depth: [0, 1], current: [-1, 1], arrivalSeconds: [4, 20], lingerSeconds: [6, 45], departureSeconds: [4, 20] };
const scenes = ['study', 'reef-passage', 'seagrass-stop', 'blue-drift'];
const roles = ['navigator', 'forager', 'drifter', 'lookout', 'explorer'];
const TAU = Math.PI * 2, clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const smooth = (n) => { const t = clamp(n, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const mix = (a, b, t) => a + (b - a) * t;
function bounded(value, lo, hi, name, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < lo || value > hi || (integer && !Number.isInteger(value)))
        throw new RangeError(`Invalid ${name}`);
}
function resolve(patch, base) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch))
        throw new TypeError('Turtle options must be an object');
    for (const key of Object.keys(patch))
        if (!Object.hasOwn(TURTLE_DEFAULTS, key))
            throw new TypeError(`Unknown turtle option ${key}`);
    const candidate = { ...base };
    for (const key of Object.keys(TURTLE_DEFAULTS)) {
        const value = patch[key];
        if (value !== undefined)
            Object.defineProperty(candidate, key, { value, enumerable: true, writable: true, configurable: true });
    }
    for (const [key, [lo, hi]] of Object.entries(ranges))
        bounded(candidate[key], lo, hi, key, ['columns', 'rows', 'seed', 'count'].includes(key));
    if (!['left', 'right'].includes(candidate.facing) || !['glide', 'curious', 'rest'].includes(candidate.behavior) || !['brass', 'lagoon', 'rose'].includes(candidate.palette) || !['system', 'ignore'].includes(candidate.reducedMotion) || !scenes.includes(candidate.scene) || !['shelf', 'channel', 'arc'].includes(candidate.route) || !['loop', 'once', 'hold'].includes(candidate.director))
        throw new TypeError('Invalid turtle setting');
    for (const key of ['paused', 'showLabels', 'showRoute'])
        if (typeof candidate[key] !== 'boolean')
            throw new TypeError(`Invalid ${key}`);
    if (!Array.isArray(candidate.individuals) || candidate.individuals.length > 5)
        throw new TypeError('individuals must contain at most five overrides');
    const seen = new Set();
    candidate.individuals = Object.freeze(Array.from(candidate.individuals).map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            throw new TypeError('Invalid individual');
        for (const key of Object.keys(item))
            if (!['id', 'label', 'role', 'size', 'interest'].includes(key))
                throw new TypeError(`Unknown individual option ${key}`);
        bounded(item.id, 0, 4, 'individual id', true);
        if (seen.has(item.id))
            throw new RangeError('Duplicate individual id');
        seen.add(item.id);
        if (item.label !== undefined && (typeof item.label !== 'string' || !(/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,17}$/).test(item.label)))
            throw new TypeError('Labels require 1–18 plain ASCII characters');
        if (item.role !== undefined && !roles.includes(item.role))
            throw new TypeError('Invalid turtle role');
        if (item.size !== undefined)
            bounded(item.size, .7, 1.25, 'individual size');
        if (item.interest !== undefined)
            bounded(item.interest, 0, 1, 'individual interest');
        return Object.freeze({ ...item });
    }));
    return Object.freeze(candidate);
}
/** The base-taking merge helper is private; all public configuration is validated atomically. */
export function normalizeTurtleOptions(patch = {}) { return resolve(patch, TURTLE_DEFAULTS); }
const names = ['Neri', 'Moss', 'Luma', 'Aster', 'Sol'];
function identity(o, id) {
    const item = o.individuals.find(i => i.id === id);
    const order = o.scene === 'blue-drift' ? ['drifter', 'lookout', 'explorer', 'navigator', 'forager'] : o.scene === 'seagrass-stop' ? ['forager', 'navigator', 'drifter', 'explorer', 'lookout'] : [...roles];
    return { id, label: item?.label ?? names[id], role: item?.role ?? order[id], size: item?.size ?? [1, .9, .8, .86, .75][id], interest: item?.interest ?? [.4, .9, .25, .5, .8][id] };
}
function scenePhase(o, time) {
    if (o.scene === 'study')
        return { phase: 'study', progress: 0 };
    const a = o.arrivalSeconds, l = o.lingerSeconds, d = o.departureSeconds;
    if (time < a)
        return { phase: 'arrival', progress: clamp(time / a, 0, 1) };
    if (time < a + l)
        return { phase: 'linger', progress: (time - a) / l };
    if (time < a + l + d)
        return { phase: 'departure', progress: (time - a - l) / d };
    return { phase: 'complete', progress: 1 };
}
const layouts = [
    [[0, 0, .3]],
    [[-.32, .12, .2], [.38, -.35, .75]],
    [[-.38, -.34, .55], [.34, .12, .08], [-.30, .48, .8]],
    [[-.49, -.43, .38], [.35, -.35, .75], [-.30, .33, .2], [.53, .41, .83]],
    [[-.55, -.44, .5], [.31, -.45, .75], [-.10, .05, .12], [-.57, .48, .85], [.51, .42, .6]]
];
/** Only trusted built-in routes: no arbitrary user callbacks and no ambient clocks/randomness. */
function routePose(o, id, time, life) {
    const member = identity(o, id), slot = layouts[o.count - 1][id], p = (o.seed % 997) * .013 + id * 1.73;
    const quiet = o.scene === 'blue-drift', drift = o.behavior === 'rest' ? 0 : 1;
    let x = clamp(slot[0] * o.spacing, -.75, .75), y = clamp(slot[1] * o.spacing, -.60, .60);
    x += Math.sin(life * (quiet ? .13 : .24) + p) * (.025 + o.sway * .12) * drift + o.current * .10 * (1 - Math.exp(-life * .25));
    y += Math.cos(life * .22 + p) * .024 * drift;
    if (o.route === 'channel') {
        y += x * .25;
        x *= .92;
    }
    if (o.route === 'arc')
        y += .10 * Math.cos(x * 3 + life * .16);
    if (member.role === 'forager' && o.scene === 'seagrass-stop') {
        y += .10 + Math.sin(life * .38 + p) * .045;
        x += Math.sin(life * .16 + p) * .045;
    }
    if (member.role === 'lookout')
        y -= .07 + Math.sin(life * .15 + p) * .06;
    if (member.role === 'explorer') {
        x += Math.sin(life * .23 + p) * .06;
        y += Math.sin(life * .33 + p) * .055;
    }
    let depth = clamp(slot[2] + (o.depth - .5) * .5 + Math.sin(life * .16 + p) * .045, 0, 1);
    const dir = o.facing === 'left' ? -1 : 1, a = o.arrivalSeconds, l = o.lingerSeconds, d = o.departureSeconds;
    const lag = id * .55, enter = smooth((time - lag) / Math.max(1, a - lag));
    const leave = smooth((time - a - l - lag) / Math.max(1, d - lag));
    if (time < a) {
        x = mix(-dir * (1.7 + id * .12), x, enter);
        y += Math.sin(enter * Math.PI) * (o.route === 'arc' ? -.24 : .12);
        depth = mix(.95, depth, enter);
    }
    if (time >= a + l) {
        x = mix(x, dir * (1.7 + id * .12), leave);
        y -= Math.sin(leave * Math.PI) * (o.route === 'channel' ? .18 : .09);
        depth = mix(depth, .95, leave);
    }
    const head = o.behavior === 'rest' ? 0 : Math.sin(life * .28 + p) * .035 + (o.route === 'channel' ? .12 : 0);
    return { x, y, depth, head };
}
function reactionAt(m, tick) {
    if (m.reactionStart === null)
        return Object.freeze({ kind: 'none' });
    const age = tick - m.reactionStart;
    return Object.freeze(age < 90 ? { kind: 'inspect', progress: age / 90 } : age < 160 ? { kind: 'bank', progress: (age - 90) / 70 } : { kind: 'recover', progress: clamp((age - 160) / 120, 0, 1) });
}
export function createTurtleModel(input = {}) {
    let options = normalizeTurtleOptions(input), tick = 0, responseTick = null, targetX = 0, targetY = 0, guideActive = false;
    let sceneTime = options.director === 'hold' ? options.arrivalSeconds + options.lingerSeconds / 2 : 0, life = 0, cycle = 0, selectedId = 0;
    const members = Array.from({ length: 5 }, (_, id) => ({ id, x: 0, y: 0, depth: 0, heading: 0, bank: 0, stroke: 0, motion: 'gliding', reactionStart: null, targetX: 0, targetY: 0, cooldown: 0 }));
    const state = () => Object.freeze({ tick, responseTick, targetX, targetY });
    const phase = () => responseTick === null ? 'idle' : tick - responseTick < 45 ? 'inspect' : tick - responseTick < 110 ? 'streamline' : 'settle';
    function sample(snap = false) {
        for (const m of members.slice(0, options.count)) {
            const spec = identity(options, m.id), p = (options.seed % 997) * .013 + m.id * 1.73, route = routePose(options, m.id, sceneTime, life);
            if (m.reactionStart !== null && tick - m.reactionStart >= 280)
                m.reactionStart = null;
            const response = reactionAt(m, tick), age = m.reactionStart === null ? 0 : tick - m.reactionStart;
            const weight = response.kind === 'none' ? 0 : age < 90 ? smooth(age / 60) : 1 - smooth((age - 120) / 160);
            let x = route.x, y = route.y, heading = route.head;
            const near = guideActive && m.id === selectedId && Math.hypot(targetX - x, targetY - y) < (options.behavior === 'curious' ? 1.2 : .75) && scenePhase(options, sceneTime).phase === 'linger';
            if (near) {
                const interest = (options.behavior === 'curious' ? .25 : .10) * spec.interest;
                x += (targetX - x) * interest;
                y += (targetY - y) * interest;
                heading += clamp((targetY - y) * -.25, -.15, .15);
            }
            if (response.kind !== 'none') {
                x += clamp(m.targetX - route.x, -.36, .36) * weight;
                y += clamp(m.targetY - route.y, -.27, .27) * weight;
                heading += clamp((m.targetY - route.y) * -.8, -.26, .26) * weight;
            }
            // An invitation may lean toward a point, but cannot collapse the authored
            // separation between silhouettes. This limits the excursion, not the herd.
            if (options.scene !== 'study' && options.count > 1 && (near || response.kind !== 'none')) {
                const worldW = Math.max(6, 3.7 * options.columns * .56 / options.rows), worldH = worldW * options.rows / (options.columns * .56);
                const scaleFor = (id, depth) => options.scale * .84 * (options.count > 3 ? .70 : 1) * identity(options, id).size * (1 - depth * .43);
                const ownScale = scaleFor(m.id, route.depth);
                for (let other = 0; other < options.count; other++)
                    if (other !== m.id) {
                        const peer = routePose(options, other, sceneTime, life), sum = ownScale + scaleFor(other, peer.depth);
                        const rx = sum * 3.2 / worldW, ry = sum * 3.0 / worldH;
                        const distance = (xx, yy) => ((xx - peer.x) / rx) ** 2 + ((yy - peer.y) / ry) ** 2;
                        const minimum = Math.min(distance(route.x, route.y), 1.12);
                        if (distance(x, y) < minimum) {
                            let lo = 0, hi = 1;
                            for (let j = 0; j < 9; j++) {
                                const mid = (lo + hi) / 2;
                                if (distance(mix(route.x, x, mid), mix(route.y, y, mid)) < minimum)
                                    hi = mid;
                                else
                                    lo = mid;
                            }
                            x = mix(route.x, x, lo);
                            y = mix(route.y, y, lo);
                        }
                    }
            }
            const assistance = options.current * (options.facing === 'left' ? -1 : 1);
            const duration = (spec.role === 'drifter' || options.scene === 'blue-drift' ? 8.5 : spec.role === 'forager' ? 5.4 : 4.6) * (1 + assistance * .28);
            const duty = .29 * (1 - assistance * .25), beat = ((life / duration + p / TAU) % 1 + 1) % 1, active = beat < duty;
            const stroke = active ? Math.sin(beat / duty * TAU) * .27 * (1 - assistance * .20) : Math.sin((beat - duty) / (1 - duty) * Math.PI) * .025;
            const inspecting = (spec.role === 'forager' && scenePhase(options, sceneTime).phase === 'linger' && Math.sin(life * .5 + p) > (options.scene === 'seagrass-stop' ? .15 : .55)) || near || response.kind === 'inspect';
            if (inspecting)
                heading -= .18;
            const banking = response.kind === 'bank' || scenePhase(options, sceneTime).phase === 'departure' && Math.sin(life * .6 + p) > .1;
            const bank = banking ? Math.sin(life * .7 + p) * .24 : Math.sin(life * .25 + p) * .06;
            const k = snap ? 1 : .075;
            m.x = snap ? x : mix(m.x, x, k);
            m.y = snap ? y : mix(m.y, y, k);
            m.depth = snap ? route.depth : mix(m.depth, route.depth, k);
            m.heading = snap ? heading : mix(m.heading, heading, k);
            m.bank = bank;
            m.stroke = options.behavior === 'rest' ? 0 : stroke;
            m.motion = options.behavior === 'rest' ? 'resting' : response.kind === 'recover' ? 'recovering' : banking ? 'banking' : inspecting ? 'inspecting' : spec.role === 'lookout' && Math.sin(life * .15 + p) > .5 ? 'surfacing' : active ? 'stroking' : 'gliding';
        }
    }
    sample(true);
    function director() {
        return Object.freeze({ scene: options.scene, ...scenePhase(options, sceneTime), cycle, elapsed: sceneTime, selectedId,
            marker: Object.freeze({ x: targetX, y: targetY, active: guideActive }),
            members: Object.freeze(members.slice(0, options.scene === 'study' ? 1 : options.count).map(m => Object.freeze({ ...identity(options, m.id), x: m.x, y: m.y, depth: m.depth, heading: m.heading, bank: m.bank, stroke: m.stroke, motion: m.motion, reaction: reactionAt(m, tick) }))) });
    }
    function checkId(id) { bounded(id, 0, (options.scene === 'study' ? 1 : options.count) - 1, 'selected id', true); }
    function guide(x, y) { if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y))
        throw new TypeError('Guide requires finite normalized coordinates'); targetX = clamp(x, -1, 1); targetY = clamp(y, -1, 1); guideActive = true; }
    function resetScene() { sceneTime = options.director === 'hold' ? options.arrivalSeconds + options.lingerSeconds / 2 : 0; cycle = 0; for (const m of members) {
        m.reactionStart = null;
        m.cooldown = 0;
    } sample(true); }
    function inspect(x, y, id = selectedId, poster = false) {
        checkId(id);
        if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y))
            throw new TypeError('Inspection requires finite normalized coordinates');
        selectedId = id;
        guide(x, y);
        if (options.scene === 'study') {
            if (responseTick === null)
                responseTick = tick - (poster ? 70 : 0);
            return;
        }
        const m = members[id];
        if (!poster && (m.reactionStart !== null || tick < m.cooldown))
            return;
        m.targetX = targetX;
        m.targetY = targetY;
        m.reactionStart = tick - (poster ? 110 : 0);
        m.cooldown = tick + 340;
        if (responseTick === null)
            responseTick = tick - (poster ? 70 : 0);
        if (poster)
            sample(true);
    }
    function configure(patch, poster = false) {
        const next = resolve(patch, options), previous = options;
        options = next;
        selectedId = Math.min(selectedId, (options.scene === 'study' ? 1 : options.count) - 1);
        if (next.scene !== previous.scene)
            resetScene();
        else if (next.count > previous.count) {
            for (let id = previous.count; id < next.count; id++) {
                const m = members[id], p = routePose(options, id, sceneTime, life);
                Object.assign(m, p, { heading: p.head, reactionStart: null, cooldown: 0 });
            }
        }
        if (poster)
            sample(true);
    }
    function stage(act) {
        if (!['arrival', 'linger', 'departure'].includes(act))
            throw new TypeError('Invalid turtle act');
        if (options.scene === 'study')
            return;
        sceneTime = act === 'arrival' ? options.arrivalSeconds * .73 : act === 'linger' ? options.arrivalSeconds + options.lingerSeconds * .45 : options.arrivalSeconds + options.lingerSeconds + options.departureSeconds * .44;
        for (const m of members) {
            m.reactionStart = null;
            m.cooldown = 0;
        }
        responseTick = null;
        sample(true);
    }
    return Object.freeze({ getOptions: () => options, getState: state, getPhase: phase, getDirectorState: director, configure,
        advanceTicks(ticks) {
            bounded(ticks, 0, 600, 'ticks', true);
            if (!Number.isSafeInteger(tick + ticks))
                throw new RangeError('Tick capacity reached');
            for (let i = 0; i < ticks; i++) {
                tick++;
                life += options.speed / 60;
                if (options.scene !== 'study' && options.director !== 'hold') {
                    const total = options.arrivalSeconds + options.lingerSeconds + options.departureSeconds;
                    sceneTime = Math.min(total, sceneTime + options.speed / 60);
                    if (sceneTime >= total && options.director === 'loop') {
                        sceneTime = 0;
                        cycle++;
                        for (const m of members) {
                            m.reactionStart = null;
                            m.cooldown = 0;
                        }
                        sample(true);
                    }
                }
                if (responseTick !== null && tick - responseTick >= 180)
                    responseTick = null;
                sample();
            }
        }, guide,
        clearGuide() { targetX = targetY = 0; guideActive = false; },
        greet(poster = false) { if (options.scene === 'study') {
            if (responseTick === null)
                responseTick = tick - (poster ? 70 : 0);
        }
        else {
            const m = members[selectedId];
            inspect(guideActive ? targetX : m.x + (options.facing === 'left' ? -.18 : .18), guideActive ? targetY : m.y + .10, selectedId, poster);
        } },
        inspect, select(id) { checkId(id); selectedId = id; }, stage,
        direct(scene) {
            if (!scenes.includes(scene))
                throw new TypeError('Invalid turtle scene');
            const preset = scene === 'reef-passage' ? { count: 3, route: 'shelf', depth: .5, current: -.35, arrivalSeconds: 8, lingerSeconds: 18, departureSeconds: 10 } :
                scene === 'seagrass-stop' ? { count: 3, route: 'channel', depth: .35, current: -.15, arrivalSeconds: 9, lingerSeconds: 24, departureSeconds: 11 } :
                    scene === 'blue-drift' ? { count: 2, route: 'arc', depth: .75, current: .30, arrivalSeconds: 12, lingerSeconds: 26, departureSeconds: 12 } : { count: 1 };
            configure({ ...preset, scene, behavior: 'glide' });
            responseTick = null;
            guideActive = false;
            targetX = targetY = 0;
            resetScene();
        },
        reset() { tick = 0; responseTick = null; targetX = targetY = 0; guideActive = false; life = 0; selectedId = 0; resetScene(); },
        frame() { return renderTurtle(options, state(), phase(), director()); } });
}
/** Pure logical-cell rendering; no DOM, font, random or wall-clock dependency. */
function renderTurtle(o, s, phase, d) {
    const cols = o.columns, rows = o.rows, worldW = Math.max(6, 3.7 * cols * .56 / rows), worldH = worldW * rows / (cols * .56);
    const glyphs = new Array(cols * rows).fill(' '), tones = new Uint8Array(cols * rows), owners = new Int8Array(cols * rows).fill(-1);
    const directed = o.scene !== 'study';
    const t = s.tick / 60 * o.speed, seedPhase = (o.seed % 997) / 997 * TAU;
    const age = s.responseTick === null ? 0 : s.tick - s.responseTick;
    const lift = o.behavior === 'rest' ? 0 : s.responseTick === null ? 0 : Math.sin(Math.PI * clamp(age / 180, 0, 1));
    function cell(c, r, glyph, tone, owner = -1) {
        if (c < 0 || r < 0 || c >= cols || r >= rows)
            return;
        const i = r * cols + c;
        glyphs[i] = glyph;
        tones[i] = clamp(Math.round(tone), 0, 9);
        owners[i] = owner;
    }
    function world(x, y, glyph, tone) { cell(Math.round((x + 1) / 2 * (cols - 1)), Math.round((y + 1) / 2 * (rows - 1)), glyph, tone); }
    if (directed) {
        // Sparse, stable glyph scenery. Flow moves independently of the animals.
        const n = o.scene === 'blue-drift' ? 28 : 55;
        for (let i = 0; i < n; i++) {
            const q = (i * 197 + o.seed * 31) % 1009, drift = (t * .018 * o.current);
            world(((q / 1009 + drift) % 1 + 1) % 1 * 2 - 1, ((i * 97 + o.seed * 13) % 991) / 991 * 1.8 - .9, '.', 1);
        }
        if (o.scene !== 'blue-drift')
            for (let plant = 0; plant < 9; plant++) {
                const x = -.92 + plant * .23, h = .07 + ((plant * 17 + o.seed) % 7) * .014;
                for (let k = 0; k < 10; k++) {
                    const y = .96 - k / 10 * h;
                    world(x + Math.sin(k * .36 + t * .35 + plant) * k * .0015, y, k < 3 ? '|' : '/', 2);
                }
                world(x, .96, '_', 2);
            }
        if (o.showRoute)
            for (let id = 0; id < o.count; id++)
                for (let k = 0; k <= 32; k++) {
                    const pose = routePose(o, id, k / 32 * (o.arrivalSeconds + o.lingerSeconds + o.departureSeconds), 0);
                    world(pose.x, pose.y, k % 4 === 0 ? ':' : '.', 2);
                }
    }
    const painting = directed ? [...d.members].sort((a, b) => b.depth - a.depth || a.id - b.id) : [d.members[0]];
    for (const member of painting) {
        if (directed && (Math.abs(member.x) > 1.55 || Math.abs(member.y) > 1.6))
            continue;
        const dx = directed ? member.x * worldW / 2 : o.behavior === 'curious' ? s.targetX * .3 : o.behavior === 'glide' ? Math.sin(t * .65 + seedPhase) * o.sway : 0;
        const bounce = directed ? member.y * worldH / 2 : o.behavior === 'rest' ? 0 : Math.sin(t * .7) * .06 + (o.behavior === 'curious' ? s.targetY * .12 : 0);
        const populationScale = o.count > 3 ? .70 : 1;
        const size = directed ? o.scale * .84 * populationScale * member.size * (1 - member.depth * .43) : o.scale;
        const rotation = directed ? member.heading : 0, cos = Math.cos(rotation), sin = Math.sin(rotation);
        const mirror = o.facing === 'left' ? 1 : -1, chars = '.,:;+=*#%@';
        function point(x, y, tone, glyph) {
            const lx = x * size * mirror, ly = y * size * (directed ? 1 - Math.abs(member.bank) * .4 : 1);
            x = lx * cos - ly * sin + dx;
            y = lx * sin + ly * cos + bounce;
            if (directed)
                tone *= 1 - member.depth * .26;
            const c = Math.round((x / worldW + .5) * (cols - 1)), r = Math.round((y / worldH + .5) * (rows - 1));
            if (c < 0 || c >= cols || r < 0 || r >= rows)
                return;
            const i = r * cols + c;
            glyphs[i] = glyph ?? chars[clamp(Math.round(tone), 0, 9)];
            tones[i] = clamp(Math.round(tone), 1, 9);
            owners[i] = member.id;
        }
        const step = directed ? worldH / rows * .40 / Math.max(.35, size) : worldH / rows * .32;
        function disk(cx, cy, r, tone, glyph) { for (let y = -r; y <= r; y += step)
            for (let x = -r; x <= r; x += step)
                if (x * x + y * y <= r * r)
                    point(cx + x, cy + y, tone, glyph); point(cx, cy, tone, glyph); }
        function line(x, y, xx, yy, r, tone, glyph) { const n = Math.max(1, Math.ceil(Math.hypot(xx - x, yy - y) / step)); for (let k = 0; k <= n; k++) {
            const a = k / n;
            disk(x + (xx - x) * a, y + (yy - y) * a, r, tone, glyph);
        } }
        function ellipse(cx, cy, rx, ry, tone) { for (let y = -ry; y <= ry; y += step)
            for (let x = -rx; x <= rx; x += step) {
                const q = x * x / (rx * rx) + y * y / (ry * ry);
                if (q <= 1)
                    point(cx + x, cy + y, tone + (1 - q) * 1.8 - y / ry * .4);
            } }
        // A three-quarter top view: four tapered flippers, a domed scuted shell,
        // projecting beaked head and a small tail. Streamlining folds flippers only:
        // sea turtles cannot retract their heads into their shells.
        function fin(points, tone) {
            const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
            const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
            for (let y = minY; y <= maxY; y += step)
                for (let x = minX; x <= maxX; x += step) {
                    let inside = false;
                    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
                        const a = points[i], b = points[j];
                        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])
                            inside = !inside;
                    }
                    if (inside)
                        point(x, y, tone + .5 * Math.sin(x * 18 + y * 9));
                }
            for (let i = 0; i < points.length; i++) {
                const a = points[i], b = points[(i + 1) % points.length];
                line(a[0], a[1], b[0], b[1], .02, tone + 1);
            }
        }
        const stroke = directed ? member.stroke : o.behavior === 'rest' ? 0 : Math.sin(t * 1.5 + seedPhase) * .19;
        const finLift = directed ? (member.reaction.kind === 'bank' ? .65 : member.motion === 'inspecting' ? .25 : member.motion === 'gliding' ? .13 : 0) : lift;
        for (const side of [-1, 1]) {
            const extension = 1 - finLift * .48, tipX = -.42 + stroke * side * (directed ? (side === 1 ? .86 : 1.12) : 1) + finLift * .5 + (directed ? member.bank * side * .45 : 0);
            fin([[-.55, side * .35], [-.95, side * .85], [tipX, side * (.65 + extension * .80)], [-.12, side * .77], [-.12, side * .40]], 5.7);
            fin([[.55, side * .34], [1.10, side * (.75 + stroke * .2)], [1.27, side * .53], [.80, side * .21]], 5.2);
        }
        line(.7, 0, 1.20, .04, .06, 6);
        line(1.20, .04, 1.36, .03, .025, 7);
        line(-.71, 0, -1.05, -.03, .17, 6);
        ellipse(-1.23, -.04, .31, .24, 6.4);
        line(-1.48, .04, -1.56, .07, .045, 8);
        point(-1.33, -.16, 9, '@');
        ellipse(0, 0, .96, .67, 4.8);
        // Shell margin, central vertebral plates and paired costal scutes.
        for (let k = 0; k < 120; k++) {
            const a = k / 120 * TAU;
            point(Math.cos(a) * .94, Math.sin(a) * .65, 8, '#');
        }
        for (let k = 0; k < 5; k++) {
            const x = -.63 + k * .31;
            const hex = [[x - .14, -.12], [x, -.23], [x + .14, -.12], [x + .14, .12], [x, .23], [x - .14, .12]];
            for (let j = 0; j < 6; j++) {
                const a = hex[j], b = hex[(j + 1) % 6];
                line(a[0], a[1], b[0], b[1], .015, 3, ':');
            }
            for (const side of [-1, 1]) {
                const edge = Math.sqrt(Math.max(0, 1 - x * x / .90)) * .61;
                line(x, side * .23, x + .08, side * edge, .018, 3, ':');
            }
        }
    }
    if (directed && o.showLabels)
        for (const member of d.members) {
            if (Math.abs(member.x) > .95 || Math.abs(member.y) > .9)
                continue;
            const label = `${member.id === d.selectedId ? '>' : ' '}${member.id + 1} ${member.label}`;
            const c = clamp(Math.round((member.x + 1) / 2 * (cols - 1)) - Math.floor(label.length / 2), 1, cols - label.length - 1);
            const extent = o.scale * .84 * (o.count > 3 ? .70 : 1) * member.size * (1 - member.depth * .43) * 1.50 / worldH * 2;
            const r = clamp(Math.round((member.y + extent + 1) / 2 * (rows - 1)) + 1, 1, rows - 2);
            for (let j = 0; j < label.length; j++)
                cell(c + j, r, label[j], member.id === d.selectedId ? 7 : 4);
        }
    if (directed && d.marker.active) {
        world(d.marker.x, d.marker.y, '+', 8);
        world(d.marker.x - .025, d.marker.y, '.', 5);
        world(d.marker.x + .025, d.marker.y, '.', 5);
    }
    const cells = Object.freeze(glyphs.map((glyph, i) => Object.freeze({ glyph, tone: tones[i], ownerId: owners[i] < 0 ? null : owners[i] })));
    let text = '';
    for (let r = 0; r < rows; r++)
        text += glyphs.slice(r * cols, (r + 1) * cols).join('') + (r === rows - 1 ? '' : '\n');
    return Object.freeze({ columns: cols, rows, cells, text, phase });
}
/** Browser-only mount, SSR-safe import. Owns no scheduler, timer, font asset or global event handler. */
export function createTurtleArtwork(canvas, input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new TypeError('Options must be an object');
    const { frameSource, ...raw } = input;
    if (frameSource !== undefined && (!frameSource || typeof frameSource.subscribe !== 'function'))
        throw new TypeError('Invalid borrowed frameSource');
    const model = createTurtleModel(raw), view = canvas?.ownerDocument?.defaultView, doc = canvas?.ownerDocument;
    if (!view || !doc)
        throw new TypeError('Canvas must belong to a browser document');
    const context = canvas.getContext('2d');
    if (!context)
        throw new Error('Canvas2D unavailable');
    const ctx = context, scheduler = frameSource ?? getBrowserScheduler(view), media = view.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false, requestedPaused = model.getOptions().paused, inViewport = true, width = 0, height = 0, droppedSeconds = 0, last = null, accumulator = 0;
    let unsubscribe = null, ro, io;
    let pendingGuide = null, lastFrame = null, lastNotice = '', pointerGuide = false;
    const listeners = new Set();
    const reduced = () => model.getOptions().reducedMotion === 'system' && media.matches;
    const complete = () => model.getOptions().director === 'once' && model.getDirectorState().phase === 'complete';
    const blocked = () => disposed || requestedPaused || reduced() || doc.hidden || !inViewport || width <= 0 || height <= 0 || complete();
    const status = () => { const d = model.getDirectorState(); return Object.freeze({ paused: blocked(), reducedMotion: reduced(), hidden: doc.hidden, inViewport, disposed, phase: model.getPhase(), tick: model.getState().tick, droppedSeconds, scene: d.scene, act: d.phase, selectedId: d.selectedId, cycle: d.cycle }); };
    function notify(force = false) {
        if (disposed)
            return;
        const s = status(), d = model.getDirectorState();
        const signature = [s.paused, s.reducedMotion, s.hidden, s.inViewport, s.phase, d.scene, d.phase, d.selectedId, d.cycle, Math.floor(d.progress * 10), ...d.members.map(m => m.motion)].join('|');
        if (!force && signature === lastNotice)
            return;
        lastNotice = signature;
        for (const listener of [...listeners])
            if (listeners.has(listener))
                listener(s);
    }
    function draw() {
        if (disposed || width <= 0 || height <= 0)
            return;
        const f = model.frame(), o = model.getOptions();
        lastFrame = f;
        const cw = width / f.columns, ch = height / f.rows;
        ctx.fillStyle = '#09151b';
        ctx.fillRect(0, 0, width, height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${Math.max(3, Math.min(ch * .93, cw / .56))}px ui-monospace,SFMono-Regular,Consolas,monospace`;
        const palette = o.palette === 'brass' ? [232, 185, 105] : o.palette === 'lagoon' ? [119, 218, 204] : [227, 154, 180];
        // Cache ten palette entries rather than reconstructing RGB strings per glyph.
        const colours = Array.from({ length: 10 }, (_, tone) => `rgb(${palette.map(c => Math.round(c * (.25 + tone / 12))).join(',')})`);
        for (let i = 0; i < f.cells.length; i++) {
            const cell = f.cells[i];
            if (cell.glyph === ' ')
                continue;
            ctx.fillStyle = cell.ownerId === null && cell.tone <= 2 ? '#29414a' : colours[cell.tone];
            ctx.fillText(cell.glyph, (i % f.columns + .5) * cw, (Math.floor(i / f.columns) + .5) * ch);
        }
    }
    function frame(now) {
        if (disposed || blocked()) {
            sync();
            return;
        }
        if (!Number.isFinite(now))
            return;
        if (pendingGuide) {
            model.guide(pendingGuide.x, pendingGuide.y);
            pendingGuide = null;
            pointerGuide = true;
        }
        if (last === null) {
            last = now;
            return;
        }
        const dt = Math.max(0, (now - last) / 1000);
        last = now;
        droppedSeconds += Math.max(0, dt - .1);
        accumulator += Math.min(.1, dt);
        const ticks = Math.min(6, Math.floor((accumulator + 1e-10) * 60));
        if (ticks) {
            accumulator -= ticks / 60;
            model.advanceTicks(ticks);
            draw();
            notify();
            if (complete())
                sync();
        }
    }
    function sync(force = false) {
        if (disposed)
            return;
        if (blocked()) {
            unsubscribe?.();
            unsubscribe = null;
            last = null;
            accumulator = 0;
            pendingGuide = null;
            if (pointerGuide) {
                model.clearGuide();
                pointerGuide = false;
            }
        }
        else if (!unsubscribe) {
            last = null;
            unsubscribe = scheduler.subscribe(frame);
        }
        draw();
        notify(force);
    }
    function resize() {
        if (disposed)
            return;
        const r = canvas.getBoundingClientRect();
        width = Math.max(0, Math.min(2048, Number.isFinite(r.width) ? r.width : 0));
        height = Math.max(0, Math.min(2048, Number.isFinite(r.height) ? r.height : 0));
        const ratio = Number.isFinite(view.devicePixelRatio) ? view.devicePixelRatio : 1, dpr = Math.min(2, Math.max(1, ratio || 1));
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        sync();
    }
    function motion() { if (disposed)
        return; pendingGuide = null; pointerGuide = false; model.clearGuide(); sync(true); }
    function visibility() { sync(); }
    function coordinates(e) {
        const r = canvas.getBoundingClientRect();
        if (!Number.isFinite(r.width) || !Number.isFinite(r.height) || r.width <= 0 || r.height <= 0)
            return null;
        const x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1;
        return Number.isFinite(x) && Number.isFinite(y) ? { x: clamp(x, -1, 1), y: clamp(y, -1, 1) } : null;
    }
    function pointer(e) { if (disposed || blocked())
        return; const p = coordinates(e); if (p)
        pendingGuide = p; }
    function leave() { if (disposed)
        return; pendingGuide = null; if (pointerGuide) {
        model.clearGuide();
        pointerGuide = false;
        draw();
        notify();
    } }
    function press(e) {
        if (disposed || e.button !== undefined && e.button !== 0)
            return;
        const p = coordinates(e);
        if (!p)
            return;
        pendingGuide = null;
        pointerGuide = false;
        const f = lastFrame ?? model.frame(), c = clamp(Math.round((p.x + 1) / 2 * (f.columns - 1)), 0, f.columns - 1), r = clamp(Math.round((p.y + 1) / 2 * (f.rows - 1)), 0, f.rows - 1);
        const owner = f.cells[r * f.columns + c].ownerId;
        model.inspect(p.x, p.y, owner ?? model.getDirectorState().selectedId, blocked());
        draw();
        notify(true);
    }
    function greet() { if (disposed)
        return; pointerGuide = false; model.greet(blocked()); draw(); notify(true); }
    function keyboard(e) {
        if (disposed || e.altKey || e.ctrlKey || e.metaKey)
            return;
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key))
            return;
        e.preventDefault();
        pendingGuide = null;
        pointerGuide = false;
        const d = model.getDirectorState(), m = d.members[d.selectedId], x = d.marker.active ? d.marker.x : m.x, y = d.marker.active ? d.marker.y : m.y;
        if (e.key === 'Enter')
            model.inspect(clamp(x, -1, 1), clamp(y, -1, 1), d.selectedId, blocked());
        else if (e.key === 'Escape')
            model.clearGuide();
        else
            model.guide(clamp(x + (e.key === 'ArrowRight' ? .12 : e.key === 'ArrowLeft' ? -.12 : 0), -1, 1), clamp(y + (e.key === 'ArrowDown' ? .12 : e.key === 'ArrowUp' ? -.12 : 0), -1, 1));
        draw();
        notify(true);
    }
    function dispose() {
        if (disposed)
            return;
        disposed = true;
        unsubscribe?.();
        unsubscribe = null;
        pendingGuide = null;
        lastFrame = null;
        listeners.clear();
        ro?.disconnect();
        io?.disconnect();
        media.removeEventListener('change', motion);
        doc.removeEventListener('visibilitychange', visibility);
        view.removeEventListener('resize', resize);
        canvas.removeEventListener('pointermove', pointer);
        canvas.removeEventListener('pointerdown', press);
        canvas.removeEventListener('pointerleave', leave);
        canvas.removeEventListener('pointercancel', leave);
        canvas.removeEventListener('lostpointercapture', leave);
        canvas.removeEventListener('keydown', keyboard);
    }
    function stillIfNecessary() { if ((requestedPaused || reduced()) && model.getOptions().scene !== 'study')
        model.stage('linger'); }
    try {
        media.addEventListener('change', motion);
        doc.addEventListener('visibilitychange', visibility);
        view.addEventListener('resize', resize);
        canvas.addEventListener('pointermove', pointer);
        canvas.addEventListener('pointerdown', press);
        canvas.addEventListener('pointerleave', leave);
        canvas.addEventListener('pointercancel', leave);
        canvas.addEventListener('lostpointercapture', leave);
        canvas.addEventListener('keydown', keyboard);
        const host = view;
        if (host.ResizeObserver) {
            ro = new host.ResizeObserver(resize);
            ro.observe(canvas);
        }
        if (host.IntersectionObserver) {
            inViewport = false;
            io = new host.IntersectionObserver(entries => { if (disposed)
                return; inViewport = entries.some(e => e.isIntersecting); sync(); });
            io.observe(canvas);
        }
        stillIfNecessary();
        resize();
    }
    catch (error) {
        dispose();
        throw error;
    }
    return Object.freeze({ species: 'turtle', canvas, get disposed() { return disposed; }, getOptions: () => Object.freeze({ ...model.getOptions(), paused: requestedPaused }), getStatus: status, getFrame: () => model.frame(), getDirectorState: () => model.getDirectorState(),
        update(patch) { if (disposed)
            return; const before = model.getOptions(); model.configure(patch, blocked()); if (patch.paused !== undefined)
            requestedPaused = patch.paused; if (before.scene !== model.getOptions().scene)
            stillIfNecessary(); sync(true); },
        play() { if (disposed)
            return; requestedPaused = false; sync(true); }, pause() { if (disposed)
            return; requestedPaused = true; sync(true); },
        restart() { if (disposed)
            return; model.reset(); droppedSeconds = 0; last = null; accumulator = 0; pendingGuide = null; stillIfNecessary(); sync(true); }, pulse: greet,
        guide(x, y) { if (disposed)
            return; model.guide(x, y); pendingGuide = null; pointerGuide = false; draw(); notify(true); },
        clearGuide() { if (disposed)
            return; pendingGuide = null; pointerGuide = false; model.clearGuide(); draw(); notify(true); },
        direct(scene) { if (disposed)
            return; model.direct(scene); last = null; accumulator = 0; pendingGuide = null; stillIfNecessary(); sync(true); },
        stage(act) { if (disposed)
            return; model.stage(act); last = null; accumulator = 0; pendingGuide = null; sync(true); },
        select(id) { if (disposed)
            return; model.select(id); draw(); notify(true); },
        inspect(x, y, id) { if (disposed)
            return; model.inspect(x, y, id, blocked()); pendingGuide = null; pointerGuide = false; draw(); notify(true); },
        subscribe(listener) {
            if (typeof listener !== 'function')
                throw new TypeError('Listener must be a function');
            if (disposed)
                return () => { };
            listeners.add(listener);
            try {
                listener(status());
            }
            catch (error) {
                listeners.delete(listener);
                throw error;
            }
            return () => { listeners.delete(listener); };
        }, resize, dispose });
}
//# sourceMappingURL=turtle.js.map