export const BUTTERFLY_DIRECTOR_DEFAULTS = Object.freeze({
    scene: 'specimen', count: 1, path: 'meadow', roles: Object.freeze([]), sceneSeconds: 32,
    breeze: .2, spread: 1, pointerMode: 'attract', showLabels: false
});
function scene(id, label, description, acts) {
    return Object.freeze({ id, label, description, acts: Object.freeze(acts.map(([id, label]) => Object.freeze({ id, label }))) });
}
export const BUTTERFLY_SCENES = Object.freeze([
    scene('specimen', 'Wing study', 'A close wing study: branching veins, amber cells and pale marginal spots.', [
        ['observe', 'Observe'], ['approach', 'Approach'], ['display', 'Patterned display'], ['settle', 'Settle']
    ]),
    scene('morning', 'First light', 'Warm the wings. Lift into the light. Find a place in the meadow.', [
        ['warm', 'Warm the wings'], ['lift', 'First flight'], ['explore', 'Explore the meadow'], ['settle', 'Settle into sun']
    ]),
    scene('nectar', 'Nectar rounds', 'Visitors inspect a bloom, sip, then take a different route home.', [
        ['arrive', 'Follow the scent'], ['inspect', 'Brake & alight'], ['sip', 'Sip & fan'], ['depart', 'Lift into a glide']
    ]),
    scene('breeze', 'Passing breeze', 'A ribbon of air lifts the garden, then leaves a pocket of quiet.', [
        ['listen', 'Read the air'], ['ride', 'Ride the ribbon'], ['shelter', 'Find shelter'], ['return', 'Return to flowers']
    ]),
    scene('roost', 'Evening roost', 'One last visit, a lantern-like ascent, then folded wings on stems.', [
        ['forage', 'The last forage'], ['ascend', 'Lantern ascent'], ['choose', 'Choose a stem'], ['fold', 'Fold to rest']
    ])
]);
const ROLES = ['auto', 'forager', 'scout', 'basker', 'wanderer'];
const PATHS = ['meadow', 'ribbon', 'spiral'];
const POINTERS = ['attract', 'breeze', 'off'];
const CUES = ['gather', 'breeze', 'rest'];
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (v) => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
const hash = (seed, id, salt) => {
    let v = (seed ^ Math.imul(id + 1, 374761393) ^ Math.imul(salt + 1, 668265263)) >>> 0;
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
};
/** Nested patches merge atomically; arrays are bounded, copied, and frozen. */
export function resolveButterflyDirectorOptions(input = {}, base = BUTTERFLY_DIRECTOR_DEFAULTS) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new TypeError('Butterfly director must be an object');
    for (const key of Object.keys(input))
        if (!Object.hasOwn(BUTTERFLY_DIRECTOR_DEFAULTS, key))
            throw new TypeError(`Unknown butterfly director option ${key}`);
    const value = { ...base };
    for (const key of Object.keys(BUTTERFLY_DIRECTOR_DEFAULTS)) {
        if (input[key] !== undefined)
            Object.defineProperty(value, key, { value: input[key], enumerable: true, writable: true, configurable: true });
    }
    for (const [key, lo, hi] of [['count', 1, 6], ['sceneSeconds', 18, 60], ['breeze', -1, 1], ['spread', .6, 1.25]]) {
        const n = value[key];
        if (typeof n !== 'number' || !Number.isFinite(n) || n < lo || n > hi || (key === 'count' && !Number.isInteger(n)))
            throw new RangeError(`Invalid butterfly director ${key}`);
    }
    if (!BUTTERFLY_SCENES.some(s => s.id === value.scene) || !PATHS.includes(value.path) || !POINTERS.includes(value.pointerMode) || typeof value.showLabels !== 'boolean')
        throw new TypeError('Invalid butterfly director setting');
    if (!Array.isArray(value.roles) || value.roles.length > 6)
        throw new TypeError('Butterfly roles must be an array of at most six roles');
    for (let i = 0; i < value.roles.length; i++)
        if (!Object.hasOwn(value.roles, i) || !ROLES.includes(value.roles[i]))
            throw new TypeError('Invalid butterfly role');
    return Object.freeze({ ...value, roles: Object.freeze([...value.roles]) });
}
/** Normalize a complete public director configuration. */
export function normalizeButterflyDirectorOptions(input = {}) {
    return resolveButterflyDirectorOptions(input, BUTTERFLY_DIRECTOR_DEFAULTS);
}
const FLOWERS = Object.freeze([
    [-.74, .46], [-.44, .62], [-.14, .42], [.17, .58], [.46, .42], [.75, .61]
].map(([x, y], id) => Object.freeze({ id, x: x, y: y })));
const AUTOMATIC = ['forager', 'scout', 'basker', 'wanderer', 'forager', 'scout'];
const LANES = [-.68, -.23, .23, .68, -.45, .45];
const FLOWER_ORDER = [0, 2, 3, 5, 1, 4];
const CUE_TICKS = Object.freeze({ gather: 300, breeze: 300, rest: 420 });
/** Internal engine. Public callers use createButterflyModel / createButterflyArtwork. */
export function createGardenDirector(initial, initialSeed, initialLayout = { columns: 120, rows: 50, scale: 1 }) {
    let options = initial, layout = initialLayout, seed = initialSeed, clock = 0, sceneTime = 0, ticks = 0;
    let pointer = { active: false, x: 0, y: 0 };
    let cue = null;
    let recoveringUntil = 0;
    let actors = [];
    const role = (id) => {
        const configured = options.roles[id];
        return configured && configured !== 'auto' ? configured : AUTOMATIC[id];
    };
    function makeActor(id) {
        return { id, x: options.count === 1 ? 0 : LANES[id], y: -.24 + (id % 2) * .26, heading: 0, opening: .85,
            phase: hash(seed, id, 1) * TAU, size: .9 + hash(seed, id, 2) * .2, activity: Object.freeze({ kind: 'bask' }), contactTick: null };
    }
    function stage() {
        const position = sceneTime / options.sceneSeconds;
        const cycle = Math.floor(position), progress = position - cycle;
        return { cycle, progress, index: Math.min(3, Math.floor(progress * 4)), local: (progress * 4) % 1 };
    }
    function flowerFor(id) {
        const cycle = stage().cycle;
        return FLOWERS[((options.count === 1 ? 2 : FLOWER_ORDER[id]) + cycle) % FLOWERS.length];
    }
    function bodySize(a) {
        const base = options.count === 1 ? .56 : options.count <= 3 ? .44 : options.count === 4 ? .40 : .34;
        const worldW = Math.max(6, 3.7 * layout.columns * .56 / layout.rows), worldH = worldW * layout.rows / (layout.columns * .56);
        return { scale: Math.max(base * a.size * layout.scale, worldW / (layout.columns - 1) * 5.4), worldW, worldH };
    }
    function flight(a, kind = 'flutter') {
        const phase = a.phase, t = clock, lane = options.count === 1 ? 0 : LANES[a.id], r = role(a.id);
        // Short powered bouts gain height, then a held glide uses that height.
        // Identity offsets are seeded; there is no random per-frame flutter.
        const bout = (t + phase / TAU * 3.8) % 3.8, powered = bout < 1.25;
        const activity = kind === 'flutter' ? (powered ? 'flutter' : 'glide') : kind;
        let x = lane * .82 + Math.sin(t * .49 + phase) * .12;
        let y = -.25 + Math.cos(t * .71 + phase) * .13 + (a.id % 2) * .12;
        if (options.path === 'ribbon') {
            x = Math.sin(t * .22 + phase) * .67;
            y = -.22 + Math.sin(t * .44 + phase) * .19 + (a.id % 2) * .08;
        }
        else if (options.path === 'spiral') {
            const angle = t * .34 + phase, radius = .22 + (a.id % 3) * .11;
            x = Math.cos(angle) * radius + lane * .26;
            y = -.19 + Math.sin(angle) * radius * .68;
        }
        if (r === 'scout') {
            y -= .13;
            x += Math.sin(t * .73 + phase) * .07;
        }
        if (r === 'wanderer' && options.path === 'meadow') {
            x = lane * .65 + Math.sin(t * .22 + phase) * .18;
            y = -.19 + Math.cos(t * .3 + phase) * .18;
        }
        y += activity === 'flutter' ? Math.sin(t * 4.2 + phase) * .022 : .018 * smooth((bout - 1.25) / 2.55);
        x = x * options.spread + options.breeze * Math.sin(t * .6 + phase) * .075;
        return { x, y, heading: Math.sin(t * .55 + phase) * .30, activity: Object.freeze({ kind: activity }) };
    }
    function bloom(a, kind, flower = flowerFor(a.id)) {
        const { scale, worldW, worldH } = bodySize(a), inspect = kind === 'inspect';
        const heading = kind === 'nectar' || inspect ? Math.PI + Math.sin(a.phase) * .12 : Math.sin(a.phase) * .12;
        // Match the rendered head and a short uncoiled proboscis to the bloom.
        // This uses the same logical aspect/LOD scale at desktop and phone sizes.
        const reach = .91 * scale;
        return { x: flower.x - Math.sin(heading) * reach * 2 / worldW + (inspect ? Math.sin(clock * .9 + a.phase) * .035 : 0),
            y: flower.y - reach * 2 / worldH - (inspect ? .16 : kind === 'bask' ? .035 : 0), heading,
            activity: kind === 'bask' ? Object.freeze({ kind }) : kind === 'inspect' ? Object.freeze({ kind, target: 'flower', flower: flower.id }) : Object.freeze({ kind, flower: flower.id }) };
    }
    function autonomous(a) {
        const s = stage(), r = role(a.id), flying = flight(a, r === 'wanderer' ? 'glide' : 'flutter');
        if (options.scene === 'specimen')
            return flying;
        if (options.scene === 'morning') {
            if (s.index === 0) {
                if (r === 'scout')
                    return { ...flying, y: flying.y - .10 };
                if (r === 'wanderer')
                    return flight(a, 'glide');
                return bloom(a, r === 'forager' && s.local > .7 ? 'inspect' : 'bask');
            }
            if (s.index === 1) {
                const from = bloom(a, 'bask'), e = smooth(s.local * 1.7 - hash(seed, a.id, 4) * .35);
                return { ...flying, x: mix(from.x, flying.x, e), y: mix(from.y, flying.y, e) };
            }
            if (s.index === 2) {
                if (r === 'basker')
                    return bloom(a, 'bask');
                if (r === 'forager')
                    return bloom(a, s.local < .34 ? 'inspect' : 'nectar');
                return flying;
            }
            return bloom(a, r === 'scout' && s.local < .6 ? 'inspect' : 'bask');
        }
        if (options.scene === 'nectar') {
            if (s.index === 0)
                return r === 'basker' ? bloom(a, 'bask') : flying;
            if (s.index === 1) {
                if (r === 'wanderer' && s.local < .35)
                    return flight(a, 'glide');
                return bloom(a, s.local < .48 ? 'inspect' : r === 'basker' ? 'bask' : 'nectar');
            }
            if (s.index === 2)
                return r === 'scout' && s.local > .65 ? flying : r === 'basker' ? bloom(a, 'bask') : bloom(a, 'nectar');
            if (r === 'basker')
                return bloom(a, 'bask');
            const from = bloom(a, 'nectar');
            if (s.local < .10)
                return { ...from, opening: .32 + .30 * (1 - smooth(s.local / .10)) };
            const e = smooth((s.local - .10) * 1.65), depart = flight(a, s.local < .42 ? 'flutter' : 'glide');
            return { ...depart, x: mix(from.x, depart.x, e), y: mix(from.y, depart.y, e) - Math.sin(e * Math.PI) * .09 };
        }
        if (options.scene === 'breeze') {
            if (s.index === 0)
                return r === 'basker' ? bloom(a, 'bask') : flying;
            if (s.index === 1)
                return { x: (options.count === 1 ? 0 : LANES[a.id]) * .96 + Math.sin(clock * .38 + a.phase) * .06,
                    y: -.32 + Math.cos(clock * .56 + a.id * 1.3) * .16,
                    heading: .32 * Math.sin(clock * .28 + a.phase) + (options.breeze < 0 ? -.16 : .16), activity: Object.freeze({ kind: 'glide' }) };
            if (s.index === 2) {
                const f = flowerFor(a.id);
                return { x: f.x, y: f.y - .12, heading: options.breeze * .3, activity: Object.freeze({ kind: 'shelter' }) };
            }
            return r === 'basker' ? bloom(a, 'bask') : bloom(a, s.local < .45 ? 'inspect' : 'nectar');
        }
        // Evening roost: each visitor chooses a different stem; the final pose is a quiet folded silhouette.
        if (s.index === 0)
            return r === 'scout' ? flying : bloom(a, r === 'basker' ? 'bask' : 'nectar');
        if (s.index === 1)
            return { ...flight(a, 'glide'), x: (options.count === 1 ? 0 : LANES[a.id]) * .92,
                y: -.41 + Math.sin(clock * .5 + a.phase) * .09, heading: Math.sin(clock * .7 + a.phase) * .2 };
        if (s.index === 2)
            return bloom(a, 'inspect');
        return bloom(a, 'perch');
    }
    function aim(a) {
        let result = autonomous(a);
        const r = role(a.id);
        if (cue) {
            const age = ticks - cue.start + cue.offset;
            const duration = CUE_TICKS[cue.kind];
            if (age < duration - 70) {
                if (cue.kind === 'rest')
                    return bloom(a, age < 100 ? 'inspect' : 'perch');
                if (cue.kind === 'breeze') {
                    const origin = cue.origins[a.id] ?? a;
                    const away = cue.repel && Math.abs(origin.x - cue.x) > .08 ? Math.sign(origin.x - cue.x) : (options.breeze < 0 ? -1 : 1);
                    if (age < 24)
                        return { x: origin.x, y: origin.y + .012 * smooth(age / 24), heading: origin.heading + away * .07,
                            opening: .30, rate: .06, activity: Object.freeze({ kind: 'shelter' }) };
                    const escapeX = clamp(origin.x + away * .38, -.73, .73), escapeY = clamp(origin.y - .29, -.51, .33);
                    if (age < 92) {
                        const e = smooth((age - 24) / 68);
                        return { x: mix(origin.x, escapeX, e), y: mix(origin.y, escapeY, e),
                            heading: away * .58, rate: .065, activity: Object.freeze({ kind: 'flutter' }) };
                    }
                    if (age < 170)
                        return { x: clamp(escapeX + away * .06, -.75, .75), y: escapeY + .05 * smooth((age - 92) / 78),
                            heading: away * .24, rate: .04, activity: Object.freeze({ kind: 'glide' }) };
                    const f = flowerFor(a.id), rest = bloom(a, 'perch', f);
                    return { ...rest, heading: options.breeze * .20, activity: Object.freeze({ kind: 'shelter' }) };
                }
                // A deliberate invitation close to a bloom selects that physical bloom.
                // In open air the established invitation semantics remain unchanged.
                if (cue.flower !== null && (r !== 'basker' || options.count === 1)) {
                    const flower = FLOWERS[(cue.flower + a.id) % FLOWERS.length];
                    return bloom(a, age < 60 ? 'inspect' : 'nectar', flower);
                }
                if (r !== 'basker' || options.count === 1) {
                    const angle = a.phase, radius = .12 + (a.id % 2) * .1;
                    return { x: cue.x + Math.cos(angle) * radius, y: cue.y + Math.sin(angle) * radius,
                        heading: Math.atan2(cue.x - a.x, -(cue.y - a.y)), activity: Object.freeze({ kind: 'inspect', target: 'invitation' }) };
                }
            }
            else
                result = { ...result, activity: Object.freeze({ kind: 'recover' }) };
        }
        else if (pointer.active && options.pointerMode !== 'off') {
            const distance = Math.hypot(pointer.x - a.x, pointer.y - a.y);
            if (options.pointerMode === 'attract' && distance < .74 && (r === 'forager' || r === 'scout' || options.count === 1)) {
                result = { x: pointer.x + Math.cos(a.phase) * .15, y: pointer.y - .12 + Math.sin(a.phase) * .09,
                    heading: Math.atan2(pointer.x - a.x, -(pointer.y - a.y)), activity: Object.freeze({ kind: 'inspect', target: 'invitation' }) };
            }
            else if (options.pointerMode === 'breeze' && distance < .9) {
                result = { x: result.x + (a.x - pointer.x) * .26, y: result.y - .15,
                    heading: clamp((a.x - pointer.x) * .7, -.7, .7), activity: Object.freeze({ kind: 'glide' }) };
            }
        }
        else if (ticks < recoveringUntil)
            result = { ...result, activity: Object.freeze({ kind: 'recover' }) };
        return result;
    }
    function open(a, kind) {
        const beat = .5 + .5 * Math.cos(clock * (8.5 + hash(seed, a.id, 7) * 1.1) + a.phase);
        switch (kind) {
            case 'perch': return .28 + .025 * Math.cos(clock * .6 + a.phase);
            case 'shelter': return .30;
            case 'bask': return .87 + .10 * Math.sin(clock * .45 + a.phase);
            case 'glide': return .94 + .035 * Math.sin(clock * .8 + a.phase);
            case 'nectar': {
                const age = a.contactTick === null ? 0 : ticks - a.contactTick;
                // Landing damping first; a slow fan breathes while feet and root hold.
                if (age < 30)
                    return mix(.74, .40, smooth(age / 30));
                return .42 + .49 * (.5 + .5 * Math.sin((age - 30) / 60 * 2.35 - Math.PI * .5));
            }
            case 'inspect': return .38 + beat * .57;
            default: return .30 + beat * .68;
        }
    }
    function pose(snap = false) {
        const aims = actors.map(aim);
        // A bounded personal-space nudge keeps passing wings readable without making a rigid formation.
        if (!snap)
            for (let i = 0; i < actors.length; i++)
                for (let j = i + 1; j < actors.length; j++) {
                    const a = actors[i], b = actors[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
                    if (d < .22) {
                        const push = (.22 - d) * .18, ux = d > .001 ? dx / d : (i % 2 ? -1 : 1), uy = d > .001 ? dy / d : 0;
                        aims[i].x += ux * push;
                        aims[j].x -= ux * push;
                        aims[i].y += uy * push;
                        aims[j].y -= uy * push;
                    }
                }
        for (let i = 0; i < actors.length; i++) {
            const a = actors[i], target = aims[i], rate = target.rate ?? (target.activity.kind === 'nectar' || target.activity.kind === 'perch' ? .065 : .045);
            const tx = clamp(target.x, -.78, .78), ty = clamp(target.y, -.56, .51);
            const dx = (tx - a.x) * rate, dy = (ty - a.y) * rate, distance = Math.hypot(dx, dy);
            // A new flower at the cycle seam cannot create a long one-tick jump.
            const step = distance > .07 ? .07 / distance : 1;
            a.x = snap ? tx : a.x + dx * step;
            a.y = snap ? ty : a.y + dy * step;
            const delta = Math.atan2(Math.sin(target.heading - a.heading), Math.cos(target.heading - a.heading));
            a.heading = snap ? target.heading : a.heading + delta * .04;
            const landing = target.activity.kind === 'nectar' || target.activity.kind === 'perch';
            const aligned = Math.abs(delta) < .20, near = Math.hypot(a.x - target.x, a.y - target.y) < .025;
            if (landing && (snap || (near && aligned))) {
                if (a.contactTick === null)
                    a.contactTick = ticks;
                a.activity = target.activity;
            }
            else {
                a.contactTick = null;
                a.activity = landing && 'flower' in target.activity ? Object.freeze({ kind: 'inspect', target: 'flower', flower: target.activity.flower }) : target.activity;
            }
            const opening = target.opening ?? open(a, a.activity.kind);
            a.opening = snap ? opening : mix(a.opening, opening, .30);
        }
    }
    function reset() { clock = 0; sceneTime = 0; ticks = 0; cue = null; pointer = { active: false, x: 0, y: 0 }; recoveringUntil = 0; actors = Array.from({ length: options.count }, (_, id) => makeActor(id)); pose(true); }
    reset();
    return Object.freeze({
        step(speed) { ticks++; clock += speed / 60; sceneTime += speed / 60; if (cue && ticks - cue.start + cue.offset >= CUE_TICKS[cue.kind])
            cue = null; pose(); },
        configure(next, nextSeed, nextLayout = layout) {
            const sceneChanged = next.scene !== options.scene, seedChanged = seed !== nextSeed;
            if (!sceneChanged && next.sceneSeconds !== options.sceneSeconds)
                sceneTime = sceneTime / options.sceneSeconds * next.sceneSeconds;
            options = next;
            seed = nextSeed;
            layout = nextLayout;
            if (seedChanged) {
                reset();
                return;
            }
            if (sceneChanged) {
                sceneTime = 0;
                cue = null;
                pointer = { active: false, x: 0, y: 0 };
                recoveringUntil = 0;
            }
            actors = Array.from({ length: options.count }, (_, id) => actors[id] ?? makeActor(id));
            // Keep surviving identities/positions; update roles and visible poses immediately.
            if (sceneChanged)
                pose(true);
            else
                for (const a of actors) {
                    const target = aim(a);
                    if (target.activity.kind !== 'nectar' && target.activity.kind !== 'perch')
                        a.activity = target.activity;
                }
        },
        guide(x, y) { pointer = { active: true, x, y }; },
        release(cancelCue = true) { if (pointer.active || (cue && cancelCue))
            recoveringUntil = ticks + 90; pointer = { active: false, x: 0, y: 0 }; if (cancelCue)
            cue = null; },
        cue(kind, poster = false) {
            if (!CUES.includes(kind))
                throw new TypeError('Invalid butterfly cue');
            if (cue?.kind === kind && !poster)
                return;
            const offered = FLOWERS[(stage().cycle + 2) % FLOWERS.length];
            const x = pointer.active ? pointer.x : kind === 'gather' ? offered.x : 0, y = pointer.active ? pointer.y : kind === 'gather' ? offered.y : -.14;
            const nearest = FLOWERS.reduce((a, b) => Math.hypot(b.x - x, b.y - y) < Math.hypot(a.x - x, a.y - y) ? b : a);
            cue = Object.freeze({ kind, start: ticks, offset: poster ? kind === 'breeze' ? 170 : 120 : 0, x, y,
                flower: kind === 'gather' && Math.hypot(nearest.x - x, nearest.y - y) < .13 ? nearest.id : null, repel: pointer.active,
                origins: Object.freeze(actors.map(a => Object.freeze({ x: a.x, y: a.y, heading: a.heading }))) });
            if (poster)
                pose(true);
            else
                for (const a of actors) {
                    const target = aim(a);
                    a.activity = (target.activity.kind === 'nectar' || target.activity.kind === 'perch') ? Object.freeze({ kind: 'inspect', target: 'flower', flower: target.activity.flower }) : target.activity;
                }
        },
        nextAct(poster = false) {
            const s = stage();
            sceneTime = (s.cycle + (s.index === 3 ? 1 : 0) + (s.index + 1) % 4 / 4) * options.sceneSeconds + .000001;
            cue = null;
            recoveringUntil = 0;
            pointer = { active: false, x: 0, y: 0 };
            // Jumping acts is an explicit composition edit. Live changes ease; still changes select a tableau.
            if (poster)
                pose(true);
            else
                for (const a of actors) {
                    const target = aim(a);
                    a.activity = (target.activity.kind === 'nectar' || target.activity.kind === 'perch') ? Object.freeze({ kind: 'inspect', target: 'flower', flower: target.activity.flower }) : target.activity;
                }
        },
        still() { pose(true); }, reset,
        getState() {
            const s = stage(), description = BUTTERFLY_SCENES.find(item => item.id === options.scene), act = description.acts[s.index];
            const baseScale = options.count === 1 ? .56 : options.count <= 3 ? .44 : options.count === 4 ? .40 : .34;
            return Object.freeze({ scene: options.scene, act: act.id, actLabel: act.label, actIndex: s.index, progress: s.progress, cycle: s.cycle, clock,
                cue: cue?.kind ?? 'none', pointer: Object.freeze({ ...pointer }), flowers: FLOWERS,
                members: Object.freeze(actors.map(a => Object.freeze({ id: a.id, role: role(a.id), activity: a.activity,
                    x: a.x, y: a.y, heading: a.heading, opening: clamp(a.opening, .25, 1), phase: a.phase, scale: baseScale * a.size }))) });
        }
    });
}
//# sourceMappingURL=director.js.map