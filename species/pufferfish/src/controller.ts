import { configurePufferfish, createPufferfish, describePufferfish, finite, pufferfishPoster,
  PUFFERFISH_LIMITS, record, resetPufferfish, stepPufferfish } from './model.js';
import { createPufferfishPainter, resolveRenderOptions } from './legacy-painter.js';
import type { PufferfishPainter, PufferfishLegacyDependency, PufferfishRenderConfig, PufferfishRenderOptions, PufferfishRenderResult } from './legacy-painter.js';
import type { PufferfishEvent, PufferfishInput, PufferfishOptions, PufferfishPhase, PufferfishState } from './types.js';
import { configurePufferfishDirector, createPufferfishDirector, describePufferfishDirector,
  pufferfishDirectorPoster, resetPufferfishDirector, selectPufferfishActor, stepPufferfishDirector } from './director.js';
import type { PufferfishDirectorEvent, PufferfishDirectorInput, PufferfishDirectorOptions,
  PufferfishDirectorState, PufferfishSceneStatus } from './director-types.js';

export interface PufferfishFrameSource { subscribe(callback: (timestamp: number) => void): () => void }
export interface PufferfishMountOptions {
  readonly frameSource?: PufferfishFrameSource;
  readonly species?: PufferfishOptions;
  /** Omit to retain the original centered solo experience. */
  readonly director?: PufferfishDirectorOptions;
  readonly render?: PufferfishRenderOptions;
  readonly paused?: boolean;
  readonly onChange?: (status: PufferfishStatus) => void;
  readonly onError?: (error: unknown) => void;
}
export interface PufferfishStatus {
  readonly tick: number; readonly phase: PufferfishPhase['kind']; readonly description: string;
  readonly userPaused: boolean; readonly reducedMotion: boolean; readonly hidden: boolean;
  readonly offscreen: boolean; readonly zeroSized: boolean; readonly compact: boolean;
  readonly destroyed: boolean; readonly running: boolean; readonly queuedFrames: number;
  readonly droppedMilliseconds: number; readonly renderedFrames: number; readonly coalescedInputs: number;
  readonly pendingInputs: number; readonly failure: string | null;
  readonly director: PufferfishSceneStatus | null;
}
export type PufferfishActionResult = Readonly<{ kind: 'queued' | 'static-poster' | 'suspended'; phase: PufferfishPhase['kind'] }>;
export interface PufferfishController {
  configure(patch: PufferfishOptions): void;
  configureRender(patch: PufferfishRenderOptions): void;
  configureDirector(patch: PufferfishDirectorOptions): void;
  selectActor(id: number): void;
  invite(x?: number, y?: number): PufferfishActionResult;
  setPaused(paused: boolean): void;
  reset(seed?: number): void;
  approach(): PufferfishActionResult;
  retreat(): PufferfishActionResult;
  getSnapshot(): PufferfishState;
  getDirectorSnapshot(): PufferfishDirectorState | null;
  getStatus(): PufferfishStatus;
  exportText(): string;
  destroy(): void;
}
export interface PufferfishRect { readonly left: number; readonly top: number; readonly width: number; readonly height: number }
export function normalizePufferfishPointer(clientX: number, clientY: number, rect: PufferfishRect): PufferfishInput | null {
  finite(clientX, -1e7, 1e7, 'clientX'); finite(clientY, -1e7, 1e7, 'clientY');
  finite(rect.left, -1e7, 1e7, 'rect.left'); finite(rect.top, -1e7, 1e7, 'rect.top');
  finite(rect.width, 0, 1e5, 'rect.width'); finite(rect.height, 0, 1e5, 'rect.height');
  if (!rect.width || !rect.height) return null;
  const aspect = rect.width / rect.height;
  if (aspect < 0.1 || aspect > 10) return null;
  const x = (clientX - rect.left) / rect.width * 2 - 1, y = (clientY - rect.top) / rect.height * 2 - 1;
  if (x < -1 || x > 1 || y < -1 || y > 1) return { type: 'retreat' };
  return { type: 'pointer', x, y, aspect };
}

/** Browser lifecycle only. No legacy constructor/listener/RAF is created by the painter. */
export function mountPufferfish(canvas: HTMLCanvasElement, legacy: PufferfishLegacyDependency,
  options: PufferfishMountOptions = {}): PufferfishController {
  return mountPufferfishWithPainter(canvas, options, (surface, config) => createPufferfishPainter(surface, legacy, config));
}

/** Internal dependency injection for art variations. All variants share this lifecycle. */
export function mountPufferfishWithPainter(canvas: HTMLCanvasElement, options: PufferfishMountOptions,
  createPainter: (surface: HTMLCanvasElement, config: PufferfishRenderConfig) => PufferfishPainter): PufferfishController {
  record(options, ['species', 'director', 'render', 'paused', 'onChange', 'onError', 'frameSource'], 'mount options');
  if (options.paused !== undefined && typeof options.paused !== 'boolean') throw new TypeError('paused must be boolean');
  for (const cb of ['onChange', 'onError'] as const)
    if (options[cb] !== undefined && typeof options[cb] !== 'function') throw new TypeError(`${cb} must be a function`);
  if (options.frameSource !== undefined && typeof (options as PufferfishMountOptions).frameSource?.subscribe !== 'function') throw new TypeError('frameSource must provide subscribe');
  let unsubscribe: (() => void) | null = null;
  let state = createPufferfish((options as PufferfishMountOptions).species);
  let director = options.director === undefined ? null
    : createPufferfishDirector((options as PufferfishMountOptions).director, state.config);
  const renderConfig = resolveRenderOptions((options as PufferfishMountOptions).render);
  const doc = canvas.ownerDocument, win = doc.defaultView;
  if (!win) throw new Error('mountPufferfish requires a browser document');
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motion.matches, paused = options.paused ?? false, hidden = doc.hidden;
  let offscreen = false, zeroSized = true, compact = false, destroyed = false;
  let raf: number | null = null, previous: number | null = null, accumulator = 0, dropped = 0;
  let clockGeneration = 0;
  let frames = 0, coalesced = 0, failure: string | null = null;
  let pendingPointer: PufferfishInput | null = null, pendingAction: PufferfishDirectorInput | null = null;
  let explicitRetreat = false;
  let poster: boolean | null = null, lastRender: PufferfishRenderResult | null = null;
  let posterInvitation: Readonly<{ x: number; y: number }> | null = null;
  let tapOrigin: Readonly<{ x: number; y: number; id: number }> | null = null;
  let painter: PufferfishPainter | undefined;
  const cleanups: Array<() => void> = [];
  const resting = (): boolean => paused || reduced || hidden || offscreen || zeroSized || compact || destroyed;
  const blocked = (): boolean => hidden || offscreen || zeroSized || destroyed;
  function shownDirector(): PufferfishDirectorState | null {
    if (!director) return null;
    const scene = poster === null ? director : pufferfishDirectorPoster(director, poster);
    if (!posterInvitation) return scene;
    const point = posterInvitation;
    return Object.freeze({ ...scene, actors: Object.freeze(scene.actors.map(actor => actor.id === scene.selected
      ? Object.freeze({ ...actor, motive: 'invited' as const, finEffort: 0,
        gaze: Object.freeze({ x: Math.max(-1, Math.min(1, (point.x - actor.x) * 3)),
          y: Math.max(-1, Math.min(1, (point.y - actor.y) * 3)) }) }) : actor)) });
  }
  const shown = (): PufferfishState => {
    const scene = shownDirector();
    return scene ? scene.actors[scene.selected]!.state : poster === null ? state : pufferfishPoster(state, poster);
  };
  function alive(): void { if (destroyed) throw new Error('Pufferfish controller is disposed'); }
  function status(): PufferfishStatus {
    const visibleState = shown(), scene = shownDirector();
    return Object.freeze({ tick: state.tick, phase: visibleState.phase.kind, description: describePufferfish(visibleState),
      userPaused: paused, reducedMotion: reduced, hidden, offscreen, zeroSized, compact, destroyed,
      running: !resting(), queuedFrames: raf === null && unsubscribe === null ? 0 : 1, droppedMilliseconds: dropped,
      renderedFrames: frames, coalescedInputs: coalesced, pendingInputs: Number(pendingPointer !== null) + Number(pendingAction !== null), failure,
      director: scene ? Object.freeze({ scene: scene.config.scene, beat: scene.beat.kind, selected: scene.selected,
        count: scene.config.count, description: describePufferfishDirector(scene),
        actors: Object.freeze(scene.actors.map(actor => Object.freeze({ id: actor.id, name: actor.name, role: actor.role,
          motive: actor.motive, phase: actor.state.phase.kind, threat: actor.threat }))) }) : null });
  }
  function cancel(): void {
    clockGeneration++;
    const release = unsubscribe; unsubscribe = null; release?.();
    if (raf !== null) win!.cancelAnimationFrame(raf);
    raf = null; previous = null; accumulator = 0;
  }
  function destroy(): void {
    if (destroyed) return;
    destroyed = true; cancel(); pendingAction = pendingPointer = null; tapOrigin = posterInvitation = null;
    for (const cleanup of cleanups.splice(0).reverse()) { try { cleanup(); } catch { /* Continue owned-resource cleanup. */ } }
    painter?.dispose(); painter = undefined;
  }
  function fail(error: unknown): void {
    failure = error instanceof Error ? error.message : String(error);
    destroy(); options.onError?.(error);
  }
  function guarded(work: () => void): void {
    if (destroyed) return;
    try { work(); } catch (error) { fail(error); }
  }
  function notify(): void { options.onChange?.(status()); }
  function draw(): void {
    if (destroyed || zeroSized || hidden || offscreen || !painter) return;
    const scene = shownDirector();
    lastRender = scene ? painter.drawScene(scene, resting()) : painter.draw(shown(), resting()); frames++;
  }
  function clearTarget(): void {
    const retainExplicitRetreat = pendingAction?.type === 'retreat' && explicitRetreat;
    pendingPointer = null;
    tapOrigin = null;
    // Clear transient director intent immediately, even if a later deliberate
    // still action clears the pending retreat before playback resumes.
    if (director) director = Object.freeze({ ...director, pointer: null, invitation: null, approach: null });
    // A normalized retreat is consumed on the first resumed tick. No time advances while resting.
    pendingAction = { type: 'retreat' };
    explicitRetreat = retainExplicitRetreat;
  }
  function schedule(): void {
    if (resting() || raf !== null || unsubscribe !== null) return;
    if (options.frameSource) {
      const generation = clockGeneration;
      unsubscribe = () => {}; // Guard a synchronous frame source from reentrant subscription.
      const release = options.frameSource.subscribe(timestamp => { if (!destroyed && generation === clockGeneration) frame(timestamp); });
      if (typeof release !== 'function') throw new TypeError('frameSource.subscribe must return an unsubscribe function');
      if (resting() || generation !== clockGeneration) release(); else unsubscribe = release;
    } else raf = win!.requestAnimationFrame(frame);
  }
  function reconcile(): void {
    cancel(); if (resting()) clearTarget();
    draw(); schedule(); notify();
  }
  function tick(): void {
    if (director) {
      const next = director.tick + 1;
      const inputs = [pendingPointer, pendingAction].filter((v): v is PufferfishDirectorInput => v !== null);
      const events: PufferfishDirectorEvent[] = inputs.map((input, i) => ({ ...input, tick: next, seq: director!.lastSequence + i + 1 }));
      const before = director.actors.map(actor => actor.state.phase.kind);
      const result = stepPufferfishDirector(director, { tick: next, events });
      director = result.state; state = director.actors[director.selected]!.state;
      pendingPointer = pendingAction = null; explicitRetreat = false;
      if (result.beatChanged || next % 15 === 0 || director.actors.some((actor, id) => actor.state.phase.kind !== before[id])) notify();
      return;
    }
    const next = state.tick + 1;
    const inputs = [pendingPointer, pendingAction].filter((v): v is PufferfishInput => v !== null && v.type !== 'invite' && v.type !== 'select');
    const events: PufferfishEvent[] = inputs.map((input, i) => ({ ...input, tick: next, seq: state.lastSequence + i + 1 }));
    const result = stepPufferfish(state, { tick: next, events });
    state = result.state; pendingPointer = pendingAction = null; explicitRetreat = false;
    if (result.transition !== null) notify();
  }
  function frame(timestamp: number): void {
    raf = null;
    guarded(() => {
      if (resting()) { previous = null; return; }
      if (previous !== null) {
        const generation = clockGeneration;
        const elapsed = Math.max(0, timestamp - previous);
        accumulator += elapsed;
        const available = Math.floor((accumulator + 1e-7) / (1000 / 60));
        const ticks = Math.min(available, PUFFERFISH_LIMITS.maxCatchUp);
        for (let i = 0; i < ticks; i++) {
          tick();
          // A synchronous consumer callback may pause, reset, reconfigure, or
          // destroy the controller. That invalidates this frame's entire clock.
          if (resting() || clockGeneration !== generation) return;
        }
        accumulator -= ticks * (1000 / 60);
        if (available > ticks) {
          const skipped = (available - ticks) * (1000 / 60);
          accumulator -= skipped; dropped += skipped;
        }
        if (accumulator < 0) accumulator = 0;
      }
      previous = timestamp; draw(); schedule();
    });
  }
  function resize(): void {
    if (destroyed || !painter) return;
    const rect = canvas.getBoundingClientRect();
    zeroSized = !painter.resize(rect.width, rect.height, win!.devicePixelRatio || 1);
    compact = !zeroSized && (rect.width < 360 || rect.height < 270);
    reconcile();
  }
  function listen(target: EventTarget, type: string, callback: EventListener, passive = true): void {
    const safe: EventListener = event => guarded(() => callback(event));
    target.addEventListener(type, safe, { passive });
    cleanups.push(() => target.removeEventListener(type, safe));
  }
  function action(inflated: boolean): PufferfishActionResult {
    alive();
    posterInvitation = null;
    if (hidden || zeroSized || destroyed) return Object.freeze({ kind: 'suspended', phase: shown().phase.kind });
    if (paused || reduced || compact || offscreen) {
      poster = inflated; pendingPointer = pendingAction = null; guarded(() => { draw(); notify(); });
      return Object.freeze({ kind: 'static-poster', phase: shown().phase.kind });
    }
    if (pendingAction) coalesced++;
    // Within a coalesced director tick, giving space wins even if another
    // introduction arrives later. There is still only one bounded action slot.
    if (!director || pendingAction?.type !== 'retreat' || !explicitRetreat || !inflated)
      pendingAction = { type: inflated ? 'approach' : 'retreat' };
    if (!inflated) explicitRetreat = true;
    return Object.freeze({ kind: 'queued', phase: state.phase.kind });
  }
  const controller: PufferfishController = {
    configure(patch) { alive();
      const base = director ? createPufferfish(director.speciesConfig) : state;
      const next = configurePufferfish(base, patch);
      const nextDirector = director ? createPufferfishDirector(director.config, next.config) : null;
      director = nextDirector; state = nextDirector?.actors[0]!.state ?? next; poster = null; posterInvitation = null;
      pendingPointer = pendingAction = null; guarded(reconcile); },
    configureRender(patch) {
      alive(); record(patch, ['view', 'quality', 'monochrome', 'maxDpr', 'mode'], 'render patch');
      const next = resolveRenderOptions({ ...painter!.getConfig(), ...patch });
      guarded(() => { painter!.configure(next); reconcile(); });
    },
    configureDirector(patch) {
      alive(); const next = director ? configurePufferfishDirector(director, patch) : createPufferfishDirector(patch, state.config);
      director = next; state = next.actors[0]!.state; poster = null; posterInvitation = null;
      pendingPointer = pendingAction = null; guarded(reconcile);
    },
    selectActor(id) {
      alive(); if (!director) throw new Error('Enable director before selecting an actor');
      director = selectPufferfishActor(director, id); state = director.actors[id]!.state; posterInvitation = null;
      guarded(() => { draw(); notify(); });
    },
    invite(x = 0, y = -0.25) {
      alive(); if (!director) throw new Error('Enable director before inviting an actor');
      finite(x, -1, 1, 'invite x'); finite(y, -1, 1, 'invite y');
      if (hidden || zeroSized || destroyed) return Object.freeze({ kind: 'suspended', phase: shown().phase.kind });
      if (paused || reduced || compact || offscreen) {
        poster = false; posterInvitation = { x, y }; pendingPointer = pendingAction = null;
        guarded(() => { draw(); notify(); });
        return Object.freeze({ kind: 'static-poster', phase: shown().phase.kind });
      }
      if (pendingAction) coalesced++;
      if (pendingAction?.type !== 'retreat' || !explicitRetreat) pendingAction = { type: 'invite', x, y };
      pendingPointer = null;
      return Object.freeze({ kind: 'queued', phase: state.phase.kind });
    },
    setPaused(value) { alive(); if (typeof value !== 'boolean') throw new TypeError('paused must be boolean');
      paused = value; if (!value && !reduced) { poster = null; posterInvitation = null; } guarded(reconcile); },
    reset(seed) { alive();
      if (director) { const next = resetPufferfishDirector(director, seed); director = next; state = next.actors[0]!.state; }
      else state = resetPufferfish(state, seed);
      poster = null; posterInvitation = null;
      pendingPointer = pendingAction = null; guarded(reconcile); },
    approach: () => action(true), retreat: () => action(false),
    getSnapshot: () => state, getDirectorSnapshot: () => director, getStatus: status,
    exportText() { alive(); return lastRender?.text ?? ''; }, destroy,
  };
  try {
    painter = createPainter(canvas, renderConfig);
    listen(canvas, 'pointermove', event => {
      const pointer = event as PointerEvent;
      if (resting() || pointer.pointerType === 'touch') return;
      const next = normalizePufferfishPointer(pointer.clientX, pointer.clientY, canvas.getBoundingClientRect());
      if (!next) { clearTarget(); return; }
      if (pendingPointer) coalesced++;
      pendingPointer = next;
    });
    listen(canvas, 'pointerdown', event => {
      if (!director || blocked()) return;
      const pointer = event as PointerEvent;
      if (pointer.button !== 0 || pointer.isPrimary === false) return;
      tapOrigin = { x: pointer.clientX, y: pointer.clientY, id: pointer.pointerId };
    });
    listen(canvas, 'pointerup', event => {
      const origin = tapOrigin; tapOrigin = null;
      if (!director || !origin || blocked()) return;
      const pointer = event as PointerEvent;
      if (pointer.pointerId !== origin.id || Math.hypot(pointer.clientX - origin.x, pointer.clientY - origin.y) > 12) return;
      const point = normalizePufferfishPointer(pointer.clientX, pointer.clientY, canvas.getBoundingClientRect());
      if (point?.type !== 'pointer') return;
      const id = painter!.hitActor(point.x, point.y);
      if (id === null) controller.invite(point.x, point.y); else controller.selectActor(id);
    });
    listen(canvas, 'keydown', event => {
      if (!director) return;
      const key = event as KeyboardEvent;
      if (key.repeat || key.altKey || key.ctrlKey || key.metaKey) return;
      if (/^[123]$/.test(key.key)) {
        const id = Number(key.key) - 1; if (id < director.config.count) controller.selectActor(id); else return;
      } else switch (key.key.toLowerCase()) {
        case 'i': controller.invite(); break;
        case 'a': controller.approach(); break;
        case 'escape': controller.retreat(); break;
        case ' ': controller.setPaused(!paused); break;
        case 'r': controller.reset(); break;
        default: return;
      }
      key.preventDefault();
    }, false);
    for (const type of ['pointerleave', 'pointercancel', 'lostpointercapture']) listen(canvas, type, clearTarget);
    listen(win, 'blur', clearTarget);
    listen(win, 'resize', resize);
    listen(doc, 'visibilitychange', () => { hidden = doc.hidden; reconcile(); });
    listen(motion, 'change', () => { reduced = motion.matches; poster = reduced ? false : null; posterInvitation = null; reconcile(); });
    const ro = new win.ResizeObserver(() => guarded(resize));
    cleanups.push(() => ro.disconnect()); ro.observe(canvas);
    const io = new win.IntersectionObserver(entries => guarded(() => {
      const entry = entries.find(item => item.target === canvas);
      if (entry) { offscreen = !entry.isIntersecting; reconcile(); }
    }));
    cleanups.push(() => io.disconnect()); io.observe(canvas);
    // Promise has no cancellation API; callback checks disposal before touching resources.
    if (doc.fonts) void doc.fonts.ready.then(() => guarded(resize), error => { if (!destroyed) fail(error); });
    resize();
    if (destroyed) throw new Error(failure ?? 'Pufferfish setup failed');
  } catch (error) { destroy(); throw error; }
  return controller;
}
