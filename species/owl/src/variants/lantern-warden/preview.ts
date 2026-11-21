import { buildOwlGeometry, owlSurfaceTone } from './geometry.js';
import type { OwlGrid, OwlGridOptions, OwlPart, OwlSample, OwlState, OwlSurface } from '../../types.js';

/** Printable ASCII only. The palette is shape language, not a density ramp. */
export const GLYPHS = ' .-=vV@#/\\()';
export const OWL_GRID_LIMITS = Object.freeze({ minCols: 64, maxCols: 160, minRows: 36, maxRows: 90, maxCells: 14400 });
const allowedKeys = new Set(['cols', 'rows', 'cellAspect', 'silhouette']);

function integer(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer in ${min}..${max}`);
  }
  return value;
}

/** Grid resolution may vary; framing never follows the owl or zooms during motion. */
export function renderOwlGrid(state: OwlState, options: OwlGridOptions = {}): OwlGrid {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Expected grid options');
  for (const key of Object.keys(options)) if (!allowedKeys.has(key)) throw new TypeError(`Unknown grid option: ${key}`);
  const cols = integer(options.cols ?? 96, 64, 160, 'cols');
  const rows = integer(options.rows ?? 54, 36, 90, 'rows');
  const cellAspect = options.cellAspect ?? .55;
  if (typeof cellAspect !== 'number' || !Number.isFinite(cellAspect) || cellAspect < .45 || cellAspect > .70) {
    throw new RangeError('cellAspect must be finite in .45.. .70');
  }
  if (options.silhouette !== undefined && typeof options.silhouette !== 'boolean') throw new TypeError('silhouette must be boolean');
  const physicalAspect = cols * cellAspect / rows;
  // Extreme grids would erase or crop silhouette anchors. Fixed framing deliberately
  // accepts only useful portrait-to-landscape specimen windows.
  if (physicalAspect < .92 || physicalAspect > 1.90) throw new RangeError('Grid physical aspect must be .92..1.90');
  const size = cols * rows;
  const geometry = buildOwlGeometry(state);
  const owners = new Int16Array(size).fill(-1);
  const depth = new Float64Array(size).fill(-Infinity);
  const tones = new Float64Array(size);
  const worldHeight = 2.40, worldWidth = worldHeight * physicalAspect;
  const dx = worldWidth / cols, dy = worldHeight / rows;
  const top = -1.18, left = -worldWidth / 2;
  const contrast = state.config.featherContrast;

  // Rasterize only the small analytic surface bounding boxes, not every surface
  // at every cell. This is deliberately specialised to the owl's two primitives.
  for (let surfaceIndex = 0; surfaceIndex < geometry.surfaces.length; surfaceIndex++) {
    const surface = geometry.surfaces[surfaceIndex]!;
    const c = Math.cos(surface.rotation), s = Math.sin(surface.rotation);
    const halfWidth = Math.abs(c) * surface.rx + Math.abs(s) * surface.ry;
    const halfHeight = Math.abs(s) * surface.rx + Math.abs(c) * surface.ry;
    const firstCol = Math.max(0, Math.floor((surface.cx - halfWidth - left) / dx));
    const lastCol = Math.min(cols - 1, Math.ceil((surface.cx + halfWidth - left) / dx));
    const firstRow = Math.max(0, Math.floor((surface.cy - halfHeight - top) / dy));
    const lastRow = Math.min(rows - 1, Math.ceil((surface.cy + halfHeight - top) / dy));
    for (let row = firstRow; row <= lastRow; row++) {
      const y = top + (row + .5) * dy;
      for (let col = firstCol; col <= lastCol; col++) {
        const x = left + (col + .5) * dx;
        const px = x - surface.cx, py = y - surface.cy;
        const u = (c * px + s * py) / surface.rx;
        const v = (-s * px + c * py) / surface.ry;
        const q = surface.shape === 'ellipse' ? u * u + v * v : Math.abs(u) + Math.abs(v);
        if (q > 1) continue;
        const dome = Math.sqrt(Math.max(0, 1 - q));
        const z = surface.z + surface.depth * dome;
        const index = row * cols + col;
        // Stable surface order resolves exact-depth overlaps consistently.
        if (z <= depth[index]!) continue;
        depth[index] = z;
        owners[index] = surfaceIndex;
        tones[index] = owlSurfaceTone(surface, u, v, dome, contrast);
      }
    }
  }
  // A highlight smaller than one logical cell can otherwise disappear between
  // sample centres at phone size. Anchor one covered pupil cell to its own
  // attached highlight. This never invents a detached eye or crosses ownership.
  for (let surfaceIndex = 0; surfaceIndex < geometry.surfaces.length; surfaceIndex++) {
    const highlight = geometry.surfaces[surfaceIndex]!;
    if (highlight.material !== 'highlight') continue;
    let best = -1, distance = Infinity, visible = false;
    for (let i = 0; i < size; i++) {
      const owner = owners[i]!;
      if (owner === surfaceIndex) { visible = true; break; }
      if (owner < 0) continue;
      const surface = geometry.surfaces[owner]!;
      if (surface.part !== highlight.part || surface.material !== 'pupil') continue;
      const x = left + (i % cols + .5) * dx, y = top + (Math.floor(i / cols) + .5) * dy;
      const d = (x - highlight.cx) ** 2 + (y - highlight.cy) ** 2;
      if (d < distance) { distance = d; best = i; }
    }
    if (!visible && best >= 0) { owners[best] = surfaceIndex; tones[best] = 1; depth[best] = highlight.z; }
  }
  // The small triangular beak is a recognition anchor during a distant swoop.
  // If its subcell geometry misses the centre sample, keep one nearest facial
  // cell. This is the same bounded coverage rule as the attached eye highlights.
  if (!owners.some(owner => owner >= 0 && geometry.surfaces[owner]!.part === 'beak')) {
    const beakIndex = geometry.surfaces.findIndex(surface => surface.part === 'beak');
    if (beakIndex >= 0) {
      const beak = geometry.surfaces[beakIndex]!;
      let best = -1, distance = Infinity;
      for (let i = 0; i < size; i++) {
        const owner = owners[i]!;
        if (owner < 0 || geometry.surfaces[owner]!.part !== 'face') continue;
        const x = left + (i % cols + .5) * dx, y = top + (Math.floor(i / cols) + .5) * dy;
        const d = (x - beak.cx) ** 2 + (y - beak.cy) ** 2;
        if (d < distance) { distance = d; best = i; }
      }
      if (best >= 0) { owners[best] = beakIndex; tones[best] = beak.tone; depth[best] = beak.z; }
    }
  }
  // A shared boundary belongs to the foreground mass once. Drawing both sides
  // would turn a clean facial disc into three noisy nested outlines.
  const rank = (part: OwlPart | null): number => part === null ? 0
    : part === 'perch' || part === 'tail' ? 1 : part === 'body' ? 2
      : part.startsWith('wing-') ? 3 : part.startsWith('foot-') ? 4
        : part === 'head' ? 5 : part === 'face' ? 6
          : part.startsWith('eye-') ? 7 : part.startsWith('pupil-') ? 8 : 9;
  const group = (index: number): OwlPart | null => {
    if (index < 0 || index >= size || owners[index]! < 0) return null;
    const surface = geometry.surfaces[owners[index]!]!;
    // The five breast feathers and the ridges sit inside a quiet broad mass.
    // Their surface boundaries do not hatch the rest of that mass.
    return surface.part;
  };
  const samples: (OwlSample | null)[] = new Array(size).fill(null);
  const parts: (OwlPart | null)[] = new Array(size).fill(null);
  const lines: string[] = [];
  let occupied = 0;
  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const owner = owners[index]!;
      if (owner < 0) { line += ' '; continue; }
      const surface = geometry.surfaces[owner]!;
      const tone = tones[index]!;
      occupied++;
      parts[index] = surface.part;
      samples[index] = Object.freeze({ x: left + (col + .5) * dx, y: top + (row + .5) * dy,
        z: depth[index]!, tone, part: surface.part, material: surface.material });
      if (options.silhouette) { line += '#'; continue; }
      const own = rank(surface.part);
      const edge = {
        left: col === 0 || rank(group(index - 1)) < own,
        right: col === cols - 1 || rank(group(index + 1)) < own,
        top: row === 0 || rank(group(index - cols)) < own,
        bottom: row === rows - 1 || rank(group(index + cols)) < own,
      };
      line += glyph(surface, state.blink, edge, contrast);
    }
    lines.push(line);
  }
  return Object.freeze({ cols, rows, text: lines.join('\n'), occupied,
    parts: Object.freeze(parts), samples: Object.freeze(samples) });
}

type Edge = Readonly<{ left: boolean; right: boolean; top: boolean; bottom: boolean }>;
function contour(edge: Edge): string {
  if (edge.top) return edge.left ? '/' : edge.right ? '\\' : '-';
  if (edge.bottom) return edge.left ? '\\' : edge.right ? '/' : '-';
  if (edge.left) return '(';
  if (edge.right) return ')';
  return ' ';
}

function glyph(surface: OwlSurface, blink: number, edge: Edge, contrast: number): string {
  if (surface.material === 'pupil') return ' ';
  if (surface.material === 'highlight') return '@';
  if (surface.part.startsWith('eye-') && blink > .85) return surface.material === 'eye' ? '-' : ' ';
  if (surface.material === 'beak') return 'v';
  if (surface.material === 'foot') return 'v';
  if (surface.material === 'wood') return surface.pattern === 9 ? (surface.rotation < 0 ? '/' : '\\')
    : Math.abs(surface.rotation) > .2 ? (surface.rotation < 0 ? '/' : '\\') : '=';
  // Contrast changes the emphasis of five attached breast feathers, never the
  // eye/outline hierarchy or an all-over texture. Discrete glyphs stay ASCII.
  if (surface.pattern === 6) return contrast < .25 ? '.' : contrast > .75 ? 'V' : 'v';
  if (surface.pattern === 7) return '-';
  if (surface.pattern === 8) return '-';
  // One contour per anatomical mass. Neither the feather surfaces nor the
  // sampler's tone values become an all-over fill. The semantic samples remain
  // complete for targeting, silhouette exports and downstream consumers.
  const outline = contour(edge);
  if (outline !== ' ') return outline;
  return ' ';
}
