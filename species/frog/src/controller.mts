import { clearFrogTarget, createFrog, normalizeFrogPointer, ownKeys, previewFrogTarget, resetFrog, stampFrogAction, stepFrog, validateTarget } from './frog.mjs';
import { createLegacyFrogPreview, validatePreview } from './legacy-preview.mjs';
import { createFrogPond, previewPondTarget, resetFrogPond, selectPondFrog, setPondRole, stepFrogPond } from './pond.mjs';
import type { FrogPondAction, FrogPondInput, FrogPondState, FrogDirectorOptions, FrogRole } from './pond-types.mjs';
import type { FrogConfigPatch, FrogController, FrogControllerStatus, FrogInput, FrogMountOptions, FrogPreviewOptions, GeometryOptions, StaticPose, Vec2 } from './types.mjs';

/** Browser-only host; imports and the pure models remain safe without DOM globals. */
export function mountFrog(canvas: HTMLCanvasElement, options: FrogMountOptions = {}): FrogController {
  ownKeys(options, ['seed', 'config', 'director', 'paused', 'preview', 'onAction', 'onPondChange', 'previewFactory', 'frameSource'], 'mount');
  for (const key of ['onAction', 'onPondChange', 'previewFactory'] as const) if (options[key] !== undefined && typeof options[key] !== 'function') throw new TypeError(`${key} must be a function`);
  if (options.frameSource !== undefined && (!options.frameSource || typeof options.frameSource.subscribe !== 'function')) throw new TypeError('frameSource must provide subscribe');
  validatePreview(options.preview);
  if (options.paused !== undefined && typeof options.paused !== 'boolean') throw new TypeError('paused must be boolean');
  const doc = canvas.ownerDocument, win = doc.defaultView;
  if (!win) throw new Error('Frog canvas must have a browsing context');
  const modelOptions = { ...(options.seed === undefined ? {} : { seed: options.seed }), ...(options.config === undefined ? {} : { config: options.config }) };
  let state = createFrog(modelOptions);
  let pond: FrogPondState | null = options.director === undefined ? null : createFrogPond({ ...modelOptions, director: options.director });
  let publishedPond: FrogPondState | null = null;
  let pendingResize: readonly [number, number, number] | null = null;
  let paused = options.paused ?? false, disposed = false, offscreen = false, zeroSize = true, undersized = false;
  let unsubscribe: (() => void) | null = null;
  let raf: number | null = null, lastTime: number | null = null, lastRenderTime: number | null = null, remainder = 0, nextSeq = 0;
  let pendingTarget: Vec2 | null | undefined, pendingLeap = false, pendingPondAction: FrogPondAction | null = null;
  let coalescedInputs = 0, droppedMilliseconds = 0, renderFps = options.preview?.renderFps ?? 20;
  let staticPose: StaticPose = 'rest', poseSelected = false, pondStill: GeometryOptions['pondStill'];
  let gesture: { id: number; x: number; y: number } | null = null;
  const media = win.matchMedia('(prefers-reduced-motion: reduce)');
  const preview = (options.previewFactory ?? createLegacyFrogPreview)(canvas, options.preview ?? {});
  const cleanup: (() => void)[] = [];
  const stepMs = 1000 / 60;
  let resizeObserver: ResizeObserver | undefined, intersectionObserver: IntersectionObserver | undefined;
  const alive = (): void => { if (disposed) throw new Error('Frog controller disposed'); };
  const visible = (): boolean => !disposed && !doc.hidden && !offscreen && !zeroSize;
  const running = (): boolean => visible() && !undersized && !paused && !media.matches;
  const currentState = () => pond ? pond.actors.find(actor => actor.id === pond!.selectedId)!.model : state;
  function requirePond(): FrogPondState { alive(); if (!pond) throw new Error('Enable the frog director before using pond controls'); return pond; }
  function requirePondPreview(): void {
    if (!preview.drawPond || !preview.pondTargetAt || !preview.pickPondFrog) throw new TypeError('Pond preview must implement drawPond, pondTargetAt and pickPondFrog');
  }
  function cancel(): void {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; } else if (raf !== null) win!.cancelAnimationFrame(raf);
    raf = null; lastTime = null; lastRenderTime = null; remainder = 0;
  }
  function clearPending(): void { pendingTarget = undefined; pendingLeap = false; pendingPondAction = null; gesture = null; }
  function dispose(): void {
    if (disposed) return; disposed = true; cancel(); clearPending();
    resizeObserver?.disconnect(); intersectionObserver?.disconnect();
    for (const remove of cleanup.splice(0)) remove();
    preview.dispose();
  }
  function announce(message: string): void { if (disposed) return; try { options.onAction?.(message); } catch (error) { dispose(); throw error; } }
  function draw(): void {
    // State observers drive controls outside the canvas and must not depend on
    // whether the canvas intersects the viewport. Rendering still remains gated.
    if (pond && publishedPond !== pond) {
      publishedPond = pond;
      try { options.onPondChange?.(pond); } catch (error) { dispose(); throw error; }
    }
    // IntersectionObserver delivery can lag a viewport resize. A requested
    // draw may reconcile that stale flag, but never starts offscreen frames.
    if (offscreen && !doc.hidden && !zeroSize) {
      const bounds = canvas.getBoundingClientRect();
      if ([bounds.top, bounds.bottom, bounds.left, bounds.right, win!.innerWidth, win!.innerHeight].every(Number.isFinite)
        && bounds.bottom > 0 && bounds.right > 0 && bounds.top < win!.innerHeight && bounds.left < win!.innerWidth) offscreen = false;
    }
    if (!visible()) return;
    // Pause retains the exact current pose. Explicit stills never advance any actor.
    const geometry: GeometryOptions = { motion: !media.matches && !undersized && !poseSelected && !pondStill,
      ...(media.matches || undersized || poseSelected || pondStill ? { staticPose } : {}), ...(pondStill ? { pondStill } : {}) };
    try {
      if (pendingResize) { preview.resize(...pendingResize); pendingResize = null; }
      if (pond) {
        preview.drawPond!(pond, geometry);
      } else preview.draw(state, geometry);
    } catch (error) { dispose(); throw error; }
  }
  function schedule(): void {
    if (running() && raf === null) {
      if (options.frameSource) { raf = 0; try { unsubscribe = options.frameSource.subscribe(frame); } catch (error) { raf = null; throw error; } }
      else raf = win!.requestAnimationFrame(frame);
    }
  }
  function suspendTransient(): void {
    clearPending();
    // An explicit paused expression owns its target as part of the still image.
    if (pond) { if (!paused && !pondStill) pond = previewPondTarget(pond, null); }
    else state = clearFrogTarget(state);
  }
  function reconcile(): void { if (disposed) return; cancel(); suspendTransient(); draw(); schedule(); }
  function frame(now: number): void {
    if (!options.frameSource) raf = null;
    if (!running()) { lastTime = null; remainder = 0; return; }
    try {
      if (!Number.isFinite(now)) throw new TypeError('Invalid browser frame timestamp');
      if (lastTime !== null) {
        const elapsed = Math.max(0, now - lastTime), cap = stepMs * 5;
        const accepted = Math.min(elapsed, cap); droppedMilliseconds += elapsed - accepted; remainder += accepted;
        let steps = 0;
        while (remainder + 1e-7 >= stepMs && steps < 5) {
          if (pond) {
            const events: FrogPondInput[] = [], tick = pond.tick + 1;
            if (pendingTarget !== undefined) events.push({ ...(pendingTarget === null ? { type: 'leave' as const } : { type: 'target' as const, ...pendingTarget }), tick, seq: nextSeq++ });
            if (pendingPondAction) events.push({ ...pendingPondAction, tick, seq: nextSeq++ });
            const result = stepFrogPond(pond, tick, events); pond = result.state;
            // Only deliberate input produces live announcements; autonomous cards are quiet.
            if (pendingPondAction) for (const notice of result.notices) announce(notice);
          } else {
            const events: FrogInput[] = [], tick = state.tick + 1;
            if (pendingTarget !== undefined) events.push(stampFrogAction(pendingTarget === null ? { type: 'leave' } : { type: 'target', ...pendingTarget }, tick, nextSeq++));
            if (pendingLeap) events.push(stampFrogAction({ type: 'leap' }, tick, nextSeq++));
            state = stepFrog(state, tick, events).state;
          }
          pendingTarget = undefined; pendingLeap = false; pendingPondAction = null;
          remainder = Math.max(0, remainder - stepMs); steps++;
          if (!running()) return; // A deliberate-action callback may pause/dispose.
        }
      }
      lastTime = now;
      if (!pond || lastRenderTime === null || now - lastRenderTime + 1e-7 >= 1000 / renderFps) { draw(); lastRenderTime = now; }
      schedule();
    } catch (error) { dispose(); throw error; }
  }
  function target(point: Vec2): void {
    alive(); const valid = validateTarget(point);
    if (!visible()) return;
    if (running()) { if (pendingTarget !== undefined) coalescedInputs++; pendingTarget = valid; }
    else { if (pond) pond = previewPondTarget(pond, valid); else state = previewFrogTarget(state, valid); draw(); }
  }
  function queuePond(action: FrogPondAction, still: GeometryOptions['pondStill']): void {
    requirePond();
    if (media.matches || undersized || (paused && still)) {
      clearPending(); pondStill = still; staticPose = 'rest';
      if (action.type === 'hunt' || action.type === 'ripple') pond = previewPondTarget(pond!, { x: action.x, y: action.y });
      draw(); announce(`Static ${still ?? 'rest'} study. Motion stays off.`);
    } else if (!visible()) return;
    else if (paused) announce('Paused. Resume the pond to direct an action, or choose a static pose.');
    else { if (pendingPondAction) coalescedInputs++; pendingPondAction = action; pondStill = undefined; }
  }
  function leap(): void {
    alive();
    if (media.matches || undersized) {
      clearPending(); pondStill = undefined;
      const poses: readonly StaticPose[] = ['rest', 'crouch', 'airborne', 'landed'];
      staticPose = poses[(poses.indexOf(staticPose) + 1) % poses.length]!;
      draw(); announce(`Static ${staticPose} pose. Motion stays off.`);
    } else if (!visible()) return;
    else if (paused) announce('Paused. Resume to leap, or choose a static pose.');
    else if (pond) {
      const aimed = pendingTarget === undefined ? pond : previewPondTarget(pond, pendingTarget);
      const actor = aimed.actors.find(item => item.id === aimed.selectedId)!;
      if (aimed.target && aimed.previewPad === null) { announce('That lily pad is occupied, reserved, or out of reach. Aim at a free pad.'); return; }
      const candidate = aimed.previewPad ?? aimed.pads.filter(pad => !aimed.actors.some(other => other.padId === pad.id || other.reservedPad === pad.id)
          && Math.hypot(pad.point.x - actor.model.position.x, pad.point.y - actor.model.position.y) <= actor.model.config.maxDistance + 1e-10)
        .sort((a, b) => Math.hypot(a.point.x - actor.model.position.x, a.point.y - actor.model.position.y) - Math.hypot(b.point.x - actor.model.position.x, b.point.y - actor.model.position.y))[0]?.id;
      if (candidate === undefined) { announce('There is no free lily pad within reach. Let the pond settle or adjust the leap distance.'); return; }
      queuePond({ type: 'hop', frogId: actor.id, padId: candidate }, undefined);
    } else {
      if (pendingLeap) coalescedInputs++; pendingLeap = true;
      announce(state.behavior.kind === 'idle' || state.behavior.kind === 'interest' ? 'Leap requested toward the landing marker.' : 'Frog is completing its landing and cooldown.');
    }
  }
  function call(): void { const current = requirePond(); queuePond({ type: 'call', frogId: current.selectedId }, 'call'); }
  function actionPoint(point?: Vec2): Vec2 {
    const current = requirePond();
    return validateTarget(point === undefined ? pendingTarget ?? current.target ?? { x: .2, y: -.15 } : point);
  }
  function hunt(point?: Vec2): void { const current = requirePond(), p = actionPoint(point); queuePond({ type: 'hunt', frogId: current.selectedId, ...p }, 'hunt'); }
  function ripple(point?: Vec2): void { const p = actionPoint(point); queuePond({ type: 'ripple', ...p }, 'ripple'); }
  function selectFrog(id: number): void { pond = selectPondFrog(requirePond(), id); pendingTarget = undefined; draw(); announce(`${pond.actors.find(actor => actor.id === id)!.name} selected.`); }
  function setRole(id: number, role: FrogRole): void { pond = setPondRole(requirePond(), id, role); draw(); announce(`${pond.actors.find(actor => actor.id === id)!.name} is now the ${role}. Active landings stay committed.`); }
  function clearTarget(): void {
    alive(); gesture = null; pendingLeap = false;
    if (pendingPondAction?.type === 'hop') pendingPondAction = null;
    if (running()) pendingTarget = null;
    else { pendingTarget = undefined; if (pond) pond = previewPondTarget(pond, null); else state = clearFrogTarget(state); draw(); }
  }
  function resize(): void {
    if (disposed) return;
    const r = canvas.getBoundingClientRect(), wasSuspended = zeroSize || undersized;
    zeroSize = ![r.width, r.height].every(Number.isFinite) || r.width <= 0 || r.height <= 0;
    undersized = !zeroSize && (r.width < 320 || r.height < 240);
    if (zeroSize) { cancel(); suspendTransient(); canvas.width = canvas.height = 1; return; }
    try {
      if (wasSuspended && !undersized && !media.matches && !paused && !poseSelected) pondStill = undefined;
      // Canvas dimension writes erase its bitmap. Defer them while offscreen,
      // then resize and redraw atomically when visibility returns.
      pendingResize = [r.width, r.height, Number.isFinite(win!.devicePixelRatio) && win!.devicePixelRatio > 0 ? win!.devicePixelRatio : 1];
      if (undersized || wasSuspended) { cancel(); suspendTransient(); }
      draw(); schedule();
    } catch (error) { dispose(); throw error; }
  }
  function listen(eventTarget: EventTarget, name: string, handler: EventListener, eventOptions?: AddEventListenerOptions): void {
    eventTarget.addEventListener(name, handler, eventOptions); cleanup.push(() => eventTarget.removeEventListener(name, handler, eventOptions));
  }
  function pointerPoint(event: PointerEvent): Vec2 | null { return normalizeFrogPointer(event.clientX, event.clientY, canvas.getBoundingClientRect()); }
  function pointerTarget(event: PointerEvent): Vec2 | null { const p = pointerPoint(event); return p ? pond ? preview.pondTargetAt!(p) : preview.targetAt(p) : null; }
  function reset(resetOptions: Readonly<{ seed?: number }> = {}): void {
    alive(); if (pond) pond = resetFrogPond(pond, resetOptions); else state = resetFrog(state, resetOptions);
    nextSeq = 0; staticPose = 'rest'; poseSelected = false; pondStill = undefined;
    droppedMilliseconds = 0; coalescedInputs = 0; reconcile(); announce('Frog reset. Playback preference preserved.');
  }
  try {
    if (pond) requirePondPreview();
    listen(canvas, 'pointermove', ((event: PointerEvent) => {
      if (disposed) return;
      if (gesture && gesture.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 12) gesture = null;
      if (!running() || event.pointerType === 'touch') return;
      const p = pointerTarget(event); if (p) target(p);
    }) as EventListener, { passive: true });
    listen(canvas, 'pointerdown', ((event: PointerEvent) => {
      if (!visible() || !event.isPrimary || event.button !== 0) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }) as EventListener, { passive: true });
    listen(canvas, 'pointerup', ((event: PointerEvent) => {
      if (disposed) return;
      const start = gesture; gesture = null;
      if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;
      const p = pointerTarget(event); if (!p) return;
      if (!pond) { target(p); leap(); return; }
      const canvasPoint = pointerPoint(event)!, picked = preview.pickPondFrog!(canvasPoint);
      if (picked !== null) { selectFrog(picked); return; }
      const pad = pond.pads.find(item => Math.hypot(p.x - item.point.x, p.y - item.point.y) <= .22);
      if (pad) { target(pad.point); leap(); } else ripple(p);
    }) as EventListener, { passive: true });
    for (const name of ['pointerleave', 'pointercancel', 'lostpointercapture']) listen(canvas, name, (() => { if (!disposed) clearTarget(); }) as EventListener, { passive: true });
    listen(canvas, 'keydown', ((event: KeyboardEvent) => {
      if (disposed || event.target !== canvas || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key.startsWith('Arrow')) {
        const direction: Record<string, readonly [number, number]> = { ArrowLeft: [-.12, 0], ArrowRight: [.12, 0], ArrowUp: [0, -.12], ArrowDown: [0, .12] };
        const d = direction[event.key]; if (!d) return;
        event.preventDefault(); const p = pendingTarget ?? pond?.target ?? currentState().target ?? currentState().position;
        target({ x: Math.max(-1, Math.min(1, p.x + d[0])), y: Math.max(-1, Math.min(1, p.y + d[1])) });
      } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) leap(); }
      else if (event.key === 'Escape') { event.preventDefault(); clearTarget(); }
      else if (pond && /^[123]$/.test(event.key)) { event.preventDefault(); const id = Number(event.key) - 1; if (!event.repeat && id < pond.actors.length) selectFrog(id); }
      else if (pond && ['c', 'h', 'r'].includes(event.key.toLowerCase())) {
        event.preventDefault(); if (event.repeat) return;
        if (event.key.toLowerCase() === 'c') call(); else if (event.key.toLowerCase() === 'h') hunt(); else ripple();
      }
    }) as EventListener);
    listen(doc, 'visibilitychange', reconcile);
    listen(media, 'change', (() => { if (disposed) return; if (!poseSelected) staticPose = 'rest'; pondStill = undefined; reconcile(); announce(media.matches ? 'Reduced motion: static poses only.' : 'Motion preference updated.'); }) as EventListener);
    listen(win, 'resize', resize, { passive: true });
    const env = win as Window & { ResizeObserver: typeof ResizeObserver; IntersectionObserver?: typeof IntersectionObserver };
    resizeObserver = new env.ResizeObserver(resize); resizeObserver.observe(canvas);
    if (env.IntersectionObserver) {
      intersectionObserver = new env.IntersectionObserver(entries => {
        if (disposed) return;
        const entry = entries.find(x => x.target === canvas); if (!entry || offscreen === !entry.isIntersecting) return;
        offscreen = !entry.isIntersecting; reconcile();
      });
      intersectionObserver.observe(canvas);
    }
    resize();
  } catch (error) { dispose(); throw error; }
  return Object.freeze({
    getState() { alive(); return currentState(); },
    getPondState() { alive(); return pond; },
    getStatus(): FrogControllerStatus { const current = currentState(); return Object.freeze({ tick: current.tick, phase: current.behavior.kind, paused, reducedMotion: media.matches,
      hidden: Boolean(doc.hidden), offscreen, zeroSize, undersized, disposed, scheduled: raf !== null,
      pendingInputs: Number(pendingTarget !== undefined) + Number(pendingLeap || pendingPondAction !== null), coalescedInputs, droppedMilliseconds, staticPose }); },
    target, leap, call, hunt, ripple, selectFrog, setRole, clearTarget, reset,
    setPaused(value: boolean): void {
      alive(); if (typeof value !== 'boolean') throw new TypeError('paused must be boolean');
      paused = value; if (!value) { poseSelected = false; pondStill = undefined; }
      cancel(); clearPending(); draw(); schedule();
      announce(paused ? 'Paused.' : media.matches ? 'Static poses: reduced motion is active.' : 'Playing.');
    },
    setStaticPose(value: StaticPose): void {
      alive(); if (!['rest', 'crouch', 'airborne', 'landed'].includes(value)) throw new TypeError('Unknown static pose');
      paused = true; staticPose = value; poseSelected = true; pondStill = undefined; cancel(); suspendTransient(); draw();
      announce(`Static ${value} pose. Playback paused.`);
    },
    updateConfig(patch: FrogConfigPatch): void {
      alive(); if (pond) pond = resetFrogPond(pond, { config: patch }); else state = resetFrog(state, { config: patch });
      nextSeq = 0; staticPose = 'rest'; poseSelected = false; pondStill = undefined; reconcile();
      announce('Frog configuration updated and reset. Playback preference preserved.');
    },
    updateDirector(patch: FrogDirectorOptions): void {
      alive(); const replacement = pond ? resetFrogPond(pond, { director: patch }) : createFrogPond({ seed: state.seed, config: state.config, director: patch });
      requirePondPreview(); pond = replacement; nextSeq = 0; staticPose = 'rest'; poseSelected = false; pondStill = undefined; reconcile();
      announce('Pond direction updated and reset. Playback preference preserved.');
    },
    updatePreview(patch: FrogPreviewOptions): void { alive(); preview.update(patch); if (patch.renderFps !== undefined) renderFps = patch.renderFps; draw(); },
    exportText(): string { alive(); return preview.toText(); },
    dispose,
  });
}
