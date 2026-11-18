import { getBrowserScheduler } from '../core/scheduler.js';
export const CRAB_DEFAULTS = Object.freeze({ columns: 120, rows: 50, seed: 7,
    speed: 1, scale: 1, sway: .18, facing: 'left', behavior: 'scuttle', palette: 'brass', paused: false, reducedMotion: 'system',
    scene: 'study', count: 1, formation: 'arc', cast: Object.freeze([]), director: 'auto', actDuration: 240, tide: .35, current: .35, labels: false });
const ranges = { columns: [80, 180], rows: [32, 90], seed: [0, 2147483647], speed: [.25, 2], scale: [.6, 1.3], sway: [0, .4], count: [1, 5], actDuration: [120, 720], tide: [0, 1], current: [-1, 1] };
function resolve(patch, base) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch))
        throw new TypeError('Crab options must be an object');
    for (const key of Object.keys(patch))
        if (!Object.hasOwn(CRAB_DEFAULTS, key))
            throw new TypeError(`Unknown crab option ${key}`);
    const candidate = { ...base };
    for (const key of Object.keys(CRAB_DEFAULTS)) {
        const value = patch[key];
        if (value !== undefined)
            Object.defineProperty(candidate, key, { value, enumerable: true, writable: true, configurable: true });
    }
    for (const [key, [lo, hi]] of Object.entries(ranges)) {
        const value = candidate[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < lo || value > hi || (['columns', 'rows', 'seed', 'count', 'actDuration'].includes(key) && !Number.isInteger(value)))
            throw new RangeError(`Invalid ${key}`);
    }
    if (!['left', 'right'].includes(candidate.facing) || !['scuttle', 'curious', 'guard'].includes(candidate.behavior) || !['brass', 'lagoon', 'rose'].includes(candidate.palette) || !['system', 'ignore'].includes(candidate.reducedMotion) || typeof candidate.paused !== 'boolean')
        throw new TypeError('Invalid crab setting');
    if (!['study', 'forage', 'signals', 'tide'].includes(candidate.scene) || !['arc', 'terraces', 'shoreline'].includes(candidate.formation) || !['auto', 'manual'].includes(candidate.director) || typeof candidate.labels !== 'boolean')
        throw new TypeError('Invalid crab director setting');
    if (!Array.isArray(candidate.cast) || candidate.cast.length > 5)
        throw new RangeError('Cast must contain at most five residents');
    candidate.cast = Object.freeze(Array.from(candidate.cast, entry => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry))
            throw new TypeError('Invalid cast entry');
        for (const key of Object.keys(entry))
            if (!['role', 'label', 'size'].includes(key))
                throw new TypeError(`Unknown cast option ${key}`);
        const copy = { ...entry };
        if (copy.role !== undefined && !['shy', 'curious', 'territorial'].includes(copy.role))
            throw new TypeError('Invalid crab role');
        if (copy.label !== undefined && (typeof copy.label !== 'string' || !/^[\x20-\x7e]{1,12}$/.test(copy.label) || !copy.label.trim()))
            throw new TypeError('Labels must be 1–12 printable ASCII characters');
        if (copy.size !== undefined && (typeof copy.size !== 'number' || !Number.isFinite(copy.size) || copy.size < .8 || copy.size > 1.2))
            throw new RangeError('Resident size must be .8–1.2');
        return Object.freeze(copy);
    }));
    return Object.freeze(candidate);
}
/** The base-taking merge helper is private; all public configuration is validated. */
export function normalizeCrabOptions(patch = {}) { return resolve(patch, CRAB_DEFAULTS); }
const TAU = Math.PI * 2, clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function createCrabModel(input = {}) {
    let options = normalizeCrabOptions(input), tick = 0, responseTick = null, targetX = 0, targetY = 0;
    const theatre = createCrabDirector(() => options, () => tick);
    const state = () => Object.freeze({ tick, responseTick, targetX, targetY });
    const phase = () => responseTick === null ? 'idle' : tick - responseTick < 45 ? 'notice' : tick - responseTick < 110 ? 'defend' : 'settle';
    return Object.freeze({ getOptions: () => options, getState: state, getPhase: phase,
        configure(patch) { const before = options; options = resolve(patch, options); theatre.configure(before); },
        advanceTicks(ticks) { if (!Number.isInteger(ticks) || ticks < 0 || ticks > 600)
            throw new RangeError('Ticks must be an integer0..600'); for (let i = 0; i < ticks; i++) {
            tick++;
            if (options.scene !== 'study')
                theatre.step();
        } if (responseTick !== null && tick - responseTick >= 180)
            responseTick = null; },
        guide(x, y) { if (!Number.isFinite(x) || !Number.isFinite(y))
            throw new TypeError('Guide requires finite normalized coordinates'); targetX = clamp(x, -1, 1); targetY = clamp(y, -1, 1); theatre.guide(targetX, targetY); },
        greet(poster = false) { if (responseTick === null) {
            responseTick = tick - (poster ? 70 : 0);
            if (options.scene !== 'study')
                theatre.cue('signal', undefined, poster);
        } }, reset() { tick = 0; responseTick = null; targetX = targetY = 0; theatre.reset(); },
        frame() { return options.scene === 'study' ? renderCrab(options, state(), phase()) : renderTidepool(options, theatre.snapshot(), phase(), tick); },
        getScene: theatre.snapshot, select: theatre.select, cue: theatre.cue, setBeat: theatre.setBeat, nextBeat: theatre.nextBeat,
        clearGuide() { targetX = targetY = 0; theatre.clearGuide(); } });
}
const CRAB_BEATS = Object.freeze({
    study: Object.freeze(['arrive']), forage: Object.freeze(['arrive', 'forage', 'signal', 'return']),
    signals: Object.freeze(['arrive', 'signal', 'challenge', 'return']), tide: Object.freeze(['forage', 'retreat', 'shelter', 'return'])
});
const RESIDENTS = Object.freeze([
    { label: 'Pip', role: 'curious' }, { label: 'Moss', role: 'shy' }, { label: 'Brine', role: 'territorial' },
    { label: 'Dot', role: 'curious' }, { label: 'Flint', role: 'territorial' }
]);
const smooth = (n) => { n = clamp(n, 0, 1); return n * n * (3 - 2 * n); };
function crabRadius(o, size) {
    // Theatre keeps about 20 columns of silhouette even at 80-column/5-resident
    // density. Scale still applies above this legibility floor; never drop a crab.
    const requested = (o.count === 1 ? .20 : o.count === 2 ? .14 : o.count === 3 ? .112 : .094) * o.scale * size;
    return Math.min(Math.max(requested, 10.6 / (o.columns - 1)), .26 / (o.columns * .56 / o.rows));
}
/** Species-local director. One cue and one delayed reply per resident, never an event queue. */
function createCrabDirector(options, tick) {
    let clock = 0, cycle = 0, selectedId = 0, guideActive = false, guideX = 0, guideY = 0;
    let actors = [];
    const beats = () => CRAB_BEATS[options().scene];
    const beatIndex = () => Math.min(beats().length - 1, Math.floor(clock / options().actDuration));
    const beat = () => beats()[beatIndex()];
    const progress = () => clock % options().actDuration / options().actDuration;
    function water() {
        const o = options(), p = smooth(progress());
        if (o.scene !== 'tide')
            return o.tide;
        const amount = beat() === 'retreat' ? p : beat() === 'shelter' ? 1 : beat() === 'return' ? 1 - p : 0;
        return clamp(o.tide * .5 + amount * .65, 0, 1);
    }
    function anchor(id) {
        const o = options(), n = o.count;
        if (n === 1)
            return [0, .16];
        if (n === 2)
            return [id === 0 ? -.43 : .43, o.formation === 'terraces' ? (id === 0 ? -.12 : .37) : .22];
        const rows = o.formation === 'terraces'
            ? [[-.54, -.22], [.48, -.04], [-.12, .45], [.54, .55], [-.58, .52]]
            : n === 3 ? (o.formation === 'shoreline' ? [[-.58, .25], [0, .25], [.58, .25]] : [[-.58, .34], [0, -.02], [.58, .34]])
                : [[-.58, -.16], [0, -.24], [.58, -.16], [-.35, .48], [.35, .48]];
        return [...rows[id]];
    }
    function footOffset(a, k) {
        const o = options(), side = k < 4 ? -1 : 1, j = k % 4, r = crabRadius(o, a.size), ratio = o.columns * .56 / o.rows;
        return [side * (1.88 - j * .11) * r, (.02 + j * .24) * r * ratio];
    }
    function plant(a) { a.feet = Array.from({ length: 8 }, (_, k) => { const [x, y] = footOffset(a, k); return { x: a.x + x, y: a.y + y, planted: true, lift: 0, fromX: 0, fromY: 0, toX: 0, toY: 0 }; }); }
    function syncCast(reseed = false) {
        const o = options();
        actors = Array.from({ length: o.count }, (_, id) => {
            const c = o.cast[id], d = RESIDENTS[id], old = reseed ? undefined : actors[id], role = c?.role ?? d.role;
            const [ax, py] = anchor(id), direction = Math.sign(ax), px = ax - direction * .04, homeX = ax + (direction ? direction * .07 : -.08), homeY = py - .10;
            const a = old ?? { id, label: '', role, size: 1, x: homeX, y: homeY, homeX, homeY, patchX: px, patchY: py, vx: 0, vy: 0, gait: ((o.seed + id * 17) % 47) / 47, feet: [], kind: 'rest', progress: 0, leftClaw: 0, rightClaw: 0, gazeX: 0, gazeY: 0, crouch: 0, action: null, replyAt: null };
            a.label = c?.label ?? d.label;
            a.role = role;
            a.size = c?.size ?? (id === 1 ? .9 : id === 2 ? 1.06 : 1);
            a.homeX = homeX;
            a.homeY = homeY;
            a.patchX = px;
            a.patchY = py;
            if (!old)
                plant(a);
            return a;
        });
        selectedId = Math.min(selectedId, o.count - 1);
    }
    function plan(a) {
        const o = options(), b = beat(), p = progress(), age = tick(), offset = (o.seed * 13 + a.id * 79) % 480, idle = (age + offset) % 480;
        let x = a.patchX, y = a.patchY, kind = 'rest', pr = p, left = 0, right = 0, crouch = 0;
        const callAge = ((o.director === 'manual' ? age : clock) % o.actDuration) - (a.role === 'territorial' ? 0 : a.role === 'curious' ? 65 : 125);
        const call = callAge >= 0 && callAge < 110 ? Math.sin(callAge / 110 * Math.PI) : 0;
        if (b === 'arrive') {
            kind = 'scuttle';
            if (a.role === 'shy' && p < .3) {
                x = a.homeX;
                y = a.homeY;
                kind = 'inspect';
                crouch = .3;
            }
        }
        if (b === 'forage') {
            const forage = (idle % 210) / 210;
            pr = forage;
            if (forage < .62) {
                kind = 'forage';
                left = -.65 * Math.sin(forage / .62 * Math.PI);
                right = .12;
            }
            else if (forage < .8) {
                kind = 'groom';
                right = .35;
                left = .15;
            }
            else {
                kind = 'inspect';
                x += Math.sin(offset) * o.sway * .24;
            }
        }
        if (b === 'signal') {
            kind = call > 0 ? 'signal' : a.role === 'shy' ? 'inspect' : 'rest';
            left = call * (a.id % 2 ? .35 : 1);
            right = call * (a.id % 2 ? 1 : .35);
            if (a.role === 'shy') {
                x = a.homeX;
                y = a.homeY;
                left *= .5;
                right *= .5;
            }
        }
        if (b === 'challenge') {
            if (a.role === 'territorial') {
                kind = 'signal';
                left = .85;
                right = .45 + .2 * Math.sin(age * .065);
                x += Math.sin(p * TAU) * .055;
            }
            else if (a.role === 'shy') {
                kind = 'retreat';
                x = a.homeX;
                y = a.homeY;
                crouch = .45;
            }
            else {
                kind = 'inspect';
                x -= Math.sign(a.patchX || 1) * .055;
                left = .25;
            }
        }
        if (b === 'retreat') {
            if (p < .18 + a.id * .035) {
                kind = 'brace';
                left = -.2;
                right = -.2;
                crouch = .35;
            }
            else {
                kind = 'retreat';
                x = a.homeX + o.current * .035;
                y = a.homeY;
                left = -.3;
                right = -.3;
                crouch = .6;
            }
        }
        if (b === 'shelter') {
            x = a.homeX;
            y = a.homeY;
            kind = p > .55 + a.id * .04 ? 'inspect' : 'shelter';
            crouch = kind === 'shelter' ? 1 : .55;
            left = -.3;
            right = -.3;
        }
        if (b === 'return') {
            if (o.scene === 'tide') {
                const wait = a.id * .09 + (a.role === 'shy' ? .13 : 0);
                if (p < wait) {
                    kind = 'inspect';
                    x = a.homeX;
                    y = a.homeY;
                    crouch = .55;
                }
                else
                    kind = 'return';
            }
            else {
                kind = 'return';
                x = a.homeX;
                y = a.homeY;
                if (p > .7) {
                    kind = idle < 240 ? 'groom' : 'inspect';
                    left = kind === 'groom' ? .3 : 0;
                    right = .1;
                }
            }
        }
        // Quiet individual motives remain visible between the larger authored gestures.
        if (kind === 'rest' && idle < 95) {
            kind = 'groom';
            left = .25;
            right = -.1;
        }
        if (kind === 'rest' && idle >= 95 && idle < 160) {
            kind = 'inspect';
            right = .12;
        }
        if (guideActive && Math.hypot(guideX - a.x, (guideY - a.y) * .7) < .38 && !['retreat', 'shelter', 'brace'].includes(kind)) {
            if (a.role === 'shy') {
                x = a.homeX;
                y = a.homeY;
                kind = 'retreat';
                crouch = .45;
            }
            else if (a.role === 'territorial') {
                kind = 'signal';
                left = .9;
                right = .25;
            }
            else {
                kind = 'inspect';
                x = clamp(guideX, a.patchX - .12, a.patchX + .12);
                y = clamp(guideY, a.patchY - .06, a.patchY + .09);
                left = .15;
                right = .1;
            }
        }
        if (a.action) {
            const q = clamp((age - a.action.start) / 300, 0, 1);
            pr = q;
            if (a.action.kind === 'forage') {
                if (q < .28) {
                    x = a.action.x;
                    y = a.action.y;
                    kind = 'scuttle';
                }
                else if (q < .75) {
                    x = a.action.x;
                    y = a.action.y;
                    kind = 'forage';
                    left = -.75 * Math.sin((q - .28) / .47 * TAU);
                    right = .1;
                }
                else {
                    kind = 'return';
                }
            }
            else if (a.action.kind === 'signal') {
                x = a.action.x;
                y = a.action.y;
                kind = q < .72 ? 'signal' : 'rest';
                left = q < .72 ? Math.sin(q / .72 * Math.PI) : 0;
                right = left * .35;
            }
            else {
                if (q < .30) {
                    x = a.homeX;
                    y = a.homeY;
                    kind = 'retreat';
                    crouch = q * 2;
                }
                else if (q < .65) {
                    x = a.homeX;
                    y = a.homeY;
                    kind = q < .5 ? 'shelter' : 'inspect';
                    crouch = q < .5 ? 1 : .55;
                }
                else {
                    kind = 'return';
                    crouch = (1 - q) * .7;
                }
            }
        }
        if ((kind === 'scuttle' || kind === 'return') && Math.hypot(x - a.x, y - a.y) < .002) {
            kind = idle < 110 ? 'groom' : idle < 190 ? 'inspect' : 'rest';
            if (kind === 'groom') {
                left = .25;
                right = .08;
            }
        }
        const r = crabRadius(o, a.size), ratio = o.columns * .56 / o.rows;
        x = clamp(x, -.96 + r * 2.08, .96 - r * 2.08);
        y = clamp(y, -.83 + r * ratio * 1.5, .82 - r * ratio);
        return { x, y, kind, pr, left, right, crouch };
    }
    function pose(a, snap = false) {
        const o = options(), p = plan(a), gain = snap ? 1 : .14;
        a.kind = p.kind;
        a.progress = p.pr;
        a.leftClaw += (p.left - a.leftClaw) * gain;
        a.rightClaw += (p.right - a.rightClaw) * gain;
        a.crouch += (p.crouch - a.crouch) * gain;
        const gazeX = guideActive ? clamp((guideX - a.x) * 3, -1, 1) : Math.sin((tick() + a.id * 91) * .017) * .45;
        const gazeY = guideActive ? clamp((guideY - a.y) * 3, -1, 1) : Math.cos((tick() + a.id * 113) * .013) * .25;
        a.gazeX += (gazeX - a.gazeX) * gain;
        a.gazeY += (gazeY - a.gazeY) * gain;
        if (snap) {
            a.x = p.x;
            a.y = p.y;
            a.vx = a.vy = 0;
            plant(a);
            return;
        }
        const max = .0024 * o.speed * (a.role === 'shy' ? .8 : 1), dx = p.x - a.x, dy = p.y - a.y;
        a.vx += clamp(clamp(dx * .08, -max, max) - a.vx, -.00022, .00022);
        a.vy += clamp(clamp(dy * .08, -max * .58, max * .58) - a.vy, -.00016, .00016);
        if (Math.abs(dx) < .00025)
            a.vx = 0;
        if (Math.abs(dy) < .00025)
            a.vy = 0;
        a.x += a.vx;
        a.y += a.vy;
        const moving = Math.hypot(a.vx, a.vy) > .00008;
        if (moving)
            a.gait += o.speed / 44;
        const r = crabRadius(o, a.size), ratio = o.columns * .56 / o.rows;
        for (let k = 0; k < 8; k++) {
            const f = a.feet[k], phase = (a.gait + (k % 2) * .5 + (k < 4 ? 0 : .5)) % 1;
            if (!moving) {
                f.planted = true;
                f.lift = 0;
                continue;
            }
            if (phase < .66) {
                if (!f.planted) {
                    f.x = f.toX;
                    f.y = f.toY;
                }
                f.planted = true;
                f.lift = 0;
            }
            else {
                if (f.planted) {
                    const [ox, oy] = footOffset(a, k);
                    f.fromX = f.x;
                    f.fromY = f.y;
                    f.toX = a.x + ox + a.vx * 22;
                    f.toY = a.y + oy + a.vy * 22;
                }
                f.planted = false;
                const q = smooth((phase - .66) / .34);
                f.x = f.fromX + (f.toX - f.fromX) * q;
                f.y = f.fromY + (f.toY - f.fromY) * q;
                f.lift = Math.sin((phase - .66) / .34 * Math.PI) * r * ratio * .32;
            }
        }
    }
    function validateId(id) { if (!Number.isInteger(id) || id < 0 || id >= actors.length)
        throw new RangeError('Resident id is outside this cast'); }
    function cue(action, id = selectedId, poster = false) {
        if (!['forage', 'signal', 'shelter'].includes(action))
            throw new TypeError('Unknown crab cue');
        validateId(id);
        const a = actors[id];
        if (a.action && !poster)
            return;
        const lure = action === 'forage' && guideActive;
        a.action = { kind: action, start: tick() - (poster ? 120 : 0), x: lure ? clamp(guideX, a.patchX - .14, a.patchX + .14) : a.x, y: lure ? clamp(guideY, a.patchY - .08, a.patchY + .08) : a.y };
        a.replyAt = null;
        if (action === 'signal' && !poster)
            for (const other of actors)
                if (other.id !== id && !other.action && other.replyAt === null)
                    other.replyAt = tick() + 55 + other.id * 25;
        if (poster)
            pose(a, true);
    }
    function setBeat(next, poster = false) { const i = beats().indexOf(next); if (i < 0)
        throw new RangeError('Beat does not belong to this scene'); clock = (i + (poster ? .5 : 0)) * options().actDuration; for (const a of actors) {
        a.action = null;
        a.replyAt = null;
        if (poster)
            pose(a, true);
    } }
    function snapshot() {
        return Object.freeze({ scene: options().scene, beats: beats(), beat: beat(), beatIndex: beatIndex(), progress: progress(), cycle, tideLevel: water(), current: options().current, selectedId,
            guide: Object.freeze({ active: guideActive, x: guideX, y: guideY }), actors: Object.freeze(actors.map(a => Object.freeze({ id: a.id, label: a.label, role: a.role, size: a.size, x: a.x, y: a.y, home: Object.freeze({ x: a.homeX, y: a.homeY }), patch: Object.freeze({ x: a.patchX, y: a.patchY }), behavior: Object.freeze({ kind: a.kind, progress: a.progress }), leftClaw: a.leftClaw, rightClaw: a.rightClaw, gazeX: a.gazeX, gazeY: a.gazeY, crouch: a.crouch, feet: Object.freeze(a.feet.map(f => Object.freeze({ x: f.x, y: f.y, planted: f.planted, lift: f.lift }))) }))) });
    }
    function reset() { clock = cycle = selectedId = 0; guideActive = false; guideX = guideY = 0; syncCast(true); for (const a of actors) {
        const x = a.x, y = a.y;
        pose(a, true);
        if (beat() === 'arrive') {
            a.x = x;
            a.y = y;
            plant(a);
        }
    } }
    reset();
    return {
        snapshot, reset, cue, setBeat,
        select(id) { validateId(id); selectedId = id; },
        guide(x, y) { guideActive = true; guideX = x; guideY = y; },
        clearGuide() { guideActive = false; guideX = guideY = 0; },
        nextBeat(poster = false) { setBeat(beats()[(beatIndex() + 1) % beats().length], poster); },
        configure(before) {
            const o = options(), sceneChange = before.scene !== o.scene, shape = before.scale !== o.scale || before.columns !== o.columns || before.rows !== o.rows || before.count !== o.count;
            const resized = new Set(actors.filter(a => before.cast[a.id]?.size !== o.cast[a.id]?.size).map(a => a.id));
            if (sceneChange) {
                clock = cycle = 0;
                guideActive = false;
            }
            else if (before.actDuration !== o.actDuration)
                clock = clock / before.actDuration * o.actDuration;
            if (before.seed !== o.seed) {
                reset();
                return;
            }
            syncCast();
            for (const a of actors) {
                if (shape || resized.has(a.id)) {
                    const r = crabRadius(o, a.size), ratio = o.columns * .56 / o.rows;
                    a.x = clamp(a.x, -.96 + r * 2.08, .96 - r * 2.08);
                    a.y = clamp(a.y, -.83 + r * ratio * 1.5, .82 - r * ratio);
                    plant(a);
                }
                if (sceneChange) {
                    a.action = null;
                    a.replyAt = null;
                    pose(a, true);
                }
            }
        },
        step() {
            const o = options();
            if (o.director === 'auto') {
                clock++;
                if (clock >= beats().length * o.actDuration) {
                    clock = 0;
                    cycle++;
                }
            }
            else
                clock = Math.min(clock + 1, (beatIndex() + 1) * o.actDuration - 1);
            for (const a of actors) {
                if (a.action && tick() - a.action.start >= 300)
                    a.action = null;
                if (a.replyAt !== null && tick() >= a.replyAt) {
                    a.replyAt = null;
                    if (!a.action)
                        a.action = { kind: 'signal', start: tick(), x: a.x, y: a.y };
                }
                pose(a);
            }
        }
    };
}
/** Pure logical-cell rendering; no DOM, font, random or wall-clock dependency. */
function renderCrab(o, s, phase) {
    const cols = o.columns, rows = o.rows, worldW = Math.max(6, 3.7 * cols * .56 / rows), worldH = worldW * rows / (cols * .56);
    const glyphs = new Array(cols * rows).fill(' '), tones = new Uint8Array(cols * rows);
    const t = s.tick / 60 * o.speed, seedPhase = (o.seed % 997) / 997 * TAU;
    const age = s.responseTick === null ? 0 : s.tick - s.responseTick;
    const lift = o.behavior === 'guard' ? 1 : s.responseTick === null ? 0 : Math.sin(Math.PI * clamp(age / 180, 0, 1));
    const dx = o.behavior === 'curious' ? s.targetX * .3 : o.behavior === 'scuttle' ? Math.sin(t * .65 + seedPhase) * o.sway : 0;
    const bounce = o.behavior === 'guard' ? 0 : Math.sin(t * 7) * .025;
    const mirror = o.facing === 'left' ? 1 : -1, chars = '.,:;+=*#%@';
    function point(x, y, tone, glyph) {
        x = x * o.scale * mirror + dx;
        y = y * o.scale + bounce;
        const c = Math.round((x / worldW + .5) * (cols - 1)), r = Math.round((y / worldH + .5) * (rows - 1));
        if (c < 0 || c >= cols || r < 0 || r >= rows)
            return;
        const i = r * cols + c;
        glyphs[i] = glyph ?? chars[clamp(Math.round(tone), 0, 9)];
        tones[i] = clamp(Math.round(tone), 1, 9);
    }
    const step = worldH / rows * .32;
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
    // Eight separately jointed walking legs: four on each side, not chelipeds.
    for (const side of [-1, 1])
        for (let k = 3; k >= 0; k--) {
            const gait = o.behavior === 'guard' ? 0 : Math.sin(t * 6 + k * 1.6 + side) * .09;
            const y = -.1 + k * .17, kneeY = -.15 + k * .26 + gait, footY = .12 + k * .29;
            const reach = 1.25 + (3 - k) * .17;
            line(side * .62, y, side * reach, kneeY, .055, 5.4);
            line(side * reach, kneeY, side * (reach + .27), footY, .038, 7);
            line(side * (reach + .27), footY, side * (reach + .15), footY + .13, .018, 8);
        }
    // Paired chelipeds: articulated elbow, broad palm, two gaping tapered fingers.
    for (const side of [-1, 1]) {
        const x = side * 1.38, y = -.73 - lift * .38;
        line(side * .48, -.23, side * .92, -.58 - lift * .08, .12, 5.5);
        line(side * .92, -.58 - lift * .08, x, y, .10, 6.5);
        ellipse(x, y, .27, .22, 6.5);
        const gape = .16 + lift * .12;
        line(x - side * .13, y - .12, x - side * (.24 + gape), y - .40, .085, 7);
        line(x - side * (.24 + gape), y - .40, x - side * .13, y - .53, .035, 8);
        line(x + side * .12, y - .12, x + side * (.22 + gape), y - .39, .085, 7);
        line(x + side * (.22 + gape), y - .39, x + side * .10, y - .53, .035, 8);
    }
    ellipse(0, .04, .79, .48, 5.5);
    // Scalloped shell rim and ornamental plate texture retain a broad carapace.
    for (let k = 0; k < 30; k++) {
        const a = Math.PI + k / 29 * Math.PI;
        point(Math.cos(a) * .81, .04 + Math.sin(a) * .49, 8, '#');
    }
    for (let k = 0; k < 7; k++)
        line(-.46 + k * .15, -.12, -.42 + k * .14, .2, .012, 4, ':');
    for (const side of [-1, 1]) {
        line(side * .31, -.31, side * .39, -.63, .045, 7);
        disk(side * .39, -.65, .065, 9, 'O');
    }
    line(-.15, .26, .15, .26, .018, 8, '=');
    const cells = Object.freeze(glyphs.map((glyph, i) => Object.freeze({ glyph, tone: tones[i] })));
    let text = '';
    for (let r = 0; r < rows; r++)
        text += glyphs.slice(r * cols, (r + 1) * cols).join('') + (r === rows - 1 ? '' : '\n');
    return Object.freeze({ columns: cols, rows, cells, text, phase });
}
/** Scenery and every resident share one printable, bounded grid and visible owner map. */
function renderTidepool(o, s, phase, tick) {
    const cols = o.columns, rows = o.rows, ratio = cols * .56 / rows, chars = '.,:;+=*#%@', time = tick / 60;
    const cells = Array.from({ length: cols * rows }, () => ({ glyph: ' ', tone: 0 }));
    const col = (x) => Math.round((x + 1) * .5 * (cols - 1)), row = (y) => Math.round((y + 1) * .5 * (rows - 1));
    function put(c, r, glyph, tone, layer, owner) {
        if (c < 0 || c >= cols || r < 0 || r >= rows)
            return;
        if (layer === 'cue' && cells[r * cols + c]?.owner !== undefined)
            return;
        cells[r * cols + c] = owner === undefined ? { glyph, tone: clamp(Math.round(tone), 0, 9), layer } : { glyph, tone: clamp(Math.round(tone), 0, 9), layer, owner };
    }
    function point(x, y, tone, layer, owner, glyph) { put(col(x), row(y), glyph ?? chars[clamp(Math.round(tone), 0, 9)], tone, layer, owner); }
    function ellipse(x, y, rx, ry, tone, layer, owner, glyph) {
        const cx = (x + 1) * .5 * (cols - 1), cy = (y + 1) * .5 * (rows - 1), w = Math.max(.45, rx * .5 * (cols - 1)), h = Math.max(.45, ry * .5 * (rows - 1));
        for (let r = Math.max(0, Math.floor(cy - h)); r <= Math.min(rows - 1, Math.ceil(cy + h)); r++)
            for (let c = Math.max(0, Math.floor(cx - w)); c <= Math.min(cols - 1, Math.ceil(cx + w)); c++) {
                const q = ((c - cx) / w) ** 2 + ((r - cy) / h) ** 2;
                if (q <= 1) {
                    const t = clamp(Math.round(tone + (1 - q) * 1.2), 0, 9);
                    put(c, r, glyph ?? chars[t], t, layer, owner);
                }
            }
    }
    function line(x, y, xx, yy, thickness, tone, layer, owner, glyph) {
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(xx - x) * cols, Math.abs(yy - y) * rows)));
        for (let i = 0; i <= n; i++) {
            const p = i / n, px = x + (xx - x) * p, py = y + (yy - y) * p;
            if (thickness > 0)
                ellipse(px, py, thickness, thickness * ratio, tone, layer, owner, glyph);
            point(px, py, tone, layer, owner, glyph);
        }
    }
    function text(x, y, label, tone, layer) { const c = clamp(col(x) - Math.floor(label.length / 2), 0, cols - label.length), r = clamp(row(y), 0, rows - 1); for (let i = 0; i < label.length; i++)
        put(c + i, r, label[i], tone, layer); }
    const waveY = -.81 + s.tideLevel * .96;
    // Static sand; no frame-random sparkle. The moving current remains behind the cast.
    for (let r = 4; r < rows - 2; r += 3)
        for (let c = 3; c < cols - 2; c += 4) {
            const hash = ((c * 73856093) ^ (r * 19349663) ^ (o.seed * 83492791)) >>> 0, y = r / (rows - 1) * 2 - 1;
            if (y > waveY + .05 && hash % 5 < 2)
                put(c, r, hash % 7 === 0 ? ':' : '.', 1, 'sand');
        }
    for (let c = 0; c < cols; c++) {
        const x = c / (cols - 1) * 2 - 1, y = waveY + Math.sin(c * .10 - time * .55) * .024;
        if (c % 3 !== 0)
            point(x, y, 3, 'water', undefined, '~');
        if (c % 5 === 0)
            point(x, y - .15, 1, 'water', undefined, '-');
    }
    for (let i = 0; i < 18; i++) {
        const x = ((i * .127 + time * s.current * .025 + 10) % 1) * 2 - 1, y = -.94 + (i % 4) / 4 * Math.max(.03, waveY + .88);
        point(x, y, 1, 'water', undefined, i % 3 === 0 ? '~' : '.');
    }
    if (Math.abs(s.current) > .05)
        text(s.current > 0 ? .76 : -.76, -.88, s.current > 0 ? '>>>' : '<<<', 4, 'water');
    // A repeated contour places each burrow in the world, not in the moving crab.
    for (const a of s.actors) {
        const r = crabRadius(o, a.size);
        ellipse(a.home.x, a.home.y + .025, r * 1.3, r * ratio * .52, 2, 'rock');
        line(a.home.x - r, a.home.y + .03, a.home.x + r, a.home.y + .03, 0, 2, 'rock', undefined, '_');
        ellipse(a.patch.x, a.patch.y + r * ratio * .72, r * 1.48, r * ratio * .18, 1, 'sand', undefined, '.');
    }
    const ordered = [...s.actors].sort((a, b) => a.y - b.y || a.id - b.id);
    for (const a of ordered) {
        const r = crabRadius(o, a.size), mir = o.facing === 'left' ? 1 : -1, sy = r * ratio;
        const xy = (x, y) => [a.x + x * r * mir, a.y + (y * (1 - a.crouch * .18) + a.crouch * .10) * sy];
        const p = (x, y, t, glyph) => { const [xx, yy] = xy(x, y); point(xx, yy, t, 'crab', a.id, glyph); };
        const ell = (x, y, w, h, t, glyph) => { const [xx, yy] = xy(x, y); ellipse(xx, yy, w * r, h * sy, t, 'crab', a.id, glyph); };
        const ln = (x, y, xx, yy, w, t, glyph) => { const from = xy(x, y), to = xy(xx, yy); line(...from, ...to, w * r, t, 'crab', a.id, glyph); };
        for (let k = 7; k >= 0; k--) {
            const side = k < 4 ? -1 : 1, j = k % 4, f = a.feet[mir < 0 ? (k < 4 ? k + 4 : k - 4) : k], knee = xy(side * (1.18 + (3 - j) * .10), -.13 + j * .23);
            const hip = xy(side * .60, -.04 + j * .11);
            line(...hip, ...knee, .027 * r, 5, 'crab', a.id, '=');
            line(...knee, f.x, f.y - f.lift, .017 * r, 7, 'crab', a.id, side < 0 ? '/' : '\\');
            point(f.x, f.y - f.lift, 7, 'crab', a.id, f.planted ? '_' : '^');
        }
        // Chelipeds can sift and signal independently; they do not count as walking legs.
        for (const side of [-1, 1]) {
            const lift = side < 0 ? a.leftClaw : a.rightClaw, feeding = a.behavior.kind === 'forage' && side < 0;
            const x = side * (1.30 - (feeding ? Math.max(0, lift) * .45 : 0)), y = -.62 - lift * .53;
            ln(side * .45, -.19, side * .91, -.35 - lift * .18, .065, 5);
            ln(side * .91, -.35 - lift * .18, x, y, .07, 6);
            ell(x, y, .25, .20, 6);
            const gape = .14 + Math.max(0, lift) * .10;
            ln(x - side * .12, y - .09, x - side * (.19 + gape), y - .32, .04, 7);
            ln(x - side * (.19 + gape), y - .32, x - side * .06, y - .45, .018, 9);
            ln(x + side * .12, y - .09, x + side * (.19 + gape), y - .31, .04, 7);
            ln(x + side * (.19 + gape), y - .31, x + side * .07, y - .45, .018, 9);
            if (feeding) {
                p(x + .1, y + .25, 6, '.');
                p(x - .12, y + .4, 4, ':');
            }
        }
        ell(0, .04, .78, .43, 5);
        for (let k = 0; k < 16; k++) {
            const t = Math.PI + k / 15 * Math.PI;
            p(Math.cos(t) * .79, .04 + Math.sin(t) * .44, 8, '#');
        }
        for (let k = 0; k < 5; k++)
            p(-.42 + k * .21, .03 + (k % 2) * .12, 4, ':');
        for (const side of [-1, 1]) {
            const eyeX = side * .34 + a.gazeX * .07, eyeY = -.61 + a.gazeY * .08;
            ln(side * .29, -.28, eyeX, eyeY, .025, 7);
            p(eyeX, eyeY, 9, 'O');
        }
        ln(-.16, .28, .16, .28, .014, 8, '=');
        if (a.crouch > .7 && Math.hypot(a.x - a.home.x, a.y - a.home.y) < .09) {
            ellipse(a.home.x, a.home.y + sy * .48, r * 1.35, sy * .45, 2, 'rock');
            line(a.home.x - r * 1.1, a.home.y + sy * .19, a.home.x + r * 1.1, a.home.y + sy * .19, 0, 3, 'rock', undefined, '_');
        }
        if (o.labels) {
            const label = `${a.id === s.selectedId ? '[' : ' '}${a.id + 1}${a.id === s.selectedId ? ']' : ' '} ${a.label.toUpperCase()}`;
            const footBottom = Math.max(a.y + sy * .85, ...a.feet.map(f => f.y - f.lift));
            text(a.x, (row(footBottom) + 2) / (rows - 1) * 2 - 1, label, a.id === s.selectedId ? 8 : 5, 'label');
        }
    }
    if (s.guide.active) {
        point(s.guide.x, s.guide.y, 7, 'cue', undefined, '+');
        point(s.guide.x - .025, s.guide.y, 3, 'cue', undefined, '.');
        point(s.guide.x + .025, s.guide.y, 3, 'cue', undefined, '.');
    }
    const frozen = Object.freeze(cells.map(c => Object.freeze(c)));
    let output = '';
    for (let r = 0; r < rows; r++)
        output += cells.slice(r * cols, (r + 1) * cols).map(c => c.glyph).join('') + (r === rows - 1 ? '' : '\n');
    return Object.freeze({ columns: cols, rows, cells: frozen, text: output, phase });
}
/** Browser-only mount, SSR-safe import. Reduced-motion policy stays authoritative. */
export function createCrabArtwork(canvas, input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new TypeError('Options must be an object');
    const { frameSource, ...raw } = input;
    const model = createCrabModel(raw), view = canvas?.ownerDocument?.defaultView, doc = canvas?.ownerDocument;
    if (!view || !doc)
        throw new TypeError('Canvas must belong to a browser document');
    const context = canvas.getContext('2d');
    if (!context)
        throw new Error('Canvas2D unavailable');
    const ctx = context;
    const scheduler = frameSource ?? getBrowserScheduler(view);
    if (typeof scheduler.subscribe !== 'function')
        throw new TypeError('frameSource requires subscribe');
    const media = view.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false, requestedPaused = model.getOptions().paused, inViewport = true, width = 0, height = 0, droppedSeconds = 0, last = null, accumulator = 0;
    let unsubscribe = null;
    let ro, io;
    const listeners = new Set();
    let notifiedTick = -Infinity;
    const reduced = () => model.getOptions().reducedMotion === 'system' && media.matches;
    const blocked = () => disposed || requestedPaused || reduced() || doc.hidden || !inViewport || width <= 0 || height <= 0;
    const status = () => { const s = model.getScene(); return Object.freeze({ paused: blocked(), reducedMotion: reduced(), hidden: doc.hidden, inViewport, disposed, phase: model.getPhase(), tick: model.getState().tick, droppedSeconds, scene: s.scene, beat: s.beat, selectedId: s.selectedId }); };
    function notify(force = false) { if (disposed || !listeners.size)
        return; const t = model.getState().tick; if (!force && t - notifiedTick < 12)
        return; notifiedTick = t; const s = status(); for (const listener of [...listeners]) {
        if (!listeners.has(listener))
            continue;
        try {
            listener(s);
        }
        catch (error) {
            view.setTimeout(() => { throw error; }, 0);
        }
    } }
    function draw() {
        if (disposed || width <= 0 || height <= 0)
            return;
        const frame = model.frame(), o = model.getOptions(), cw = width / frame.columns, ch = height / frame.rows;
        ctx.fillStyle = '#09151b';
        ctx.fillRect(0, 0, width, height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${Math.max(5, ch * .93)}px ui-monospace,SFMono-Regular,Consolas,monospace`;
        const palette = o.palette === 'brass' ? [232, 185, 105] : o.palette === 'lagoon' ? [119, 218, 204] : [227, 154, 180], cast = model.getScene().actors;
        for (let i = 0; i < frame.cells.length; i++) {
            const cell = frame.cells[i];
            if (cell.glyph === ' ')
                continue;
            let color = palette, b = .25 + cell.tone / 12;
            if (cell.layer === 'water') {
                color = [99, 169, 174];
                b = .28 + cell.tone * .11;
            }
            else if (cell.layer === 'sand') {
                color = [156, 138, 102];
                b = .30;
            }
            else if (cell.layer === 'rock') {
                color = [106, 145, 143];
                b = .32 + cell.tone * .09;
            }
            else if (cell.owner !== undefined && o.palette === 'brass') {
                const role = cast[cell.owner]?.role;
                color = role === 'shy' ? [132, 207, 185] : role === 'territorial' ? [235, 147, 113] : palette;
            }
            ctx.fillStyle = `rgb(${color.map(c => Math.min(255, Math.round(c * b))).join(',')})`;
            ctx.fillText(cell.glyph, (i % frame.columns + .5) * cw, (Math.floor(i / frame.columns) + .5) * ch);
        }
    }
    function frame(now) { if (disposed || blocked()) {
        sync();
        return;
    } if (!Number.isFinite(now)) {
        last = null;
        return;
    } if (last === null) {
        last = now;
        return;
    } const dt = Math.max(0, (now - last) / 1000); last = now; droppedSeconds += Math.max(0, dt - .1); accumulator += Math.min(.1, dt); const ticks = Math.min(6, Math.floor((accumulator + 1e-10) * 60)); if (ticks) {
        accumulator -= ticks / 60;
        model.advanceTicks(ticks);
        draw();
        notify();
    } }
    function sync() { if (disposed)
        return; if (blocked()) {
        unsubscribe?.();
        unsubscribe = null;
        last = null;
        accumulator = 0;
    }
    else if (!unsubscribe) {
        last = null;
        unsubscribe = scheduler.subscribe(frame);
    } draw(); notify(true); }
    function resize() { if (disposed)
        return; const r = canvas.getBoundingClientRect(); width = Math.max(0, Math.min(2048, Number.isFinite(r.width) ? r.width : 0)); height = Math.max(0, Math.min(2048, Number.isFinite(r.height) ? r.height : 0)); const dpr = Math.min(2, Math.max(1, view.devicePixelRatio || 1)); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); sync(); }
    function motion() { sync(); }
    function visibility() { sync(); }
    function coords(e) { if (e.isPrimary === false)
        return null; const r = canvas.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0)
        return null; const x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1; return Number.isFinite(x) && Number.isFinite(y) ? [clamp(x, -1, 1), clamp(y, -1, 1)] : null; }
    function pointer(e) { if (disposed)
        return; const p = coords(e); if (p) {
        model.guide(...p);
        if (blocked())
            draw();
    } }
    function leave() { if (disposed)
        return; model.clearGuide(); draw(); notify(true); }
    function up(e) { if (e.pointerType === 'touch' || e.pointerType === 'pen')
        leave(); }
    function greet() { if (disposed)
        return; model.greet(blocked()); draw(); notify(true); }
    function cue(action, id) { if (disposed)
        return; model.cue(action, id, blocked()); draw(); notify(true); }
    function down(e) {
        if (disposed)
            return;
        const p = coords(e);
        if (!p)
            return;
        const frame = model.frame();
        model.guide(...p);
        if (model.getOptions().scene === 'study') {
            greet();
            return;
        }
        const c = Math.round((p[0] + 1) * .5 * (frame.columns - 1)), r = Math.round((p[1] + 1) * .5 * (frame.rows - 1));
        // Only a visible creature glyph owns a hit: sand, waves, labels and covering rocks do not.
        const cell = frame.cells[r * frame.columns + c], scene = model.getScene();
        if (cell?.layer === 'crab' && cell.owner !== undefined) {
            const a = scene.actors[cell.owner];
            model.select(a.id);
            cue(a.role === 'shy' ? 'shelter' : a.role === 'curious' ? 'forage' : 'signal', a.id);
        }
        else if (p[1] > -.81 + scene.tideLevel * .96 + .05) {
            const cast = scene.actors.filter(a => a.role === 'curious'), eligible = cast.length ? cast : scene.actors;
            const closest = [...eligible].sort((a, b) => Math.hypot(a.x - p[0], a.y - p[1]) - Math.hypot(b.x - p[0], b.y - p[1]))[0];
            model.select(closest.id);
            cue('forage', closest.id);
        }
        else {
            draw();
            notify(true);
        }
    }
    function setBeat(beat) { if (disposed)
        return; model.setBeat(beat, blocked()); draw(); notify(true); }
    function nextBeat() { if (disposed)
        return; model.nextBeat(blocked()); draw(); notify(true); }
    function keyboard(e) {
        if (disposed || e.altKey || e.ctrlKey || e.metaKey)
            return;
        const key = e.key?.toLowerCase(), scene = model.getScene();
        let handled = true;
        if (key === ' ') {
            requestedPaused = !requestedPaused;
            sync();
        }
        else if (key === 'f')
            cue('forage');
        else if (key === 's')
            cue('signal');
        else if (key === 'h')
            cue('shelter');
        else if (key === 'n')
            nextBeat();
        else if (key === 'escape')
            leave();
        else if (key && /^[1-5]$/.test(key)) {
            const id = Number(key) - 1;
            if (id < scene.actors.length) {
                model.select(id);
                draw();
                notify(true);
            }
        }
        else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
            const x = scene.guide.x + (key === 'arrowleft' ? -.12 : key === 'arrowright' ? .12 : 0), y = scene.guide.y + (key === 'arrowup' ? -.12 : key === 'arrowdown' ? .12 : 0);
            model.guide(x, y);
            draw();
            notify(true);
        }
        else
            handled = false;
        if (handled)
            e.preventDefault();
    }
    function dispose() { if (disposed)
        return; disposed = true; unsubscribe?.(); unsubscribe = null; listeners.clear(); ro?.disconnect(); io?.disconnect(); media.removeEventListener('change', motion); doc.removeEventListener('visibilitychange', visibility); view.removeEventListener('resize', resize); canvas.removeEventListener('pointermove', pointer); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('pointercancel', leave); canvas.removeEventListener('lostpointercapture', leave); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('keydown', keyboard); }
    try {
        media.addEventListener('change', motion);
        doc.addEventListener('visibilitychange', visibility);
        view.addEventListener('resize', resize);
        canvas.addEventListener('pointermove', pointer);
        canvas.addEventListener('pointerdown', down);
        canvas.addEventListener('pointerleave', leave);
        canvas.addEventListener('pointercancel', leave);
        canvas.addEventListener('lostpointercapture', leave);
        canvas.addEventListener('pointerup', up);
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
        resize();
    }
    catch (error) {
        dispose();
        throw error;
    }
    return Object.freeze({ species: 'crab', canvas, get disposed() { return disposed; }, getOptions: () => Object.freeze({ ...model.getOptions(), paused: requestedPaused }), getStatus: status, getFrame: () => model.frame(),
        update(patch) { if (disposed)
            return; model.configure(patch); if (patch.paused !== undefined)
            requestedPaused = patch.paused; if (blocked() && (patch.scene !== undefined || patch.formation !== undefined))
            model.setBeat(model.getScene().beat, true); sync(); }, play() { if (disposed)
            return; requestedPaused = false; sync(); }, pause() { if (disposed)
            return; requestedPaused = true; sync(); }, restart() { if (disposed)
            return; model.reset(); last = null; accumulator = 0; sync(); }, pulse: greet, guide(x, y) { if (disposed)
            return; model.guide(x, y); draw(); notify(true); }, resize, dispose,
        getScene: model.getScene, select(id) { if (disposed)
            return; model.select(id); draw(); notify(true); }, cue, setBeat, nextBeat, clearGuide: leave,
        subscribe(listener) { if (typeof listener !== 'function')
            throw new TypeError('Subscriber must be a function'); if (disposed)
            return () => { }; const entry = (s) => listener(s); listeners.add(entry); try {
            entry(status());
        }
        catch (error) {
            listeners.delete(entry);
            throw error;
        } return () => { listeners.delete(entry); }; }
    });
}
//# sourceMappingURL=crab.js.map