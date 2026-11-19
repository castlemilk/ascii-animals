import { createOwl, resolveOwlOptions, OWL_LIMITS } from './owl.js';
import { OWL_REST_PRESENTATION, owlFlightPose, owlListeningPose } from './choreography.js';
export const OWL_DIRECTOR_DEFAULTS = Object.freeze({
    scene: 'lookout', count: 2, layout: 'bough', tempo: 1, alertness: .7,
    sociability: .65, breeze: .3, autonomous: true,
    roles: Object.freeze(['sentinel', 'dreamer']),
});
export const OWL_DIRECTOR_LIMITS = Object.freeze({ actors: 2, eventsPerTick: 16, tickRate: 60,
    cueCooldownTicks: 60, maxCueTicks: 360, maxCells: 14400 });
const roles = ['sentinel', 'curious', 'dreamer'];
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const smooth = (n) => { const p = clamp(n); return p * p * (3 - 2 * p); };
const hump = (n) => Math.sin(Math.PI * clamp(n)) ** 2;
const lerp = (a, b, k) => a + (b - a) * k;
function record(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError(`${name} must be an object`);
    return value;
}
function finite(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        throw new TypeError(`${name} must be finite`);
    return value;
}
function actor(value) {
    if (value !== 0 && value !== 1)
        throw new RangeError('Owl target must be 0 or 1');
    return value;
}
function configFrom(options, base) {
    const input = record(options, 'Director options');
    const next = { ...base };
    for (const [key, value] of Object.entries(input)) {
        if (!Object.hasOwn(base, key))
            throw new TypeError(`Unknown director option: ${key}`);
        switch (key) {
            case 'scene':
                if (typeof value !== 'string' || !['lookout', 'duet', 'roost'].includes(value))
                    throw new RangeError('Unknown Owl scene');
                next.scene = value;
                break;
            case 'count':
                if (value !== 1 && value !== 2)
                    throw new RangeError('Owl director count must be 1 or 2');
                next.count = value;
                break;
            case 'layout':
                if (typeof value !== 'string' || !['bough', 'split', 'close'].includes(value))
                    throw new RangeError('Unknown perch layout');
                next.layout = value;
                break;
            case 'roles':
                if (!Array.isArray(value) || value.length !== 2 || [value[0], value[1]].some(v => typeof v !== 'string' || !roles.includes(v)))
                    throw new TypeError('roles must contain exactly two known Owl roles');
                next.roles = Object.freeze([value[0], value[1]]);
                break;
            case 'autonomous':
                if (typeof value !== 'boolean')
                    throw new TypeError('autonomous must be boolean');
                next.autonomous = value;
                break;
            default: {
                const n = finite(value, key), lo = key === 'tempo' ? .5 : 0, hi = key === 'tempo' ? 1.5 : 1;
                if (n < lo || n > hi)
                    throw new RangeError(`${key} must be ${lo}..${hi}`);
                next[key] = n;
            }
        }
    }
    return Object.freeze(next);
}
export function resolveOwlDirectorOptions(options = {}) {
    return configFrom(options, OWL_DIRECTOR_DEFAULTS);
}
export function validateOwlDirectorCue(cue) {
    const input = record(cue, 'Owl cue');
    if (Object.keys(input).some(k => !['kind', 'target', 'x', 'y'].includes(k)))
        throw new TypeError('Unknown cue field');
    if (typeof input.kind !== 'string' || !['rustle', 'call', 'stretch', 'flight'].includes(input.kind))
        throw new RangeError('Unknown Owl cue');
    const target = Object.hasOwn(input, 'target') ? actor(input.target) : 0;
    const x = Object.hasOwn(input, 'x') ? clamp(finite(input.x, 'cue x'), -1, 1) : (target === 0 ? -.65 : .65);
    const y = Object.hasOwn(input, 'y') ? clamp(finite(input.y, 'cue y'), -1, 1) : -.25;
    return Object.freeze({ kind: input.kind, target, x, y });
}
const beats = {
    lookout: [['survey', 240], ['listen', 180], ['alert', 120], ['settle', 240]],
    duet: [['call', 180], ['answer', 180], ['shared-watch', 240], ['settle', 180]],
    roost: [['survey', 180], ['stretch', 240], ['rest', 540], ['wake', 120]],
};
function phaseAt(config, beat) {
    const sequence = beats[config.scene], duration = sequence.reduce((sum, entry) => sum + entry[1], 0);
    const cycle = Math.floor(beat / duration);
    let age = beat % duration;
    for (const [kind, length] of sequence) {
        if (age < length)
            return Object.freeze({ kind, progress: age / length, cycle });
        age -= length;
    }
    return Object.freeze({ kind: sequence[0][0], progress: 0, cycle });
}
function cuePhase(cue, tick, cycle) {
    const age = tick - cue.startTick;
    const kind = cue.kind === 'flight' ? (age < 90 ? 'launch' : age < 198 ? 'glide' : age < 264 ? 'brake' : 'alight')
        : cue.kind === 'rustle' ? (age < 40 ? 'alert' : age < 180 ? 'listen' : 'settle')
            : cue.kind === 'call' ? (age < 96 ? 'call' : age < 190 ? 'answer' : 'settle')
                : age < 180 ? 'stretch' : 'settle';
    return Object.freeze({ kind, progress: clamp(age / cue.duration), cycle });
}
function directive(id, state, seedPhase) {
    // The global cue label must not wake an unaddressed actor before its reply delay.
    // Each actor keeps its autonomous baseline until the local cue envelope starts.
    const { config: c, beat, tick } = state, phase = phaseAt(c, beat), role = c.roles[id], p = phase.progress;
    const amp = role === 'sentinel' ? .92 : role === 'curious' ? .72 : .34;
    const d = { x: Math.sin(beat / 115 + seedPhase + id * 1.8) * amp,
        y: Math.sin(beat / 170 + seedPhase) * .22, blink: role === 'dreamer' ? .45 : 0,
        ruffle: c.breeze * (.5 + .5 * Math.sin(tick / 35 + seedPhase)) * .12,
        left: 0, right: 0, motive: role === 'dreamer' ? 'Drowsy watch' : 'Surveying the clearing',
        presentation: OWL_REST_PRESENTATION, flight: false };
    if (!c.autonomous) {
        d.x = 0;
        d.y = 0;
        d.blink = role === 'dreamer' ? .5 : 0;
        d.motive = 'Waiting for your direction';
    }
    else
        switch (phase.kind) {
            case 'listen':
                d.x = id === 0 ? -.64 : .55;
                d.y = -.45;
                d.blink = 0;
                d.presentation = owlListeningPose(p * 300, d.x, c.alertness);
                d.motive = 'Holding the facial disc toward a sound';
                break;
            case 'alert':
                d.x = id === 0 ? .9 : -.65;
                d.y = -.25;
                d.blink = 0;
                d.ruffle += hump(p) * .2;
                d.motive = 'Holding a sound in focus';
                break;
            case 'settle':
                d.x *= .45;
                d.y = .25;
                d.blink = role === 'dreamer' ? .8 : hump(p) * .55;
                d.ruffle += hump(p) * .3;
                d.motive = role === 'dreamer' ? 'Drifting back to rest' : 'Smoothing the feathers';
                break;
            case 'call':
                d.x = id === 0 ? .72 : .25;
                d.y = id === 0 ? -.5 : .25;
                d.blink = id === 0 ? 0 : role === 'dreamer' ? .72 : .15;
                d.ruffle += id === 0 ? .4 * hump(p * 1.4) : 0;
                d.motive = id === 0 ? 'Calling across the bough' : 'Waiting for the call';
                break;
            case 'answer':
                d.x = id === 1 ? -.8 : .6;
                d.y = id === 1 ? -.4 : -.1;
                d.blink = id === 1 ? 0 : hump(p) * .7;
                d.ruffle += id === 1 ? .5 * hump(p) * c.sociability : 0;
                d.left = id === 1 ? .2 * hump(p) * c.sociability : 0;
                d.motive = id === 1 ? 'Answering the companion' : 'Listening for an answer';
                break;
            case 'shared-watch':
                d.x = id === 0 ? -.8 : .8;
                d.y = -.12;
                d.blink = 0;
                d.motive = id === 0 ? 'Watching the western edge' : 'Watching the eastern edge';
                break;
            case 'stretch': {
                const q = (p - id * .25) / .7;
                d.left = hump(q) * .8;
                d.right = hump(q - .08) * .65;
                d.x *= .3;
                d.y = -.2;
                d.blink = hump(q) * .35;
                d.motive = q > 0 && q < 1 ? 'Unfolding one wing, then the other' : 'Waiting for room to stretch';
                break;
            }
            case 'rest':
                d.x *= .15;
                d.y = .65;
                d.blink = role === 'sentinel' ? .68 : .96;
                d.motive = role === 'sentinel' ? 'Resting with one eye on the clearing' : 'Dozing in the last light';
                break;
            case 'wake':
                d.x *= smooth(p);
                d.y = .65 * (1 - smooth(p));
                d.blink = .95 * (1 - smooth(p));
                d.ruffle += .24 * hump(p);
                d.motive = 'Waking for the next watch';
                break;
        }
    if (state.pointer.active && !state.cue) {
        const primary = state.pointer.target === id;
        if (primary || (c.sociability > .6 && role === 'curious')) {
            d.x = state.pointer.x * (role === 'curious' ? 1 : .82);
            d.y = state.pointer.y * .8;
            d.blink = 0;
            d.motive = primary ? 'Following your quiet movement' : 'Following the companion’s attention';
        }
    }
    if (state.cue) {
        const cue = state.cue, lead = id === cue.target, age = tick - cue.startTick;
        if (cue.kind === 'flight') {
            const envelope = smooth(age / 30) * (1 - smooth((age - 280) / 60));
            if (lead) {
                const flight = owlFlightPose(age, cue.x, cue.strength);
                d.flight = true;
                d.presentation = flight.presentation;
                d.left = flight.left;
                d.right = flight.right;
                d.ruffle = flight.ruffle;
                d.x = lerp(d.x, cue.x * .4, envelope);
                d.y = lerp(d.y, -.3, envelope);
                d.blink *= 1 - envelope;
                d.motive = age < 42 ? 'Crouching over the feet before launch' : age < 90 ? 'Pushing from the bough; wings opening'
                    : age < 198 ? 'Gliding on broad, quiet wings' : age < 264 ? 'Flaring the wings; both feet reaching'
                        : age < 290 ? 'Meeting the bough and absorbing the landing' : 'Folding the flight feathers back into place';
            }
            else if (c.sociability > .15 && age >= 24) {
                d.x = lerp(d.x, cue.target === 0 ? -.72 : .72, envelope);
                d.y = lerp(d.y, -.4, envelope);
                d.blink *= 1 - envelope;
                d.motive = 'Following the companion’s returning flight';
            }
        }
        else {
            const delay = lead ? 0 : cue.kind === 'call' ? 96 : 48;
            const a = age - delay;
            if ((lead || c.sociability > .15) && a >= 0) {
                const envelope = 1 - smooth((a - 165) / 110);
                d.x = lerp(d.x, lead ? cue.x : (cue.target === 0 ? -.75 : .75), envelope);
                d.y = lerp(d.y, cue.y, envelope);
                d.blink *= 1 - envelope;
                d.ruffle += (cue.kind === 'call' ? .5 : .22) * hump(a / 100) * (lead ? 1 : c.sociability);
                if (cue.kind === 'rustle') {
                    d.presentation = owlListeningPose(a, lead ? cue.x : -cue.x, cue.strength);
                    d.ruffle += .18 * hump((a - 170) / 105) * (lead ? 1 : c.sociability);
                }
                d.motive = a > 180 ? 'Settling back into the scene' : cue.kind === 'rustle' ? (lead ? 'Listening to the rustling leaves' : 'Checking the companion’s concern')
                    : cue.kind === 'call' ? (lead ? 'Offering a quiet call' : 'Answering after a moment')
                        : (lead ? 'Blink, ruffle, then a wing stretch' : 'Taking a turn to stretch');
            }
            else if (!lead) {
                d.motive = role === 'dreamer' ? 'Still drowsy; waiting for a reply' : 'Waiting for the companion';
            }
        }
    }
    d.x = clamp(d.x * (.45 + .55 * c.alertness), -1, 1);
    d.y = clamp(d.y, -1, 1);
    return d;
}
/** Pure scene direction over the integrated Owl models. No renderer, timer or DOM ownership. */
export function createOwlDirector(options = {}, owlOptions = {}) {
    let config = resolveOwlDirectorOptions(options);
    const owlConfig = resolveOwlOptions(owlOptions);
    const cores = [createOwl(owlConfig), createOwl({ ...owlConfig, seed: (owlConfig.seed ^ 0x9e3779b9) >>> 0 })];
    let tick = 0, beat = 0, lastSequence = -1, cooldownUntil = 0, disposed = false;
    let cue = null;
    let pointer = Object.freeze({ active: false, x: 0, y: 0, target: 0 });
    let poses = cores.map(core => core.getState());
    const alive = () => { if (disposed)
        throw new Error('Owl director is disposed'); };
    const coreReadyAt = (id, atTick) => {
        const cycle = cores[id].getState().cycle;
        return !cycle || atTick >= cycle.startTick + cycle.blinkTicks + cycle.ruffleTicks
            + cycle.stretchTicks + cycle.recoveryTicks + cycle.cooldownTicks;
    };
    function snapshot(advancePose) {
        const scenePhase = phaseAt(config, beat), phase = cue ? cuePhase(cue, tick, scenePhase.cycle) : scenePhase;
        const base = { config, phase, tick, beat, cue, pointer };
        const actors = cores.map((core, index) => {
            const id = index, simulation = core.getState();
            const d = directive(id, base, simulation.phaseOffset), previous = poses[id];
            const pose = advancePose ? Object.freeze({ ...simulation,
                blink: clamp(lerp(previous.blink, Math.max(simulation.blink, d.blink), .25)),
                ruffle: clamp(lerp(previous.ruffle, Math.max(simulation.ruffle, d.ruffle), .16)),
                leftWing: clamp(lerp(previous.leftWing, Math.max(simulation.leftWing, d.left * (d.flight ? 1 : simulation.config.reactionStrength)), .18)),
                rightWing: clamp(lerp(previous.rightWing, Math.max(simulation.rightWing, d.right * (d.flight ? 1 : simulation.config.reactionStrength)), .18)),
                presentation: d.presentation,
            }) : Object.freeze({ ...previous, config: simulation.config, tick: simulation.tick,
                headYawDeg: clamp(previous.headYawDeg, -simulation.config.headYawLimitDeg, simulation.config.headYawLimitDeg),
                headPitchDeg: clamp(previous.headPitchDeg, -simulation.config.headPitchLimitDeg, simulation.config.headPitchLimitDeg) });
            return Object.freeze({ id, name: id === 0 ? 'Ash' : 'Ember', role: config.roles[id], motive: d.motive, simulation, pose });
        });
        poses = actors.map(a => a.pose);
        return Object.freeze({ version: 1, tick, lastSequence, beat, config, phase,
            actors: Object.freeze(actors.slice(0, config.count)), pointer, cue, cooldownUntil, poster: false });
    }
    let state = snapshot(false);
    function validate(nextTick, inputs) {
        if (!Number.isSafeInteger(nextTick) || nextTick !== tick + 1 || nextTick > OWL_LIMITS.maxTick)
            throw new RangeError('Director requires exactly the next integer tick');
        if (!Array.isArray(inputs) || inputs.length > 16)
            throw new RangeError('Director accepts at most 16 inputs per tick');
        let sequence = lastSequence;
        const events = [];
        for (const raw of inputs) {
            const input = record(raw, 'Director input');
            const allowed = input.type === 'attention' ? ['tick', 'seq', 'type', 'x', 'y', 'target'] : input.type === 'cue' ? ['tick', 'seq', 'type', 'cue'] : ['tick', 'seq', 'type'];
            if (Object.keys(input).some(k => !allowed.includes(k)))
                throw new TypeError('Unknown director input field');
            if (input.tick !== nextTick || !Number.isSafeInteger(input.seq) || input.seq <= sequence || input.seq < 0)
                throw new RangeError('Invalid director tick/sequence');
            sequence = input.seq;
            if (input.type === 'attention') {
                const target = Object.hasOwn(input, 'target') ? actor(input.target) : 0;
                if (target >= config.count)
                    throw new RangeError('Target Owl is not in this cast');
                events.push({ type: 'attention', x: clamp(finite(input.x, 'attention x'), -1, 1), y: clamp(finite(input.y, 'attention y'), -1, 1), target });
            }
            else if (input.type === 'cue') {
                const value = validateOwlDirectorCue(input.cue);
                if (value.target >= config.count)
                    throw new RangeError('Target Owl is not in this cast');
                events.push({ type: 'cue', cue: value });
            }
            else if (input.type === 'leave')
                events.push({ type: 'leave' });
            else
                throw new TypeError('Unknown director input type');
        }
        return { events, sequence };
    }
    return Object.freeze({
        advance(nextTick, inputs = []) {
            alive();
            const valid = validate(nextTick, inputs);
            tick = nextTick;
            lastSequence = valid.sequence;
            if (config.autonomous)
                beat += config.tempo;
            if (cue && tick - cue.startTick >= cue.duration)
                cue = null;
            let acceptedCues = 0, ignoredCues = 0;
            for (const event of valid.events) {
                if (event.type === 'attention')
                    pointer = Object.freeze({ x: event.x, y: event.y, target: event.target, active: true });
                if (event.type === 'leave')
                    pointer = Object.freeze({ active: false, x: 0, y: 0, target: 0 });
                if (event.type === 'cue') {
                    // Existing Owl timings can outlast the director's own cue window.
                    // Reserve both requested turns before reporting a stretch as accepted.
                    const ready = event.cue.kind === 'flight' ? coreReadyAt(event.cue.target, tick)
                        : event.cue.kind !== 'stretch' || (coreReadyAt(event.cue.target, tick)
                            && (config.count === 1 || config.sociability <= .15
                                || coreReadyAt((1 - event.cue.target), tick + 60)));
                    if (!cue && tick >= cooldownUntil && acceptedCues === 0 && ready) {
                        const duration = event.cue.kind === 'stretch' || event.cue.kind === 'flight' ? 360 : 300;
                        cue = Object.freeze({ ...event.cue, startTick: tick, duration, strength: config.alertness });
                        cooldownUntil = tick + duration + 60;
                        acceptedCues++;
                    }
                    else
                        ignoredCues++;
                }
            }
            const scenePhase = phaseAt(config, beat), phase = cue ? cuePhase(cue, tick, scenePhase.cycle) : scenePhase;
            for (const [index, core] of cores.entries()) {
                const id = index, d = directive(id, { config, phase, beat, tick, pointer, cue }, core.getState().phaseOffset);
                const events = [{ tick, seq: tick * 2, type: 'attention', x: d.x, y: d.y }];
                if (cue?.kind === 'stretch' && tick - cue.startTick === (cue.target === id ? 0 : 60) && (cue.target === id || config.count === 2 && config.sociability > .15))
                    events.push({ tick, seq: tick * 2 + 1, type: 'react' });
                core.advance(tick, events);
            }
            state = snapshot(true);
            return Object.freeze({ state, acceptedCues, ignoredCues });
        },
        getState() { alive(); return state; },
        update(options) {
            alive();
            const next = configFrom(options, config), changedScene = next.scene !== config.scene;
            config = next;
            if (changedScene) {
                beat = 0;
                cue = null;
                cooldownUntil = 0;
            }
            if (pointer.target >= config.count)
                pointer = Object.freeze({ active: false, x: 0, y: 0, target: 0 });
            if (cue && cue.target >= config.count) {
                cue = null;
                cooldownUntil = tick;
            }
            state = snapshot(false);
            return config;
        },
        updateOwl(patch) {
            alive();
            const input = record(patch, 'Owl patch');
            if (Object.hasOwn(input, 'seed') || Object.hasOwn(input, 'schemaVersion'))
                throw new TypeError('Use reset(seed) to reseed');
            resolveOwlOptions({ ...cores[0].getOptions(), ...patch });
            for (const core of cores)
                core.update(patch);
            state = snapshot(false);
        },
        reset(seed) {
            alive();
            const next = resolveOwlOptions({ ...cores[0].getOptions(), seed: seed === undefined ? cores[0].getOptions().seed : seed });
            cores[0].reset(next.seed);
            cores[1].reset((next.seed ^ 0x9e3779b9) >>> 0);
            tick = 0;
            beat = 0;
            lastSequence = -1;
            cooldownUntil = 0;
            cue = null;
            pointer = Object.freeze({ active: false, x: 0, y: 0, target: 0 });
            poses = cores.map(core => core.getState());
            state = snapshot(false);
            return state;
        },
        dispose() { if (disposed)
            return; disposed = true; for (const core of cores)
            core.dispose(); },
        get disposed() { return disposed; },
    });
}
/** A deliberate scene still. Does not mutate or advance director/core simulation. */
export function makeOwlDirectorPoster(state, poster) {
    const input = record(poster, 'Director poster');
    let target = 0, x = 0, y = 0;
    if (input.kind === 'rest') {
        if (Object.keys(input).some(k => k !== 'kind'))
            throw new TypeError('Unknown rest poster field');
    }
    else if (input.kind === 'attention') {
        if (Object.keys(input).some(k => !['kind', 'target', 'x', 'y'].includes(k)))
            throw new TypeError('Unknown attention poster field');
        target = Object.hasOwn(input, 'target') ? actor(input.target) : 0;
        x = clamp(finite(input.x, 'poster x'), -1, 1);
        y = clamp(finite(input.y, 'poster y'), -1, 1);
    }
    else {
        const cue = validateOwlDirectorCue(poster);
        target = cue.target;
        x = cue.x;
        y = cue.y;
    }
    if (target >= state.config.count)
        throw new RangeError('Target Owl is not in this cast');
    const actors = state.actors.map(a => {
        const lead = a.id === target, restful = input.kind === 'rest', flight = input.kind === 'flight', stretch = input.kind === 'stretch' || flight;
        const pose = Object.freeze({ ...a.pose,
            headYawDeg: (restful ? a.id === 0 ? -.1 : .1 : lead ? x : a.id === 0 ? .6 : -.6) * a.pose.config.headYawLimitDeg,
            headPitchDeg: (restful ? state.config.scene === 'roost' ? .6 : 0 : y) * a.pose.config.headPitchLimitDeg,
            blink: restful ? state.config.scene === 'roost' || a.role === 'dreamer' ? .9 : .15 : lead ? 0 : .25,
            ruffle: input.kind === 'call' ? (lead ? .45 : .25) : input.kind === 'rustle' ? .2 : 0,
            leftWing: stretch ? a.pose.config.reactionStrength * (lead ? .8 : .35) : 0,
            rightWing: stretch ? a.pose.config.reactionStrength * (lead ? .68 : .2) : 0,
            breath: 0,
            presentation: flight && lead ? Object.freeze({ ...OWL_REST_PRESENTATION, wingSweep: .28, tailFan: .35 })
                : input.kind === 'rustle' && lead ? owlListeningPose(80, x, 1) : OWL_REST_PRESENTATION,
        });
        return Object.freeze({ ...a, pose, motive: restful ? 'A deliberate quiet still' : lead ? `A still ${String(input.kind)} response` : 'A still companion response' });
    });
    const kind = input.kind === 'rest' ? (state.config.scene === 'roost' ? 'rest' : 'survey') : input.kind === 'flight' ? 'glide' : input.kind === 'call' ? 'answer' : input.kind === 'stretch' ? 'stretch' : 'listen';
    return Object.freeze({ ...state, actors: Object.freeze(actors), poster: true,
        phase: Object.freeze({ ...state.phase, kind, progress: .5 }) });
}
