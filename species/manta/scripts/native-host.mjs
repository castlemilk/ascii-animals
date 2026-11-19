// Actual native Canvas rasterization + mocked browser bookkeeping. NOT a browser.
import { createRequire } from 'node:module';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';
const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
export function nativeHost(width, height, { reducedMotion = false, dpr = 1 } = {}) {
  const env = fakeBrowser({ reducedMotion, dpr });
  const surfaces = new WeakMap();
  const rasterStats = { spriteCopies: 0, spriteDraws: 0 };

  // This native backend snapshots the entire mutable source canvas on every
  // drawImage call. Reading thousands of glyphs directly from the atlas can
  // therefore retain >1 GiB for a single frame. Copy each integer glyph crop
  // once, then pass that small native canvas to the unchanged draw operation.
  // Production geometry, projection, atlas content and glyph selection are
  // untouched. Native resampling may differ by one channel level; this helper
  // is native-Canvas evidence, never browser pixel-parity evidence.
  function instrument(context, state) {
    if (state.contexts.has(context)) return context;
    state.contexts.add(context);
    for (const method of ['clearRect', 'fillRect', 'strokeRect', 'fill', 'stroke',
      'fillText', 'strokeText', 'putImageData', 'reset']) {
      if (typeof context[method] !== 'function') continue;
      const original = context[method].bind(context);
      context[method] = (...args) => { state.revision++; return original(...args); };
    }
    const drawImage = context.drawImage.bind(context);
    context.drawImage = (source, ...args) => {
      const sourceState = surfaces.get(source);
      // The canonical atlas uses integral, bounded source rectangles. Preserve
      // arbitrary images, large crops and non-integral source rectangles as-is.
      if (sourceState && args.length === 8
        && args.slice(0, 4).every(Number.isInteger)
        && args[2] > 0 && args[3] > 0 && args[2] <= 64 && args[3] <= 64) {
        const dimensions = `${source.width}:${source.height}`;
        if (sourceState.copiedRevision !== sourceState.revision || sourceState.dimensions !== dimensions) {
          sourceState.tiles.clear();
          sourceState.copiedRevision = sourceState.revision;
          sourceState.dimensions = dimensions;
        }
        const key = args.slice(0, 4).join(':');
        let tile = sourceState.tiles.get(key);
        if (!tile) {
          tile = createCanvas(args[2], args[3]);
          const pixels = sourceState.nativeGetContext('2d').getImageData(...args.slice(0, 4));
          tile.getContext('2d').putImageData(pixels, 0, 0);
          sourceState.tiles.set(key, tile); rasterStats.spriteCopies++;
        }
        state.revision++; rasterStats.spriteDraws++;
        return drawImage(tile, 0, 0, args[2], args[3], ...args.slice(4));
      }
      state.revision++;
      return drawImage(source, ...args);
    };
    return context;
  }

  function canvas(w = width, h = height) {
    const surface = createCanvas(w, h), target = env.canvas(w, h);
    const nativeGetContext = surface.getContext.bind(surface);
    const state = { nativeGetContext, revision: 0, copiedRevision: -1,
      dimensions: '', tiles: new Map(), contexts: new WeakSet() };
    surfaces.set(surface, state);
    surface.getContext = (kind, ...args) => {
      const context = nativeGetContext(kind, ...args);
      return kind === '2d' && context ? instrument(context, state) : context;
    };
    for (const axis of ['width', 'height']) {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(surface), axis);
      Object.defineProperty(surface, axis, {
        configurable: true, enumerable: true,
        get: () => descriptor.get.call(surface),
        set: value => { state.revision++; descriptor.set.call(surface, value); }
      });
    }
    surface.ownerDocument = env.document;
    surface.rect = target.rect;
    surface.getBoundingClientRect = () => ({ ...surface.rect });
    surface.addEventListener = target.addEventListener.bind(target);
    surface.removeEventListener = target.removeEventListener.bind(target);
    surface.emit = target.emit.bind(target);
    Object.defineProperty(surface, 'listenerCount', { get: () => target.listenerCount });
    surface.dispatchEvent = () => true;
    return surface;
  }
  env.document.createElement = tag => {
    if (tag !== 'canvas') throw new Error(`Native capture only supports canvas, not ${tag}`);
    return canvas(1, 1);
  };
  return { env, canvas: canvas(), fonts: GlobalFonts.families, rasterStats };
}
