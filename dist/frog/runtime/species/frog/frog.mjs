export const FROG_LIMITS = Object.freeze({ maxSamples: 32000, eventsPerTick: 8, tickRate: 60, maxTick: 2147483647, cols: 180, rows: 100 });
export const FROG_DEFAULTS = Object.freeze({
    size: 1, jumpHeight: .85, maxDistance: 1.2, crouchTicks: 14, flightTicks: 42,
    landingTicks: 12, recoveryTicks: 24, cooldownTicks: 18, throatAmplitude: .06,
});
const ranges = {
    size: [.75, 1.15, false], jumpHeight: [.45, 1.1, false], maxDistance: [.2, 1.5, false],
    crouchTicks: [6, 60, true], flightTicks: [24, 90, true], landingTicks: [6, 36, true],
    recoveryTicks: [6, 120, true], cooldownTicks: [1, 120, true], throatAmplitude: [0, .08, false],
};
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (v) => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
export function finite(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        throw new TypeError(`${label} must be a finite number`);
    return value;
}
export function integer(value, min, max, label) {
    const n = finite(value, label);
    if (!Number.isSafeInteger(n) || n < min || n > max)
        throw new RangeError(`${label} must be an integer in ${min}..${max}`);
    return n;
}
export function ownKeys(value, allowed, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError(`${label} must be an object`);
    for (const key of Object.keys(value))
        if (!allowed.includes(key))
            throw new TypeError(`Unknown ${label} field: ${key}`);
}
const point = (x, y) => Object.freeze({ x, y });
export function validateTarget(value) {
    ownKeys(value, ['x', 'y'], 'target');
    const x = finite(value.x, 'target.x'), y = finite(value.y, 'target.y');
    if (Math.abs(x) > 1 || Math.abs(y) > 1)
        throw new RangeError('Target must be normalized to [-1, 1]');
    return point(x, y);
}
/** Unknown fields and non-finite/out-of-range values fail before any mutation. */
export function configureFrog(patch = {}, base = FROG_DEFAULTS) {
    ownKeys(patch, Object.keys(ranges), 'config');
    const result = { ...base };
    for (const key of Object.keys(ranges)) {
        const [lo, hi, whole] = ranges[key];
        const v = Object.hasOwn(patch, key) ? patch[key] : base[key];
        const n = whole ? integer(v, lo, hi, key) : finite(v, key);
        if (n < lo || n > hi)
            throw new RangeError(`${key} must be in ${lo}..${hi}`);
        result[key] = n;
    }
    return Object.freeze(result);
}
function freezeState(state) {
    Object.freeze(state.position);
    if (state.target)
        Object.freeze(state.target);
    if ('plan' in state.behavior) {
        Object.freeze(state.behavior.plan.from);
        Object.freeze(state.behavior.plan.to);
        Object.freeze(state.behavior.plan);
    }
    Object.freeze(state.behavior);
    return Object.freeze(state);
}
export function createFrog(options = {}) {
    ownKeys(options, ['seed', 'config'], 'options');
    const seed = options.seed === undefined ? 23 : integer(options.seed, 0, 0xffffffff, 'seed');
    const phaseOffset = ((Math.imul(seed ^ 0x6d2b79f5, 1664525) + 1013904223) >>> 0) / 4294967296 * Math.PI * 2;
    return freezeState({ species: 'frog', version: 1, seed, config: configureFrog(options.config), tick: 0, lastSeq: -1,
        phaseOffset, position: point(-.55, .5), target: null, behavior: { kind: 'idle' }, jumps: 0 });
}
/** Returns the reachable landing point; the preview and flight use this same rule. */
export function landingTarget(state, target = state.target ?? point(clamp(state.position.x + .55, -.9, .9), state.position.y)) {
    validateTarget(target);
    const x = clamp(target.x, -.9, .9), y = clamp(target.y, -.75, .75);
    const dx = x - state.position.x, dy = y - state.position.y, distance = Math.hypot(dx, dy);
    const ratio = distance > state.config.maxDistance ? state.config.maxDistance / distance : 1;
    return point(state.position.x + dx * ratio, state.position.y + dy * ratio);
}
function advanceBehavior(state) {
    const b = state.behavior, c = state.config;
    if (b.kind === 'idle' || b.kind === 'interest')
        return { behavior: b, position: state.position };
    const age = b.age + 1;
    switch (b.kind) {
        case 'crouch': return { behavior: age >= c.crouchTicks ? { kind: 'flight', age: 0, plan: b.plan } : { ...b, age }, position: state.position };
        case 'flight': {
            const u = Math.min(1, age / c.flightTicks);
            const position = point(b.plan.from.x + (b.plan.to.x - b.plan.from.x) * u, b.plan.from.y + (b.plan.to.y - b.plan.from.y) * u);
            return { behavior: age >= c.flightTicks ? { kind: 'landing', age: 0 } : { ...b, age }, position };
        }
        case 'landing': return { behavior: age >= c.landingTicks ? { kind: 'recovery', age: 0 } : { ...b, age }, position: state.position };
        case 'recovery': return { behavior: age >= c.recoveryTicks ? { kind: 'cooldown', age: 0 } : { ...b, age }, position: state.position };
        case 'cooldown': return { behavior: age >= c.cooldownTicks ? { kind: state.target ? 'interest' : 'idle' } : { ...b, age }, position: state.position };
    }
}
/** One explicit 60Hz step. Entire event batch validates before state is created. */
export function stepFrog(state, tick, inputs = []) {
    integer(tick, 1, FROG_LIMITS.maxTick, 'tick');
    if (tick !== state.tick + 1)
        throw new RangeError('tick must be the next integer tick');
    if (!Array.isArray(inputs) || inputs.length > FROG_LIMITS.eventsPerTick)
        throw new RangeError('At most 8 events per tick');
    let lastSeq = state.lastSeq;
    for (const input of inputs) {
        ownKeys(input, input?.type === 'target' ? ['tick', 'seq', 'type', 'x', 'y'] : ['tick', 'seq', 'type'], 'input');
        if (input.tick !== tick)
            throw new RangeError('Input must address this next tick');
        integer(input.seq, 0, Number.MAX_SAFE_INTEGER, 'seq');
        if (input.seq <= lastSeq)
            throw new RangeError('seq must strictly increase across the replay');
        lastSeq = input.seq;
        if (input.type === 'target')
            validateTarget({ x: input.x, y: input.y });
        else if (input.type !== 'leap' && input.type !== 'leave')
            throw new TypeError('Unknown frog input type');
    }
    const next = advanceBehavior(state);
    let current = { ...state, ...next, tick, lastSeq };
    let startedLeap = false, ignoredLeaps = 0;
    for (const input of inputs) {
        if (input.type === 'target') {
            current = { ...current, target: point(input.x, input.y) };
            if (current.behavior.kind === 'idle')
                current = { ...current, behavior: { kind: 'interest' } };
        }
        else if (input.type === 'leave') {
            current = { ...current, target: null };
            if (current.behavior.kind === 'interest')
                current = { ...current, behavior: { kind: 'idle' } };
        }
        else if (current.behavior.kind === 'idle' || current.behavior.kind === 'interest') {
            const plan = Object.freeze({ from: current.position, to: landingTarget(current) });
            current = { ...current, behavior: { kind: 'crouch', age: 0, plan }, jumps: current.jumps + 1 };
            startedLeap = true;
        }
        else
            ignoredLeaps++;
    }
    return Object.freeze({ state: freezeState(current), startedLeap, ignoredLeaps });
}
/** Clear host-transient preview without moving animal time or an active leap. */
export function clearFrogTarget(state) {
    return freezeState({ ...state, target: null, behavior: state.behavior.kind === 'interest' ? { kind: 'idle' } : state.behavior });
}
/** An intentional static target change, with no autonomous tick or leap. */
export function previewFrogTarget(state, target) {
    return freezeState({ ...state, target: validateTarget(target), behavior: state.behavior.kind === 'idle' ? { kind: 'interest' } : state.behavior });
}
export function resetFrog(state, options = {}) {
    ownKeys(options, ['seed', 'config'], 'reset');
    return createFrog({ seed: options.seed === undefined ? state.seed : options.seed, config: configureFrog(options.config, state.config) });
}
/** Root travel is separate from local articulation. y points down, z toward camera. */
export function poseFrog(state, options = {}) {
    const c = state.config, b = state.behavior;
    const motion = options.motion !== false;
    const phase = state.tick / 240 * Math.PI * 2 + state.phaseOffset;
    let compression = 0, extension = 0, height = 0, throatEnvelope = 1;
    if (b.kind === 'crouch') {
        compression = .72 * ease(b.age / c.crouchTicks);
        throatEnvelope = 1 - ease(b.age / c.crouchTicks);
    }
    if (b.kind === 'flight') {
        const u = b.age / c.flightTicks;
        height = 4 * c.jumpHeight * u * (1 - u);
        compression = .72 * (1 - ease(u / .18));
        // Unfold early after takeoff, then gather before contact. The original
        // symmetric sine kept the hindlegs folded through most of the launch.
        extension = ease(u / .26) * (1 - ease((u - .56) / .44));
        throatEnvelope = 0;
    }
    if (b.kind === 'landing') {
        const u = b.age / c.landingTicks;
        compression = u < .4 ? .92 * ease(u / .4) : .92 - .7 * ease((u - .4) / .6);
        throatEnvelope = 0;
    }
    if (b.kind === 'recovery') {
        compression = .22 * (1 - ease(b.age / c.recoveryTicks));
        throatEnvelope = ease(b.age / c.recoveryTicks);
    }
    if (options.staticPose !== undefined) {
        if (!['rest', 'crouch', 'airborne', 'landed'].includes(options.staticPose))
            throw new TypeError('Unknown static pose');
        compression = options.staticPose === 'crouch' ? .72 : options.staticPose === 'landed' ? .85 : 0;
        extension = options.staticPose === 'airborne' ? 1 : 0;
        height = 0;
        throatEnvelope = 0;
    }
    return Object.freeze({ origin: Object.freeze({ x: state.position.x * 1.5, y: .2 + state.position.y * .5 - height, z: 0 }),
        scale: c.size, compression, extension, airborne: height > 0 || options.staticPose === 'airborne',
        throat: motion ? c.throatAmplitude * (.5 - .5 * Math.cos(phase)) * throatEnvelope : 0,
        gaze: state.target ? clamp(state.target.x - state.position.x, -1, 1) : 0, phase: motion ? phase : state.phaseOffset });
}
/** CSS-rect input, independent of DPR. Invalid/zero rect is a safe no-target result. */
export function normalizeFrogPointer(clientX, clientY, rect) {
    if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0)
        return null;
    return point(clamp((clientX - rect.left) / rect.width * 2 - 1, -1, 1), clamp((clientY - rect.top) / rect.height * 2 - 1, -1, 1));
}
export function stampFrogAction(action, tick, seq) {
    return { ...action, tick, seq };
}
