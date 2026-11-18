/** Species-owned pond choreography; existing dragonfly-v1 and its replay stay unchanged. */
import { createDragonfly, finiteNumber, validateDragonflyOptions } from './model.js';
import { buildDragonflyGeometry } from './geometry.js';
const ROLES = ['patroller', 'sentinel', 'skimmer', 'wanderer'];
export const DRAGONFLY_DIRECTOR_DEFAULTS = Object.freeze({
    scene: 'patrol', count: 3, route: 'banks', tempo: 1, spread: 1, scale: .4, breeze: .12,
    labels: true, roles: Object.freeze(['patroller', 'sentinel', 'skimmer', 'wanderer']),
});
export const DRAGONFLY_DIRECTOR_LIMITS = Object.freeze({ members: 4, samples: 24576, eventsPerTick: 16,
    maxTick: 2147483647, rootX: 1.3, rootYMin: -.65, rootYMax: 1.05, speed: .9, dartSpeed: 2.6,
    acceleration: 3.2, dartAcceleration: 9, tickRate: 60 });
const TAU = Math.PI * 2, DT = 1 / 60;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const v2 = (x, y) => Object.freeze({ x, y });
const v3 = (x, y, z = .12) => Object.freeze({ x, y, z });
const mix = (a, b, u) => v3(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u);
const ease = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const phase = (kind, elapsed = 0, duration = 0) => Object.freeze({ kind, elapsed, duration });
const names = ['Azure', 'Reed', 'Ember', 'Moss'];
const seedFor = (seed, id) => (seed + Math.imul(id, 104729)) >>> 0;
const bounded = (p) => v3(clamp(p.x, -1.3, 1.3), clamp(p.y, -.65, 1.05), clamp(p.z, .04, .32));
function record(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError(`${name} must be an object`);
    return value;
}
function keys(value, allowed) {
    for (const key of Object.keys(value))
        if (!allowed.includes(key))
            throw new TypeError(`Unknown director field: ${key}`);
}
function optionsWith(patch, base) {
    keys(record(patch, 'director options'), Object.keys(DRAGONFLY_DIRECTOR_DEFAULTS));
    const next = { ...base, ...patch };
    if (!['patrol', 'attention', 'relay'].includes(next.scene))
        throw new TypeError('Unknown director scene');
    if (!['banks', 'figure-eight', 'orbit'].includes(next.route))
        throw new TypeError('Unknown director route');
    finiteNumber(next.count, 'count', 1, 4, true);
    finiteNumber(next.tempo, 'tempo', .4, 1.6);
    finiteNumber(next.spread, 'spread', .65, 1.1);
    finiteNumber(next.scale, 'scale', .28, .48);
    finiteNumber(next.breeze, 'breeze', -.5, .5);
    if (typeof next.labels !== 'boolean')
        throw new TypeError('labels must be boolean');
    if (!Array.isArray(next.roles) || next.roles.length !== 4 || Array.from(next.roles).some(role => !ROLES.includes(role)))
        throw new TypeError('roles must contain exactly four declared roles');
    return Object.freeze({ ...next, roles: Object.freeze([...next.roles]) });
}
export function validateDragonflyDirectorOptions(input = {}) {
    return optionsWith(input, DRAGONFLY_DIRECTOR_DEFAULTS);
}
/** One explicit scene clock; no DOM, scheduler, randomness, renderer or wall-clock reads. */
export function createDragonflyDirector(input = {}, modelInput = {}) {
    let options = validateDragonflyDirectorOptions(input);
    const checkedModel = validateDragonflyOptions(modelInput);
    let seed = checkedModel.seed, tick = 0, lastSeq = -1, clock = 0, selected = 0;
    let target = null, paused = false, disposed = false;
    const members = [];
    const alive = () => { if (disposed)
        throw new Error('Dragonfly director is disposed'); };
    const validId = (id) => { finiteNumber(id, 'individual id', 0, members.length - 1, true); };
    const home = (id) => {
        // Stagger the actual reeds, including the explicit still arrangement. A
        // single lower row merged three neutral visitors into two silhouettes.
        const x = [-1.02, .96, -.78, .83][id] * options.spread;
        return v3(x, [-.25, -.25, 1.02, 1.02][id], .06);
    };
    const initial = (id) => id === 1 ? home(id) : v3([-.88, .98, .65, -.45][id] * options.spread, [-.38, .72, .12, .7][id], .17);
    function add(id, config) {
        const model = createDragonfly({ ...config, seed: seedFor(seed, id) });
        model.setPaused(paused);
        members.push({ id, model, position: initial(id), velocity: v2(0, 0), heading: id === 1 ? -.18 : .12,
            phase: phase(id === 1 ? 'perched' : 'hover'), wingPhase: model.getState().wingPhase,
            strength: id === 1 ? 0 : 1, response: null, held: false });
    }
    for (let id = 0; id < options.count; id++)
        add(id, checkedModel);
    function route(member) {
        const id = member.id, role = options.roles[id];
        const t = clock / 60, offset = id * 1.71 + (seedFor(seed, id) % 997) / 997;
        const speed = role === 'skimmer' ? .72 : role === 'wanderer' ? .36 : .48;
        const a = t * speed + offset;
        // Assigned territories keep paired wings legible. The first broad shared
        // sinusoid put all three visitors on the right bank at tick 360.
        const cx = [-.85, .86, -.78, .83][id], cy = [-.47, -.35, .61, .72][id];
        let x, y;
        if (options.route === 'figure-eight') {
            x = cx + Math.sin(a) * .27;
            y = cy + Math.sin(a * 2) * .17;
        }
        else if (options.route === 'orbit') {
            x = cx + Math.cos(a) * .26;
            y = cy + Math.sin(a) * .19;
        }
        else {
            x = cx + Math.sin(a) * .29;
            y = cy + Math.sin(a + id) * .10;
        }
        if (role === 'sentinel') {
            x = cx + Math.sin(a) * .12;
            y = cy + Math.sin(a * .6) * .09;
        }
        if (role === 'wanderer')
            y += Math.sin(a * .7) * .06;
        x += Math.sin(t * .28 + id) * options.breeze * .2;
        return bounded(v3(x * options.spread, y, .16 + .035 * Math.sin(a)));
    }
    function autonomous(member) {
        const id = member.id, role = options.roles[id], reed = home(id), path = route(member);
        if (member.held)
            return { goal: reed, phase: phase('perched') };
        if (target && selected === id && member.model.getOptions().followPointer) {
            const a = clock / 90 + id;
            return { goal: bounded(v3(target.x * 1.12 + Math.cos(a) * .035, .2 + target.y * .68 + Math.sin(a) * .035, .26)), phase: phase('attention') };
        }
        if (options.scene === 'attention' && selected === id) {
            const a = clock / 100;
            return { goal: v3(Math.sin(a) * .24, -.12 + Math.cos(a * .8) * .10, .28), phase: phase('attention') };
        }
        if (options.scene === 'attention') {
            const a = clock / 95 + id;
            return role === 'sentinel' ? { goal: reed, phase: phase('perched') } :
                { goal: bounded(v3(reed.x + Math.sin(a) * .12, reed.y - .10 + Math.sin(a * .7) * .08, .12)), phase: phase('hover') };
        }
        const period = options.scene === 'relay' ? 720 : role === 'sentinel' ? 840 : 1080;
        const local = (clock + id * (options.scene === 'relay' ? 180 : 217)) % period;
        const resting = options.scene === 'relay' ? 150 : role === 'sentinel' ? 300 : 130;
        if (local < resting)
            return { goal: reed, phase: phase('perched', local, resting) };
        if (local < resting + 70)
            return { goal: mix(reed, path, ease((local - resting) / 70)), phase: phase('launch', local - resting, 70) };
        if (local > period - 130)
            return { goal: reed, phase: phase(local > period - 55 ? 'land' : 'return', local - (period - 130), 130) };
        if (options.scene === 'relay' && local < resting + 170) {
            return { goal: bounded(v3(-reed.x, -.35 + id * .18, .24)), phase: phase('dart', local - resting - 70, 100) };
        }
        // Distinct lookout pauses interrupt route following; the path itself remains periodic.
        if (role !== 'skimmer' && local > period * .55 && local < period * .55 + 90)
            return { goal: v3((id % 2 ? .72 : -.72) * options.spread, -.28 + id * .12, .2), phase: phase('hover', local - period * .55, 90) };
        return { goal: path, phase: phase('patrol', local, period) };
    }
    function startCue(member, cue) {
        if (member.response && cue !== 'return')
            return false;
        const reed = home(member.id), wasPerched = member.held || member.phase.kind === 'perched';
        member.held = false;
        const requested = target ? v3(target.x * 1.12, .2 + target.y * .68, .25) :
            bounded(v3(member.position.x + (member.id % 2 ? -.75 : .75), member.position.y - .28, .25));
        let dx = requested.x - member.position.x, dy = requested.y - member.position.y;
        const distance = Math.hypot(dx, dy);
        // Deliberate darts must remain visible after the pointer has already been
        // reached. Limit the excursion, with an inward fallback near a boundary.
        if (distance < .05) {
            dx = member.position.x >= 0 ? -1 : 1;
            dy = -.25;
        }
        const length = Math.hypot(dx, dy), excursion = clamp(distance, .55, .85);
        let aim = bounded(v3(member.position.x + dx / length * excursion, member.position.y + dy / length * excursion, .25));
        if (Math.hypot(aim.x - member.position.x, aim.y - member.position.y) < .35)
            aim = bounded(v3(member.position.x + (member.position.x >= 0 ? -.65 : .65), member.position.y - .16, .25));
        member.response = { cue, elapsed: 0, from: member.position, to: cue === 'perch' ? reed : cue === 'return' ? route(member) : aim,
            home: wasPerched ? reed : member.position, wasPerched };
        return true;
    }
    function responseGoal(member, advance) {
        const r = member.response;
        r.elapsed += advance;
        const e = r.elapsed;
        if (r.cue === 'perch') {
            if (e < 100)
                return { goal: mix(r.from, r.to, ease(e / 100)), phase: phase('return', e, 100) };
            if (e < 160)
                return { goal: r.to, phase: phase('land', e - 100, 60) };
            member.response = null;
            member.held = true;
            return { goal: r.to, phase: phase('perched') };
        }
        if (r.cue === 'return') {
            if (e < 100)
                return { goal: mix(r.from, r.to, ease(e / 100)), phase: phase('return', e, 100) };
            if (e < 145)
                return { goal: r.to, phase: phase('settle', e - 100, 45) };
            member.response = null;
            return autonomous(member);
        }
        if (e < 24)
            return { goal: mix(r.from, v3(r.from.x, r.from.y - .08, .24), ease(e / 24)), phase: phase('launch', e, 24) };
        if (e < 48)
            return { goal: r.to, phase: phase('dart', e - 24, 24) };
        if (e < 96)
            return { goal: r.to, phase: phase('settle', e - 48, 48) };
        if (e < 186)
            return { goal: mix(r.to, r.home, ease((e - 96) / 90)), phase: phase('return', e - 96, 90) };
        if (e < 246)
            return { goal: r.home, phase: phase(r.wasPerched ? 'land' : 'cooldown', e - 186, 60) };
        member.response = null;
        member.held = r.wasPerched;
        return { goal: r.home, phase: phase(r.wasPerched ? 'perched' : 'hover') };
    }
    function move(member, goal, next, pace) {
        const landing = next.kind === 'perched';
        const fast = next.kind === 'dart';
        const maxSpeed = (fast ? 2.6 : .9) * pace, maxAcceleration = (fast ? 9 : 3.2) * pace;
        const dx = goal.x - member.position.x, dy = goal.y - member.position.y;
        let ax = dx * (fast ? 75 : 22) - member.velocity.x * (fast ? 11 : 8), ay = dy * (fast ? 75 : 22) - member.velocity.y * (fast ? 11 : 8);
        const length = Math.hypot(ax, ay);
        if (length > maxAcceleration) {
            ax *= maxAcceleration / length;
            ay *= maxAcceleration / length;
        }
        let vx = member.velocity.x + ax * DT, vy = member.velocity.y + ay * DT;
        const speed = Math.hypot(vx, vy);
        if (speed > maxSpeed) {
            vx *= maxSpeed / speed;
            vy *= maxSpeed / speed;
        }
        // A lower target cruise speed must not hard-clip a dart's incoming velocity.
        // Bound the final vector change too, allowing controlled braking in settle.
        const dvx = vx - member.velocity.x, dvy = vy - member.velocity.y, delta = Math.hypot(dvx, dvy);
        if (delta > maxAcceleration * DT) {
            vx = member.velocity.x + dvx / delta * maxAcceleration * DT;
            vy = member.velocity.y + dvy / delta * maxAcceleration * DT;
        }
        let position = bounded(v3(member.position.x + vx * DT, member.position.y + vy * DT, member.position.z + (goal.z - member.position.z) * Math.min(1, .08 * pace)));
        if (landing) {
            if (Math.hypot(dx, dy) < .003 && Math.hypot(vx, vy) < .015 && Math.abs(member.heading - (-.18 + member.id * .08)) < .019 * pace) {
                position = goal;
                vx = 0;
                vy = 0;
            }
            else
                next = phase('land', 0, 60);
        }
        member.velocity = v2(vx, vy);
        member.position = position;
        member.phase = next;
        const desired = landing ? -.18 + member.id * .08 : clamp(vx * .75, -.8, .8);
        member.heading += clamp(desired - member.heading, -.018 * pace, .018 * pace);
        // A requested perch may still be far away. Keep beating through approach,
        // taper only near contact, and stop only once the settled phase is reached.
        const distanceToGoal = Math.hypot(goal.x - position.x, goal.y - position.y);
        const wanted = next.kind === 'perched' ? 0 : next.kind === 'land' ? clamp(distanceToGoal / .18, .12, 1) : 1;
        member.strength += clamp(wanted - member.strength, -.045 * pace, .045 * pace);
        if (next.kind === 'perched')
            member.strength = 0;
        member.wingPhase = (member.wingPhase + TAU * member.model.getOptions().wingHz * DT * pace * member.strength) % TAU;
    }
    function getState() {
        const phases = members.map(m => m.phase.kind);
        const arc = clock < 90 ? 'arrive' : phases.includes('dart') ? 'intercept' : phases.some(p => p === 'return' || p === 'land') ? 'return' : phases.every(p => p === 'perched') ? 'rest' : 'patrol';
        return Object.freeze({ tick, lastSeq, scene: options.scene, arc, selected, target,
            members: Object.freeze(members.map(m => Object.freeze({ id: m.id, label: names[m.id], seed: m.model.getOptions().seed,
                role: options.roles[m.id], position: m.position, perch: home(m.id), velocity: m.velocity, heading: m.heading, phase: m.phase, modelTick: m.model.getState().tick }))) });
    }
    function validateEvents(events, nextTick) {
        if (!Array.isArray(events) || events.length > 16)
            throw new RangeError('At most 16 director events per tick');
        let seq = lastSeq;
        for (const event of events) {
            const raw = record(event, 'director event');
            if (event.tick !== nextTick)
                throw new RangeError('Director event tick must match next tick');
            finiteNumber(event.seq, 'seq', 0, Number.MAX_SAFE_INTEGER, true);
            if (event.seq <= seq)
                throw new RangeError('Director sequence must strictly increase');
            seq = event.seq;
            if (event.type === 'pointer') {
                keys(raw, ['type', 'tick', 'seq', 'x', 'y']);
                finiteNumber(event.x, 'pointer.x', -1, 1);
                finiteNumber(event.y, 'pointer.y', -1, 1);
            }
            else if (event.type === 'select') {
                keys(raw, ['type', 'tick', 'seq', 'id']);
                validId(event.id);
            }
            else if (event.type === 'leave')
                keys(raw, ['type', 'tick', 'seq']);
            else if (event.type === 'cue') {
                keys(raw, ['type', 'tick', 'seq', 'cue']);
                if (!['dart', 'perch', 'return'].includes(event.cue))
                    throw new TypeError('Unknown director cue');
            }
            else
                throw new TypeError('Unknown director event');
        }
    }
    const api = {
        getState, getOptions: () => options, getPrimaryState: () => members[0].model.getState(), getModelOptions: () => members[0].model.getOptions(),
        step(nextTick, events = []) {
            alive();
            finiteNumber(nextTick, 'tick', 1, DRAGONFLY_DIRECTOR_LIMITS.maxTick, true);
            if (nextTick !== tick + 1)
                throw new RangeError('Director requires exactly the next integer tick');
            validateEvents(events, nextTick);
            if (paused || api.getModelOptions().motion === 'static')
                return Object.freeze({ kind: 'resting', state: getState(), acceptedCue: false, ignoredCues: events.filter(e => e.type === 'cue').length });
            let acceptedCue = false, ignoredCues = 0;
            for (const event of events) {
                lastSeq = event.seq;
                if (event.type === 'select')
                    selected = event.id;
                else if (event.type === 'pointer')
                    target = v2(event.x, event.y);
                else if (event.type === 'leave')
                    target = null;
                else if (startCue(members[selected], event.cue))
                    acceptedCue = true;
                else
                    ignoredCues++;
            }
            tick = nextTick;
            const pace = options.tempo * (api.getModelOptions().motion === 'slow' ? .25 : 1);
            clock += pace;
            for (const member of members) {
                member.model.step(member.model.getState().tick + 1);
                const plan = member.response ? responseGoal(member, pace) : autonomous(member);
                move(member, plan.goal, plan.phase, pace);
            }
            return Object.freeze({ kind: 'advanced', state: getState(), acceptedCue, ignoredCues });
        },
        configure(patch) {
            alive();
            const next = optionsWith(patch, options);
            const config = api.getModelOptions();
            options = next;
            while (members.length > options.count)
                members.pop().model.dispose();
            while (members.length < options.count)
                add(members.length, config);
            selected = Math.min(selected, members.length - 1);
            return options;
        },
        configureModel(patch) {
            alive();
            const raw = record(patch, 'model patch');
            if (Object.hasOwn(raw, 'seed'))
                throw new TypeError('Use reset(seed)');
            validateDragonflyOptions({ ...api.getModelOptions(), ...patch });
            for (const member of members)
                member.model.configure(patch);
            return api.getModelOptions();
        },
        setPaused(value) { alive(); if (typeof value !== 'boolean')
            throw new TypeError('paused must be boolean'); paused = value; for (const m of members)
            m.model.setPaused(value); },
        selectIndividual(id) { alive(); validId(id); selected = id; },
        setStaticPose(pose) {
            alive();
            if (pose !== 0 && pose !== 1)
                throw new RangeError('static pose must be 0 or 1');
            for (const m of members) {
                m.model.setStaticPose(pose);
                m.position = pose === 0 ? home(m.id) : initial(m.id);
                m.velocity = v2(0, 0);
                m.heading = pose === 0 ? -.18 + m.id * .08 : (m.id % 2 ? .52 : -.42);
                m.phase = phase(pose === 0 ? 'perched' : 'hover');
                m.strength = pose === 0 ? 0 : 1;
                m.wingPhase = m.model.getState().wingPhase;
                m.response = null;
                m.held = false;
            }
            target = null;
        },
        clearTarget() { alive(); target = null; for (const m of members)
            m.model.clearTarget(); },
        reset(nextSeed = seed) {
            alive();
            finiteNumber(nextSeed, 'seed', 0, 0xffffffff, true);
            seed = nextSeed;
            tick = 0;
            lastSeq = -1;
            clock = 0;
            target = null;
            selected = 0;
            for (const m of members) {
                m.model.reset(seedFor(seed, m.id));
                m.position = initial(m.id);
                m.velocity = v2(0, 0);
                m.heading = m.id === 1 ? -.18 : .12;
                m.phase = phase(m.id === 1 ? 'perched' : 'hover');
                m.wingPhase = m.model.getState().wingPhase;
                m.strength = m.id === 1 ? 0 : 1;
                m.response = null;
                m.held = false;
            }
        },
        sample() {
            alive();
            return members.map(m => {
                const state = m.model.getState(), config = m.model.getOptions();
                const geometry = buildDragonflyGeometry({ ...state, position: v2(0, 0), heading: 0, wingPhase: m.wingPhase }, { ...config, motion: 'full', wingAmplitude: config.wingAmplitude * m.strength });
                const scale = options.scale * (1 - m.id * .035), c = Math.cos(m.heading), s = Math.sin(m.heading);
                const transform = (p) => v3(m.position.x + (c * p.x - s * p.y) * scale, m.position.y + (s * p.x + c * p.y) * scale, m.position.z + p.z * scale);
                const mapped = { samples: geometry.samples.map(p => ({ ...p, ...transform(p) })),
                    wings: geometry.wings.map(w => ({ ...w, root: transform(w.root), tip: transform(w.tip) })),
                    eyes: [transform(geometry.eyes[0]), transform(geometry.eyes[1])], abdomenTip: transform(geometry.abdomenTip) };
                return { id: m.id, label: names[m.id], role: options.roles[m.id], phase: m.phase, selected: m.id === selected, position: m.position, perch: home(m.id), geometry: mapped };
            });
        },
        dispose() { if (disposed)
            return; disposed = true; paused = true; for (const m of members)
            m.model.dispose(); },
    };
    return Object.freeze(api);
}
