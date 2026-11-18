/** Bookkeeping-only browser doubles. These do not emulate rendering or accessibility. */
export class FakeTarget {
  listeners = new Map();
  saved = new Map();
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
    if (!this.saved.has(type)) this.saved.set(type, []);
    this.saved.get(type).push(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  fire(type, patch = {}) {
    const event = { type, target: this, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      button: 0, clientX: 200, clientY: 200, key: '', repeat: false, altKey: false,
      ctrlKey: false, metaKey: false, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...patch };
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn.call(this, event);
    return event;
  }
  get listenerCount() { return [...this.listeners.values()].reduce((n, s) => n + s.size, 0); }
}

export function makeHost({ reducedMotion = false, hidden = false, width = 900, height = 600,
  resizeFailure = false, intersectionFailure = false, previewDrawFailure = false } = {}) {
  const document = new FakeTarget(), window = new FakeTarget(), media = new FakeTarget();
  const frames = new Map(), resizeObservers = [], intersectionObservers = [], canvases = [], previews = [];
  let nextFrame = 1;
  media.matches = reducedMotion; document.hidden = hidden; document.defaultView = window;
  window.devicePixelRatio = 1;
  window.matchMedia = () => media;
  window.requestAnimationFrame = callback => { const id = nextFrame++; frames.set(id, callback); return id; };
  window.cancelAnimationFrame = id => frames.delete(id);
  window.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = false; resizeObservers.push(this); }
    observe(target) { this.targets.add(target); if (resizeFailure) throw new Error('fake resize observe failure'); }
    disconnect() { this.disconnected = true; this.targets.clear(); }
  };
  window.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = false; intersectionObservers.push(this); }
    observe(target) { this.targets.add(target); if (intersectionFailure) throw new Error('fake intersection observe failure'); }
    disconnect() { this.disconnected = true; this.targets.clear(); }
  };
  function canvas() {
    const result = new FakeTarget(); result.ownerDocument = document;
    result.rect = { left: 40, top: 20, width, height }; result.width = width; result.height = height;
    result.getBoundingClientRect = () => ({ ...result.rect }); canvases.push(result); return result;
  }
  function previewFactory(canvas) {
    const preview = { canvas, draws: [], resizes: [], updates: [], disposed: 0,
      resize(...args) { if (this.disposed) throw new Error('draw after disposal'); this.resizes.push(args); },
      update(value) { if (this.disposed) throw new Error('update after disposal'); this.updates.push(value); },
      draw(state, options) {
        if (previewDrawFailure) throw new Error('fake draw failure');
        if (this.disposed) throw new Error('draw after disposal'); this.draws.push({ state, options });
        return { glyphs: 0, samples: 0, cols: 72, rows: 40 };
      },
      targetAt(point) { return { ...point }; },
      toText() { return 'frog mock'; },
      dispose() { this.disposed++; },
    };
    previews.push(preview); return preview;
  }
  function flush(now) { const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(now); }
  function resize(target) { for (const observer of resizeObservers) if (observer.targets.has(target)) observer.callback([{ target }]); }
  function intersect(target, isIntersecting) {
    for (const observer of intersectionObservers) if (observer.targets.has(target)) observer.callback([{ target, isIntersecting }]);
  }
  return { document, window, media, frames, resizeObservers, intersectionObservers, canvases, previews, canvas, previewFactory, flush, resize, intersect,
    get listenerCount() { return [document, window, media, ...canvases].reduce((sum, target) => sum + target.listenerCount, 0); },
    reduced(value) { media.matches = value; media.fire('change'); },
    hidden(value) { document.hidden = value; document.fire('visibilitychange'); },
  };
}
