import type { PufferfishConfig, PufferfishEvent, PufferfishOptions, PufferfishPhase,
  PufferfishPointer, PufferfishState, PufferfishStepResult, PufferfishTick } from './types.js';

export const PUFFERFISH_LIMITS = Object.freeze({ tickRate: 60, maxTick: 2147483647,
  maxSamples: 16000, eventsPerTick: 16, maxCatchUp: 5, spines: 42 });
export const PUFFERFISH_DEFAULTS: PufferfishConfig = Object.freeze({
  seed: 23, approachRadius: 0.30, retreatRadius: 0.42, dwellTicks: 30,
  bellyTicks: 42, spineTicks: 36, holdTicks: 180, recoveryTicks: 150,
  cooldownTicks: 180, inflationScale: 1.65, wobble: 1,
});
const keys = Object.keys(PUFFERFISH_DEFAULTS);
const calmPointer: PufferfishPointer = Object.freeze({ active: false, x: 0, y: 0, aspect: 1 });
const smooth = (t: number): number => t * t * (3 - 2 * t);
// Integrate a bounded release velocity rather than adding wobble to volume.
// The two zero-velocity shelves are the authored "is it safe?" hesitations.
// Symmetry keeps the existing midpoint and duration contract; the integral is
// .66, so default per-tick release remains below 1 / (.66 * 150) < .011.
const releaseKnots = [0, .08, .24, .29, .37, .42, .58, .63, .71, .76, .92, 1] as const;
const releaseSpeeds = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0] as const;
function releasedVolume(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p === 0 || p === .5 || p === 1) return p;
  let area = 0;
  for (let i = 0; i < releaseKnots.length - 1; i++) {
    const start = releaseKnots[i]!, span = releaseKnots[i + 1]! - start;
    const u = Math.max(0, Math.min(1, (p - start) / span));
    const a = releaseSpeeds[i]!, b = releaseSpeeds[i + 1]!;
    // Integral of smoothstep: u³ - u⁴/2. Velocity and acceleration
    // meet continuously at every knot, including both held volumes.
    area += span * (a * u + (b - a) * (u * u * u - .5 * u * u * u * u));
  }
  return Math.max(0, Math.min(1, area / .66));
}
export function finite(value: unknown, low: number, high: number, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
  if (value < low || value > high) throw new RangeError(`${name} must be ${low}..${high}`);
  return value;
}
export function integer(value: unknown, low: number, high: number, name: string): number {
  const result = finite(value, low, high, name);
  if (!Number.isSafeInteger(result)) throw new RangeError(`${name} must be an integer`);
  return result;
}
export function record(value: unknown, allowed: readonly string[], name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`${name}: unknown key ${key}`);
}

/** Reject, never coerce or partially apply, invalid config. Units are ticks / normalized distance. */
export function resolvePufferfishOptions(options: PufferfishOptions = {}): PufferfishConfig {
  record(options, keys, 'options');
  for (const key of Object.keys(options)) if (options[key] === undefined) throw new TypeError(`${key} cannot be undefined`);
  const result = { ...PUFFERFISH_DEFAULTS, ...options };
  integer(result.seed, 0, 0xffffffff, 'seed');
  finite(result.approachRadius, 0.1, 0.6, 'approachRadius');
  finite(result.retreatRadius, 0.15, 0.9, 'retreatRadius');
  if (result.retreatRadius <= result.approachRadius) throw new RangeError('retreatRadius must exceed approachRadius');
  for (const key of ['dwellTicks', 'bellyTicks', 'spineTicks', 'holdTicks', 'recoveryTicks', 'cooldownTicks'] as const)
    integer(result[key], 6, 3600, key);
  finite(result.inflationScale, 1.3, 1.8, 'inflationScale');
  finite(result.wobble, 0, 1, 'wobble');
  return Object.freeze(result);
}
function freezeState(state: PufferfishState): PufferfishState {
  return Object.freeze({ ...state, phase: Object.freeze(state.phase), pointer: Object.freeze(state.pointer) });
}
export function createPufferfish(options: PufferfishOptions = {}): PufferfishState {
  const config = resolvePufferfishOptions(options);
  // One stable integer-derived phase, not a mutable random stream.
  const variation = ((Math.imul(config.seed, 1664525) + 1013904223) >>> 0) / 4294967296 * Math.PI * 2;
  return freezeState({ version: 'pufferfish-v1', config, tick: 0, lastSequence: -1,
    phase: { kind: 'idle' }, pointer: calmPointer, inflation: 0, variation, reactions: 0 });
}

/** Configuration is a new deterministic run. The browser controller preserves its pause policy. */
export function configurePufferfish(state: PufferfishState, patch: PufferfishOptions): PufferfishState {
  record(patch, keys, 'patch');
  return createPufferfish({ ...state.config, ...patch });
}
export function resetPufferfish(state: PufferfishState, seed: number = state.config.seed): PufferfishState {
  return createPufferfish({ ...state.config, seed });
}

function eventsForTick(state: PufferfishState, input: PufferfishTick): {
  pointer: PufferfishPointer; sequence: number; retreat: boolean; approaches: number;
} {
  record(input, ['tick', 'events'], 'tick input');
  integer(state.tick, 0, PUFFERFISH_LIMITS.maxTick - 1, 'state tick');
  if (input.tick !== state.tick + 1) throw new RangeError('tick must be exactly state.tick + 1');
  const events = input.events === undefined ? [] : input.events;
  if (!Array.isArray(events) || events.length > PUFFERFISH_LIMITS.eventsPerTick) throw new RangeError('at most 16 events per tick');
  let pointer = state.pointer, sequence = state.lastSequence, retreat = false, approaches = 0;
  for (const event of events) {
    record(event, event?.type === 'pointer' ? ['type', 'tick', 'seq', 'x', 'y', 'aspect'] : ['type', 'tick', 'seq'], 'event');
    if (event.tick !== input.tick) throw new RangeError('event tick must match the next tick');
    const seq = integer(event.seq, 0, PUFFERFISH_LIMITS.maxTick, 'event seq');
    if (seq <= sequence) throw new RangeError('event seq must strictly increase');
    sequence = seq;
    switch (event.type) {
      case 'pointer':
        pointer = { active: true, x: finite(event.x, -1, 1, 'pointer x'), y: finite(event.y, -1, 1, 'pointer y'),
          aspect: finite(event.aspect, 0.1, 10, 'pointer aspect') };
        break;
      case 'approach': pointer = { active: true, x: 0, y: 0, aspect: 1 }; approaches++; break;
      case 'retreat': retreat = true; break;
      default: throw new TypeError('unknown pufferfish event type');
    }
  }
  return { pointer: retreat ? calmPointer : pointer, sequence, retreat, approaches };
}

/** Pure one-tick update. The complete batch validates before any new state is produced. */
export function stepPufferfish(state: PufferfishState, input: PufferfishTick): PufferfishStepResult {
  if (state.version !== 'pufferfish-v1') throw new TypeError('unsupported species version');
  const batch = eventsForTick(state, input), c = state.config;
  const distance = batch.pointer.active ? Math.hypot(batch.pointer.x * batch.pointer.aspect, batch.pointer.y) : Infinity;
  const near = distance <= c.approachRadius, far = distance >= c.retreatRadius;
  let phase: PufferfishPhase = state.phase, inflation = state.inflation, reactions = state.reactions;
  const recover = (): void => { phase = { kind: 'recovering', age: 0, from: inflation }; };
  switch (phase.kind) {
    case 'idle': if (near) phase = { kind: 'approach', age: 1 }; break;
    case 'approach':
      if (!near) phase = { kind: 'idle' };
      else if (phase.age + 1 >= c.dwellTicks) { phase = { kind: 'inflating', stage: 'belly', age: 0 }; reactions++; }
      else phase = { ...phase, age: phase.age + 1 };
      break;
    case 'inflating': {
      if (far) { recover(); break; }
      const age = phase.age + 1, duration = phase.stage === 'belly' ? c.bellyTicks : c.spineTicks;
      const amount = smooth(Math.min(1, age / duration));
      inflation = phase.stage === 'belly' ? amount * 0.55 : 0.55 + amount * 0.45;
      phase = age >= duration
        ? phase.stage === 'belly' ? { kind: 'inflating', stage: 'spines', age: 0 } : { kind: 'holding', age: 0 }
        : { ...phase, age };
      break;
    }
    case 'holding':
      if (far || phase.age + 1 >= c.holdTicks) recover();
      else phase = { kind: 'holding', age: phase.age + 1 };
      break;
    case 'recovering': {
      const age = phase.age + 1;
      inflation = phase.from * (1 - releasedVolume(age / c.recoveryTicks));
      phase = age >= c.recoveryTicks
        ? { kind: 'cooldown', remaining: c.cooldownTicks, retreated: far }
        : { ...phase, age };
      break;
    }
    case 'cooldown': {
      const remaining = Math.max(0, phase.remaining - 1), retreated = phase.retreated || far;
      phase = remaining === 0 && retreated ? { kind: 'idle' } : { kind: 'cooldown', remaining, retreated };
      break;
    }
  }
  const result = freezeState({ ...state, tick: input.tick, pointer: batch.pointer, lastSequence: batch.sequence, phase, inflation, reactions });
  return Object.freeze({ state: result, transition: phase.kind === state.phase.kind ? null : phase.kind,
    ignoredApproaches: ['recovering', 'cooldown', 'inflating', 'holding'].includes(state.phase.kind) ? batch.approaches : 0 });
}

/** A deliberate static alternative, not an advancement of the running simulation. */
export function pufferfishPoster(state: PufferfishState, inflated: boolean): PufferfishState {
  return freezeState({ ...state, inflation: inflated ? 1 : 0,
    phase: inflated ? { kind: 'holding', age: 0 } : { kind: 'idle' }, pointer: calmPointer });
}
export function describePufferfish(state: PufferfishState): string {
  const details: Record<PufferfishPhase['kind'], string> = {
    idle: 'An oblong, spotted pufferfish drifts with small paddle fins, a pale belly and a short fan tail.',
    approach: 'The pufferfish brakes and watches the visitor before beginning to inflate.',
    inflating: 'The belly rounds out, the spotted skin stretches and fine spines lift from the surface.',
    holding: 'An inflated pufferfish holds its round, guarded shape with tiny fin and gill movements.',
    recovering: 'The pufferfish releases volume in three gentle stages, hesitating twice while its fins keep moving.',
    cooldown: 'The pufferfish regains its oblong shape and rests before drifting away.',
  };
  return details[state.phase.kind];
}

export const PUFFERFISH_REPLAY: readonly PufferfishEvent[] = Object.freeze([
  { tick: 1, seq: 0, type: 'pointer', x: 0.85, y: 0.5, aspect: 16 / 9 },
  { tick: 61, seq: 1, type: 'pointer', x: 0.04, y: 0, aspect: 16 / 9 },
  { tick: 220, seq: 2, type: 'retreat' },
  { tick: 610, seq: 3, type: 'approach' },
  { tick: 780, seq: 4, type: 'retreat' },
].map(event => Object.freeze(event)) as PufferfishEvent[]);
