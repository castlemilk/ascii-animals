/** Fox-only choreography over the existing fixed-tick animal model. No DOM/clock. */
import { createFox } from './model.js';
import { poseFox, neutralFeet } from './geometry.js';
import { clamp, finite, integer, plain, resolveFoxOptions, smooth } from './config.js';
export const FOX_DIRECTOR_LIMITS = Object.freeze({ maxActors: 3, tickRate: 60, maxTick: 0x7fffffff,
    eventsPerTick: 16, cycleTicks: 1800, minCols: 112, minRows: 48, maxCols: 160, maxRows: 64,
    maxAccents: 48, maxPolygons: 144, maxVertices: 3072 });
export const FOX_DIRECTOR_DEFAULTS = Object.freeze({ scene: 'dusk-hunt', count: 2,
    pace: 1, curiosity: .7, wind: .3, spacing: 1, showLabels: true,
    roles: Object.freeze(['auto', 'auto', 'auto']) });
const ROLES = ['auto', 'hunter', 'playmate', 'lookout', 'dreamer'];
const CUES = ['rustle', 'pounce', 'play', 'rest'];
const TABLEAUX = ['listen', 'pounce', 'rest'];
const NAMES = ['Ember', 'Pip', 'Bracken'];
const NEUTRAL = Object.freeze({ headPitch: 0, earNear: 0, earFar: 0, tailLift: 0, rest: 0, bow: 0 });
const easeBetween = (age, start, end) => smooth((age - start) / (end - start));
export function resolveFoxDirectorOptions(patch = {}, base = FOX_DIRECTOR_DEFAULTS) {
    plain(patch, 'director options');
    if (base !== FOX_DIRECTOR_DEFAULTS)
        base = resolveFoxDirectorOptions(base);
    for (const key of Object.keys(patch)) {
        if (!Object.hasOwn(FOX_DIRECTOR_DEFAULTS, key))
            throw new TypeError(`Unknown director option: ${key}`);
        const value = patch[key];
        if (key === 'scene') {
            if (!['dusk-hunt', 'moon-play', 'den-watch'].includes(value))
                throw new TypeError('Unknown fox scene');
        }
        else if (key === 'count')
            integer(value, 1, 3, 'count');
        else if (key === 'showLabels') {
            if (typeof value !== 'boolean')
                throw new TypeError('showLabels must be boolean');
        }
        else if (key === 'roles') {
            if (!Array.isArray(value) || value.length > 3 || Array.from(value).some(role => !ROLES.includes(role)))
                throw new TypeError('roles must contain at most three supported motives');
        }
        else {
            const limits = key === 'pace' ? [.5, 1.5] : key === 'curiosity' ? [0, 1] : key === 'wind' ? [-1, 1] : [.8, 1.15];
            const n = finite(value, key);
            if (n < limits[0] || n > limits[1])
                throw new RangeError(`${key} outside ${limits.join('..')}`);
        }
    }
    return Object.freeze({ ...base, ...patch, roles: Object.freeze([...(patch.roles ?? base.roles)]) });
}
function phase(seed, id) {
    let n = Math.imul(seed ^ (id + 1) * 0x45d9f3b, 0x27d4eb2d);
    n ^= n >>> 15;
    return (n >>> 0) / 0x100000000 * Math.PI * 2;
}
function roleFor(options, id) {
    const role = options.roles[id] ?? 'auto';
    if (role !== 'auto')
        return role;
    return (options.scene === 'dusk-hunt' ? ['hunter', 'lookout', 'playmate'] :
        options.scene === 'moon-play' ? ['playmate', 'playmate', 'lookout'] : ['dreamer', 'lookout', 'dreamer'])[id];
}
function beatAt(time) {
    return time < 180 ? 'arrival' : time < 480 ? 'listening' : time < 900 ? 'investigation' : time < 1200 ? 'response' : 'settling';
}
function home(count, id) {
    if (count === 1)
        return { x: .04, y: .68, size: .84 };
    if (count === 2)
        return [{ x: -.43, y: .74, size: .61 }, { x: .43, y: .37, size: .53 }][id];
    return [{ x: -.43, y: .78, size: .52 }, { x: .45, y: .69, size: .48 }, { x: .04, y: .15, size: .43 }][id];
}
function freezeState(state) {
    Object.freeze(state.pointer);
    if (state.rustle)
        Object.freeze(state.rustle);
    for (const actor of state.actors) {
        Object.freeze(actor.expression);
        if ('target' in actor.intent)
            Object.freeze(actor.intent.target);
        Object.freeze(actor.intent);
        Object.freeze(actor);
    }
    Object.freeze(state.actors);
    return Object.freeze(state);
}
function busy(state) { return 'plan' in state.behavior; }
/** Bounded, phase-authored local expression; the model continues to own the feet and leap. */
function interestExpression(a, age, playful) {
    const origin = a.interestOrigin;
    if (playful) {
        // The white brush flags first. Ears/head then follow; the shoulder bow is last.
        const tail = easeBetween(age, 0, 22), look = easeBetween(age, 20, 48);
        const release = easeBetween(age, 108, 130);
        return {
            headPitch: origin.headPitch * (1 - look) - .22 * look + .31 * release,
            earNear: origin.earNear * (1 - look) + .25 * look - .10 * release,
            earFar: origin.earFar * (1 - look) - .21 * look + .30 * release,
            tailLift: origin.tailLift * (1 - tail) - .25 * tail + .055 * Math.sin(Math.PI * easeBetween(age, 42, 128)),
            rest: origin.rest * (1 - easeBetween(age, 24, 60)),
            bow: Math.sin(Math.PI * easeBetween(age, 48, 124)) * .88,
        };
    }
    // Ear triangulation leads the muzzle: one ear locates, the other cross-checks.
    const locate = easeBetween(age, 0, 12), crossCheck = easeBetween(age, 16, 34);
    const focus = easeBetween(age, 34, 52), lower = easeBetween(age, 122, 175);
    return {
        headPitch: origin.headPitch * (1 - easeBetween(age, 10, 24))
            - .22 * easeBetween(age, 10, 25) + .18 * easeBetween(age, 28, 50) + .17 * lower,
        earNear: origin.earNear * (1 - locate) - .28 * locate + .48 * crossCheck - .04 * focus,
        earFar: origin.earFar * (1 - easeBetween(age, 5, 21)) + .25 * easeBetween(age, 5, 21)
            - .46 * easeBetween(age, 23, 40) + .34 * focus,
        tailLift: origin.tailLift * (1 - locate) + .025 * locate - .07 * lower,
        rest: origin.rest * (1 - easeBetween(age, 0, 35)),
        bow: .25 * easeBetween(age, 154, 201),
    };
}
function responseExpression(state, playful) {
    const b = state.behavior;
    if (!('plan' in b))
        return NEUTRAL;
    const o = b.plan.options;
    if (b.kind === 'crouch')
        return { ...NEUTRAL, headPitch: .12, earNear: .21, earFar: .14, tailLift: playful ? -.24 : -.14 };
    if (b.kind === 'airborne') {
        const u = b.age / o.airTicks;
        return { ...NEUTRAL, headPitch: .12 - .23 * Math.sin(Math.PI * u), earNear: -.12, earFar: -.19,
            tailLift: -.12 * Math.cos(Math.PI * u) - (playful ? .07 : 0) };
    }
    if (b.kind === 'landing') {
        const absorb = 1 - smooth(b.age / Math.max(1, o.landingTicks - 1));
        return { ...NEUTRAL, headPitch: .17 * absorb, earNear: -.08 * absorb, earFar: -.16 * absorb, tailLift: .13 * absorb };
    }
    const settling = b.kind === 'recover' ? 1 - smooth(b.age / Math.max(1, o.recoveryTicks - 1)) : 0;
    return { ...NEUTRAL, headPitch: .10 * settling, earNear: .13 * settling, earFar: -.10 * settling,
        tailLift: (playful ? -.15 : .07) * settling };
}
/** Explicit deterministic director. Its scene clock never changes the animal's 60Hz tick domain. */
export function createFoxDirector(init = {}) {
    plain(init, 'director create options');
    const { seed: seedInput, fox, ...patch } = init;
    if (fox !== undefined)
        plain(fox, 'fox');
    let options = resolveFoxDirectorOptions(patch);
    let seed = integer(seedInput ?? fox?.seed ?? 17, 0, 0xffffffff, 'seed');
    const first = createFox({ ...fox, seed });
    let foxOptions = first.getOptions(), paused = first.isPaused(), disposed = false;
    first.setPaused(false);
    let runtimes = [];
    const alive = () => { if (disposed)
        throw new Error('Fox director is disposed'); };
    const idCheck = (id) => integer(id, 0, options.count - 1, 'fox id');
    function makeActor(id, supplied) {
        const h = home(options.count, id);
        const facing = id % 2 ? (foxOptions.facing === 'right' ? 'left' : 'right') : foxOptions.facing;
        const model = supplied ?? createFox({ ...foxOptions, seed: (seed + Math.imul(id, 2654435761)) >>> 0, facing });
        return { model, intent: { kind: 'autonomous' }, expression: NEUTRAL,
            interestOrigin: NEUTRAL, interestRoot: 0, responsePlayful: false,
            x: h.x * options.spacing, y: h.y, noticeUntil: 0, answerAt: -1 };
    }
    function investigate(a, target, playful) {
        a.interestOrigin = a.expression;
        a.interestRoot = a.model.getState().rootX;
        a.intent = { kind: 'investigate', age: 0, target, playful };
    }
    for (let id = 0; id < options.count; id++)
        runtimes.push(makeActor(id, id === 0 ? first : undefined));
    function actorSnapshot(id, action = 'watching') {
        const a = runtimes[id], h = home(options.count, id);
        return { id, name: NAMES[id], role: roleFor(options, id), action, intent: a.intent,
            state: a.model.getState(), options: a.model.getOptions(), expression: a.expression, x: a.x, y: a.y, size: h.size };
    }
    function initial() {
        return freezeState({ schemaVersion: 1, directorVersion: 1, tick: 0, seed, lastSequence: -1,
            scene: options.scene, sceneTime: 0, cycle: 0, beat: 'arrival', selectedId: 0,
            pointer: { active: false, x: 0, y: 0, stillTicks: 0 }, rustle: null,
            actors: runtimes.map((_, id) => actorSnapshot(id, 'arriving')) });
    }
    let state = initial();
    function refresh() {
        state = freezeState({ ...state, scene: options.scene, actors: runtimes.map((_, id) => actorSnapshot(id, state.actors[id]?.action)) });
        return state;
    }
    function validate(tick, inputs) {
        integer(tick, 1, FOX_DIRECTOR_LIMITS.maxTick, 'tick');
        if (tick !== state.tick + 1)
            throw new RangeError('Director requires exactly the next integer tick');
        if (!Array.isArray(inputs) || inputs.length > 16)
            throw new RangeError('At most 16 director inputs per tick');
        let seq = state.lastSequence;
        for (const event of inputs) {
            plain(event, 'director input');
            const keys = event.type === 'guide' ? ['type', 'tick', 'seq', 'x', 'y'] : event.type === 'cue' ? ['type', 'tick', 'seq', 'cue', 'id', 'x', 'y'] : event.type === 'select' ? ['type', 'tick', 'seq', 'id'] : ['type', 'tick', 'seq'];
            for (const key of Object.keys(event))
                if (!keys.includes(key))
                    throw new TypeError(`Unknown director input field: ${key}`);
            if (event.tick !== tick)
                throw new RangeError('Director event tick mismatch');
            const nextSeq = integer(event.seq, 0, Number.MAX_SAFE_INTEGER, 'seq');
            if (nextSeq <= seq)
                throw new RangeError('Input sequence must increase');
            seq = nextSeq;
            if (event.type === 'guide') {
                finite(event.x, 'x');
                finite(event.y, 'y');
            }
            else if (event.type === 'select')
                idCheck(integer(event.id, 0, options.count - 1, 'fox id'));
            else if (event.type === 'cue') {
                if (!CUES.includes(event.cue))
                    throw new TypeError('Unknown fox cue');
                if (Object.hasOwn(event, 'id'))
                    idCheck(integer(event.id, 0, options.count - 1, 'fox id'));
                if (Object.hasOwn(event, 'x') !== Object.hasOwn(event, 'y'))
                    throw new TypeError('Cue x/y must be supplied together');
                if (Object.hasOwn(event, 'x')) {
                    finite(event.x, 'cue x');
                    finite(event.y, 'cue y');
                }
            }
            else if (event.type !== 'leave')
                throw new TypeError('Unknown director input');
        }
    }
    function getFrame(tableau) {
        alive();
        if (tableau !== undefined && !TABLEAUX.includes(tableau))
            throw new TypeError('Unknown fox tableau');
        const actors = state.actors.map(actor => {
            let poseState = actor.state, expression = actor.expression;
            if (tableau) {
                expression = { ...NEUTRAL, headPitch: tableau === 'listen' ? -.18 : .07,
                    earNear: tableau === 'listen' ? -.2 : .15, earFar: tableau === 'listen' ? .18 : -.1,
                    tailLift: tableau === 'listen' ? -.17 : .1, rest: tableau === 'rest' ? 1 : 0, bow: 0 };
                poseState = { ...poseState, rootX: 0, feet: neutralFeet(0, actor.options), behavior: tableau === 'pounce' ? { kind: 'crouch', age: actor.options.crouchTicks - 1,
                        plan: { fromX: 0, toX: 0, options: actor.options } } : { kind: 'idle' } };
            }
            return { actor, pose: poseFox(poseState, actor.options, expression) };
        });
        return { state, options, tableau: tableau ?? null, actors };
    }
    return Object.freeze({
        getOptions() { alive(); return options; }, getFoxOptions() { alive(); return foxOptions; },
        getState() { alive(); return state; }, getFrame,
        configure(p) {
            alive();
            const next = resolveFoxDirectorOptions(p, options), changedScene = next.scene !== options.scene;
            const changedLayout = next.count !== options.count || next.spacing !== options.spacing;
            options = next;
            while (runtimes.length > options.count)
                runtimes.pop().model.dispose();
            while (runtimes.length < options.count)
                runtimes.push(makeActor(runtimes.length));
            // Layout edits may reframe the cast. Simulation never drifts these anchors:
            // translating the whole actor every tick would slide all four stance paws.
            if (changedLayout)
                runtimes.forEach((a, id) => { const h = home(options.count, id); a.x = h.x * options.spacing; a.y = h.y; });
            if (changedScene) {
                for (const a of runtimes) {
                    a.intent = { kind: 'autonomous' };
                    a.answerAt = -1;
                    a.noticeUntil = 0;
                }
                state = { ...state, sceneTime: 0, cycle: 0, beat: 'arrival', rustle: null, pointer: { active: false, x: 0, y: 0, stillTicks: 0 } };
            }
            state = { ...state, selectedId: Math.min(state.selectedId, options.count - 1) };
            refresh();
            return options;
        },
        configureFox(p) {
            alive();
            const next = resolveFoxOptions(p, foxOptions);
            for (const a of runtimes)
                a.model.configure(p);
            foxOptions = next;
            refresh();
            return foxOptions;
        },
        select(id) { alive(); idCheck(id); state = freezeState({ ...state, selectedId: id }); return state; },
        step(tick, inputs = []) {
            alive();
            validate(tick, inputs);
            if (paused)
                return { kind: 'paused', state, eventsAccepted: 0, cue: 'none' };
            let selected = state.selectedId, pointer = { ...state.pointer, stillTicks: state.pointer.stillTicks + 1 };
            let sequence = state.lastSequence, rustle = state.rustle ? { ...state.rustle, age: state.rustle.age + 1 } : null;
            if (rustle && rustle.age > 420)
                rustle = null;
            let cueResult = 'none';
            const instant = new Set();
            for (const e of inputs) {
                sequence = e.seq;
                if (e.type === 'guide') {
                    const x = clamp(e.x, -1, 1), y = clamp(e.y, -1, 1);
                    pointer = { active: true, x, y, stillTicks: Math.hypot(x - pointer.x, y - pointer.y) < .025 ? pointer.stillTicks : 0 };
                }
                else if (e.type === 'leave')
                    pointer = { active: false, x: 0, y: 0, stillTicks: 0 };
                else if (e.type === 'select')
                    selected = e.id;
                else {
                    let owner = e.id ?? selected;
                    if (e.id === undefined && e.x !== undefined) {
                        let distance = Infinity;
                        for (const a of state.actors) {
                            const d = Math.hypot(e.x - a.x, e.y - a.y);
                            if (d < distance) {
                                distance = d;
                                owner = a.id;
                            }
                        }
                    }
                    const a = runtimes[owner];
                    if (busy(a.model.getState()) || a.intent.kind === 'investigate') {
                        cueResult = 'ignored-busy';
                        continue;
                    }
                    selected = owner;
                    cueResult = 'accepted';
                    const target = { x: clamp(e.x ?? (a.x + .2), -1, 1), y: clamp(e.y ?? a.y, -1, 1) };
                    if (e.cue === 'rest')
                        a.intent = { kind: 'rest', age: 0 };
                    else if (e.cue === 'pounce') {
                        instant.add(owner);
                        a.intent = { kind: 'autonomous' };
                    }
                    else
                        investigate(a, target, e.cue === 'play');
                    rustle = { ...target, age: 0, owner };
                    runtimes.forEach((other, id) => { if (id !== owner) {
                        other.noticeUntil = tick + 110 + id * 23;
                        if (e.cue === 'play')
                            other.answerAt = tick + 135 + id * 45;
                    } });
                }
            }
            const rawTime = state.sceneTime + options.pace, sceneTime = rawTime % 1800;
            const cycle = state.cycle + Math.floor(rawTime / 1800), beat = beatAt(sceneTime);
            const snapshots = [];
            for (let id = 0; id < runtimes.length; id++) {
                const a = runtimes[id], before = a.model.getState(), role = roleFor(options, id), p = phase(seed, id);
                let action = 'watching', guide = null, pounce = instant.has(id), rest = 0, bow = 0;
                let authored = null;
                if (a.answerAt === tick && !busy(before) && a.intent.kind === 'autonomous') {
                    const inviter = state.rustle ? runtimes[state.rustle.owner] : undefined;
                    investigate(a, { x: inviter?.x ?? -.3, y: inviter?.y ?? .3 }, true);
                }
                // Ambient scenes use the same full anticipation as deliberate invitations.
                // The scene clock schedules a start; the captured response stays at 60 Hz.
                const autoPlay = options.scene === 'moon-play' || role === 'playmate';
                const trigger = options.scene === 'moon-play' ? 460 + id * 170 : 830 + id * 180;
                const start = trigger - (autoPlay ? 129 : 204);
                if (role !== 'lookout' && role !== 'dreamer' && a.intent.kind === 'autonomous' && !busy(before)
                    && sceneTime >= start && state.sceneTime < start) {
                    investigate(a, { x: clamp(a.x + (a.model.getOptions().facing === 'right' ? .3 : -.3), -1, 1), y: a.y }, autoPlay);
                }
                if (a.intent.kind === 'investigate') {
                    const intent = a.intent, age = intent.age + 1;
                    const leapAt = intent.playful ? 130 : 205;
                    const targetX = clamp((intent.target.x - a.x) * 3, -.95, .95) * .2;
                    const delta = targetX - a.interestRoot;
                    const stopX = a.interestRoot + Math.sign(delta) * Math.max(0, Math.abs(delta) - .07);
                    authored = interestExpression(a, age, intent.playful);
                    if (intent.playful) {
                        action = age < 48 ? 'listening' : age < 108 ? 'bowing' : 'playing';
                        // The tail and then the bow are readable before the first careful step.
                        if (age >= 76 && age < leapAt)
                            guide = { x: (before.rootX + clamp(stopX - before.rootX, -.014, .014)) / .2, y: .45 };
                    }
                    else {
                        const creeping = age >= 45 && age < 100 || age >= 130 && age < 166;
                        action = age < 45 ? 'listening' : creeping ? 'stalking' : 'sniffing';
                        if (creeping) {
                            const goal = age < 100 ? a.interestRoot + (stopX - a.interestRoot) * .68 : stopX;
                            guide = { x: (before.rootX + clamp(goal - before.rootX, -.014, .014)) / .2, y: .7 };
                        }
                        else if (age >= 45 && age < leapAt) {
                            // Keep the nose working while the paws finish planting between steps.
                            guide = { x: before.rootX / .2, y: .7 };
                        }
                    }
                    if (age === leapAt) {
                        pounce = true;
                        guide = { x: targetX / .2, y: .65 };
                    }
                    if (age > leapAt) {
                        action = 'recovering';
                        guide = null;
                        authored = NEUTRAL;
                    }
                    a.intent = age > 420 ? { kind: 'autonomous' } : { ...intent, age };
                }
                else if (a.intent.kind === 'rest') {
                    rest = 1;
                    action = 'resting';
                    a.intent = a.intent.age >= 540 ? { kind: 'autonomous' } : { kind: 'rest', age: a.intent.age + 1 };
                }
                else {
                    const idleCycle = (tick + Math.floor(p * 50) + id * 37) % 420;
                    if (beat === 'arrival') {
                        action = 'arriving';
                        guide = { x: id % 2 ? -.7 : .7, y: 0 };
                    }
                    else if (role === 'dreamer' || (beat === 'settling' && role !== 'lookout')) {
                        rest = idleCycle < 330 ? 1 : .45;
                        action = 'resting';
                    }
                    else if (role === 'lookout') {
                        action = idleCycle < 240 ? 'watching' : 'listening';
                    }
                    else if (options.scene === 'moon-play' || role === 'playmate') {
                        action = idleCycle < 95 ? 'bowing' : 'playing';
                        bow = idleCycle < 95 ? Math.sin(idleCycle / 95 * Math.PI) : 0;
                        guide = { x: Math.sin(sceneTime / 140 + p) * .92, y: .3 };
                    }
                    else if (beat === 'listening')
                        action = 'listening';
                    else {
                        action = idleCycle < 90 ? 'sniffing' : 'stalking';
                        guide = { x: Math.sin(sceneTime / 220 + p) * .92, y: .7 };
                    }
                    if (pointer.active && options.curiosity > 0 && id === selected && role !== 'dreamer') {
                        if (pointer.stillTicks > 35) {
                            guide = { x: clamp((pointer.x - a.x) * 2.5, -.95, .95), y: pointer.y };
                            action = 'stalking';
                        }
                        else
                            action = 'listening';
                    }
                }
                if (a.noticeUntil > tick && !busy(before) && a.intent.kind === 'autonomous') {
                    action = 'listening';
                    guide = null;
                    rest = 0;
                }
                if (guide && !busy(before) && Math.abs(guide.x * .2 - before.rootX) > .006) {
                    a.model.configure({ facing: guide.x * .2 > before.rootX ? 'right' : 'left' });
                }
                // An in-flight/recovering fox finishes its captured response before it
                // receives new walking guidance, including on the last cooldown tick.
                if (busy(before))
                    guide = null;
                const modelTick = before.tick + 1, seq = before.lastSequence + 1;
                const events = [guide ? { type: 'guide', tick: modelTick, seq, ...guide } : { type: 'leave', tick: modelTick, seq }];
                if (pounce)
                    events.push({ type: 'pounce', tick: modelTick, seq: seq + 1 });
                const after = a.model.step(modelTick, events).state;
                if (!busy(before) && busy(after))
                    a.responsePlayful = a.intent.kind === 'investigate' && a.intent.playful;
                if (['crouch', 'airborne', 'landing'].includes(after.behavior.kind)) {
                    action = 'pouncing';
                    rest = 0;
                    bow = 0;
                }
                else if (busy(after)) {
                    action = 'recovering';
                    rest = 0;
                    bow = 0;
                }
                const attention = action === 'listening' || action === 'watching';
                const lookY = pointer.active && id === selected ? clamp(pointer.y - a.y, -.7, .7) : Math.sin(tick / 97 + p) * .35;
                const ambient = { headPitch: rest ? .16 : attention ? -.16 + lookY * .2 * options.curiosity : .035,
                    earNear: Math.sin(tick / 43 + p) * .12 + (attention ? -.17 : .07),
                    earFar: Math.sin(tick / 61 + p + 1.2) * .12 + (attention ? .14 : -.03),
                    tailLift: rest ? .16 : action === 'playing' || action === 'bowing' ? -.23 : attention ? -.13 : .06,
                    rest, bow };
                const desired = busy(after) ? responseExpression(after, a.responsePlayful) : authored ?? ambient;
                a.expression = Object.fromEntries(Object.keys(NEUTRAL).map(key => [key,
                    a.expression[key] + (desired[key] - a.expression[key]) * .09]));
                snapshots.push(actorSnapshot(id, action));
            }
            state = freezeState({ ...state, tick, lastSequence: sequence, scene: options.scene, sceneTime, cycle, beat,
                selectedId: selected, pointer, rustle, actors: snapshots });
            return { kind: 'advanced', state, eventsAccepted: inputs.length, cue: cueResult };
        },
        setPaused(value) { alive(); if (typeof value !== 'boolean')
            throw new TypeError('paused must be boolean'); paused = value; },
        isPaused() { alive(); return paused; },
        reset(nextSeed = seed) {
            alive();
            integer(nextSeed, 0, 0xffffffff, 'seed');
            seed = nextSeed;
            runtimes.forEach(a => a.model.dispose());
            runtimes = Array.from({ length: options.count }, (_, id) => makeActor(id));
            state = initial();
            return state;
        },
        dispose() { if (disposed)
            return; disposed = true; for (const a of runtimes)
            a.model.dispose(); runtimes = []; },
    });
}
