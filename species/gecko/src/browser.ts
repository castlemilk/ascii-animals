/** Local demonstration host, pending consolidation with the central library. */
import { createGecko, normalizeGuide } from './gecko.js';
import { drawGeckoGrid, renderGeckoGrid } from './preview.js';
import type { GeckoConfig, GeckoEvent, GeckoGrid, GeckoOptions, GeckoOptionsPatch, GeckoReset, GeckoState } from './types.js';

export interface GeckoViewOptions {
  /** Auto selects 112x50 below 560 CSS px, otherwise 176x78. */
  readonly grid: 'auto' | { readonly cols: number; readonly rows: number };
  readonly neutral: boolean;
  /** [1,2], no cross-device pixel identity is promised. */
  readonly maxDpr: number;
}
export interface GeckoMountOptions {
  readonly config?: GeckoConfig;
  readonly paused?: boolean;
  readonly view?: Partial<GeckoViewOptions>;
  /** Sparse state/policy changes, never a per-frame live-region feed. */
  readonly onStatus?: (status: GeckoControllerStatus) => void;
}
export interface GeckoControllerStatus {
  readonly tick: number;
  readonly phase: GeckoState['behavior']['kind'];
  readonly paused: boolean;
  readonly reducedMotion: boolean;
  readonly hidden: boolean;
  /** Frozen in the back-forward cache, independently of document visibility. */
  readonly pageSuspended: boolean;
  readonly offscreen: boolean;
  readonly zeroSize: boolean;
  readonly tooSmall: boolean;
  readonly disposed: boolean;
  readonly running: boolean;
  readonly poster: 'current' | 'curled';
  readonly pendingInputs: number;
  readonly queuedFrames: number;
  readonly renderedFrames: number;
  readonly droppedMilliseconds: number;
  readonly dimensions: Readonly<{ width: number; height: number; dpr: number }>;
}
export type GeckoActionResult =
  | { readonly outcome: 'queued' }
  | { readonly outcome: 'static' }
  | { readonly outcome: 'ignored'; readonly reason: 'resting' };
export interface GeckoController {
  getSnapshot(): GeckoState;
  /** This remains available after disposal. */
  getStatus(): GeckoControllerStatus;
  update(patch: GeckoOptionsPatch): Readonly<GeckoOptions>;
  setView(patch: Partial<GeckoViewOptions>): Readonly<GeckoViewOptions>;
  setPaused(value: boolean): void;
  guide(x: number, y: number): GeckoActionResult;
  clearGuide(): void;
  startle(): GeckoActionResult;
  reset(options?: GeckoReset): void;
  exportText(): string;
  redraw(): void;
  dispose(): void;
}

const DEFAULT_VIEW: Readonly<GeckoViewOptions> = Object.freeze({ grid: 'auto', neutral: false, maxDpr: 2 });
const TICK_MS = 1000 / 60;
const MAX_CATCH_UP = 5;
const MAX_WIDTH = 1000;
const MAX_HEIGHT = 780;
const MIN_WIDTH = 360;

function record(value: unknown, keys: readonly string[], label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError(`${label} must be a plain object`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.includes(key)) throw new TypeError(`Unknown ${label} key: ${String(key)}`);
  }
}
function boolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be boolean`);
}
function viewOptions(patch: Partial<GeckoViewOptions>, previous: Readonly<GeckoViewOptions>): Readonly<GeckoViewOptions> {
  record(patch, ['grid', 'neutral', 'maxDpr'], 'view');
  const next = { ...previous, ...patch };
  boolean(next.neutral, 'neutral');
  if (!Number.isFinite(next.maxDpr) || next.maxDpr < 1 || next.maxDpr > 2) throw new RangeError('maxDpr must be finite and within [1,2]');
  if (next.grid !== 'auto') {
    record(next.grid, ['cols', 'rows'], 'grid');
    if (!Number.isSafeInteger(next.grid.cols) || Number(next.grid.cols) < 112 || Number(next.grid.cols) > 192 ||
        !Number.isSafeInteger(next.grid.rows) || Number(next.grid.rows) < 50 || Number(next.grid.rows) > 86) {
      throw new RangeError('grid must be within 112..192 columns and 50..86 rows');
    }
    next.grid = Object.freeze({ cols: Number(next.grid.cols), rows: Number(next.grid.rows) });
  }
  return Object.freeze(next);
}

export function mountGecko(canvas: HTMLCanvasElement, options: GeckoMountOptions = {}): GeckoController {
  record(options, ['config', 'paused', 'view', 'onStatus'], 'mount options');
  if (options.paused !== undefined) boolean(options.paused, 'paused');
  if (options.onStatus !== undefined && typeof options.onStatus !== 'function') throw new TypeError('onStatus must be a function');
  let view = viewOptions(options.view === undefined ? {} : options.view, DEFAULT_VIEW);
  const document = canvas.ownerDocument;
  const host = document?.defaultView as (Window & typeof globalThis) | null;
  if (!host) throw new TypeError('A connected browser document is required');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is unavailable; the static text alternative remains available.');
  const model = createGecko(options.config);
  let snapshot = model.getSnapshot();
  let paused = options.paused ?? false;
  let disposed = false;
  const motion = host.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motion.matches;
  let hidden = document.hidden;
  let pageSuspended = false;
  let offscreen = false;
  let zeroSize = false;
  let tooSmall = false;
  let poster: 'current' | 'curled' = 'current';
  let frame: number | null = null;
  let lastTime: number | null = null;
  let accumulator = 0;
  let droppedMilliseconds = 0;
  let renderedFrames = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let cssWidth = 0;
  let pendingGuide: { type: 'guide'; x: number; y: number } | { type: 'leave' } | null = null;
  let pendingStartle = false;
  let clearOnResume = false;
  let lastGrid: GeckoGrid | null = null;
  const cleanup: Array<() => void> = [];
  const running = () => !disposed && !paused && !reducedMotion && !hidden && !pageSuspended && !offscreen && !zeroSize && !tooSmall;
  const ensure = () => { if (disposed) throw new Error('Gecko controller is disposed'); };

  function getStatus(): GeckoControllerStatus {
    return {
      tick: snapshot.tick, phase: snapshot.behavior.kind, paused, reducedMotion, hidden, pageSuspended, offscreen, zeroSize, tooSmall,
      disposed, running: running(), poster, pendingInputs: Number(pendingGuide !== null) + Number(pendingStartle),
      queuedFrames: Number(frame !== null), renderedFrames, droppedMilliseconds,
      dimensions: { width, height, dpr }
    };
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    if (frame !== null) host!.cancelAnimationFrame(frame);
    frame = null;
    pendingGuide = null;
    pendingStartle = false;
    clearOnResume = false;
    lastTime = null;
    accumulator = 0;
    for (const release of cleanup.splice(0).reverse()) release();
    model.dispose();
    lastGrid = null;
    canvas.width = 0;
    canvas.height = 0;
  }
  function notify(): void {
    try { options.onStatus?.(getStatus()); }
    catch (error) { dispose(); throw error; }
  }
  function suspend(): void {
    if (frame !== null) host!.cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
    accumulator = 0;
    pendingGuide = null;
    pendingStartle = false;
    clearOnResume = snapshot.target !== null;
  }
  function schedule(): void {
    if (running() && frame === null) frame = host!.requestAnimationFrame(tick);
  }
  function reconcile(): void {
    if (!running()) suspend();
    else schedule();
  }
  function posterState(): GeckoState {
    return poster === 'curled'
      ? { ...snapshot, tailCurl: snapshot.options.curlStrength,
        behavior: { kind: 'startle', since: snapshot.tick, heading: snapshot.heading } }
      : snapshot;
  }
  function grid(): GeckoGrid {
    const dimensions = view.grid === 'auto'
      ? cssWidth < 560 ? { cols: 112, rows: 50 } : { cols: 176, rows: 78 }
      : view.grid;
    return renderGeckoGrid(posterState(), { ...dimensions, neutral: view.neutral });
  }
  function draw(): void {
    if (disposed || zeroSize || tooSmall || hidden || pageSuspended || offscreen || !width || !height) return;
    lastGrid = grid();
    context!.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGeckoGrid(context!, lastGrid, width, height);
    renderedFrames++;
  }
  function resize(): void {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    zeroSize = !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0;
    tooSmall = !zeroSize && rect.width < MIN_WIDTH;
    cssWidth = zeroSize ? 0 : rect.width;
    if (zeroSize || tooSmall) {
      width = 0; height = 0; canvas.width = 0; canvas.height = 0; lastGrid = null;
    } else {
      const scale = Math.min(1, MAX_WIDTH / rect.width, MAX_HEIGHT / rect.height);
      width = Math.max(1, Math.floor(rect.width * scale));
      height = Math.max(1, Math.floor(rect.height * scale));
      const deviceDpr = host!.devicePixelRatio;
      dpr = Math.max(1, Math.min(view.maxDpr, Number.isFinite(deviceDpr) ? deviceDpr : 1));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      draw();
    }
    reconcile();
    notify();
  }
  function advanceOne(): void {
    const events: GeckoEvent[] = [];
    let sequence = snapshot.lastSequence;
    const nextTick = snapshot.tick + 1;
    if (clearOnResume) events.push({ type: 'leave', tick: nextTick, seq: ++sequence });
    if (pendingGuide) events.push({ ...pendingGuide, tick: nextTick, seq: ++sequence });
    if (pendingStartle) events.push({ type: 'startle', tick: nextTick, seq: ++sequence });
    pendingGuide = null; pendingStartle = false; clearOnResume = false;
    const phase = snapshot.behavior.kind;
    snapshot = model.step(events).state;
    if (snapshot.behavior.kind !== phase) notify();
  }
  function tick(timestamp: number): void {
    frame = null;
    if (!running()) return;
    try {
      if (lastTime === null) lastTime = timestamp;
      const elapsed = Math.max(0, timestamp - lastTime);
      lastTime = timestamp;
      const accepted = Math.min(elapsed, TICK_MS * MAX_CATCH_UP);
      droppedMilliseconds += elapsed - accepted;
      accumulator += accepted;
      let steps = 0;
      // A status callback may synchronously pause, hide, freeze, or dispose the host.
      while (running() && accumulator + 1e-8 >= TICK_MS && steps < MAX_CATCH_UP) {
        advanceOne(); accumulator = Math.max(0, accumulator - TICK_MS); steps++;
      }
      if (accumulator >= TICK_MS) {
        const dropped = Math.floor(accumulator / TICK_MS) * TICK_MS;
        accumulator -= dropped; droppedMilliseconds += dropped;
      }
      const desiredDpr = Math.max(1, Math.min(view.maxDpr, host!.devicePixelRatio || 1));
      if (desiredDpr !== dpr) resize();
      else if (steps) draw();
      schedule();
    } catch (error) { dispose(); throw error; }
  }
  function listen(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions): void {
    target.addEventListener(type, handler, options);
    cleanup.push(() => target.removeEventListener(type, handler, options));
  }
  function guide(x: number, y: number): GeckoActionResult {
    ensure();
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Guide coordinates must be finite numbers');
    if (!running()) return { outcome: 'ignored', reason: 'resting' };
    pendingGuide = { type: 'guide', x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    return { outcome: 'queued' };
  }
  function clearGuide(): void {
    ensure();
    pendingGuide = running() ? { type: 'leave' } : null;
    if (!running()) clearOnResume = snapshot.target !== null;
  }
  function startle(): GeckoActionResult {
    ensure();
    if (!running()) {
      poster = 'curled'; draw(); notify(); return { outcome: 'static' };
    }
    pendingStartle = true;
    return { outcome: 'queued' };
  }
  function setPaused(value: boolean): void {
    ensure(); boolean(value, 'paused');
    paused = value;
    if (!paused && !reducedMotion) poster = 'current';
    reconcile(); draw(); notify();
  }
  function onPointer(event: PointerEvent): void {
    if (disposed || !running()) return;
    if (event.type === 'pointermove' && event.pointerType === 'touch' && event.buttons === 0) return;
    const point = normalizeGuide(event.clientX, event.clientY, canvas.getBoundingClientRect());
    if (point) guide(point.x, point.y);
  }
  function onDeparture(): void { if (!disposed) clearGuide(); }
  function onKey(event: KeyboardEvent): void {
    if (disposed || event.target !== canvas || event.altKey || event.ctrlKey || event.metaKey) return;
    const points: Record<string, readonly [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
    };
    const point = points[event.key];
    if (point) { event.preventDefault(); guide(...point); }
    else if (event.code === 'Space' || event.key === ' ') { event.preventDefault(); setPaused(!paused); }
  }

  const controller: GeckoController = {
    getSnapshot() { ensure(); return model.getSnapshot(); },
    getStatus,
    update(patch) {
      ensure(); const resolved = model.update(patch); snapshot = model.getSnapshot();
      draw(); notify(); return resolved;
    },
    setView(patch) { ensure(); view = viewOptions(patch, view); resize(); return view; },
    setPaused, guide, clearGuide, startle,
    reset(settings = {}) {
      ensure(); snapshot = model.reset(settings); poster = 'current';
      pendingGuide = null; pendingStartle = false; clearOnResume = false;
      accumulator = 0; lastTime = null; draw(); reconcile(); notify();
    },
    exportText() { ensure(); return grid().text; },
    redraw() { ensure(); resize(); },
    dispose
  };
  try {
    listen(canvas, 'pointermove', onPointer as EventListener, { passive: true });
    listen(canvas, 'pointerdown', onPointer as EventListener, { passive: true });
    for (const type of ['pointerleave', 'pointercancel', 'lostpointercapture']) listen(canvas, type, onDeparture, { passive: true });
    listen(canvas, 'keydown', onKey as EventListener);
    listen(document, 'visibilitychange', () => {
      if (disposed) return;
      hidden = document.hidden; reconcile(); if (!hidden) draw(); notify();
    });
    listen(motion, 'change', () => {
      if (disposed) return;
      reducedMotion = motion.matches;
      if (!reducedMotion) poster = 'current';
      reconcile(); draw(); notify();
    });
    listen(host, 'resize', resize);
    listen(host, 'pagehide', (event: Event) => {
      if (disposed) return;
      if (!(event as PageTransitionEvent).persisted) { dispose(); return; }
      // bfcache retains this document and its listeners. Freeze it without
      // changing the user's pause setting; visibility events need not arrive first.
      pageSuspended = true; reconcile(); notify();
    });
    listen(host, 'pageshow', () => {
      if (disposed) return;
      pageSuspended = false;
      hidden = document.hidden;
      lastTime = null; accumulator = 0;
      resize();
    });
    if (host.ResizeObserver) {
      const observer = new host.ResizeObserver(resize);
      cleanup.push(() => observer.disconnect());
      observer.observe(canvas);
    }
    if (host.IntersectionObserver) {
      const observer = new host.IntersectionObserver(entries => {
        if (disposed) return;
        const entry = entries.find(item => item.target === canvas);
        if (!entry) return;
        offscreen = !entry.isIntersecting; reconcile(); if (!offscreen) draw(); notify();
      });
      cleanup.push(() => observer.disconnect());
      observer.observe(canvas);
    }
    resize();
    return controller;
  } catch (error) { dispose(); throw error; }
}
