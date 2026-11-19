import { buildOwlGeometry } from './geometry.js';
import type { OwlBehavior, OwlConfig, OwlCycle, OwlInput, OwlInstance, OwlOptions, OwlOptionsPatch, OwlPoster, OwlState, OwlStepResult, OwlTarget } from './types.js';

export const OWL_VERSION = 1 as const;
export const OWL_LIMITS = Object.freeze({ tickRate: 60, maxTick: 0x7fffffff, eventsPerTick: 16, maxSurfaces: 96 });
export const OWL_DEFAULTS: OwlConfig = Object.freeze({
  schemaVersion: 1, seed: 7, headYawLimitDeg: 34, headPitchLimitDeg: 12,
  attentionSmoothing: .1, idleAmplitude: .3, reactionStrength: .85,
  featherContrast: .55, blinkIntervalTicks: 240, blinkTicks: 18,
  ruffleTicks: 36, stretchTicks: 60, recoveryTicks: 48, cooldownTicks: 120,
});

const limits: Readonly<Record<Exclude<keyof OwlConfig, 'schemaVersion'>, readonly [number, number, boolean]>> = {
  seed: [0, 0xffffffff, true], headYawLimitDeg: [0, 45, false], headPitchLimitDeg: [0, 20, false],
  attentionSmoothing: [.01, .25, false], idleAmplitude: [0, 1, false], reactionStrength: [0, 1, false],
  featherContrast: [0, 1, false], blinkIntervalTicks: [120, 1200, true], blinkTicks: [12, 60, true],
  ruffleTicks: [18, 120, true], stretchTicks: [36, 180, true], recoveryTicks: [24, 180, true], cooldownTicks: [30, 600, true],
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
function finite(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
  return value;
}
function integer(value: unknown, lo: number, hi: number, name: string): number {
  const n = finite(value, name);
  if (!Number.isSafeInteger(n) || n < lo || n > hi) throw new RangeError(`${name} must be an integer in ${lo}..${hi}`);
  return n;
}
function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value as Record<string, unknown>;
}

/** Unknown keys and invalid values reject before state changes. No coercion. */
export function resolveOwlOptions(options: OwlOptions = {}): OwlConfig {
  return mergeOptions(options, OWL_DEFAULTS);
}
/** The base is private and already validated; callers cannot inject an unchecked base. */
function mergeOptions(options: OwlOptions, base: OwlConfig): OwlConfig {
  const input = record(options, 'Owl options');
  const next = { ...base };
  for (const [key, value] of Object.entries(input)) {
    if (key === 'schemaVersion') {
      if (value !== 1) throw new RangeError('Owl schemaVersion must be 1');
      continue;
    }
    if (!Object.hasOwn(limits, key)) throw new TypeError(`Unknown Owl option: ${key}`);
    const k = key as Exclude<keyof OwlConfig, 'schemaVersion'>;
    const [lo, hi, whole] = limits[k];
    const n = whole ? integer(value, lo, hi, key) : finite(value, key);
    if (n < lo || n > hi) throw new RangeError(`${key} must be in ${lo}..${hi}`);
    next[k] = n;
  }
  return Object.freeze(next);
}

function seedPhase(seed: number): number {
  // A small xorshift mix gives a stable identity, never ambient randomness.
  let n = (seed ^ 0xa3c59ac3) >>> 0;
  n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
  return (n >>> 0) / 0x100000000 * Math.PI * 2;
}
const noTarget = (): OwlTarget => Object.freeze({ x: 0, y: 0, active: false });
const seal = (state: OwlState): OwlState => Object.freeze({ ...state,
  attention: Object.freeze({ ...state.attention }), behavior: Object.freeze({ ...state.behavior }),
  cycle: state.cycle ? Object.freeze({ ...state.cycle }) : null,
});
function initial(config: OwlConfig): OwlState {
  return seal({ species: 'owl', version: 1, config, tick: 0, lastSequence: -1,
    phaseOffset: seedPhase(config.seed), attention: noTarget(), behavior: { kind: 'idle', sinceTick: 0 }, cycle: null,
    headYawDeg: 0, headPitchDeg: 0, blink: 0, ruffle: 0, leftWing: 0, rightWing: 0, breath: 0 });
}
const smooth = (x: number) => { const n = clamp(x, 0, 1); return n * n * (3 - 2 * n); };
const bump = (x: number) => { const n = clamp(x, 0, 1); return Math.sin(Math.PI * n) ** 2; };

function stage(cycle: OwlCycle, tick: number): OwlBehavior | null {
  let start = cycle.startTick;
  for (const [phase, duration] of [['blink', cycle.blinkTicks], ['ruffle', cycle.ruffleTicks], ['stretch', cycle.stretchTicks]] as const) {
    if (tick < start + duration) return { kind: 'response', phase, sinceTick: start, phaseTick: tick - start };
    start += duration;
  }
  if (tick < start + cycle.recoveryTicks) return { kind: 'recovery', sinceTick: start, phaseTick: tick - start };
  start += cycle.recoveryTicks;
  if (tick < start + cycle.cooldownTicks) return { kind: 'cooldown', sinceTick: start, untilTick: start + cycle.cooldownTicks };
  return null;
}

function validateInputs(state: OwlState, tick: number, events: readonly OwlInput[]): { attention: OwlTarget; sequence: number; reactions: number } {
  if (!Array.isArray(events) || events.length > OWL_LIMITS.eventsPerTick) throw new RangeError('Owl input batch exceeds 16 events');
  let sequence = state.lastSequence, attention = state.attention, reactions = 0;
  for (const value of events) {
    const event = record(value, 'Owl event');
    const allowed = event.type === 'attention' ? ['tick', 'seq', 'type', 'x', 'y'] : ['tick', 'seq', 'type'];
    if (Object.keys(event).some(k => !allowed.includes(k))) throw new TypeError('Unknown Owl event field');
    if (event.tick !== tick) throw new RangeError('Owl event must target the next tick');
    const seq = integer(event.seq, 0, Number.MAX_SAFE_INTEGER, 'event seq');
    if (seq <= sequence) throw new RangeError('Owl event sequence must strictly increase');
    sequence = seq;
    switch (event.type) {
      case 'attention': attention = Object.freeze({ x: clamp(finite(event.x, 'attention x'), -1, 1), y: clamp(finite(event.y, 'attention y'), -1, 1), active: true }); break;
      case 'leave': attention = noTarget(); break;
      case 'react': reactions++; break;
      default: throw new TypeError('Unknown Owl event type');
    }
  }
  return { attention, sequence, reactions };
}

function advance(state: OwlState, tick: number, events: readonly OwlInput[]): OwlStepResult {
  integer(tick, 1, OWL_LIMITS.maxTick, 'tick');
  if (tick !== state.tick + 1) throw new RangeError('Owl advance requires exactly the next tick');
  const input = validateInputs(state, tick, events); // Whole batch first: rejection is atomic.
  const c = state.config;
  let cycle = state.cycle;
  if (cycle && !stage(cycle, tick)) cycle = null;
  const acceptedReactions = input.reactions > 0 && !cycle ? 1 : 0;
  if (acceptedReactions) cycle = Object.freeze({ startTick: tick, blinkTicks: c.blinkTicks,
    ruffleTicks: c.ruffleTicks, stretchTicks: c.stretchTicks, recoveryTicks: c.recoveryTicks,
    cooldownTicks: c.cooldownTicks, reactionStrength: c.reactionStrength });
  const restKind = input.attention.active ? 'approach' : 'idle';
  const behavior: OwlBehavior = (cycle && stage(cycle, tick)) || {
    kind: restKind, sinceTick: state.behavior.kind === restKind ? state.behavior.sinceTick : tick,
  };

  let blink = 0, ruffle = 0, leftWing = 0, rightWing = 0;
  if (behavior.kind === 'response' && cycle) {
    const age = behavior.phaseTick;
    if (behavior.phase === 'blink') blink = bump(age / (cycle.blinkTicks - 1));
    if (behavior.phase === 'ruffle') ruffle = bump(age / (cycle.ruffleTicks - 1)) * cycle.reactionStrength;
    if (behavior.phase === 'stretch') {
      const t = age / (cycle.stretchTicks - 1);
      leftWing = smooth(t / .72) * cycle.reactionStrength;
      rightWing = smooth((t - .1) / .72) * cycle.reactionStrength * .94;
    }
  } else if (behavior.kind === 'recovery' && cycle) {
    const settle = 1 - smooth(behavior.phaseTick / (cycle.recoveryTicks - 1));
    leftWing = settle * cycle.reactionStrength;
    rightWing = settle * cycle.reactionStrength * .94;
  } else {
    const offset = Math.floor(state.phaseOffset / (Math.PI * 2) * (c.blinkIntervalTicks - 24));
    const age = (tick + offset) % c.blinkIntervalTicks;
    if (age < 12) blink = bump(age / 11);
  }
  const t = tick / OWL_LIMITS.tickRate;
  const normalYaw = input.attention.active ? input.attention.x * c.headYawLimitDeg : Math.sin(t * .48 + state.phaseOffset) * c.idleAmplitude * 1.4;
  const normalPitch = input.attention.active ? input.attention.y * c.headPitchLimitDeg : Math.sin(t * .39 + state.phaseOffset) * c.idleAmplitude * .7;
  const targetYaw = behavior.kind === 'response' ? state.headYawDeg : behavior.kind === 'recovery' ? 0 : normalYaw;
  const targetPitch = behavior.kind === 'response' ? state.headPitchDeg : behavior.kind === 'recovery' ? 0 : normalPitch;
  const next = seal({ ...state, tick, lastSequence: input.sequence, attention: input.attention, behavior, cycle,
    headYawDeg: clamp(state.headYawDeg + (targetYaw - state.headYawDeg) * c.attentionSmoothing, -c.headYawLimitDeg, c.headYawLimitDeg),
    headPitchDeg: clamp(state.headPitchDeg + (targetPitch - state.headPitchDeg) * c.attentionSmoothing, -c.headPitchLimitDeg, c.headPitchLimitDeg),
    blink, ruffle, leftWing, rightWing, breath: Math.sin(t * 1.6 + state.phaseOffset) * c.idleAmplitude,
  });
  return Object.freeze({ state: next, acceptedReactions, ignoredReactions: input.reactions - acceptedReactions });
}

/** DOM-free instance with immutable snapshots; no timers, renderer or shared state. */
export function createOwl(options: OwlOptions = {}): OwlInstance {
  let state = initial(resolveOwlOptions(options));
  let disposed = false;
  const alive = () => { if (disposed) throw new Error('Owl instance is disposed'); };
  return Object.freeze({
    advance(tick: number, inputs: readonly OwlInput[] = []) { alive(); const result = advance(state, tick, inputs); state = result.state; return result; },
    update(patch: OwlOptionsPatch) {
      alive(); const input = record(patch, 'Owl patch');
      if (Object.hasOwn(input, 'seed') || Object.hasOwn(input, 'schemaVersion')) throw new TypeError('Use reset(seed) to reseed; schemaVersion is fixed');
      const config = mergeOptions(patch, state.config);
      state = seal({ ...state, config, headYawDeg: clamp(state.headYawDeg, -config.headYawLimitDeg, config.headYawLimitDeg),
        headPitchDeg: clamp(state.headPitchDeg, -config.headPitchLimitDeg, config.headPitchLimitDeg) });
      return config;
    },
    reset(seed?: number) { alive(); const config = mergeOptions({ seed: seed === undefined ? state.config.seed : seed }, state.config); state = initial(config); return state; },
    getState() { alive(); return state; },
    getOptions() { alive(); return state.config; },
    sample() { alive(); return buildOwlGeometry(state); },
    dispose() { disposed = true; },
    get disposed() { return disposed; },
  });
}

/** A display-only static pose. It does not advance or mutate an OwlInstance. */
export function makeOwlPoster(state: OwlState, poster: OwlPoster): OwlState {
  const p = record(poster, 'Owl poster');
  if (!['rest', 'react', 'attention'].includes(String(p.kind))) throw new TypeError('Unknown Owl poster');
  const allowed = p.kind === 'attention' ? ['kind', 'x', 'y'] : ['kind'];
  if (Object.keys(p).some(k => !allowed.includes(k))) throw new TypeError('Unknown Owl poster field');
  const target = p.kind === 'attention'
    ? Object.freeze({ active: true, x: clamp(finite(p.x, 'poster x'), -1, 1), y: clamp(finite(p.y, 'poster y'), -1, 1) }) : noTarget();
  // A caller may supply a director's displayed OwlState. A core poster must
  // still be grounded, not inherit that display's in-flight transform.
  const { presentation: _presentation, ...coreState } = state;
  return seal({ ...coreState, attention: target, cycle: null,
    behavior: p.kind === 'react' ? { kind: 'response', phase: 'stretch', phaseTick: 0, sinceTick: state.tick } : { kind: target.active ? 'approach' : 'idle', sinceTick: state.tick },
    headYawDeg: target.x * state.config.headYawLimitDeg, headPitchDeg: target.y * state.config.headPitchLimitDeg,
    blink: 0, ruffle: p.kind === 'react' ? .25 * state.config.reactionStrength : 0,
    leftWing: p.kind === 'react' ? state.config.reactionStrength * .75 : 0,
    rightWing: p.kind === 'react' ? state.config.reactionStrength * .70 : 0, breath: 0,
  });
}

/** CSS-rectangle normalization. Device pixel ratio never participates. */
export function normalizeOwlPointer(clientX: number, clientY: number, rect: Readonly<{ left: number; top: number; width: number; height: number }>): { x: number; y: number } | null {
  finite(clientX, 'clientX'); finite(clientY, 'clientY');
  for (const key of ['left', 'top', 'width', 'height'] as const) finite(rect[key], `rect.${key}`);
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { x: clamp(2 * (clientX - rect.left) / rect.width - 1, -1, 1), y: clamp(2 * (clientY - rect.top) / rect.height - 1, -1, 1) };
}
