/** Integrated Fox lifecycle; the optional meadow director shares this one host. */
import { createFox, normalizeFoxPointer, staticFoxPose } from './model.js';
import { buildFoxGrid, paintFoxGrid } from './preview.js';
import { createFoxDirector, resolveFoxDirectorOptions } from './director.js';
import { buildFoxSceneGrid, paintFoxSceneGrid, routeFoxScenePointer } from './director-render.js';
import type { FoxCue, FoxDirectorInput, FoxDirectorOptions, FoxDirectorOptionsInput, FoxDirectorState, FoxSceneGrid, FoxTableau } from './director-types.js';
import type { FoxCreateOptions, FoxFrameSource, FoxGridOptions, FoxInput,
  FoxOptions, FoxOptionsInput, FoxPoint, FoxState, FoxStaticPose } from './types.js';

export interface FoxBrowserOptions {
  readonly fox?: FoxCreateOptions;
  readonly grid?: FoxGridOptions;
  /** Opt in to a bounded meadow cast. Omit to preserve the original single Fox. */
  readonly director?: FoxDirectorOptionsInput;
  readonly onDirectorInputs?: (batch: readonly FoxDirectorInput[]) => void;
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
  readonly director: FoxDirectorState | null;
  readonly tableau: FoxTableau | null;
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
  getOptions(): FoxOptions;
  getState(): FoxState;
  /** Diagnostics remain readable after disposal; other operations reject. */
  getStatus(): FoxBrowserStatus;
  exportText(): string;
  configureDirector(options: FoxDirectorOptionsInput): FoxDirectorOptions;
  getDirectorOptions(): FoxDirectorOptions | null;
  getDirectorState(): FoxDirectorState | null;
  cue(cue: FoxCue, id?: number, point?: FoxPoint): void;
  selectFox(id: number): void;
  showTableau(tableau: FoxTableau): void;
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
  for (const key of Object.keys(options)) if (!['fox', 'grid', 'director', 'frameSource', 'onStatus', 'onInputs', 'onDirectorInputs'].includes(key)) throw new TypeError(`Unknown browser option: ${key}`);
  if (options.onStatus !== undefined && typeof options.onStatus !== 'function') throw new TypeError('onStatus must be a function');
  if (options.onInputs !== undefined && typeof options.onInputs !== 'function') throw new TypeError('onInputs must be a function');
  if (options.onDirectorInputs !== undefined && typeof options.onDirectorInputs !== 'function') throw new TypeError('onDirectorInputs must be a function');
  if (options.frameSource !== undefined && typeof options.frameSource?.subscribe !== 'function') throw new TypeError('frameSource must provide subscribe');
  if (options.director !== undefined && (!options.director || typeof options.director !== 'object' || Array.isArray(options.director)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(options.director)))) throw new TypeError('director must be a plain object');
  const gridOptions = validateGrid(options.grid ?? {});
  if (options.director !== undefined && ((gridOptions.cols ?? 160) < 112 || (gridOptions.rows ?? 64) < 48)) throw new RangeError('Director grid requires at least 112 columns and 48 rows');
  const document = canvas?.ownerDocument;
  const view = document?.defaultView as (Window & typeof globalThis) | null;
  if (!document || !view) throw new TypeError('mountFox requires a browser canvas with an owner document');
  const director = options.director === undefined ? null : createFoxDirector({ ...resolveFoxDirectorOptions(options.director), ...(options.fox === undefined ? {} : { fox: options.fox }) });
  const model = director ? null : createFox(options.fox);
  const currentState = () => director ? director.getState().actors[0]!.state : model!.getState();
  const currentOptions = () => director ? director.getFoxOptions() : model!.getOptions();
  const cleanups: Array<() => void> = [];
  let state = currentState();
  let directorState = director?.getState() ?? null;
  let userPaused = director ? director.isPaused() : model!.isPaused();
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
  let pendingCue: { cue: FoxCue; id?: number; x?: number; y?: number } | null = null;
  let policyLeave = false;
  let poster: FoxStaticPose | null = reducedMotion ? 'idle' : null;
  let tableau: FoxTableau | null = null;
  let sceneGrid: FoxSceneGrid | null = null;
  let width = 1, height = 1, dpr = 1;
  let cols = gridOptions.cols ?? (director ? 160 : 112), rows = gridOptions.rows ?? (director ? 64 : 44);
  let context: CanvasRenderingContext2D;

  const assertAlive = () => { if (disposed) throw new Error('Fox browser controller is disposed'); };
  const requireDirector = () => { assertAlive(); if (!director) throw new Error('Fox director is not enabled'); return director; };
  const syncState = () => { state = currentState(); directorState = director?.getState() ?? null; };
  const blocked = () => disposed || userPaused || reducedMotion || hidden || offscreen || zeroSized;
  const canDraw = () => !disposed && !hidden && !offscreen && !zeroSized;
  const status = (): FoxBrowserStatus => Object.freeze({ tick: state.tick, phase: state.behavior.kind,
    paused: userPaused, reducedMotion, hidden, offscreen, zeroSized, disposed, running: !blocked(),
    ownAnimationFrames: raf === null ? 0 : 1, subscribed,
    pendingInputs: (pendingGuide ? 1 : 0) + (pendingPounce || pendingCue ? 1 : 0), pendingPolicyReset: policyLeave,
    droppedMilliseconds, renderedFrames, staticPose: poster, cols, rows,
    backingWidth: canvas.width, backingHeight: canvas.height, director: directorState, tableau });
  function stopFrames(): void {
    generation++;
    if (raf !== null) { view!.cancelAnimationFrame(raf); raf = null; }
    const release = unsubscribe; unsubscribe = null; subscribed = false;
    if (release) release();
    previousTimestamp = null; accumulator = 0;
  }
  function clearUserInput(resetInterest: boolean): void {
    if (resetInterest && (state.target.active || directorState?.pointer.active || pendingGuide !== null)) policyLeave = true;
    pendingGuide = null; pendingPounce = false; pendingCue = null;
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    // Complete every cleanup even if a host-provided release unexpectedly throws.
    try { stopFrames(); } catch { /* The borrowed source owns its own failures. */ }
    for (const release of cleanups.reverse()) { try { release(); } catch { /* Continue cleanup. */ } }
    cleanups.length = 0;
    pendingGuide = null; pendingPounce = false; pendingCue = null; policyLeave = false;
    if (director) director.dispose(); else model!.dispose();
    sceneGrid = null;
    canvas.width = 1; canvas.height = 1;
  }
  function guarded<T>(operation: () => T): T {
    try { return operation(); } catch (error) { dispose(); throw error; }
  }
  function notify(): void { options.onStatus?.(status()); }
  function render(): void {
    if (!canDraw()) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (director) {
      sceneGrid = buildFoxSceneGrid(director.getFrame(tableau ?? undefined), { cols, rows, monochrome: gridOptions.monochrome ?? false });
      paintFoxSceneGrid(context, sceneGrid, width, height, { monochrome: gridOptions.monochrome ?? false });
    } else {
      const pose = poster === null ? model!.getPose() : staticFoxPose({ ...currentOptions(), seed: state.seed }, poster);
      const grid = buildFoxGrid(pose, { cols, rows, monochrome: gridOptions.monochrome ?? false });
      paintFoxGrid(context, grid, width, height, { monochrome: gridOptions.monochrome ?? false });
    }
    renderedFrames++;
  }
  function step(): void {
    if (director) {
      const prior = director.getState(), tick = prior.tick + 1;
      let seq = prior.lastSequence + 1;
      const batch: FoxDirectorInput[] = [];
      if (pendingGuide) batch.push({ type: 'guide', tick, seq: seq++, ...pendingGuide });
      else if (policyLeave) batch.push({ type: 'leave', tick, seq: seq++ });
      if (pendingCue) batch.push({ type: 'cue', tick, seq: seq++, ...pendingCue });
      pendingGuide = null; pendingPounce = false; pendingCue = null; policyLeave = false;
      director.step(tick, batch); syncState();
      if (batch.length) options.onDirectorInputs?.(Object.freeze(batch.map(event => Object.freeze(event))));
      return;
    }
    const tick = state.tick + 1;
    let sequence = state.lastSequence + 1;
    const batch: FoxInput[] = [];
    if (pendingGuide) batch.push({ type: 'guide', tick, seq: sequence++, ...pendingGuide });
    else if (policyLeave) batch.push({ type: 'leave', tick, seq: sequence++ });
    if (pendingPounce) batch.push({ type: 'pounce', tick, seq: sequence++ });
    pendingGuide = null; pendingPounce = false; pendingCue = null; policyLeave = false;
    state = model!.step(tick, batch).state;
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
      const beforeScene = directorState ? [directorState.beat, ...directorState.actors.map(actor => actor.action)].join(':') : '';
      const beforeTick = state.tick;
      for (let n = 0; n < count && !blocked(); n++) {
        step();
        // An input callback may reset/dispose and replace this subscription.
        // The retired frame must not advance the new scene or paint it again.
        if (disposed || ticket !== generation) return;
        accumulator = Math.max(0, accumulator - STEP_MS);
      }
      if (count && !disposed) render();
      const afterScene = directorState ? [directorState.beat, ...directorState.actors.map(actor => actor.action)].join(':') : '';
      if (!disposed && (before !== state.behavior.kind || beforeScene !== afterScene
        || (director && Math.floor(beforeTick / 30) !== Math.floor(state.tick / 30)))) notify();
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
    else { poster = null; tableau = null; startFrames(); }
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
      cols = gridOptions.cols ?? (director ? (rect.width < 640 ? 112 : 160) : (rect.width < 640 ? 80 : 112));
      rows = gridOptions.rows ?? (director ? 64 : (rect.width < 640 ? 32 : 44));
    }
    reconcile();
  }
  function guide(x: number, y: number, deliberate: boolean): void {
    assertAlive();
    const point = { x: clamp(finite(x, 'Guide x'), -1, 1), y: clamp(finite(y, 'Guide y'), -1, 1) };
    if (hidden || offscreen || zeroSized) return;
    if (userPaused || reducedMotion) {
      if (deliberate) guarded(() => { poster = 'sniff'; if (director) tableau = 'listen'; render(); notify(); });
      return;
    }
    pendingGuide = point; policyLeave = false;
  }
  function pointer(event: PointerEvent, deliberate: boolean): void {
    if (disposed) return;
    guarded(() => {
      const point = normalizeFoxPointer(event.clientX, event.clientY, canvas.getBoundingClientRect());
      if (!point) return;
      if (!director) { guide(point.x, point.y, deliberate); return; }
      // Map CSS coordinates through the exact 1:2 grid letterbox used to paint.
      const ch = Math.min(height / rows, width / (cols * .5)), cw = ch * .5;
      const contentWidth = cols * cw, contentHeight = rows * ch;
      const x = ((point.x + 1) * width / 2 - (width - contentWidth) / 2) / contentWidth * 2 - 1;
      const y = ((point.y + 1) * height / 2 - (height - contentHeight) / 2) / contentHeight * 2 - 1;
      if (Math.abs(x) > 1 || Math.abs(y) > 1) { leave(); return; }
      if (!sceneGrid) return;
      const route = routeFoxScenePointer(sceneGrid, x, y, deliberate ? undefined : director.getState().selectedId);
      if (!route) return;
      guide(route.point.x, route.point.y, deliberate);
      if (deliberate) cue('rustle', route.id, route.point);
    });
  }
  function leave(): void {
    assertAlive(); pendingGuide = null; pendingPounce = false; pendingCue = null; policyLeave = true;
  }
  function cue(value: FoxCue, id?: number, point?: FoxPoint): void {
    const scene = requireDirector();
    if (!['rustle', 'pounce', 'play', 'rest'].includes(value)) throw new TypeError('Unknown fox cue');
    if (id !== undefined && (!Number.isInteger(id) || id < 0 || id >= scene.getOptions().count)) throw new RangeError('Invalid fox id');
    let target: FoxPoint | undefined;
    if (point !== undefined) {
      if (!point || typeof point !== 'object' || Array.isArray(point) || Object.keys(point).some(key => key !== 'x' && key !== 'y')) throw new TypeError('Cue point must contain x and y');
      target = { x: clamp(finite(point.x, 'Cue x'), -1, 1), y: clamp(finite(point.y, 'Cue y'), -1, 1) };
    }
    if (hidden || offscreen || zeroSized) return;
    if (userPaused || reducedMotion) {
      if (id !== undefined) { scene.select(id); syncState(); }
      tableau = value === 'rest' ? 'rest' : value === 'rustle' ? 'listen' : 'pounce';
      poster = tableau === 'rest' ? 'idle' : tableau === 'listen' ? 'sniff' : 'crouch';
      guarded(() => { render(); notify(); });
      return;
    }
    // A located rustle may choose the nearest actor; explicit buttons use selection.
    const owner = id ?? (target === undefined ? scene.getState().selectedId : undefined);
    pendingCue = { cue: value, ...(owner === undefined ? {} : { id: owner }), ...(target ?? {}) };
  }
  function listen(target: EventTarget, name: string, listener: EventListener): void {
    cleanups.push(() => target.removeEventListener(name, listener));
    target.addEventListener(name, listener, { passive: true });
  }

  const controller: FoxBrowserController = {
    configure(patch) {
      assertAlive();
      // User validation failures do not terminate or partially update a mount.
      const value = director ? director.configureFox(patch) : model!.configure(patch);
      syncState();
      guarded(() => { render(); notify(); });
      return value;
    },
    reset(seed) {
      assertAlive();
      const value = director ? (seed === undefined ? director.reset() : director.reset(seed)).actors[0]!.state
        : seed === undefined ? model!.reset() : model!.reset(seed);
      syncState(); pendingGuide = null; pendingPounce = false; pendingCue = null; policyLeave = false;
      poster = reducedMotion ? 'idle' : null;
      tableau = director && reducedMotion ? 'rest' : null;
      guarded(() => { stopFrames(); reconcile(); });
      return value;
    },
    setPaused(value) {
      assertAlive();
      if (typeof value !== 'boolean') throw new TypeError('Pause must be boolean');
      if (director) director.setPaused(value); else model!.setPaused(value); userPaused = value;
      guarded(() => reconcile());
    },
    guide(x, y) { guide(x, y, true); },
    leave,
    pounce() {
      assertAlive();
      if (director) { cue('pounce'); return; }
      if (hidden || offscreen || zeroSized) return;
      if (userPaused || reducedMotion) guarded(() => { poster = 'crouch'; render(); notify(); });
      else pendingPounce = true;
    },
    showStaticPose(value) {
      assertAlive();
      if (!['idle', 'sniff', 'crouch'].includes(value)) throw new TypeError('Unknown static fox pose');
      userPaused = true; if (director) director.setPaused(true); else model!.setPaused(true); poster = value;
      if (director) tableau = value === 'idle' ? 'rest' : value === 'sniff' ? 'listen' : 'pounce';
      guarded(() => reconcile());
    },
    getOptions() { assertAlive(); return currentOptions(); },
    getState() { assertAlive(); return currentState(); },
    getStatus: status,
    exportText() {
      assertAlive();
      if (director) return buildFoxSceneGrid(director.getFrame(tableau ?? undefined), { cols, rows, monochrome: gridOptions.monochrome ?? false }).text;
      const pose = poster === null ? model!.getPose() : staticFoxPose({ ...currentOptions(), seed: state.seed }, poster);
      return buildFoxGrid(pose, { cols, rows, monochrome: gridOptions.monochrome ?? false }).text;
    },
    configureDirector(patch) {
      const scene = requireDirector();
      const value = scene.configure(patch);
      syncState(); clearUserInput(true);
      guarded(() => { render(); notify(); });
      return value;
    },
    getDirectorOptions() { assertAlive(); return director?.getOptions() ?? null; },
    getDirectorState() { assertAlive(); return director?.getState() ?? null; },
    cue,
    selectFox(id) {
      const scene = requireDirector();
      scene.select(id); syncState(); pendingCue = null;
      guarded(() => { render(); notify(); });
    },
    showTableau(value) {
      const scene = requireDirector();
      if (!['listen', 'pounce', 'rest'].includes(value)) throw new TypeError('Unknown fox tableau');
      scene.setPaused(true); userPaused = true; tableau = value;
      poster = value === 'rest' ? 'idle' : value === 'listen' ? 'sniff' : 'crouch';
      guarded(() => reconcile());
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
    tableau = director && reducedMotion ? 'rest' : null;
    if (media) listen(media, 'change', () => { if (disposed) return; guarded(() => { reducedMotion = media.matches; poster = reducedMotion ? 'idle' : null; tableau = director && reducedMotion ? 'rest' : null; reconcile(); }); });
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
