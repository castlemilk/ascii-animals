import { createOwl, makeOwlPoster, normalizeOwlPointer } from './owl.js';
import { renderOwlGrid } from './preview.js';
const STEP_MS = 1000 / 60;
const MAX_STEPS = 5;
const MIN_WIDTH = 350;
const MIN_HEIGHT = 330;
const DEFAULT_DESCRIPTION = 'A round-faced owl perched on a branch, with two forward-facing eyes, folded wings and planted feet.';
const optionKeys = new Set(['owl', 'grid', 'paused', 'frameSource', 'onStatus', 'environment']);
function object(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError(`${name} must be an object.`);
}
function normalized(value, name) {
    if (!Number.isFinite(value))
        throw new RangeError(`${name} must be finite.`);
    return Math.max(-1, Math.min(1, value));
}
function validateBrowserGrid(value) {
    object(value, 'Grid options');
    if (value.cellAspect !== undefined && value.cellAspect !== 0.55) {
        throw new RangeError('The DOM preview supports cellAspect 0.55 only; other ratios are pure-sampler proposals.');
    }
}
/**
 * Owl-only DOM-text preview. This is a local integration proposal, not a package
 * renderer. It owns its element/listeners/subscription and never a shared clock.
 * Missing matchMedia/RAF yields a useful static preview. Observer fallbacks use
 * window resize/scroll plus measurements on explicit actions.
 */
export function mountOwl(host, options = {}) {
    if (!host || typeof host.appendChild !== 'function' || typeof host.getBoundingClientRect !== 'function' || !host.ownerDocument) {
        throw new TypeError('mountOwl requires an HTMLElement with an explicit display size.');
    }
    object(options, 'Browser options');
    for (const key of Object.keys(options))
        if (!optionKeys.has(key))
            throw new TypeError(`Unknown browser option: ${key}`);
    if (options.paused !== undefined && typeof options.paused !== 'boolean')
        throw new TypeError('paused must be boolean.');
    if (options.onStatus !== undefined && typeof options.onStatus !== 'function')
        throw new TypeError('onStatus must be a function.');
    if (options.frameSource !== undefined && (!options.frameSource || typeof options.frameSource.subscribe !== 'function')) {
        throw new TypeError('frameSource must provide subscribe(callback).');
    }
    if (options.environment !== undefined)
        object(options.environment, 'Environment');
    if (options.grid !== undefined)
        validateBrowserGrid(options.grid);
    const env = options.environment ?? {};
    const doc = env.document ?? host.ownerDocument;
    const view = doc.defaultView;
    const browser = view;
    const requestFrame = env.requestFrame === undefined ? view?.requestAnimationFrame?.bind(view) : env.requestFrame;
    const cancelFrame = env.cancelFrame === undefined ? view?.cancelAnimationFrame?.bind(view) : env.cancelFrame;
    const matchMedia = env.matchMedia === undefined ? view?.matchMedia?.bind(view) : env.matchMedia;
    const Resize = env.ResizeObserver === undefined ? browser?.ResizeObserver : env.ResizeObserver;
    const Intersect = env.IntersectionObserver === undefined ? browser?.IntersectionObserver : env.IntersectionObserver;
    for (const [name, fn] of Object.entries({ requestFrame, cancelFrame, matchMedia, ResizeObserver: Resize, IntersectionObserver: Intersect })) {
        if (fn !== undefined && fn !== null && typeof fn !== 'function')
            throw new TypeError(`${name} must be a function or null.`);
    }
    if (!doc || typeof doc.createElement !== 'function' || typeof doc.addEventListener !== 'function')
        throw new TypeError('A browser Document is required.');
    const media = matchMedia?.('(prefers-reduced-motion: reduce)');
    const motionKnown = Boolean(media);
    const animationAvailable = Boolean(options.frameSource || (requestFrame && cancelFrame));
    const owl = createOwl(options.owl);
    let state = owl.getState();
    let displayed = state;
    let gridOptions = options.grid === undefined ? undefined : { ...options.grid };
    // Validate all logical options before acquiring browser resources.
    let grid = renderOwlGrid(state, gridOptions ?? { cols: 96, rows: 54 });
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
    let blockedBy = [];
    let poster = { kind: 'rest' };
    let displayedPoster = 'rest';
    let raf = null;
    let unsubscribe = null;
    let previousTime = null;
    let accumulator = 0, droppedMs = 0, frames = 0;
    let clearTargetOnStep = false;
    let actionOrder = 0;
    let targetAction = null;
    let reactOrder = null;
    let resizeObserver = null;
    let intersectionObserver = null;
    let statusSignature = '';
    const removers = [];
    const capabilities = Object.freeze({ resizeObserver: Boolean(Resize), intersectionObserver: Boolean(Intersect), motionPreference: motionKnown });
    const assertAlive = () => { if (disposed)
        throw new Error('The owl preview has been disposed.'); };
    function getStatus() {
        return Object.freeze({ paused, running, disposed, reducedMotion: reduced,
            blockedBy: Object.freeze([...blockedBy]), tick: state.tick, behavior: state.behavior,
            displayedPoster, queuedInputs: Number(targetAction !== null) + Number(reactOrder !== null),
            droppedMs, frames, cols: grid.cols, rows: grid.rows, capabilities });
    }
    function publish() {
        if (disposed)
            return;
        const signature = JSON.stringify([paused, running, reduced, blockedBy, displayedPoster,
            state.behavior.kind, state.behavior.kind === 'response' ? state.behavior.phase : '', grid.cols, grid.rows]);
        if (signature === statusSignature)
            return;
        statusSignature = signature;
        try {
            options.onStatus?.(getStatus());
        }
        catch (error) {
            release();
            throw error;
        }
    }
    function listen(target, type, callback, settings) {
        target.addEventListener(type, callback, settings);
        removers.push(() => target.removeEventListener(type, callback, settings));
    }
    function clearPending() {
        targetAction = null;
        reactOrder = null;
        actionOrder = 0;
        clearTargetOnStep = true;
    }
    function stop() {
        running = false;
        if (raf !== null) {
            cancelFrame?.(raf);
            raf = null;
        }
        if (unsubscribe) {
            const remove = unsubscribe;
            unsubscribe = null;
            remove();
        }
        previousTime = null;
        accumulator = 0;
        clearPending();
    }
    function release() {
        if (disposed)
            return;
        disposed = true;
        stop();
        for (const remove of removers.splice(0).reverse())
            remove();
        resizeObserver?.disconnect();
        intersectionObserver?.disconnect();
        resizeObserver = null;
        intersectionObserver = null;
        shell.remove();
        owl.dispose();
        blockedBy = ['disposed'];
    }
    function chosenGrid() {
        return gridOptions ?? (width < 550 || height < 440 ? { cols: 64, rows: 36 } : { cols: 96, rows: 54 });
    }
    function draw(next) {
        if (disposed)
            return;
        displayed = running || poster === null ? state : makeOwlPoster(state, poster);
        displayedPoster = running ? null : poster?.kind ?? 'frozen';
        grid = next ?? renderOwlGrid(displayed, chosenGrid());
        pre.textContent = grid.text;
        pre.style.fontSize = `${Math.max(0, Math.min(width / (grid.cols * 0.6), height / (grid.rows * 1.1)))}px`;
        pre.setAttribute('aria-label', `${DEFAULT_DESCRIPTION}${displayedPoster === 'react' ? ' Static wing-stretch pose.' : displayedPoster === 'attention' ? ' Static attentive pose.' : ''}`);
        frames++;
    }
    function measure() {
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
    function collectBlockers() {
        const next = [];
        if (paused)
            next.push('paused');
        if (reduced)
            next.push('reduced-motion');
        if (doc.hidden)
            next.push('hidden');
        if (!intersecting)
            next.push('offscreen');
        if (!width || !height)
            next.push('zero-size');
        else if (width < MIN_WIDTH || height < MIN_HEIGHT)
            next.push('small-container');
        if (!animationAvailable)
            next.push('animation-unavailable');
        if (!motionKnown)
            next.push('motion-preference-unavailable');
        return next;
    }
    function start() {
        running = true;
        previousTime = null;
        accumulator = 0;
        if (options.frameSource) {
            const remove = options.frameSource.subscribe(onFrame);
            if (typeof remove !== 'function')
                throw new TypeError('frameSource.subscribe must return an unsubscribe function.');
            if (disposed || !running)
                remove();
            else
                unsubscribe = remove;
        }
        else {
            raf = requestFrame(onFrame);
        }
    }
    function reconcile(redraw = false) {
        if (disposed)
            return;
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
        }
        else if (!running && shouldRun) {
            start();
        }
        if (redraw || changedPolicy || oldWidth !== width || oldHeight !== height)
            draw();
        publish();
    }
    function eventsFor(tick) {
        const actions = [];
        if (targetAction)
            actions.push(targetAction);
        else if (clearTargetOnStep)
            actions.push({ type: 'leave', order: -1 });
        if (reactOrder !== null)
            actions.push({ type: 'react', order: reactOrder });
        actions.sort((a, b) => a.order - b.order);
        const events = actions.map((action, index) => action.type === 'attention'
            ? { type: 'attention', x: action.x, y: action.y, tick, seq: state.lastSequence + 1 + index }
            : { type: action.type, tick, seq: state.lastSequence + 1 + index });
        targetAction = null;
        reactOrder = null;
        actionOrder = 0;
        clearTargetOnStep = false;
        return events;
    }
    function onFrame(timestamp) {
        if (disposed || !running)
            return;
        if (!options.frameSource)
            raf = null;
        try {
            // Visibility/preference can change before their queued native events.
            if (Boolean(doc.hidden) || Boolean(media?.matches)) {
                reconcile(true);
                return;
            }
            if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > Number.MAX_SAFE_INTEGER) {
                throw new RangeError('Frame timestamp must be finite, nonnegative and within the safe numeric range.');
            }
            // A buggy external clock cannot rewind our presentation baseline.
            if (previousTime !== null && timestamp < previousTime) {
                if (running && !options.frameSource)
                    raf = requestFrame(onFrame);
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
                    state = owl.advance(tick, i === 0 ? eventsFor(tick) : []).state;
                    accumulator = Math.max(0, accumulator - STEP_MS);
                }
                if (steps) {
                    draw();
                    publish();
                }
            }
            previousTime = timestamp;
            if (running && !options.frameSource)
                raf = requestFrame(onFrame);
        }
        catch (error) {
            release();
            throw error;
        }
    }
    function queueTarget(action) {
        targetAction = { ...action, order: actionOrder++ };
    }
    function pointer(event) {
        if (disposed || !running)
            return;
        reconcile();
        if (!running)
            return;
        const e = event;
        const point = normalizeOwlPointer(e.clientX, e.clientY, host.getBoundingClientRect());
        if (point)
            queueTarget({ type: 'attention', ...point });
    }
    function pointerLeave() {
        if (disposed)
            return;
        targetAction = null;
        clearTargetOnStep = true;
        if (running)
            queueTarget({ type: 'leave' });
    }
    try {
        host.appendChild(shell);
        listen(host, 'pointermove', pointer, { passive: true });
        for (const event of ['pointerleave', 'pointercancel', 'lostpointercapture'])
            listen(host, event, pointerLeave, { passive: true });
        listen(doc, 'visibilitychange', () => reconcile(true));
        if (media?.addEventListener)
            listen(media, 'change', () => reconcile(true));
        else if (media?.addListener) {
            const legacyChange = () => reconcile(true);
            media.addListener(legacyChange);
            removers.push(() => media.removeListener(legacyChange));
        }
        if (Resize) {
            resizeObserver = new Resize(() => reconcile(true));
            resizeObserver.observe(host);
        }
        if (Intersect) {
            intersectionObserver = new Intersect(entries => {
                if (disposed)
                    return;
                for (const entry of entries)
                    if (entry.target === host)
                        intersecting = entry.isIntersecting && entry.intersectionRatio > 0;
                reconcile(true);
            }, { threshold: [0, 0.01] });
            intersectionObserver.observe(host);
        }
        if (view && (!Resize || !Intersect)) {
            listen(view, 'resize', () => reconcile(true), { passive: true });
            if (!Intersect)
                listen(view, 'scroll', () => reconcile(), { passive: true, capture: true });
        }
        reconcile(true);
    }
    catch (error) {
        release();
        throw error;
    }
    return Object.freeze({
        setPaused(value) {
            assertAlive();
            if (typeof value !== 'boolean')
                throw new TypeError('paused must be boolean.');
            paused = value;
            reconcile(true);
        },
        react() {
            assertAlive();
            reconcile();
            assertAlive();
            if (running) {
                if (reactOrder === null)
                    reactOrder = actionOrder++;
                return Object.freeze({ kind: 'queued' });
            }
            poster = { kind: 'react' };
            draw();
            publish();
            return Object.freeze({ kind: 'poster', poster: 'react' });
        },
        guide(x, y) {
            assertAlive();
            x = normalized(x, 'Guide x');
            y = normalized(y, 'Guide y');
            reconcile();
            assertAlive();
            if (running) {
                queueTarget({ type: 'attention', x, y });
                return Object.freeze({ kind: 'queued' });
            }
            poster = { kind: 'attention', x, y };
            draw();
            publish();
            return Object.freeze({ kind: 'poster', poster: 'attention' });
        },
        leave() {
            assertAlive();
            reconcile();
            assertAlive();
            pointerLeave();
            if (!running) {
                poster = { kind: 'rest' };
                draw();
            }
            publish();
        },
        reset(seed) {
            assertAlive();
            // The core validates first; invalid resets leave all host state untouched.
            const next = owl.reset(seed);
            state = next;
            clearPending();
            clearTargetOnStep = false;
            previousTime = null;
            accumulator = 0;
            droppedMs = 0;
            poster = { kind: 'rest' };
            reconcile(true);
        },
        update(patch) {
            assertAlive();
            owl.update(patch);
            state = owl.getState();
            reconcile(true);
        },
        setGrid(patch) {
            assertAlive();
            validateBrowserGrid(patch);
            const next = { ...patch };
            // Sampling validates atomically before replacing the effective grid.
            const candidate = renderOwlGrid(displayed, next);
            gridOptions = next;
            draw(candidate);
            publish();
        },
        getStatus,
        getSnapshot() { assertAlive(); return Object.freeze({ simulation: state, displayed, grid }); },
        exportText() { assertAlive(); return grid.text; },
        dispose() { release(); },
    });
}
