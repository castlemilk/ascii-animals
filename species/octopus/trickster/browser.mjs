import { getBrowserScheduler } from '../../../src/core/scheduler.js';
import { createOctopusState, stepOctopus, sampleOctopus, TICK_RATE } from './core.mjs';
import { renderOctopus } from './render.mjs';

// This is the isolated study's adapter. It does not replace or extend the
// package's createArtwork API. All environment work belongs to this module.
const DEFAULTS = Object.freeze({ seed: 17, paused: false, autoStart: true,
  reducedMotion: 'system', observeVisibility: true, maxDpr: 2 });
const EVENT_LIMIT = 64;
const MAX_STEPS = 5;
const MAX_PIXELS = 8_294_400;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const boolKeys = ['paused', 'autoStart', 'observeVisibility'];

function validateOptions(input, previous = DEFAULTS) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Octopus options must be an object.');
  const next = { ...previous };
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(DEFAULTS, key)) throw new TypeError(`Unknown octopus option: ${key}`);
    next[key] = input[key];
  }
  for (const key of boolKeys) if (typeof next[key] !== 'boolean') throw new TypeError(`${key} must be a boolean.`);
  if (!Number.isInteger(next.seed) || next.seed < 0 || next.seed > 0xffffffff) throw new RangeError('seed must be an unsigned 32-bit integer.');
  if (!['system', 'ignore'].includes(next.reducedMotion)) throw new TypeError('reducedMotion must be system or ignore.');
  if (!Number.isFinite(next.maxDpr) || next.maxDpr < .5 || next.maxDpr > 2) throw new RangeError('maxDpr must be between 0.5 and 2.');
  return next;
}

function point(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('An invitation requires finite numeric x and y.');
  return { x: clamp(x, -.9, .9), y: clamp(y, -.65, .7) };
}

function distanceToSegment(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const u = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / Math.max(1e-12, dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - a[0] - u * dx, y - a[1] - u * dy);
}

export function createOctopusTrickster(canvas, input = {}) {
  let options = validateOptions(input);
  const doc = canvas?.ownerDocument, view = doc?.defaultView;
  if (!view || typeof canvas?.getContext !== 'function' || typeof canvas?.getBoundingClientRect !== 'function') {
    throw new TypeError('The octopus study needs a canvas attached to a browser document.');
  }
  if (!canvas.getContext('2d')) throw new Error('Canvas 2D is unavailable.');
  let state = createOctopusState(options.seed);
  const scheduler = getBrowserScheduler(view);
  const media = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  let userPaused = options.paused;
  // A preference change latches a still, even if the preference later switches
  // back. Only an explicit Play call clears it; resize/options/restart cannot.
  let motionHeld = options.reducedMotion === 'system' && Boolean(media?.matches);
  let hidden = Boolean(doc.hidden), offscreen = false, zeroSize = true, destroyed = false;
  let width = 0, height = 0, dpr = 1, unsubscribe = null;
  let resizeObserver = null, intersectionObserver = null;
  let previousTimestamp = null, accumulator = 0, manualAccumulator = 0;
  let droppedSeconds = 0, discardedEvents = 0, renderCount = 0, stepCount = 0;
  let lastRenderMs = 0, renderStats = {}, pendingEvents = [];
  let aim = { x: .7, y: .33 }, lastInvitation = null, pointerInside = false;
  const cleanups = [];
  const isPaused = () => userPaused || motionHeld;
  const blocked = () => destroyed || isPaused() || hidden || offscreen || zeroSize;

  function listen(target, type, handler, eventOptions) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, eventOptions);
    cleanups.push(() => target.removeEventListener(type, handler, eventOptions));
  }

  function resetClock() { previousTimestamp = null; accumulator = 0; manualAccumulator = 0; }

  function syncScheduling() {
    const shouldRun = options.autoStart && !blocked();
    if (!shouldRun && unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (!shouldRun) resetClock();
    else if (!unsubscribe) { resetClock(); unsubscribe = scheduler.subscribe(frame); }
  }

  function draw() {
    if (destroyed || zeroSize) return;
    const before = view.performance?.now?.() ?? 0;
    try { renderStats = renderOctopus(canvas, state, { width, height, dpr }) || {}; }
    catch (error) { destroy(); throw error; }
    lastRenderMs = Math.max(0, (view.performance?.now?.() ?? before) - before);
    renderCount++;
  }

  function resize() {
    if (destroyed) return;
    const r = canvas.getBoundingClientRect();
    width = Number.isFinite(r.width) ? clamp(r.width, 0, 4096) : 0;
    height = Number.isFinite(r.height) ? clamp(r.height, 0, 4096) : 0;
    zeroSize = width <= 0 || height <= 0;
    if (!zeroSize) {
      const deviceDpr = Number.isFinite(view.devicePixelRatio) ? view.devicePixelRatio : 1;
      dpr = Math.max(.1, Math.min(options.maxDpr, Math.max(.5, deviceDpr), Math.sqrt(MAX_PIXELS / (width * height))));
      const backingWidth = Math.max(1, Math.floor(width * dpr));
      const backingHeight = Math.max(1, Math.floor(height * dpr));
      if (canvas.width !== backingWidth) canvas.width = backingWidth;
      if (canvas.height !== backingHeight) canvas.height = backingHeight;
      draw();
    }
    syncScheduling();
  }

  function enqueue(event, coalesce = false) {
    if (blocked()) return false;
    const previous = pendingEvents.at(-1);
    if (coalesce && previous?.type === event.type) {
      pendingEvents[pendingEvents.length - 1] = event;
      discardedEvents++;
      return true;
    }
    if (pendingEvents.length >= EVENT_LIMIT) {
      // A pending move carries no discrete gesture. Sacrifice it to admit an
      // explicit action; never grow the queue or reorder retained actions.
      const move = pendingEvents.findIndex(item => item.type === 'move');
      if (move >= 0) { pendingEvents.splice(move, 1); discardedEvents++; }
      else { discardedEvents++; return false; }
    }
    pendingEvents.push(event);
    return true;
  }

  function tick() {
    const events = pendingEvents;
    pendingEvents = [];
    stepOctopus(state, events);
    stepCount++;
  }

  function frame(timestamp) {
    if (blocked() || !options.autoStart) { syncScheduling(); return; }
    if (!Number.isFinite(timestamp)) return;
    if (previousTimestamp === null) { previousTimestamp = timestamp; return; }
    const elapsed = Math.max(0, (timestamp - previousTimestamp) / 1000);
    previousTimestamp = timestamp;
    const total = accumulator + elapsed;
    const available = Math.floor(total * TICK_RATE + 1e-7);
    const steps = Math.min(MAX_STEPS, available);
    accumulator = Math.max(0, total - available / TICK_RATE);
    droppedSeconds += Math.max(0, available - steps) / TICK_RATE;
    for (let i = 0; i < steps; i++) tick();
    if (steps) draw();
  }

  function invite(x = aim.x, y = aim.y) {
    const target = point(x, y);
    if (destroyed) return false;
    aim = target;
    const accepted = enqueue({ type: 'invite', ...target });
    if (accepted) lastInvitation = target;
    return accepted;
  }

  function release() {
    if (destroyed) return false;
    pointerInside = false; lastInvitation = null;
    return enqueue({ type: 'release' });
  }

  function pulse(x = aim.x, y = aim.y) {
    const target = point(x, y);
    if (destroyed) return false;
    aim = target;
    return enqueue({ type: 'startle', ...target });
  }

  function eventPoint(event) {
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
    const r = canvas.getBoundingClientRect();
    if (!Number.isFinite(r.width) || !Number.isFinite(r.height) || r.width <= 0 || r.height <= 0) return null;
    const scale = Math.min(r.width * .44, r.height * .48);
    return point((event.clientX - r.left - r.width * .5) / scale,
      (event.clientY - r.top - r.height * .49) / scale);
  }

  function animalHit(x, y) {
    if (typeof renderStats.hitTest === 'function') return renderStats.hitTest(x, y);
    const pose = sampleOctopus(state), body = pose.body;
    const dx = x - body.x, dy = y - body.y;
    const ct = Math.cos(body.tilt || 0), st = Math.sin(body.tilt || 0);
    const xx = (dx * ct + dy * st) / (body.scaleX || 1);
    const yy = (-dx * st + dy * ct) / (body.scaleY || 1);
    if ((xx / .42) ** 2 + ((yy + .22) / .39) ** 2 <= 1) return true;
    for (const arm of pose.arms) for (let i = 1; i < arm.points.length; i++) {
      if (distanceToSegment(x, y, arm.points[i - 1], arm.points[i]) <= (arm.radius || .055)) return true;
    }
    return false;
  }

  function setPaused(paused) {
    if (typeof paused !== 'boolean') throw new TypeError('paused must be a boolean.');
    if (destroyed) return;
    userPaused = paused;
    if (!paused) motionHeld = false; // Explicit Play, including reduced-motion opt-in.
    pendingEvents = [];
    syncScheduling();
  }

  function restart() {
    if (destroyed) return;
    state = createOctopusState(options.seed);
    pendingEvents = []; aim = { x: .7, y: .33 }; lastInvitation = null; pointerInside = false;
    droppedSeconds = 0; discardedEvents = 0; stepCount = 0;
    resetClock(); draw(); syncScheduling();
  }

  function advance(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 5) throw new RangeError('advance requires finite seconds in [0, 5].');
    if (blocked()) return;
    manualAccumulator += seconds;
    const steps = Math.floor(manualAccumulator * TICK_RATE + 1e-7);
    manualAccumulator = Math.max(0, manualAccumulator - steps / TICK_RATE);
    for (let i = 0; i < steps; i++) tick();
    draw();
  }

  function setOptions(patch) {
    const next = validateOptions(patch, options);
    // Validate before mutation, including after disposal. Invalid calls cannot
    // leave a partially changed controller.
    if (destroyed) return;
    const old = options;
    options = next;
    if (Object.hasOwn(patch, 'paused')) userPaused = next.paused;
    if (old.reducedMotion !== 'system' && next.reducedMotion === 'system' && media?.matches) motionHeld = true;
    if (old.observeVisibility !== next.observeVisibility) {
      intersectionObserver?.disconnect(); intersectionObserver = null; offscreen = false;
      observeIntersection();
    }
    if (old.seed !== next.seed) restart();
    else resize();
    syncScheduling();
  }

  function observeIntersection() {
    if (options.observeVisibility && typeof view.IntersectionObserver === 'function') {
      intersectionObserver = new view.IntersectionObserver(entries => {
        if (destroyed) return;
        const entry = entries.find(item => item.target === canvas);
        if (!entry) return;
        offscreen = !entry.isIntersecting;
        if (offscreen) { pendingEvents = []; pointerInside = false; }
        syncScheduling();
      }, { threshold: 0 });
      intersectionObserver.observe(canvas);
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    unsubscribe?.(); unsubscribe = null; resetClock(); pendingEvents = [];
    resizeObserver?.disconnect(); intersectionObserver?.disconnect();
    resizeObserver = intersectionObserver = null;
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    renderStats = {}; lastInvitation = null;
  }

  function getStats() {
    const { grid, hitTest, ...safeRenderStats } = renderStats;
    const pose = sampleOctopus(state);
    return { ...safeRenderStats, tick: state.tick, stage: pose.stage,
      pose, paused: isPaused(), running: Boolean(unsubscribe),
      destroyed, queuedEvents: pendingEvents.length, discardedEvents, droppedSeconds,
      renderCount, stepCount, lastRenderMs, width, height, dpr,
      pauseReasons: { user: userPaused, reducedMotion: motionHeld, hidden, offscreen,
        zeroSize, manual: !options.autoStart, destroyed } };
  }

  try {
    listen(canvas, 'pointermove', event => {
      if (blocked()) return;
      const next = eventPoint(event); if (!next) return;
      aim = next;
      const stage = sampleOctopus(state).stage;
      const moved = !pointerInside || !lastInvitation || Math.hypot(next.x - lastInvitation.x, next.y - lastInvitation.y) > .08;
      pointerInside = true;
      if (event.pointerType !== 'touch' && ['idle', 'rest'].includes(stage) && moved) {
        if (enqueue({ type: 'invite', ...next }, true)) lastInvitation = next;
      } else enqueue({ type: 'move', ...next }, true);
    }, { passive: true });
    listen(canvas, 'pointerdown', event => {
      if (blocked() || event.button > 0) return;
      const next = eventPoint(event); if (!next) return;
      aim = next; pointerInside = true;
      if (animalHit(next.x, next.y)) pulse(next.x, next.y);
      else invite(next.x, next.y);
    }, { passive: true });
    listen(canvas, 'pointerleave', release);
    listen(canvas, 'pointercancel', release);
    listen(canvas, 'lostpointercapture', release);
    listen(canvas, 'keydown', event => {
      if (event.target !== canvas || event.altKey || event.ctrlKey || event.metaKey) return;
      const arrows = { ArrowLeft: [-.06, 0], ArrowRight: [.06, 0], ArrowUp: [0, -.06], ArrowDown: [0, .06] };
      const arrow = arrows[event.key];
      const action = event.key === 'Enter' ? () => invite() : event.key?.toLowerCase() === 'j' ? () => pulse()
        : event.key === 'Escape' ? release : event.key === ' ' ? () => setPaused(!isPaused()) : null;
      if (!arrow && !action) return;
      event.preventDefault();
      if (event.repeat && !arrow) return;
      if (arrow) {
        if (blocked()) return;
        aim = point(aim.x + arrow[0], aim.y + arrow[1]);
        enqueue({ type: 'move', ...aim }, true);
      } else action();
    });
    listen(doc, 'visibilitychange', () => {
      if (destroyed) return;
      hidden = Boolean(doc.hidden);
      if (hidden) { pendingEvents = []; pointerInside = false; }
      syncScheduling();
    });
    listen(media, 'change', () => {
      if (destroyed || options.reducedMotion !== 'system') return;
      if (media.matches) { motionHeld = true; pendingEvents = []; }
      syncScheduling();
    });
    listen(view, 'resize', resize);
    listen(view, 'pagehide', event => { if (!event.persisted) destroy(); });
    if (typeof view.ResizeObserver === 'function') {
      resizeObserver = new view.ResizeObserver(resize); resizeObserver.observe(canvas);
    }
    observeIntersection(); resize();
  } catch (error) { destroy(); throw error; }

  return Object.freeze({ canvas, get paused() { return isPaused(); }, invite, release, pulse,
    setPaused, restart, advance, render: draw, setOptions, getStats, destroy, dispose: destroy });
}
