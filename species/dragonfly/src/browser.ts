/** Browser ownership for the local Dragonfly specimen; no shared scheduler or package API is assumed. */
import { createDragonfly } from './model.js';
import { gridToText, paintDragonfly, rasterizeDragonfly } from './preview.js';
import type { DragonflyBehavior, DragonflyState, DragonflyConfigPatch, DragonflyGrid, DragonflyInput, DragonflyOptions, DragonflyView, MotionMode, Vec2 } from './types.js';

export interface DragonflyBrowserEnvironment {
  readonly window: Window;
  readonly document: Document;
  readonly ResizeObserver: typeof ResizeObserver;
  readonly IntersectionObserver: typeof IntersectionObserver | null;
}
export interface DragonflyBrowserStatus {
  readonly tick: number; readonly behavior: DragonflyBehavior['kind']; readonly paused: boolean;
  readonly motion: MotionMode; readonly requestedMotion: MotionMode;
  readonly reducedMotion: boolean; readonly hidden: boolean; readonly offscreen: boolean;
  readonly zeroSized: boolean; readonly disposed: boolean; readonly queuedFrames: number;
  readonly pendingInputs: number; readonly droppedMilliseconds: number; readonly renderedFrames: number;
  readonly cols: number; readonly rows: number; readonly width: number; readonly height: number;
  readonly dpr: number; readonly samples: number; readonly occupied: number; readonly clippedSamples: number;
}
export interface DragonflyFrameSource {
  subscribe(callback: (timestampMs: number) => void): () => void;
}
export interface DragonflyMountOptions {
  /** Borrowed scheduler: release only this subscription. */
  readonly frameSource?: DragonflyFrameSource;
  readonly model?: Partial<DragonflyOptions>;
  readonly paused?: boolean; readonly view?: DragonflyView; readonly neutral?: boolean;
  readonly onStatus?: (status: DragonflyBrowserStatus) => void;
  readonly environment?: DragonflyBrowserEnvironment;
}
export interface DragonflyBrowserController {
  setPaused(value: boolean): void;
  configure(patch: DragonflyConfigPatch): void;
  setView(view: DragonflyView): void;
  setNeutral(value: boolean): void;
  setTarget(x: number, y: number): void;
  clearTarget(): void;
  dart(): void;
  reset(seed?: number): void;
  render(): void;
  exportText(): string;
  /** Immutable species snapshot; cannot bypass host scheduling ownership. */
  getState(): DragonflyState;
  /** Effective species options, including the live reduced-motion policy. */
  getOptions(): Readonly<DragonflyOptions>;
  getStatus(): DragonflyBrowserStatus;
  dispose(): void;
}

export function normalizeDragonflyPointer(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): Vec2 | null {
  if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite))
    throw new TypeError('Pointer coordinates and CSS rectangle must be finite');
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { x: Math.max(-1, Math.min(1, 2 * (clientX - rect.left) / rect.width - 1)), y: Math.max(-1, Math.min(1, 2 * (clientY - rect.top) / rect.height - 1)) };
}

/** Construct only in a browser. Importing this module does not read DOM globals. */
export function mountDragonfly(canvas: HTMLCanvasElement, options: DragonflyMountOptions = {}): DragonflyBrowserController {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Dragonfly mount options must be an object');
  for (const key of Object.keys(options)) if (!['model', 'paused', 'view', 'neutral', 'onStatus', 'environment', 'frameSource'].includes(key)) throw new TypeError(`Unknown Dragonfly mount option: ${key}`);
  if (options.frameSource !== undefined && typeof options.frameSource?.subscribe !== 'function') throw new TypeError('frameSource must provide subscribe');
  if (options.onStatus !== undefined && typeof options.onStatus !== 'function') throw new TypeError('onStatus must be a function');
  const owner = canvas?.ownerDocument?.defaultView;
  if (!options.environment && !owner) throw new TypeError('Dragonfly requires a browser canvas');
  const environment = options.environment ?? {
    window: owner!, document: canvas.ownerDocument,
    ResizeObserver: (owner as Window & typeof globalThis).ResizeObserver,
    IntersectionObserver: (owner as Window & typeof globalThis).IntersectionObserver ?? null,
  };
  const win = environment.window, doc = environment.document;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is unavailable. The Dragonfly description remains available.');
  if (options.paused !== undefined && typeof options.paused !== 'boolean') throw new TypeError('paused must be boolean');
  if (options.neutral !== undefined && typeof options.neutral !== 'boolean') throw new TypeError('neutral must be boolean');
  let view = options.view ?? 'oblique';
  if (view !== 'oblique' && view !== 'dorsal') throw new TypeError('Unknown Dragonfly view');
  let neutral = options.neutral ?? false;
  const model = createDragonfly(options.model);
  const media = win.matchMedia('(prefers-reduced-motion: reduce)');
  let requestedMotion = model.getOptions().motion;
  let userPaused = options.paused ?? false;
  let disposed = false, offscreen = false, zeroSized = true;
  let releaseFrame: (() => void) | null = null, subscribed = false;
  let frameId: number | null = null, previousTime: number | null = null, remainder = 0;
  let width = 0, height = 0, dpr = 1, cols = 72, rows = 44;
  let pendingTarget: Vec2 | null = null, pendingDart = false;
  let guide: Vec2 = { x: 0, y: 0 };
  let droppedMilliseconds = 0, renderedFrames = 0, sampleCount = 0;
  let lastGrid: DragonflyGrid | null = null;
  let lastTick = 0;
  let lastBehavior: DragonflyBehavior['kind'] = 'idle';
  let resizeObserver: ResizeObserver | null = null, intersectionObserver: IntersectionObserver | null = null;
  const removeListeners: Array<() => void> = [];
  const tickMilliseconds = 1000 / 60;

  function assertAlive(): void { if (disposed) throw new Error('Dragonfly browser controller is disposed'); }
  function isActive(): boolean {
    return !disposed && !userPaused && !media.matches && model.getOptions().motion !== 'static' && !doc.hidden && !offscreen && !zeroSized;
  }
  function getStatus(): DragonflyBrowserStatus {
    const state = disposed ? null : model.getState();
    return {
      tick: state?.tick ?? lastTick, behavior: state?.behavior.kind ?? lastBehavior, paused: userPaused,
      motion: disposed ? requestedMotion : model.getOptions().motion, requestedMotion,
      reducedMotion: media.matches, hidden: Boolean(doc.hidden), offscreen, zeroSized, disposed,
      queuedFrames: frameId === null && !subscribed ? 0 : 1, pendingInputs: Number(pendingTarget !== null) + Number(pendingDart),
      droppedMilliseconds, renderedFrames, cols, rows, width, height, dpr, samples: sampleCount,
      occupied: lastGrid?.occupied ?? 0, clippedSamples: lastGrid?.clippedSamples ?? 0,
    };
  }
  function stopFrame(): void {
    const unsubscribe = releaseFrame; releaseFrame = null; subscribed = false; unsubscribe?.();
    if (frameId !== null) { win.cancelAnimationFrame(frameId); frameId = null; }
    previousTime = null; remainder = 0;
  }
  function dropInput(): void {
    pendingTarget = null; pendingDart = false;
    if (!disposed) model.clearTarget();
  }
  function release(): void {
    if (disposed) return;
    lastTick = model.getState().tick; lastBehavior = model.getState().behavior.kind;
    stopFrame(); dropInput();
    disposed = true;
    resizeObserver?.disconnect(); intersectionObserver?.disconnect();
    for (const remove of removeListeners.splice(0).reverse()) remove();
    model.dispose(); lastGrid = null;
    canvas.width = 0; canvas.height = 0;
  }
  function notify(): void {
    if (!options.onStatus) return;
    try { options.onStatus(getStatus()); } catch (error) { release(); throw error; }
  }
  function listen(target: EventTarget, type: string, callback: EventListener, listenerOptions?: AddEventListenerOptions): void {
    target.addEventListener(type, callback, listenerOptions);
    removeListeners.push(() => target.removeEventListener(type, callback, listenerOptions));
  }
  function draw(): void {
    if (disposed || zeroSized || doc.hidden || offscreen) return;
    const geometry = model.sample();
    sampleCount = geometry.samples.length;
    lastGrid = rasterizeDragonfly(geometry, { cols, rows, view, neutral });
    paintDragonfly(context!, lastGrid, { width, height, dpr, neutral });
    renderedFrames++;
  }
  function enqueueFrame(): void {
    if (!isActive() || frameId !== null || subscribed) return;
    if (options.frameSource) {
      subscribed = true;
      let unsubscribe: () => void;
      try { unsubscribe = options.frameSource.subscribe(onFrame); } catch (error) { subscribed = false; throw error; }
      if (typeof unsubscribe !== 'function') throw new TypeError('frameSource.subscribe must return a release function');
      if (!isActive() || !subscribed) { unsubscribe(); subscribed = false; } else releaseFrame = unsubscribe;
    } else frameId = win.requestAnimationFrame(onFrame);
  }
  function reconcile(): void {
    if (disposed) return;
    stopFrame(); dropInput();
    draw(); enqueueFrame(); notify();
  }
  function collectEvents(tick: number): DragonflyInput[] {
    let sequence = model.getState().lastSeq + 1;
    const events: DragonflyInput[] = [];
    if (pendingTarget !== null) events.push({ type: 'pointer', tick, seq: sequence++, x: pendingTarget.x, y: pendingTarget.y });
    if (pendingDart) events.push({ type: 'dart', tick, seq: sequence });
    pendingTarget = null; pendingDart = false;
    return events;
  }
  function onFrame(time: number): void {
    frameId = null;
    if (!isActive()) { previousTime = null; remainder = 0; return; }
    try {
      if (!Number.isFinite(time)) throw new TypeError('Animation timestamp must be finite');
      const oldBehavior = model.getState().behavior.kind;
      if (previousTime !== null) {
        const elapsed = Math.max(0, time - previousTime) + remainder;
        const due = Math.floor((elapsed + 1e-8) / tickMilliseconds);
        const steps = Math.min(5, due);
        remainder = Math.max(0, elapsed - due * tickMilliseconds);
        droppedMilliseconds += (due - steps) * tickMilliseconds;
        for (let step = 0; step < steps; step++) {
          const tick = model.getState().tick + 1;
          model.step(tick, collectEvents(tick));
        }
      }
      previousTime = time;
      draw();
      enqueueFrame();
      if (oldBehavior !== model.getState().behavior.kind) notify();
    } catch (error) { release(); throw error; }
  }
  function resize(): void {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    zeroSized = !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0;
    if (zeroSized) {
      width = 0; height = 0; stopFrame(); dropInput(); lastGrid = null;
      canvas.width = 0; canvas.height = 0; notify(); return;
    }
    width = Math.min(rect.width, 1200); height = Math.min(rect.height, 700);
    dpr = Number.isFinite(win.devicePixelRatio) ? Math.max(1, Math.min(2, win.devicePixelRatio)) : 1;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    cols = Math.max(72, Math.min(160, Math.floor(width / 7.5)));
    rows = Math.max(44, Math.min(88, Math.floor(height / 9.4)));
    reconcile();
  }
  function setTarget(x: number, y: number): void {
    assertAlive();
    if (![x, y].every(Number.isFinite) || Math.abs(x) > 1 || Math.abs(y) > 1)
      throw new RangeError('Guide coordinates must be finite and normalized to -1..1');
    guide = { x, y };
    if (doc.hidden || offscreen || zeroSized) return;
    if (!isActive()) { model.setStaticPose(x < 0 ? 0 : 1); draw(); notify(); return; }
    pendingTarget = guide;
  }
  function clearTarget(): void {
    assertAlive(); pendingTarget = null; guide = { x: 0, y: 0 }; model.clearTarget();
  }
  function pointer(event: Event): void {
    if (!isActive()) return;
    const p = event as PointerEvent;
    if (event.type === 'pointerdown' && p.button !== 0 && p.pointerType !== 'touch') return;
    const target = normalizeDragonflyPointer(p.clientX, p.clientY, canvas.getBoundingClientRect());
    if (target) { guide = target; pendingTarget = target; }
  }
  function setPaused(value: boolean): void {
    assertAlive(); if (typeof value !== 'boolean') throw new TypeError('paused must be boolean');
    userPaused = value; model.setPaused(value); reconcile();
  }
  function preferenceChanged(): void {
    if (disposed) return;
    model.configure({ motion: media.matches ? 'static' : requestedMotion });
    reconcile();
  }
  function keydown(event: Event): void {
    if (disposed) return;
    const key = event as KeyboardEvent;
    if (key.altKey || key.ctrlKey || key.metaKey) return;
    if (key.code === 'Space' || key.key === ' ') { key.preventDefault(); setPaused(!userPaused); return; }
    let x = guide.x, y = guide.y;
    if (key.key === 'ArrowLeft') x -= 0.2;
    else if (key.key === 'ArrowRight') x += 0.2;
    else if (key.key === 'ArrowUp') y -= 0.2;
    else if (key.key === 'ArrowDown') y += 0.2;
    else return;
    key.preventDefault(); setTarget(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
  }

  const controller: DragonflyBrowserController = {
    setPaused,
    configure(patch) {
      assertAlive();
      // Validate through the species before changing the remembered user policy.
      const next = model.configure(patch);
      if (patch.motion !== undefined) requestedMotion = next.motion;
      if (media.matches) model.configure({ motion: 'static' });
      reconcile();
    },
    setView(value) {
      assertAlive(); if (value !== 'dorsal' && value !== 'oblique') throw new TypeError('Unknown Dragonfly view');
      view = value; draw(); notify();
    },
    setNeutral(value) {
      assertAlive(); if (typeof value !== 'boolean') throw new TypeError('neutral must be boolean');
      neutral = value; draw(); notify();
    },
    setTarget, clearTarget,
    dart() {
      assertAlive();
      if (doc.hidden || offscreen || zeroSized) return;
      if (!isActive()) { model.setStaticPose(model.getState().staticPose === 0 ? 1 : 0); draw(); notify(); return; }
      pendingDart = true;
    },
    reset(seed) {
      assertAlive(); model.reset(seed); guide = { x: 0, y: 0 }; reconcile();
    },
    render() { assertAlive(); draw(); },
    exportText() {
      assertAlive();
      return gridToText(rasterizeDragonfly(model.sample(), { cols, rows, view, neutral }));
    },
    getState() { return model.getState(); },
    getOptions() { return model.getOptions(); },
    getStatus,
    dispose() { if (disposed) return; release(); notify(); },
  };
  try {
    model.setPaused(userPaused);
    if (media.matches) model.configure({ motion: 'static' });
    listen(canvas, 'pointermove', pointer, { passive: true });
    listen(canvas, 'pointerdown', pointer, { passive: true });
    for (const type of ['pointerleave', 'pointercancel', 'lostpointercapture']) listen(canvas, type, () => { if (!disposed) clearTarget(); }, { passive: true });
    listen(canvas, 'keydown', keydown);
    listen(doc, 'visibilitychange', reconcile);
    listen(media, 'change', preferenceChanged);
    listen(win, 'resize', resize, { passive: true });
    if (doc.fonts) listen(doc.fonts, 'loadingdone', resize);
    resizeObserver = new environment.ResizeObserver(resize); resizeObserver.observe(canvas);
    if (environment.IntersectionObserver) {
      intersectionObserver = new environment.IntersectionObserver(entries => {
        if (disposed) return;
        const entry = entries.find(item => item.target === canvas);
        if (!entry) return;
        offscreen = !entry.isIntersecting; reconcile();
      });
      intersectionObserver.observe(canvas);
    }
    resize();
  } catch (error) { release(); throw error; }
  return Object.freeze(controller);
}
