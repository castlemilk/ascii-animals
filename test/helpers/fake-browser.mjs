// A numerical/lifecycle harness, not a browser rendering implementation.
export function fakeBrowser({ reducedMotion = false, dpr = 1 } = {}) {
  class Target {
    listeners = new Map();
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(listener);
    }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    emit(type, event = {}) { for (const listener of [...(this.listeners.get(type) || [])]) listener(event); }
    get listenerCount() { return [...this.listeners.values()].reduce((n, set) => n + set.size, 0); }
  }
  const noop = () => {};
  function context() {
    const methods = new Map();
    return new Proxy({
      createRadialGradient: () => ({ addColorStop: noop }),
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
    }, { get(target, key) {
      if (key in target) return target[key];
      if (!methods.has(key)) methods.set(key, noop);
      return methods.get(key);
    }, set(target, key, value) { target[key] = value; return true; } });
  }
  let time = 1000, serial = 0;
  const callbacks = new Map(), resizes = new Set(), intersections = new Set();
  const document = new Target(); document.hidden = false;
  const motion = new Target(); motion.matches = reducedMotion;
  const view = new Target();
  Object.assign(view, {
    devicePixelRatio: dpr, performance: { now: () => time },
    requestAnimationFrame: callback => { const handle = ++serial; callbacks.set(handle, callback); return handle; },
    cancelAnimationFrame: handle => callbacks.delete(handle),
    setTimeout: callback => { callback(); return 1; },
    matchMedia: () => motion,
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; resizes.add(this); }
      observe(target) { this.target = target; }
      disconnect() { resizes.delete(this); }
    },
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; intersections.add(this); }
      observe(target) { this.target = target; }
      disconnect() { intersections.delete(this); }
    }
  });
  document.defaultView = view; view.document = document;
  function canvas(width = 947, height = 707) {
    const target = new Target(), ctx = context();
    Object.assign(target, {
      ownerDocument: document, width: 300, height: 150,
      rect: { width, height, left: 0, top: 0 }, layoutReads: 0,
      getContext: () => ctx,
      getBoundingClientRect() { target.layoutReads++; return { ...target.rect }; },
      dispatchEvent: () => true
    });
    return target;
  }
  document.createElement = () => canvas();
  return {
    view, document, motion, canvas, resizes, intersections,
    get pending() { return callbacks.size; },
    get now() { return time; },
    frame(ms = 1000 / 60) {
      time += ms;
      const batch = [...callbacks.values()]; callbacks.clear();
      for (const callback of batch) callback(time);
    },
    hide(hidden) { document.hidden = hidden; document.emit('visibilitychange'); },
    setReduced(matches) { motion.matches = matches; motion.emit('change', { matches }); },
    intersect(target, isIntersecting) {
      for (const observer of intersections) if (observer.target === target) observer.callback([{ target, isIntersecting }]);
    }
  };
}
