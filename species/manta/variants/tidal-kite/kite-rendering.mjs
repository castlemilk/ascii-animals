// Species-local presentation for Tidal Kite. The package renderer stays intact.
// The existing renderer addresses 24 tone rows and this many glyph columns;
// replacing only this instance's atlas keeps its cell ownership and hit tests.
const HOST_GLYPH_COLUMNS = '.,:;!i1l+txzvcofnae0&%8B@'.length;
export const KITE_GLYPHS = '.:-=+*#';
const MATERIALS = [
  ['#23525f', '#3e8b95', '#77d8ca', '#c6f5df'],
  ['#23525f', '#3e8b95', '#77d8ca', '#c6f5df'],
  ['#425c61', '#97b3b0', '#d0dcc6', '#f5ebc8']
];
const mix = (a, b, amount) => a.map((value, index) => Math.round(value + (b[index] - value) * amount));
function materialColor(host, kind, band) {
  // Lagoon is this authored palette. Other inherited palette choices still
  // affect the study, with four flat bands instead of continuous shading.
  if (kind === 2 || host.options.palette === 'lagoon') {
    const color = MATERIALS[kind][band];
    return [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
  }
  const palette = host.palette, mid = kind === 1 ? palette.fin : palette.middle;
  return [mix(palette.low, mid, .2), mix(palette.low, mid, .7), mid, mix(mid, palette.high, .68)][band];
}

export function buildKiteAtlas(host) {
  if (host.destroyed || !host.width || !host.height) return;
  const naturalSize = Math.max(1, Math.ceil(host.cellH * 1.6 * host.dpr));
  const sz = Math.min(64, naturalSize);
  host.spriteDrawSize = naturalSize / host.dpr;
  host.sprite = sz;
  host.atlas.width = HOST_GLYPH_COLUMNS * sz;
  host.atlas.height = 72 * sz;
  const a = host.atlasCtx;
  a.clearRect(0, 0, host.atlas.width, host.atlas.height);
  a.font = `700 ${Math.max(6, host.cellH * 1.03) * host.dpr * sz / naturalSize}px "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
  a.textAlign = 'center'; a.textBaseline = 'middle';
  host.colors = []; host.colorBytes = [];
  for (let kind = 0; kind < 3; kind++) for (let tone = 0; tone < 24; tone++) {
    const band = tone < 8 ? 0 : tone < 14 ? 1 : tone < 20 ? 2 : 3;
    const rgb = materialColor(host, kind, band);
    const color = `rgb(${rgb.join(',')})`;
    host.colors.push(color); host.colorBytes.push(rgb); a.fillStyle = color;
    for (let column = 0; column < HOST_GLYPH_COLUMNS; column++) {
      // The host's zero-variation manta samples use 0..76% of its atlas.
      // Spread our seven printable marks across that reachable range, so the
      // pale rim is a bold # and the teal shoulder is a substantial *.
      const glyph = KITE_GLYPHS[Math.min(6, Math.round(column / ((HOST_GLYPH_COLUMNS - 1) * .76) * 6))];
      a.fillText(glyph, (column + .5) * sz, (kind * 24 + tone + .5) * sz + host.dpr * .25 * sz / naturalSize);
    }
  }
}
