/** Actual native Canvas pixels + real legacy projection/atlas methods; NOT a browser. */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { createLegacyFrogPreview, LEGACY_SOURCE_SHA256 } from '../generated/legacy-preview.mjs';
const require = createRequire(import.meta.url);
const modulePath = process.env.FROG_CANVAS_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/@napi-rs/canvas` : '@napi-rs/canvas');
export const { createCanvas, GlobalFonts } = require(modulePath);
const fontPath = process.env.FROG_FONT_FILE || '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf';
export const captureFont = existsSync(fontPath) ? { file: fontPath, sha256: createHash('sha256').update(readFileSync(fontPath)).digest('hex'), family: 'Liberation Mono' } : { family: 'native system fallback; exact file unpinned' };
if (existsSync(fontPath)) { GlobalFonts.registerFromPath(fontPath, 'Liberation Mono'); GlobalFonts.registerFromPath(fontPath, 'monospace'); }
const source = readFileSync(new URL('../../../dist/artwork.js', import.meta.url), 'utf8');
const hash = createHash('sha256').update(source).digest('hex');
if (hash !== LEGACY_SOURCE_SHA256) throw new Error(`Legacy renderer changed: ${hash}. Review adapter compatibility first.`);
const scope = { window: {} }; vm.createContext(scope); vm.runInContext(source, scope, { filename: 'dist/artwork.js' });
export function nativePreview(width=720, height=540, options={}) {
  const doc = { defaultView: scope.window, createElement: name => { if (name !== 'canvas') throw new Error('Native capture only provides Canvas'); return createCanvas(1,1); } };
  const canvas = createCanvas(width,height); canvas.ownerDocument = doc;
  const preview = createLegacyFrogPreview(canvas, options); preview.resize(width,height,1);
  return { canvas, preview };
}
