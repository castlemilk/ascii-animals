import { createPufferfish, finite, integer, pufferfishPoster, PUFFERFISH_LIMITS,
  record, resolvePufferfishOptions, stepPufferfish } from './model.js';
import type { PufferfishInput, PufferfishOptions } from './types.js';
import type { PufferfishActor, PufferfishDirectorConfig, PufferfishDirectorInput,
  PufferfishDirectorOptions, PufferfishDirectorResult, PufferfishDirectorState,
  PufferfishDirectorTick, PufferfishMotive, PufferfishRole, PufferfishSceneBeat } from './director-types.js';

export const PUFFERFISH_DIRECTOR_LIMITS = Object.freeze({ maxActors: 3, eventsPerTick: 16,
  sceneTicks: 1200, retreatTicks: 240, invitationTicks: 360, maxSamples: 16000,
  maxVelocityX: 0.004, maxVelocityY: 0.003 });
const roles: readonly PufferfishRole[] = Object.freeze(['explorer', 'sentinel', 'drifter']);
const names = ['Pip', 'Moss', 'Miso'] as const;
export const PUFFERFISH_DIRECTOR_DEFAULTS: PufferfishDirectorConfig = Object.freeze({
  scene: 'reef', count: 2, tempo: 1, current: 0.35, curiosity: 0.75, spacing: 1,
  size: 1, labels: true, roles: Object.freeze(roles.slice(0, 2)),
});
const keys = Object.keys(PUFFERFISH_DIRECTOR_DEFAULTS);
const clamp = (v: number, low: number, high: number): number => Math.max(low, Math.min(high, v));
const smooth = (v: number): number => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };

/** Every option validates before a new run is allocated. No coercion or silent clamping. */
export function resolvePufferfishDirectorOptions(options: PufferfishDirectorOptions = {}): PufferfishDirectorConfig {
  record(options, keys, 'director options');
  for (const key of Object.keys(options)) if (options[key] === undefined) throw new TypeError(`${key} cannot be undefined`);
  const c = { ...PUFFERFISH_DIRECTOR_DEFAULTS, ...options };
  if (!['reef', 'current', 'shadow'].includes(c.scene)) throw new TypeError('invalid pufferfish scene');
  integer(c.count, 1, 3, 'count'); finite(c.tempo, 0.5, 1.5, 'tempo');
  finite(c.current, -1, 1, 'current'); finite(c.curiosity, 0, 1, 'curiosity');
  finite(c.spacing, 0.8, 1.2, 'spacing'); finite(c.size, 0.8, 1.1, 'size');
  if (typeof c.labels !== 'boolean') throw new TypeError('labels must be boolean');
  const selectedRoles = options.roles === undefined ? roles.slice(0, c.count) : options.roles;
  if (!Array.isArray(selectedRoles) || selectedRoles.length !== c.count) throw new RangeError('roles must contain exactly count entries');
  for (const role of selectedRoles) if (!roles.includes(role)) throw new TypeError('invalid pufferfish role');
  return Object.freeze({ ...c, roles: Object.freeze([...selectedRoles]) });
}
function beatAt(scene: PufferfishDirectorConfig['scene'], t: number): PufferfishSceneBeat {
  if (scene === 'shadow') {
    if (t < 240) return { scene, kind: 'watch', progress: t / 240 };
    if (t < 540) return { scene, kind: 'shadow', progress: (t - 240) / 300 };
    if (t < 840) return { scene, kind: 'release', progress: (t - 540) / 300 };
    return { scene, kind: 'resume', progress: (t - 840) / 360 };
  }
  const index = Math.min(3, Math.floor(t / 300)), progress = t % 300 / 300;
  return scene === 'reef'
    ? { scene, kind: (['discover', 'inspect', 'gather', 'rest'] as const)[index]!, progress }
    : { scene, kind: (['rising', 'shelter', 'returning', 'slack'] as const)[index]!, progress };
}
function flowAt(c: PufferfishDirectorConfig, beat: PufferfishSceneBeat): number {
  if (beat.scene !== 'current') return c.current * 0.2;
  const p = smooth(beat.progress);
  const strength = beat.kind === 'rising' ? 0.15 + 0.85 * p : beat.kind === 'shelter' ? 1
    : beat.kind === 'returning' ? 1 - 0.85 * p : 0.15;
  return c.current * strength;
}
function anchor(c: PufferfishDirectorConfig, id: number): number {
  return c.count === 1 ? 0 : (id - (c.count - 1) / 2) * (c.count === 2 ? 0.76 : 0.52) * c.spacing;
}
function actorScale(c: PufferfishDirectorConfig): number {
  return (c.count === 1 ? 0.86 : c.count === 2 ? 0.66 : 0.54) * c.size;
}
const horizontalLimit = (scale: number): number => 1 - 2.24 * scale * (2 / 5.2) - 0.035;
function freezeActor(actor: PufferfishActor): PufferfishActor {
  return Object.freeze({ ...actor, gaze: Object.freeze(actor.gaze) });
}
function freeze(state: PufferfishDirectorState): PufferfishDirectorState {
  return Object.freeze({ ...state, beat: Object.freeze(state.beat), actors: Object.freeze(state.actors.map(freezeActor)),
    pointer: state.pointer && Object.freeze(state.pointer), invitation: state.invitation && Object.freeze(state.invitation),
    approach: state.approach && Object.freeze(state.approach) });
}

export function createPufferfishDirector(options: PufferfishDirectorOptions = {}, species: PufferfishOptions = {}): PufferfishDirectorState {
  const config = resolvePufferfishDirectorOptions(options), speciesConfig = resolvePufferfishOptions(species);
  const beat = beatAt(config.scene, 0);
  const actors = Array.from({ length: config.count }, (_, id): PufferfishActor => ({
    id, name: names[id]!, role: config.roles[id]!, motive: config.roles[id] === 'sentinel' ? 'watching' : 'exploring',
    state: createPufferfish({ ...speciesConfig, seed: (speciesConfig.seed + Math.imul(id, 2654435761)) >>> 0 }),
    x: clamp(anchor(config, id), -horizontalLimit(actorScale(config)), horizontalLimit(actorScale(config))),
    y: id % 2 ? -0.1 : 0.06, vx: 0, vy: 0, scale: actorScale(config),
    yaw: 0, gaze: { x: 0, y: 0 }, finEffort: 0.2, threat: 0,
  }));
  return freeze({ version: 'pufferfish-director-v1', config, speciesConfig, tick: 0, lastSequence: -1,
    sceneTick: 0, cycle: 0, beat, actors, selected: 0, pointer: null, invitation: null, approach: null,
    quietUntil: 0, shadowCycle: -1, flow: flowAt(config, beat) });
}
export function configurePufferfishDirector(state: PufferfishDirectorState, patch: PufferfishDirectorOptions): PufferfishDirectorState {
  record(patch, keys, 'director patch');
  for (const key of Object.keys(patch)) if (patch[key] === undefined) throw new TypeError(`${key} cannot be undefined`);
  const count = patch.count === undefined ? state.config.count : integer(patch.count, 1, 3, 'count');
  const next: PufferfishDirectorOptions = { ...state.config, ...patch,
    ...(count !== state.config.count && patch.roles === undefined ? { roles: roles.slice(0, count) } : {}) };
  return createPufferfishDirector(next, state.speciesConfig);
}
export function resetPufferfishDirector(state: PufferfishDirectorState, seed: number = state.speciesConfig.seed): PufferfishDirectorState {
  return createPufferfishDirector(state.config, { ...state.speciesConfig, seed });
}
/** Focus changes do not advance the scene clock. Replay consumers can instead use a select event. */
export function selectPufferfishActor(state: PufferfishDirectorState, id: number): PufferfishDirectorState {
  integer(id, 0, state.config.count - 1, 'actor id');
  return freeze({ ...state, selected: id });
}

function batchFor(state: PufferfishDirectorState, input: PufferfishDirectorTick): {
  selected: number; pointer: PufferfishDirectorState['pointer']; invitation: PufferfishDirectorState['invitation'];
  approach: PufferfishDirectorState['approach']; sequence: number; retreat: boolean;
} {
  record(input, ['tick', 'events'], 'director tick');
  integer(state.tick, 0, PUFFERFISH_LIMITS.maxTick - 1, 'state tick');
  if (input.tick !== state.tick + 1) throw new RangeError('tick must be exactly state.tick + 1');
  const events = input.events === undefined ? [] : input.events;
  if (!Array.isArray(events) || events.length > 16) throw new RangeError('at most 16 director events per tick');
  let selected = state.selected, pointer = state.pointer, invitation = state.invitation,
    approach = state.approach, sequence = state.lastSequence, retreat = false;
  for (const event of events) {
    const allowed = event?.type === 'pointer' ? ['type', 'tick', 'seq', 'x', 'y', 'aspect']
      : event?.type === 'invite' ? ['type', 'tick', 'seq', 'x', 'y']
      : event?.type === 'select' ? ['type', 'tick', 'seq', 'id'] : ['type', 'tick', 'seq'];
    record(event, allowed, 'director event');
    if (event.tick !== input.tick) throw new RangeError('event tick must match next tick');
    const seq = integer(event.seq, 0, PUFFERFISH_LIMITS.maxTick, 'event seq');
    if (seq <= sequence) throw new RangeError('event seq must strictly increase');
    sequence = seq;
    switch (event.type) {
      case 'pointer': pointer = { x: finite(event.x, -1, 1, 'pointer x'), y: finite(event.y, -1, 1, 'pointer y'),
        aspect: finite(event.aspect, 0.1, 10, 'pointer aspect') }; break;
      case 'select': selected = integer(event.id, 0, state.config.count - 1, 'actor id'); break;
      case 'invite': invitation = { id: selected, x: finite(event.x, -1, 1, 'invite x'),
        y: finite(event.y, -1, 1, 'invite y'), until: input.tick + PUFFERFISH_DIRECTOR_LIMITS.invitationTicks }; pointer = null; approach = null; break;
      case 'approach': approach = { id: selected, until: input.tick + state.speciesConfig.dwellTicks
        + state.speciesConfig.bellyTicks + state.speciesConfig.spineTicks + state.speciesConfig.holdTicks }; invitation = null; break;
      case 'retreat': retreat = true; break;
      default: throw new TypeError('unknown pufferfish director event');
    }
  }
  return { selected, pointer: retreat ? null : pointer, invitation: retreat ? null : invitation,
    approach: retreat ? null : approach, sequence, retreat };
}

function targetFor(actor: PufferfishActor, state: PufferfishDirectorState, beat: PufferfishSceneBeat,
  sceneTick: number, flow: number): { x: number; y: number; motive: PufferfishMotive } {
  const c = state.config, a = anchor(c, actor.id), t = sceneTick / 60, v = actor.state.variation;
  const wander = (actor.role === 'explorer' ? 0.11 : actor.role === 'drifter' ? 0.07 : 0.035) * (0.35 + c.curiosity * 0.65);
  let x = a + Math.sin(t * 0.55 + v) * wander,
    y = Math.sin(t * 0.7 + v) * (actor.role === 'sentinel' ? 0.055 : 0.13),
    motive: PufferfishMotive = actor.role === 'sentinel' ? 'watching' : 'exploring';
  if (beat.scene === 'reef') {
    const home = a + Math.sin(v) * .025, station = a * .70 + Math.cos(v) * .04;
    const p = beat.progress;
    // Travel, brake, inspect and back away are one authored route. Position
    // and target velocity meet at each beat; roles keep distinct excursion size.
    if (beat.kind === 'discover') {
      const seek = smooth(p);
      x = home + (station - home) * seek + Math.sin(Math.PI * p) ** 2 * wander;
      y = .02 + .13 * seek - .045 * Math.sin(Math.PI * p) ** 2;
    }
    if (beat.kind === 'inspect') {
      const dip = Math.sin(Math.PI * p) ** 2;
      x = station + Math.sin(p * Math.PI * 2) * .018 * dip;
      y = .15 + dip * (actor.role === 'sentinel' ? .035 : .085);
      motive = actor.role === 'sentinel' ? 'watching' : 'inspecting';
    }
    if (beat.kind === 'gather') {
      const withdraw = smooth(p);
      x = station + (home - station) * withdraw;
      y = .15 - .13 * withdraw - .035 * Math.sin(Math.PI * p) ** 2;
      motive = 'settling';
    }
    if (beat.kind === 'rest') {
      x = home; y = .02 + Math.sin(Math.PI * p) ** 2 * .012;
      motive = 'settling';
    }
  } else if (beat.scene === 'current') {
    x += flow * (actor.role === 'drifter' ? 0.12 : -0.10);
    y -= Math.abs(flow) * 0.12;
    if (beat.kind === 'shelter') { x = a - flow * 0.06; y = 0.25 + actor.id % 2 * 0.03; motive = 'sheltering'; }
    if (beat.kind === 'returning') { y = 0.25 - 0.44 * smooth(beat.progress); motive = 'exploring'; }
    if (beat.kind === 'slack') { y = 0.02 + Math.sin(t + v) * 0.10; motive = 'settling'; }
  } else {
    if (beat.kind === 'watch') { y -= 0.09; motive = 'watching'; }
    if (beat.kind === 'shadow') { y = actor.role === 'sentinel' ? -0.12 : 0.25; motive = actor.role === 'sentinel' ? 'watching' : 'sheltering'; }
    if (beat.kind === 'release') { y = 0.18; motive = 'settling'; }
  }
  return { x, y, motive };
}

/** One explicit 60 Hz tick; choreography tempo never accelerates the inflation safety model. */
export function stepPufferfishDirector(state: PufferfishDirectorState, input: PufferfishDirectorTick): PufferfishDirectorResult {
  if (state.version !== 'pufferfish-director-v1') throw new TypeError('unsupported director version');
  const batch = batchFor(state, input), c = state.config;
  const absolute = state.sceneTick + c.tempo, wrapped = absolute >= 1200;
  const sceneTick = absolute % 1200, cycle = state.cycle + Number(wrapped), beat = beatAt(c.scene, sceneTick);
  const flow = flowAt(c, beat), quietUntil = batch.retreat ? input.tick + 240 : state.quietUntil;
  let shadowCycle = state.shadowCycle, approach = batch.approach;
  if (approach && approach.until <= input.tick) approach = null;
  const invitation = batch.invitation && batch.invitation.until > input.tick ? batch.invitation : null;
  if (beat.kind === 'shadow' && shadowCycle !== cycle) {
    shadowCycle = cycle; // A canceled shadow is consumed; it cannot rearm later in this arc.
    if (!batch.retreat && input.tick >= quietUntil && !approach) {
      const sentinel = state.actors.find(actor => actor.role === 'sentinel')?.id ?? 0;
      approach = { id: sentinel, until: input.tick + Math.ceil((540 - sceneTick) / c.tempo) };
    }
  }
  const pointer = batch.pointer;
  let nearest = -1, distance = Infinity;
  if (pointer) for (const actor of state.actors) {
    const d = Math.hypot((pointer.x - actor.x) * pointer.aspect, pointer.y - actor.y) / actor.scale;
    if (d < distance) { distance = d; nearest = actor.id; }
  }
  const reacted: number[] = [];
  const actors = state.actors.map((actor): PufferfishActor => {
    const target = targetFor(actor, state, beat, sceneTick, flow);
    const explicitApproach = approach?.id === actor.id;
    const near = pointer !== null && nearest === actor.id && distance <= state.speciesConfig.approachRadius * 0.75;
    let modelInput: PufferfishInput = { type: 'retreat' };
    if (!batch.retreat && (explicitApproach || near)) modelInput = { type: 'pointer', x: 0, y: 0, aspect: 1 };
    const next = stepPufferfish(actor.state, { tick: input.tick, events: [{ ...modelInput, tick: input.tick, seq: actor.state.lastSequence + 1 }] }).state;
    if (next.reactions > actor.state.reactions) reacted.push(actor.id);
    const defensive = next.phase.kind === 'approach' || next.phase.kind === 'inflating' || next.phase.kind === 'holding';
    let inspection = 0;
    if (invitation?.id === actor.id && !defensive) {
      // Notice/brake -> tentative approach -> inspect -> release. The first
      // half-second stays put; gaze acknowledges the invitation immediately.
      const elapsed = PUFFERFISH_DIRECTOR_LIMITS.invitationTicks - (invitation.until - input.tick);
      const seek = smooth((elapsed - 30) / 90), release = smooth((elapsed - 312) / 48);
      inspection = seek * (1 - release);
      const personalSpace = 0.14 + (1 - c.curiosity) * 0.1;
      const side = anchor(c, actor.id) < invitation.x ? -1 : 1;
      const inspectX = invitation.x + side * personalSpace;
      const inspectY = invitation.y + .1 + Math.sin(Math.PI * clamp((elapsed - 120) / 192, 0, 1)) ** 2 * .018;
      target.x = elapsed < 30 ? actor.x : target.x * (1 - inspection) + inspectX * inspection;
      target.y = elapsed < 30 ? actor.y : target.y * (1 - inspection) + inspectY * inspection;
      target.motive = 'invited';
    } else if (pointer && nearest === actor.id && !defensive && c.curiosity > 0) {
      const d = Math.hypot(pointer.x - actor.x, pointer.y - actor.y);
      if (d > 0.2 && d < 0.65) {
        const interest = c.curiosity * 0.6;
        target.x += (pointer.x - target.x) * interest;
        target.y += (pointer.y - target.y) * interest;
        target.motive = 'inspecting';
      }
    }
    if (defensive) {
      // A close approach first brakes then yields a short recoil away from the
      // threat. Holding stays anchored instead of continually drifting upward.
      const notice = next.phase.kind === 'approach' ? Math.sin(Math.PI * next.phase.age / next.config.dwellTicks) : 0;
      const away = pointer ? (pointer.x > actor.x ? -1 : 1) : actor.id % 2 ? 1 : -1;
      target.x = actor.x + away * .055 * notice;
      target.y = actor.y + .025 * notice;
      target.motive = 'defensive';
    }
    if (next.phase.kind === 'recovering') {
      // Stay with the hesitant deflation instead of setting off mid-recovery.
      target.x = actor.x; target.y = actor.y; target.motive = 'settling';
    } else if (next.phase.kind === 'cooldown') {
      const release = smooth(1 - next.phase.remaining / next.config.cooldownTicks);
      target.x = actor.x + (target.x - actor.x) * release;
      target.y = actor.y + (target.y - actor.y) * release;
      target.motive = 'settling';
    }
    // The shared screen projection has its largest horizontal extent on a square viewport.
    // Keep the largest supported inflated silhouette inside that envelope.
    const maxX = horizontalLimit(actor.scale);
    target.x = clamp(target.x, -maxX, maxX); target.y = clamp(target.y, -0.27, 0.28);
    const braking = defensive || next.phase.kind === 'recovering'
      || invitation?.id === actor.id && invitation.until - input.tick > PUFFERFISH_DIRECTOR_LIMITS.invitationTicks - 30;
    const drag = braking ? .68 : .88;
    const vx = clamp(actor.vx * drag + (target.x - actor.x) * .008, -.004, .004);
    const vy = clamp(actor.vy * drag + (target.y - actor.y) * .008, -.003, .003);
    const x = clamp(actor.x + vx, -maxX, maxX), y = clamp(actor.y + vy, -0.28, 0.29);
    const focus = pointer ?? (invitation?.id === actor.id ? invitation : target);
    const gazeX = clamp((focus.x - x) * 3, -1, 1), gazeY = clamp((focus.y - y) * 3, -1, 1);
    const threat = next.phase.kind === 'approach' ? next.phase.age / next.config.dwellTicks * 0.35
      : defensive ? 0.35 + next.inflation * 0.65 : next.inflation * 0.65;
    return { ...actor, state: next, x, y, vx, vy, motive: target.motive, threat,
      gaze: { x: actor.gaze.x + (gazeX - actor.gaze.x) * 0.1, y: actor.gaze.y + (gazeY - actor.gaze.y) * 0.1 },
      yaw: clamp(actor.yaw * .96 + vx * 5 + flow * .004 + gazeX * .0025 * (inspection || (target.motive === 'inspecting' ? .6 : 0)), -.38, .38),
      finEffort: clamp(Math.hypot(vx, vy) * 100 + Math.abs(flow) * .45
        + (next.phase.kind === 'approach' ? .42 : defensive ? .10 : .15) + inspection * .08, 0, 1) };
  });
  const nextState = freeze({ ...state, tick: input.tick, lastSequence: batch.sequence, sceneTick, cycle, beat,
    actors, selected: batch.selected, pointer, invitation, approach, quietUntil, shadowCycle, flow });
  return Object.freeze({ state: nextState, beatChanged: beat.kind !== state.beat.kind || wrapped,
    reacted: Object.freeze(reacted) });
}

/** Deliberate still alternative: one selected defensive fish, or a settled whole reef. */
export function pufferfishDirectorPoster(state: PufferfishDirectorState, inflated: boolean): PufferfishDirectorState {
  return freeze({ ...state, pointer: null, invitation: null, approach: null,
    actors: state.actors.map(actor => ({ ...actor,
      state: pufferfishPoster(actor.state, inflated && actor.id === state.selected),
      threat: inflated && actor.id === state.selected ? 1 : 0,
      motive: inflated && actor.id === state.selected ? 'defensive' : 'settling', vx: 0, vy: 0, finEffort: 0,
    })) });
}
export function describePufferfishDirector(state: PufferfishDirectorState): string {
  const beats: Record<PufferfishSceneBeat['kind'], string> = {
    discover: 'Reef drift: small fin strokes carry each visitor toward a discovery.',
    inspect: 'The visitors brake, hover and dip toward the reef to inspect it.',
    gather: 'Inspection over: the visitors back away and turn into open water.',
    rest: 'An easy drift: fins soften before the next discovery.',
    rising: 'The tide builds: fins paddle and bodies lean into the current.',
    shelter: 'Shelter behind the coral: each visitor finds a calmer pocket.',
    returning: 'The current eases: the visitors emerge from shelter.',
    slack: 'Slack water: the reef drifts into an easy rhythm.',
    watch: 'A watchful reef: bright eyes follow the water overhead.',
    shadow: 'A passing shadow: one sentinel inflates while companions find shelter.',
    release: 'The shadow passes: the belly releases in stages, hesitates, then settles.',
    resume: 'Confidence returns: small explorations begin again.',
  };
  const selected = state.actors[state.selected]!;
  return `${beats[state.beat.kind]} ${selected.name}, the ${selected.role}, is ${selected.motive}.`;
}
