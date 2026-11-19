/** Gecko host: solo compatibility and opt-in choreography share one lifecycle. */
import { createGecko, normalizeGuide } from './gecko.js';
import { drawGeckoGrid, renderGeckoGrid, geckoPointFromCanvas } from './preview.js';
import { createGeckoDirector, geckoDirectorPoster } from './director.js';
import { renderGeckoDirectorGrid } from './director-preview.js';
const DEFAULT_VIEW = Object.freeze({ grid: 'auto', neutral: false, maxDpr: 2 });
const TICK_MS = 1000 / 60;
const MAX_CATCH_UP = 5;
const MAX_WIDTH = 1000;
const MAX_HEIGHT = 780;
const MIN_WIDTH = 360;
function record(value, keys, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
        throw new TypeError(`${label} must be a plain object`);
    }
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || !keys.includes(key))
            throw new TypeError(`Unknown ${label} key: ${String(key)}`);
    }
}
function boolean(value, label) {
    if (typeof value !== 'boolean')
        throw new TypeError(`${label} must be boolean`);
}
function viewOptions(patch, previous) {
    record(patch, ['grid', 'neutral', 'maxDpr'], 'view');
    const next = { ...previous, ...patch };
    boolean(next.neutral, 'neutral');
    if (!Number.isFinite(next.maxDpr) || next.maxDpr < 1 || next.maxDpr > 2)
        throw new RangeError('maxDpr must be finite and within [1,2]');
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
export function mountGecko(canvas, options = {}) {
    record(options, ['config', 'paused', 'view', 'onStatus', 'frameSource', 'director'], 'mount options');
    if (options.paused !== undefined)
        boolean(options.paused, 'paused');
    if (options.onStatus !== undefined && typeof options.onStatus !== 'function')
        throw new TypeError('onStatus must be a function');
    if (options.frameSource !== undefined && (!options.frameSource || typeof options.frameSource.subscribe !== 'function'))
        throw new TypeError('frameSource must implement subscribe');
    let view = viewOptions(options.view === undefined ? {} : options.view, DEFAULT_VIEW);
    const document = canvas.ownerDocument;
    const host = document?.defaultView;
    if (!host)
        throw new TypeError('A connected browser document is required');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context)
        throw new Error('Canvas 2D is unavailable; the static text alternative remains available.');
    if (options.director !== undefined && options.config !== undefined) {
        record(options.config, ['seed', 'heading', 'options'], 'director animal config');
    }
    const director = options.director === undefined ? null : createGeckoDirector({
        ...(options.config?.seed === undefined ? {} : { seed: options.config.seed }),
        ...(options.config?.heading === undefined ? {} : { heading: options.config.heading }),
        ...(options.config?.options === undefined ? {} : { animal: options.config.options }), options: options.director
    });
    const model = director ? null : createGecko(options.config);
    let sceneSnapshot = director?.getSnapshot() ?? null;
    let snapshot = sceneSnapshot?.individuals[0].body ?? model.getSnapshot();
    let paused = options.paused ?? false;
    let disposed = false;
    const motion = host.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motion.matches;
    let hidden = document.hidden;
    let pageSuspended = false;
    let offscreen = false;
    let zeroSize = false;
    let tooSmall = false;
    let poster = 'current';
    let frame = null;
    let releaseFrame = null;
    let subscribed = false;
    let lastTime = null;
    let accumulator = 0;
    let droppedMilliseconds = 0;
    let renderedFrames = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let cssWidth = 0;
    let pendingGuide = null;
    let pendingStartle = false;
    let pendingCue = null;
    let stillCue = null;
    let clearOnResume = false;
    let lastGrid = null;
    const cleanup = [];
    const running = () => !disposed && !paused && !reducedMotion && !hidden && !pageSuspended && !offscreen && !zeroSize && !tooSmall;
    const ensure = () => { if (disposed)
        throw new Error('Gecko controller is disposed'); };
    function getStatus() {
        return {
            tick: snapshot.tick, phase: snapshot.behavior.kind, paused, reducedMotion, hidden, pageSuspended, offscreen, zeroSize, tooSmall,
            director: sceneSnapshot ? { scene: sceneSnapshot.options.scene, beat: sceneSnapshot.arc.beat, population: sceneSnapshot.individuals.length, selectedId: sceneSnapshot.selectedId } : null,
            directorPoster: stillCue?.type ?? 'none',
            disposed, running: running(), poster, pendingInputs: Number(pendingGuide !== null) + Number(pendingStartle) + Number(pendingCue !== null),
            queuedFrames: Number(frame !== null || subscribed), renderedFrames, droppedMilliseconds,
            dimensions: { width, height, dpr }
        };
    }
    function dispose() {
        if (disposed)
            return;
        disposed = true;
        stopFrame();
        pendingGuide = null;
        pendingStartle = false;
        pendingCue = null;
        stillCue = null;
        clearOnResume = false;
        lastTime = null;
        accumulator = 0;
        for (const release of cleanup.splice(0).reverse())
            release();
        model?.dispose();
        director?.dispose();
        lastGrid = null;
        canvas.width = 0;
        canvas.height = 0;
    }
    function notify() {
        try {
            options.onStatus?.(getStatus());
        }
        catch (error) {
            dispose();
            throw error;
        }
    }
    function suspend() {
        stopFrame();
        lastTime = null;
        accumulator = 0;
        pendingGuide = null;
        pendingStartle = false;
        pendingCue = null;
        clearOnResume = director ? sceneSnapshot.pointer !== null : snapshot.target !== null;
    }
    function stopFrame() {
        if (frame !== null)
            host.cancelAnimationFrame(frame);
        frame = null;
        const release = releaseFrame;
        releaseFrame = null;
        subscribed = false;
        release?.();
    }
    function schedule() {
        if (!running() || frame !== null || subscribed)
            return;
        if (!options.frameSource) {
            frame = host.requestAnimationFrame(tick);
            return;
        }
        subscribed = true;
        try {
            const release = options.frameSource.subscribe(tick);
            if (typeof release !== 'function')
                throw new TypeError('frameSource must return an unsubscribe function');
            if (!subscribed || !running()) {
                subscribed = false;
                release();
            }
            else
                releaseFrame = release;
        }
        catch (error) {
            subscribed = false;
            throw error;
        }
    }
    function reconcile() {
        if (!running())
            suspend();
        else
            schedule();
    }
    function posterState() {
        return poster === 'curled'
            ? { ...snapshot, tailCurl: snapshot.options.curlStrength,
                behavior: { kind: 'startle', since: snapshot.tick, heading: snapshot.heading } }
            : snapshot;
    }
    function grid() {
        if (sceneSnapshot) {
            const close = cssWidth < 640 || sceneSnapshot.individuals.length === 1;
            const dimensions = view.grid === 'auto' ? close ? { cols: 112, rows: 72 } : { cols: 224, rows: 112 } : view.grid;
            const state = stillCue ? geckoDirectorPoster(sceneSnapshot, stillCue) : sceneSnapshot;
            return renderGeckoDirectorGrid(state, { ...dimensions, neutral: view.neutral,
                focus: close ? state.selectedId ?? state.individuals[0].id : null });
        }
        const dimensions = view.grid === 'auto'
            ? cssWidth < 560 ? { cols: 112, rows: 50 } : { cols: 176, rows: 78 }
            : view.grid;
        return renderGeckoGrid(posterState(), { ...dimensions, neutral: view.neutral });
    }
    function draw() {
        if (disposed || zeroSize || tooSmall || hidden || pageSuspended || offscreen || !width || !height)
            return;
        lastGrid = grid();
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawGeckoGrid(context, lastGrid, width, height);
        renderedFrames++;
    }
    function resize() {
        if (disposed)
            return;
        const rect = canvas.getBoundingClientRect();
        zeroSize = !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0;
        tooSmall = !zeroSize && rect.width < (director ? 320 : MIN_WIDTH);
        cssWidth = zeroSize ? 0 : rect.width;
        if (zeroSize || tooSmall) {
            width = 0;
            height = 0;
            canvas.width = 0;
            canvas.height = 0;
            lastGrid = null;
        }
        else {
            const scale = Math.min(1, MAX_WIDTH / rect.width, MAX_HEIGHT / rect.height);
            width = Math.max(1, Math.floor(rect.width * scale));
            height = Math.max(1, Math.floor(rect.height * scale));
            const deviceDpr = host.devicePixelRatio;
            dpr = Math.max(1, Math.min(view.maxDpr, Number.isFinite(deviceDpr) ? deviceDpr : 1));
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            draw();
        }
        reconcile();
        notify();
    }
    function advanceOne() {
        if (director) {
            const events = [];
            let sequence = sceneSnapshot.lastSequence;
            const nextTick = sceneSnapshot.tick + 1;
            if (clearOnResume)
                events.push({ type: 'leave', tick: nextTick, seq: ++sequence });
            if (pendingGuide)
                events.push({ ...pendingGuide, tick: nextTick, seq: ++sequence });
            if (pendingCue)
                events.push({ ...pendingCue, tick: nextTick, seq: ++sequence });
            const signature = sceneSignature(sceneSnapshot);
            pendingGuide = null;
            pendingCue = null;
            pendingStartle = false;
            clearOnResume = false;
            sceneSnapshot = director.step(events).state;
            snapshot = sceneSnapshot.individuals[0].body;
            if (sceneSignature(sceneSnapshot) !== signature)
                notify();
            return;
        }
        const events = [];
        let sequence = snapshot.lastSequence;
        const nextTick = snapshot.tick + 1;
        if (clearOnResume)
            events.push({ type: 'leave', tick: nextTick, seq: ++sequence });
        if (pendingGuide)
            events.push({ ...pendingGuide, tick: nextTick, seq: ++sequence });
        if (pendingStartle)
            events.push({ type: 'startle', tick: nextTick, seq: ++sequence });
        pendingGuide = null;
        pendingStartle = false;
        clearOnResume = false;
        const phase = snapshot.behavior.kind;
        snapshot = model.step(events).state;
        if (snapshot.behavior.kind !== phase)
            notify();
    }
    function tick(timestamp) {
        frame = null;
        if (!running())
            return;
        try {
            if (lastTime === null)
                lastTime = timestamp;
            const elapsed = Math.max(0, timestamp - lastTime);
            lastTime = timestamp;
            const accepted = Math.min(elapsed, TICK_MS * MAX_CATCH_UP);
            droppedMilliseconds += elapsed - accepted;
            accumulator += accepted;
            let steps = 0;
            // A status callback may synchronously pause, hide, freeze, or dispose the host.
            while (running() && accumulator + 1e-8 >= TICK_MS && steps < MAX_CATCH_UP) {
                advanceOne();
                accumulator = Math.max(0, accumulator - TICK_MS);
                steps++;
            }
            if (accumulator >= TICK_MS) {
                const dropped = Math.floor(accumulator / TICK_MS) * TICK_MS;
                accumulator -= dropped;
                droppedMilliseconds += dropped;
            }
            const desiredDpr = Math.max(1, Math.min(view.maxDpr, host.devicePixelRatio || 1));
            if (desiredDpr !== dpr)
                resize();
            else if (steps)
                draw();
            schedule();
        }
        catch (error) {
            dispose();
            throw error;
        }
    }
    function listen(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        cleanup.push(() => target.removeEventListener(type, handler, options));
    }
    function sceneSignature(state) {
        return [state.options.scene, state.arc.beat, Math.floor(state.arc.progress * 20), state.selectedId,
            ...state.individuals.map(a => `${a.id}:${a.role}:${a.motive}:${a.emotion}:${a.body.behavior.kind}:${Math.ceil(a.cooldown / 60)}:${a.catches}`)].join('|');
    }
    function cueOwner(x, y) {
        const state = sceneSnapshot;
        if (state.selectedId !== null)
            return state.selectedId;
        const point = { x: x * 3.3, y: y * 2.2 };
        const distance = (a) => Math.hypot(a.body.position.x * a.scale - point.x, a.body.position.y * a.scale - point.y);
        return state.individuals.reduce((best, a) => distance(a) < distance(best) ? a : best, state.individuals[0]).id;
    }
    function direct(cue) {
        ensure();
        if (!director)
            throw new Error('Mount with director options to direct a wall');
        record(cue, ['type', 'id', 'x', 'y'], 'director cue');
        if (!['moth', 'shadow', 'return', 'inspect'].includes(cue.type))
            throw new TypeError('Unknown director cue');
        if ('x' in cue || 'y' in cue)
            for (const value of [cue.x, cue.y]) {
                if (typeof value !== 'number' || !Number.isFinite(value))
                    throw new TypeError('Cue requires two finite normalized coordinates');
                if (value < -1 || value > 1)
                    throw new RangeError('Cue coordinates must be in [-1,1]');
            }
        if ('id' in cue && !sceneSnapshot.individuals.some(a => a.id === cue.id))
            throw new RangeError('Cue target is not in the cast');
        const id = cue.id ?? cueOwner(cue.x ?? 0, cue.y ?? 0), actor = sceneSnapshot.individuals.find(a => a.id === id);
        const captured = { type: cue.type, id, ...('x' in cue ? { x: cue.x, y: cue.y } : {}) };
        if (!running()) {
            stillCue = captured;
            poster = cue.type === 'shadow' ? 'curled' : 'current';
            draw();
            notify();
            return { outcome: 'static' };
        }
        if (cue.type === 'shadow' && (actor.cooldown > 0 || !['idle', 'approach'].includes(actor.body.behavior.kind)))
            return { outcome: 'ignored', reason: 'busy' };
        pendingCue = captured;
        stillCue = null;
        return { outcome: 'queued' };
    }
    function guide(x, y) {
        ensure();
        if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y))
            throw new TypeError('Guide coordinates must be finite numbers');
        if (!running())
            return { outcome: 'ignored', reason: 'resting' };
        const px = Math.max(-1, Math.min(1, x)), py = Math.max(-1, Math.min(1, y));
        pendingGuide = { type: 'guide', x: px, y: py, ...(director ? { id: cueOwner(px, py) } : {}) };
        return { outcome: 'queued' };
    }
    function clearGuide() {
        ensure();
        pendingGuide = running() ? { type: 'leave' } : null;
        if (!running())
            clearOnResume = director ? sceneSnapshot.pointer !== null : snapshot.target !== null;
    }
    function startle() {
        ensure();
        if (director) {
            const result = direct({ type: 'shadow' });
            return result.outcome === 'ignored' ? { outcome: 'ignored', reason: 'resting' } : result;
        }
        if (!running()) {
            poster = 'curled';
            draw();
            notify();
            return { outcome: 'static' };
        }
        pendingStartle = true;
        return { outcome: 'queued' };
    }
    function setPaused(value) {
        ensure();
        boolean(value, 'paused');
        paused = value;
        if (!paused && !reducedMotion) {
            poster = 'current';
            stillCue = null;
        }
        reconcile();
        draw();
        notify();
    }
    function onPointer(event) {
        if (disposed || !running())
            return;
        if (event.type === 'pointermove' && event.pointerType === 'touch' && event.buttons === 0)
            return;
        const rect = canvas.getBoundingClientRect();
        if (director) {
            const currentGrid = lastGrid ?? grid(), point = geckoPointFromCanvas(currentGrid, width, height, event.clientX, event.clientY, rect);
            if (point)
                guide(point.x / 3.3, point.y / 2.2);
            return;
        }
        const point = normalizeGuide(event.clientX, event.clientY, rect);
        if (point)
            guide(point.x, point.y);
    }
    function onDeparture() { if (!disposed)
        clearGuide(); }
    function onKey(event) {
        if (disposed || event.target !== canvas || event.altKey || event.ctrlKey || event.metaKey)
            return;
        const points = {
            ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
        };
        const point = points[event.key];
        if (point) {
            event.preventDefault();
            guide(...point);
        }
        else if (event.code === 'Space' || event.key === ' ') {
            event.preventDefault();
            setPaused(!paused);
        }
        else if (event.key === 'Escape') {
            event.preventDefault();
            clearGuide();
        }
        else if (director && event.key.toLowerCase() === 'm' && !event.repeat) {
            event.preventDefault();
            direct({ type: 'moth' });
        }
        else if (director && event.key.toLowerCase() === 'c' && !event.repeat) {
            event.preventDefault();
            const state = sceneSnapshot, actor = state.individuals.find(a => a.id === state.selectedId) ?? state.individuals[0];
            if (state.options.scene !== 'moonlit-wall')
                controller.configureDirector({ scene: 'moonlit-wall' });
            direct({ type: 'inspect', id: actor.id, x: Math.max(-1, Math.min(1, actor.body.position.x * actor.scale / 3.3)),
                y: Math.max(-1, Math.min(1, (actor.body.position.y * actor.scale - .55) / 2.2)) });
        }
    }
    const controller = {
        getSnapshot() { ensure(); return director ? director.getSnapshot().individuals[0].body : model.getSnapshot(); },
        getDirectorSnapshot() { ensure(); return director?.getSnapshot() ?? null; },
        configureDirector(patch) {
            ensure();
            if (!director)
                throw new Error('Mount with director options to configure a wall');
            const result = director.update(patch);
            sceneSnapshot = director.getSnapshot();
            snapshot = sceneSnapshot.individuals[0].body;
            pendingGuide = null;
            pendingCue = null;
            stillCue = null;
            draw();
            notify();
            return result;
        },
        selectGecko(id) {
            ensure();
            if (!director)
                throw new Error('Mount with director options to select an individual');
            director.select(id);
            sceneSnapshot = director.getSnapshot();
            stillCue = null;
            draw();
            notify();
        },
        direct,
        exportScene() { ensure(); return director?.exportRecipe() ?? null; },
        getStatus,
        update(patch) {
            ensure();
            const resolved = director ? director.updateAnimal(patch) : model.update(patch);
            sceneSnapshot = director?.getSnapshot() ?? null;
            snapshot = sceneSnapshot?.individuals[0].body ?? model.getSnapshot();
            draw();
            notify();
            return resolved;
        },
        setView(patch) { ensure(); view = viewOptions(patch, view); resize(); return view; },
        setPaused, guide, clearGuide, startle,
        reset(settings = {}) {
            ensure();
            if (director) {
                sceneSnapshot = director.reset(settings);
                snapshot = sceneSnapshot.individuals[0].body;
            }
            else
                snapshot = model.reset(settings);
            poster = 'current';
            stillCue = null;
            pendingCue = null;
            pendingGuide = null;
            pendingStartle = false;
            clearOnResume = false;
            accumulator = 0;
            lastTime = null;
            draw();
            reconcile();
            notify();
        },
        exportText() { ensure(); return grid().text; },
        redraw() { ensure(); resize(); },
        dispose
    };
    try {
        listen(canvas, 'pointermove', onPointer, { passive: true });
        listen(canvas, 'pointerdown', onPointer, { passive: true });
        for (const type of ['pointerleave', 'pointercancel', 'lostpointercapture'])
            listen(canvas, type, onDeparture, { passive: true });
        listen(canvas, 'keydown', onKey);
        listen(document, 'visibilitychange', () => {
            if (disposed)
                return;
            hidden = document.hidden;
            reconcile();
            if (!hidden)
                draw();
            notify();
        });
        listen(motion, 'change', () => {
            if (disposed)
                return;
            reducedMotion = motion.matches;
            if (!reducedMotion) {
                poster = 'current';
                stillCue = null;
            }
            reconcile();
            draw();
            notify();
        });
        listen(host, 'resize', resize);
        listen(host, 'pagehide', (event) => {
            if (disposed)
                return;
            if (!event.persisted) {
                dispose();
                return;
            }
            // bfcache retains this document and its listeners. Freeze it without
            // changing the user's pause setting; visibility events need not arrive first.
            pageSuspended = true;
            reconcile();
            notify();
        });
        listen(host, 'pageshow', () => {
            if (disposed)
                return;
            pageSuspended = false;
            hidden = document.hidden;
            lastTime = null;
            accumulator = 0;
            resize();
        });
        if (host.ResizeObserver) {
            const observer = new host.ResizeObserver(resize);
            cleanup.push(() => observer.disconnect());
            observer.observe(canvas);
        }
        if (host.IntersectionObserver) {
            const observer = new host.IntersectionObserver(entries => {
                if (disposed)
                    return;
                const entry = entries.find(item => item.target === canvas);
                if (!entry)
                    return;
                offscreen = !entry.isIntersecting;
                reconcile();
                if (!offscreen)
                    draw();
                notify();
            });
            cleanup.push(() => observer.disconnect());
            observer.observe(canvas);
        }
        resize();
        return controller;
    }
    catch (error) {
        dispose();
        throw error;
    }
}
