/** Deliberately small, Dragonfly-only review surface. Not a shared renderer API. */
import type { DragonflyGeometry, DragonflyGrid, DragonflyMaterial, DragonflyPreviewOptions, Vec3 } from './types.js';

export const DRAGONFLY_GLYPHS = " .,:;-=+x*oO#@/\\|_~'";
export const DRAGONFLY_FONT = 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace';
export const DRAGONFLY_CELL_ASPECT = 0.68;
const MATERIALS: readonly DragonflyMaterial[] = ['body', 'band', 'wing', 'vein', 'eye', 'leg'];
const RAMPS: Readonly<Record<DragonflyMaterial, string>> = {
  body: ':+xoO', band: '.,:;', wing: '.,:', vein: '.:-=', eye: 'oO', leg: '-=+',
};
const COLORS = ['#9acdc3', '#506b58', '#517d79', '#a9c9bf', '#e3c68a', '#9baf89'] as const;

export interface DragonflyProjectedPoint { col: number; row: number; depth: number }

/** The same orthographic projection for animal samples and their reed contacts.
 * Pass an output object to reuse it while sampling; no per-point allocation is required. */
export function createDragonflyProjector(options: Pick<DragonflyPreviewOptions, 'cols' | 'rows' | 'view'>):
  (point: Vec3, output?: DragonflyProjectedPoint) => DragonflyProjectedPoint {
  const { cols, rows, view } = options;
  if (!Number.isInteger(cols) || cols < 72 || cols > 160 || !Number.isInteger(rows) || rows < 44 || rows > 88)
    throw new RangeError('Dragonfly preview grid must be 72..160 columns and 44..88 rows');
  if (view !== 'dorsal' && view !== 'oblique') throw new TypeError('Unknown Dragonfly preview view');
  const units = Math.min((cols - 6) * DRAGONFLY_CELL_ASPECT / 5.2, (rows - 6) / 4.2);
  const angle = view === 'oblique' ? -0.24 : 0, tilt = view === 'oblique' ? 0.32 : 0;
  const ca = Math.cos(angle), sa = Math.sin(angle), ct = Math.cos(tilt), st = Math.sin(tilt);
  return (point, output = { col: 0, row: 0, depth: 0 }) => {
    if (![point.x, point.y, point.z].every(Number.isFinite)) throw new TypeError('Projection points must be finite');
    const cy = point.y - 0.35;
    const py = cy * ct - point.z * st;
    const px = point.x * ca - py * sa;
    const rowY = point.x * sa + py * ca;
    output.col = Math.floor(cols / 2 + px * units / DRAGONFLY_CELL_ASPECT);
    output.row = Math.floor(rows / 2 + rowY * units);
    output.depth = cy * st + point.z * ct;
    return output;
  };
}

function validateGrid(grid: DragonflyGrid): void {
  if (!grid || !Number.isInteger(grid.cols) || !Number.isInteger(grid.rows) ||
      grid.cols < 72 || grid.cols > 160 || grid.rows < 44 || grid.rows > 88 ||
      !(grid.chars instanceof Uint8Array) || !(grid.materials instanceof Uint8Array) ||
      !(grid.depth instanceof Float64Array) || grid.chars.length !== grid.cols*grid.rows ||
      grid.materials.length !== grid.chars.length || grid.depth.length !== grid.chars.length)
    throw new RangeError('Invalid or oversized Dragonfly grid');
  for (let index = 0; index < grid.chars.length; index++) {
    if (!DRAGONFLY_GLYPHS.includes(String.fromCharCode(grid.chars[index]!)) || grid.materials[index]! >= MATERIALS.length)
      throw new TypeError('Dragonfly grid contains an undeclared glyph or material');
  }
}

/** Samples are in species world units, larger z is in front. No camera/engine reuse is claimed. */
export function rasterizeDragonfly(geometry: DragonflyGeometry, options: DragonflyPreviewOptions): DragonflyGrid {
  const { cols, rows, view, neutral } = options;
  if (!Number.isInteger(cols) || cols < 72 || cols > 160 || !Number.isInteger(rows) || rows < 44 || rows > 88)
    throw new RangeError('Dragonfly preview grid must be 72..160 columns and 44..88 rows');
  if (view !== 'dorsal' && view !== 'oblique') throw new TypeError('Unknown Dragonfly preview view');
  if (typeof neutral !== 'boolean') throw new TypeError('neutral must be boolean');
  if (!geometry || !Array.isArray(geometry.samples) || geometry.samples.length > 6144)
    throw new RangeError('Dragonfly geometry exceeds the 6,144-sample review budget');
  const size = cols * rows;
  const chars = new Uint8Array(size).fill(32);
  const materials = new Uint8Array(size);
  const depth = new Float64Array(size).fill(-Infinity);
  const stable = new Uint32Array(size).fill(0xffffffff);
  const project = createDragonflyProjector(options);
  const projected: DragonflyProjectedPoint = { col: 0, row: 0, depth: 0 };
  let clippedSamples = 0;
  for (const point of geometry.samples) {
    if (![point.x, point.y, point.z, point.tone].every(Number.isFinite) || point.tone < 0 || point.tone > 1)
      throw new TypeError('Dragonfly samples must be finite with tones in 0..1');
    if (!Number.isInteger(point.stableIndex) || point.stableIndex < 0 || point.stableIndex >= 6144)
      throw new RangeError('Invalid Dragonfly stable sample index');
    const material = MATERIALS.indexOf(point.material);
    if (material === -1) throw new TypeError('Unknown Dragonfly material');
    const { col, row, depth: pz } = project(point, projected);
    if (col < 0 || col >= cols || row < 0 || row >= rows) { clippedSamples++; continue; }
    const index = row * cols + col;
    const previous = depth[index]!;
    if (pz < previous || (pz === previous && point.stableIndex >= stable[index]!)) continue;
    const ramp = RAMPS[MATERIALS[material]!];
    const glyph = neutral ? '#' : ramp[Math.min(ramp.length - 1, Math.floor(point.tone * ramp.length))]!;
    chars[index] = glyph.charCodeAt(0);
    materials[index] = material;
    depth[index] = pz;
    stable[index] = point.stableIndex;
  }
  let occupied = 0;
  for (const code of chars) if (code !== 32) occupied++;
  return { cols, rows, chars, depth, materials, occupied, clippedSamples };
}

export function gridToText(grid: DragonflyGrid): string {
  validateGrid(grid);
  const lines: string[] = [];
  for (let row = 0; row < grid.rows; row++) {
    let line = '';
    for (let col = 0; col < grid.cols; col++) {
      const code = grid.chars[row * grid.cols + col]!;
      if (code < 32 || code > 126 || !DRAGONFLY_GLYPHS.includes(String.fromCharCode(code)))
        throw new TypeError('Dragonfly text contains an undeclared glyph');
      line += String.fromCharCode(code);
    }
    lines.push(line);
  }
  return lines.join('\n');
}

export interface DragonflyPaintOptions { readonly width: number; readonly height: number; readonly dpr: number; readonly neutral?: boolean }

/** The same cells as text output; centered letterboxing preserves the declared cell aspect. */
export function paintDragonfly(context: CanvasRenderingContext2D, grid: DragonflyGrid, options: DragonflyPaintOptions): void {
  validateGrid(grid);
  const { width, height, dpr, neutral = false } = options;
  if (![width, height, dpr].every(Number.isFinite) || width <= 0 || height <= 0 || width > 1200 || height > 700 || dpr < 1 || dpr > 2)
    throw new RangeError('Dragonfly paint dimensions exceed the preview budget');
  const cellH = Math.min(height / grid.rows, width / (grid.cols * DRAGONFLY_CELL_ASPECT));
  const cellW = cellH * DRAGONFLY_CELL_ASPECT;
  const left = (width - grid.cols * cellW) / 2;
  const top = (height - grid.rows * cellH) / 2;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.globalAlpha = 1;
  context.fillStyle = '#0b1717';
  context.fillRect(0, 0, width, height);
  context.font = `${cellH * 0.97}px ${DRAGONFLY_FONT}`;
  // This preview intentionally uses the installed face. A missing requested face
  // falls through to monospace; no downloaded font or cross-platform pixel claim.
  const measured = context.measureText('M').width;
  if (Number.isFinite(measured) && measured > cellW)
    context.font = `${cellH * 0.97 * cellW / measured}px ${DRAGONFLY_FONT}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (let index = 0; index < grid.chars.length; index++) {
    const code = grid.chars[index]!;
    if (code === 32) continue;
    context.fillStyle = neutral ? '#d3e6d7' : COLORS[grid.materials[index]!] ?? COLORS[0];
    context.fillText(String.fromCharCode(code), left + (index % grid.cols + 0.5) * cellW, top + (Math.floor(index / grid.cols) + 0.5) * cellH);
  }
}
