import { renderOwlGrid } from './preview.js';
import type { OwlGrid, OwlGridOptions, OwlPart, OwlSample } from './types.js';
import type { OwlActorId, OwlDirectorState } from './director.js';

export type OwlActorRect = Readonly<{ id: OwlActorId; left: number; top: number; width: number; height: number }>;
export type OwlDirectorGrid = OwlGrid & Readonly<{
  layout: 'solo' | 'wide' | 'stacked';
  /** -1 background/empty, otherwise stable actor id; pupil spaces retain ownership. */
  owners: readonly number[];
  actorRects: readonly OwlActorRect[];
}>;
export const OWL_SCENE_GLYPHS = ' .,:;+=ox%#@-v*()~/\\';
function whole(value: unknown, low: number, high: number, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < low || value > high) throw new RangeError(`${name} must be an integer ${low}..${high}`);
  return value;
}
function noise(seed: number, index: number): number {
  let n = (seed ^ Math.imul(index + 1, 0x45d9f3b)) >>> 0;
  n ^= n >>> 16; n = Math.imul(n, 0x45d9f3b); n ^= n >>> 16;
  return (n >>> 0) / 0x100000000;
}

/** Composition of existing Owl grid output, not a second geometry or glyph renderer. */
export function renderOwlDirectorGrid(state: OwlDirectorState, options: OwlGridOptions = {}): OwlDirectorGrid {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Scene grid options must be an object');
  for (const key of Object.keys(options)) if (!['cols', 'rows', 'cellAspect', 'silhouette'].includes(key)) throw new TypeError(`Unknown scene grid option: ${key}`);
  if (options.cellAspect !== undefined && options.cellAspect !== .55) throw new RangeError('Director cells use aspect .55');
  if (options.silhouette !== undefined && typeof options.silhouette !== 'boolean') throw new TypeError('silhouette must be boolean');
  const count = state.config.count;
  const cols = whole(options.cols ?? (count === 1 ? 96 : 144), 64, 160, 'cols');
  const rows = whole(options.rows ?? (count === 1 ? 54 : 60), 36, 90, 'rows');
  const layout = count === 1 ? 'solo' : cols >= 128 && rows >= 48 ? 'wide' : cols <= 112 && rows >= 80 ? 'stacked' : null;
  if (!layout) throw new RangeError('Duet needs a wide grid (128–160 × 48–90) or stacked grid (64–112 × 80–90); both Owls keep at least64×36 cells');
  const size = cols * rows;
  const cells = new Array<string>(size).fill(' '), parts: (OwlPart | null)[] = new Array(size).fill(null);
  const samples: (OwlSample | null)[] = new Array(size).fill(null), owners = new Array<number>(size).fill(-1);
  const rects: OwlActorRect[] = [];
  const seed = state.actors[0]!.simulation.config.seed;
  const put = (x: number, y: number, glyph: string) => {
    const col = Math.round(x), row = Math.round(y);
    if (col > 0 && col < cols - 1 && row > 0 && row < rows - 1) cells[row * cols + col] = glyph;
  };
  if (!options.silhouette) {
    // Far woodland: sparse low-ink trunks behind the actors, never a starfield
    // pasted across their faces. Stable seed-derived bends do not shimmer.
    for (const [tree, fraction] of [.06, .29, .74, .94].entries()) {
      const base = fraction * cols, lean = (noise(seed, tree + 91) - .5) * 3;
      for (let row = Math.floor(rows * .12); row < rows * .87; row++) {
        const x = base + lean * row / rows;
        if (row % 3 !== 0) put(x, row, tree % 2 ? '.' : ':');
        if (row % 13 === 0) for (let twig = 1; twig < 5; twig++)
          put(x + (tree % 2 ? -twig : twig), row - twig * .5, '.');
      }
    }
    // A broken middle-distance limb and two low foreground fern silhouettes.
    // Most of the clearing remains empty, including the flight corridor.
    for (let step = 0; step < 12; step++) {
      const x = cols * .03 + step * .75, y = rows * .67 - step * .44;
      put(x, y, step % 3 ? ':' : '/');
    }
    for (const side of [-1, 1]) {
      const x = side < 0 ? cols * .07 : cols * .93;
      for (let leaf = 0; leaf < 4; leaf++) {
        put(x + side * leaf * 1.2, rows - 3 - leaf * .8, side < 0 ? '\\' : '/');
        put(x - side * leaf * .7, rows - 3 - leaf * 1.1, '.');
      }
    }
  }
  if (layout === 'solo') renderActor(0, 0, 0, cols, rows);
  else if (layout === 'wide') {
    const width = Math.max(64, Math.floor((cols - (state.config.layout === 'close' ? 0 : 8)) / 2));
    const height = Math.max(36, Math.min(44, Math.floor(width * .55 / .98), rows - 10));
    const gap = cols - width * 2;
    const offset = state.config.layout === 'split' ? 6 : state.config.layout === 'bough' ? 2 : 0;
    const top = Math.max(2, Math.floor((rows - height) / 2));
    renderActor(0, 0, Math.min(rows - height, top + offset), width, height);
    renderActor(1, width + gap, Math.max(0, top - offset), width, height);
  } else {
    const width = Math.min(cols, 76), height = 36;
    const offset = Math.min(cols - width, state.config.layout === 'split' ? 8 : 4);
    renderActor(0, Math.floor((cols - width) / 2) - Math.floor(offset / 2), 3, width, height);
    renderActor(1, Math.floor((cols - width) / 2) + Math.ceil(offset / 2), rows - height - 3, width, height);
  }
  function renderActor(id: OwlActorId, left: number, top: number, width: number, height: number) {
    const actor = state.actors[id]; if (!actor) throw new RangeError('Director actor missing');
    const grid = renderOwlGrid(actor.pose, { cols: width, rows: height, cellAspect: .55, silhouette: options.silhouette ?? false });
    const lines = grid.text.split('\n');
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const from = y * width + x, sample = grid.samples[from];
      if (!sample) continue;
      const to = (top + y) * cols + left + x;
      cells[to] = lines[y]![x]!; parts[to] = grid.parts[from]!; samples[to] = sample; owners[to] = id;
    }
    rects.push(Object.freeze({ id, left, top, width, height }));
  }
  if (layout === 'wide' && state.config.layout === 'bough') {
    // Join actual sampled wood edges. An estimated percentage floated above the
    // perch at several supported resolutions in the first rendered sheet.
    const edge = (id: OwlActorId, right: boolean) => {
      const rect = rects[id]!; let col = right ? -Infinity : Infinity; const found: number[] = [];
      for (let y = rect.top; y < rect.top + rect.height; y++) for (let x = rect.left; x < rect.left + rect.width; x++) {
        const i = y * cols + x;
        if (owners[i] !== id || parts[i] !== 'perch') continue;
        if ((right && x > col) || (!right && x < col)) { col = x; found.length = 0; }
        if (x === col) found.push(y);
      }
      return { x: col, y: found[Math.floor(found.length / 2)]! };
    };
    const a = edge(0, true), b = edge(1, false);
    const x0 = a.x, x1 = b.x, y0 = a.y, y1 = b.y;
    for (let x = x0; x <= x1; x++) {
      const y = Math.round(y0 + (y1 - y0) * (x - x0) / Math.max(1, x1 - x0));
      if (owners[y * cols + x] === -1) put(x, y, '=');
    }
  }
  if (state.cue && !options.silhouette) {
    const age = state.tick - state.cue.startTick;
    if (age < 130 && state.cue.kind !== 'flight') {
      // Cue coordinates share the selected actor's normalized gaze space.
      const rect = rects[state.cue.target]!;
      const x = rect.left + (state.cue.x + 1) * .5 * (rect.width - 1);
      const y = rect.top + (state.cue.y + 1) * .5 * (rect.height - 1);
      const radius = 2 + Math.min(3, age / 28);
      for (const side of [-1, 1]) {
        const cx = Math.round(x + side * radius), cy = Math.round(y);
        if (owners[cy * cols + cx] === -1) put(cx, cy, side === -1 ? '(' : ')');
      }
    }
  }
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) lines.push(cells.slice(y * cols, (y + 1) * cols).join(''));
  return Object.freeze({ cols, rows, text: lines.join('\n'), occupied: cells.filter(x => x !== ' ').length,
    parts: Object.freeze(parts), samples: Object.freeze(samples), owners: Object.freeze(owners),
    actorRects: Object.freeze(rects), layout });
}

/** Visible cell ownership wins; empty clearing points select the nearest composed perch. */
export function targetOwlActor(grid: OwlDirectorGrid, x: number, y: number): OwlActorId {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Target coordinates must be finite');
  const col = Math.round((Math.max(-1, Math.min(1, x)) + 1) * .5 * (grid.cols - 1));
  const row = Math.round((Math.max(-1, Math.min(1, y)) + 1) * .5 * (grid.rows - 1));
  const owner = grid.owners[row * grid.cols + col];
  if (owner === 0 || owner === 1) return owner;
  let winner: OwlActorId = 0, best = Infinity;
  for (const rect of grid.actorRects) {
    const dx = (col - rect.left - rect.width / 2) * .55, dy = row - rect.top - rect.height / 2;
    const distance = dx * dx + dy * dy;
    if (distance < best) { best = distance; winner = rect.id; }
  }
  return winner;
}
