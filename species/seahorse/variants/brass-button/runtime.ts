/**
 * Private opt-in Seahorse variation. Never imported by the public package or
 * shared gallery; the shipped Original remains src/public/seahorse.ts.
 *
 * Exact Brass Button authorship recovered from the reviewed proposal at base
 * f63b20e2045b1070b10bde2efc4eb3a8536e606b. Authored source SHA-256:
 * 378f4f1b993ca64cd19f82fe1f0fa32b2634544af7b103e065dbf44307fabdef.
 * Isolation changes only exported factory/default names and the scheduler path.
 * Geometry, palettes, acting, input handling and lifecycle are retained intact.
 * The built scheduler is shared with Original; no second RAF owner is introduced.
 */
import { getBrowserScheduler } from '../../../../lib/core/scheduler.js';

/** Borrowed scheduler subscription; controller never owns or disposes it. */
export interface SeahorseFrameSource { subscribe(callback: (timestamp: number) => void): () => void }
export type SeahorseScene = 'study' | 'kelp-garden' | 'tidal-duet' | 'drift-passage';
export type SeahorseRole = 'sentinel' | 'explorer' | 'dreamer' | 'partner';
export type SeahorseArc = 'arrival' | 'rest' | 'depart' | 'return';
export interface SeahorseIndividualOptions {
  readonly role?: SeahorseRole;
  readonly scale?: number;
  readonly facing?: 'left' | 'right';
}
export interface SeahorseOptions {
  columns?: number; rows?: number; seed?: number; speed?: number; scale?: number;
  sway?: number; facing?: 'left' | 'right'; behavior?: 'hover' | 'curious' | 'holdfast';
  palette?: 'brass' | 'lagoon' | 'rose'; paused?: boolean;
  reducedMotion?: 'system' | 'ignore';
  scene?: SeahorseScene; count?: number; current?: number;
  choreography?: 'cycle' | 'hold'; duration?: number; stagger?: number;
  labels?: boolean; individuals?: readonly SeahorseIndividualOptions[];
}
export type SeahorseConfig = Readonly<Required<SeahorseOptions>>;
export const BRASS_BUTTON_DEFAULTS: SeahorseConfig = Object.freeze({
  columns: 100, rows: 60, seed: 7, speed: 1, scale: 1, sway: .18,
  facing: 'left', behavior: 'hover', palette: 'brass', paused: false, reducedMotion: 'system',
  scene: 'study', count: 1, current: .3, choreography: 'cycle', duration: 28, stagger: .8,
  labels: false, individuals: Object.freeze([]),
});
const ranges = {
  columns: [64, 160], rows: [36, 100], seed: [0, 2147483647], speed: [.25, 2],
  scale: [.6, 1.3], sway: [0, .4], count: [1, 4], current: [-1, 1],
  duration: [16, 90], stagger: [0, 3],
} as const;
const roles: readonly SeahorseRole[] = ['sentinel', 'explorer', 'dreamer', 'partner'];
const scenes: readonly SeahorseScene[] = ['study', 'kelp-garden', 'tidal-duet', 'drift-passage'];
function object(value: unknown, label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
}
function resolve(patch: SeahorseOptions, base: SeahorseConfig): SeahorseConfig {
  object(patch, 'Seahorse options');
  for (const key of Object.keys(patch)) if (!Object.hasOwn(BRASS_BUTTON_DEFAULTS, key)) throw new TypeError(`Unknown seahorse option ${key}`);
  const candidate = { ...base };
  for (const key of Object.keys(BRASS_BUTTON_DEFAULTS) as (keyof SeahorseOptions)[]) {
    const value = patch[key];
    if (value !== undefined) Object.defineProperty(candidate, key, { value, enumerable: true, writable: true, configurable: true });
  }
  for (const [key, [lo, hi]] of Object.entries(ranges)) {
    const value = candidate[key as keyof typeof ranges];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < lo || value > hi ||
        (['columns', 'rows', 'seed', 'count'].includes(key) && !Number.isInteger(value))) throw new RangeError(`Invalid ${key}`);
  }
  if (!['left', 'right'].includes(candidate.facing) || !['hover', 'curious', 'holdfast'].includes(candidate.behavior) ||
      !['brass', 'lagoon', 'rose'].includes(candidate.palette) || !['system', 'ignore'].includes(candidate.reducedMotion) ||
      !scenes.includes(candidate.scene) || !['cycle', 'hold'].includes(candidate.choreography) ||
      typeof candidate.paused !== 'boolean' || typeof candidate.labels !== 'boolean') throw new TypeError('Invalid seahorse setting');
  if (!Array.isArray(candidate.individuals) || candidate.individuals.length > 4) throw new RangeError('At most four individual settings');
  candidate.individuals = Object.freeze(Array.from(candidate.individuals, individual => {
    object(individual, 'Individual');
    for (const key of Object.keys(individual)) if (!['role', 'scale', 'facing'].includes(key)) throw new TypeError(`Unknown individual option ${key}`);
    const copy: { role?: SeahorseRole; scale?: number; facing?: 'left' | 'right' } = {};
    if (individual.role !== undefined) {
      if (!roles.includes(individual.role)) throw new TypeError('Invalid individual role');
      copy.role = individual.role;
    }
    if (individual.scale !== undefined) {
      if (typeof individual.scale !== 'number' || !Number.isFinite(individual.scale) || individual.scale < .75 || individual.scale > 1.2) throw new RangeError('Invalid individual scale');
      copy.scale = individual.scale;
    }
    if (individual.facing !== undefined) {
      if (!['left', 'right'].includes(individual.facing)) throw new TypeError('Invalid individual facing');
      copy.facing = individual.facing;
    }
    return Object.freeze(copy);
  }));
  return Object.freeze(candidate);
}
/** Validate and copy all configuration, including nested individual settings. */
export function normalizeBrassButtonOptions(patch: SeahorseOptions = {}): SeahorseConfig { return resolve(patch, BRASS_BUTTON_DEFAULTS); }

/** The original single-animal clock/input snapshot remains unchanged. */
export interface SeahorseState { readonly tick: number; readonly responseTick: number | null; readonly targetX: number; readonly targetY: number }
export type SeahorsePhase = 'idle' | 'inspect' | 'curl' | 'settle';
export interface SeahorseCell { readonly glyph: string; readonly tone: number; readonly owner?: number; readonly layer?: 'animal' | 'kelp' | 'water' | 'label' }
export interface SeahorseFrame { readonly columns: number; readonly rows: number; readonly cells: readonly SeahorseCell[]; readonly text: string; readonly phase: SeahorsePhase }
export interface SeahorsePoint { readonly x: number; readonly y: number }
export type SeahorseMotive =
  | { readonly kind: 'anchored'; readonly anchorId: number }
  | { readonly kind: 'duet'; readonly partnerId: number }
  | { readonly kind: 'arriving' | 'drifting' | 'inspecting' | 'startled' | 'recovering' | 'returning' };
export interface SeahorseMember {
  readonly id: number; readonly name: string; readonly role: SeahorseRole;
  /** World coordinates; projection is disclosed by the director snapshot. */
  readonly x: number; readonly y: number; readonly scale: number; readonly facing: 'left' | 'right';
  readonly rotation: number; readonly curl: number; readonly attention: number;
  readonly motive: SeahorseMotive; readonly anchorId: number | null;
  readonly anchor: SeahorsePoint | null; readonly tailTip: SeahorsePoint;
}
export interface SeahorseDirectorState {
  readonly scene: SeahorseScene; readonly arc: SeahorseArc; readonly progress: number;
  readonly selected: number; readonly current: number; readonly worldWidth: number; readonly worldHeight: number;
  readonly members: readonly SeahorseMember[];
}
export type SeahorseDirectorAction =
  | { readonly type: 'select'; readonly id: number }
  | { readonly type: 'release' | 'anchor' | 'inspect' | 'startle'; readonly id?: number }
  | { readonly type: 'seek'; readonly progress: number };
export interface SeahorseModel {
  getOptions(): SeahorseConfig; getState(): SeahorseState; getPhase(): SeahorsePhase;
  getDirectorState(): SeahorseDirectorState;
  configure(patch: SeahorseOptions): void; advanceTicks(ticks: number): void;
  guide(x: number, y: number): void; clearGuide(): void; greet(poster?: boolean): void;
  direct(action: SeahorseDirectorAction, poster?: boolean): void; reset(): void; frame(): SeahorseFrame;
}
const TAU = Math.PI * 2;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const smooth = (n: number) => { const a = clamp(n, 0, 1); return a * a * (3 - 2 * a); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (n: number) => n - Math.floor(n);
const arcAt = (p: number): SeahorseArc => p < .18 ? 'arrival' : p < .68 ? 'rest' : p < .87 ? 'depart' : 'return';
type CueType = 'release' | 'anchor' | 'inspect' | 'startle';
interface Cue { type: CueType; start: number; posterAge: number; approachX: number; approachY: number }
const cueDuration: Record<CueType, number> = { release: 240, anchor: 180, inspect: 180, startle: 240 };
const posterAge: Record<CueType, number> = { release: 90, anchor: 70, inspect: 70, startle: 50 };
interface DirectorInput { sceneTicks: number; selected: number; attention: boolean; cues: readonly (Cue | null)[] }

/** Pure 60 Hz model. Explicit stepping is independent of browser motion policy. */
export function createBrassButtonModel(input: SeahorseOptions = {}): SeahorseModel {
  let options = normalizeBrassButtonOptions(input), tick = 0, responseTick: number | null = null, targetX = 0, targetY = 0;
  let sceneTicks = options.choreography === 'hold' ? options.duration * 60 * .42 : 0, selected = 0, attention = false;
  // Retain the last deliberate approach when the pointer leaves for a control.
  // The visible guide still clears immediately; reset/options clear both.
  let approachX = 0, approachY = 0, hasApproach = false;
  const cues: (Cue | null)[] = [null, null, null, null];
  const state = (): SeahorseState => Object.freeze({ tick, responseTick, targetX, targetY });
  const phase = (): SeahorsePhase => responseTick === null ? 'idle' : tick - responseTick < 45 ? 'inspect' : tick - responseTick < 110 ? 'curl' : 'settle';
  const director = () => sampleDirector(options, state(), { sceneTicks, selected, attention, cues });
  const clear = () => { targetX = targetY = 0; attention = false; };
  function direct(action: SeahorseDirectorAction, poster = false) {
    object(action, 'Director action');
    const allowed = action.type === 'select' ? ['type', 'id'] : action.type === 'seek' ? ['type', 'progress'] : ['type', 'id'];
    if (!['select', 'release', 'anchor', 'inspect', 'startle', 'seek'].includes(action.type)) throw new TypeError('Invalid director action');
    for (const key of Object.keys(action)) if (!allowed.includes(key)) throw new TypeError(`Unknown action field ${key}`);
    if (typeof poster !== 'boolean') throw new TypeError('Poster flag must be boolean');
    if (action.type === 'seek') {
      if (typeof action.progress !== 'number' || !Number.isFinite(action.progress) || action.progress < 0 || action.progress > 1) throw new RangeError('Seek progress must be 0..1');
      sceneTicks = (action.progress === 1 ? 0 : action.progress) * options.duration * 60;
      cues.fill(null); clear(); return;
    }
    const id = action.id === undefined && action.type !== 'select' ? selected : action.id;
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 0 || id >= options.count) throw new RangeError('Unknown seahorse ID');
    if (action.type === 'select') { selected = id; return; }
    if (cues[id] !== null && !poster) return; // live cooldown; deliberate still cues replace the previous poster
    const neutral = sampleDirector(options, state(), { sceneTicks, selected, attention: false, cues: [null, null, null, null] });
    const member = neutral.members[id]!;
    const relativeX = hasApproach ? clamp((approachX * neutral.worldWidth / 2 - member.x) / (member.scale * 1.2), -1, 1) : 0;
    const relativeY = hasApproach ? clamp((approachY * neutral.worldHeight / 2 - member.y) / (member.scale * 2), -1, 1) : 0;
    cues[id] = { type: action.type, start: tick, posterAge: poster ? posterAge[action.type] : 0, approachX: relativeX, approachY: relativeY };
  }
  return Object.freeze({ getOptions: () => options, getState: state, getPhase: phase, getDirectorState: director,
    configure(patch: SeahorseOptions) {
      const next = resolve(patch, options); // all validation occurs before any state mutation
      if (next.scene !== options.scene || next.seed !== options.seed) { sceneTicks = next.choreography === 'hold' ? next.duration * 60 * .42 : 0; cues.fill(null); clear(); approachX = approachY = 0; hasApproach = false; }
      // Keep the current beat when changing duration. Speed changes only the rate from here.
      else if (next.duration !== options.duration) sceneTicks *= next.duration / options.duration;
      if (next.choreography === 'hold' && options.choreography !== 'hold') sceneTicks = next.duration * 60 * .42;
      options = next; selected = Math.min(selected, options.count - 1);
      for (let id = options.count; id < 4; id++) cues[id] = null;
    },
    advanceTicks(ticks: number) {
      if (!Number.isInteger(ticks) || ticks < 0 || ticks > 600) throw new RangeError('Ticks must be an integer 0..600');
      // Per-tick accumulation gives identical results for different render/step grouping.
      for (let i = 0; i < ticks; i++) {
        tick++; if (options.choreography === 'cycle') sceneTicks += options.speed;
        for (let id = 0; id < 4; id++) { const cue = cues[id]; if (cue && tick - cue.start + cue.posterAge >= cueDuration[cue.type]) cues[id] = null; }
      }
      if (responseTick !== null && tick - responseTick >= 180) responseTick = null;
    },
    guide(x: number, y: number) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Guide requires finite normalized coordinates');
      targetX = approachX = clamp(x, -1, 1); targetY = approachY = clamp(y, -1, 1); attention = true; hasApproach = true;
    }, clearGuide: clear,
    greet(poster = false) {
      if (typeof poster !== 'boolean') throw new TypeError('Poster flag must be boolean');
      if (responseTick === null) { responseTick = tick - (poster ? 70 : 0); direct({ type: 'inspect' }, poster); }
    }, direct,
    reset() { tick = 0; sceneTicks = options.choreography === 'hold' ? options.duration * 60 * .42 : 0; responseTick = null; selected = 0; cues.fill(null); clear(); approachX = approachY = 0; hasApproach = false; },
    // The gallery and full studio now share the very same acting and grip.
    frame() { return renderGarden(options, state(), phase(), director(), cues); },
  });
}

/** One continuous, tapered tail curve shared by contact solving and both renderers.
 * Opening the coil changes its sweep as well as its radius: release is an unroll,
 * not a smaller copy of the same spiral. The distal end remains a true point.
 */
function tailPoint(curl: number, u: number): SeahorsePoint {
  const radius = .46 - curl * .115, start = -.14;
  const join = { x: .29 - radius + radius * Math.cos(start), y: 1.32 + radius * Math.sin(start) };
  if (u <= .34) {
    const a = u / .34, b = 1 - a;
    return { x: b ** 3 * .16 + 3 * b * b * a * .25 + 3 * b * a * a * .31 + a ** 3 * join.x,
      y: b ** 3 * .64 + 3 * b * b * a * .90 + 3 * b * a * a * 1.08 + a ** 3 * join.y };
  }
  const a = (u - .34) / .66, angle = start + a * Math.PI * (1.20 + 1.43 * curl), r = radius * (1 - a * .76);
  return { x: .29 - radius + r * Math.cos(angle), y: 1.32 + r * Math.sin(angle) };
}
function tailContact(curl: number): SeahorsePoint { return tailPoint(curl, 1); }
function rotateLocal(p: SeahorsePoint, angle: number, facing: 'left' | 'right', scale: number): SeahorsePoint {
  const co = Math.cos(angle), si = Math.sin(angle), mirror = facing === 'left' ? 1 : -1;
  return { x: (p.x * co - p.y * si) * scale * mirror, y: (p.x * si + p.y * co) * scale };
}
interface GardenSlot { x: number; y: number; scale: number; anchor: SeahorsePoint }
function gardenSlot(o: SeahorseConfig, id: number, worldWidth: number): GardenSlot {
  const across = o.count === 4 ? (worldWidth < 3.5 ? 1 : 2) : worldWidth < 4.2 ? 1 : o.count;
  const down = Math.ceil(o.count / across);
  const row = Math.floor(id / across), col = id % across, columnsHere = Math.min(across, o.count - row * across);
  const requested = (o.count === 1 ? 1.12 : o.count === 2 ? .9 : o.count === 3 ? .81 : .72) * o.scale * (o.individuals[id]?.scale ?? 1);
  // A single-column stage must reserve the full guided brace about the tail,
  // including the head turn. Keep this fit static throughout a cue so a strong
  // lean cannot clip or make the character visibly breathe in scale.
  const widthBudget = across === 1 ? 4.3 : 3.2;
  const scale = Math.min(requested, worldWidth / across / widthBudget, 6.2 / down / (o.count === 1 ? 5.7 : 6.6));
  const x = (col - (columnsHere - 1) / 2) * worldWidth / across * .82;
  const y = (row - (down - 1) / 2) * 6.2 / down + (down === 1 && o.count > 1 ? (id % 2 ? -.25 : .18) : 0);
  return { x, y, scale, anchor: { x: x - .10 * scale, y: y + 1.35 * scale } };
}
/** Eelgrass is a ribbon rooted on the bed. The hold is a material position on
 * this very curve, so neither the plant nor the tail can slide through the other.
 * The old public `kelp` layer/scene names remain compatibility identifiers.
 */
function eelgrassPoint(o: SeahorseConfig, slot: GardenSlot, id: number, t: number, y: number): SeahorsePoint {
  const bottom = 6.2 * .465, top = slot.anchor.y - 3.05 * slot.scale;
  const u = clamp((bottom - y) / (bottom - top), 0, 1);
  const holdU = clamp((bottom - slot.anchor.y) / (bottom - top), 0, 1);
  const phase = ((o.seed * 31 + id * 233) % 997) / 997 * TAU;
  const bend = (.34 + o.current * .38) * slot.scale;
  const wave = (.14 + Math.abs(o.current) * .18) * slot.scale * Math.sin(t * .72 + phase);
  const x = slot.anchor.x - bend * holdU ** 1.65 + (bend + wave) * u ** 1.65 +
    .05 * slot.scale * Math.sin(t * .95 - u * 2 + phase) * u;
  return { x, y };
}
/** Authored routes are bounded analytic curves; individual cues overlay then recover. */
function sampleDirector(o: SeahorseConfig, s: SeahorseState, d: DirectorInput): SeahorseDirectorState {
  const worldHeight = 6.2, worldWidth = worldHeight * o.columns * .56 / o.rows;
  const progress = wrap(d.sceneTicks / (o.duration * 60));
  const t = s.tick / 60 * o.speed;
  const members: SeahorseMember[] = [];
  for (let id = 0; id < o.count; id++) {
    const slot = gardenSlot(o, id, worldWidth), individuality = ((o.seed * 31 + id * 233) % 997) / 997 * TAU;
    const role = o.individuals[id]?.role ?? (o.scene === 'tidal-duet' && id < o.count - o.count % 2 ? 'partner' : roles[id % roles.length]!);
    const p = wrap(progress - (o.choreography === 'hold' ? 0 : id * o.stagger / o.duration));
    const arc = arcAt(p), flow = Math.tanh(o.current * 3);
    let facing: 'left' | 'right' = o.individuals[id]?.facing ?? (o.scene === 'tidal-duet' ? (id % 2 ? 'left' : 'right') : o.facing);
    let grip = 1, freeX = slot.x, freeY = slot.y, curlOffset = 0;
    let motive: SeahorseMotive = { kind: 'anchored', anchorId: id };
    const mirror = facing === 'left' ? 1 : -1;
    let rotation = .028 * Math.sin(t * .55 + individuality) + o.current * .09 * mirror;
    const rest = clamp((p - .18) / .5, 0, 1), restWave = Math.sin(Math.PI * rest) ** 2;
    if (o.scene === 'study') {
      // A toy-sized portrait still has a real hold. Hover/curious add a gentle
      // tail-led sway; holdfast stays quieter. All deliberate cues work here.
      grip = 1;
      rotation += o.sway * (o.behavior === 'holdfast' ? .06 : .24) * Math.sin(t * .65 + individuality);
      motive = { kind: 'anchored', anchorId: id };
    } else if (arc === 'arrival' || arc === 'return') {
      const a = arc === 'arrival' ? smooth(p / .18) : smooth((p - .87) / .13);
      // End and start of each loop meet at exactly the same free pose and zero route velocity.
      const arriving = arc === 'arrival' ? a : 1 - a;
      grip = smooth((arriving - .65) / .35);
      freeX += flow * .58 * slot.scale * (1 - arriving); freeY += .38 * slot.scale * (1 - arriving);
      motive = { kind: arc === 'arrival' ? 'arriving' : 'returning' };
    } else if (arc === 'depart') {
      const a = smooth((p - .68) / .19); grip = 1 - smooth(a * 3);
      freeX -= flow * .64 * slot.scale * a; freeY -= .36 * slot.scale * a;
      // Return stage begins at this same pose, then arcs below to the arrival side.
      motive = { kind: 'drifting' };
    } else if (o.scene === 'tidal-duet' && role === 'partner' && (id ^ 1) < o.count) {
      grip = 1 - smooth(restWave * 3);
      const partner = gardenSlot(o, id ^ 1, worldWidth), center = (slot.x + partner.x) / 2;
      freeX = mix(slot.x, center + (id % 2 ? .73 : -.73) * slot.scale, restWave * .72);
      freeY -= slot.scale * (.88 * restWave + .07 * Math.sin(t * .8 + id * Math.PI) * restWave);
      rotation += (id % 2 ? -.08 : .08) * restWave;
      motive = { kind: 'duet', partnerId: id ^ 1 };
    } else if (o.scene === 'drift-passage') {
      grip = 1 - smooth(restWave * 4);
      freeX += flow * Math.sin((rest - .5) * Math.PI) * Math.min(.9, worldWidth * .18) * restWave;
      freeY -= .55 * slot.scale * restWave; rotation += o.current * .12 * restWave;
      motive = { kind: 'drifting' };
    } else {
      const wander = role === 'explorer' ? .95 : role === 'partner' ? .6 : role === 'dreamer' ? .22 : 0;
      const excursion = restWave * wander * (1 - smooth((Math.abs(o.current) - .55) / .35));
      grip = 1 - excursion; freeX += Math.cos(t * .36 + individuality) * .42 * slot.scale * excursion;
      freeY -= slot.scale * (.25 + .08 * Math.sin(t * .7 + individuality)) * excursion;
      if (excursion > .1) motive = { kind: 'drifting' };
    }
    if (o.scene !== 'study' && arc === 'return') {
      const a = smooth((p - .87) / .13);
      freeX = slot.x + flow * slot.scale * mix(-.64, .58, a); freeY = slot.y + slot.scale * (mix(-.36, .38, a) + .22 * Math.sin(a * Math.PI));
      grip = 0;
    }
    let attention = 0;
    if (d.attention && id === d.selected) {
      // The head and rigid tubular snout turn together; no flexible-straw snout.
      attention = clamp((freeY - 1.35 * slot.scale - s.targetY * worldHeight / 2) * .16, -.16, .16);
      rotation += clamp((s.targetX * worldWidth / 2 - freeX) * .10, -.10, .10) * mirror;
      freeY += clamp(s.targetY * worldHeight / 2 - freeY, -1, 1) * .10 * slot.scale * (1 - grip);
      if (motive.kind === 'drifting') motive = { kind: 'inspecting' };
    }
    const cue = d.cues[id];
    if (cue) {
      const age = s.tick - cue.start + cue.posterAge, u = clamp(age / cueDuration[cue.type], 0, 1);
      const recovering = u >= .65;
      if (cue.type === 'release') {
        // 0–24: look/uncurl while held. 24–66: let go. 66–145: hover.
        // 145–210: tail leads back to the moving blade. 210–240: rewrap/settle.
        const travel = smooth((age - 24) / 42) * (1 - smooth((age - 145) / 65));
        const unroll = smooth((age - 8) / 46) * (1 - smooth((age - 180) / 60));
        curlOffset -= .72 * unroll;
        // Shyness has a cause: retreat away from the recorded approach. A
        // centered/no-guide release follows the current. Snapshot the input so
        // leaving the canvas for the button cannot erase the chosen direction.
        const away = clamp(flow * .30 - cue.approachX * .90, -1, 1);
        grip *= 1 - travel; freeX += away * .70 * slot.scale * travel;
        freeY += (.08 - cue.approachY * .16) * slot.scale * travel;
        const tuck = smooth(age / 24) * (1 - smooth((age - 165) / 75));
        rotation += away * .13 * mirror * travel;
        attention -= .17 * tuck;
        motive = { kind: age >= 145 ? 'recovering' : 'drifting' };
      } else if (cue.type === 'anchor') {
        const envelope = smooth(age / 54) * (1 - smooth((age - 120) / 60));
        grip = mix(grip, 1, envelope);
        curlOffset += .08 * envelope;
        motive = recovering ? { kind: 'recovering' } : { kind: 'anchored', anchorId: id };
      } else if (cue.type === 'inspect') {
        // Notice first, then pivot the stiff trunk from the held tail. Visitors
        // already in open water keep their route instead of snapping to a hold.
        const notice = smooth(age / 30) * (1 - smooth((age - 130) / 50));
        const approach = smooth((age - 24) / 50) * (1 - smooth((age - 112) / 68));
        const direction = d.attention ? clamp(s.targetX * worldWidth / 2 - freeX, -.7, .7) : -.5 * mirror;
        freeX += direction * .26 * slot.scale * approach * (1 - grip);
        rotation += direction * .16 * mirror * approach;
        attention += .14 * notice; curlOffset += .05 * notice;
        motive = { kind: recovering ? 'recovering' : 'inspecting' };
      } else {
        // Coil tension anticipates the lean by 24 ticks; release that tension
        // after the torso has eased back. Direction remains continuous at zero.
        const tension = smooth(age / 28) * (1 - smooth((age - 174) / 66));
        const brace = smooth((age - 24) / 48) * (1 - smooth((age - 144) / 72));
        grip = mix(grip, 1, tension); curlOffset += .18 * tension;
        rotation -= flow * .36 * mirror * brace;
        attention += flow * .16 * mirror * brace;
        motive = { kind: recovering ? 'recovering' : 'startled' };
      }
    }
    grip = clamp(grip, 0, 1);
    const curl = clamp(.18 + grip * .82 + curlOffset, .10, 1.18);
    const contact = rotateLocal(tailContact(curl), rotation, facing, slot.scale);
    // Solve translation around the actual tail endpoint. Mirroring and scale cannot detach it.
    const anchor = eelgrassPoint(o, slot, id, t, slot.anchor.y);
    // Reserve the transformed anatomy and label footprint before blending toward a grip.
    // This also protects narrow permitted grids and a four-visitor rising duet.
    const corners = [[-1.06, -2.15], [1.04, -2.15], [-1.06, 1.90], [1.04, 1.90]] as const;
    const bounds = corners.map(([x, y]) => rotateLocal({ x, y }, rotation, facing, slot.scale));
    const margin = worldHeight / o.rows * .55;
    freeX = clamp(freeX, -worldWidth / 2 - Math.min(...bounds.map(p => p.x)) + margin, worldWidth / 2 - Math.max(...bounds.map(p => p.x)) - margin);
    freeY = clamp(freeY, -worldHeight / 2 - Math.min(...bounds.map(p => p.y)) + margin, worldHeight / 2 - Math.max(...bounds.map(p => p.y)) - margin);
    const attachedX = anchor.x - contact.x, attachedY = anchor.y - contact.y;
    const x = mix(freeX, attachedX, grip), y = mix(freeY, attachedY, grip);
    const anchorId = grip >= 1 - 1e-9 ? id : null;
    if (anchorId !== null && motive.kind === 'drifting') motive = { kind: 'anchored', anchorId };
    if (anchorId === null && motive.kind === 'anchored') motive = { kind: arc === 'arrival' ? 'arriving' : 'recovering' };
    members.push(Object.freeze({ id, name: ['Fern', 'Pip', 'Lumen', 'Tide'][id]!, role, x, y, scale: slot.scale, facing,
      rotation, curl, attention, motive: Object.freeze(motive), anchorId,
      anchor: anchorId === null ? null : Object.freeze({ ...anchor }), tailTip: Object.freeze({ x: x + contact.x, y: y + contact.y }) }));
  }
  return Object.freeze({ scene: o.scene, arc: arcAt(progress), progress, selected: d.selected, current: o.current,
    worldWidth, worldHeight, members: Object.freeze(members) });
}

/** Brass Button: an authored contour character, not a shaded point cloud.
 * The eye, three crown nubs, short tube and generous tail are the main marks.
 * All visible strokes remain printable ASCII and use the existing cell buffer.
 */
type AnimalInk = (x: number, y: number, tone: number, glyph?: string, depth?: number) => void;
interface CharacterActing { brace: number; shy: number; peek: number; look: number }
const MIRRORED_GLYPHS: Readonly<Record<string, string>> = Object.freeze({
  '/': '\\', '\\': '/', '(': ')', ')': '(', '<': '>', '>': '<', '[': ']', ']': '[',
});
function characterActing(cue: Cue | null | undefined, s: SeahorseState, current = 0): CharacterActing {
  if (!cue) return { brace: 0, shy: 0, peek: 0, look: s.targetX };
  const age = s.tick - cue.start + cue.posterAge;
  return {
    brace: cue.type === 'startle' ? smooth((age - 20) / 34) * (1 - smooth((age - 144) / 72)) : 0,
    shy: cue.type === 'release' ? smooth(age / 28) * (1 - smooth((age - 142) / 68)) : 0,
    peek: cue.type === 'release' ? smooth((age - 168) / 32) * (1 - smooth((age - 216) / 24)) : 0,
    look: cue.type === 'startle' ? -Math.tanh(current * 4) * smooth(age / 18) : cue.approachX,
  };
}
function paintSeahorse(m: Pick<SeahorseMember, 'id' | 'rotation' | 'curl' | 'attention' | 'anchorId' | 'facing'>,
  step: number, t: number, tick: number, seed: number, ink: AnimalInk,
  acting: CharacterActing = { brace: 0, shy: 0, peek: 0, look: 0 }): void {
  const localTime = t + m.id * .53 + ((seed * 31 + m.id * 233) % 997) / 997 * TAU;
  const tangentGlyph = (dx: number, dy: number) => Math.abs(dy) < Math.abs(dx) * .42 ? '=' :
    Math.abs(dx) < Math.abs(dy) * .42 ? '|' : dx * dy < 0 ? '/' : '\\';
  const line = (a: SeahorsePoint, b: SeahorsePoint, tone = 8, depth = 4.1, glyph?: string, emit = ink) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / step));
    for (let j = 0; j <= n; j++) emit(mix(a.x, b.x, j / n), mix(a.y, b.y, j / n), tone, glyph ?? tangentGlyph(dx, dy), depth);
  };
  const path = (points: readonly (readonly [number, number])[], tone = 8, depth = 4.1, emit = ink) => {
    for (let j = 1; j < points.length; j++) line({ x: points[j - 1]![0], y: points[j - 1]![1] },
      { x: points[j]![0], y: points[j]![1] }, tone, depth, undefined, emit);
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, tone: number, depth: number, emit = ink) => {
    const n = Math.max(24, Math.ceil(TAU * Math.max(rx, ry) / step));
    for (let j = 0; j <= n; j++) {
      const a = j / n * TAU, co = Math.cos(a), si = Math.sin(a);
      emit(cx + co * rx, cy + si * ry, tone, Math.abs(si) > .84 ? '=' : Math.abs(co) > .78 ? (co < 0 ? '(' : ')') : co * si < 0 ? '/' : '\\', depth);
    }
  };
  const mask = (outline: readonly (readonly [number, number])[], depth: number) => {
    const minY = Math.min(...outline.map(p => p[1])), maxY = Math.max(...outline.map(p => p[1]));
    for (let y = minY; y <= maxY; y += step) {
      const crossings: number[] = [];
      for (let j = 0; j < outline.length; j++) {
        const a = outline[j]!, b = outline[(j + 1) % outline.length]!;
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) crossings.push(a[0] + (y-a[1])/(b[1]-a[1])*(b[0]-a[0]));
      }
      crossings.sort((a,b)=>a-b);
      for (let j=0;j+1<crossings.length;j+=2) for (let x=crossings[j]!;x<=crossings[j+1]!;x+=step) ink(x,y,0,' ',depth);
    }
  };
  // Three clear rays replace the thirteen-ray mesh. All roots stay on the back.
  const fin = .025 * Math.sin(localTime * 11) * (1 + acting.brace);
  const finRoot = { x: .28, y: -.34 };
  for (const [x, y] of [[.60 + fin, -.53], [.73 + fin, -.28], [.60 + fin, .01]])
    line(finRoot, { x: x!, y: y! }, 4, 3.5, '.');
  path([[.60 + fin, -.53], [.73 + fin, -.28], [.60 + fin, .01]], 6, 3.6);

  // Preserve the shared analytic tail and its two depth crossings. A broad
  // contour ribbon gives the coil an open centre and a clearly visible grip.
  for (let k = 0; k <= 96; k++) {
    const u = k / 96, p = tailPoint(m.curl, u), before = tailPoint(m.curl, Math.max(0, u - .006));
    const after = tailPoint(m.curl, Math.min(1, u + .006));
    const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy) || 1;
    const radius = .055 * (1 - u) + .015;
    const coilAngle = -.14 + (u - .34) / .66 * Math.PI * (1.20 + 1.43 * m.curl);
    const rearArc = u > .34 && u < .94 && Math.sin(coilAngle) < -.2;
    const depth = m.anchorId !== null && rearArc ? 2.5 : 4;
    const glyph = tangentGlyph(dx, dy);
    ink(p.x - dy / length * radius, p.y + dx / length * radius, 6, glyph, depth);
    // A continuous bright core makes the grasp legible in the small portrait.
    ink(p.x, p.y, 8, '*', depth);
  }
  // A plump, continuous S-shaped trunk. Broad belly bands suggest volume
  // without a dense armour texture; the inside is intentionally quiet.
  mask([[-.38,-1.13],[-.38,-.91],[-.50,-.62],[-.57,-.30],[-.53,.03],[-.38,.32],
    [-.15,.52],[.15,.70],[.25,.56],[.33,.30],[.37,-.03],[.33,-.35],[.19,-.65],[.02,-.88],[.01,-1.12]],4.05);
  path([[-.38, -1.13], [-.38, -.91], [-.50, -.62], [-.57, -.30], [-.53, .03],
    [-.38, .32], [-.15, .52], [.15, .70], [.22, .80]], 8.5);
  path([[.01, -1.12], [.02, -.88], [.19, -.65], [.33, -.35], [.37, -.03],
    [.33, .30], [.25, .56], [.16, .70]], 7);
  for (const [y, left, right] of [[-.50, -.48, .20], [-.13, -.50, .30], [.22, -.35, .26]]) {
    const n = 10;
    for (let j = 1; j < n; j++) {
      const a = j / n;
      ink(mix(left!, right!, a), y! + .06 * Math.sin(a * Math.PI), 6, '=', 4.2);
    }
  }

  // Skull, crown, tube and expression share one short neck pivot.
  const headAngle = clamp(m.attention - m.rotation * .12 + acting.shy * -.07 + acting.peek * .07, -.28, .28);
  const head: AnimalInk = (x, y, tone, glyph, depth = 4.6) => {
    const px = x + .10, py = y + 1.08, co = Math.cos(headAngle), si = Math.sin(headAngle);
    ink(-.10 + px * co - py * si, -1.08 + px * si + py * co, tone, glyph, depth);
  };
  for (let y=-.52;y<=.52;y+=step) for (let x=-.58;x<=.58;x+=step)
    if (x*x/(.58*.58)+y*y/(.52*.52)<=1) head(-.10+x,-1.43+y,0,' ',4.55);
  ellipse(-.10, -1.43, .58, .52, 8.6, 4.6, head);
  // Short, rigid tube. Erase its attachment seam with owned blank cells.
  for (let y = -1.46; y <= -1.27; y += step) for (let x = -.70; x < -.49; x += step) head(x, y, 0, ' ', 4.65);
  path([[-.53, -1.47], [-.92, -1.43], [-1.00, -1.49], [-1.00, -1.20], [-.91, -1.26], [-.54, -1.25]], 8.5, 4.7, head);
  line({ x: -.99, y: -1.46 }, { x: -.99, y: -1.23 }, 9, 4.75, '(', head);
  // Three blunt crown nubs, not antlers. Empty gap around each keeps the read.
  for (const [x,y] of [[-.30,-1.94],[-.04,-2.03],[.23,-1.90]]) {
    line({ x: x!, y: y! + .12 }, { x: x!, y: y! }, 8, 4.7, '|', head);
    head(x!, y! - .04, 9, 'o', 4.75);
  }
  // A large anatomical side eye, with room for a directional pupil and lid.
  const ex = -.28, ey = -1.51, rx = .21, ry = .23;
  const blink = (tick + m.id * 107 + seed * 3) % 347 < 6;
  if (acting.brace > .56 || blink) {
    // A designed five-mark squint, not a densely sampled diagonal. Each mark
    // survives as one deliberate cell at phone scale; the tiny LOD keeps >.
    head(ex + .04, ey, 9, acting.brace > .56 ? '>' : '_', 4.85);
    if (acting.brace > .56 && step < .055) {
      head(ex - .16, ey - .16, 9, '\\', 4.85);
      head(ex - .06, ey - .08, 9, '\\', 4.85);
      head(ex - .06, ey + .08, 9, '/', 4.85);
      head(ex - .16, ey + .16, 9, '/', 4.85);
      head(ex - .16, ey - .27, 8, '_', 4.85);
      head(ex - .06, ey - .27, 8, '_', 4.85);
    }
  } else {
    const eyeH = ry * (1 - acting.shy * .24);
    for (let y=-eyeH;y<=eyeH;y+=step) for (let x=-rx;x<=rx;x+=step)
      if (x*x/(rx*rx)+y*y/(eyeH*eyeH)<=1) head(ex+x,ey+y,9,'O',4.8);
    const px = ex + clamp(acting.look,-1,1)*.075*(m.facing === 'left' ? 1 : -1), py = ey + .02 + acting.shy*.03 - acting.peek*.04;
    for(let y=-.115;y<=.115;y+=step) for(let x=-.075;x<=.075;x+=step)
      if(x*x/(.075*.075)+y*y/(.115*.115)<=1) head(px+x,py+y,0,' ',4.9);
    head(px + .04, py - .06, 9, '.', 4.92);
    if (acting.shy > .35) line({ x: ex - rx, y: ey - .11 }, { x: ex + rx, y: ey - .11 }, 8, 4.91, '_', head);
  }
  // One cheek mark and a tiny pectoral flick; neither competes with the eye.
  head(-.12, -1.24, 5, 'o', 4.8);
  head(.13 + .015*Math.sin(localTime*13), -1.13, 5, ')', 4.65);
}

/** One bounded ASCII grid, with depth-tested eelgrass and visible ownership. */
function renderGarden(o: SeahorseConfig, s: SeahorseState, phase: SeahorsePhase, director: SeahorseDirectorState, cues: readonly (Cue | null)[]): SeahorseFrame {
  const cols = o.columns, rows = o.rows, worldW = director.worldWidth, worldH = director.worldHeight;
  const glyphs = new Array<string>(cols * rows).fill(' '), tones = new Uint8Array(cols * rows);
  const owners = new Int8Array(cols * rows).fill(-1), layers = new Uint8Array(cols * rows), depths = new Float64Array(cols * rows);
  const chars = '.,:;+=*#%@', t = s.tick / 60 * o.speed, cellW = worldW / (cols - 1), cellH = worldH / (rows - 1);
  function world(x: number, y: number, tone: number, glyph?: string, layer = 2, owner = -1, depth = 3) {
    const col = Math.round((x / worldW + .5) * (cols - 1)), row = Math.round((y / worldH + .5) * (rows - 1));
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;
    const i = row * cols + col;
    if (depth < depths[i]!) return;
    depths[i] = depth; layers[i] = layer; owners[i] = owner;
    glyphs[i] = glyph ?? chars[clamp(Math.round(tone), 0, 9)]!;
    tones[i] = clamp(Math.round(tone), 1, 9);
  }
  // Suspended matter is sparse; fixed seed spacing avoids per-frame sparkle.
  for (let k = 0; k < 4; k++) {
    const x = (wrap(k * .6180339 + o.seed * .013 + t * o.current * .013) - .5) * worldW;
    const y = -worldH * .44 + ((k * 37 + o.seed) % 101) / 101 * worldH * .81;
    world(x, y, 1, k % 9 === 0 ? ':' : '.', 1, -1, .5);
  }
  // Far ribbons establish depth without competing with the cream plate ridges.
  for (let k = 0; k < cols; k += 8) {
    const x = (k / (cols - 1) - .5) * worldW, y = worldH * .465 + .025 * Math.sin(k * .31);
    world(x, y, 1, k % 5 === 0 ? '_' : '.', 1, -1, .9);
    if (k % 7 === 0) world(x, y - .06, 2, ',', 2, -1, 1);
  }
  // Midground holdfast blades share their exact curve with the tail constraint.
  for (const member of director.members) {
    const slot = gardenSlot(o, member.id, worldW), top = slot.anchor.y - 3.05 * slot.scale, bottom = worldH * .465;
    const n = Math.ceil((bottom - top) / (cellH * .40));
    for (let k = 0; k <= n; k++) {
      const u = k / n, y = mix(top, bottom, u), p = eelgrassPoint(o, slot, member.id, t, y);
      const halfWidth = (.025 + .030 * Math.sin(u * Math.PI)) * slot.scale;
      const cue = cues[member.id], age = cue ? s.tick - cue.start + cue.posterAge : 0;
      // During the shy passage the character crosses behind the blade, then
      // returns in front before the tail rewraps. Tail crossings retain depth 3.
      const depth = cue?.type === 'release' && age > 66 && age < 180 && y < slot.anchor.y - .4 * slot.scale ? 4.75 : 3;
      for (let x = p.x - halfWidth; x <= p.x + halfWidth; x += cellW * .4)
        world(x, y, x < p.x ? 6 : 4, x < p.x ? '/' : ':', 2, -1, depth);
      world(p.x, y, Math.abs(y - slot.anchor.y) < .32 * slot.scale ? 9 : 5, '|', 2, -1, depth);
    }
  }
  for (const m of director.members) {
    const step = Math.max(.015, cellH / m.scale * .32);
    const acting = characterActing(cues[m.id], s, o.current);
    if (!cues[m.id] && m.id !== director.selected) acting.look = 0;
    paintSeahorse(m, step, t, s.tick, o.seed, (x, y, tone, glyph, depth = 4) => {
      const p = rotateLocal({ x, y }, m.rotation, m.facing, m.scale);
      const mark = m.facing === 'right' && glyph ? MIRRORED_GLYPHS[glyph] ?? glyph : glyph;
      world(p.x + m.x, p.y + m.y, tone, mark, 3, m.id, depth);
    }, acting);
    if (acting.brace > .35 && Math.abs(o.current) > .04) {
      // Three graphic water strokes reveal the signed cause of the lean.
      const side = o.current > 0 ? -1 : 1;
      for (let row = 0; row < 3; row++) {
        const y = m.y - (.9 - row * .48) * m.scale;
        const x = m.x + side * 1.22 * m.scale;
        for (let j = 0; j < 3; j++) world(x + side * j * cellW, y, 4, j === 0 ? (side < 0 ? '>' : '<') : '~', 1, -1, 1.5);
      }
    }
    if (o.labels) {
      const label = `${String(m.id + 1).padStart(2, '0')}${m.id === director.selected ? '*' : ''}`;
      const y = m.y - 2.04 * m.scale;
      for (let i = 0; i < label.length; i++) world(m.x + (i - (label.length - 1) / 2) * worldW / cols, y, 7, label[i]!, 4, m.id, 6);
    }
  }
  // Two low near-edge leaves frame the clearing. They do not cross the contact.
  for (const side of [-1, 1]) for (let k = 0; k <= 18; k++) {
    const u = k / 18, y = worldH * .47 - u * .48;
    const x = side * worldW * (.43 - .045 * u * u) + .035 * Math.sin(t * .56 + side) * u;
    world(x, y, 3, side < 0 ? '/' : '\\', 2, -1, 5);
    if (u < .7) world(x + cellW * side, y, 2, '|', 2, -1, 5);
  }
  const layerNames = ['water', 'water', 'kelp', 'animal', 'label'] as const;
  const cells = Object.freeze(glyphs.map((glyph, i) => Object.freeze({ glyph, tone: tones[i]!, owner: owners[i]!, layer: layerNames[layers[i]!]! })));
  const text = Array.from({ length: rows }, (_, row) => glyphs.slice(row * cols, (row + 1) * cols).join('')).join('\n');
  return Object.freeze({ columns: cols, rows, cells, text, phase });
}

export interface SeahorseBrowserOptions extends SeahorseOptions { frameSource?: SeahorseFrameSource }
export interface SeahorseStatus {
  readonly paused: boolean; readonly reducedMotion: boolean; readonly hidden: boolean;
  readonly inViewport: boolean; readonly disposed: boolean; readonly phase: SeahorsePhase;
  readonly tick: number; readonly droppedSeconds: number;
}
export interface SeahorseArtwork {
  readonly species: 'seahorse'; readonly canvas: HTMLCanvasElement; readonly disposed: boolean;
  getOptions(): SeahorseConfig; getStatus(): SeahorseStatus; getFrame(): SeahorseFrame;
  getDirectorState(): SeahorseDirectorState; direct(action: SeahorseDirectorAction): void;
  update(options: SeahorseOptions): void; play(): void; pause(): void; restart(): void;
  pulse(): void; guide(x: number, y: number): void; clearGuide(): void; resize(): void; dispose(): void;
}
/** Browser-only mount, SSR-safe import. One borrowed shared scheduler, no private loop. */
export function createBrassButtonArtwork(canvas: HTMLCanvasElement, input: SeahorseBrowserOptions = {}): SeahorseArtwork {
  object(input, 'Options');
  const { frameSource, ...raw } = input;
  const model = createBrassButtonModel(raw), view = canvas?.ownerDocument?.defaultView, doc = canvas?.ownerDocument;
  if (!view || !doc) throw new TypeError('Canvas must belong to a browser document');
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas2D unavailable');
  const ctx: CanvasRenderingContext2D = context;
  const scheduler = frameSource ?? getBrowserScheduler(view), media = view.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, requestedPaused = model.getOptions().paused, inViewport = true;
  let width = 0, height = 0, droppedSeconds = 0, last: number | null = null, accumulator = 0;
  let tap: { x: number; y: number; id: number } | null = null;
  let touchGesture = false;
  let unsubscribe: (() => void) | null = null, ro: ResizeObserver | undefined, io: IntersectionObserver | undefined;
  const reduced = () => model.getOptions().reducedMotion === 'system' && media.matches;
  const blocked = () => disposed || requestedPaused || reduced() || doc.hidden || !inViewport || width <= 0 || height <= 0;
  const status = (): SeahorseStatus => Object.freeze({ paused: blocked(), reducedMotion: reduced(), hidden: doc.hidden,
    inViewport, disposed, phase: model.getPhase(), tick: model.getState().tick, droppedSeconds });
  function fit(w: number, h: number) {
    const o = model.getOptions(), aspect = o.columns * .56 / o.rows;
    const fw = Math.min(w, h * aspect), fh = fw / aspect;
    return { x: (w - fw) / 2, y: (h - fh) / 2, width: fw, height: fh };
  }
  function draw() {
    if (disposed || doc!.hidden || !inViewport || width <= 0 || height <= 0) return;
    const frame = model.frame(), o = model.getOptions();
    const box = fit(width, height);
    const cw = box.width / frame.columns, ch = box.height / frame.rows;
    ctx.fillStyle = '#09151b'; ctx.fillRect(0, 0, width, height); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.min(ch * .96, cw / .60)}px ui-monospace,SFMono-Regular,Consolas,monospace`;
    const palette = o.palette === 'brass' ? [235, 204, 154] : o.palette === 'lagoon' ? [119, 218, 204] : [227, 154, 180];
    for (let i = 0; i < frame.cells.length; i++) {
      const cell = frame.cells[i]!; if (cell.glyph === ' ') continue;
      const color = cell.layer === 'kelp' ? (cell.tone >= 8 ? [130, 200, 161] : [94, 155, 132]) :
        cell.layer === 'water' ? [65, 102, 112] : cell.glyph === 'O' ? [255, 235, 188] : palette;
      const b = .28 + cell.tone / 12;
      ctx.fillStyle = `rgb(${color.map(c => Math.round(c * b)).join(',')})`;
      ctx.fillText(cell.glyph, box.x + (i % frame.columns + .5) * cw, box.y + (Math.floor(i / frame.columns) + .5) * ch);
    }
  }
  function frame(now: number) {
    if (disposed || blocked()) { sync(); return; }
    if (last === null) { last = now; return; }
    const dt = Math.max(0, (now - last) / 1000); last = now;
    droppedSeconds += Math.max(0, dt - .1); accumulator += Math.min(.1, dt);
    const ticks = Math.min(6, Math.floor((accumulator + 1e-10) * 60));
    if (ticks) { accumulator -= ticks / 60; model.advanceTicks(ticks); draw(); }
  }
  function sync() {
    if (disposed) return;
    if (blocked()) { unsubscribe?.(); unsubscribe = null; last = null; accumulator = 0; }
    else if (!unsubscribe) { last = null; unsubscribe = scheduler.subscribe(frame); }
    draw();
  }
  function resize() {
    if (disposed) return;
    const r = canvas.getBoundingClientRect();
    width = Math.max(0, Math.min(2048, Number.isFinite(r.width) ? r.width : 0));
    height = Math.max(0, Math.min(2048, Number.isFinite(r.height) ? r.height : 0));
    const dpr = Math.min(2, Math.max(1, view!.devicePixelRatio || 1));
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); sync();
  }
  function motion() { sync(); }
  function visibility() { tap = null; touchGesture = false; sync(); }
  function guide(x: number, y: number) { if (disposed) return; model.guide(x, y); draw(); }
  function leave() { tap = null; touchGesture = false; if (disposed) return; model.clearGuide(); draw(); }
  function aim(e: PointerEvent): SeahorsePoint | null {
    const r = canvas.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return null;
    const box = fit(r.width, r.height);
    const x = (e.clientX - r.left - box.x) / box.width * 2 - 1, y = (e.clientY - r.top - box.y) / box.height * 2 - 1;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1 || Math.abs(y) > 1) return null;
    return { x, y };
  }
  function pointer(e: PointerEvent) {
    if (disposed) return;
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10) tap = null;
    // A vertical touch pan must not guide or trigger the animal on its way to
    // the browser's scrolling gesture. A confirmed tap supplies its own aim.
    if (e.pointerType === 'touch' && touchGesture) return;
    const p = aim(e); if (!p) return;
    model.guide(p.x, p.y);
    // Live input replaces one target; rendering remains owned by the scheduler.
    if (blocked()) draw();
  }
  function direct(action: SeahorseDirectorAction) { if (disposed) return; model.direct(action, blocked()); draw(); }
  function greet() { if (disposed) return; model.greet(blocked()); draw(); }
  function pointerDown(e: PointerEvent) {
    if (disposed || doc!.hidden || !inViewport || e.isPrimary === false || (e.button !== undefined && e.button !== 0) || !aim(e)) return;
    tap = { x: e.clientX, y: e.clientY, id: e.pointerId };
    touchGesture = e.pointerType === 'touch';
  }
  function touch(e: PointerEvent) {
    const start = tap; tap = null; touchGesture = false;
    if (disposed || doc!.hidden || !inViewport || !start || e.pointerId !== start.id ||
        Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) return;
    const p = aim(e); if (!p) return;
    // Use the painted silhouette, including its owned blank interior. The
    // oversized head/crown/snout must never accidentally count as open water.
    const cells = model.frame(), col = Math.floor((p.x + 1) * .5 * cells.columns), row = Math.floor((p.y + 1) * .5 * cells.rows);
    let owner = -1, distance = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = col + dx, y = row + dy;
      if (x < 0 || x >= cells.columns || y < 0 || y >= cells.rows) continue;
      const cell = cells.cells[y * cells.columns + x]!;
      if (cell.layer === 'animal' && cell.owner !== undefined && cell.owner >= 0 && dx * dx + dy * dy < distance) {
        owner = cell.owner; distance = dx * dx + dy * dy;
      }
    }
    // Resolve the image that was tapped before the new guide can turn its head.
    model.guide(p.x, p.y);
    if (owner >= 0) {
      model.direct({ type: 'select', id: owner }); model.direct({ type: 'release' }, blocked());
    } else {
      // Tap open water to send a signed current toward the character. Touch
      // never needs hover or pointer velocity; scrolling remains browser-owned.
      model.configure({ current: clamp(-p.x, -1, 1) });
      model.direct({ type: 'startle' }, blocked());
    }
    draw();
  }
  function keydown(e: KeyboardEvent) {
    if (disposed || e.target !== canvas || e.altKey || e.ctrlKey || e.metaKey) return;
    const selected = model.getDirectorState().selected, count = model.getOptions().count;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (count === 1) model.guide(e.key === 'ArrowLeft' ? -.7 : .7, model.getState().targetY);
      else model.direct({ type: 'select', id: (selected + (e.key === 'ArrowRight' ? 1 : count - 1)) % count });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') model.guide(0, e.key === 'ArrowUp' ? -.7 : .7);
    else if (e.key === 'Enter') { if (model.getOptions().scene === 'study') greet(); else model.direct({ type: 'inspect' }, blocked()); }
    else if (e.key.toLowerCase() === 'h') model.direct({ type: 'anchor' }, blocked());
    else if (e.key.toLowerCase() === 'r') model.direct({ type: 'release' }, blocked());
    else if (e.key.toLowerCase() === 'b') model.direct({ type: 'startle' }, blocked());
    else if (e.key === 'Escape') model.clearGuide();
    else if (e.key === ' ') { requestedPaused = !requestedPaused; sync(); }
    else return;
    e.preventDefault(); draw();
  }
  function dispose() {
    if (disposed) return; disposed = true; unsubscribe?.(); unsubscribe = null;
    ro?.disconnect(); io?.disconnect(); media.removeEventListener('change', motion);
    doc!.removeEventListener('visibilitychange', visibility); view!.removeEventListener('resize', resize);
    tap = null;
    canvas.removeEventListener('pointermove', pointer); canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointerup', touch);
    canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('pointercancel', leave); canvas.removeEventListener('lostpointercapture', leave); canvas.removeEventListener('keydown', keydown);
  }
  try {
    if ((requestedPaused || reduced()) && model.getOptions().scene !== 'study') model.direct({ type: 'seek', progress: .42 });
    media.addEventListener('change', motion); doc.addEventListener('visibilitychange', visibility); view.addEventListener('resize', resize);
    canvas.addEventListener('pointermove', pointer); canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointerup', touch);
    canvas.addEventListener('pointerleave', leave); canvas.addEventListener('pointercancel', leave); canvas.addEventListener('lostpointercapture', leave); canvas.addEventListener('keydown', keydown);
    const host = view as Window & { ResizeObserver?: typeof ResizeObserver; IntersectionObserver?: typeof IntersectionObserver };
    if (host.ResizeObserver) { ro = new host.ResizeObserver(resize); ro.observe(canvas); }
    if (host.IntersectionObserver) {
      inViewport = false;
      io = new host.IntersectionObserver(entries => {
        if (disposed) return;
        inViewport = entries.some(e => e.isIntersecting);
        if (!inViewport) { tap = null; touchGesture = false; }
        sync();
      });
      io.observe(canvas);
    }
    resize();
  } catch (error) { dispose(); throw error; }
  return Object.freeze({ species: 'seahorse', canvas, get disposed() { return disposed; },
    getOptions: () => Object.freeze({ ...model.getOptions(), paused: requestedPaused }), getStatus: status,
    getFrame: () => model.frame(), getDirectorState: () => model.getDirectorState(), direct,
    update(patch: SeahorseOptions) { if (disposed) return; model.configure(patch); if (patch.paused !== undefined) requestedPaused = patch.paused; sync(); },
    play() { if (disposed) return; requestedPaused = false; sync(); },
    pause() { if (disposed) return; requestedPaused = true; sync(); },
    restart() { if (disposed) return; model.reset(); last = null; accumulator = 0; sync(); },
    pulse: greet, guide, clearGuide: leave, resize, dispose,
  });
}
