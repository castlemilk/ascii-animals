import { createOwl, makeOwlPoster, normalizeOwlPointer } from './owl.js';
import { renderOwlGrid } from './preview.js';
import { createOwlDirector, makeOwlDirectorPoster, validateOwlDirectorCue } from './director.js';
import { renderOwlDirectorGrid, targetOwlActor } from './composition.js';
import type { OwlDirectorOptions, OwlDirectorInput, OwlDirectorState, OwlDirectorCue } from './director.js';
import type { OwlDirectorGrid } from './composition.js';
import type { OwlGrid, OwlGridOptions, OwlInput, OwlOptions, OwlOptionsPatch, OwlPoster, OwlState } from './types.js';

/** Structural subset of the merged scheduler; the host retains source ownership. */
export interface OwlFrameSource {
  subscribe(callback: (timestampMs: number) => void): () => void;
}

export type OwlSuspension = 'paused' | 'reduced-motion' | 'hidden' | 'offscreen'
  | 'zero-size' | 'small-container' | 'animation-unavailable' | 'motion-preference-unavailable' | 'disposed';

export type OwlBrowserStatus = Readonly<{
  paused: boolean;
  running: boolean;
  disposed: boolean;
  reducedMotion: boolean;
  blockedBy: readonly OwlSuspension[];
  tick: number;
  behavior: OwlState['behavior'];
  displayedPoster: OwlPoster['kind'] | 'frozen' | null;
  queuedInputs: number;
  droppedMs: number;
  frames: number;
  cols: number;
  rows: number;
  /** Displayed scene, including deliberate still poses; null for the original solo host. */
  director: OwlDirectorState | null;
  /** Optional observers have window-event fallbacks, not per-frame polling. */
  capabilities: Readonly<{ resizeObserver: boolean; intersectionObserver: boolean; motionPreference: boolean }>;
}>;

/** Injection is for hosts/tests; omit in an ordinary browser. Null disables an optional API. */
export type OwlBrowserEnvironment = Readonly<{
  document?: Document;
  requestFrame?: ((callback: FrameRequestCallback) => number) | null;
  cancelFrame?: ((handle: number) => void) | null;
  matchMedia?: ((query: string) => MediaQueryList) | null;
  ResizeObserver?: typeof ResizeObserver | null;
  IntersectionObserver?: typeof IntersectionObserver | null;
}>;

/** Preview typography is fixed to the reviewed 0.55 logical cell aspect. */
export type OwlBrowserGridOptions = Readonly<Omit<OwlGridOptions, 'cellAspect'> & { cellAspect?: 0.55 }>;

export type OwlBrowserOptions = Readonly<{
  owl?: OwlOptions;
  /** Opt in to authored scene direction; omission preserves the original solo contract. */
  director?: OwlDirectorOptions;
  /** Omitted: 64×36 in a narrow host, 96×54 otherwise. Explicit grids are retained. */
  grid?: OwlBrowserGridOptions;
  paused?: boolean;
  frameSource?: OwlFrameSource;
  onStatus?: (status: OwlBrowserStatus) => void;
  environment?: OwlBrowserEnvironment;
}>;

export type OwlActionResult = Readonly<{ kind: 'queued' } | { kind: 'poster'; poster: OwlPoster['kind'] }>;
export type OwlBrowserSnapshot = Readonly<{
  /** The explicit-tick simulation; a static poster never advances or replaces it. */
  simulation: OwlState;
  /** State used for the visible grid; may be a display-only reduced-motion pose. */
  displayed: OwlState;
  grid: OwlGrid;
  /** Displayed director scene; getDirectorSnapshot() separately returns its simulation. */
  director: OwlDirectorState | null;
}>;

export interface OwlBrowserController {
  setPaused(paused: boolean): void;
  react(): OwlActionResult;
  /** Actor-local [-1,1] attention; the director's omitted target is Ash (0). */
  guide(x: number, y: number, target?: 0 | 1): OwlActionResult;
  cue(cue: OwlDirectorCue): OwlActionResult;
  updateDirector(patch: OwlDirectorOptions): void;
  getDirectorSnapshot(): OwlDirectorState | null;
  leave(): void;
  reset(seed?: number): void;
  update(patch: OwlOptionsPatch): void;
  setGrid(options: OwlBrowserGridOptions): void;
  getStatus(): OwlBrowserStatus;
  getSnapshot(): OwlBrowserSnapshot;
  exportText(): string;
  dispose(): void;
}

const STEP_MS = 1000 / 60;
const MAX_STEPS = 5;
const MIN_WIDTH = 350;
const MIN_HEIGHT = 330;
const DEFAULT_DESCRIPTION = 'A round-faced owl perched on a branch, with two forward-facing eyes, folded wings and planted feet.';
const optionKeys = new Set(['owl', 'director', 'grid', 'paused', 'frameSource', 'onStatus', 'environment']);

function object(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object.`);
}

function normalized(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
  return Math.max(-1, Math.min(1, value));
}

function validateBrowserGrid(value: OwlBrowserGridOptions): void {
  object(value, 'Grid options');
  if (value.cellAspect !== undefined && value.cellAspect !== 0.55) {
    throw new RangeError('The DOM preview supports cellAspect 0.55 only; other ratios are pure-sampler proposals.');
  }
}

/**
 * Integrated Owl DOM-text host. Optional direction keeps its composition inside
 * the same owned element/subscription; it never owns a borrowed shared clock.
 * Missing matchMedia/RAF yields a useful static preview. Observer fallbacks use
 * window resize/scroll plus measurements on explicit actions.
 */
export function mountOwl(host: HTMLElement, options: OwlBrowserOptions = {}): OwlBrowserController {
  if (!host || typeof host.appendChild !== 'function' || typeof host.getBoundingClientRect !== 'function' || !host.ownerDocument) {
    throw new TypeError('mountOwl requires an HTMLElement with an explicit display size.');
  }
  object(options, 'Browser options');
  for (const key of Object.keys(options)) if (!optionKeys.has(key)) throw new TypeError(`Unknown browser option: ${key}`);
  if (options.paused !== undefined && typeof options.paused !== 'boolean') throw new TypeError('paused must be boolean.');
  if (options.onStatus !== undefined && typeof options.onStatus !== 'function') throw new TypeError('onStatus must be a function.');
  if (options.frameSource !== undefined && (!options.frameSource || typeof options.frameSource.subscribe !== 'function')) {
    throw new TypeError('frameSource must provide subscribe(callback).');
  }
  if (options.environment !== undefined) object(options.environment, 'Environment');
  if (options.grid !== undefined) validateBrowserGrid(options.grid);

  const env = options.environment ?? {};
  const doc = env.document ?? host.ownerDocument;
  const view = doc.defaultView;
  const browser = view as (Window & typeof globalThis) | null;
  const requestFrame = env.requestFrame === undefined ? view?.requestAnimationFrame?.bind(view) : env.requestFrame;
  const cancelFrame = env.cancelFrame === undefined ? view?.cancelAnimationFrame?.bind(view) : env.cancelFrame;
  const matchMedia = env.matchMedia === undefined ? view?.matchMedia?.bind(view) : env.matchMedia;
  const Resize = env.ResizeObserver === undefined ? browser?.ResizeObserver : env.ResizeObserver;
  const Intersect = env.IntersectionObserver === undefined ? browser?.IntersectionObserver : env.IntersectionObserver;
  for (const [name, fn] of Object.entries({ requestFrame, cancelFrame, matchMedia, ResizeObserver: Resize, IntersectionObserver: Intersect })) {
    if (fn !== undefined && fn !== null && typeof fn !== 'function') throw new TypeError(`${name} must be a function or null.`);
  }
  if (!doc || typeof doc.createElement !== 'function' || typeof doc.addEventListener !== 'function') throw new TypeError('A browser Document is required.');
  const media = matchMedia?.('(prefers-reduced-motion: reduce)');
  const motionKnown = Boolean(media);
  const animationAvailable = Boolean(options.frameSource || (requestFrame && cancelFrame));
  const director = options.director === undefined ? null : createOwlDirector(options.director, options.owl);
  const owl = director ? null : createOwl(options.owl);
  let directorState = director?.getState() ?? null;
  let displayedDirector = directorState;
  let state = directorState ? directorState.actors[0]!.simulation : owl!.getState();
  let displayed = directorState ? directorState.actors[0]!.pose : state;
  let gridOptions = options.grid === undefined ? undefined : { ...options.grid };
  // Validate all logical options before acquiring browser resources.
  let grid: OwlGrid = directorState
    ? renderOwlDirectorGrid(directorState, gridOptions ?? (directorState.config.count === 2 ? { cols: 144, rows: 60 } : { cols: 96, rows: 54 }))
    : renderOwlGrid(state, gridOptions ?? { cols: 96, rows: 54 });
  const shell = doc.createElement('div');
  const pre = doc.createElement('pre');
  shell.setAttribute('data-owl-preview', '');
  shell.style.cssText = 'display:grid;place-items:center;width:100%;height:100%;overflow:hidden;';
  pre.setAttribute('role', 'img');
  pre.setAttribute('aria-label', DEFAULT_DESCRIPTION);
  pre.setAttribute('data-owl-glyphs', '');
  pre.style.cssText = 'margin:0;width:max-content;white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-weight:400;line-height:1.1;letter-spacing:0;font-kerning:none;font-variant-ligatures:none;color:inherit;';
  shell.appendChild(pre);

  let disposed = false;
  let paused = options.paused ?? false;
  let running = false;
  let reduced = Boolean(media?.matches);
  let intersecting = !Intersect;
  let width = 0, height = 0;
  let blockedBy: OwlSuspension[] = [];
  let poster: OwlPoster | null = { kind: 'rest' };
  let directorPoster: OwlDirectorCue | { kind: 'attention'; x: number; y: number; target?: 0 | 1 } | { kind: 'rest' } | null = null;
  let displayedPoster: OwlPoster['kind'] | 'frozen' | null = 'rest';
  let raf: number | null = null;
  let unsubscribe: (() => void) | null = null;
  let previousTime: number | null = null;
  let accumulator = 0, droppedMs = 0, frames = 0;
  let clearTargetOnStep = false;
  let actionOrder = 0;
  let targetAction: { type: 'attention'; x: number; y: number; target?: 0 | 1; order: number } | { type: 'leave'; order: number } | null = null;
  let reactOrder: number | null = null;
  let cueAction: { cue: OwlDirectorCue; order: number } | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let statusSignature = '';
  const removers: (() => void)[] = [];
  const capabilities = Object.freeze({ resizeObserver: Boolean(Resize), intersectionObserver: Boolean(Intersect), motionPreference: motionKnown });

  const assertAlive = (): void => { if (disposed) throw new Error('The owl preview has been disposed.'); };
  function getStatus(): OwlBrowserStatus {
    return Object.freeze({ paused, running, disposed, reducedMotion: reduced,
      blockedBy: Object.freeze([...blockedBy]), tick: state.tick, behavior: state.behavior,
      displayedPoster, queuedInputs: Number(targetAction !== null) + Number(reactOrder !== null || cueAction !== null),
      droppedMs, frames, cols: grid.cols, rows: grid.rows, director: displayedDirector, capabilities });
  }
  function publish(): void {
    if (disposed) return;
    const signature = JSON.stringify([paused, running, reduced, blockedBy, displayedPoster,
      state.behavior.kind, state.behavior.kind === 'response' ? state.behavior.phase : '', grid.cols, grid.rows,
      displayedDirector && [displayedDirector.phase.kind, displayedDirector.config,
        displayedDirector.actors.map(actor => [actor.id, actor.role, actor.motive]), displayedDirector.poster]]);
    if (signature === statusSignature) return;
    statusSignature = signature;
    try { options.onStatus?.(getStatus()); }
    catch (error) { release(); throw error; }
  }
  function listen(target: EventTarget, type: string, callback: EventListener, settings?: AddEventListenerOptions): void {
    target.addEventListener(type, callback, settings);
    removers.push(() => target.removeEventListener(type, callback, settings));
  }
  function clearPending(): void {
    targetAction = null;
    reactOrder = null;
    cueAction = null;
    actionOrder = 0;
    clearTargetOnStep = true;
  }
  function stop(): void {
    running = false;
    if (raf !== null) { cancelFrame?.(raf); raf = null; }
    if (unsubscribe) { const remove = unsubscribe; unsubscribe = null; remove(); }
    previousTime = null;
    accumulator = 0;
    clearPending();
  }
  function release(): void {
    if (disposed) return;
    disposed = true;
    stop();
    for (const remove of removers.splice(0).reverse()) remove();
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    resizeObserver = null;
    intersectionObserver = null;
    shell.remove();
    owl?.dispose();
    director?.dispose();
    blockedBy = ['disposed'];
  }
  function chosenGrid(scene: OwlDirectorState | null = directorState): OwlGridOptions {
    if (gridOptions) return gridOptions;
    if (scene) return scene.config.count === 2
      ? (width < 700 ? { cols: 80, rows: 90 } : { cols: 144, rows: 60 })
      : { cols: 96, rows: 54 };
    return width < 550 || height < 440 ? { cols: 64, rows: 36 } : { cols: 96, rows: 54 };
  }
  function draw(next?: OwlGrid): void {
    if (disposed) return;
    if (directorState) {
      displayedDirector = running || directorPoster === null ? directorState : makeOwlDirectorPoster(directorState, directorPoster);
      displayed = displayedDirector.actors[0]!.pose;
      grid = next ?? renderOwlDirectorGrid(displayedDirector, chosenGrid());
    } else {
      displayed = running || poster === null ? state : makeOwlPoster(state, poster);
      grid = next ?? renderOwlGrid(displayed, chosenGrid());
    }
    displayedPoster = running ? null : poster?.kind ?? 'frozen';
    pre.textContent = grid.text;
    pre.style.fontSize = `${Math.max(0, Math.min(width / (grid.cols * 0.6), height / (grid.rows * 1.1)))}px`;
    pre.setAttribute('aria-label', displayedDirector
      ? `${displayedDirector.config.count === 2 ? 'Two' : 'One'} round-faced ${displayedDirector.config.count === 2 ? 'owls' : 'owl'} on a twilight perch. ${displayedDirector.config.scene} scene, ${displayedDirector.phase.kind}. ${displayedDirector.actors.map(actor => `${actor.name}: ${actor.motive}`).join('. ')}${running ? '' : ' Still scene.'}`
      : `${DEFAULT_DESCRIPTION}${displayedPoster === 'react' ? ' Static wing-stretch pose.' : displayedPoster === 'attention' ? ' Static attentive pose.' : ''}`);
    frames++;
  }
  function measure(): void {
    const rect = host.getBoundingClientRect();
    width = Number.isFinite(rect.width) && rect.width > 0 ? rect.width : 0;
    height = Number.isFinite(rect.height) && rect.height > 0 ? rect.height : 0;
    if (!Intersect) {
      const viewportW = view?.innerWidth, viewportH = view?.innerHeight;
      // With no view geometry available, direct hosts can still use the preview.
      intersecting = viewportW === undefined || viewportH === undefined
        || (rect.right > 0 && rect.bottom > 0 && rect.left < viewportW && rect.top < viewportH);
    }
  }
  function collectBlockers(): OwlSuspension[] {
    const next: OwlSuspension[] = [];
    if (paused) next.push('paused');
    if (reduced) next.push('reduced-motion');
    if (doc.hidden) next.push('hidden');
    if (!intersecting) next.push('offscreen');
    if (!width || !height) next.push('zero-size');
    else if (width < MIN_WIDTH || height < MIN_HEIGHT) next.push('small-container');
    if (!animationAvailable) next.push('animation-unavailable');
    if (!motionKnown) next.push('motion-preference-unavailable');
    return next;
  }
  function start(): void {
    running = true;
    previousTime = null;
    accumulator = 0;
    if (options.frameSource) {
      const remove = options.frameSource.subscribe(onFrame);
      if (typeof remove !== 'function') throw new TypeError('frameSource.subscribe must return an unsubscribe function.');
      if (disposed || !running) remove(); else unsubscribe = remove;
    } else {
      raf = requestFrame!(onFrame);
    }
  }
  function reconcile(redraw = false): void {
    if (disposed) return;
    const oldWidth = width, oldHeight = height;
    measure();
    reduced = Boolean(media?.matches);
    const next = collectBlockers();
    const changedPolicy = JSON.stringify(next) !== JSON.stringify(blockedBy);
    blockedBy = next;
    const shouldRun = next.length === 0;
    if (running && !shouldRun) {
      stop();
      // Suspension freezes the current pose. Deliberate static actions can
      // replace it, but merely pausing must not collapse an extended wing.
      poster = null;
      directorPoster = null;
    } else if (!running && shouldRun) {
      start();
    }
    if (redraw || changedPolicy || oldWidth !== width || oldHeight !== height) draw();
    publish();
  }
  function eventsFor(tick: number): OwlInput[] {
    const actions: ({ type: 'attention'; x: number; y: number; order: number } | { type: 'leave' | 'react'; order: number })[] = [];
    if (targetAction) actions.push(targetAction);
    else if (clearTargetOnStep) actions.push({ type: 'leave', order: -1 });
    if (reactOrder !== null) actions.push({ type: 'react', order: reactOrder });
    actions.sort((a, b) => a.order - b.order);
    const events: OwlInput[] = actions.map((action, index) => action.type === 'attention'
      ? { type: 'attention', x: action.x, y: action.y, tick, seq: state.lastSequence + 1 + index }
      : { type: action.type, tick, seq: state.lastSequence + 1 + index });
    targetAction = null;
    reactOrder = null;
    actionOrder = 0;
    clearTargetOnStep = false;
    return events;
  }
  function directorEventsFor(tick: number): OwlDirectorInput[] {
    const actions: ({ type: 'attention'; x: number; y: number; target?: 0 | 1; order: number }
      | { type: 'leave'; order: number } | { type: 'cue'; cue: OwlDirectorCue; order: number })[] = [];
    if (targetAction) actions.push(targetAction);
    else if (clearTargetOnStep) actions.push({ type: 'leave', order: -1 });
    if (cueAction) actions.push({ type: 'cue', ...cueAction });
    actions.sort((a, b) => a.order - b.order);
    const events: OwlDirectorInput[] = actions.map((action, index) => {
      const common = { tick, seq: directorState!.lastSequence + 1 + index };
      if (action.type === 'attention') return { ...common, type: 'attention' as const, x: action.x, y: action.y,
        ...(action.target === undefined ? {} : { target: action.target }) };
      if (action.type === 'cue') return { ...common, type: 'cue' as const, cue: action.cue };
      return { ...common, type: 'leave' as const };
    });
    targetAction = null; cueAction = null; reactOrder = null; actionOrder = 0; clearTargetOnStep = false;
    return events;
  }
  function syncDirector(): void {
    directorState = director!.getState();
    state = directorState.actors[0]!.simulation;
  }
  function onFrame(timestamp: number): void {
    if (disposed || !running) return;
    if (!options.frameSource) raf = null;
    try {
      // Visibility/preference can change before their queued native events.
      if (Boolean(doc.hidden) || Boolean(media?.matches)) { reconcile(true); return; }
      if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > Number.MAX_SAFE_INTEGER) {
        throw new RangeError('Frame timestamp must be finite, nonnegative and within the safe numeric range.');
      }
      // A buggy external clock cannot rewind our presentation baseline.
      if (previousTime !== null && timestamp < previousTime) {
        if (running && !options.frameSource) raf = requestFrame!(onFrame);
        return;
      }
      if (previousTime !== null) {
        const elapsed = Math.max(0, timestamp - previousTime);
        accumulator += elapsed;
        const availableSteps = Math.floor((accumulator + 1e-7) / STEP_MS);
        if (availableSteps > MAX_STEPS) {
          const lost = (availableSteps - MAX_STEPS) * STEP_MS;
          droppedMs += lost;
          accumulator -= lost;
        }
        const steps = Math.min(availableSteps, MAX_STEPS);
        for (let i = 0; i < steps; i++) {
          const tick = state.tick + 1;
          if (director) {
            directorState = director.advance(tick, i === 0 ? directorEventsFor(tick) : []).state;
            state = directorState.actors[0]!.simulation;
          } else state = owl!.advance(tick, i === 0 ? eventsFor(tick) : []).state;
          accumulator = Math.max(0, accumulator - STEP_MS);
        }
        if (steps) { draw(); publish(); }
      }
      previousTime = timestamp;
      if (running && !options.frameSource) raf = requestFrame!(onFrame);
    } catch (error) { release(); throw error; }
  }
  function queueTarget(action: { type: 'attention'; x: number; y: number; target?: 0 | 1 } | { type: 'leave' }): void {
    targetAction = { ...action, order: actionOrder++ };
  }
  function eventPoint(event: PointerEvent): { x: number; y: number } | null {
    // The composed text may be centered within a letterboxed host. Actor cells
    // live in the actual pre rectangle, not the surrounding empty stage.
    const rect = director ? pre.getBoundingClientRect() : host.getBoundingClientRect();
    return normalizeOwlPointer(event.clientX, event.clientY, rect);
  }
  function actorPoint(point: { x: number; y: number }): { x: number; y: number; target: 0 | 1 } {
    const sceneGrid = grid as OwlDirectorGrid;
    const target = targetOwlActor(sceneGrid, point.x, point.y);
    const rect = sceneGrid.actorRects.find(candidate => candidate.id === target)!;
    const col = (point.x + 1) * .5 * (sceneGrid.cols - 1);
    const row = (point.y + 1) * .5 * (sceneGrid.rows - 1);
    // Ownership uses composed scene cells; gaze uses the selected owl's viewport.
    // Otherwise a point to Ash's right but left of scene center looks left.
    return { target,
      x: normalized(2 * (col - rect.left) / (rect.width - 1) - 1, 'Actor gaze x'),
      y: normalized(2 * (row - rect.top) / (rect.height - 1) - 1, 'Actor gaze y') };
  }
  function pointer(event: Event): void {
    if (disposed || !running) return;
    reconcile();
    if (!running) return;
    const e = event as PointerEvent;
    const point = eventPoint(e);
    if (point) queueTarget({ type: 'attention', ...(director ? actorPoint(point) : point) });
  }
  function pointerLeave(event?: Event): void {
    if (disposed) return;
    targetAction = null;
    if (director && (event?.type === 'pointercancel' || event?.type === 'lostpointercapture')) cueAction = null;
    clearTargetOnStep = true;
    if (running) queueTarget({ type: 'leave' });
  }
  function checkedTarget(target: 0 | 1 | undefined): 0 | 1 | undefined {
    if (target === undefined) return undefined;
    if (target !== 0 && target !== 1) throw new RangeError('Owl target must be 0 or 1.');
    if (!directorState) throw new TypeError('Individual targets require an enabled Owl director.');
    if (target >= directorState.config.count) throw new RangeError('Owl target is not active in this scene.');
    return target;
  }
  function cue(value: OwlDirectorCue): OwlActionResult {
    assertAlive();
    if (!director || !directorState) throw new TypeError('Create the Owl with director options before sending scene cues.');
    const next = validateOwlDirectorCue(value);
    checkedTarget(next.target);
    reconcile(); assertAlive();
    if (running) {
      // Last deliberate cue wins within one upcoming tick; the queue never grows.
      cueAction = { cue: next, order: actionOrder++ };
      return Object.freeze({ kind: 'queued' });
    }
    directorPoster = next;
    poster = { kind: 'react' };
    draw(); publish();
    return Object.freeze({ kind: 'poster', poster: 'react' });
  }
  function pointerDown(event: Event): void {
    if (disposed || !director) return;
    const e = event as PointerEvent;
    if (typeof e.button === 'number' && e.button !== 0) return;
    const point = eventPoint(e);
    if (!point) return;
    cue({ kind: 'rustle', ...actorPoint(point) });
  }

  try {
    host.appendChild(shell);
    listen(host, 'pointermove', pointer, { passive: true });
    if (director) listen(host, 'pointerdown', pointerDown, { passive: true });
    for (const event of ['pointerleave', 'pointercancel', 'lostpointercapture']) listen(host, event, pointerLeave, { passive: true });
    listen(doc, 'visibilitychange', () => reconcile(true));
    if (media?.addEventListener) listen(media, 'change', () => reconcile(true));
    else if (media?.addListener) {
      const legacyChange = (): void => reconcile(true);
      media.addListener(legacyChange);
      removers.push(() => media.removeListener(legacyChange));
    }
    if (Resize) {
      resizeObserver = new Resize(() => reconcile(true));
      resizeObserver.observe(host);
    }
    if (Intersect) {
      intersectionObserver = new Intersect(entries => {
        if (disposed) return;
        for (const entry of entries) if (entry.target === host) intersecting = entry.isIntersecting && entry.intersectionRatio > 0;
        reconcile(true);
      }, { threshold: [0, 0.01] });
      intersectionObserver.observe(host);
    }
    if (view && (!Resize || !Intersect)) {
      listen(view, 'resize', () => reconcile(true), { passive: true });
      if (!Intersect) listen(view, 'scroll', () => reconcile(), { passive: true, capture: true });
    }
    reconcile(true);
  } catch (error) { release(); throw error; }

  return Object.freeze({
    setPaused(value: boolean): void {
      assertAlive();
      if (typeof value !== 'boolean') throw new TypeError('paused must be boolean.');
      paused = value;
      reconcile(true);
    },
    react(): OwlActionResult {
      assertAlive();
      if (director) return cue({ kind: 'stretch' });
      reconcile();
      assertAlive();
      if (running) { if (reactOrder === null) reactOrder = actionOrder++; return Object.freeze({ kind: 'queued' }); }
      poster = { kind: 'react' };
      draw(); publish();
      return Object.freeze({ kind: 'poster', poster: 'react' });
    },
    guide(x: number, y: number, target?: 0 | 1): OwlActionResult {
      assertAlive();
      x = normalized(x, 'Guide x'); y = normalized(y, 'Guide y');
      checkedTarget(target);
      reconcile();
      assertAlive();
      const selection = director ? target ?? 0 : undefined;
      if (running) { queueTarget({ type: 'attention', x, y,
        ...(selection === undefined ? {} : { target: selection }) }); return Object.freeze({ kind: 'queued' }); }
      poster = { kind: 'attention', x, y };
      if (director) directorPoster = { kind: 'attention', x, y,
        ...(selection === undefined ? {} : { target: selection }) };
      draw(); publish();
      return Object.freeze({ kind: 'poster', poster: 'attention' });
    },
    cue,
    updateDirector(patch: OwlDirectorOptions): void {
      assertAlive();
      if (!director || !directorState) throw new TypeError('Create the Owl with director options before configuring its scene.');
      object(patch, 'Director patch');
      // Resolve and sample a temporary candidate before touching the live scene.
      // This also catches an explicit solo-only grid before enabling a duet.
      const candidate = createOwlDirector({ ...directorState.config, ...patch }, state.config);
      try { renderOwlDirectorGrid(candidate.getState(), chosenGrid(candidate.getState())); }
      finally { candidate.dispose(); }
      director.update(patch);
      syncDirector();
      clearPending();
      directorPoster = null; poster = null;
      reconcile(true);
    },
    getDirectorSnapshot(): OwlDirectorState | null { assertAlive(); return directorState; },
    leave(): void {
      assertAlive(); reconcile(); assertAlive(); pointerLeave();
      if (!running) { poster = { kind: 'rest' }; if (director) directorPoster = { kind: 'rest' }; draw(); }
      publish();
    },
    reset(seed?: number): void {
      assertAlive();
      // The core validates first; invalid resets leave all host state untouched.
      if (director) { director.reset(seed); syncDirector(); }
      else state = owl!.reset(seed);
      clearPending();
      clearTargetOnStep = false;
      previousTime = null; accumulator = 0; droppedMs = 0;
      poster = { kind: 'rest' };
      directorPoster = null;
      reconcile(true);
    },
    update(patch: OwlOptionsPatch): void {
      assertAlive();
      if (director) { director.updateOwl(patch); syncDirector(); }
      else { owl!.update(patch); state = owl!.getState(); }
      reconcile(true);
    },
    setGrid(patch: OwlBrowserGridOptions): void {
      assertAlive();
      validateBrowserGrid(patch);
      const next = { ...patch };
      // Sampling validates atomically before replacing the effective grid.
      const candidate = displayedDirector ? renderOwlDirectorGrid(displayedDirector, next) : renderOwlGrid(displayed, next);
      gridOptions = next;
      draw(candidate); publish();
    },
    getStatus,
    getSnapshot(): OwlBrowserSnapshot { assertAlive(); return Object.freeze({ simulation: state, displayed, grid, director: displayedDirector }); },
    exportText(): string { assertAlive(); return grid.text; },
    dispose(): void { release(); },
  });
}
