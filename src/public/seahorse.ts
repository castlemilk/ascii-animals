import { getBrowserScheduler } from '../core/scheduler.js';

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
export const SEAHORSE_DEFAULTS: SeahorseConfig = Object.freeze({
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
  for (const key of Object.keys(patch)) if (!Object.hasOwn(SEAHORSE_DEFAULTS, key)) throw new TypeError(`Unknown seahorse option ${key}`);
  const candidate = { ...base };
  for (const key of Object.keys(SEAHORSE_DEFAULTS) as (keyof SeahorseOptions)[]) {
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
export function normalizeSeahorseOptions(patch: SeahorseOptions = {}): SeahorseConfig { return resolve(patch, SEAHORSE_DEFAULTS); }

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
interface Cue { type: CueType; start: number; posterAge: number }
const cueDuration: Record<CueType, number> = { release: 240, anchor: 180, inspect: 180, startle: 240 };
const posterAge: Record<CueType, number> = { release: 90, anchor: 70, inspect: 70, startle: 50 };
interface DirectorInput { sceneTicks: number; selected: number; attention: boolean; cues: readonly (Cue | null)[] }

/** Pure 60 Hz model. Explicit stepping is independent of browser motion policy. */
export function createSeahorseModel(input: SeahorseOptions = {}): SeahorseModel {
  let options = normalizeSeahorseOptions(input), tick = 0, responseTick: number | null = null, targetX = 0, targetY = 0;
  let sceneTicks = options.choreography === 'hold' ? options.duration * 60 * .42 : 0, selected = 0, attention = false;
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
    cues[id] = { type: action.type, start: tick, posterAge: poster ? posterAge[action.type] : 0 };
  }
  return Object.freeze({ getOptions: () => options, getState: state, getPhase: phase, getDirectorState: director,
    configure(patch: SeahorseOptions) {
      const next = resolve(patch, options); // all validation occurs before any state mutation
      if (next.scene !== options.scene || next.seed !== options.seed) { sceneTicks = next.choreography === 'hold' ? next.duration * 60 * .42 : 0; cues.fill(null); clear(); }
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
      targetX = clamp(x, -1, 1); targetY = clamp(y, -1, 1); attention = true;
    }, clearGuide: clear,
    greet(poster = false) {
      if (typeof poster !== 'boolean') throw new TypeError('Poster flag must be boolean');
      if (responseTick === null) { responseTick = tick - (poster ? 70 : 0); direct({ type: 'inspect' }, poster); }
    }, direct,
    reset() { tick = 0; sceneTicks = options.choreography === 'hold' ? options.duration * 60 * .42 : 0; responseTick = null; selected = 0; cues.fill(null); clear(); },
    frame() { return options.scene === 'study' && options.count === 1 ? renderStudy(options, state(), phase()) : renderGarden(options, state(), phase(), director()); },
  });
}

/** The end of the same spiral used by the renderer, before the body transform. */
function tailContact(curl: number): SeahorsePoint {
  const radius = .43 - curl * .13, angle = -.15 + Math.PI * 2.05;
  return { x: .27 - radius + radius * .32 * Math.cos(angle), y: 1.34 + radius * .32 * Math.sin(angle) };
}
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
  const scale = Math.min(requested, worldWidth / across / 2.5, 6.2 / down / 6.6);
  const x = (col - (columnsHere - 1) / 2) * worldWidth / across * .82;
  const y = (row - (down - 1) / 2) * 6.2 / down + (down === 1 && o.count > 1 ? (id % 2 ? -.25 : .18) : 0);
  return { x, y, scale, anchor: { x: x - .10 * scale, y: y + 1.35 * scale } };
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
    let grip = 1, freeX = slot.x, freeY = slot.y, curl = 1;
    let motive: SeahorseMotive = { kind: 'anchored', anchorId: id };
    let rotation = .035 * Math.sin(t * .55 + individuality) + o.current * .09;
    const rest = clamp((p - .18) / .5, 0, 1), restWave = Math.sin(Math.PI * rest) ** 2;
    if (o.scene === 'study') {
      grip = o.behavior === 'holdfast' ? 1 : 0;
      freeX += o.sway * Math.sin(t * .45 + individuality);
      freeY += o.sway * .6 * Math.sin(t * .68 + individuality);
      motive = grip === 1 ? { kind: 'anchored', anchorId: id } : { kind: 'drifting' };
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
      attention = clamp((s.targetX * worldWidth / 2 - freeX) * .22, -.16, .16);
      rotation += attention;
      freeY += clamp(s.targetY * worldHeight / 2 - freeY, -1, 1) * .10 * slot.scale * (1 - grip);
      if (motive.kind === 'drifting') motive = { kind: 'inspecting' };
    }
    const cue = d.cues[id];
    if (cue) {
      const age = s.tick - cue.start + cue.posterAge, u = clamp(age / cueDuration[cue.type], 0, 1);
      const envelope = smooth(u / .18) * (1 - smooth((u - .65) / .35));
      const recovering = u >= .65;
      if (cue.type === 'release') {
        grip *= 1 - envelope; freeX += flow * .62 * slot.scale * envelope; freeY -= .32 * slot.scale * envelope;
        motive = { kind: recovering ? 'recovering' : 'drifting' };
      } else if (cue.type === 'anchor') {
        grip = mix(grip, 1, envelope);
        motive = recovering ? { kind: 'recovering' } : { kind: 'anchored', anchorId: id };
      } else if (cue.type === 'inspect') {
        grip *= 1 - envelope * .65;
        freeX += clamp(s.targetX * worldWidth / 2 - freeX, -.65, .65) * envelope * .6;
        freeY -= .22 * slot.scale * envelope; attention += .1 * envelope; rotation += .08 * envelope;
        motive = { kind: recovering ? 'recovering' : 'inspecting' };
      } else {
        grip = mix(grip, 1, envelope); rotation -= flow * .18 * envelope;
        freeY += .16 * slot.scale * envelope;
        motive = { kind: recovering ? 'recovering' : 'startled' };
      }
    }
    grip = clamp(grip, 0, 1); curl = .18 + grip * .82;
    const contact = rotateLocal(tailContact(curl), rotation, facing, slot.scale);
    // Solve translation around the actual tail endpoint. Mirroring and scale cannot detach it.
    const anchor = slot.anchor;
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

/** Pure logical-cell rendering; no DOM, font, random or wall-clock dependency. */
function renderStudy(o:SeahorseConfig,s:SeahorseState,phase:SeahorsePhase):SeahorseFrame {
  const cols=o.columns,rows=o.rows,worldH=5.05,worldW=worldH*cols*.56/rows;
  const glyphs=new Array<string>(cols*rows).fill(' '), tones=new Uint8Array(cols*rows);
  const t=s.tick/60*o.speed,seedPhase=(o.seed%997)/997*TAU;
  const response=s.responseTick===null?0:Math.sin(Math.PI*clamp((s.tick-s.responseTick)/180,0,1));
  const sway=o.behavior==='holdfast'?o.sway*.15:o.sway;
  const lean=.045*Math.sin(t*.7+seedPhase)+(o.behavior==='curious'?.08*s.targetX:0)+response*.065;
  const dx=sway*Math.sin(t*.45+seedPhase),dy=sway*.6*Math.sin(t*.68+seedPhase)+(o.behavior==='curious'?s.targetY*.1:0);
  const co=Math.cos(lean),si=Math.sin(lean),mirror=o.facing==='left'?1:-1;
  const chars='.,:;+=*#%@';
  function point(x:number,y:number,tone:number,glyph?:string,animal=true) {
    if(animal){const xx=(x*co-y*si)*o.scale*mirror+dx; y=(x*si+y*co)*o.scale+dy; x=xx;}
    const c=Math.round((x/worldW+.5)*(cols-1)),r=Math.round((y/worldH+.5)*(rows-1));
    if(c<0||c>=cols||r<0||r>=rows)return;
    const i=r*cols+c;glyphs[i]=glyph??chars[clamp(Math.round(tone),0,chars.length-1)]!;tones[i]=clamp(Math.round(tone),1,9);
  }
  function disk(x:number,y:number,r:number,tone:number,glyph?:string){
    const step=worldH/rows*.35;
    for(let yy=-r;yy<=r;yy+=step)for(let xx=-r;xx<=r;xx+=step)if(xx*xx+yy*yy<=r*r)point(x+xx,y+yy,tone,glyph);
    point(x,y,tone,glyph);
  }
  function line(x1:number,y1:number,x2:number,y2:number,r:number,tone:number,glyph?:string){
    const n=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/(.6*worldH/rows)));
    for(let k=0;k<=n;k++){const a=k/n;disk(x1+(x2-x1)*a,y1+(y2-y1)*a,r,tone,glyph);}
  }
  function ellipse(cx:number,cy:number,rx:number,ry:number,tone:number,rings=false){
    const step=worldH/rows*.35;
    for(let y=-ry;y<=ry;y+=step)for(let x=-rx;x<=rx;x+=step){const q=x*x/(rx*rx)+y*y/(ry*ry);if(q>1)continue;const lighting=tone+(1-q)*2-x/rx*.6;const band=rings&&Math.floor((y+ry)*25)%4===0;point(cx+x,cy+y,band?lighting+1.7:lighting,band?'=':undefined);}
  }
  // A quiet holdfast frond is an environmental attachment, never a replacement tail.
  if(o.behavior==='holdfast')for(let k=0;k<60;k++){const y=.9+k*.026,x=.24+.08*Math.sin(k*.08);point(x,y,2,'|',false);if(k%10===0)for(let j=1;j<7;j++)point(x+j*.05,y-j*.02,2,'/',false);}
  // Dorsal fin sits behind the bony trunk. Its independently phased rays flutter.
  for(let k=0;k<14;k++){const a=k/13,flutter=.05*Math.sin(t*15+k*.55);line(.37,-.60+a*.72,.80+flutter+.12*Math.sin(a*Math.PI),-.66+a*.85,.014,3,':');}
  // Tapering curved tail with a visible interior and a rounded spiral end.
  const curl=o.behavior==='holdfast'?1:response*.75;
  const tail: [number,number][]=[];
  for(let k=0;k<=30;k++){const a=k/30;tail.push([.20+.10*Math.sin(a*Math.PI),.65+a*.65]);}
  const radius=.43-curl*.10;
  for(let k=0;k<=100;k++){const a=k/100,angle=-.15+a*Math.PI*2.05,r=radius*(1-a*.68);tail.push([.27-radius+r*Math.cos(angle),1.34+r*Math.sin(angle)]);}
  for(let k=1;k<tail.length;k++){const a=tail[k-1]!,b=tail[k]!,f=k/tail.length;line(a[0],a[1],b[0],b[1],.12*(1-f)+.025,5.5+f*1.5);}
  ellipse(.17,-.10,.37,.91,5.4,true);
  // Slender S-shaped neck rises from the breast into the head.
  const neck:[number,number][]=[[.10,-.70],[-.12,-.91],[-.29,-1.10],[-.23,-1.30],[-.07,-1.42]];
  for(let k=1;k<neck.length;k++){const a=neck[k-1]!,b=neck[k]!;line(a[0],a[1],b[0],b[1],.15,6.2);}
  ellipse(-.24,-1.41,.30,.23,6.5);
  line(-.44,-1.40,-.90,-1.29,.085,6.8);line(-.90,-1.34,-.91,-1.24,.02,9,'|');
  // Coronet and small back spines establish a seahorse rather than a generic fish.
  for(let k=0;k<4;k++){const x=-.35+k*.105;line(x,-1.58,x+.025,-1.76+(k%2)*.07,.028,7);}
  for(let k=0;k<9;k++){const y=-.67+k*.15;line(.39,y,.48,y+.05,.024,6);}
  // Pectoral fin below the head has a faster rhythm than the dorsal fan.
  for(let k=0;k<7;k++)line(-.13,-1.22,.12+.045*Math.sin(t*19+k),-1.20+k*.045,.013,3,'.');
  point(-.36,-1.46,9,'@');point(-.35,-1.48,9,'o');
  const cells=Object.freeze(glyphs.map((glyph,i)=>Object.freeze({glyph,tone:tones[i]!})));
  let text='';for(let r=0;r<rows;r++)text+=glyphs.slice(r*cols,(r+1)*cols).join('')+(r===rows-1?'':'\n');
  return Object.freeze({columns:cols,rows,cells,text,phase});
}

/** One bounded logical grid for the whole ensemble; ownership follows visible glyphs. */
function renderGarden(o: SeahorseConfig, s: SeahorseState, phase: SeahorsePhase, director: SeahorseDirectorState): SeahorseFrame {
  const cols = o.columns, rows = o.rows, worldW = director.worldWidth, worldH = director.worldHeight;
  const glyphs = new Array<string>(cols * rows).fill(' '), tones = new Uint8Array(cols * rows);
  const owners = new Int8Array(cols * rows).fill(-1), layers = new Uint8Array(cols * rows);
  const chars = '.,:;+=*#%@', t = s.tick / 60 * o.speed;
  function world(x: number, y: number, tone: number, glyph?: string, layer = 2, owner = -1) {
    const col = Math.round((x / worldW + .5) * (cols - 1)), row = Math.round((y / worldH + .5) * (rows - 1));
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;
    const i = row * cols + col;
    if (layer < layers[i]!) return;
    layers[i] = layer; owners[i] = owner;
    glyphs[i] = glyph ?? chars[clamp(Math.round(tone), 0, 9)]!;
    tones[i] = clamp(Math.round(tone), 1, 9);
  }
  // Sparse current tracers and the sea bed: deterministic, bounded, behind the animals.
  for (let k = 0; k < 28; k++) {
    const x = (wrap(k * .6180339 + o.seed * .013 + t * o.current * .013) - .5) * worldW;
    const y = -worldH * .43 + ((k * 37 + o.seed) % 101) / 101 * worldH * .80;
    world(x, y, 1, k % 7 === 0 ? ':' : '.', 1);
  }
  for (let k = 0; k < cols; k += 2) world((k / (cols - 1) - .5) * worldW, worldH * .465 + .025 * Math.sin(k * .3), 1, k % 6 ? '.' : '_', 1);
  for (const member of (o.scene === 'study' && o.behavior !== 'holdfast' ? [] : director.members)) {
    const slot = gardenSlot(o, member.id, worldW), anchor = slot.anchor;
    const top = anchor.y - 2.65 * slot.scale, bottom = worldH * .465;
    const stemX = (y: number) => {
      const distance = anchor.y - y;
      return anchor.x + Math.sin(distance * 1.3) * .12 * slot.scale + distance * (.19 + o.current * .10) +
        Math.sin(t * .7 + member.id) * .035 * distance;
    };
    const n = Math.ceil((bottom - top) / (worldH / rows * .45));
    for (let k = 0; k <= n; k++) {
      const y = mix(top, bottom, k / n), x = stemX(y);
      world(x, y, 3, '|', 2);
      if (k % 10 === 3) {
        const side = Math.floor(k / 10) % 2 ? 1 : -1;
        for (let j = 1; j <= 8; j++) {
          const a = j / 8, leafY = y - Math.sin(a * Math.PI) * .14 * slot.scale;
          world(x + side * a * .42 * slot.scale, leafY, 2, side > 0 ? '/' : '\\', 2);
        }
      }
    }
    // A visible attachment node has the exact coordinates used by the constraint.
    world(anchor.x, anchor.y, member.anchorId === null ? 3 : 6, member.anchorId === null ? '+' : '*', 2);
  }
  for (const m of director.members) {
    const seedPhase = ((o.seed * 31 + m.id * 233) % 997) / 997 * TAU;
    const localTime = t + m.id * .53 + seedPhase;
    const step = Math.max(.018, worldH / rows / m.scale * .42);
    function point(x: number, y: number, tone: number, glyph?: string) {
      const p = rotateLocal({ x, y }, m.rotation, m.facing, m.scale);
      world(p.x + m.x, p.y + m.y, tone, glyph, 3, m.id);
    }
    function disk(x: number, y: number, radius: number, tone: number, glyph?: string) {
      for (let yy = -radius; yy <= radius; yy += step) for (let xx = -radius; xx <= radius; xx += step) {
        if (xx * xx + yy * yy <= radius * radius) point(x + xx, y + yy, tone, glyph);
      }
      point(x, y, tone, glyph);
    }
    function line(x1: number, y1: number, x2: number, y2: number, radius: number, tone: number, glyph?: string) {
      const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step));
      for (let k = 0; k <= n; k++) disk(mix(x1, x2, k / n), mix(y1, y2, k / n), radius, tone, glyph);
    }
    function ellipse(cx: number, cy: number, rx: number, ry: number, tone: number, bands = false) {
      for (let y = -ry; y <= ry; y += step) for (let x = -rx; x <= rx; x += step) {
        const q = x * x / (rx * rx) + y * y / (ry * ry);
        if (q > 1) continue;
        const band = bands && Math.floor((y + ry) * 21) % 4 === 0;
        point(cx + x, cy + y, tone + (1 - q) * 1.4 - x / rx * .6 + (band ? .7 : 0), band ? '=' : undefined);
      }
    }
    // Flutter is local to the fin; trunk, neck and tail keep their attachment points.
    for (let k = 0; k < 12; k++) {
      const a = k / 11, flutter = .05 * Math.sin(localTime * 15 + k * .55);
      line(.37, -.60 + a * .72, .76 + flutter + .10 * Math.sin(a * Math.PI), -.66 + a * .85, .012, 3, ':');
    }
    const tail: SeahorsePoint[] = [];
    for (let k = 0; k <= 22; k++) { const a = k / 22; tail.push({ x: .20 + .10 * Math.sin(a * Math.PI), y: .65 + a * .65 }); }
    const radius = .43 - m.curl * .13;
    for (let k = 0; k <= 70; k++) {
      const a = k / 70, angle = -.15 + a * Math.PI * 2.05, r = radius * (1 - a * .68);
      tail.push({ x: .27 - radius + r * Math.cos(angle), y: 1.34 + r * Math.sin(angle) });
    }
    for (let k = 1; k < tail.length; k++) {
      const a = tail[k - 1]!, b = tail[k]!, f = k / tail.length;
      line(a.x, a.y, b.x, b.y, .105 * (1 - f) + .02, 5.5 + f * 1.5);
    }
    ellipse(.17, -.10, .37, .91, 5.4, true);
    const neck: [number, number][] = [[.10, -.70], [-.12, -.91], [-.29, -1.10], [-.23, -1.30], [-.07, -1.42]];
    for (let k = 1; k < neck.length; k++) { const a = neck[k - 1]!, b = neck[k]!; line(a[0], a[1], b[0], b[1], .15, 6.2); }
    // The short articulated snout aims without stretching the neck or moving the tail grip.
    const snoutLift = m.attention * .42;
    ellipse(-.24, -1.41, .30, .23, 6.5);
    line(-.44, -1.40, -.90, -1.29 + snoutLift, .075, 7);
    line(-.90, -1.34 + snoutLift, -.91, -1.24 + snoutLift, .015, 9, '|');
    for (let k = 0; k < 4; k++) { const x = -.35 + k * .105; line(x, -1.58, x + .025, -1.76 + (k % 2) * .07, .023, 7); }
    for (let k = 0; k < 9; k++) { const y = -.67 + k * .15; line(.39, y, .48, y + .05, .02, 6); }
    for (let k = 0; k < 6; k++) line(-.13, -1.22, .12 + .035 * Math.sin(localTime * 19 + k), -1.20 + k * .045, .01, 3, '.');
    const blink = (s.tick + m.id * 107 + o.seed * 3) % 347 < 8;
    point(-.36, -1.46, 9, blink ? '-' : '@');
    if (o.labels) {
      const label = `${String(m.id + 1).padStart(2, '0')}${m.id === director.selected ? '*' : ''}`;
      const y = m.y - 2.04 * m.scale;
      for (let i = 0; i < label.length; i++) world(m.x + (i - (label.length - 1) / 2) * worldW / cols, y, 7, label[i]!, 4, m.id);
    }
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
export function createSeahorseArtwork(canvas: HTMLCanvasElement, input: SeahorseBrowserOptions = {}): SeahorseArtwork {
  object(input, 'Options');
  const { frameSource, ...raw } = input;
  const model = createSeahorseModel(raw), view = canvas?.ownerDocument?.defaultView, doc = canvas?.ownerDocument;
  if (!view || !doc) throw new TypeError('Canvas must belong to a browser document');
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas2D unavailable');
  const ctx: CanvasRenderingContext2D = context;
  const scheduler = frameSource ?? getBrowserScheduler(view), media = view.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, requestedPaused = model.getOptions().paused, inViewport = true;
  let width = 0, height = 0, droppedSeconds = 0, last: number | null = null, accumulator = 0;
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
    if (disposed || width <= 0 || height <= 0) return;
    const frame = model.frame(), o = model.getOptions();
    const box = o.scene === 'study' && o.count === 1 ? { x: 0, y: 0, width, height } : fit(width, height);
    const cw = box.width / frame.columns, ch = box.height / frame.rows;
    ctx.fillStyle = '#09151b'; ctx.fillRect(0, 0, width, height); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.min(ch * .94, cw / .60)}px ui-monospace,SFMono-Regular,Consolas,monospace`;
    const palette = o.palette === 'brass' ? [232, 185, 105] : o.palette === 'lagoon' ? [119, 218, 204] : [227, 154, 180];
    for (let i = 0; i < frame.cells.length; i++) {
      const cell = frame.cells[i]!; if (cell.glyph === ' ') continue;
      const color = cell.layer === 'kelp' ? [94, 155, 132] : cell.layer === 'water' ? [65, 102, 112] : palette;
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
  function visibility() { sync(); }
  function guide(x: number, y: number) { if (disposed) return; model.guide(x, y); draw(); }
  function leave() { if (disposed) return; model.clearGuide(); draw(); }
  function aim(e: PointerEvent): SeahorsePoint | null {
    const r = canvas.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return null;
    const o = model.getOptions();
    const box = o.scene === 'study' && o.count === 1 ? { x: 0, y: 0, width: r.width, height: r.height } : fit(r.width, r.height);
    const x = (e.clientX - r.left - box.x) / box.width * 2 - 1, y = (e.clientY - r.top - box.y) / box.height * 2 - 1;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }
  function pointer(e: PointerEvent) {
    if (disposed) return;
    const p = aim(e); if (!p) return;
    model.guide(p.x, p.y);
    // Live input replaces one target; rendering remains owned by the scheduler.
    if (blocked()) draw();
  }
  function direct(action: SeahorseDirectorAction) { if (disposed) return; model.direct(action, blocked()); draw(); }
  function greet() { if (disposed) return; model.greet(blocked()); draw(); }
  function touch(e: PointerEvent) {
    if (disposed) return;
    const p = aim(e); if (!p) return;
    model.guide(p.x, p.y); // A tap has coordinates even without any preceding pointermove.
    const o = model.getOptions();
    if (o.scene === 'study' && o.count === 1) { greet(); return; }
    const scene = model.getDirectorState(), x = p.x * scene.worldWidth / 2, y = p.y * scene.worldHeight / 2;
    let nearest: SeahorseMember | undefined, distance = Infinity;
    for (const m of scene.members) {
      const d = Math.hypot((x - m.x) / (m.scale * 1.2), (y - m.y) / (m.scale * 2.1));
      if (d < distance) { distance = d; nearest = m; }
    }
    if (nearest && distance <= 1.15) { model.direct({ type: 'select', id: nearest.id }); model.direct({ type: 'inspect' }, blocked()); }
    draw();
  }
  function keydown(e: KeyboardEvent) {
    if (disposed || e.target !== canvas || e.altKey || e.ctrlKey || e.metaKey) return;
    const selected = model.getDirectorState().selected, count = model.getOptions().count;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      model.direct({ type: 'select', id: (selected + (e.key === 'ArrowRight' ? 1 : count - 1)) % count });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') model.guide(0, e.key === 'ArrowUp' ? -.7 : .7);
    else if (e.key === 'Enter') { if (model.getOptions().scene === 'study') greet(); else model.direct({ type: 'inspect' }, blocked()); }
    else if (e.key.toLowerCase() === 'h') model.direct({ type: 'anchor' }, blocked());
    else if (e.key.toLowerCase() === 'r') model.direct({ type: 'release' }, blocked());
    else if (e.key === 'Escape') model.clearGuide();
    else if (e.key === ' ') { requestedPaused = !requestedPaused; sync(); }
    else return;
    e.preventDefault(); draw();
  }
  function dispose() {
    if (disposed) return; disposed = true; unsubscribe?.(); unsubscribe = null;
    ro?.disconnect(); io?.disconnect(); media.removeEventListener('change', motion);
    doc!.removeEventListener('visibilitychange', visibility); view!.removeEventListener('resize', resize);
    canvas.removeEventListener('pointermove', pointer); canvas.removeEventListener('pointerdown', touch);
    canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('pointercancel', leave); canvas.removeEventListener('keydown', keydown);
  }
  try {
    if ((requestedPaused || reduced()) && model.getOptions().scene !== 'study') model.direct({ type: 'seek', progress: .42 });
    media.addEventListener('change', motion); doc.addEventListener('visibilitychange', visibility); view.addEventListener('resize', resize);
    canvas.addEventListener('pointermove', pointer); canvas.addEventListener('pointerdown', touch);
    canvas.addEventListener('pointerleave', leave); canvas.addEventListener('pointercancel', leave); canvas.addEventListener('keydown', keydown);
    const host = view as Window & { ResizeObserver?: typeof ResizeObserver; IntersectionObserver?: typeof IntersectionObserver };
    if (host.ResizeObserver) { ro = new host.ResizeObserver(resize); ro.observe(canvas); }
    if (host.IntersectionObserver) {
      inViewport = false; io = new host.IntersectionObserver(entries => { if (disposed) return; inViewport = entries.some(e => e.isIntersecting); sync(); }); io.observe(canvas);
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
