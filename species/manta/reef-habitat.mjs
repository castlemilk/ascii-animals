// Original reef silhouettes and glyph sediment. Presentation only: no clock,
// randomness, listeners, atlas mutation, or animal ownership cells.
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const ridge = (x, layer, phase) => .79 + layer * .078
  + Math.sin(x * 5.7 + layer * 1.6 + phase) * .038
  + Math.sin(x * 17.1 + layer * 2.3) * .014;

export function drawReefHabitat(host, pose) {
  const c = host.ctx, w = host.width, h = host.height;
  if (!w || !h) return;
  const t = pose.time, shift = pose.position[0] * .009;
  c.save();

  // Distant water: one quiet shaft, well above the brightest animal tones.
  const light = c.createLinearGradient(w * .18, 0, w * .68, h);
  light.addColorStop(0, 'rgba(63,119,124,.075)');
  light.addColorStop(.65, 'rgba(45,92,94,.025)');
  light.addColorStop(1, 'rgba(14,37,40,0)');
  c.fillStyle = light;
  c.beginPath(); c.moveTo(w * .12, 0); c.lineTo(w * .36, 0);
  c.lineTo(w * .81, h); c.lineTo(w * .46, h); c.closePath(); c.fill();

  // Three low strata establish depth while leaving open water around the ray.
  for (let layer = 0; layer < 3; layer++) {
    c.fillStyle = ['rgba(27,66,67,.23)', 'rgba(21,54,56,.52)', 'rgba(12,34,38,.88)'][layer];
    c.beginPath(); c.moveTo(0, h);
    for (let i = 0; i <= 80; i++) {
      const x = i / 80;
      c.lineTo(x * w, ridge(x + shift * (layer + 1), layer, .25) * h);
    }
    c.lineTo(w, h); c.closePath(); c.fill();
    c.font = `${w < 520 ? 9 : 11}px "Liberation Mono", monospace`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = ['rgba(83,143,137,.15)', 'rgba(69,127,119,.22)', 'rgba(69,121,114,.24)'][layer];
    const spacing = w < 520 ? 14 : 16;
    for (let x = 8; x < w; x += spacing) {
      const u = x / w + shift * (layer + 1);
      const y = ridge(u, layer, .25) * h;
      const glyph = ['.', ':', ',', '-', '~'][(Math.floor(x / spacing) * 7 + layer * 3) % 5];
      c.fillText(glyph, x, y + 5);
      if ((Math.floor(x / spacing) + layer) % 3 === 0) c.fillText('.', x + 5, y + 22);
    }
  }

  // A projected shadow belongs to this ray, not a second silhouette in water.
  // It compresses when the disc banks and follows its translation consistently.
  const shadowScale = host.scale * host.objectScale * .78;
  const shadowX = w * .5 + pose.position[0] * host.scale * .8;
  const shadowY = h * .82 + pose.position[1] * host.scale * .25;
  const project = (x, y) => [shadowX + ((x - .3) * host.r00 + y * host.r01) * shadowScale,
    shadowY + ((x - .3) * host.r10 + y * host.r11) * shadowScale * .30];
  const outline = [[1.10,-.30],[.95,-.65],[.58,-1.70],[-.03,-2.70],[-.52,-1.48],[-.94,-.32],
    [-1.03,-.06],[-3.10,0],[-1.03,.06],[-.94,.32],[-.52,1.48],[-.03,2.70],[.58,1.70],[.95,.65],[1.10,.30]];
  c.fillStyle = `rgba(1,7,10,${.32 - .05 * clamp(-pose.position[2], 0, 2)})`;
  c.filter = `blur(${w < 520 ? 4 : 7}px)`;
  c.beginPath();
  outline.forEach(([x,y], i) => { const p = project(x,y); i ? c.lineTo(...p) : c.moveTo(...p); });
  c.closePath(); c.fill(); c.filter = 'none';

  // Small foreground sea fans frame the shelf. Their exact count and branching
  // are fixed; nothing grows into the subject's open-water silhouette.
  for (const [rx, ry, scale, sign] of [[.08,.97,.85,1],[.93,.96,1,-1]]) {
    const x = w * rx, y = h * ry, unit = Math.min(w / 12, 54) * scale;
    c.strokeStyle = 'rgba(61,109,105,.25)'; c.lineWidth = w < 520 ? .8 : 1;
    for (let branch = 0; branch < 5; branch++) {
      const angle = -Math.PI / 2 + (branch - 2) * .25;
      const len = unit * (1.05 - Math.abs(branch - 2) * .1);
      const tipX = x + Math.cos(angle) * len * sign, tipY = y + Math.sin(angle) * len;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (tipX-x) * .25, y - len * .6, tipX, tipY); c.stroke();
      for (let k = 1; k <= 3; k++) {
        const q = k / 4, bx = x + (tipX-x) * q, by = y + (tipY-y) * q;
        c.beginPath(); c.moveTo(bx,by); c.lineTo(bx + sign * len * .13, by - len * .14); c.stroke();
      }
    }
  }

  // Widely spaced current tracers let travel be read against the fixed shelf.
  c.strokeStyle = 'rgba(94,163,157,.12)'; c.lineWidth = .7;
  for (let i = 0; i < 10; i++) {
    const wrap = ((i * .137 + t * pose.current * .009) % 1 + 1) % 1;
    const x = wrap * w, y = h * (.15 + (i % 4) * .135) + Math.sin(i * 2.4 + t * .11) * 6;
    // Exclude the central disc area to keep the habitat below its contrast budget.
    if (Math.abs(x-w*.5) < w*.31 && y > h*.24 && y < h*.68) continue;
    c.beginPath(); c.moveTo(x,y); c.quadraticCurveTo(x+11,y-2,x+23,y-1); c.stroke();
  }
  c.restore();
}
