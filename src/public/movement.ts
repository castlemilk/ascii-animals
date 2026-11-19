/**
 * Viewport journeys, independent of species animation, formations and rendering.
 * CSS coordinates: x right, y down. Determinism covers this module/version in the
 * same JS engine with identical options, viewport changes and integer tick log.
 */
export type MovementPath = 'horizontal' | 'vertical' | 'diagonal' | 'free';
export type MovementDirection = 'forward' | 'reverse';
/** Stylized whole-body cadence; never a replacement for a species' articulation. */
export type MovementProfile = 'neutral' | 'cuttlefish' | 'manta' | 'octopus';
export type MovementPhase = 'waiting' | 'enter' | 'traverse' | 'linger' | 'exit' | 'complete';
export type MovementTiming = Readonly<
  { mode: 'duration'; seconds: number } |
  { mode: 'speed'; pixelsPerSecond: number }
>;
export interface MovementViewport { readonly width: number; readonly height: number }
export interface MovementOptions {
  /** Opt-in: false leaves the host's natural movement untouched. */
  enabled?: boolean;
  seed?: number;
  path?: MovementPath;
  /** Reverses route endpoints. For continuous live reversal use reverse(). */
  direction?: MovementDirection;
  /** Diagonal screen slope; direction supplies the opposite endpoint order. */
  diagonalSlope?: 'down' | 'up';
  /** Moving time, excluding linger and cast stagger; speed is average path speed. */
  timing?: MovementTiming;
  count?: number;
  lanes?: number;
  staggerSeconds?: number;
  lingerSeconds?: number;
  /** Extra clearance beyond silhouetteRadius at both offscreen endpoints. */
  edgePadding?: number;
  /** Conservative circle enclosing each rendered silhouette, in CSS pixels. */
  silhouetteRadius?: number;
  repeat?: boolean;
  profile?: MovementProfile;
  /** Explicit per-member profiles. Missing trailing entries use profile. */
  cast?: readonly MovementProfile[];
}
export type MovementConfig = Readonly<Required<MovementOptions>>;
export interface MovementState {
  /** Explicit simulation tick, at 60 ticks/second; seek/reset can reposition it. */
  readonly tick: number;
  /** Can be fractional following resize/configuration phase preservation. */
  readonly playheadTicks: number;
  readonly playbackDirection: 1 | -1;
  /** Whole cast cycle, including stagger, all travel and all linger. */
  readonly durationTicks: number;
  readonly disposed: boolean;
}
export interface MovementMember {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  /** Radians clockwise from right, in screen coordinates. */
  readonly heading: number;
  readonly tangent: Readonly<{ x: number; y: number }>;
  readonly progress: number;
  /** Entry/traverse/exit classify the route center, not the bounding circle. */
  readonly phase: MovementPhase;
  /** Conservative circle intersects the viewport; false when disabled/zero-size. */
  readonly visible: boolean;
  readonly radius: number;
  readonly lane: number;
  readonly profile: MovementProfile;
  readonly startTick: number;
  /** This member's travel plus linger (does not include startTick). */
  readonly durationTicks: number;
}
export interface MovementSnapshot extends MovementState {
  readonly enabled: boolean;
  readonly available: boolean;
  readonly cycle: number;
  readonly complete: boolean;
  readonly members: readonly MovementMember[];
}
export interface MovementDirector {
  getOptions(): MovementConfig;
  getState(): MovementState;
  sample(): MovementSnapshot;
  /** Integer ticks only, at most 216000 per call. Host owns every pause cause. */
  advanceTicks(ticks: number): void;
  /** Absolute nonnegative tick, independent of playbackDirection. Never schedules. */
  seek(tick: number): void;
  /** Reflow paths, preserve normalized cast phase (including for speed timing). */
  resize(viewport: MovementViewport): void;
  /** Atomic validation. Preserve cast phase and playback direction. */
  configure(patch: MovementOptions): void;
  /** Flip time direction at the current position, without a position jump. */
  reverse(): void;
  /** Reset playhead, delivered tick count and direction; configuration survives. */
  reset(): void;
  /** Idempotent. Later mutators are no-ops; snapshots stay readable. */
  dispose(): void;
}
export const MOVEMENT_TICK_RATE = 60;
export const MOVEMENT_DEFAULTS: MovementConfig = Object.freeze({
  enabled: false, seed: 1, path: 'horizontal', direction: 'forward', diagonalSlope: 'down',
  timing: Object.freeze({ mode: 'duration', seconds: 12 }),
  count: 1, lanes: 1, staggerSeconds: .6, lingerSeconds: 0,
  edgePadding: 24, silhouetteRadius: 64, repeat: true,
  profile: 'neutral', cast: Object.freeze([])
});
const profiles: readonly MovementProfile[] = ['neutral', 'cuttlefish', 'manta', 'octopus'];
const paths: readonly MovementPath[] = ['horizontal', 'vertical', 'diagonal', 'free'];
const MAX_TICK = 1_000_000_000;
const TAU = Math.PI * 2;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
function object(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
}
function keys(value: object, allowed: readonly string[], name: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`Unknown ${name}: ${key}`);
}
function number(value: unknown, low: number, high: number, name: string, integer = false): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high || (integer && !Number.isInteger(value))) {
    throw new RangeError(`${name} must be ${integer ? 'an integer ' : ''}in ${low}..${high}`);
  }
}
function timing(value: unknown): MovementTiming {
  object(value, 'timing');
  if (value.mode === 'duration') {
    keys(value, ['mode', 'seconds'], 'timing option');
    number(value.seconds, .25, 3600, 'timing.seconds');
    return Object.freeze({ mode: 'duration', seconds: value.seconds });
  }
  if (value.mode === 'speed') {
    keys(value, ['mode', 'pixelsPerSecond'], 'timing option');
    number(value.pixelsPerSecond, 1, 4000, 'timing.pixelsPerSecond');
    return Object.freeze({ mode: 'speed', pixelsPerSecond: value.pixelsPerSecond });
  }
  throw new TypeError('timing.mode must be duration or speed');
}
function resolve(input: MovementOptions, base: MovementConfig): MovementConfig {
  object(input, 'movement options');
  keys(input, Object.keys(MOVEMENT_DEFAULTS), 'movement option');
  const next = { ...base };
  for (const key of Object.keys(input) as (keyof MovementOptions)[]) {
    const value = input[key];
    if (value !== undefined) Object.defineProperty(next, key, { value, enumerable: true, configurable: true, writable: true });
  }
  for (const key of ['enabled', 'repeat'] as const) if (typeof next[key] !== 'boolean') throw new TypeError(`${key} must be boolean`);
  if (!paths.includes(next.path)) throw new TypeError('Invalid movement path');
  if (!['forward', 'reverse'].includes(next.direction)) throw new TypeError('Invalid movement direction');
  if (!['down', 'up'].includes(next.diagonalSlope)) throw new TypeError('Invalid diagonal slope');
  if (!profiles.includes(next.profile)) throw new TypeError('Invalid movement profile');
  number(next.seed, 0, 4294967295, 'seed', true);
  number(next.count, 1, 12, 'count', true);
  number(next.lanes, 1, 12, 'lanes', true);
  number(next.staggerSeconds, 0, 120, 'staggerSeconds');
  number(next.lingerSeconds, 0, 600, 'lingerSeconds');
  number(next.edgePadding, 0, 8192, 'edgePadding');
  number(next.silhouetteRadius, 0, 8192, 'silhouetteRadius');
  if (!Array.isArray(next.cast) || next.cast.length > 12 || !Array.from(next.cast).every(value => profiles.includes(value))) {
    throw new TypeError('cast must contain at most 12 supported profiles (no sparse entries)');
  }
  return Object.freeze({ ...next, timing: timing(next.timing), cast: Object.freeze([...next.cast]) });
}
/** Strict immutable configuration; unknown fields are rejected, undefined omitted. */
export function normalizeMovementOptions(options: MovementOptions = {}): MovementConfig { return resolve(options, MOVEMENT_DEFAULTS); }
function viewport(input: MovementViewport): MovementViewport {
  object(input, 'viewport'); keys(input, ['width', 'height'], 'viewport option');
  number(input.width, 0, 32768, 'viewport.width'); number(input.height, 0, 32768, 'viewport.height');
  return Object.freeze({ width: input.width, height: input.height });
}
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
interface Point { x: number; y: number }
interface Route {
  id: number; lane: number; profile: MovementProfile;
  points: Point[]; distances: number[]; length: number;
  travelTicks: number; lingerTicks: number; startTick: number; durationTicks: number;
}
interface Plan { viewport: MovementViewport; routes: Route[]; durationTicks: number }
function makeRoute(config: MovementConfig, size: MovementViewport, id: number): Route {
  const width = Math.max(1, size.width), height = Math.max(1, size.height);
  const rng = random((config.seed ^ Math.imul(id + 1, 0x9e3779b9)) >>> 0);
  const profile = config.cast[id] ?? config.profile;
  const lane = config.count <= config.lanes ? Math.floor((id + .5) * config.lanes / config.count) : id % config.lanes;
  // Distribute lane centers inside a 10% inset band for useful default
  // framing. This is not collision-free packing: a conservative silhouette
  // radius must never collapse the entire cast onto the same center.
  const across = (length: number) => (.1 + .8 * (lane + .5) / config.lanes) * length;
  const margin = config.edgePadding + config.silhouetteRadius;
  let start: Point, end: Point;
  const freeVertical = config.path === 'free' && random(config.seed)() >= .5;
  if (config.path === 'vertical' || freeVertical) {
    const x = across(width); start = { x, y: -margin }; end = { x, y: height + margin };
  } else if (config.path === 'diagonal') {
    const length = Math.hypot(width, height), dx = width / length, dy = height / length;
    const offset = ((lane + .5) / config.lanes - .5) * Math.min(width, height) * .8;
    const center = { x: width / 2 - dy * offset, y: height / 2 + dx * offset };
    const before = Math.min((center.x + margin) / dx, (center.y + margin) / dy);
    const after = Math.min((width + margin - center.x) / dx, (height + margin - center.y) / dy);
    start = { x: center.x - dx * before, y: center.y - dy * before };
    end = { x: center.x + dx * after, y: center.y + dy * after };
    // Pin the intersected boundary exactly, avoiding a floating-point sliver
    // of visibility when padding is zero.
    if (before === (center.x + margin) / dx) start.x = -margin; else start.y = -margin;
    if (after === (width + margin - center.x) / dx) end.x = width + margin; else end.y = height + margin;
  } else {
    const y = across(height); start = { x: -margin, y }; end = { x: width + margin, y };
  }
  if (config.path === 'diagonal' && config.diagonalSlope === 'up') {
    start.y = height - start.y; end.y = height - end.y;
  }
  const dx = end.x - start.x, dy = end.y - start.y, chord = Math.hypot(dx, dy);
  const nx = -dy / chord, ny = dx / chord;
  const phase = rng() * TAU;
  const freeA = config.path === 'free' ? (rng() * 2 - 1) * Math.min(width, height) * .30 : 0;
  const freeB = config.path === 'free' ? (rng() * 2 - 1) * Math.min(width, height) * .30 : 0;
  const amplitude = Math.min(width, height) * ({ neutral: 0, cuttlefish: .018, manta: .032, octopus: .024 }[profile]);
  const waves = { neutral: 0, cuttlefish: 2, manta: 1, octopus: 3 }[profile];
  const points: Point[] = [], distances: number[] = [];
  let length = 0;
  // A fixed 96-segment arc-length table bounds work and makes speed independent
  // of presentation cadence. No random samples are taken while advancing.
  for (let i = 0; i <= 96; i++) {
    const u = i / 96, v = 1 - u;
    const bend = 3 * v * v * u * freeA + 3 * v * u * u * freeB
      + Math.sin(Math.PI * u) ** 2 * Math.sin(waves * TAU * u + phase) * amplitude;
    const point = { x: start.x + dx * u + nx * bend, y: start.y + dy * u + ny * bend };
    if (i === 0) { point.x = start.x; point.y = start.y; }
    if (i === 96) { point.x = end.x; point.y = end.y; }
    if (points.length) { const previous = points[points.length - 1]!; length += Math.hypot(point.x - previous.x, point.y - previous.y); }
    points.push(point); distances.push(length);
  }
  const travelTicks = Math.max(1, Math.ceil((config.timing.mode === 'duration' ? config.timing.seconds : length / config.timing.pixelsPerSecond) * MOVEMENT_TICK_RATE));
  const lingerTicks = Math.round(config.lingerSeconds * MOVEMENT_TICK_RATE), startTick = Math.round(id * config.staggerSeconds * MOVEMENT_TICK_RATE);
  return { id, lane, profile, points, distances, length, travelTicks, lingerTicks, startTick, durationTicks: travelTicks + lingerTicks };
}
function plan(config: MovementConfig, size: MovementViewport): Plan {
  const routes = Array.from({ length: config.count }, (_, id) => makeRoute(config, size, id));
  return { viewport: size, routes, durationTicks: Math.max(...routes.map(route => route.startTick + route.durationTicks)) };
}
function atDistance(route: Route, fraction: number): { point: Point; tangent: Point } {
  const distance = clamp(fraction, 0, 1) * route.length;
  let low = 1, high = route.distances.length - 1;
  while (low < high) { const mid = (low + high) >>> 1; if (route.distances[mid]! < distance) low = mid + 1; else high = mid; }
  const i = low, a = route.points[i - 1]!, b = route.points[i]!;
  const segment = route.distances[i]! - route.distances[i - 1]!;
  const amount = segment === 0 ? 0 : clamp((distance - route.distances[i - 1]!) / segment, 0, 1);
  const x = b.x - a.x, y = b.y - a.y, length = Math.hypot(x, y) || 1;
  return { point: { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount }, tangent: { x: x / length, y: y / length } };
}
function sample(config: MovementConfig, prepared: Plan, state: MovementState): MovementSnapshot {
  const { durationTicks } = prepared;
  const raw = state.playheadTicks;
  const cycle = config.repeat ? Math.floor(raw / durationTicks) : 0;
  const cycleTick = config.repeat ? ((raw % durationTicks) + durationTicks) % durationTicks : clamp(raw, 0, durationTicks);
  const available = prepared.viewport.width > 0 && prepared.viewport.height > 0;
  const complete = !config.repeat && (state.playbackDirection === 1 ? raw >= durationTicks : raw <= 0);
  const members = prepared.routes.map(route => {
    const age = cycleTick - route.startTick, half = route.travelTicks / 2;
    const lingering = route.lingerTicks > 0 && age >= half && age < half + route.lingerTicks;
    const travelAge = age < half ? age : age < half + route.lingerTicks ? half : age - route.lingerTicks;
    const progress = clamp(travelAge / route.travelTicks, 0, 1);
    // A bounded species cadence modulates average speed without stepping state.
    // Every profile remains monotonic and keeps both endpoints and the midpoint.
    const strength = { neutral: 0, cuttlefish: .22, manta: .08, octopus: .48 }[route.profile];
    const pulses = { neutral: 1, cuttlefish: 2, manta: 1, octopus: 3 }[route.profile];
    const paced = progress + strength * Math.sin(progress * TAU * pulses) / (TAU * pulses);
    const forward = config.direction === 'forward';
    const position = atDistance(route, forward ? paced : 1 - paced);
    const tangentSign = (forward ? 1 : -1) * state.playbackDirection;
    const tangent = Object.freeze({ x: position.tangent.x * tangentSign, y: position.tangent.y * tangentSign });
    const radius = config.silhouetteRadius, { x, y } = position.point;
    const { width, height } = prepared.viewport;
    // Phase follows the center. Conservative circular clearance can exceed
    // half the viewport even when a long, thin silhouette fits comfortably.
    const inside = x >= 0 && x <= width && y >= 0 && y <= height;
    let phase: MovementPhase = age < 0 ? 'waiting' : age >= route.durationTicks ? 'complete' : lingering ? 'linger' : inside ? 'traverse' : progress < .5 ? 'enter' : 'exit';
    // During reverse playback, entry and exit describe the current action.
    if (state.playbackDirection === -1) {
      if (phase === 'enter') phase = 'exit'; else if (phase === 'exit') phase = 'enter';
      else if (phase === 'waiting') phase = 'complete'; else if (phase === 'complete') phase = 'waiting';
    }
    const visible = config.enabled && available && age >= 0 && age < route.durationTicks
      && x + radius > 0 && x - radius < width && y + radius > 0 && y - radius < height;
    return Object.freeze({ id: route.id, x, y, heading: Math.atan2(tangent.y, tangent.x), tangent,
      progress, phase, visible, radius, lane: route.lane, profile: route.profile,
      startTick: route.startTick, durationTicks: route.durationTicks });
  });
  return Object.freeze({ ...state, enabled: config.enabled, available, cycle, complete, members: Object.freeze(members) });
}
/** Stateless absolute sampling; useful for stills, fixtures and replay tools. */
export function sampleMovement(options: MovementOptions, size: MovementViewport, tick: number): MovementSnapshot {
  number(tick, 0, MAX_TICK, 'tick', true);
  const config = normalizeMovementOptions(options), prepared = plan(config, viewport(size));
  return sample(config, prepared, Object.freeze({ tick, playheadTicks: tick, playbackDirection: 1, durationTicks: prepared.durationTicks, disposed: false }));
}
export function createMovementDirector(options: MovementOptions = {}, size: MovementViewport = { width: 1, height: 1 }): MovementDirector {
  let config = normalizeMovementOptions(options), prepared = plan(config, viewport(size));
  let tick = 0, anchorTick = 0, anchorPlayhead = 0, direction: 1 | -1 = 1, disposed = false;
  const current = () => {
    const value = anchorPlayhead + (tick - anchorTick) * direction;
    return config.repeat ? value : clamp(value, 0, prepared.durationTicks);
  };
  const state = (): MovementState => Object.freeze({ tick, playheadTicks: current(), playbackDirection: direction, durationTicks: prepared.durationTicks, disposed });
  function replace(next: MovementConfig, nextPlan: Plan) {
    const progress = current() / prepared.durationTicks;
    anchorPlayhead = progress * nextPlan.durationTicks; anchorTick = tick;
    config = next; prepared = nextPlan;
  }
  return Object.freeze({
    getOptions: () => config, getState: state, sample: () => sample(config, prepared, state()),
    advanceTicks(amount: number) {
      if (disposed) return;
      number(amount, 0, 216000, 'ticks', true); number(tick + amount, 0, MAX_TICK, 'total tick', true);
      tick += amount;
    },
    seek(value: number) {
      if (disposed) return;
      number(value, 0, MAX_TICK, 'tick', true); tick = value; anchorTick = value; anchorPlayhead = value;
    },
    resize(value: MovementViewport) {
      if (disposed) return;
      const next = viewport(value);
      if (next.width === prepared.viewport.width && next.height === prepared.viewport.height) return;
      replace(config, plan(config, next));
    },
    configure(patch: MovementOptions) {
      if (disposed) return;
      const next = resolve(patch, config); replace(next, plan(next, prepared.viewport));
    },
    reverse() {
      if (disposed) return;
      anchorPlayhead = current(); anchorTick = tick; direction = direction === 1 ? -1 : 1;
    },
    reset() { if (!disposed) { tick = anchorTick = anchorPlayhead = 0; direction = 1; } },
    dispose() { if (!disposed) { anchorPlayhead = current(); anchorTick = tick; disposed = true; } }
  });
}
