// Numerical / lifecycle fixture only. This is not a browser Canvas renderer.
import { createHash } from 'node:crypto';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

export function reefTestHost(options = {}) {
  const host = fakeBrowser(options);
  const makeCanvas = host.canvas;
  host.canvas = (width = 900, height = 620) => {
    const canvas = makeCanvas(width, height);
    const context = canvas.getContext('2d');
    context.createLinearGradient = () => ({ addColorStop() {} });
    context.measureText = text => ({ width: String(text).length * 6 });
    return canvas;
  };
  host.document.createElement = () => host.canvas();
  return host;
}

export function cellDigest(artwork) {
  const digest = createHash('sha256');
  for (const name of ['depth', 'tones', 'glyphs', 'kinds', 'owners', 'visibility']) {
    const values = artwork[name];
    digest.update(Buffer.from(values.buffer, values.byteOffset, values.byteLength));
  }
  return digest.digest('hex');
}

export function visibleCellDigest(artwork) {
  // The canonical renderer clears depth/ownership each frame but deliberately
  // reuses glyph/kind storage outside occupied cells. Those old values are never
  // drawn. Compare visible cell records for histories with different old poses.
  const digest = createHash('sha256').update(`${artwork.cols}:${artwork.rows};`);
  for (let index = 0; index < artwork.depth.length; index++) {
    if (artwork.depth[index] === -Infinity) continue;
    digest.update(JSON.stringify([index, artwork.depth[index], artwork.tones[index],
      artwork.glyphs[index], artwork.kinds[index], artwork.owners[index], artwork.visibility[index]]));
  }
  return digest.digest('hex');
}

export function advance(artwork, seconds, rate = 60) {
  const whole = Math.round(seconds * rate);
  if (Math.abs(whole / rate - seconds) > 1e-8) throw new Error('Fixture time must be an integer tick count.');
  for (let tick = 0; tick < whole; tick++) artwork.advance(1 / rate);
}

export function ownedPoint(artwork) {
  const centerX = artwork.cols * .5, centerY = artwork.rows * .5;
  let selected = -1, nearest = Infinity;
  for (let index = 0; index < artwork.owners.length; index++) {
    if (artwork.owners[index] !== 0 || artwork.visibility[index] < .5) continue;
    const x = index % artwork.cols, y = Math.floor(index / artwork.cols);
    const distance = Math.hypot(x - centerX, y - centerY);
    if (distance < nearest) { nearest = distance; selected = index; }
  }
  if (selected < 0) throw new Error('No visible manta cell to address.');
  return {
    x: (selected % artwork.cols + .5) * artwork.cellW,
    y: (Math.floor(selected / artwork.cols) + .5) * artwork.cellH
  };
}

export function listenerCount(host, ...canvases) {
  return host.document.listenerCount + host.view.listenerCount + host.motion.listenerCount
    + canvases.reduce((sum, canvas) => sum + canvas.listenerCount, 0);
}

export function poseVector(pose) {
  return [...pose.position, ...pose.forward, ...pose.reference,
    pose.bank, pose.wingEnergy, pose.turn, pose.lobeOpen, pose.dihedral];
}
