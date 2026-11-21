import { getBrowserScheduler } from '../../../src/core/scheduler.js';
import { createPuppetState, cuePuppet, stepPuppet, samplePuppet, getPuppetState } from './model.mjs';
import { rasterizePuppet, drawPuppetGrid } from './render.mjs';

const STEP = 1 / 60;
const defaults = Object.freeze({ seed: 7, autoStart: true, paused: false, size: 1, habitat: true });
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

function normalize(patch, previous = defaults) {
  if (!plain(patch)) throw new TypeError('Ink Puppet options must be a plain object.');
  const next = { ...previous };
  for (const key of Reflect.ownKeys(patch)) {
    if (typeof key !== 'string' || !Object.hasOwn(defaults, key)) throw new TypeError(`Unknown Ink Puppet option: ${String(key)}`);
    const descriptor = Object.getOwnPropertyDescriptor(patch, key);
    if (!Object.hasOwn(descriptor, 'value')) throw new TypeError('Options must contain data properties.');
    const value = descriptor.value;
    if (key === 'seed') {
      if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError('seed must be an unsigned 32-bit integer.');
    } else if (key === 'size') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < .35 || value > 1.4) throw new RangeError('size must be between .35 and 1.4.');
    } else if (typeof value !== 'boolean') throw new TypeError(`${key} must be boolean.`);
    next[key] = value;
  }
  return Object.freeze(next);
}

/** Opt-in prototype controller. Existing Cuttlefish exports are untouched. */
export class InkPuppetArtwork {
  constructor(canvas, options = {}) {
    this.options = normalize(options);
    if (!canvas?.ownerDocument?.defaultView || typeof canvas.getContext !== 'function') throw new TypeError('Ink Puppet needs a browser canvas.');
    this.canvas = canvas;
    this.document = canvas.ownerDocument;
    this.view = this.document.defaultView;
    this.context = canvas.getContext('2d', { alpha: false });
    if (!this.context) throw new Error('Canvas 2D is unavailable.');
    this.state = createPuppetState(this.options.seed);
    this._destroyed = false;
    this._userPaused = this.options.paused;
    this._inView = true;
    this._unsubscribe = null;
    this._last = null;
    this._accumulator = 0;
    this._manualAccumulator = 0;
    this._listeners = [];
    this._subscribers = new Set();
    this.droppedSeconds = 0;
    this.width = this.height = 0;
    this.dpr = 1;
    this.tool = 'investigate';
    this.motion = this.view.matchMedia?.('(prefers-reduced-motion: reduce)');
    this._reduced = Boolean(this.motion?.matches);
    const on = (target, type, callback) => {
      target?.addEventListener?.(type, callback, { passive: true });
      this._listeners.push(() => target?.removeEventListener?.(type, callback));
    };
    try {
      on(canvas, 'pointermove', event => {
        const point = this._point(event);
        if (point && !this.paused && this._canRun()) this.cue({ type: 'point', ...point });
      });
      on(canvas, 'pointerdown', event => {
        const point = this._point(event);
        if (!point || this.document.hidden || !this._inView) return;
        if (this.paused) this.showStill(this.tool, this.tool === 'investigate' ? 2.2 : 1.7, point);
        else this.cue({ type: this.tool, ...point });
      });
      const leave = () => { if (!this.destroyed) cuePuppet(this.state, { type: 'leave' }); };
      for (const event of ['pointerleave', 'pointercancel', 'lostpointercapture']) on(canvas, event, leave);
      on(this.document, 'visibilitychange', () => { this._sync(); this._notify(); });
      on(this.view, 'resize', () => this.resize());
      on(this.motion, 'change', event => {
        this._reduced = Boolean(event.matches);
        // Returning to no-preference does not revoke an explicit user pause.
        this._sync(); this.render();
      });
      if (typeof this.view.ResizeObserver === 'function') {
        this.resizeObserver = new this.view.ResizeObserver(() => this.resize());
        this.resizeObserver.observe(canvas);
      }
      if (typeof this.view.IntersectionObserver === 'function') {
        this.intersectionObserver = new this.view.IntersectionObserver(entries => {
          if (this.destroyed) return;
          for (const entry of entries) if (entry.target === canvas) this._inView = Boolean(entry.isIntersecting);
          this._sync(); this._notify();
        });
        this.intersectionObserver.observe(canvas);
      }
      this.resize();
    } catch (error) { this.destroy(); throw error; }
  }

  get paused() { return this._userPaused || this._reduced; }
  get destroyed() { return this._destroyed; }
  _canRun() { return !this.destroyed && this.options.autoStart && !this.paused && !this.document.hidden && this._inView && this.width > 0 && this.height > 0; }
  _sync() {
    const canRun = this._canRun();
    if (!canRun && this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
    if (!canRun) { this._last = null; this._accumulator = 0; }
    else if (!this._unsubscribe) {
      this._last = null; this._accumulator = 0;
      this._unsubscribe = getBrowserScheduler(this.view).subscribe(now => this._frame(now));
    }
  }
  _frame(now) {
    if (!this._canRun()) { this._sync(); return; }
    if (this._last === null) { this._last = now; return; }
    const elapsed = Math.max(0, (now - this._last) / 1000); this._last = now;
    const bounded = Math.min(.1, elapsed);
    this.droppedSeconds += elapsed - bounded;
    this._accumulator += bounded;
    const ticks = Math.min(6, Math.floor((this._accumulator + 1e-10) / STEP));
    if (!ticks) return;
    this._accumulator = Math.max(0, this._accumulator - ticks * STEP);
    stepPuppet(this.state, ticks);
    this.render();
  }
  _point(event) {
    if (this.destroyed || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return null;
    return { x: Math.max(-.5, Math.min(.5, (event.clientX - rect.left) / rect.width - .5)),
      y: Math.max(-.5, Math.min(.5, (event.clientY - rect.top) / rect.height - .5)) };
  }
  setTool(tool) {
    if (!['investigate', 'retreat'].includes(tool)) throw new TypeError('Choose investigate or retreat.');
    if (!this.destroyed) this.tool = tool;
  }
  cue(input) {
    if (this.destroyed || this.paused || this.document.hidden || !this._inView || !this.width || !this.height) return false;
    const accepted = cuePuppet(this.state, input);
    // Pointer input has one coalesced target slot. The next scheduled frame
    // paints it once; high-frequency events must not become redraw requests.
    if (accepted && input.type !== 'point' && input.type !== 'leave') this.render();
    return accepted;
  }
  showStill(type = 'investigate', seconds = 2.2, target = { x: .3, y: -.10 }) {
    if (this.destroyed) return false;
    if (!['idle', 'investigate', 'retreat'].includes(type)) throw new TypeError('Unknown still action.');
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 12) throw new RangeError('Still time must be 0–12 seconds.');
    if (!plain(target) || Reflect.ownKeys(target).length !== 2
      || !['x', 'y'].every(key => Object.hasOwn(target, key)
        && Object.hasOwn(Object.getOwnPropertyDescriptor(target, key), 'value'))) return false;
    const point = { x: Object.getOwnPropertyDescriptor(target, 'x').value,
      y: Object.getOwnPropertyDescriptor(target, 'y').value };
    if (![point.x, point.y].every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= .5)) return false;
    const state = createPuppetState(this.options.seed);
    if (type !== 'idle' && !cuePuppet(state, { type, ...point })) return false;
    let remaining = Math.round(seconds * 60);
    while (remaining) { const steps = Math.min(remaining, 6); stepPuppet(state, steps); remaining -= steps; }
    this._userPaused = true;
    this.state = state;
    this._manualAccumulator = 0;
    this._sync(); this.render();
    return true;
  }
  setPaused(value) {
    if (typeof value !== 'boolean') throw new TypeError('Pause state must be boolean.');
    if (this.destroyed) return;
    this._userPaused = value;
    this._sync(); this.render();
  }
  setOptions(patch) {
    if (this.destroyed) return;
    const next = normalize(patch, this.options);
    if (next.seed !== this.options.seed) { this.state = createPuppetState(next.seed); this._manualAccumulator = 0; }
    if (Object.hasOwn(patch, 'paused')) this._userPaused = next.paused;
    this.options = next;
    this._sync(); this.render();
  }
  restart() {
    if (this.destroyed) return;
    this.state = createPuppetState(this.options.seed);
    this._last = null; this._accumulator = this._manualAccumulator = 0;
    this.droppedSeconds = 0;
    this._sync(); this.render();
  }
  advance(seconds) {
    if (this.destroyed) return;
    if (this.options.autoStart) throw new Error('Manual advance requires autoStart:false.');
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > .1) throw new RangeError('advance accepts 0–.1 seconds.');
    this._manualAccumulator += seconds;
    const ticks = Math.min(6, Math.floor((this._manualAccumulator + 1e-10) / STEP));
    this._manualAccumulator = Math.max(0, this._manualAccumulator - ticks * STEP);
    if (ticks) stepPuppet(this.state, ticks);
    this.render();
  }
  resize() {
    if (this.destroyed) return;
    const rect = this.canvas.getBoundingClientRect();
    this.width = Number.isFinite(rect.width) ? Math.max(0, rect.width) : 0;
    this.height = Number.isFinite(rect.height) ? Math.max(0, rect.height) : 0;
    if (!this.width || !this.height) {
      this.canvas.width = this.canvas.height = 0; this.grid = null;
      this._sync(); this._notify(); return;
    }
    this.dpr = Math.min(2, Math.max(.5, Number(this.view.devicePixelRatio) || 1),
      Math.sqrt(4194304 / (this.width * this.height)), 4096 / this.width, 4096 / this.height);
    this.canvas.width = Math.max(1, Math.floor(this.width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.height * this.dpr));
    this._sync(); this.render();
  }
  render() {
    if (this.destroyed || !this.width || !this.height) return;
    this.grid = rasterizePuppet(samplePuppet(this.state), { width: this.width, height: this.height,
      size: this.options.size, habitat: this.options.habitat, seed: this.options.seed });
    drawPuppetGrid(this.context, this.grid, { dpr: this.dpr });
    this._notify();
  }
  getStats() {
    const sample = samplePuppet(this.state);
    return Object.freeze({ tick: sample.tick, time: sample.tick / 60, phase: sample.phase, action: sample.action,
      paused: this.paused, userPaused: this._userPaused, reducedMotion: this._reduced,
      running: Boolean(this._unsubscribe), destroyed: this.destroyed,
      inView: this._inView, hidden: Boolean(this.document.hidden), droppedSeconds: this.droppedSeconds,
      width: this.width, height: this.height, dpr: this.dpr, glyphs: this.grid?.glyphCount || 0,
      cells: this.grid ? this.grid.cols * this.grid.rows : 0 });
  }
  getState() { return getPuppetState(this.state); }
  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Subscriber must be a function.');
    if (this.destroyed) return () => {};
    this._subscribers.add(listener);
    return () => this._subscribers.delete(listener);
  }
  _notify() { if (!this.destroyed) for (const listener of this._subscribers) listener(this.getStats()); }
  destroy() {
    if (this.destroyed) return;
    this._destroyed = true;
    this._unsubscribe?.(); this._unsubscribe = null;
    this.resizeObserver?.disconnect(); this.intersectionObserver?.disconnect();
    for (const remove of this._listeners) remove();
    this._listeners.length = 0; this._subscribers.clear();
    this.grid = null;
    this.canvas.width = this.canvas.height = 0;
  }
}

export function createInkPuppet(canvas, options) { return new InkPuppetArtwork(canvas, options); }
