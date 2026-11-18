/** Resource-bookkeeping doubles. These do not draw pixels or prove browser accessibility. */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const scope = { window: {} };
runInNewContext(readFileSync(new URL('../../../dist/artwork.js', import.meta.url), 'utf8'), scope);
export const legacy = scope.window.CuttlefishArtwork;

export function fakeBrowser(options = {}) {
  const targets = new Set(), canvases = [], observers = [], rafs = new Map();
  let nextRaf = 1, draws = 0, canvasWrites = 0;
  class Target {
    listeners = new Map();
    constructor() { targets.add(this); }
    addEventListener(type, listener) {
      const entries = this.listeners.get(type) ?? new Set();
      entries.add(listener); this.listeners.set(type, entries);
    }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    emit(type, data = {}) {
      for (const listener of [...this.listeners.get(type) ?? []]) listener({ type, ...data });
    }
    get listenerCount() { return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
  }
  class Observer {
    callback; targets = new Set(); disconnected = false;
    constructor(callback, kind) {
      if (options.failObserver === kind) throw new Error(`${kind} constructor failed`);
      this.callback = callback; this.kind = kind; observers.push(this);
    }
    observe(target) {
      this.targets.add(target);
      if (options.failObserve === this.kind) throw new Error(`${this.kind} observe failed`);
    }
    disconnect() { this.targets.clear(); this.disconnected = true; }
    fire(entries = [], force = false) { if (force || !this.disconnected) this.callback(entries); }
  }
  const context = () => new Proxy({
    createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
  }, {
    get(target, property) {
      if (property in target) return target[property];
      return () => { draws++; };
    },
    set(target, property, value) { target[property] = value; canvasWrites++; return true; },
  });
  class Canvas extends Target {
    #width = 0; #height = 0;
    constructor(rect = { left: 12, top: 20, width: 900, height: 506 }) {
      super(); this.rect = { ...rect }; this.ownerDocument = doc; this.context = context(); canvases.push(this);
    }
    get width() { return this.#width; }
    set width(value) { this.#width = value; canvasWrites++; }
    get height() { return this.#height; }
    set height(value) { this.#height = value; canvasWrites++; }
    getContext() { return options.noCanvas || (options.noAtlas && canvases.indexOf(this) > 0) ? null : this.context; }
    getBoundingClientRect() { return { ...this.rect }; }
  }
  const motion = new Target(); motion.matches = options.reduced ?? false;
  const doc = new Target(); doc.hidden = options.hidden ?? false;
  const win = new Target();
  win.devicePixelRatio = options.dpr ?? 1;
  win.matchMedia = () => motion;
  win.requestAnimationFrame = callback => { const id = nextRaf++; rafs.set(id, callback); return id; };
  win.cancelAnimationFrame = id => { rafs.delete(id); };
  win.ResizeObserver = class extends Observer { constructor(callback) { super(callback, 'resize'); } };
  win.IntersectionObserver = class extends Observer { constructor(callback) { super(callback, 'intersection'); } };
  doc.defaultView = win;
  doc.createElement = tag => { if (tag !== 'canvas') throw new Error(`Unsupported fake element ${tag}`); return new Canvas(); };
  let resolveFonts, rejectFonts;
  if (options.fonts) doc.fonts = { ready: new Promise((resolve, reject) => { resolveFonts = resolve; rejectFonts = reject; }) };
  const canvas = new Canvas(options.rect);
  return {
    doc, win, motion, canvas, canvases, observers, rafs, resolveFonts, rejectFonts,
    createCanvas: rect => new Canvas(rect),
    flush(timestamp) { const queued = [...rafs.values()]; rafs.clear(); for (const callback of queued) callback(timestamp); },
    resize(target, rect) {
      Object.assign(target.rect, rect);
      for (const observer of observers) if (observer.kind === 'resize' && observer.targets.has(target)) observer.fire();
    },
    intersect(target, visible) {
      for (const observer of observers) if (observer.kind === 'intersection' && observer.targets.has(target))
        observer.fire([{ target, isIntersecting: visible }]);
    },
    visibility(hidden) { doc.hidden = hidden; doc.emit('visibilitychange'); },
    reduce(value) { motion.matches = value; motion.emit('change', { matches: value }); },
    resources() {
      return {
        rafs: rafs.size,
        listeners: [...targets].reduce((sum, target) => sum + target.listenerCount, 0),
        observedTargets: observers.reduce((sum, observer) => sum + observer.targets.size, 0),
        draws, canvasWrites,
      };
    },
  };
}
