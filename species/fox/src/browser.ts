/** Fox-only preview lifecycle. This is not the repository's canonical renderer. */
import { createFox, normalizeFoxPointer, staticFoxPose } from './model.js';
import { buildFoxGrid, paintFoxGrid } from './preview.js';
import type { FoxCreateOptions, FoxFrameSource, FoxGridOptions, FoxInput,
  FoxOptions, FoxOptionsInput, FoxPoint, FoxState, FoxStaticPose } from './types.js';

export interface FoxBrowserOptions {
  readonly fox?: FoxCreateOptions;
  readonly grid?: FoxGridOptions;
  /** Borrowed: only this mount's subscription is released. */
  readonly frameSource?: FoxFrameSource;
  readonly onStatus?: (status: FoxBrowserStatus) => void;
  /** Complete consumed input batches, including policy-generated leave events. */
  readonly onInputs?: (batch: readonly FoxInput[]) => void;
}
export interface FoxBrowserStatus {
  readonly tick: number;
  readonly phase: FoxState['behavior']['kind'];
  readonly paused: boolean;
  readonly reducedMotion: boolean;
  readonly hidden: boolean;
  readonly offscreen: boolean;
  readonly zeroSized: boolean;
  readonly disposed: boolean;
  readonly running: boolean;
  readonly ownAnimationFrames: 0 | 1;
  readonly subscribed: boolean;
  readonly pendingInputs: number;
  readonly pendingPolicyReset: boolean;
  readonly droppedMilliseconds: number;
  readonly renderedFrames: number;
  readonly staticPose: FoxStaticPose | null;
  readonly cols: number;
  readonly rows: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
}
export interface FoxBrowserController {
  configure(options: FoxOptionsInput): FoxOptions;
  reset(seed?: number): FoxState;
  setPaused(value: boolean): void;
  guide(x: number, y: number): void;
  leave(): void;
  pounce(): void;
  /** Deliberately pauses playback and displays a static specimen. */
  showStaticPose(pose: FoxStaticPose): void;
  getState(): FoxState;
  /** Diagnostics remain readable after disposal; other operations reject. */
  getStatus(): FoxBrowserStatus;
  exportText(): string;
  dispose(): void;
}

const STEP_MS = 1000 / 60;
const MAX_STEPS = 5;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
function finite(value: number, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}
function validateGrid(value: FoxGridOptions): FoxGridOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('grid must be an object');
  for (const key of Object.keys(value)) if (!['cols', 'rows', 'monochrome'].includes(key)) throw new TypeError(`Unknown grid option: ${key}`);
  for (const [key, min, max] of [['cols', 80, 160], ['rows', 32, 64]] as const) {
    const dimension = value[key];
    if (dimension !== undefined && (!Number.isInteger(dimension) || dimension < min || dimension > max)) throw new RangeError(`${key} must be an integer ${min}..${max}`);
  }
  if (value.monochrome !== undefined && typeof value.monochrome !== 'boolean') throw new TypeError('monochrome must be boolean');
  return Object.freeze({ ...value });
}

/** Construction alone touches the DOM; importing this module is SSR safe.
 * Requires Canvas 2D, ResizeObserver and IntersectionObserver. On unsupported
 * hosts the demo retains a text specimen and meaningful description.
 */
export function mountFox(canvas: HTMLCanvasElement, options: FoxBrowserOptions = {}): FoxBrowserController {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Browser options must be an object');
  for (const key of Object.keys(options)) if (!['fox', 'grid', 'frameSource', 'onStatus', 'onInputs'].includes(key)) throw new TypeError(`Unknown browser option: ${key}`);
  if (options.onStatus !== undefined && typeof options.onStatus !== 'function') throw new TypeError('onStatus must be a function');
  if (options.onInputs !== undefined && typeof options.onInputs !== 'function') throw new TypeError('onInputs must be a function');
  if (options.frameSource !== undefined && typeof options.frameSource?.subscribe !== 'function') throw new TypeError('frameSource must provide subscribe');
  const gridOptions = validateGrid(options.grid ?? {});
  const document = canvas?.ownerDocument;
  const view = document?.defaultView as (Window & typeof globalThis) | null;
  if (!document || !view) throw new TypeError('mountFox requires a browser canvas with an owner document');
  const model = createFox(options.fox);
  const cleanups: Array<() => void> = [];
  let state = model.getState();
  let userPaused = model.isPaused();
  let reducedMotion = false;
  let hidden = Boolean(document.hidden);
  let offscreen = true;
  let zeroSized = true;
  let disposed = false;
  let raf: number | null = null;
  let unsubscribe: (() => void) | null = null;
  let subscribed = false;
  let generation = 0;
  let previousTimestamp: number | null = null;
  let accumulator = 0;
  let droppedMilliseconds = 0;
  let renderedFrames = 0;
  let pendingGuide: FoxPoint | null = null;
  let pendingPounce = false;
  let policyLeave = false;
  let poster: FoxStaticPose | null = reducedMotion ? 'idle' : null;
  let width = 1, height = 1, dpr = 1;
  let cols = gridOptions.cols ?? 112, rows = gridOptions.rows ?? 44;
  let context: CanvasRenderingContext2D;

  const assertAlive = () => { if (disposed) throw new Error('Fox browser controller is disposed'); };
  const blocked = () => disposed || userPaused || reducedMotion || hidden || offscreen || zeroSized;
  const canDraw = () => !disposed && !hidden && !offscreen && !zeroSized;
  const status = (): FoxBrowserStatus => Object.freeze({ tick: state.tick, phase: state.behavior.kind,
    paused: userPaused, reducedMotion, hidden, offscreen, zeroSized, disposed, running: !blocked(),
    ownAnimationFrames: raf === null ? 0 : 1, subscribed,
    pendingInputs: (pendingGuide ? 1 : 0) + (pendingPounce ? 1 : 0), pendingPolicyReset: policyLeave,
    droppedMilliseconds, renderedFrames, staticPose: poster, cols, rows,
    backingWidth: canvas.width, backingHeight: canvas.height });
  function stopFrames(): void {
    generation++;
    if (raf !== null) { view!.cancelAnimationFrame(raf); raf = null; }
    const release = unsubscribe; unsubscribe = null; subscribed = false;
    if (release) release();
    previousTimestamp = null; accumulator = 0;
  }
  function clearUserInput(resetInterest: boolean): void {
    if (resetInterest && (state.target.active || pendingGuide !== null)) policyLeave = true;
    pendingGuide = null; pendingPounce = false;
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    // Complete every cleanup even if a host-provided release unexpectedly throws.
    try { stopFrames(); } catch { /* The borrowed source owns its own failures. */ }
    for (const release of cleanups.reverse()) { try { release(); } catch { /* Continue cleanup. */ } }
    cleanups.length = 0;
    pendingGuide = null; pendingPounce = false; policyLeave = false;
    model.dispose();
    canvas.width = 1; canvas.height = 1;
  }
  function guarded<T>(operation: () => T): T {
    try { return operation(); } catch (error) { dispose(); throw error; }
  }
  function notify(): void { options.onStatus?.(status()); }
  function render(): void {
    if (!canDraw()) return;
    const pose = poster === null ? model.getPose() : staticFoxPose({ ...model.getOptions(), seed: state.seed }, poster);
    const grid = buildFoxGrid(pose, { cols, rows, monochrome: gridOptions.monochrome ?? false });
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintFoxGrid(context, grid, width, height, { monochrome: gridOptions.monochrome ?? false });
    renderedFrames++;
  }
  function step(): void {
    const tick = state.tick + 1;
    let sequence = state.lastSequence + 1;
    const batch: FoxInput[] = [];
    if (pendingGuide) batch.push({ type: 'guide', tick, seq: sequence++, ...pendingGuide });
    else if (policyLeave) batch.push({ type: 'leave', tick, seq: sequence++ });
    if (pendingPounce) batch.push({ type: 'pounce', tick, seq: sequence++ });
    pendingGuide = null; pendingPounce = false; policyLeave = false;
    state = model.step(tick, batch).state;
    if (batch.length) options.onInputs?.(Object.freeze(batch.map(event => Object.freeze(event))));
  }
  function frame(timestamp: number, ticket: number): void {
    if (disposed || ticket !== generation || blocked()) return;
    guarded(() => {
      finite(timestamp, 'Frame timestamp');
      if (previousTimestamp === null) { previousTimestamp = timestamp; return; }
      const elapsed = Math.max(0, timestamp - previousTimestamp);
      previousTimestamp = timestamp;
      const accumulated = accumulator + elapsed;
      const cap = MAX_STEPS * STEP_MS;
      accumulator = Math.min(accumulated, cap);
      droppedMilliseconds += Math.max(0, accumulated - cap);
      const count = Math.min(MAX_STEPS, Math.floor((accumulator + 1e-7) / STEP_MS));
      const before = state.behavior.kind;
      for (let n = 0; n < count && !blocked(); n++) { step(); accumulator = Math.max(0, accumulator - STEP_MS); }
      if (count && !disposed) render();
      if (!disposed && before !== state.behavior.kind) notify();
    });
  }
  function startFrames(): void {
    if (blocked() || raf !== null || subscribed) return;
    const ticket = ++generation;
    previousTimestamp = null; accumulator = 0;
    if (options.frameSource) {
      subscribed = true;
      const release = options.frameSource.subscribe(timestamp => frame(timestamp, ticket));
      if (typeof release !== 'function') throw new TypeError('frameSource.subscribe must return an unsubscribe function');
      if (disposed || blocked() || ticket !== generation) { release(); subscribed = false; }
      else unsubscribe = release;
    } else {
      const callback = (timestamp: number): void => {
        if (ticket !== generation || disposed) return;
        raf = null;
        frame(timestamp, ticket);
        if (ticket === generation && !blocked()) raf = view!.requestAnimationFrame(callback);
      };
      raf = view!.requestAnimationFrame(callback);
    }
  }
  function reconcile(draw = true): void {
    if (disposed) return;
    if (blocked()) { clearUserInput(true); stopFrames(); }
    else { poster = null; startFrames(); }
    if (draw) render();
    notify();
  }
  function resize(): void {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    finite(rect.width, 'Canvas width'); finite(rect.height, 'Canvas height');
    zeroSized = rect.width <= 0 || rect.height <= 0;
    if (zeroSized) { width = 1; height = 1; canvas.width = 1; canvas.height = 1; }
    else {
      const fit = Math.min(1, 1280 / rect.width, 768 / rect.height);
      width = rect.width * fit; height = rect.height * fit;
      dpr = clamp(Number.isFinite(view!.devicePixelRatio) ? view!.devicePixelRatio : 1, 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr));
      cols = gridOptions.cols ?? (rect.width < 640 ? 80 : 112);
      rows = gridOptions.rows ?? (rect.width < 640 ? 32 : 44);
    }
    reconcile();
  }
  function guide(x: number, y: number, deliberate: boolean): void {
    assertAlive();
    const point = { x: clamp(finite(x, 'Guide x'), -1, 1), y: clamp(finite(y, 'Guide y'), -1, 1) };
    if (hidden || offscreen || zeroSized) return;
    if (userPaused || reducedMotion) {
      if (deliberate) guarded(() => { poster = 'sniff'; render(); notify(); });
      return;
    }
    pendingGuide = point; policyLeave = false;
  }
  function pointer(event: PointerEvent, deliberate: boolean): void {
    if (disposed) return;
    guarded(() => {
      const point = normalizeFoxPointer(event.clientX, event.clientY, canvas.getBoundingClientRect());
      if (point) guide(point.x, point.y, deliberate);
    });
  }
  function leave(): void {
    assertAlive(); pendingGuide = null; pendingPounce = false; policyLeave = true;
  }
  function listen(target: EventTarget, name: string, listener: EventListener): void {
    cleanups.push(() => target.removeEventListener(name, listener));
    target.addEventListener(name, listener, { passive: true });
  }

  const controller: FoxBrowserController = {
    configure(patch) {
      assertAlive();
      // User validation failures do not terminate or partially update a mount.
      const value = model.configure(patch);
      state = model.getState();
      guarded(() => { render(); notify(); });
      return value;
    },
    reset(seed) {
      assertAlive();
      const value = seed === undefined ? model.reset() : model.reset(seed);
      state = value; pendingGuide = null; pendingPounce = false; policyLeave = false;
      poster = reducedMotion ? 'idle' : null;
      guarded(() => { stopFrames(); reconcile(); });
      return value;
    },
    setPaused(value) {
      assertAlive();
      if (typeof value !== 'boolean') throw new TypeError('Pause must be boolean');
      model.setPaused(value); userPaused = value;
      guarded(() => reconcile());
    },
    guide(x, y) { guide(x, y, true); },
    leave,
    pounce() {
      assertAlive();
      if (hidden || offscreen || zeroSized) return;
      if (userPaused || reducedMotion) guarded(() => { poster = 'crouch'; render(); notify(); });
      else pendingPounce = true;
    },
    showStaticPose(value) {
      assertAlive();
      if (!['idle', 'sniff', 'crouch'].includes(value)) throw new TypeError('Unknown static fox pose');
      userPaused = true; model.setPaused(true); poster = value;
      guarded(() => reconcile());
    },
    getState() { assertAlive(); return model.getState(); },
    getStatus: status,
    exportText() {
      assertAlive();
      const pose = poster === null ? model.getPose() : staticFoxPose({ ...model.getOptions(), seed: state.seed }, poster);
      return buildFoxGrid(pose, { cols, rows, monochrome: gridOptions.monochrome ?? false }).text;
    },
    dispose,
  };

  try {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is unavailable; use the text specimen.');
    context = ctx;
    if (typeof view.ResizeObserver !== 'function' || typeof view.IntersectionObserver !== 'function') throw new Error('Fox preview requires ResizeObserver and IntersectionObserver.');
    if (!options.frameSource && (typeof view.requestAnimationFrame !== 'function' || typeof view.cancelAnimationFrame !== 'function')) throw new Error('Animation frame scheduling is unavailable.');
    const media = view.matchMedia?.('(prefers-reduced-motion: reduce)');
    reducedMotion = Boolean(media?.matches); poster = reducedMotion ? 'idle' : null;
    if (media) listen(media, 'change', () => { if (disposed) return; guarded(() => { reducedMotion = media.matches; poster = reducedMotion ? 'idle' : null; reconcile(); }); });
    listen(canvas, 'pointermove', event => pointer(event as PointerEvent, false));
    listen(canvas, 'pointerdown', event => pointer(event as PointerEvent, true));
    for (const name of ['pointerleave', 'pointercancel', 'lostpointercapture']) listen(canvas, name, () => { if (!disposed) leave(); });
    listen(document, 'visibilitychange', () => { if (disposed) return; guarded(() => { hidden = Boolean(document.hidden); reconcile(); }); });
    listen(view, 'resize', () => { if (!disposed) guarded(resize); });
    const sizeObserver = new view.ResizeObserver(() => { if (!disposed) guarded(resize); });
    cleanups.push(() => sizeObserver.disconnect()); sizeObserver.observe(canvas);
    const visibilityObserver = new view.IntersectionObserver(entries => {
      if (disposed) return;
      const entry = entries.find(item => item.target === canvas);
      if (entry) guarded(() => { offscreen = !entry.isIntersecting; reconcile(); });
    });
    cleanups.push(() => visibilityObserver.disconnect()); visibilityObserver.observe(canvas);
    resize();
    if (document.fonts?.ready) void document.fonts.ready.then(() => {
      if (!disposed) { try { render(); } catch { dispose(); } }
    }, () => undefined);
    return controller;
  } catch (error) { dispose(); throw error; }
}
