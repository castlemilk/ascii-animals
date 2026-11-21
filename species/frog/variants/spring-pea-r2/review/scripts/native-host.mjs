/** Native Canvas evidence host. Not a browser or a mobile device. */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const path = process.env.FROG_CANVAS_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/@napi-rs/canvas` : '@napi-rs/canvas');
export const { createCanvas, GlobalFonts, loadImage } = require(path);
const font = '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf';
export const fontIdentity = existsSync(font) ? { family: 'Liberation Mono', path: font, sha256: createHash('sha256').update(readFileSync(font)).digest('hex') } : { family: 'native fallback; exact font unpinned' };
if (existsSync(font)) { GlobalFonts.registerFromPath(font, 'Liberation Mono'); GlobalFonts.registerFromPath(font, 'monospace'); }

/**
 * Original's atlas is frozen into a lossless PNG Image after atlas construction.
 * This avoids native Skia retaining mutable Canvas display lists across frames.
 * R2 draws text directly and has no atlas. This is a disclosed capture-host detail;
 * neither production renderer is modified. Browser font/raster parity is unclaimed.
 */
export async function nativeSurface(width, height, factory, options) {
  let atlas = null;
  const canvas = createCanvas(width, height);
  canvas.ownerDocument = { defaultView: {}, createElement(name) {
    if (name !== 'canvas') throw new Error('Native host only supplies Canvas');
    atlas = createCanvas(1, 1); return atlas;
  } };
  const preview = factory(canvas, options);
  preview.resize(width, height, 1);
  if (atlas) {
    const image = await loadImage(atlas.toBuffer('image/png'));
    const context = canvas.getContext('2d'), drawImage = context.drawImage.bind(context);
    context.drawImage = (source, ...args) => drawImage(source === atlas ? image : source, ...args);
  }
  return { canvas, preview, atlasSnapshot: Boolean(atlas) };
}
