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
/** One closed shoulder cycle: prepare, power, inward sweep, slow recovery, coast.
 * The two foreflippers share this clock. Their geometry has a small fixed lag,
 * never the old opposite-direction longitudinal paddling. */
function flipperCycle(beat) {
    const p = ((beat % 1) + 1) % 1;
    if (p < .12)
        return mix(.18, -.40, smooth(p / .12));
    if (p < .29)
        return mix(-.40, .74, smooth((p - .12) / .17));
    if (p < .42)
        return mix(.74, .88, smooth((p - .29) / .13));
    if (p < .70)
        return mix(.88, .18, smooth((p - .42) / .28));
    return .18;
}
function cueEnvelope(age, duration) {
    const a = age * 280 / duration;
    return smooth((a - 24) / 72) * (1 - smooth((a - 136) / 144));
}
function cueDistance(age, duration) {
    const a = age * 280 / duration;
    return .50 * smooth(a / 100) + .10 * smooth((a - 100) / 50) + .40 * smooth((a - 150) / 130);
}
/** The same body projection supplies both shell-local rasterization and the
 * breathing contact constraint. A screen-space centre guess cannot place a
 * lifted, pitched snout at the surface reliably. */
function turtleProjection(x, y, z, heading, bank, mirror, size) {
    const pitch = Math.atan(Math.tan(heading * mirror) / .57), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(bank), sr = Math.sin(bank), ry = y * cr - z * sr, rz = y * sr + z * cr;
    const px = x * cp + rz * sp, pz = -x * sp + rz * cp;
    return { x: px * mirror * size, y: (ry * .82 - pz * .57) * size, z: (ry * .57 + pz * .82) * size };
}
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
    const quiet = o.scene === 'blue-drift', moving = o.behavior !== 'rest', dir = o.facing === 'left' ? -1 : 1;
    if (o.scene === 'study')
        return { x: 0, y: moving ? Math.sin(life * .40) * (.004 + o.sway * .045) : 0, depth: .3, head: 0 };
    // Forward progress survives the quiet portion of each stroke. Current changes
    // the lane and effort, not the body's facing or the material's coordinates.
    let x = clamp(slot[0] * o.spacing, -.75, .75) + o.current * .06;
    const routeTime = o.director === 'hold' ? life : Math.max(0, time - o.arrivalSeconds);
    const rate = quiet ? .009 : .013, cycle = (member.role === 'drifter' ? 7.8 : 5.2);
    const strokeDrift = rate * .28 * cycle / TAU * (Math.sin(routeTime * TAU / cycle + p - 1.25) - Math.sin(p - 1.25));
    x += dir * (moving ? rate * routeTime + strokeDrift : 0);
    let y = clamp(slot[1] * o.spacing, -.60, .60) + (moving ? Math.sin(life * .20 + p) * .018 : 0);
    if (o.route === 'channel')
        y += x * .16;
    if (o.route === 'arc')
        y += .07 * Math.cos(x * 2.4);
    if (member.role === 'forager' && o.scene === 'seagrass-stop')
        y += .08 + Math.sin(life * .22 + p) * .025;
    if (member.role === 'lookout')
        y -= .05;
    const depth = clamp(slot[2] + (o.depth - .5) * .5 + Math.sin(life * .13 + p) * .025, 0, 1);
    const a = o.arrivalSeconds, l = o.lingerSeconds, d = o.departureSeconds, lag = id * .55;
    const enter = smooth((time - lag) / Math.max(1, a - lag));
    const leave = smooth((time - a - l - lag) / Math.max(1, d - lag));
    if (time < a) {
        x = mix(-dir * (1.7 + id * .12), x, enter);
        y += Math.sin(enter * Math.PI) * (o.route === 'arc' ? -.14 : .07);
    }
    if (time >= a + l) {
        x = mix(x, dir * (1.7 + id * .12), leave);
        y -= Math.sin(leave * Math.PI) * (o.route === 'channel' ? .12 : .05);
    }
    return { x, y, depth: time < a ? mix(.95, depth, enter) : time >= a + l ? mix(depth, .95, leave) : depth, head: 0 };
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
    const members = Array.from({ length: 5 }, (_, id) => ({ id, x: 0, y: 0, depth: 0, heading: 0, bank: 0, stroke: 0, motion: 'gliding', reactionStart: null, targetX: 0, targetY: 0, cooldown: 0, pathX: 0, pathY: 0, intent: 'inspect', travel: 0, cueTravel: 0, excursion: 0, beat: 0, neck: 0, breath: 0, nextBreath: 5 + id * .7 }));
    const state = () => Object.freeze({ tick, responseTick, targetX, targetY });
    const phase = () => responseTick === null ? 'idle' : tick - responseTick < 45 ? 'inspect' : tick - responseTick < 110 ? 'streamline' : 'settle';
    function beginCue(m, x, y, poster) {
        const route = routePose(options, m.id, sceneTime, life), duration = options.scene === 'study' ? 180 : 280;
        m.intent = y <= -.55 ? 'breath' : y >= .55 ? 'dive' : 'inspect';
        m.targetX = x;
        m.targetY = y;
        m.cueTravel = m.travel;
        m.excursion = m.intent === 'breath' ? Math.min(-.06, -.42 - route.y) : m.intent === 'dive' ? Math.min(.36, .73 - route.y) : clamp(y - route.y, -.14, .14);
        m.reactionStart = tick - (poster ? (duration === 180 ? 70 : 110) : 0);
        m.cooldown = tick + (duration === 180 ? 180 : 340);
        m.nextBreath = life + 26 + m.id * 2;
    }
    function sample(snap = false) {
        const dir = options.facing === 'left' ? -1 : 1, duration = options.scene === 'study' ? 180 : 280;
        const worldW = Math.max(6, 3.7 * options.columns * .56 / options.rows), worldH = worldW * options.rows / (options.columns * .56);
        for (const m of members.slice(0, options.scene === 'study' ? 1 : options.count)) {
            const spec = identity(options, m.id), p = (options.seed % 997) * .013 + m.id * 1.73;
            const route = routePose(options, m.id, sceneTime, life), act = scenePhase(options, sceneTime).phase;
            if (m.reactionStart !== null && tick - m.reactionStart >= duration) {
                m.travel = m.cueTravel + (m.intent === 'inspect' ? .14 : options.count === 1 ? .46 : .32);
                m.reactionStart = null;
            }
            if (!snap && options.behavior !== 'rest' && m.reactionStart === null && tick >= m.cooldown && life >= m.nextBreath && (act === 'linger' || act === 'study') && (spec.role === 'lookout' || act === 'study'))
                beginCue(m, m.x, -.9, false);
            const age = m.reactionStart === null ? 0 : tick - m.reactionStart, response = reactionAt(m, tick);
            const active = m.reactionStart !== null, weight = active ? cueEnvelope(age, duration) : 0;
            const distance = m.intent === 'inspect' ? .14 : options.count === 1 ? .46 : .32;
            if (active)
                m.travel = m.cueTravel + distance * cueDistance(age, duration);
            let x = route.x + dir * m.travel, y = route.y + m.excursion * weight;
            // A held scene may make a fresh pass only after the whole animal is gone.
            // Forward distance is never unwound to pull a recovering turtle backwards.
            if (!active && options.director === 'hold' && dir * x > 1.72) {
                m.travel -= 3.44;
                x -= dir * 3.44;
            }
            const near = guideActive && m.id === selectedId && Math.hypot(targetX - m.x, targetY - m.y) < (options.behavior === 'curious' ? 1.2 : .75);
            const assistance = options.current * dir;
            const period = (spec.role === 'drifter' || options.scene === 'blue-drift' ? 7.8 : spec.role === 'forager' ? 5.8 : 5.2) * (1 + assistance * .16);
            const baseBeat = life / period + p / TAU;
            // Cues borrow a pair of committed strokes; phase is continuous within the
            // response and blends back to the ordinary cadence through recovery.
            const cueBeat = age / duration * 1.55 + .08;
            const effort = active ? smooth(age / 24) * (1 - smooth((age - duration * .66) / (duration * .34))) : 0;
            const stroke = mix(flipperCycle(baseBeat), flipperCycle(cueBeat), effort);
            const vx = x - m.pathX, vy = y - m.pathY;
            m.pathX = x;
            m.pathY = y;
            const tangent = Math.abs(vx) + Math.abs(vy) > 1e-7 ? Math.atan2(dir * vy * worldH, Math.max(.00002, dir * vx * worldW)) : 0;
            const anticipated = active && age < 24 ? (m.intent === 'breath' ? dir * -.12 : m.intent === 'dive' ? dir * .12 : 0) * Math.sin(age / 24 * Math.PI) : 0;
            const desired = options.scene === 'study' && !active ? 0 : clamp(tangent, -.78, .78) + anticipated;
            m.heading = snap ? (active ? dir * (m.intent === 'breath' ? -.20 : m.intent === 'dive' ? .20 : 0) : 0) : m.heading + clamp((desired - m.heading) * .18, -.022, .022);
            m.depth = clamp(route.depth + (m.intent === 'breath' ? -.22 : m.intent === 'dive' ? .25 : 0) * weight, 0, 1);
            m.bank = options.behavior === 'rest' ? 0 : Math.sin(life * .23 + p) * .035 + (active && m.intent === 'inspect' ? Math.sin(age / duration * Math.PI) * .10 : 0);
            m.beat = baseBeat;
            m.stroke = options.behavior === 'rest' ? 0 : stroke;
            m.neck = active ? (m.intent === 'breath' ? .28 : m.intent === 'dive' ? -.10 : .025) * weight : near ? clamp((route.y - targetY) * .08, -.04, .05) : 0;
            m.breath = active && m.intent === 'breath' ? smooth((age * 280 / duration - 82) / 16) * (1 - smooth((age * 280 / duration - 126) / 20)) : 0;
            if (active && m.intent === 'breath') {
                const size = options.scene === 'study' ? options.scale : options.scale * .92 * (options.count > 3 ? .70 : 1) * spec.size * (1 - m.depth * .34);
                const nose = turtleProjection(-1.50 - Math.max(0, m.neck) * .30, .025, .105 + m.neck, m.heading, m.bank, -dir, size);
                // Only a nostril breaks the surface. The root may rise as the neck and
                // shell level out; the head cannot float above its own surface ripple.
                y = Math.max(y, -.50 - nose.y * 2 / worldH);
            }
            // The original solo study is a horizontal tracking view. Internal forward
            // progress still drives pitch and passing water; its screen-space centre
            // remains stable through repeated automatic or explicit cues.
            m.x = options.scene === 'study' ? 0 : x;
            m.y = y;
            const working = ((baseBeat % 1) + 1) % 1 < .42;
            const foraging = spec.role === 'forager' && act === 'linger' && Math.sin(life * .5 + p) > .15;
            m.motion = options.behavior === 'rest' ? 'resting' : active && age >= duration * 160 / 280 ? 'recovering' : active && m.intent === 'breath' ? 'surfacing' : active && m.intent === 'dive' ? 'banking' : active || near || foraging ? 'inspecting' : working ? 'stroking' : 'gliding';
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
        m.travel = 0;
        m.cueTravel = 0;
        m.excursion = 0;
        m.nextBreath = life + 5 + m.id * .7;
    } sample(true); }
    function inspect(x, y, id = selectedId, poster = false) {
        checkId(id);
        if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y))
            throw new TypeError('Inspection requires finite normalized coordinates');
        selectedId = id;
        guide(x, y);
        const m = members[id];
        if (!poster && (m.reactionStart !== null || tick < m.cooldown))
            return;
        beginCue(m, targetX, targetY, poster);
        if (responseTick === null || poster)
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
                Object.assign(m, p, { heading: p.head, reactionStart: null, cooldown: 0, pathX: p.x, pathY: p.y, travel: 0, cueTravel: 0, excursion: 0, neck: 0, breath: 0, nextBreath: life + 5 + id * .7 });
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
            m.travel = 0;
            m.cueTravel = 0;
            m.excursion = 0;
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
                            m.travel = 0;
                            m.cueTravel = 0;
                            m.excursion = 0;
                            m.nextBreath = life + 5 + m.id * .7;
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
        greet(poster = false) { const m = members[selectedId]; inspect(guideActive ? targetX : m.x + (options.facing === 'left' ? -.18 : .18), guideActive ? targetY : m.y + .10, selectedId, poster); },
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
        frame() { return renderTurtle(options, state(), phase(), director(), members, life); } });
}
/** Pure logical-cell rendering; no DOM, font, random or wall-clock dependency. */
function renderTurtle(o, s, phase, d, poses, life) {
    const cols = o.columns, rows = o.rows, worldW = Math.max(6, 3.7 * cols * .56 / rows), worldH = worldW * rows / (cols * .56);
    const glyphs = new Array(cols * rows).fill(' '), tones = new Uint8Array(cols * rows), owners = new Int8Array(cols * rows).fill(-1);
    const zbuffer = new Float64Array(cols * rows).fill(-Infinity), directed = o.scene !== 'study';
    function cell(c, r, glyph, tone, owner = -1) {
        if (c < 0 || r < 0 || c >= cols || r >= rows)
            return;
        const i = r * cols + c;
        glyphs[i] = glyph;
        tones[i] = clamp(Math.round(tone), 0, 9);
        owners[i] = owner;
    }
    function world(x, y, glyph, tone) { cell(Math.round((x + 1) / 2 * (cols - 1)), Math.round((y + 1) / 2 * (rows - 1)), glyph, tone); }
    // Three quiet habitat layers. Their clock accumulates speed exactly as the
    // animal's clock does. Nothing in the shell or skin material reads this clock.
    const quiet = o.scene === 'blue-drift' || o.scene === 'study';
    for (let i = 0; i < (quiet ? 23 : 37); i++) {
        const q = (i * 197 + o.seed * 31) % 1009, flow = life * (.008 * o.current + .004) + (directed ? 0 : poses[0].travel * (o.facing === 'left' ? .5 : -.5));
        world(((q / 1009 + flow) % 1 + 1) % 1 * 2 - 1, ((i * 97 + o.seed * 13) % 991) / 991 * 1.6 - .8, '.', 1);
    }
    // Sparse grazing light at the surface, with long gaps rather than a frame.
    for (let c = 2; c < cols - 2; c++) {
        const x = c / (cols - 1) * 2 - 1;
        if ((c + o.seed) % 17 < 10)
            world(x, -.50 + Math.sin(x * 7 + life * .16) * .005, '~', 2);
        if ((c + 5) % 29 < 9)
            world(x, -.59 + Math.sin(x * 4) * .01, '.', 1);
    }
    if (!quiet) {
        for (let c = 0; c < cols; c += 2) {
            const x = c / (cols - 1) * 2 - 1, y = .87 + Math.sin(x * 5 + o.seed) * .022 + Math.sin(x * 11) * .009;
            world(x, y, (c % 7 === 0) ? ':' : '_', 1);
        }
        for (let plant = 0; plant < 11; plant++) {
            const x = -.96 + plant * .19, h = .07 + ((plant * 17 + o.seed) % 7) * .013;
            for (let k = 0; k < 9; k++)
                world(x + Math.sin(k * .23 + life * .20 + plant) * k * .002, .98 - k / 8 * h, k < 3 ? '|' : '/', 2);
        }
    }
    // Foreground blades are confined to the two corners, outside the main animal.
    for (const side of [-1, 1])
        for (let blade = 0; blade < (quiet ? 3 : 5); blade++) {
            const root = side * (.97 - blade * .027), height = .09 + blade * .024;
            for (let k = 0; k < 8; k++)
                world(root - side * Math.sin(k * .22 + blade * .4 + life * .12) * .025, .99 - k / 7 * height, side === 1 ? '\\' : '/', 2);
        }
    if (directed && o.showRoute)
        for (let id = 0; id < o.count; id++)
            for (let k = 0; k <= 32; k++) {
                const pose = routePose(o, id, k / 32 * (o.arrivalSeconds + o.lingerSeconds + o.departureSeconds), 0);
                world(pose.x, pose.y, k % 4 === 0 ? ':' : '.', 2);
            }
    const painting = directed ? [...d.members].sort((a, b) => b.depth - a.depth || a.id - b.id) : [d.members[0]];
    // Thirteen plate centres form a single connected shell-local partition:
    // five vertebrals and four costals on each side. Marginals occupy the rim.
    const plates = [[-.78, 0], [-.41, 0], [0, 0], [.40, 0], [.76, 0],
        [-.63, -.53], [-.23, -.55], [.23, -.53], [.62, -.46], [-.63, .53], [-.23, .55], [.23, .53], [.62, .46]];
    for (const member of painting) {
        const pose = poses[member.id];
        if (Math.abs(member.x) > 1.55 || Math.abs(member.y) > 1.6)
            continue;
        const dx = member.x * worldW / 2, dy = member.y * worldH / 2;
        const populationScale = o.count > 3 ? .70 : 1;
        const size = directed ? o.scale * .92 * populationScale * member.size * (1 - member.depth * .34) : o.scale;
        const mirror = o.facing === 'left' ? 1 : -1, chars = '.,:;+=*#%@';
        const step = clamp(Math.min(worldW / cols, worldH / rows) * .42 / size, .012, .085);
        const detail = size * 2.04 / worldW * cols >= 27;
        function projected(x, y, z) {
            const p = turtleProjection(x, y, z, member.heading, member.bank, mirror, size);
            return { x: p.x + dx, y: p.y + dy, z: p.z };
        }
        function point(x, y, z, tone, glyph, layer = 0) {
            const p = projected(x, y, z), c = Math.round((p.x / worldW + .5) * (cols - 1)), r = Math.round((p.y / worldH + .5) * (rows - 1));
            if (c < 0 || c >= cols || r < 0 || r >= rows)
                return;
            const index = r * cols + c, depth = 5 - member.depth * 8 + p.z + layer;
            if (depth < zbuffer[index])
                return;
            zbuffer[index] = depth;
            tone *= directed ? 1 - member.depth * .17 : 1;
            glyphs[index] = glyph ?? chars[clamp(Math.round(tone), 0, 9)];
            tones[index] = clamp(Math.round(tone), 1, 9);
            owners[index] = member.id;
        }
        function ellipsoid(cx, cy, cz, rx, ry, rz, tone) {
            for (let y = -ry; y <= ry; y += step)
                for (let x = -rx; x <= rx; x += step) {
                    const q = (x / rx) ** 2 + (y / ry) ** 2;
                    if (q <= 1)
                        point(cx + x, cy + y, cz + rz * Math.sqrt(1 - q), tone + 1.0 * (1 - q) - .30 * y / ry);
                }
        }
        // Curved paddles, sampled in their own span/chord coordinates. Skin marks
        // remain on the paddle as it rotates about a fixed shoulder or hip root.
        function flipper(side, rear = false) {
            const stroke = member.stroke + (rear ? 0 : side * .018), angle = rear ? -.05 + member.bank * .25 : -stroke * .64 - (side === -1 ? pose.breath * .65 : 0);
            const breathing = pose.breath;
            const span = rear ? .38 : (1.20 - (side === -1 ? .38 : .10) * breathing), rootX = rear ? .65 : -.68, rootY = side * (rear ? .39 : .43);
            const sweep = rear ? .29 : .04 + stroke * .35;
            const spanSteps = Math.max(14, Math.ceil(span / step));
            for (let j = 0; j <= spanSteps; j++) {
                const u = j / spanSteps, width = rear ? (.105 * (1 - u) + .12 * Math.sin(Math.PI * u)) : (.13 * (1 - u) + .16 * Math.pow(Math.sin(Math.PI * u), .70));
                const divisions = Math.max(2, Math.ceil(width * 2 / step));
                for (let k = 0; k <= divisions; k++) {
                    const v = k / divisions * 2 - 1;
                    const x = rootX + sweep * u + .09 * Math.sin(Math.PI * u) + width * v;
                    const y = rootY + side * span * u * Math.cos(angle);
                    const z = -.055 + span * u * Math.sin(angle) + .035 * Math.sin(Math.PI * u) * (1 - v * v);
                    const edge = k === 0 || k === divisions;
                    const scaleMark = detail && u < .8 && Math.cos(u * 38) * Math.cos(v * 11) > .58;
                    const tone = (rear ? 4.9 : side === 1 ? 6.2 : 5.4) + (edge ? .65 : scaleMark ? -.85 : .30 * (1 - v * v));
                    point(x, y, z, tone, edge ? (detail ? '+' : undefined) : undefined);
                }
            }
        }
        flipper(-1);
        flipper(1);
        flipper(-1, true);
        flipper(1, true);
        ellipsoid(1.01, .01, -.04, .25, .065, .03, 5.4);
        // Continuous neck under the carapace. The breath lifts and extends the head;
        // it never shrinks into the shell and the eye remains part of the skull.
        const neck = pose.neck, headX = -1.25 - Math.max(0, neck) * .30, headZ = .045 + neck;
        ellipsoid(-.97, -.005, neck * .40, .30, .145, .11, 5.4);
        ellipsoid(headX, -.006, headZ, .245, .188, .13, 6.1);
        ellipsoid(headX - .205, .015, headZ + .02, .085, .105, .055, 6.7);
        if (detail) {
            for (const [x, y] of [[-.10, -.07], [.045, -.075], [.09, .045]])
                point(headX + x, y, headZ + .135, 4.1, ':', .02);
        }
        point(headX - .075, .139, headZ + .10, 8.5, 'o', .06);
        point(headX - .245, .075, headZ + .04, 3.0, '-', .07);
        // One surface owns the shell fill, scutes, streaks and margin. There is no
        // screen-space texture, independently rotating seam layer or animated noise.
        for (let v = -1; v <= 1; v += step / .70)
            for (let u = -1; u <= 1; u += step / 1.02) {
                const q = u * u + v * v;
                if (q > 1)
                    continue;
                const x = u * 1.02, y = v * .70 * (1 - .14 * u), z = .31 * Math.pow(1 - q, .62);
                let first = Infinity, second = Infinity, plate = 0;
                for (let j = 0; j < plates.length; j++) {
                    const seed = plates[j], distance = (u - seed[0]) ** 2 + (v - seed[1]) ** 2 * .93;
                    if (distance < first) {
                        second = first;
                        first = distance;
                        plate = j;
                    }
                    else if (distance < second)
                        second = distance;
                }
                const seed = plates[plate], a = Math.atan2(v - seed[1], u - seed[0]);
                const ray = detail ? .22 * Math.sin(a * 8 + plate * 1.7 + Math.sqrt(first) * 4) : 0;
                const shade = 4.8 + (z / .31) * 1.45 - v * .52 - u * .18 + ray;
                const seam = q < .83 && second - first < (detail ? .030 : .042), rim = q > .91;
                const marginal = q > .80 && q < .94 && Math.abs(Math.sin(Math.atan2(v, u) * 11)) < .13;
                point(x, y, z, seam ? 2.7 : rim ? 7.0 - v * .55 : marginal ? 4.0 : shade, seam ? ':' : rim ? (detail ? '*' : undefined) : undefined, seam ? .19 : .035);
            }
        if (pose.breath > .25) {
            const nose = projected(headX - .25, .025, headZ + .06), nx = nose.x / worldW * 2, ny = nose.y / worldH * 2;
            // A small surface break anchored at the actual snout, not an effect at the
            // target marker. Long disconnected bubbles would obscure the anatomy.
            for (let k = -3; k <= 3; k++)
                if (Math.abs(k) > 1)
                    world(nx + k / cols * 2, ny - .022 + (Math.abs(k) - 2) * .007, '~', 4);
            world(nx, ny - .035, '.', 5);
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
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'b', 'B', 'd', 'D'].includes(e.key))
            return;
        e.preventDefault();
        pendingGuide = null;
        pointerGuide = false;
        const d = model.getDirectorState(), m = d.members[d.selectedId], x = d.marker.active ? d.marker.x : m.x, y = d.marker.active ? d.marker.y : m.y;
        if (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'd')
            model.inspect(clamp(m.x, -1, 1), e.key.toLowerCase() === 'b' ? -.9 : .9, d.selectedId, blocked());
        else if (e.key === 'Enter')
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