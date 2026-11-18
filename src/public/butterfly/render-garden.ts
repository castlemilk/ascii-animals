import type { ButterflyCell, ButterflyConfig, ButterflyFrame, ButterflyPhase } from '../butterfly.js';
import type { ButterflyGardenState } from './director.js';

const TAU = Math.PI * 2;
const RAMP = '.,:;+=*#%@';
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/**
 * A single printable-ASCII garden grid. Geometry, flowers and weather share its
 * bounded storage; no full-size frame is allocated for an individual butterfly.
 * Inks are semantic colour groups, not additional geometry or DOM overlays.
 */
export function renderButterflyGarden(
  o: ButterflyConfig,
  g: ButterflyGardenState,
  phase: ButterflyPhase,
): ButterflyFrame {
  const columns = o.columns, rows = o.rows, length = columns * rows;
  const glyphs = new Array<string>(length).fill(' ');
  const tones = new Uint8Array(length), inks = new Uint8Array(length), depths = new Uint8Array(length);
  const worldW = Math.max(6, 3.7 * columns * .56 / rows);
  const worldH = worldW * rows / (columns * .56);
  const toColumn = (x: number): number => Math.round((x * .5 + .5) * (columns - 1));
  const toRow = (y: number): number => Math.round((y * .5 + .5) * (rows - 1));

  function put(c: number, r: number, glyph: string, tone: number, ink: number, depth: number): void {
    if (c < 0 || c >= columns || r < 0 || r >= rows) return;
    const i = r * columns + c;
    if (depth < depths[i]!) return;
    glyphs[i] = glyph;
    tones[i] = clamp(Math.round(tone), 1, 9);
    inks[i] = ink;
    depths[i] = depth;
  }
  function mark(x: number, y: number, glyph: string, tone: number, ink: number, depth: number): void {
    put(toColumn(x), toRow(y), glyph, tone, ink, depth);
  }
  function line(x: number, y: number, xx: number, yy: number, tone: number, ink: number, depth: number, glyph?: string): void {
    const dc = (xx - x) * columns * .5, dr = (yy - y) * rows * .5;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dc), Math.abs(dr))));
    const stroke = glyph ?? (Math.abs(dc) < .45 * Math.abs(dr) ? '|' : Math.abs(dr) < .4 * Math.abs(dc) ? '-' : dc * dr > 0 ? '\\' : '/');
    for (let k = 0; k <= n; k++) {
      const p = k / n;
      mark(x + (xx - x) * p, y + (yy - y) * p, stroke, tone, ink, depth);
    }
  }

  // Sparse stable pollen: 22 points regardless of population or resolution.
  // Its slow vertical wrap belongs to the director clock and freezes with it.
  for (let k = 0; k < 22; k++) {
    const n = (k * 37 + o.seed % 107) % 113;
    const x = -.93 + 1.86 * n / 113 + Math.sin(g.clock * .16 + k * 2.1) * .012;
    const y = -.78 + ((k * .127 + g.clock * .004) % 1.33);
    mark(x, y, k % 5 === 0 ? ':' : '.', k % 5 === 0 ? 3 : 2, 9, 1);
  }

  const weather = g.cue === 'breeze' || (g.scene === 'breeze' && g.actIndex === 1)
    || (g.pointer.active && o.director.pointerMode === 'breeze');
  if (weather) {
    const direction = o.director.breeze < 0 ? -1 : 1;
    for (let ribbon = 0; ribbon < 3; ribbon++) {
      for (let k = 0; k < 23; k++) {
        const x = -.87 + k * .077;
        const y = -.53 + ribbon * .27 + Math.sin(x * 4 - direction * g.clock * .7 + ribbon) * .055;
        mark(x, y, k % 4 === 0 ? '~' : '.', 3, 9, 2);
      }
    }
  }

  // A low grass margin gives the flowers a ground plane without filling the
  // negative space that makes the moving wing silhouettes readable.
  for (let k = 0; k < 26; k++) {
    const x = -.98 + k * .078;
    const top = .94 - .028 * (1 + (k * 7 + o.seed) % 4);
    line(x, .98, x - .015, top, 2, 7, 2, '/');
    if (k % 2 === 0) line(x, .98, x + .025, top + .025, 3, 7, 2, '\\');
  }

  for (const flower of g.flowers) {
    const fx = flower.x, fy = flower.y;
    const bend = Math.sin(g.clock * .46 + flower.id * 1.4) * .012 + o.director.breeze * .018;
    const root = fx - bend * 1.2;
    const stemSteps = Math.max(1, Math.ceil((.96 - fy) * rows * .5));
    let previousX = fx, previousY = fy;
    for (let k = 1; k <= stemSteps; k++) {
      const p = k / stemSteps;
      const x = fx + (root - fx) * p + Math.sin(p * Math.PI) * bend;
      const y = fy + (.96 - fy) * p;
      line(previousX, previousY, x, y, 4, 7, 3);
      previousX = x; previousY = y;
    }
    for (const [at, side] of [[.43, -1], [.7, 1]] as const) {
      const y = fy + (.96 - fy) * at;
      const x = fx + (root - fx) * at + Math.sin(at * Math.PI) * bend;
      const tipX = x + side * .085;
      line(x, y, tipX, y - .065, 4, 7, 3);
      line(tipX, y - .065, x + side * .048, y + .005, 3, 7, 3);
      line(x + side * .048, y + .005, x, y, 3, 7, 3);
    }
    // Petal dimensions in world coordinates, so a mobile grid keeps circular
    // flower heads instead of stretching them to match the viewport.
    const radius = flower.id % 3 === 0 ? .14 : .12;
    for (let petal = 0; petal < 8; petal++) {
      const a = petal * TAU / 8;
      mark(fx + Math.cos(a) * radius * 2 / worldW, fy + Math.sin(a) * radius * 2 / worldH,
        petal % 2 === 0 ? 'o' : '*', 6, 8, 4);
    }
    mark(fx, fy, '@', 9, 8, 5);
  }

  if (g.pointer.active && o.director.pointerMode !== 'off') {
    const radius = .14;
    for (let k = 0; k < 12; k++) {
      const a = k * TAU / 12;
      mark(g.pointer.x + Math.cos(a) * radius * 2 / worldW,
        g.pointer.y + Math.sin(a) * radius * 2 / worldH, '.', 5, 9, 6);
    }
    mark(g.pointer.x, g.pointer.y, o.director.pointerMode === 'breeze' ? '~' : '+', 7, 9, 6);
  }

  // Back-to-front ownership is stable for a shared frame: lower butterflies
  // overlap higher ones; equal-height ties use their persistent numeric ID.
  const members = [...g.members].sort((a, b) => a.y - b.y || a.id - b.id);
  for (let order = 0; order < members.length; order++) {
    const m = members[order]!;
    // Garden-only silhouette LOD: an open pair of forewings spans about 3.05
    // local units. Keep that span at roughly 13 columns on sparse grids, even
    // when the requested ensemble size is smaller. The model's configured
    // scale stays intact; folded poses are deliberately narrower than this
    // open-wing reference. This floor also keeps clubbed antennae attached.
    const scale = Math.max(m.scale * o.scale, worldW / (columns - 1) * 4.3);
    const rotation = m.heading, co = Math.cos(rotation), si = Math.sin(rotation);
    const mirror = o.facing === 'left' ? 1 : -1;
    const ink = m.id + 1, depth = 10 + order * 3;
    const opening = clamp(m.opening, .28, 1);
    const fine = scale * columns / worldW >= 8;
    const sideLag = (m.activity.kind === 'flutter' || m.activity.kind === 'recover')
      ? Math.sin(m.phase + g.clock * 5.1) * .035 : .012;

    // Fit only the rendered root: an edge-directed cue must not crop antennae
    // or patterned wing tips at high size/low density. The rotated anatomical
    // bounds include both lobes, legs and antennae, with a 1.5-cell gutter.
    // Model positions and input coordinates remain unchanged; labels and the
    // feeding connection below use this same fitted root.
    const halfWing = Math.max(.42, 1.56 * clamp(opening + Math.abs(sideLag), .25, 1));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const x of [-halfWing, halfWing]) for (const y of [-1.54, 1.14]) {
      const xx = (x * co - y * si) * scale, yy = (x * si + y * co) * scale;
      minX = Math.min(minX, xx); maxX = Math.max(maxX, xx);
      minY = Math.min(minY, yy); maxY = Math.max(maxY, yy);
    }
    const gutterX = 1.5 * worldW / (columns - 1), gutterY = 1.5 * worldH / (rows - 1);
    const rootX = clamp(m.x * worldW * .5, -worldW * .5 + gutterX - minX, worldW * .5 - gutterX - maxX);
    const rootY = clamp(m.y * worldH * .5, -worldH * .5 + gutterY - minY, worldH * .5 - gutterY - maxY);

    function point(x: number, y: number, tone: number, glyph: string, extraDepth = 1): void {
      x *= mirror;
      const wx = rootX + (x * co - y * si) * scale;
      const wy = rootY + (x * si + y * co) * scale;
      mark(wx * 2 / worldW, wy * 2 / worldH, glyph, tone, ink, depth + extraDepth);
    }
    function limb(x: number, y: number, xx: number, yy: number, tone: number, glyph?: string): void {
      const dx = xx - x, dy = yy - y;
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) * scale * columns / worldW * 1.5));
      for (let k = 0; k <= n; k++) {
        const p = k / n;
        const gx = dx * co - dy * si, gy = dx * si + dy * co;
        const stroke = glyph ?? (Math.abs(gx) < .45 * Math.abs(gy) ? '|' : Math.abs(gy) < .4 * Math.abs(gx) ? '-' : gx * gy > 0 ? '\\' : '/');
        point(x + dx * p, y + dy * p, tone, stroke);
      }
    }

    // Inverse rasterization samples at most the animal's local cell rectangle.
    // It avoids multiplying a dense geometry sampling pass by the population.
    const radius = 2.02 * scale;
    const left = clamp(Math.floor((rootX - radius) / worldW * (columns - 1) + (columns - 1) * .5), 0, columns - 1);
    const right = clamp(Math.ceil((rootX + radius) / worldW * (columns - 1) + (columns - 1) * .5), 0, columns - 1);
    const top = clamp(Math.floor((rootY - radius) / worldH * (rows - 1) + (rows - 1) * .5), 0, rows - 1);
    const bottom = clamp(Math.ceil((rootY + radius) / worldH * (rows - 1) + (rows - 1) * .5), 0, rows - 1);
    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) {
        const wx = (c / (columns - 1) - .5) * worldW - rootX;
        const wy = (r / (rows - 1) - .5) * worldH - rootY;
        const localX = (wx * co + wy * si) / scale * mirror;
        const localY = (-wx * si + wy * co) / scale;
        const side = localX < 0 ? -1 : 1;
        const x = Math.abs(localX) / clamp(opening + side * sideLag, .25, 1), y = localY;
        let wingTone = 0, wingGlyph = '';
        for (const upper of [false, true]) {
          const cx = upper ? .7 : .61, cy = upper ? -.48 : .55;
          const rx = upper ? .83 : .64, ry = upper ? .8 : .57;
          const angle = upper ? -.45 : .32, ca = Math.cos(angle), sa = Math.sin(angle);
          const u = (x - cx) * ca + (y - cy) * sa;
          const v = -(x - cx) * sa + (y - cy) * ca;
          const q = u * u / (rx * rx) + v * v / (ry * ry);
          if (q > 1 || x < .13 + Math.max(0, -y - .4) * .22) continue;
          // A small waist notch separates rounded hindwings from the broader,
          // taller forewings at the outer edge without breaking the attachment.
          if (x > .85 && y > .11 && y < .2) continue;
          const vein = Math.abs(Math.sin(Math.atan2(y + .03, x) * (8 + m.id % 2))) < .15;
          const eye = ((u + .04) / .21) ** 2 + ((v - (upper ? -.11 : .05)) / .23) ** 2;
          wingTone = q > .8 ? 8 : vein ? 3 : 5 + (1 - q) * 1.8;
          wingGlyph = RAMP[clamp(Math.round(wingTone), 0, 9)]!;
          if (q > .8 && Math.floor((Math.atan2(v, u) + Math.PI) * 10) % 3 === 0) {
            wingTone = 9; wingGlyph = '.';
          }
          if (eye < 1) { wingTone = eye < .35 ? 4 : 9; wingGlyph = eye < .35 ? 'o' : '@'; }
          if (fine && vein && q < .77 && eye > 1) wingGlyph = side * y < 0 ? '/' : '\\';
        }
        if (wingGlyph) put(c, r, wingGlyph, wingTone, ink, depth);
      }
    }

    // Six leg attachments are retained; reduced-grid sampling intentionally
    // merges fine segments rather than adding detached ornamental characters.
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const y = -.04 + k * .17;
        limb(side * .06, y, side * .34, y + .12, 5);
      }
      limb(side * .06, -.57, side * .16, -1.13, 8);
      limb(side * .16, -1.13, side * .31, -1.49, 8);
      point(side * .31, -1.49, 9, 'o');
    }
    limb(0, -.48, 0, .78, 8, '|');
    for (let k = 0; k < 5; k++) point(0, .06 + k * .14, 8, '=');
    point(0, -.18, 9, '#');
    point(0, -.49, 9, '@');

    if (m.activity.kind === 'nectar' && 'flower' in m.activity) {
      const flowerId = m.activity.flower;
      const flower = g.flowers.find(f => f.id === flowerId);
      if (flower) {
        const headX = rootX + .53 * si * scale;
        const headY = rootY - .53 * co * scale;
        // A delicate proboscis connects the head to the flower, behind the
        // body. Its source remains attached while the director settles.
        line(headX * 2 / worldW, headY * 2 / worldH, flower.x, flower.y, 4, ink, depth - 1, '.');
      }
    }

    if (o.director.showLabels) {
      const labelC = clamp(toColumn((rootX + maxX) * 2 / worldW) + 2, 1, columns - 2);
      const labelR = clamp(toRow((rootY + minY) * 2 / worldH) - 1, 1, rows - 2);
      put(labelC, labelR, String(m.id + 1), 7, ink, depth + 2);
    }
  }

  const cells: readonly ButterflyCell[] = Object.freeze(glyphs.map((glyph, i) =>
    Object.freeze({ glyph, tone: tones[i]!, ink: inks[i]! })));
  const textRows = new Array<string>(rows);
  for (let r = 0; r < rows; r++) textRows[r] = glyphs.slice(r * columns, (r + 1) * columns).join('');
  return Object.freeze({ columns, rows, cells, text: textRows.join('\n'), phase });
}
