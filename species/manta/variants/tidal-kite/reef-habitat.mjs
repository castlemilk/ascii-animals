// Original graphic habitat. All accents are printable ASCII glyphs; no raster
// reef, blurred shadow or decorative swarm competes with the character.
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function drawReefHabitat(host, pose) {
  const c = host.ctx, w = host.width, h = host.height;
  if (!w || !h) return;
  c.save();
  // Clear the shared host's background particles for this study instance only.
  c.fillStyle = '#081b25'; c.fillRect(0, 0, w, h);
  const cell = w < 520 ? 11 : 14;
  c.font = `500 ${cell}px "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  // Two broken contours give a fixed reference for body travel. Open water is
  // deliberately empty; the low reef never crosses the whole-body silhouette.
  for (let layer = 0; layer < 2; layer++) {
    c.fillStyle = layer ? '#23505a' : '#163843';
    for (let col = 0; col < Math.ceil(w / cell); col++) {
      const x = col * cell + cell * .5;
      const ridge = h * (.84 + layer * .065) + Math.sin(col * .18 + layer * 1.8) * h * .018;
      const glyph = col % 11 === 0 ? '/' : col % 11 === 6 ? '\\' : col % 4 === 1 ? '~' : '_';
      c.fillText(glyph, x, ridge);
      if (layer && col % 6 === 2) c.fillText(':', x, ridge + cell * 1.4);
    }
  }
  // Three calm current marks, held near the margins and below animal contrast.
  c.fillStyle = '#28515d';
  for (let i = 0; i < 3; i++) {
    const side = i === 1 ? .87 : .10;
    const x = w * side + Math.sin(pose.time * .18 + i) * 7 * Math.abs(pose.current);
    const y = h * (.18 + i * .19);
    c.fillText(pose.current < 0 ? '< ~' : '~ >', x, y);
  }
  // One input-owned coral target, visible through anticipation and settling.
  if (pose.invitationTarget && pose.invitationAge !== null) {
    const age = pose.invitationAge;
    const alpha = age < 3.25 ? 1 : clamp((6.4 - age) / 3.15, 0, 1);
    c.globalAlpha = alpha;
    const x = (pose.invitationTarget.x + .5) * w;
    const y = (pose.invitationTarget.y + .5) * h;
    c.fillStyle = '#f68c72';
    c.font = `600 ${w < 520 ? 15 : 18}px "Liberation Mono", monospace`;
    c.fillText(age < .65 ? '(+)' : '+', x, y);
    c.globalAlpha = alpha * .55;
    c.fillText('~', x - 18, y + 10); c.fillText('~', x + 18, y - 10);
  }
  c.restore();
}
