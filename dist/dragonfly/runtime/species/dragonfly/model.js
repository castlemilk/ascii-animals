import { buildDragonflyGeometry } from './geometry.js';
export const DRAGONFLY_LIMITS = Object.freeze({ tickRate: 60, samples: 6144, eventsPerTick: 16,
    maxTick: 2147483647, maxReplayTicks: 21600, replayEvents: 4096, rootX: .72, rootY: .58 });
export const DRAGONFLY_DEFAULTS = Object.freeze({ seed: 17,
    motion: 'full', followPointer: true, hoverRadius: .03, trackingReach: .28,
    trackingSpeed: .36, trackingAcceleration: 1.6, dartDistance: .48, dartTicks: 20,
    recoveryTicks: 48, cooldownTicks: 90, wingHz: 3, wingAmplitude: .27 });
const NUMERIC = {
    hoverRadius: [0, .08, false], trackingReach: [0, .4, false], trackingSpeed: [.05, .8, false],
    trackingAcceleration: [.2, 4, false], dartDistance: [.1, .65, false], dartTicks: [18, 60, true],
    recoveryTicks: [18, 180, true], cooldownTicks: [30, 600, true], wingHz: [.5, 6, false],
    wingAmplitude: [0, .4, false],
};
const TAU = Math.PI * 2, DT = 1 / 60;
export function finiteNumber(value, name, low, high, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        throw new TypeError(`${name} must be a finite number`);
    if (value < low || value > high || (integer && !Number.isSafeInteger(value)))
        throw new RangeError(`${name} must be ${integer ? 'an integer ' : ''}in [${low}, ${high}]`);
    return value;
}
function object(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError(`${name} must be an object`);
    return value;
}
function keys(value, allowed, name) {
    for (const key of Object.keys(value))
        if (!allowed.includes(key))
            throw new TypeError(`Unknown ${name} field: ${key}`);
}
/** Strict configuration: no coercion, unknown keys or undefined option values. */
function mergeOptions(patch, base) {
    const raw = object(patch, 'options');
    keys(raw, Object.keys(DRAGONFLY_DEFAULTS), 'option');
    const merged = { ...base, ...patch };
    finiteNumber(merged.seed, 'seed', 0, 0xffffffff, true);
    if (!['full', 'slow', 'static'].includes(merged.motion))
        throw new TypeError('motion must be full, slow or static');
    if (typeof merged.followPointer !== 'boolean')
        throw new TypeError('followPointer must be boolean');
    for (const [key, [low, high, integer]] of Object.entries(NUMERIC))
        finiteNumber(merged[key], key, low, high, integer);
    return Object.freeze(merged);
}
export function validateDragonflyOptions(patch = {}) {
    return mergeOptions(patch, DRAGONFLY_DEFAULTS);
}
const vec = (x, y) => Object.freeze({ x, y });
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
function freezeState(state) {
    // Nested values are created frozen. This is an immutable snapshot, not a borrowed state handle.
    Object.freeze(state.behavior);
    return Object.freeze(state);
}
export function seedPhase(seed) {
    // One integer LCG mix, stable within the documented version. No mutable PRNG.
    return ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296 * TAU;
}
function initialState(seed) {
    return freezeState({ species: 'dragonfly-v1', seed, tick: 0, lastSeq: -1,
        position: vec(0, 0), velocity: vec(0, 0), heading: 0, anchor: vec(0, 0), target: null,
        behavior: { kind: 'idle' }, wingPhase: seedPhase(seed), staticPose: 0 });
}
function unit(direction) {
    const length = Math.hypot(direction.x, direction.y);
    return length > 1e-8 ? vec(direction.x / length, direction.y / length) : vec(1, 0);
}
function boundedVelocity(v, maximum) {
    const length = Math.hypot(v.x, v.y), scale = length > maximum ? maximum / length : 1;
    return vec(v.x * scale, v.y * scale);
}
/** Validate the entire ordered batch before applying anything. Inputs are plain trusted data. */
function validateEvents(events, tick, previousSeq) {
    if (!Array.isArray(events) || events.length > DRAGONFLY_LIMITS.eventsPerTick)
        throw new RangeError('At most 16 input events per tick');
    let last = previousSeq;
    for (const event of events) {
        const raw = object(event, 'event');
        if (event.tick !== tick)
            throw new RangeError('Each event must target exactly the next tick');
        finiteNumber(event.seq, 'seq', 0, Number.MAX_SAFE_INTEGER, true);
        if (event.seq <= last)
            throw new RangeError('seq must strictly increase across all applied events');
        last = event.seq;
        if (event.type === 'pointer') {
            keys(raw, ['type', 'tick', 'seq', 'x', 'y'], 'pointer');
            finiteNumber(event.x, 'pointer.x', -1, 1);
            finiteNumber(event.y, 'pointer.y', -1, 1);
        }
        else if (event.type === 'leave')
            keys(raw, ['type', 'tick', 'seq'], 'leave');
        else if (event.type === 'dart') {
            keys(raw, ['type', 'tick', 'seq', 'direction'], 'dart');
            if (Object.hasOwn(raw, 'direction')) {
                const d = object(event.direction, 'direction');
                keys(d, ['x', 'y'], 'direction');
                finiteNumber(d.x, 'direction.x', -1, 1);
                finiteNumber(d.y, 'direction.y', -1, 1);
                if (Math.hypot(d.x, d.y) < 1e-8)
                    throw new RangeError('Dart direction must be nonzero');
            }
        }
        else
            throw new TypeError('Unknown event type');
    }
}
/** Original dragonfly behavior. No browser, camera, font, renderer or wall clock. */
export function createDragonfly(input = {}) {
    let options = validateDragonflyOptions(input), state = initialState(options.seed);
    let paused = false, disposed = false;
    const alive = () => { if (disposed)
        throw new Error('Dragonfly has been disposed'); };
    function step(tick, events = []) {
        alive();
        finiteNumber(tick, 'tick', 1, DRAGONFLY_LIMITS.maxTick, true);
        if (tick !== state.tick + 1)
            throw new RangeError('step requires exactly the next integer tick');
        validateEvents(events, tick, state.lastSeq);
        if (paused || options.motion === 'static')
            return Object.freeze({ kind: 'resting', state,
                acceptedDart: false, ignoredDarts: events.filter(e => e.type === 'dart').length });
        let target = state.target, behavior = state.behavior, lastSeq = state.lastSeq;
        let position = state.position, velocity = state.velocity, anchor = state.anchor;
        let acceptedDart = false, ignoredDarts = 0;
        const pace = options.motion === 'slow' ? .25 : 1;
        for (const event of events) {
            lastSeq = event.seq;
            if (event.type === 'pointer')
                target = vec(event.x, event.y);
            else if (event.type === 'leave')
                target = null;
            else if (behavior.kind === 'idle' || behavior.kind === 'approach') {
                const aim = event.direction ?? (target ? vec(target.x * options.trackingReach - position.x, target.y * options.trackingReach - position.y) : vec(Math.cos(state.heading), Math.sin(state.heading) - .15));
                const direction = unit(aim);
                const to = vec(clamp(position.x + direction.x * options.dartDistance, -.52, .52), clamp(position.y + direction.y * options.dartDistance, -.42, .42));
                behavior = Object.freeze({ kind: 'dart', elapsed: 0, duration: Math.round(options.dartTicks / pace),
                    from: position, to, initialVelocity: velocity });
                acceptedDart = true;
            }
            else
                ignoredDarts++;
        }
        const wingPhase = (state.wingPhase + TAU * options.wingHz * pace * DT) % TAU;
        if (behavior.kind === 'dart') {
            const elapsed = behavior.elapsed + 1, u = Math.min(1, elapsed / behavior.duration);
            const seconds = behavior.duration * DT;
            const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u;
            const d00 = (6 * u * u - 6 * u) / seconds, d10 = 3 * u * u - 4 * u + 1, d01 = (-6 * u * u + 6 * u) / seconds;
            position = vec(h00 * behavior.from.x + h10 * seconds * behavior.initialVelocity.x + h01 * behavior.to.x, h00 * behavior.from.y + h10 * seconds * behavior.initialVelocity.y + h01 * behavior.to.y);
            velocity = vec(d00 * behavior.from.x + d10 * behavior.initialVelocity.x + d01 * behavior.to.x, d00 * behavior.from.y + d10 * behavior.initialVelocity.y + d01 * behavior.to.y);
            if (elapsed === behavior.duration) {
                position = behavior.to;
                velocity = vec(0, 0);
                anchor = position;
                behavior = { kind: 'recover', elapsed: 0, duration: Math.round(options.recoveryTicks / pace) };
            }
            else
                behavior = { ...behavior, elapsed };
        }
        else if (behavior.kind === 'recover') {
            const elapsed = behavior.elapsed + 1;
            // A stationary root makes the high-speed response settle cleanly; wings remain independent.
            velocity = vec(0, 0);
            behavior = elapsed >= behavior.duration ? { kind: 'cooldown', remaining: options.cooldownTicks } : { ...behavior, elapsed };
        }
        else if (behavior.kind === 'cooldown') {
            velocity = vec(0, 0);
            behavior = behavior.remaining <= 1 ? { kind: target && options.followPointer ? 'approach' : 'idle' } :
                { kind: 'cooldown', remaining: behavior.remaining - 1 };
        }
        else {
            const tracking = target !== null && options.followPointer;
            behavior = { kind: tracking ? 'approach' : 'idle' };
            const t = tick * DT * pace, phase = seedPhase(state.seed);
            const desired = vec((tracking ? (target?.x ?? 0) * options.trackingReach : anchor.x) + Math.sin(t * .9 + phase) * options.hoverRadius, (tracking ? (target?.y ?? 0) * options.trackingReach * .8 : anchor.y) + Math.sin(t * .6 + phase * .7) * options.hoverRadius * .6);
            const raw = vec((desired.x - position.x) * 12 - velocity.x * 5, (desired.y - position.y) * 12 - velocity.y * 5);
            const acceleration = boundedVelocity(raw, options.trackingAcceleration * pace);
            velocity = boundedVelocity(vec(velocity.x + acceleration.x * DT, velocity.y + acceleration.y * DT), options.trackingSpeed * pace);
            position = vec(position.x + velocity.x * DT, position.y + velocity.y * DT);
        }
        // Root safety margin is outside the reachable normal target/dart envelope.
        const bounded = vec(clamp(position.x, -DRAGONFLY_LIMITS.rootX, DRAGONFLY_LIMITS.rootX), clamp(position.y, -DRAGONFLY_LIMITS.rootY, DRAGONFLY_LIMITS.rootY));
        if (bounded.x !== position.x || bounded.y !== position.y)
            velocity = vec(0, 0);
        const desiredHeading = clamp(velocity.x * .45, -.22, .22);
        const heading = state.heading + clamp(desiredHeading - state.heading, -.012, .012);
        state = freezeState({ ...state, tick, lastSeq, position: bounded, velocity, anchor, target,
            behavior, heading, wingPhase });
        return Object.freeze({ kind: 'advanced', state, acceptedDart, ignoredDarts });
    }
    const api = {
        species: Object.freeze({ id: 'dragonfly-v1', version: 1, maxSamples: 6144, tickRate: 60 }),
        getOptions: () => options,
        getState: () => state,
        getStatus: () => Object.freeze({ paused, disposed, tick: state.tick, motion: options.motion }),
        step,
        configure(patch) {
            alive();
            const raw = object(patch, 'configuration');
            if (Object.hasOwn(raw, 'seed'))
                throw new TypeError('Use reset(seed) to change seed');
            const next = mergeOptions(patch, options);
            if (options.motion !== next.motion) {
                const position = next.motion === 'static' ? vec(0, 0) : state.position;
                state = freezeState({ ...state, position, anchor: position, velocity: vec(0, 0), target: null,
                    heading: next.motion === 'static' ? 0 : state.heading, behavior: { kind: 'idle' } });
            }
            options = next;
            return options;
        },
        setPaused(value) { alive(); if (typeof value !== 'boolean')
            throw new TypeError('paused must be boolean'); paused = value; },
        reset(seed = options.seed) {
            alive();
            finiteNumber(seed, 'seed', 0, 0xffffffff, true);
            options = Object.freeze({ ...options, seed });
            state = initialState(seed);
            return state;
        },
        setStaticPose(pose) {
            alive();
            if (pose !== 0 && pose !== 1)
                throw new RangeError('static pose must be 0 or 1');
            // Explicit pose action also works while user-paused in full/slow mode.
            // Resume continues from this phase; ticks and event sequences do not move.
            state = freezeState({ ...state, staticPose: pose, wingPhase: (seedPhase(state.seed) + pose * 1.4) % TAU });
        },
        clearTarget() { alive(); state = freezeState({ ...state, target: null }); },
        sample() { alive(); return buildDragonflyGeometry(state, options); },
        dispose() { if (disposed)
            return; disposed = true; paused = true; },
    };
    return Object.freeze(api);
}
/** Fixed-configuration bounded replay. Configuration/reset/host suspension start a new log. */
export function replayDragonfly(record, renderEvery = 1) {
    const raw = object(record, 'replay');
    keys(raw, ['schemaVersion', 'speciesVersion', 'options', 'ticks', 'events'], 'replay');
    if (record.schemaVersion !== 1 || record.speciesVersion !== 'dragonfly-v1')
        throw new TypeError('Unsupported replay version');
    if (!Object.hasOwn(raw, 'options'))
        throw new TypeError('Replay options metadata is required');
    object(record.options, 'replay options');
    finiteNumber(record.ticks, 'replay ticks', 0, DRAGONFLY_LIMITS.maxReplayTicks, true);
    finiteNumber(renderEvery, 'renderEvery', 1, 60, true);
    if (!Array.isArray(record.events) || record.events.length > DRAGONFLY_LIMITS.replayEvents)
        throw new RangeError('Replay event limit is 4096');
    let priorTick = 0, lastSeq = -1, batchCount = 0;
    for (const event of record.events) {
        object(event, 'replay event');
        finiteNumber(event.tick, 'event.tick', 1, record.ticks, true);
        if (event.tick < priorTick)
            throw new RangeError('Replay events must be ordered by tick');
        batchCount = event.tick === priorTick ? batchCount + 1 : 1;
        if (batchCount > DRAGONFLY_LIMITS.eventsPerTick)
            throw new RangeError('Replay tick input overflow');
        validateEvents([event], event.tick, lastSeq);
        lastSeq = event.seq;
        priorTick = event.tick;
    }
    const model = createDragonfly(record.options);
    if (model.getOptions().motion === 'static' && record.ticks > 0)
        throw new RangeError('A static replay has zero simulation ticks');
    let cursor = 0;
    for (let tick = 1; tick <= record.ticks; tick++) {
        const events = [];
        while (cursor < record.events.length && record.events[cursor].tick === tick)
            events.push(record.events[cursor++]);
        model.step(tick, events);
        if (tick % renderEvery === 0)
            model.sample();
    }
    return model;
}
