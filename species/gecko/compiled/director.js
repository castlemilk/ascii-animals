/** Gecko-only wall choreography. No DOM, clock, random source or scheduler. */
import { createGeckoLocomotor, DEFAULT_GECKO_OPTIONS, resolveGeckoOptions } from './gecko.js';
export const GECKO_DIRECTOR_LIMITS = Object.freeze({ animals: 3, samples: 36_864, maxCols: 256, maxRows: 168,
    eventsPerTick: 32, environmentMarks: 4096, worldWidth: 6.6, worldHeight: 4.4, rootX: 2, rootY: 1 });
const IDS = ['mica', 'pip', 'slate'];
const ROLES = ['scout', 'hunter', 'sentry'];
const SCENES = ['moonlit-wall', 'lantern-hunt', 'passing-shadow'];
export const DEFAULT_GECKO_DIRECTOR_OPTIONS = Object.freeze({
    scene: 'moonlit-wall', population: 3, tempo: 1, boldness: .55, reverse: false,
    showRoutes: false, autonomy: true, roles: Object.freeze([...ROLES]),
});
export const GECKO_SCENES = Object.freeze([
    Object.freeze({ id: 'moonlit-wall', label: 'Moonlit wall', description: 'Three quiet lives follow the seams.', ticks: 1440 }),
    Object.freeze({ id: 'lantern-hunt', label: 'Lantern hunt', description: 'A small light, a long moment of anticipation.', ticks: 1320 }),
    Object.freeze({ id: 'passing-shadow', label: 'Passing shadow', description: 'Notice, shelter, then find courage again.', ticks: 1440 }),
]);
const SCORES = {
    'moonlit-wall': [['emerge', 120], ['climb', 480], ['inspect', 180], ['traverse', 480], ['perch', 180]],
    'lantern-hunt': [['notice', 150], ['stalk', 540], ['poise', 120], ['strike', 90], ['return', 420]],
    'passing-shadow': [['peek', 180], ['explore', 420], ['shadow', 120], ['shelter', 180], ['return', 420], ['settle', 120]],
};
const HOMES = [{ x: -1.6, y: .68 }, { x: .05, y: .32 }, { x: 1.62, y: -.28 }];
const ROUTES = [
    [{ x: -1.6, y: .68 }, { x: -1.72, y: -.30 }, { x: -1.10, y: -.88 }, { x: -.66, y: -.25 }, { x: -1.15, y: .40 }],
    [{ x: .05, y: .32 }, { x: .54, y: -.14 }, { x: .30, y: -.79 }, { x: -.10, y: -.30 }, { x: .05, y: .65 }],
    [{ x: 1.62, y: -.28 }, { x: 1.52, y: .60 }, { x: .97, y: .58 }, { x: .95, y: -.16 }, { x: 1.58, y: -.72 }],
];
const SCALES = [1, .94, .88];
const HEADINGS = [-1.3, -.7, 2.65];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const copy = (p) => ({ x: p.x, y: p.y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const world = (body, scale) => ({ x: body.position.x * scale, y: body.position.y * scale });
const bound = (p) => ({ x: clamp(p.x, -2, 2), y: clamp(p.y, -1, 1) });
const ease = (n) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
const optionsCopy = (o) => ({ ...o, roles: [...o.roles] });
function record(v, keys, name) {
    if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)))
        throw new TypeError(`${name} must be a plain object`);
    for (const key of Reflect.ownKeys(v))
        if (typeof key !== 'string' || !keys.includes(key))
            throw new TypeError(`Unknown ${name} field ${String(key)}`);
}
function finite(v, lo, hi, name, integer = false) {
    if (typeof v !== 'number' || !Number.isFinite(v))
        throw new TypeError(`${name} must be finite`);
    if (v < lo || v > hi || (integer && !Number.isSafeInteger(v)))
        throw new RangeError(`${name} outside ${lo}..${hi}`);
}
export function resolveGeckoDirectorOptions(patch = {}, base = DEFAULT_GECKO_DIRECTOR_OPTIONS) {
    record(patch, ['scene', 'population', 'tempo', 'boldness', 'reverse', 'showRoutes', 'autonomy', 'roles'], 'director');
    const o = { ...(base === DEFAULT_GECKO_DIRECTOR_OPTIONS ? base : resolveGeckoDirectorOptions(base)), ...patch };
    // Read present keys explicitly: non-enumerable invalid values must not silently
    // become defaults when a JavaScript caller supplies property descriptors.
    for (const key of Reflect.ownKeys(patch))
        Object.assign(o, { [key]: patch[key] });
    if (!SCENES.includes(o.scene))
        throw new TypeError('Unknown Gecko scene');
    finite(o.population, 1, 3, 'population', true);
    finite(o.tempo, .4, 1.6, 'tempo');
    finite(o.boldness, 0, 1, 'boldness');
    for (const key of ['reverse', 'showRoutes', 'autonomy'])
        if (typeof o[key] !== 'boolean')
            throw new TypeError(`${key} must be boolean`);
    if (!Array.isArray(o.roles) || o.roles.length < 1 || o.roles.length > 3 || [...o.roles].some(r => !ROLES.includes(r)))
        throw new TypeError('roles must contain1..3 known Gecko roles');
    return Object.freeze({ ...o, roles: Object.freeze([...o.roles]) });
}
export function geckoSceneArc(scene, scoreTick) {
    if (!SCENES.includes(scene))
        throw new TypeError('Unknown Gecko scene');
    finite(scoreTick, 0, Number.MAX_SAFE_INTEGER, 'scoreTick');
    const score = SCORES[scene], total = score.reduce((sum, b) => sum + b[1], 0);
    const cycle = Math.floor(scoreTick / total);
    let at = scoreTick % total;
    for (let i = 0; i < score.length; i++) {
        const beat = score[i];
        if (at < beat[1])
            return { scene, beat: beat[0], beatIndex: i, progress: at / beat[1], cycle, scoreTick };
        at -= beat[1];
    }
    throw new RangeError('Invalid score tick');
}
/** Opt-in director; each member uses the existing real contact-gait model. */
export function createGeckoDirector(config = {}) {
    record(config, ['seed', 'heading', 'options', 'animal'], 'director config');
    let seed = config.seed === undefined ? 37 : config.seed;
    finite(seed, 0, 0xffff_ffff, 'seed', true);
    let heading = config.heading;
    if (heading !== undefined)
        finite(heading, -Math.PI, Math.PI, 'heading');
    let options = resolveGeckoDirectorOptions(config.options);
    let animal = resolveGeckoOptions(config.animal, { ...DEFAULT_GECKO_OPTIONS, creepSpeed: .15, turnRate: .95, stepTicks: 15 });
    let tick = 0, seq = 0, scoreTick = 0, disposed = false, selectedId = 'mica';
    let pointer = null, pointerUntil = 0, lastAction = null;
    let mothOverride = null;
    let caughtBy = null, caughtCycle = -1;
    let shadowSince = -1000, shadowPosition = { x: 1.35, y: -.3 }, lastShadowCycle = -1;
    let actors = [];
    const alive = () => { if (disposed)
        throw new Error('Gecko director is disposed'); };
    function modelOptions(index) {
        const factor = index === 2 ? .85 : 1;
        return resolveGeckoOptions({ creepSpeed: clamp(animal.creepSpeed * options.tempo * factor, .02, .18), turnRate: clamp(animal.turnRate * options.tempo, .15, 1.2), stepTicks: Math.round(clamp(animal.stepTicks / options.tempo, 12, 30)) }, animal);
    }
    function makeActor(index) {
        const scale = SCALES[index], home = HOMES[index], memberSeed = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
        const locomotor = createGeckoLocomotor({ seed: memberSeed, heading: heading ?? HEADINGS[index], options: modelOptions(index),
            habitat: { extentX: 2 / scale, extentY: 1 / scale, origin: { x: home.x / scale, y: home.y / scale } } });
        return { id: IDS[index], index, role: options.roles[index] ?? ROLES[index], scale,
            model: locomotor.model, locomotor, hunt: null, assessUntil: 0,
            motive: 'watch', emotion: 'content', tail: .04, routeIndex: 0, goal: null, forced: null, alarmAt: null, cooldownUntil: 0, catches: 0, phase: (memberSeed % 173), strikeUntil: 0 };
    }
    function populate() {
        while (actors.length > options.population)
            actors.pop().model.dispose();
        while (actors.length < options.population)
            actors.push(makeActor(actors.length));
        for (const a of actors) {
            a.role = options.roles[a.index] ?? ROLES[a.index];
            a.model.update(modelOptions(a.index));
        }
        if (selectedId !== null && !actors.some(a => a.id === selectedId))
            selectedId = actors[0].id;
        if (mothOverride && !actors.some(a => a.id === mothOverride.owner))
            mothOverride = null;
        if (caughtBy && !actors.some(a => a.id === caughtBy))
            caughtBy = null;
    }
    populate();
    function mothPosition() {
        const committed = actors.find(a => a.hunt && a.hunt.phase !== 'track');
        if (committed?.hunt)
            return copy(committed.hunt.target);
        if (mothOverride && tick <= mothOverride.until)
            return copy(mothOverride.position);
        return { x: .76 + .075 * Math.sin(scoreTick / 260), y: -.52 + .045 * Math.sin(scoreTick / 190 + .7) };
    }
    function targetOwner(point, id) {
        const named = id ?? selectedId;
        if (named !== null && named !== undefined)
            return actors.find(a => a.id === named);
        return actors.reduce((best, a) => distance(world(a.model.getSnapshot(), a.scale), point) < distance(world(best.model.getSnapshot(), best.scale), point) ? a : best, actors[0]);
    }
    function snapshot() {
        const arc = geckoSceneArc(options.scene, scoreTick);
        const shadowAge = tick - shadowSince;
        return { version: 1, seed, tick, lastSequence: seq, options: optionsCopy(options), arc, selectedId, pointer: pointer ? copy(pointer) : null,
            moth: { position: mothPosition(), visible: (options.scene === 'lantern-hunt' || !!mothOverride) && caughtBy === null, caughtBy },
            shadow: { active: shadowAge >= 0 && shadowAge < 150, progress: clamp(shadowAge / 150, 0, 1), position: copy(shadowPosition) },
            individuals: actors.map(a => ({ id: a.id, label: a.id[0].toUpperCase() + a.id.slice(1), role: a.role, scale: a.scale, body: a.model.getSnapshot(),
                motive: a.motive, emotion: a.emotion, tailExpression: a.tail, blink: (tick + a.phase) % 270 < 7, route: ROUTES[a.index].map(copy), routeIndex: a.routeIndex,
                goal: a.goal ? copy(a.goal) : null, cooldown: Math.max(0, a.cooldownUntil - tick), catches: a.catches })), lastAction: lastAction ? { ...lastAction } : null };
    }
    function validate(events) {
        if (!Array.isArray(events) || events.length > 32)
            throw new RangeError('Director accepts at most32 events per tick');
        let previous = seq;
        for (const e of events) {
            if (!e || typeof e !== 'object')
                throw new TypeError('Director event must be an object');
            if (!['guide', 'leave', 'select', 'moth', 'shadow', 'return', 'inspect'].includes(e.type))
                throw new TypeError('Unknown director event');
            const keys = e.type === 'leave' ? ['type', 'tick', 'seq'] : e.type === 'select' ? ['type', 'tick', 'seq', 'id'] : ['type', 'tick', 'seq', 'id', 'x', 'y'];
            record(e, keys, 'director event');
            finite(e.tick, tick + 1, tick + 1, 'event.tick', true);
            finite(e.seq, previous + 1, Number.MAX_SAFE_INTEGER, 'event.seq', true);
            previous = e.seq;
            if ('id' in e && !(e.type === 'select' && e.id === null) && (!IDS.includes(e.id) || !actors.some(a => a.id === e.id)))
                throw new RangeError('Target gecko is not in the cast');
            if (e.type === 'select' && e.id !== null && !actors.some(a => a.id === e.id))
                throw new RangeError('Select an active gecko');
            if (e.type !== 'leave' && e.type !== 'select') {
                if (e.type === 'guide' || 'x' in e || 'y' in e) {
                    finite(e.x, -1, 1, 'event.x');
                    finite(e.y, -1, 1, 'event.y');
                }
            }
        }
    }
    function alarm(actor, point, delay = 0) {
        const body = actor.model.getSnapshot();
        if (actor.cooldownUntil > tick || !['idle', 'approach'].includes(body.behavior.kind))
            return false;
        actor.alarmAt = tick + delay;
        actor.hunt = null;
        actor.cooldownUntil = tick + delay + animal.startleTicks + animal.retreatTicks + animal.recoveryTicks + animal.cooldownTicks;
        actor.forced = { kind: 'shadow', until: tick + 1200, target: copy(HOMES[actor.index]), returnAt: null };
        return true;
    }
    function step(events = []) {
        alive();
        if (tick >= 2_147_483_646)
            throw new RangeError('Reset before the maximum director tick');
        validate(events);
        tick++;
        const receipts = [];
        for (const e of events) {
            seq = e.seq;
            if (e.type === 'select') {
                selectedId = e.id;
                receipts.push({ seq, type: e.type, outcome: 'applied', id: selectedId });
                continue;
            }
            if (e.type === 'leave') {
                pointer = null;
                for (const a of actors)
                    if (a.forced?.kind === 'inspect')
                        a.forced = null;
                receipts.push({ seq, type: e.type, outcome: 'applied', id: null });
                continue;
            }
            const point = 'x' in e && e.x !== undefined ? bound({ x: e.x * 3.3, y: e.y * 2.2 }) : null;
            const actor = targetOwner(point ?? { x: 0, y: 0 }, e.id), position = world(actor.model.getSnapshot(), actor.scale);
            const direction = actor.model.getSnapshot().heading;
            const target = point ?? (e.type === 'moth' ? bound({ x: position.x + Math.cos(direction) * .84, y: position.y + Math.sin(direction) * .84 }) : e.type === 'inspect'
                ? bound({ x: position.x + Math.cos(direction) * .65, y: position.y + Math.sin(direction) * .65 }) : position);
            if (e.type === 'guide' || e.type === 'inspect') {
                if (actor.forced?.kind !== 'inspect')
                    actor.assessUntil = tick + 20;
                actor.hunt = null;
                pointer = copy(target);
                pointerUntil = tick + Math.round(180 + options.boldness * 180);
                actor.forced = { kind: 'inspect', until: pointerUntil, target: copy(target), returnAt: null };
            }
            else if (e.type === 'moth') {
                for (const other of actors) {
                    other.hunt = null;
                    if (other !== actor && other.forced?.kind === 'moth')
                        other.forced = { kind: 'return', until: tick + 900, target: copy(HOMES[other.index]), returnAt: null };
                }
                mothOverride = { position: bound(target), until: tick + 480, owner: actor.id };
                caughtBy = null;
                actor.hunt = { phase: 'track', since: tick, started: tick, target: bound(target), heading: direction, distance: 0, caught: false };
                actor.forced = { kind: 'moth', until: tick + 1050, target: bound(target), returnAt: null };
            }
            else if (e.type === 'return') {
                actor.hunt = null;
                actor.forced = { kind: 'return', until: tick + 1200, target: copy(HOMES[actor.index]), returnAt: null };
            }
            else if (e.type === 'shadow') {
                if (!alarm(actor, target)) {
                    receipts.push({ seq, type: 'shadow', outcome: 'ignored', reason: 'busy', id: actor.id });
                    continue;
                }
                shadowSince = tick;
                shadowPosition = copy(target);
                const radius = 1.2 - options.boldness * .35;
                for (const other of actors)
                    if (other !== actor && distance(world(other.model.getSnapshot(), other.scale), target) < radius)
                        alarm(other, target, 12 + other.index * 8);
            }
            receipts.push({ seq, type: e.type, outcome: 'applied', id: actor.id });
        }
        if (receipts.length)
            lastAction = { ...receipts[receipts.length - 1] };
        const beforeArc = geckoSceneArc(options.scene, scoreTick);
        if (options.autonomy)
            scoreTick += options.tempo;
        const arc = geckoSceneArc(options.scene, scoreTick);
        if (arc.cycle !== beforeArc.cycle) {
            if (!mothOverride) {
                caughtBy = null;
                caughtCycle = -1;
            }
            for (const a of actors)
                if (!a.forced)
                    a.hunt = null;
        }
        if (pointer && tick > pointerUntil)
            pointer = null;
        if (mothOverride && tick > mothOverride.until) {
            const owner = actors.find(a => a.id === mothOverride.owner);
            if (owner?.forced?.kind === 'moth') {
                owner.forced = { kind: 'return', until: tick + 900, target: copy(HOMES[owner.index]), returnAt: null };
                if (owner.hunt?.phase === 'track' || owner.hunt?.phase === 'brace')
                    owner.hunt = null;
                else if (owner.hunt?.phase === 'pounce') {
                    owner.hunt.phase = 'recover';
                    owner.hunt.since = tick;
                }
            }
            mothOverride = null;
            caughtBy = null;
        }
        if (options.autonomy && arc.scene === 'passing-shadow' && arc.beat === 'shadow' && arc.cycle !== lastShadowCycle) {
            lastShadowCycle = arc.cycle;
            shadowSince = tick;
            shadowPosition = { x: 1.45, y: -.25 };
            for (const a of actors)
                if (distance(world(a.model.getSnapshot(), a.scale), shadowPosition) < 1.4 - options.boldness * .3)
                    alarm(a, shadowPosition, a.index * 9);
        }
        const moth = mothPosition(), hunter = actors.find(a => a.role === 'hunter') ?? actors[0];
        const positions = actors.map(a => world(a.model.getSnapshot(), a.scale));
        for (const a of actors) {
            const body = a.model.getSnapshot(), position = positions[a.index];
            if (a.forced && tick > a.forced.until)
                a.forced = null;
            let goal = null, motive = 'watch', emotion = 'content';
            let drive;
            const route = ROUTES[a.index], direction = options.reverse ? -1 : 1;
            if (options.autonomy) {
                // The inspect beat keeps the previous climb destination, allowing actual
                // arrival before investigation instead of changing goal at the threshold.
                const routeBeat = arc.scene === 'moonlit-wall' && arc.beat === 'inspect' ? arc.beatIndex - 1 : arc.beatIndex;
                const index = ((arc.cycle + routeBeat + (a.role === 'sentry' ? 0 : a.index)) * direction % route.length + route.length) % route.length;
                a.routeIndex = index;
                goal = copy(route[index]);
                motive = 'explore';
                emotion = 'curious';
                const period = a.role === 'sentry' ? 300 : a.role === 'hunter' ? 210 : 180, hold = a.role === 'sentry' ? 115 : a.role === 'hunter' ? 52 : 30;
                if ((tick + a.phase) % period < hold) {
                    goal = null;
                    motive = 'watch';
                    emotion = 'content';
                }
                if ((arc.scene === 'moonlit-wall' && arc.beat === 'perch') || (arc.scene === 'passing-shadow' && arc.beat === 'settle')) {
                    goal = copy(HOMES[a.index]);
                    motive = distance(position, goal) < .10 ? 'watch' : 'return';
                }
                else if (arc.scene === 'moonlit-wall' && arc.beat === 'inspect') {
                    goal = copy(route[index]);
                    motive = distance(position, goal) < .12 ? 'inspect' : 'explore';
                }
                else if (arc.scene === 'passing-shadow' && (arc.beat === 'shelter' || arc.beat === 'return')) {
                    goal = copy(HOMES[a.index]);
                    motive = distance(position, goal) < .10 ? 'watch' : arc.beat === 'shelter' ? 'shelter' : 'return';
                    emotion = 'wary';
                }
            }
            const hunting = (a.forced?.kind === 'moth' && mothOverride?.owner === a.id) || (!a.forced && options.autonomy && !mothOverride && arc.scene === 'lantern-hunt' && a === hunter && arc.beat !== 'return');
            if (hunting && caughtBy === null && !a.hunt)
                a.hunt = { phase: 'track', since: tick, started: tick, target: copy(moth), heading: body.heading, distance: 0, caught: false };
            if (a.hunt) {
                const hunt = a.hunt;
                const toward = Math.atan2(moth.y - position.y, moth.x - position.x);
                const angle = Math.atan2(Math.sin(toward - body.heading), Math.cos(toward - body.heading));
                const head = { x: position.x + Math.cos(body.heading) * .55 * a.scale, y: position.y + Math.sin(body.heading) * .55 * a.scale };
                emotion = 'focused';
                if (hunt.phase === 'track') {
                    hunt.target = copy(moth);
                    goal = copy(moth);
                    motive = 'stalk';
                    // Read the prey before moving; once close, finish the current foot
                    // transfer. Only a fully supported stance may launch the wall pounce.
                    if (tick - hunt.started < 24) {
                        goal = null;
                        drive = { hold: true };
                    }
                    if (distance(head, moth) < .21 * a.scale && Math.abs(angle) < .16 && tick - hunt.started >= 32) {
                        goal = null;
                        drive = { hold: true };
                        if (a.forced || (arc.scene === 'lantern-hunt' && (arc.beat === 'poise' || arc.beat === 'strike'))) {
                            hunt.phase = 'brace';
                            hunt.since = tick;
                            hunt.heading = body.heading;
                            motive = 'poise';
                        }
                    }
                    else if (tick - hunt.started > (a.forced ? 480 : Math.ceil(1320 / options.tempo))) {
                        hunt.phase = 'recover';
                        hunt.since = tick;
                        goal = null;
                        drive = { hold: true };
                    }
                }
                if (hunt.phase === 'brace') {
                    const age = tick - hunt.since;
                    const recoil = -.022 * (ease((age + 1) / 18) - ease(age / 18));
                    drive = { hold: true, rootDelta: { x: Math.cos(hunt.heading) * recoil, y: Math.sin(hunt.heading) * recoil } };
                    goal = null;
                    motive = 'poise';
                    const window = !!a.forced || (arc.scene === 'lantern-hunt' && arc.beat === 'strike');
                    if (age >= 36 && window && body.feet.every(foot => foot.phase === 'stance')) {
                        hunt.phase = 'pounce';
                        hunt.since = tick;
                        hunt.distance = clamp(distance(position, hunt.target) / a.scale - .55 + .035, .06, .17);
                    }
                    else if (age > Math.ceil(240 / options.tempo) && !window) {
                        hunt.phase = 'recover';
                        hunt.since = tick;
                    }
                }
                if (hunt.phase === 'pounce') {
                    const age = tick - hunt.since;
                    const thrust = hunt.distance * (ease((age + 1) / 14) - ease(age / 14));
                    drive = { hold: true, rootDelta: { x: Math.cos(hunt.heading) * thrust, y: Math.sin(hunt.heading) * thrust } };
                    goal = null;
                    motive = 'strike';
                    if (age >= 14) {
                        hunt.phase = 'recover';
                        hunt.since = tick;
                        drive = { hold: true };
                        motive = 'poise';
                    }
                }
                else if (hunt.phase === 'recover') {
                    const age = tick - hunt.since;
                    goal = null;
                    drive = { hold: true, settle: age >= 30 };
                    motive = 'poise';
                    emotion = 'content';
                    if (age >= 115 && body.feet.every(foot => foot.phase === 'stance')) {
                        a.hunt = null;
                        a.forced = { kind: 'return', until: tick + 900, target: copy(HOMES[a.index]), returnAt: null };
                        drive = undefined;
                        motive = 'return';
                    }
                }
            }
            if (a.forced && a.forced.kind !== 'moth' && !a.hunt) {
                goal = copy(a.forced.target);
                emotion = a.forced.kind === 'shadow' ? 'wary' : 'curious';
                motive = a.forced.kind === 'inspect' ? 'inspect' : a.forced.kind === 'shadow' ? 'shelter' : 'return';
                if (distance(position, goal) < .10) {
                    goal = null;
                    if (a.forced.kind !== 'inspect') {
                        motive = 'watch';
                        a.forced.returnAt ??= tick;
                        if (tick - a.forced.returnAt > 90 && a.cooldownUntil <= tick)
                            a.forced = null;
                    }
                }
            }
            if (body.behavior.kind === 'startle' || body.behavior.kind === 'retreat') {
                motive = 'retreat';
                emotion = 'wary';
            }
            if (tick < a.assessUntil && a.forced?.kind === 'inspect') {
                drive = { hold: true };
                motive = 'inspect';
            }
            // A nearby neighbor is a real obstacle: wait or take a perpendicular step.
            if (goal && motive !== 'retreat')
                for (const other of actors) {
                    if (other === a)
                        continue;
                    const there = positions[other.index], delta = { x: there.x - position.x, y: there.y - position.y };
                    const desired = { x: goal.x - position.x, y: goal.y - position.y };
                    if (Math.hypot(delta.x, delta.y) < .78 && delta.x * desired.x + delta.y * desired.y > 0) {
                        const side = a.index < other.index ? -1 : 1;
                        goal = bound({ x: position.x - delta.y * side * .65, y: position.y + delta.x * side * .65 });
                        motive = 'yield';
                        break;
                    }
                }
            const input = [];
            let actorSeq = body.lastSequence;
            if (goal)
                input.push({ type: 'guide', tick: body.tick + 1, seq: ++actorSeq, x: clamp(goal.x / 2, -1, 1), y: clamp(goal.y, -1, 1) });
            else if (body.target)
                input.push({ type: 'leave', tick: body.tick + 1, seq: ++actorSeq });
            if (a.alarmAt !== null && tick >= a.alarmAt) {
                input.push({ type: 'startle', tick: body.tick + 1, seq: ++actorSeq });
                a.alarmAt = null;
            }
            const advanced = drive ? a.locomotor.stepDriven(input, drive).state : a.model.step(input).state;
            if (a.hunt?.phase === 'pounce' && !a.hunt.caught && caughtBy === null) {
                const root = world(advanced, a.scale), jaw = { x: root.x + Math.cos(advanced.heading) * .55 * a.scale, y: root.y + Math.sin(advanced.heading) * .55 * a.scale };
                // Receipt follows actual jaw proximity, never a score label or a timer.
                if (distance(jaw, a.hunt.target) < .085 * a.scale) {
                    caughtBy = a.id;
                    caughtCycle = arc.cycle;
                    a.catches++;
                    a.hunt.caught = true;
                }
            }
            a.goal = goal;
            a.motive = motive;
            a.emotion = emotion;
            const tail = emotion === 'wary' ? .62 : motive === 'poise' ? .19 : motive === 'strike' ? .08 : emotion === 'focused' ? .10 : emotion === 'curious' ? .18 : .04;
            a.tail += (tail - a.tail) * .055;
        }
        return { state: snapshot(), inputs: receipts.map(r => ({ ...r })) };
    }
    return {
        get disposed() { return disposed; }, step, getSnapshot() { alive(); return snapshot(); },
        update(patch) {
            alive();
            const next = resolveGeckoDirectorOptions(patch, options), changedScene = next.scene !== options.scene;
            options = next;
            populate();
            if (changedScene) {
                scoreTick = 0;
                lastShadowCycle = -1;
                caughtCycle = -1;
                caughtBy = null;
                mothOverride = null;
                pointer = null;
                shadowSince = -1000;
                for (const a of actors) {
                    a.forced = null;
                    a.alarmAt = null;
                    a.strikeUntil = 0;
                    a.hunt = null;
                    a.assessUntil = 0;
                }
            }
            return optionsCopy(options);
        },
        updateAnimal(patch) { alive(); const next = resolveGeckoOptions(patch, animal); animal = next; for (const a of actors)
            a.model.update(modelOptions(a.index)); return { ...animal }; },
        select(id) { alive(); if (id !== null && !actors.some(a => a.id === id))
            throw new RangeError('Select an active gecko'); selectedId = id; },
        reset(reset = {}) {
            alive();
            record(reset, ['seed', 'heading'], 'director reset');
            const nextSeed = reset.seed === undefined ? seed : reset.seed, nextHeading = reset.heading === undefined ? heading : reset.heading;
            finite(nextSeed, 0, 0xffff_ffff, 'seed', true);
            if (nextHeading !== undefined)
                finite(nextHeading, -Math.PI, Math.PI, 'heading');
            seed = nextSeed;
            heading = nextHeading;
            for (const a of actors)
                a.model.dispose();
            actors = [];
            tick = 0;
            seq = 0;
            scoreTick = 0;
            pointer = null;
            pointerUntil = 0;
            lastAction = null;
            mothOverride = null;
            caughtBy = null;
            caughtCycle = -1;
            shadowSince = -1000;
            shadowPosition = { x: 1.35, y: -.3 };
            lastShadowCycle = -1;
            selectedId = 'mica';
            populate();
            return snapshot();
        },
        exportRecipe() { alive(); return { version: 1, kind: 'gecko-scene-recipe', seed, ...(heading === undefined ? {} : { heading }), options: optionsCopy(options), animal: { ...animal }, startsAtTick: 0 }; },
        dispose() { if (disposed)
            return; disposed = true; for (const a of actors)
            a.model.dispose(); actors = []; pointer = null; mothOverride = null; },
    };
}
/** Presentation-only deliberate pose. Does not step or mutate a director/model. */
export function geckoDirectorPoster(state, cue) {
    const id = cue.id ?? state.selectedId ?? state.individuals[0].id;
    const individual = state.individuals.find(a => a.id === id) ?? state.individuals[0];
    const position = world(individual.body, individual.scale);
    const target = cue.x === undefined ? { x: position.x + .55, y: position.y - .15 } : bound({ x: cue.x * 3.3, y: cue.y * 2.2 });
    return { ...state, pointer: cue.type === 'inspect' ? target : state.pointer,
        moth: cue.type === 'moth' ? { position: target, visible: true, caughtBy: null } : state.moth,
        shadow: cue.type === 'shadow' ? { active: true, progress: .5, position: copy(position) } : state.shadow,
        individuals: state.individuals.map(a => a.id === id ? { ...a, motive: cue.type === 'shadow' ? 'shelter' : cue.type === 'moth' ? 'poise' : cue.type === 'return' ? 'watch' : 'inspect',
            emotion: cue.type === 'shadow' ? 'wary' : cue.type === 'moth' ? 'focused' : cue.type === 'return' ? 'content' : 'curious',
            tailExpression: cue.type === 'shadow' ? .9 : cue.type === 'return' ? .04 : .3, body: { ...a.body, tailCurl: cue.type === 'shadow' ? .9 : a.body.tailCurl } } : a) };
}
