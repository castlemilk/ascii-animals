/** Species-local pond composition. The existing Dragonfly rasterizer and painter
 * remain the only geometry-to-glyph path; this module merges their bounded grids. */
import { DRAGONFLY_CELL_ASPECT, DRAGONFLY_FONT, createDragonflyProjector, paintDragonfly, rasterizeDragonfly } from './preview.js';
import type { DragonflyPaintOptions } from './preview.js';
import type { DragonflyGrid, DragonflyPreviewOptions } from './types.js';
import type { DragonflyDirectedGeometry } from './director.js';

export interface PondMemberLabel {
  readonly id: number; readonly label: string; readonly role: string; readonly selected: boolean;
  readonly minCol: number; readonly maxCol: number; readonly minRow: number; readonly maxRow: number;
}
export interface DragonflyPondGrid extends DragonflyGrid {
  readonly owners: Int8Array;
  readonly labels: readonly PondMemberLabel[];
  readonly animalCells: number;
  readonly perches: readonly { readonly id: number; readonly col: number; readonly row: number }[];
}

/** Frontmost depth wins; an exact depth tie belongs to the lower stable ID. */
export function rasterizeDragonflyPond(members: readonly DragonflyDirectedGeometry[], options: DragonflyPreviewOptions): DragonflyPondGrid {
  if (!Array.isArray(members) || members.length < 1 || members.length > 4)
    throw new RangeError('A Dragonfly pond contains one to four individuals');
  const ids = new Set<number>();
  for (const member of members) {
    if (!member || !Number.isInteger(member.id) || member.id < 0 || member.id > 3 || ids.has(member.id))
      throw new RangeError('Pond member IDs must be unique integers in 0..3');
    ids.add(member.id);
  }
  // Rasterize before allocating the merged grid so original preview validation
  // rejects invalid dimensions or point capacity without a larger allocation.
  const grids = [...members].sort((a, b) => a.id - b.id).map(member => ({
    member, grid: rasterizeDragonfly(member.geometry, options),
  }));
  const { cols, rows } = options;
  const chars = new Uint8Array(cols * rows).fill(32), materials = new Uint8Array(cols * rows);
  const depth = new Float64Array(cols * rows).fill(-Infinity), owners = new Int8Array(cols * rows).fill(-1);
  let clippedSamples = 0;
  for (const { member, grid } of grids) {
    clippedSamples += grid.clippedSamples;
    for (let cell = 0; cell < chars.length; cell++) {
      if (grid.chars[cell] === 32) continue;
      const front = grid.depth[cell]!;
      if (front < depth[cell]! || (front === depth[cell]! && owners[cell]! >= 0 && member.id >= owners[cell]!)) continue;
      chars[cell] = grid.chars[cell]!; materials[cell] = grid.materials[cell]!;
      depth[cell] = front; owners[cell] = member.id;
    }
  }
  let animalCells = 0;
  for (const owner of owners) if (owner >= 0) animalCells++;
  const labels: PondMemberLabel[] = [];
  for (const { member } of grids) {
    let minCol = cols, maxCol = -1, minRow = rows, maxRow = -1;
    for (let cell = 0; cell < owners.length; cell++) {
      if (owners[cell] !== member.id) continue;
      const col = cell % cols, row = Math.floor(cell / cols);
      minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row);
    }
    if (maxCol >= 0) labels.push({ id: member.id, label: member.label, role: member.role,
      selected: member.selected, minCol, maxCol, minRow, maxRow });
  }
  function emptyGlyph(col: number, row: number, glyph: string, material: number): void {
    if (col < 1 || col >= cols - 1 || row < 1 || row >= rows - 1) return;
    const cell = row * cols + col;
    if (chars[cell] !== 32) return;
    chars[cell] = glyph.charCodeAt(0); materials[cell] = material;
  }
  const project = createDragonflyProjector(options);
  const perches = grids.map(({ member }) => ({ id: member.id, ...project(member.perch) }));
  if (!options.neutral) {
    // Quiet ASCII context stays behind the creatures. It is a fixed visual
    // reference, not a second simulation or a particle/background image system.
    const shore = rows - 8;
    for (let col = 4; col < cols - 4; col++) {
      if (col % 5 !== 0) emptyGlyph(col, shore + Math.round(Math.sin(col * .13)), col % 3 === 0 ? ',' : '.', 1);
    }
    for (const [column, height, lean] of [[7, 13, 1], [12, 9, -1], [cols - 8, 16, -1], [cols - 14, 11, 1]] as const) {
      for (let stem = 0; stem < height; stem++) {
        const bend = Math.round(lean * Math.pow(stem / height, 2) * 3);
        emptyGlyph(column + bend, rows - 4 - stem, ';', 1);
        if (stem === Math.floor(height * .45) || stem === Math.floor(height * .7)) {
          emptyGlyph(column + bend + lean, rows - 5 - stem, ',', 1);
          emptyGlyph(column + bend + lean * 2, rows - 6 - stem, '-', 1);
        }
      }
      emptyGlyph(column + lean * 3, rows - 4 - height, 'o', 1);
    }
    // These reeds share the director's actual landing points. The same projector
    // places both the perched animal and its stem, including the oblique view.
    for (const { member } of grids) {
      const lean = member.id % 2 === 0 ? 1 : -1;
      for (let segment = 0; segment <= 64; segment++) {
        const u = segment / 64;
        const stem = { x: member.perch.x + lean * .06 * u * u,
          y: member.perch.y + (2.15 - member.perch.y) * u, z: member.perch.z - .03 * u };
        const p = project(stem);
        emptyGlyph(p.col, p.row, segment === 0 ? 'o' : ';', 1);
        if (segment === 22 || segment === 43) {
          const leaf = project({ x: stem.x + lean * .09, y: stem.y - .05, z: stem.z });
          emptyGlyph(leaf.col, leaf.row, '-', 1);
        }
      }
    }
    for (const label of labels) if (label.selected) {
      for (const col of [label.minCol - 2, label.maxCol + 2])
        for (const row of [label.minRow - 2, label.maxRow + 2]) emptyGlyph(col, row, '+', 4);
    }
  }
  let occupied = 0;
  for (const char of chars) if (char !== 32) occupied++;
  return { cols, rows, chars, depth, materials, occupied, clippedSamples, owners, labels, animalCells, perches };
}

export interface DragonflyPondPaintOptions extends DragonflyPaintOptions { readonly labels: boolean }

export interface PlacedPondLabel {
  readonly id: number; readonly text: string; readonly selected: boolean;
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
}

/** At most four labels, with a bounded set of candidate positions. A label never
 * covers another label or an animal's visible bounding rectangle. */
export function layoutDragonflyPondLabels(grid: DragonflyPondGrid, width: number, height: number,
  measure: (text: string) => number): readonly PlacedPondLabel[] {
  if (![width, height].every(Number.isFinite) || width <= 0 || width > 1200 || height <= 0 || height > 700)
    throw new RangeError('Pond label dimensions exceed the preview budget');
  const cellH = Math.min(height / grid.rows, width / (grid.cols * DRAGONFLY_CELL_ASPECT));
  const cellW = cellH * DRAGONFLY_CELL_ASPECT;
  const left = (width - grid.cols * cellW) / 2, top = (height - grid.rows * cellH) / 2;
  const fontSize = Math.max(8, Math.min(11, cellH * .95));
  const boxes = grid.labels.map(label => ({ left: left + label.minCol * cellW - 3,
    right: left + (label.maxCol + 1) * cellW + 3, top: top + label.minRow * cellH - 3,
    bottom: top + (label.maxRow + 1) * cellH + 3 }));
  const placed: PlacedPondLabel[] = [];
  for (const label of [...grid.labels].sort((a, b) => Number(b.selected) - Number(a.selected) || a.id - b.id)) {
    const text = `${String(label.id + 1).padStart(2, '0')} / ${label.label}`;
    const measured = measure(text);
    if (!Number.isFinite(measured) || measured < 0) throw new TypeError('Label measurement must be finite and nonnegative');
    const labelWidth = Math.min(width - 12, measured + 8), labelHeight = fontSize + 6;
    const x = Math.max(labelWidth / 2 + 5, Math.min(width - labelWidth / 2 - 5,
      left + (label.minCol + label.maxCol + 1) * .5 * cellW));
    const preferred = top + (label.minRow - 3) * cellH;
    const candidates: number[] = [];
    for (let row = 0; row < 6; row++) candidates.push(preferred - row * (labelHeight + 3));
    for (let row = 0; row < 5; row++) candidates.push(top + (label.maxRow + 3) * cellH + row * (labelHeight + 3));
    for (const y of candidates) {
      if (y - labelHeight / 2 < 8 || y + labelHeight / 2 > height - 8) continue;
      const rect = { left: x - labelWidth / 2, right: x + labelWidth / 2, top: y - labelHeight / 2, bottom: y + labelHeight / 2 };
      const overlap = (box: { left: number; right: number; top: number; bottom: number }): boolean =>
        rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top;
      if (boxes.some(overlap) || placed.some(other => overlap({ left: other.x - other.width / 2 - 3,
        right: other.x + other.width / 2 + 3, top: other.y - other.height / 2 - 3, bottom: other.y + other.height / 2 + 3 }))) continue;
      placed.push({ id: label.id, text, selected: label.selected, x, y, width: labelWidth, height: labelHeight });
      break;
    }
  }
  // In a crowded smallest-grid frame, a label may be omitted instead of covering
  // anatomy. Every individual remains available by name in the semantic cast UI.
  return placed;
}

/** Labels are UI annotations on top of the same merged ASCII surface. */
export function paintDragonflyPond(context: CanvasRenderingContext2D, grid: DragonflyPondGrid, options: DragonflyPondPaintOptions): void {
  paintDragonfly(context, grid, options);
  if (!options.labels || options.neutral) return;
  const cellH = Math.min(options.height / grid.rows, options.width / (grid.cols * DRAGONFLY_CELL_ASPECT));
  context.font = `${Math.max(8, Math.min(11, cellH * .95))}px ${DRAGONFLY_FONT}`;
  context.textAlign = 'center'; context.textBaseline = 'middle';
  const placed = layoutDragonflyPondLabels(grid, options.width, options.height, text => context.measureText(text).width);
  for (const label of placed) {
    context.fillStyle = label.selected ? '#ead89a' : '#9ab5a5';
    context.fillText(label.text, label.x, label.y);
  }
}
