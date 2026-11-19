export const GECKO_LIMITS = Object.freeze({
    tickRate: 60, eventsPerTick: 32, samples: 12_288, maxTick: 2_147_483_646,
    minCols: 112, minRows: 50, maxCols: 192, maxRows: 86,
    rootX: .26, rootY: .13, limbReach: .44,
});
export const DEFAULT_GECKO_HABITAT = Object.freeze({
    extentX: GECKO_LIMITS.rootX, extentY: GECKO_LIMITS.rootY,
    origin: Object.freeze({ x: .18, y: 0 }),
});
export const DEFAULT_GECKO_OPTIONS = Object.freeze({
    creepSpeed: .10, turnRate: .65, stride: .10, stepTicks: 18,
    tailLength: 1, toeSpread: 1, curlStrength: 1, tailSway: .035, breathing: .008,
    startleTicks: 18, retreatTicks: 48, retreatDistance: .14,
    recoveryTicks: 120, cooldownTicks: 120,
});
const RANGES = {
    creepSpeed: [.02, .18], turnRate: [.15, 1.2], stride: [.04, .16], stepTicks: [12, 30, true],
    tailLength: [.75, 1.05], toeSpread: [.9, 1.15], curlStrength: [.25, 1],
    tailSway: [0, .08], breathing: [0, .018], startleTicks: [6, 60, true],
    retreatTicks: [24, 90, true], retreatDistance: [.05, .18],
    recoveryTicks: [60, 240, true], cooldownTicks: [30, 300, true],
};
const FOOT_NAMES = ['front-left', 'front-right', 'rear-left', 'rear-right'];
const ORDER = [0, 3, 1, 2];
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const ease = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const copyPoint = (p) => ({ x: p.x, y: p.y });
function record(value, allowed, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
        throw new TypeError(`${name} must be a plain object`);
    }
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || !allowed.includes(key))
            throw new TypeError(`${name}: unknown field ${String(key)}`);
    }
}
function number(value, low, high, name, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        throw new TypeError(`${name} must be finite`);
    if (value < low || value > high || (integer && !Number.isSafeInteger(value))) {
        throw new RangeError(`${name} must be ${integer ? 'an integer ' : ''}in [${low}, ${high}]`);
    }
}
export function resolveGeckoOptions(patch = {}, base = DEFAULT_GECKO_OPTIONS) {
    record(patch, Object.keys(RANGES), 'options');
    const next = { ...(base === DEFAULT_GECKO_OPTIONS ? base : resolveGeckoOptions(base)) };
    for (const key of Object.keys(patch)) {
        const range = RANGES[key], value = patch[key];
        number(value, range[0], range[1], `options.${key}`, range[2] ?? false);
        next[key] = value;
    }
    return Object.freeze(next);
}
function resolveHabitat(patch, base) {
    record(patch, ['extentX', 'extentY', 'origin'], 'habitat');
    const supplied = patch;
    // Presence matters: an explicitly undefined (even non-enumerable) field is invalid.
    const extentX = Object.hasOwn(supplied, 'extentX') ? supplied.extentX : base.extentX;
    const extentY = Object.hasOwn(supplied, 'extentY') ? supplied.extentY : base.extentY;
    const origin = (Object.hasOwn(supplied, 'origin') ? supplied.origin : base.origin);
    number(extentX, .26, 3, 'habitat.extentX');
    number(extentY, .13, 2, 'habitat.extentY');
    record(origin, ['x', 'y'], 'habitat.origin');
    number(origin.x, -extentX, extentX, 'habitat.origin.x');
    number(origin.y, -extentY, extentY, 'habitat.origin.y');
    return Object.freeze({ extentX, extentY, origin: Object.freeze(copyPoint(origin)) });
}
/** Convert a CSS rectangle to normalized input; DPR never participates. */
export function normalizeGuide(clientX, clientY, rect) {
    if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0)
        return null;
    return { x: clamp((clientX - rect.left) / rect.width * 2 - 1, -1, 1), y: clamp((clientY - rect.top) / rect.height * 2 - 1, -1, 1) };
}
export function transformGeckoPoint(position, heading, x, y) {
    const c = Math.cos(heading), s = Math.sin(heading);
    return { x: position.x + x * c - y * s, y: position.y + x * s + y * c };
}
export function geckoShoulder(position, heading, foot) {
    return transformGeckoPoint(position, heading, foot.front ? .13 : -.14, foot.side * (foot.front ? .075 : .08));
}
function nominalFoot(position, heading, foot) {
    return transformGeckoPoint(position, heading, foot.front ? .22 : -.22, foot.side * .29);
}
function footAngle(heading, front, side) {
    return heading + side * (front ? .80 : 2.24);
}
function initialState(seed, heading, options, habitat) {
    const position = copyPoint(habitat.origin);
    const feet = FOOT_NAMES.map((id, i) => {
        const front = i < 2, side = (i % 2 === 0 ? -1 : 1);
        return { id, front, side, position: nominalFoot(position, heading, { front, side }), angle: footAngle(heading, front, side),
            toeSpread: options.toeSpread, phase: 'stance', plantedAt: 0 };
    });
    // uint32 mixing changes stable phase/texture; never an ambient random source.
    let mixed = (seed ^ 0x9e3779b9) >>> 0;
    mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b) >>> 0;
    const phase = (mixed / 0x1_0000_0000) * TAU;
    return { version: 1, seed, initialHeading: heading, options, habitat, tick: 0, lastSequence: 0, position, heading,
        target: null, behavior: { kind: 'idle', since: 0 }, tailCurl: 0, phase, feet, nextFoot: 0, stepsCompleted: 0 };
}
function cloneState(s) {
    return { ...s, options: { ...s.options }, habitat: { ...s.habitat, origin: copyPoint(s.habitat.origin) }, position: copyPoint(s.position), target: s.target ? copyPoint(s.target) : null,
        behavior: { ...s.behavior }, feet: s.feet.map(f => f.phase === 'stance'
            ? { ...f, position: copyPoint(f.position) }
            : { ...f, position: copyPoint(f.position), from: copyPoint(f.from), to: copyPoint(f.to) }) };
}
function validateEvents(events, state) {
    if (!Array.isArray(events))
        throw new TypeError('events must be an array');
    if (events.length > GECKO_LIMITS.eventsPerTick)
        throw new RangeError('at most 32 events per tick');
    let seq = state.lastSequence;
    for (const e of events) {
        if (!e || typeof e !== 'object')
            throw new TypeError('event must be an object');
        const keys = e.type === 'guide' ? ['tick', 'seq', 'type', 'x', 'y'] : ['tick', 'seq', 'type'];
        record(e, keys, 'event');
        if (!['guide', 'leave', 'startle'].includes(e.type))
            throw new TypeError('unknown event type');
        number(e.tick, state.tick + 1, state.tick + 1, 'event.tick', true);
        number(e.seq, seq + 1, Number.MAX_SAFE_INTEGER, 'event.seq', true);
        if (e.type === 'guide') {
            number(e.x, -1, 1, 'event.x');
            number(e.y, -1, 1, 'event.y');
        }
        seq = e.seq;
    }
}
function resolveDrive(drive) {
    record(drive, ['rootDelta', 'hold', 'settle'], 'locomotor drive');
    for (const key of ['hold', 'settle']) {
        if (Object.hasOwn(drive, key) && typeof drive[key] !== 'boolean')
            throw new TypeError(`drive.${key} must be boolean`);
    }
    let rootDelta;
    if (Object.hasOwn(drive, 'rootDelta')) {
        record(drive.rootDelta, ['x', 'y'], 'drive.rootDelta');
        const point = drive.rootDelta;
        number(point.x, -.025, .025, 'drive.rootDelta.x');
        number(point.y, -.025, .025, 'drive.rootDelta.y');
        if (Math.hypot(point.x, point.y) > .025 + 1e-12)
            throw new RangeError('drive.rootDelta must not exceed .025 units per tick');
        rootDelta = copyPoint(point);
    }
    return { ...(rootDelta === undefined ? {} : { rootDelta }),
        ...(drive.hold === undefined ? {} : { hold: drive.hold }), ...(drive.settle === undefined ? {} : { settle: drive.settle }) };
}
function advanceState(old, events, drive = {}) {
    if (old.tick >= GECKO_LIMITS.maxTick)
        throw new RangeError('maximum tick reached; reset before continuing');
    validateEvents(events, old);
    const tick = old.tick + 1, o = old.options;
    let target = old.target, behavior = old.behavior, lastSequence = old.lastSequence;
    const inputs = [];
    // Guidance is coalesced semantically; the reaction phase has movement priority.
    for (const event of events) {
        lastSequence = event.seq;
        if (event.type === 'guide')
            target = { x: event.x * old.habitat.extentX, y: event.y * old.habitat.extentY };
        if (event.type === 'leave')
            target = null;
        if (event.type === 'startle') {
            if (behavior.kind === 'idle' || behavior.kind === 'approach') {
                behavior = { kind: 'startle', since: tick, heading: old.heading };
                inputs.push({ seq: event.seq, type: event.type, outcome: 'applied' });
            }
            else
                inputs.push({ seq: event.seq, type: event.type, outcome: 'ignored', reason: 'busy' });
        }
        else
            inputs.push({ seq: event.seq, type: event.type, outcome: 'applied' });
    }
    const age = tick - behavior.since;
    if (behavior.kind === 'startle' && age >= o.startleTicks)
        behavior = { kind: 'retreat', since: tick, heading: behavior.heading, traveled: 0 };
    else if (behavior.kind === 'retreat' && age >= o.retreatTicks)
        behavior = { kind: 'recover', since: tick };
    else if (behavior.kind === 'recover' && age >= o.recoveryTicks)
        behavior = { kind: 'cooldown', since: tick };
    else if (behavior.kind === 'cooldown' && age >= o.cooldownTicks)
        behavior = { kind: 'idle', since: tick };
    let desiredHeading = old.heading, dx = 0, dy = 0, moving = false;
    if (behavior.kind === 'retreat') {
        const t = (tick - behavior.since) / o.retreatTicks;
        const distance = o.retreatDistance * (ease(t + 1 / o.retreatTicks) - ease(t));
        dx = -Math.cos(behavior.heading) * distance;
        dy = -Math.sin(behavior.heading) * distance;
        moving = true;
    }
    else if (behavior.kind !== 'startle') {
        const vx = target ? target.x - old.position.x : 0, vy = target ? target.y - old.position.y : 0;
        const distance = Math.hypot(vx, vy), active = target !== null && distance > .013;
        if (behavior.kind === 'idle' || behavior.kind === 'approach') {
            const kind = active ? 'approach' : 'idle';
            if (kind !== behavior.kind)
                behavior = { kind, since: tick };
        }
        if (active) {
            const recovery = behavior.kind === 'recover' ? .36 : 1;
            const desired = Math.atan2(vy, vx), turn = angleDelta(old.heading, desired);
            desiredHeading = old.heading + clamp(turn, -o.turnRate / 60 * recovery, o.turnRate / 60 * recovery);
            const distanceStep = Math.min(distance, o.creepSpeed / 60 * recovery * Math.min(1, distance / .045) * Math.max(.12, Math.cos(turn)));
            dx = Math.cos(desiredHeading) * distanceStep;
            dy = Math.sin(desiredHeading) * distanceStep;
            moving = true;
        }
    }
    // The director can brace a body without translating any planted contact.
    // A bounded lunge uses the same habitat/reach guards as ordinary locomotion.
    const holding = drive.hold === true || drive.settle === true;
    if (holding) {
        dx = 0;
        dy = 0;
        desiredHeading = old.heading;
        moving = false;
    }
    // Bracing finishes an in-flight foot before driven displacement begins. A
    // rejected delta is not queued: callers observe the actual root, and catch
    // success must be decided from that position rather than requested travel.
    if (drive.rootDelta && !old.feet.some(foot => foot.phase === 'swing')) {
        dx += drive.rootDelta.x;
        dy += drive.rootDelta.y;
        if (!holding && (dx !== 0 || dy !== 0))
            moving = true;
    }
    let completed = old.stepsCompleted, nextFoot = old.nextFoot;
    let feet = old.feet.map((foot) => {
        if (foot.phase === 'stance')
            return foot;
        const t = clamp((tick - foot.since) / foot.duration, 0, 1);
        // Peel in place, transfer, then adhere in place. A planted toe never gets
        // dragged along with the torso, and transfer has zero endpoint velocity.
        const u = ease((t - .18) / .64);
        const previousU = ease(((tick - 1 - foot.since) / foot.duration - .18) / .64);
        const spread = foot.toeSpread ?? old.options.toeSpread;
        const spreadMix = previousU < 1 ? clamp((u - previousU) / (1 - previousU), 0, 1) : 0;
        const toeSpread = spread + (o.toeSpread - spread) * spreadMix;
        if (t >= 1) {
            completed++;
            return { id: foot.id, side: foot.side, front: foot.front, position: foot.to, angle: foot.toAngle, toeSpread, phase: 'stance', plantedAt: tick };
        }
        return { ...foot, position: { x: foot.from.x + (foot.to.x - foot.from.x) * u, y: foot.from.y + (foot.to.y - foot.from.y) * u },
            angle: foot.fromAngle + angleDelta(foot.fromAngle, foot.toAngle) * u, toeSpread, lift: .035 * Math.sin(Math.PI * t) };
    });
    const proposed = { x: clamp(old.position.x + dx, -old.habitat.extentX, old.habitat.extentX), y: clamp(old.position.y + dy, -old.habitat.extentY, old.habitat.extentY) };
    if ((moving || drive.settle) && !feet.some(f => f.phase === 'swing')) {
        let order = nextFoot % 4;
        if (drive.settle) {
            // Finish support recovery without a walk-in-place loop. Contact-local
            // option changes also settle only through a real lifted step.
            const pending = ORDER.map((_, offset) => (nextFoot + offset) % 4).find(candidate => {
                const foot = feet[ORDER[candidate]], target = nominalFoot(proposed, desiredHeading, foot);
                return Math.hypot(target.x - foot.position.x, target.y - foot.position.y) > .008
                    || Math.abs(angleDelta(foot.angle, footAngle(desiredHeading, foot.front, foot.side))) > .05
                    || Math.abs((foot.toeSpread ?? o.toeSpread) - o.toeSpread) > .0001;
            });
            order = pending ?? -1;
        }
        if (order >= 0) {
            const index = ORDER[order], foot = feet[index];
            const nominal = nominalFoot(proposed, desiredHeading, foot), length = Math.hypot(dx, dy);
            const lead = !drive.settle && length > 0 ? o.stride * .4 : 0;
            const to = { x: nominal.x + (length > 0 ? dx / length * lead : 0), y: nominal.y + (length > 0 ? dy / length * lead : 0) };
            feet = feet.map((f, i) => i === index
                ? { id: f.id, front: f.front, side: f.side, position: f.position, angle: f.angle, phase: 'swing', since: tick, duration: o.stepTicks,
                    from: f.position, to, fromAngle: f.angle, toAngle: footAngle(desiredHeading, f.front, f.side), toeSpread: f.toeSpread ?? o.toeSpread, lift: 0 }
                : f);
            nextFoot = (order + 1) % 4;
        }
    }
    // Do not drag planted feet or over-stretch joints to follow a fast target.
    // The body waits while the contact gait catches up.
    const safe = feet.every(foot => {
        const shoulder = geckoShoulder(proposed, desiredHeading, foot);
        const fx = foot.position.x - shoulder.x, fy = foot.position.y - shoulder.y;
        const distance = Math.hypot(fx, fy);
        // Keep supports on their anatomical side. Without this constraint, a
        // sideways drive could carry a shoulder around an adhered foot and make
        // the later straight replant pass through a folded, impossible joint.
        const lateral = foot.side * (-Math.sin(desiredHeading) * fx + Math.cos(desiredHeading) * fy);
        return distance >= .063 && distance <= .425 && lateral >= .07;
    });
    const position = safe ? proposed : old.position, heading = safe ? desiredHeading : old.heading;
    if (behavior.kind === 'retreat')
        behavior = { ...behavior, traveled: behavior.traveled + Math.hypot(position.x - old.position.x, position.y - old.position.y) };
    const curlTarget = (behavior.kind === 'startle' || behavior.kind === 'retreat') ? o.curlStrength : 0;
    const state = { ...old, tick, lastSequence, target, behavior, position, heading, feet, nextFoot, stepsCompleted: completed,
        tailCurl: old.tailCurl + (curlTarget - old.tailCurl) * .12, phase: old.phase + 1 / 60 };
    return { state, inputs };
}
/** Original deterministic single-gecko model. Rendering and scheduling are host-owned. */
export function createGeckoLocomotor(config = {}) {
    record(config, ['seed', 'heading', 'options', 'habitat'], 'config');
    const seed = config.seed === undefined ? 37 : config.seed, heading = config.heading === undefined ? -.24 : config.heading;
    number(seed, 0, 0xffff_ffff, 'seed', true);
    number(heading, -Math.PI, Math.PI, 'heading');
    const habitat = Object.hasOwn(config, 'habitat') ? resolveHabitat(config.habitat, DEFAULT_GECKO_HABITAT) : DEFAULT_GECKO_HABITAT;
    let state = initialState(seed, heading, resolveGeckoOptions(config.options), habitat);
    let disposed = false;
    const alive = () => { if (disposed)
        throw new Error('Gecko has been disposed'); };
    function stepDriven(events, drive) {
        alive();
        const resolved = resolveDrive(drive);
        const result = advanceState(state, events, resolved);
        state = result.state;
        return { state: cloneState(state), inputs: result.inputs.map(x => ({ ...x })) };
    }
    const model = {
        get disposed() { return disposed; },
        step(events = []) {
            return stepDriven(events, {});
        },
        getSnapshot() { alive(); return cloneState(state); },
        update(patch) {
            alive();
            const options = resolveGeckoOptions(patch, state.options);
            state = { ...state, options };
            return { ...options };
        },
        reset(options = {}) {
            alive();
            record(options, ['seed', 'heading', 'habitat'], 'reset');
            const nextSeed = options.seed === undefined ? state.seed : options.seed, nextHeading = options.heading === undefined ? state.initialHeading : options.heading;
            number(nextSeed, 0, 0xffff_ffff, 'seed', true);
            number(nextHeading, -Math.PI, Math.PI, 'heading');
            const habitat = Object.hasOwn(options, 'habitat') ? resolveHabitat(options.habitat, state.habitat) : state.habitat;
            state = initialState(nextSeed, nextHeading, state.options, habitat);
            return cloneState(state);
        },
        dispose() { disposed = true; },
    };
    return { model, stepDriven };
}
/** Original public model contract; authored director movement remains internal. */
export function createGecko(config = {}) {
    return createGeckoLocomotor(config).model;
}
