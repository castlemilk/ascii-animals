/** Actual native Canvas pixels from the integrated frog renderer; NOT a browser. */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createLegacyFrogPreview } from '../generated/legacy-preview.mjs';
const require = createRequire(import.meta.url);
const modulePath = process.env.FROG_CANVAS_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/@napi-rs/canvas` : '@napi-rs/canvas');
export const { createCanvas, GlobalFonts } = require(modulePath);
const fontPath = process.env.FROG_FONT_FILE || '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf';
export const captureFont = existsSync(fontPath) ? { file: fontPath, sha256: createHash('sha256').update(readFileSync(fontPath)).digest('hex'), family: 'Liberation Mono' } : { family: 'native system fallback; exact file unpinned' };
if (existsSync(fontPath)) { GlobalFonts.registerFromPath(fontPath, 'Liberation Mono'); GlobalFonts.registerFromPath(fontPath, 'monospace'); }
export function nativePreview(width=720, height=540, options={}) {
  const doc = { defaultView: {}, createElement: name => { if (name !== 'canvas') throw new Error('Native capture only provides Canvas'); return createCanvas(1,1); } };
  const canvas = createCanvas(width,height); canvas.ownerDocument = doc;
  const preview = createLegacyFrogPreview(canvas, options); preview.resize(width,height,1);
  return { canvas, preview };
}
