import { sampleOctopus } from './core.mjs';

// Original cell artwork. Everything visible in the scene is a printable ASCII
// character; the one rectangular background is the canvas clear. No bitmap art.
export const PALETTE = Object.freeze({
  water: '#09191f', current: '#294b53', rock: '#558281', rockLight: '#8fb5a1',
  shadow: '#a44846', coral: '#ed775f', edge: '#ffad86', light: '#ffd7ad',
  cream: '#fff0ce', pupil: '#09191f', ink: '#34415d', inkEdge: '#7785a7',
  inkLight: '#abb4d0', contact: '#ffe3a1',
});
const COLORS = Object.values(PALETTE);
const C = Object.fromEntries(Object.keys(PALETTE).map((k, i) => [k, i]));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, t) => { const u = clamp((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

export function gridMetrics(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1)
    throw new RangeError('A finite viewport of at least one CSS pixel is required.');
  let cols = clamp(Math.floor(width / (width < 600 ? 5.8 : 8.5)), 44, 106);
  let rows = clamp(Math.round(height / (width / cols * 1.65)), 24, 62);
  if (cols * rows > 4096) cols = Math.floor(4096 / rows);
  return { cols, rows, cellW: width / cols, cellH: height / rows,
    scale: Math.min(width * .44, height * .48), cx: width * .5, cy: height * .49 };
}

/** Pure cell output. Numeric replay checks compare these cells, not font pixels. */
export function rasterizeOctopus(state, { width = 960, height = 600 } = {}) {
  const pose = sampleOctopus(state), m = gridMetrics(width, height);
  const { cols, rows, cellW, cellH, scale, cx, cy } = m;
  const chars = new Uint8Array(cols * rows); chars.fill(32);
  const colors = new Uint8Array(chars.length), owners = new Uint8Array(chars.length);
  const depths = new Int16Array(chars.length); depths.fill(-32768);
  const world = (col, row) => [((col + .5) * cellW - cx) / scale, ((row + .5) * cellH - cy) / scale];
  const cell = (x, y) => [Math.floor((cx + x * scale) / cellW), Math.floor((cy + y * scale) / cellH)];
  const put = (col, row, glyph, color, depth, owner = 0) => {
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;
    const n = row * cols + col;
    if (depth < depths[n]) return;
    chars[n] = typeof glyph === 'number' ? glyph : glyph.charCodeAt(0);
    colors[n] = color; depths[n] = depth; owners[n] = owner;
  };
  const mark = (x, y, glyph, color, depth, owner = 0) => {
    const [col, row] = cell(x, y); put(col, row, glyph, color, depth, owner);
  };
  const text = (x, y, value, color, depth, owner = 0) => {
    const [col, row] = cell(x, y);
    for (let i = 0; i < value.length; i++) put(col + i, row, value[i], color, depth, owner);
  };
  const shape = (box, fn) => {
    const a = cell(box[0], box[1]), b = cell(box[2], box[3]);
    for (let row = Math.max(0, a[1] - 1); row <= Math.min(rows - 1, b[1] + 1); row++)
      for (let col = Math.max(0, a[0] - 1); col <= Math.min(cols - 1, b[0] + 1); col++) {
        const p = world(col, row); fn(p[0], p[1], col, row);
      }
  };

  // Three deliberate habitat cues. The shelf provides a fixed spatial contact
  // reference; currents and shell sit below the character in the visual hierarchy.
  const shelf = .70;
  for (let col = 0; col < cols; col++) {
    const [x] = world(col, 0);
    if (Math.abs(x) > 1.06) continue;
    const y = shelf + .03 * Math.sin(x * 5) + (Math.abs(x) > .85 ? .06 : 0);
    mark(x, y, '_', C.rockLight, 1);
    if (col % 3 === 0) mark(x, y + .08, '-', C.rock, 0);
    if (col % 9 === 0) mark(x, y + .13, '/', C.current, 0);
  }
  text(-.90, .54, '(@)', C.rockLight, 1);
  text(.66, .62, '/\\', C.rock, 1);
  text(-1.02, -.56, '~  ~', C.current, 0);
  text(.70, -.73, '~ ~', C.current, 0);
  text(.84, .04, '.', C.current, 0);
  text(-.96, .04, '.', C.current, 0);

  const body = pose.body;
  const ct = Math.cos(body.tilt || 0), st = Math.sin(body.tilt || 0);
  const sx = body.scaleX || 1, sy = body.scaleY || 1;
  const toLocal = (x, y) => {
    const dx = x - body.x, dy = y - body.y;
    return [(dx * ct + dy * st) / sx, (-dx * st + dy * ct) / sy];
  };
  const fromLocal = (x, y) => [body.x + x * sx * ct - y * sy * st, body.y + x * sx * st + y * sy * ct];

  function arm(index, depth) {
    const a = pose.arms[index];
    const points = a.points, baseRadius = a.radius || .064;
    for (let j = 0; j < points.length - 1; j++) {
      const p = points[j], q = points[j + 1];
      const progress = j / (points.length - 1);
      const r = baseRadius * (1 - progress * .66);
      const minX = Math.min(p[0], q[0]) - r, maxX = Math.max(p[0], q[0]) + r;
      const minY = Math.min(p[1], q[1]) - r, maxY = Math.max(p[1], q[1]) + r;
      const dx = q[0] - p[0], dy = q[1] - p[1], length2 = dx * dx + dy * dy;
      shape([minX, minY, maxX, maxY], (x, y, col, row) => {
        const t = length2 ? clamp(((x - p[0]) * dx + (y - p[1]) * dy) / length2, 0, 1) : 0;
        const nx = x - (p[0] + t * dx), ny = y - (p[1] + t * dy);
        const d = Math.hypot(nx, ny) / r;
        if (d > 1.15) return;
        const upper = ny < -.015;
        const glyph = d > .74 ? Math.abs(dy) < Math.abs(dx) * .45 ? '_' : dx * dy > 0 ? '\\' : '/'
          : progress > .65 ? 'o' : ':';
        put(col, row, glyph, upper ? C.edge : d > .72 ? C.coral : C.shadow, depth, 1);
      });
    }
    // Sparse sucker punctuation on the near-side arms only, with quiet gaps.
    if ([1, 3, 4, 6].includes(index)) for (const u of [.48, .68, .85]) {
      const j = Math.floor((points.length - 1) * u), p = points[j];
      mark(p[0], p[1] + .009, 'o', C.light, depth + 1, 1);
    }
  }
  // Authored occlusion: four supporting/back arms, then mantle, then the two
  // tactile and two front arms. Roots overlap; no detached decorative tentacles.
  const showMain = (pose.ink?.conceal || 0) < .999999;
  if (showMain) for (const k of [0, 2, 5, 7]) arm(k, 10 + k);
  function mantle() {
    shape([body.x - .62, body.y - .85, body.x + .62, body.y + .37], (x, y, col, row) => {
      const [lx, ly] = toLocal(x, y);
      const upper = (lx / (.435 - .04 * clamp((ly + .62) / .68, 0, 1))) ** 2 + ((ly + .235) / .405) ** 2;
      const lower = (lx / .345) ** 2 + ((ly - .045) / .235) ** 2;
      const d = Math.min(upper, lower);
      if (d > 1) return;
      let glyph = (col + row) % 2 === 0 ? ':' : ' ', color = C.coral;
      if (d > .83) {
        glyph = ly < -.55 ? '_' : lx < 0 ? '(' : ')'; color = C.edge;
      } else if (lx < -.22 && ly < -.22) { glyph = '/'; color = C.light; }
      else if (lx > .23 || ly > .10) { glyph = (col + row) % 3 === 0 ? '.' : ' '; color = C.shadow; }
      put(col, row, glyph, color, 30, 1);
    });
  }
  if (showMain) mantle();
  if (showMain) for (const k of [1, 6, 3, 4]) arm(k, 36 + k);
  // The web seals the arm roots but never fills the gaps along their lengths.
  if (showMain) shape([body.x - .32, body.y + .05, body.x + .32, body.y + .23], (x, y, col, row) => {
    const [lx, ly] = toLocal(x, y);
    if ((lx / .33) ** 2 + ((ly - .10) / .125) ** 2 < 1)
      put(col, row, ':', ly > .13 ? C.shadow : C.coral, 48, 1);
  });

  function eye(side, open = 1, depth = 60, overrideCenter) {
    const center = overrideCenter || fromLocal(side * .17, -.16);
    const rx = .135 * sx, ry = .155 * sy;
    const openness = clamp(open, .10, 1.1), gazeX = clamp(pose.gaze?.x || 0, -1, 1) * .035;
    const gazeY = clamp(pose.gaze?.y || 0, -1, 1) * .02;
    shape([center[0] - rx * 1.25, center[1] - ry * 1.25, center[0] + rx * 1.25, center[1] + ry * 1.25], (x, y, col, row) => {
      const dx = x - center[0], dy = y - center[1];
      const ex = dx * ct + dy * st, ey = -dx * st + dy * ct;
      const rr = (ex / rx) ** 2 + (ey / ry) ** 2;
      if (rr > 1) return;
      const lid = -ry + 2 * ry * (1 - openness);
      if (ey < lid) {
        put(col, row, ey > lid - .035 ? '_' : ':', C.coral, depth, 1); return;
      }
      const pupil = Math.abs(ey - gazeY) < Math.max(.017, cellH / scale * .45)
        && Math.abs(ex - gazeX) < rx * .72;
      put(col, row, pupil ? '=' : rr > .72 ? side < 0 ? '(' : ')' : '@',
        pupil ? C.pupil : C.cream, depth, 1);
    });
    // A lifted edge is enough to suggest a brow without inventing a human face.
    const a = fromLocal(side * .17 - .075, -.345 + (1 - openness) * .08);
    const b = fromLocal(side * .17 + .075, -.345 + (1 - openness) * .08 - side * .028);
    if (!overrideCenter) for (let i = 0; i < 5; i++) mark(mix(a[0], b[0], i / 4), mix(a[1], b[1], i / 4), '_', C.edge, depth + 1, 1);
  }
  if (showMain) { eye(-1, pose.eyes?.left ?? .82); eye(1, pose.eyes?.right ?? 1); }

  // The invitation is a visible pearl; the contacted arm endpoint is geometric,
  // not a label. Contact rays appear only when the endpoint has actually arrived.
  if (pose.target?.active && pose.ink.amount < .12) {
    const t = pose.target;
    mark(t.x, t.y, '@', C.contact, 55);
    if (pose.contact?.active) {
      mark(t.x - .06, t.y - .065, '\\', C.cream, 56);
      mark(t.x + .06, t.y - .065, '/', C.cream, 56);
      mark(t.x, t.y - .10, '|', C.cream, 56);
    } else {
      mark(t.x - .045, t.y, '(', C.rock, 54);
      mark(t.x + .045, t.y, ')', C.rock, 54);
    }
  }

  const amount = clamp(pose.ink?.amount || 0, 0, 1), peek = clamp(pose.ink?.peek || 0, 0, 1);
  const side = pose.ink?.side === -1 ? -1 : 1;
  if (amount > .005) {
    const radius = .76 * smooth(0, .65, amount), yCenter = -.08;
    shape([-radius * 1.32, yCenter - radius * 1.18, radius * 1.32, yCenter + radius], (x, y, col, row) => {
      const angle = Math.atan2(y - yCenter, x);
      const edge = radius * (1 + .10 * Math.sin(angle * 7 + .7) + .04 * Math.cos(angle * 11));
      const d = Math.hypot(x, (y - yCenter) * 1.08) / Math.max(.001, edge);
      if (d > 1) return;
      // Empty cloud cells erase the animal beneath. Fixed pattern + continuous
      // boundary avoids particle noise and remains a readable ink silhouette.
      const boundary = d > .91, dissolve = amount < .35;
      if (dissolve && ((col * 7 + row * 11) % 17) / 17 > amount / .35) return;
      const glyph = boundary ? Math.abs(y - yCenter) > Math.abs(x) ? '~' : x < 0 ? '(' : ')'
        : (col + row * 3) % 4 === 0 ? ':' : ' ';
      put(col, row, glyph, boundary ? C.inkEdge : C.ink, 80, 2);
    });
    if (peek > .04) {
      const px = side * mix(.17, .57, peek), py = mix(.05, -.19, peek);
      // A single eye comes first. A hooked arm emerges later, gripping the
      // cloud's edge; the opposite side stays concealed.
      eye(side, .72 + .28 * peek, 92, [px, py]);
      if (peek > .35) {
        const anchorX = side * .71, anchorY = .13;
        const curl = '(@)'; text(anchorX - .055, anchorY, curl, C.edge, 93, 1);
        for (let j = 0; j < 9; j++) {
          const u = j / 8;
          mark(mix(px, anchorX, u) + side * .10 * Math.sin(u * Math.PI), mix(py + .19, anchorY, u),
            side > 0 ? ')' : '(', C.coral, 92, 1);
        }
      }
    }
  }
  let glyphCount = 0, characterCells = 0, inkCells = 0;
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== 32) glyphCount++;
    if (owners[i] === 1) characterCells++;
    if (owners[i] === 2) inkCells++;
  }
  return { ...m, width, height, chars, colors, owners, pose,
    glyphCount, occupiedCells: glyphCount, characterCells, inkCells,
    hitTest(x, y) { const [col, row] = cell(x, y); return col >= 0 && row >= 0 && col < cols && row < rows && owners[row * cols + col] === 1; },
  };
}

export function gridToText(grid) {
  let out = '';
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) out += String.fromCharCode(grid.chars[row * grid.cols + col]);
    out += row === grid.rows - 1 ? '' : '\n';
  }
  return out;
}

export function renderOctopus(canvas, state, { width, height, dpr = 1 } = {}) {
  width ??= canvas.clientWidth || canvas.width;
  height ??= canvas.clientHeight || canvas.height;
  const grid = rasterizeOctopus(state, { width, height });
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is required for the octopus study.');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = PALETTE.water; ctx.fillRect(0, 0, width, height);
  ctx.font = `600 ${Math.min(grid.cellH * .95, grid.cellW * 1.62).toFixed(3)}px "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let last = -1;
  for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
    const n = row * grid.cols + col;
    if (grid.chars[n] === 32) continue;
    if (grid.colors[n] !== last) { last = grid.colors[n]; ctx.fillStyle = COLORS[last]; }
    ctx.fillText(String.fromCharCode(grid.chars[n]), (col + .5) * grid.cellW, (row + .5) * grid.cellH);
  }
  return { cols: grid.cols, rows: grid.rows, cellCount: grid.chars.length,
    glyphCount: grid.glyphCount, occupiedCells: grid.occupiedCells,
    characterCells: grid.characterCells, inkCells: grid.inkCells,
    grid, hitTest: grid.hitTest };
}
