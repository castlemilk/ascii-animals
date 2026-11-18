/** Deterministic frog-only choreography; no DOM, renderer, clock or randomness. */
import { FROG_LIMITS, clamp, clearFrogTarget, configureFrog, createFrog, finite, integer, ownKeys, poseFrog, previewFrogTarget, stepFrog, validateTarget, } from './frog.mjs';
export const FROG_POND_LIMITS = Object.freeze({
    tickRate: 60, maxTick: FROG_LIMITS.maxTick, eventsPerTick: 8,
    maxActors: 3, maxPads: 6, maxAirborne: 1, maxRipples: 6, maxReplies: 2,
    maxFireflies: 1, maxSceneSamples: 60000,
    callTicks: 84, trackTicks: 36, strikeTicks: 12, settleTicks: 48,
    listenTicks: 72, rippleTicks: 90, fireflyTicks: 240,
    replyDelayTicks: 36, replySpacingTicks: 30,
});
const ROLES = ['caller', 'hunter', 'dreamer'];
const SCENES = ['stillwater', 'firefly-supper', 'moonlit-chorus'];
const LAYOUTS = ['arc', 'stepping-stones', 'shelter'];
const DIRECTOR_KEYS = ['scene', 'count', 'layout', 'tempo', 'autonomy', 'roles'];
const DEFAULT_ROLES = Object.freeze(['caller', 'hunter', 'dreamer']);
export const FROG_DIRECTOR_DEFAULTS = Object.freeze({
    scene: 'moonlit-chorus', count: 3, layout: 'arc', tempo: 1,
    autonomy: true, roles: DEFAULT_ROLES,
});
const names = ['Moss', 'Pip', 'Fern'];
const point = (x, y) => Object.freeze({ x, y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ready = (model) => model.behavior.kind === 'idle' || model.behavior.kind === 'interest';
const airborne = (model) => model.behavior.kind === 'crouch' || model.behavior.kind === 'flight';
const freeMotive = (motive) => motive.kind === 'rest' || motive.kind === 'listen';
const rest = () => Object.freeze({ kind: 'rest', age: 0 });
const settle = () => Object.freeze({ kind: 'settle', age: 0, duration: FROG_POND_LIMITS.settleTicks });
function enumValue(value, values, label) {
    for (const candidate of values)
        if (value === candidate)
            return candidate;
    throw new TypeError(`Unknown ${label}`);
}
function role(value) { return enumValue(value, ROLES, 'frog role'); }
function hash(seed, salt) {
    let n = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35) >>> 0;
    return (n ^ (n >>> 16)) >>> 0;
}
/** Atomic schema validation, including owned copies of all three role entries. */
export function configureFrogDirector(patch = {}, base = FROG_DIRECTOR_DEFAULTS) {
    ownKeys(patch, DIRECTOR_KEYS, 'director');
    ownKeys(base, DIRECTOR_KEYS, 'director base');
    const value = (key) => Object.hasOwn(patch, key) ? patch[key] : base[key];
    const scene = enumValue(value('scene'), SCENES, 'frog scene');
    const layout = enumValue(value('layout'), LAYOUTS, 'pond layout');
    const rawCount = integer(value('count'), 1, 3, 'count');
    const count = rawCount === 1 ? 1 : rawCount === 2 ? 2 : 3;
    const tempo = finite(value('tempo'), 'tempo');
    if (tempo < .5 || tempo > 1.5)
        throw new RangeError('tempo must be in .5..1.5');
    const autonomy = value('autonomy');
    if (typeof autonomy !== 'boolean')
        throw new TypeError('autonomy must be boolean');
    const rawRoles = value('roles');
    if (!Array.isArray(rawRoles) || rawRoles.length !== 3)
        throw new TypeError('roles must contain exactly three frog roles');
    const roles = Object.freeze([role(rawRoles[0]), role(rawRoles[1]), role(rawRoles[2])]);
    return Object.freeze({ scene, count, layout, tempo, autonomy, roles });
}
function makePads(config) {
    // IDs 0..2 are the initial occupied pads. Layout changes happen only on reset.
    const coordinates = config.layout === 'arc'
        ? [[-.72, .45], [0, -.48], [.72, .45], [-.72, -.55], [0, .55], [.72, -.55]]
        : config.layout === 'stepping-stones'
            ? [[-.72, .5], [0, .04], [.72, -.45], [-.68, -.53], [0, .6], [.7, .5]]
            : [[-.66, .25], [-.02, -.22], [.64, .2], [-.7, -.58], [.02, .57], [.72, -.5]];
    return Object.freeze(coordinates.map(([x, y], id) => Object.freeze({ id, label: `Pad ${id + 1}`, point: point(x, y) })));
}
function freezePond(state) {
    for (const actor of state.actors) {
        if ('point' in actor.motive)
            Object.freeze(actor.motive.point);
        Object.freeze(actor.motive);
        Object.freeze(actor);
    }
    for (const ripple of state.ripples) {
        Object.freeze(ripple.point);
        Object.freeze(ripple);
    }
    if (state.firefly) {
        Object.freeze(state.firefly.point);
        Object.freeze(state.firefly);
    }
    for (const reply of state.replies)
        Object.freeze(reply);
    Object.freeze(state.actors);
    Object.freeze(state.ripples);
    Object.freeze(state.replies);
    if (state.target)
        Object.freeze(state.target);
    return Object.freeze(state);
}
function cueGap(config) {
    const ticks = config.scene === 'stillwater' ? 252 : config.scene === 'firefly-supper' ? 210 : 240;
    return Math.max(1, Math.round(ticks / config.tempo));
}
function scenePhase(tick, config) {
    const opening = Math.round(90 / config.tempo), activity = Math.round(480 / config.tempo);
    const settling = Math.round(120 / config.tempo), quiet = Math.round(210 / config.tempo);
    const cursor = tick % (opening + activity + settling + quiet);
    return cursor < opening ? 'opening' : cursor < opening + activity ? 'activity'
        : cursor < opening + activity + settling ? 'settling' : 'quiet';
}
/** Initial placement is authored once; subsequent travel uses the body model. */
export function createFrogPond(options = {}) {
    ownKeys(options, ['seed', 'config', 'director'], 'pond options');
    const seed = options.seed === undefined ? 23 : integer(options.seed, 0, 0xffffffff, 'seed');
    const config = configureFrogDirector(options.director);
    const bodyConfig = configureFrog(options.config);
    const pads = makePads(config);
    const actors = [];
    for (let id = 0; id < config.count; id++) {
        const pad = pads[id];
        const name = names[id];
        const actorRole = config.roles[id];
        if (!pad || !name || !actorRole)
            throw new Error('Invalid authored frog layout');
        const created = createFrog({ seed: hash(seed, id), config: bodyConfig });
        const model = Object.freeze({ ...created, position: pad.point });
        actors.push({ id, name, role: actorRole, model, padId: pad.id, reservedPad: null, motive: rest() });
    }
    return freezePond({ species: 'frog-pond', version: 1, seed, tick: 0, lastSeq: -1,
        config, bodyConfig, selectedId: 0, actors, pads, target: null, previewPad: null,
        ripples: [], firefly: null, replies: [], scenePhase: 'opening',
        nextCueTick: Math.round(90 / config.tempo) + hash(seed, 27) % 24,
        cueCount: 0, nextEffectId: 0 });
}
function actorAt(state, id) {
    integer(id, 0, state.actors.length - 1, 'frogId');
    const actor = state.actors[id];
    if (!actor || actor.id !== id)
        throw new RangeError('Unknown frogId');
    return actor;
}
function padAt(state, id) {
    integer(id, 0, state.pads.length - 1, 'padId');
    const pad = state.pads[id];
    if (!pad || pad.id !== id)
        throw new RangeError('Unknown padId');
    return pad;
}
function unoccupied(actors, padId) {
    return !actors.some(actor => actor.padId === padId || actor.reservedPad === padId);
}
function reachable(actor, pad, maxDistance = actor.model.config.maxDistance) {
    return distance(actor.model.position, pad.point) <= maxDistance + 1e-10;
}
function previewPadFor(state, target, selectedId = state.selectedId) {
    if (!target)
        return null;
    const actor = actorAt(state, selectedId);
    let nearest;
    let best = Infinity;
    for (const pad of state.pads) {
        const d = distance(pad.point, target);
        if (d < best) {
            nearest = pad;
            best = d;
        }
    }
    return nearest && unoccupied(state.actors, nearest.id) && reachable(actor, nearest) ? nearest.id : null;
}
/** Selection never changes an actor's clock, body, position or active plan. */
export function selectPondFrog(state, id) {
    actorAt(state, id);
    return id === state.selectedId ? state : freezePond({ ...state, selectedId: id, target: null, previewPad: null });
}
/** Role edits apply to later cues and survive reset; active motives are retained. */
export function setPondRole(state, id, nextRole) {
    const actor = actorAt(state, id), validated = role(nextRole);
    if (actor.role === validated)
        return state;
    const roles = [...state.config.roles];
    roles[id] = validated;
    const config = configureFrogDirector({ roles }, state.config);
    const actors = state.actors.map(candidate => candidate.id === id ? { ...candidate, role: validated } : candidate);
    return freezePond({ ...state, config, actors });
}
/** A transient target preview is a deliberate zero-time edit, never a hop. */
export function previewPondTarget(state, target) {
    const next = target === null ? null : validateTarget(target);
    const actors = state.actors.map(actor => actor.id !== state.selectedId ? actor : {
        ...actor, model: next ? previewFrogTarget(actor.model, next) : clearFrogTarget(actor.model),
    });
    return freezePond({ ...state, actors, target: next, previewPad: previewPadFor(state, next) });
}
/** Merge validated configuration, then reconstruct the exact seeded ensemble. */
export function resetFrogPond(state, options = {}) {
    ownKeys(options, ['seed', 'config', 'director'], 'pond reset');
    const seed = options.seed === undefined ? state.seed : integer(options.seed, 0, 0xffffffff, 'seed');
    return createFrogPond({ seed, config: configureFrog(options.config, state.bodyConfig),
        director: configureFrogDirector(options.director, state.config) });
}
function validateInputs(state, tick, inputs) {
    integer(tick, 1, FROG_POND_LIMITS.maxTick, 'pond tick');
    if (tick !== state.tick + 1)
        throw new RangeError('pond tick must be the next integer tick');
    if (!Array.isArray(inputs) || inputs.length > FROG_POND_LIMITS.eventsPerTick)
        throw new RangeError('At most 8 pond events per tick');
    let lastSeq = state.lastSeq;
    for (const input of inputs) {
        const kind = input?.type;
        const fields = kind === 'target' || kind === 'ripple' ? ['type', 'tick', 'seq', 'x', 'y']
            : kind === 'hunt' ? ['type', 'tick', 'seq', 'frogId', 'x', 'y']
                : kind === 'hop' ? ['type', 'tick', 'seq', 'frogId', 'padId']
                    : kind === 'select' || kind === 'call' ? ['type', 'tick', 'seq', 'frogId'] : ['type', 'tick', 'seq'];
        ownKeys(input, fields, 'pond input');
        if (input.tick !== tick)
            throw new RangeError('Pond input must address this next tick');
        integer(input.seq, 0, Number.MAX_SAFE_INTEGER, 'pond seq');
        if (input.seq <= lastSeq)
            throw new RangeError('Pond seq must strictly increase across the replay');
        lastSeq = input.seq;
        switch (input.type) {
            case 'target':
            case 'ripple':
                validateTarget({ x: input.x, y: input.y });
                break;
            case 'hunt':
                actorAt(state, input.frogId);
                validateTarget({ x: input.x, y: input.y });
                break;
            case 'hop':
                actorAt(state, input.frogId);
                padAt(state, input.padId);
                break;
            case 'call':
            case 'select':
                actorAt(state, input.frogId);
                break;
            case 'leave': break;
            default: throw new TypeError('Unknown pond input type');
        }
    }
    return lastSeq;
}
/**
 * Validate the whole batch, then advance every model exactly one logical tick.
 * Leap commands replay that one body step with two local inputs; they never
 * advance a model twice. Scene inputs and transient gaze edits have their own log.
 */
export function stepFrogPond(state, tick, inputs = []) {
    const lastSeq = validateInputs(state, tick, inputs);
    const actors = state.actors.map(actor => ({ ...actor, model: stepFrog(actor.model, tick).state }));
    let selectedId = state.selectedId, target = state.target;
    let ripples = state.ripples.filter(effect => effect.age + 1 < effect.ttl).map(effect => ({ ...effect, age: effect.age + 1 }));
    let firefly = state.firefly && state.firefly.age + 1 < state.firefly.ttl ? { ...state.firefly, age: state.firefly.age + 1 } : null;
    let replies = [...state.replies];
    let nextCueTick = state.nextCueTick, cueCount = state.cueCount, nextEffectId = state.nextEffectId;
    let ignoredActions = 0;
    const notices = [];
    const currentPhase = scenePhase(tick, state.config);
    const actorById = (id) => {
        const actor = actors[id];
        if (!actor)
            throw new RangeError('Unknown frogId');
        return actor;
    };
    const available = (actor) => ready(actor.model) && freeMotive(actor.motive);
    function ripple(at, kind, strength) {
        ripples.push({ id: nextEffectId++, point: at, age: 0, ttl: FROG_POND_LIMITS.rippleTicks, kind, strength });
        if (ripples.length > FROG_POND_LIMITS.maxRipples)
            ripples = ripples.slice(-FROG_POND_LIMITS.maxRipples);
    }
    function reject(actor, reason, manual) {
        if (manual) {
            ignoredActions++;
            notices.push(`${actor.name}: ${reason}`);
        }
        return false;
    }
    function beginHop(actor, pad, purpose, manual) {
        if (!available(actor))
            return reject(actor, 'busy; wait for rest before hopping.', manual);
        if (actors.some(other => airborne(other.model)))
            return reject(actor, 'another frog is jumping; wait for touchdown.', manual);
        if (!unoccupied(actors, pad.id))
            return reject(actor, 'that pad is occupied or reserved.', manual);
        if (!reachable(actor, pad))
            return reject(actor, 'that pad is beyond the configured leap distance.', manual);
        const original = state.actors[actor.id];
        if (!original)
            throw new Error('Missing original actor');
        const seq = original.model.lastSeq;
        const result = stepFrog(original.model, tick, [
            { type: 'target', x: pad.point.x, y: pad.point.y, tick, seq: seq + 1 },
            { type: 'leap', tick, seq: seq + 2 },
        ]);
        if (!result.startedLeap)
            return reject(actor, 'body is recovering; wait before hopping.', manual);
        actor.model = result.state;
        actor.reservedPad = pad.id;
        actor.motive = { kind: 'hop', age: 0, purpose, point: pad.point };
        notices.push(`${actor.name} hops to ${pad.label.toLowerCase()}.`);
        return true;
    }
    function choosePad(actor, toward, short = false) {
        const maximum = short ? Math.min(.95, actor.model.config.maxDistance) : actor.model.config.maxDistance;
        return state.pads.filter(pad => unoccupied(actors, pad.id) && reachable(actor, pad, maximum))
            .sort((a, b) => distance(a.point, toward) - distance(b.point, toward) || a.id - b.id)[0];
    }
    function beginCall(actor, reply, manual) {
        if (!available(actor))
            return reject(actor, 'busy; wait before calling.', manual);
        actor.motive = { kind: 'call', age: 0, duration: FROG_POND_LIMITS.callTicks, reply };
        ripple(actor.model.position, 'call', reply ? .55 : .8);
        replies = replies.filter(pending => pending.frogId !== actor.id);
        if (!reply) {
            const neighbors = actors.filter(other => other.id !== actor.id && available(other));
            for (let index = 0; index < neighbors.length && replies.length < FROG_POND_LIMITS.maxReplies; index++) {
                const neighbor = neighbors[index];
                if (!neighbor || replies.some(pending => pending.frogId === neighbor.id))
                    continue;
                replies.push({ frogId: neighbor.id, sourceId: actor.id, generation: 1,
                    dueTick: tick + Math.round((FROG_POND_LIMITS.replyDelayTicks + index * FROG_POND_LIMITS.replySpacingTicks) / state.config.tempo) });
            }
        }
        notices.push(`${actor.name} ${reply ? 'answers' : 'calls across the pond'}.`);
        return true;
    }
    function beginHunt(actor, at, manual) {
        if (!available(actor))
            return reject(actor, 'busy; wait before inviting a hunt.', manual);
        if (firefly)
            return reject(actor, 'the current firefly encounter is still settling.', manual);
        const pad = choosePad(actor, at, true);
        // The supplied point is an aiming preference. Invite the insect above an
        // actually reachable perch so the visible strike meets the visible insect.
        const focus = pad?.point ?? actor.model.position;
        actor.model = previewFrogTarget(actor.model, focus);
        actor.motive = { kind: 'track', age: 0, duration: FROG_POND_LIMITS.trackTicks, point: focus, padId: pad?.id ?? null };
        firefly = { point: focus, age: 0, ttl: FROG_POND_LIMITS.fireflyTicks, phase: 'hover', ownerId: actor.id };
        notices.push(`${actor.name} notices the firefly.`);
        return true;
    }
    function beginStrike(actor, at) {
        actor.motive = { kind: 'strike', age: 0, duration: FROG_POND_LIMITS.strikeTicks, point: at };
        const caught = distance(actor.model.position, at) <= .15;
        if (firefly?.ownerId === actor.id)
            firefly = { ...firefly, phase: caught ? 'caught' : 'hover', age: 0, ttl: FROG_POND_LIMITS.strikeTicks };
        notices.push(caught ? `${actor.name} makes a quick strike, then settles.` : `${actor.name} strikes; the firefly slips away.`);
    }
    // Touchdown transfers occupancy exactly once; both endpoints were protected.
    for (const actor of actors) {
        const original = state.actors[actor.id];
        if (!original)
            throw new Error('Missing original actor');
        const landed = original.model.behavior.kind === 'flight' && actor.model.behavior.kind === 'landing';
        if (landed && actor.reservedPad !== null) {
            actor.padId = actor.reservedPad;
            actor.reservedPad = null;
            ripple(actor.model.position, 'landing', 1);
        }
        const motive = actor.motive;
        const age = motive.age + 1;
        if (motive.kind === 'rest')
            actor.motive = { ...motive, age };
        else if (motive.kind === 'hop') {
            if (landed && motive.purpose === 'hunt')
                beginStrike(actor, motive.point);
            else
                actor.motive = ready(actor.model) ? settle() : { ...motive, age };
        }
        else if (motive.kind === 'track') {
            // Commit after manual commands so a deliberate hop wins the flight slot.
            actor.motive = { ...motive, age };
        }
        else if (age < motive.duration)
            actor.motive = { ...motive, age };
        else if (motive.kind === 'call' || motive.kind === 'strike')
            actor.motive = settle();
        else
            actor.motive = rest();
    }
    const deliberate = inputs.some(input => input.type === 'hop' || input.type === 'call' || input.type === 'hunt' || input.type === 'ripple');
    for (const input of inputs) {
        switch (input.type) {
            case 'target': {
                target = point(input.x, input.y);
                const actor = actorById(selectedId);
                actor.model = previewFrogTarget(actor.model, target);
                break;
            }
            case 'leave': {
                target = null;
                const actor = actorById(selectedId);
                actor.model = clearFrogTarget(actor.model);
                break;
            }
            case 'select':
                selectedId = input.frogId;
                target = null;
                break;
            case 'hop':
                beginHop(actorById(input.frogId), padAt(state, input.padId), 'manual', true);
                break;
            case 'call':
                beginCall(actorById(input.frogId), false, true);
                break;
            case 'hunt':
                beginHunt(actorById(input.frogId), point(input.x, input.y), true);
                break;
            case 'ripple': {
                const at = point(input.x, input.y);
                ripple(at, 'water', .8);
                const listener = actors.filter(available).sort((a, b) => distance(a.model.position, at) - distance(b.model.position, at) || a.id - b.id)[0];
                if (listener) {
                    listener.model = previewFrogTarget(listener.model, at);
                    listener.motive = { kind: 'listen', age: 0, duration: FROG_POND_LIMITS.listenTicks, point: at };
                }
                notices.push(listener ? `${listener.name} listens to the water ripple.` : 'A ripple spreads across the pond.');
                break;
            }
        }
    }
    // A track owns a bounded anticipation, not a queue of delayed jumps.
    for (const actor of actors) {
        const motive = actor.motive;
        if (motive.kind !== 'track' || motive.age < motive.duration)
            continue;
        const pad = choosePad(actor, motive.point, true);
        actor.motive = rest();
        if (pad && beginHop(actor, pad, 'hunt', false)) {
            actor.motive = { kind: 'hop', age: 0, purpose: 'hunt', point: motive.point };
            if (firefly?.ownerId === actor.id)
                firefly = { ...firefly, phase: 'chased' };
        }
        else
            beginStrike(actor, motive.point);
    }
    const dueReplies = replies.filter(reply => reply.dueTick <= tick);
    replies = replies.filter(reply => reply.dueTick > tick);
    for (const reply of dueReplies)
        beginCall(actorById(reply.frogId), true, false);
    if (tick >= nextCueTick) {
        nextCueTick = tick + cueGap(state.config);
        if (state.config.autonomy && currentPhase === 'activity' && !deliberate) {
            const preferred = state.config.scene === 'moonlit-chorus' ? 'caller' : state.config.scene === 'firefly-supper' ? 'hunter' : null;
            const candidates = actors.filter(available).sort((a, b) => Number(b.role === preferred) - Number(a.role === preferred) || a.id - b.id);
            const actor = preferred ? candidates[0] : candidates[hash(state.seed, cueCount + 70) % Math.max(1, candidates.length)];
            if (actor) {
                if (state.config.scene === 'moonlit-chorus')
                    beginCall(actor, false, false);
                else if (state.config.scene === 'firefly-supper') {
                    const pad = state.pads[hash(state.seed, cueCount + 90) % state.pads.length];
                    if (pad)
                        beginHunt(actor, pad.point, false);
                }
                else {
                    const pad = state.pads[hash(state.seed, cueCount + 120) % state.pads.length];
                    if (actor.role === 'caller' && cueCount % 4 === 3)
                        beginCall(actor, false, false);
                    else if (pad && actor.role !== 'dreamer' && cueCount % 3 === 2) {
                        const destination = choosePad(actor, pad.point);
                        if (destination)
                            beginHop(actor, destination, 'wander', false);
                    }
                    else if (pad) {
                        actor.model = previewFrogTarget(actor.model, pad.point);
                        actor.motive = { kind: 'listen', age: 0, duration: FROG_POND_LIMITS.listenTicks + (actor.role === 'dreamer' ? 48 : 0), point: pad.point };
                    }
                }
            }
            cueCount++;
        }
    }
    const next = {
        ...state, tick, lastSeq, actors, selectedId, target, previewPad: null, ripples,
        firefly, replies, scenePhase: currentPhase, nextCueTick, cueCount, nextEffectId,
    };
    const finalState = freezePond({ ...next, previewPad: previewPadFor(next, target) });
    return Object.freeze({ state: finalState, notices: Object.freeze(notices), ignoredActions });
}
/** Normalized pad-plane coordinates; z provides deterministic front/back depth. */
export function pondPointToWorld(value) {
    const p = validateTarget(value);
    return Object.freeze({ x: p.x * 2.5, y: .25 + p.y * .72, z: p.y * .60 });
}
/** The same anatomical pose, placed in the pond and given a bounded local motive. */
export function posePondFrog(state, actor, options = {}) {
    actorAt(state, actor.id);
    const base = poseFrog(actor.model, options);
    const factor = state.config.count === 3 ? .68 : state.config.count === 2 ? .76 : .90;
    const ground = pondPointToWorld(actor.model.position);
    const height = .2 + actor.model.position.y * .5 - base.origin.y;
    const motion = options.motion !== false;
    const motive = actor.motive;
    let throat = base.throat, compression = base.compression, extension = base.extension, gaze = base.gaze;
    if (motion && motive.kind === 'call') {
        const envelope = Math.sin(Math.PI * clamp(motive.age / motive.duration, 0, 1)) ** 2;
        throat = Math.max(throat, (motive.reply ? .18 : .23) * envelope);
        compression = Math.max(compression, .08 * envelope);
    }
    if (motive.kind === 'track' || motive.kind === 'strike' || motive.kind === 'listen') {
        gaze = clamp((motive.point.x - actor.model.position.x) * 1.5, -1, 1);
    }
    else if (!actor.model.target) {
        gaze = .22 * Math.sin((motion ? state.tick : 0) / (actor.role === 'dreamer' ? 150 : 96) + actor.model.phaseOffset);
    }
    if (motion && motive.kind === 'strike') {
        const envelope = Math.sin(Math.PI * clamp(motive.age / motive.duration, 0, 1));
        compression = Math.max(compression, .22 * envelope);
        extension = Math.max(extension, .12 * envelope);
    }
    if (!motion && actor.id === state.selectedId && options.pondStill === 'call')
        throat = .23;
    if (!motion && actor.id === state.selectedId && options.pondStill === 'hunt')
        gaze = .8;
    return Object.freeze({ ...base,
        origin: Object.freeze({ x: ground.x, y: ground.y - height * factor, z: ground.z }),
        scale: actor.model.config.size * factor, throat, compression, extension, gaze,
    });
}
