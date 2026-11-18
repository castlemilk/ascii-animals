/** Browser ownership for the local Dragonfly specimen; no shared scheduler or package API is assumed. */
import { createDragonfly } from './model.js';
import { createDragonflyDirector } from './director.js';
import { rasterizeDragonflyPond, paintDragonflyPond } from './pond-preview.js';
import { gridToText, paintDragonfly, rasterizeDragonfly } from './preview.js';
export function normalizeDragonflyPointer(clientX, clientY, rect) {
    if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite))
        throw new TypeError('Pointer coordinates and CSS rectangle must be finite');
    if (rect.width <= 0 || rect.height <= 0)
        return null;
    return { x: Math.max(-1, Math.min(1, 2 * (clientX - rect.left) / rect.width - 1)), y: Math.max(-1, Math.min(1, 2 * (clientY - rect.top) / rect.height - 1)) };
}
/** Construct only in a browser. Importing this module does not read DOM globals. */
export function mountDragonfly(canvas, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options))
        throw new TypeError('Dragonfly mount options must be an object');
    for (const key of Object.keys(options))
        if (!['model', 'paused', 'view', 'neutral', 'onStatus', 'environment', 'frameSource', 'director'].includes(key))
            throw new TypeError(`Unknown Dragonfly mount option: ${key}`);
    if (options.frameSource !== undefined && typeof options.frameSource?.subscribe !== 'function')
        throw new TypeError('frameSource must provide subscribe');
    if (options.onStatus !== undefined && typeof options.onStatus !== 'function')
        throw new TypeError('onStatus must be a function');
    const owner = canvas?.ownerDocument?.defaultView;
    if (!options.environment && !owner)
        throw new TypeError('Dragonfly requires a browser canvas');
    const environment = options.environment ?? {
        window: owner, document: canvas.ownerDocument,
        ResizeObserver: owner.ResizeObserver,
        IntersectionObserver: owner.IntersectionObserver ?? null,
    };
    const win = environment.window, doc = environment.document;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context)
        throw new Error('Canvas 2D is unavailable. The Dragonfly description remains available.');
    if (options.paused !== undefined && typeof options.paused !== 'boolean')
        throw new TypeError('paused must be boolean');
    if (options.neutral !== undefined && typeof options.neutral !== 'boolean')
        throw new TypeError('neutral must be boolean');
    let view = options.view ?? 'oblique';
    if (view !== 'oblique' && view !== 'dorsal')
        throw new TypeError('Unknown Dragonfly view');
    let neutral = options.neutral ?? false;
    const director = options.director === undefined ? null : createDragonflyDirector(options.director, options.model);
    const model = director ? null : createDragonfly(options.model);
    const media = win.matchMedia('(prefers-reduced-motion: reduce)');
    let requestedMotion = speciesOptions().motion;
    let userPaused = options.paused ?? false;
    let disposed = false, offscreen = false, zeroSized = true;
    let releaseFrame = null, subscribed = false;
    let frameId = null, previousTime = null, remainder = 0;
    let width = 0, height = 0, dpr = 1, cols = 72, rows = 44;
    let pendingTarget = null, pendingDart = false;
    let pendingSelection = null, pendingCue = null;
    let disposedDirectorState = null;
    let guide = { x: 0, y: 0 };
    let droppedMilliseconds = 0, renderedFrames = 0, sampleCount = 0;
    let lastGrid = null;
    let lastTick = 0;
    let lastBehavior = 'idle';
    let resizeObserver = null, intersectionObserver = null;
    const removeListeners = [];
    const tickMilliseconds = 1000 / 60;
    function speciesState() { return director ? director.getPrimaryState() : model.getState(); }
    function speciesOptions() { return director ? director.getModelOptions() : model.getOptions(); }
    function currentTick() { return director ? director.getState().tick : model.getState().tick; }
    function clearModelTarget() { if (director)
        director.clearTarget();
    else
        model.clearTarget(); }
    function setModelPaused(value) { if (director)
        director.setPaused(value);
    else
        model.setPaused(value); }
    function setPose(value) { if (director)
        director.setStaticPose(value);
    else
        model.setStaticPose(value); }
    function configureModel(patch) {
        if (director)
            director.configureModel(patch);
        else
            model.configure(patch);
        return speciesOptions();
    }
    function resetModel(seed) { if (director)
        director.reset(seed);
    else
        model.reset(seed); }
    function visible() { return !doc.hidden && !offscreen && !zeroSized; }
    function phaseSignature() {
        if (!director)
            return speciesState().behavior.kind;
        const state = director.getState();
        return `${state.arc}:${state.selected}:${state.members.map(member => member.phase.kind).join(',')}`;
    }
    function assertAlive() { if (disposed)
        throw new Error('Dragonfly browser controller is disposed'); }
    function isActive() {
        return !disposed && !userPaused && !media.matches && speciesOptions().motion !== 'static' && !doc.hidden && !offscreen && !zeroSized;
    }
    function getStatus() {
        const state = disposed ? null : speciesState();
        return {
            director: disposed ? disposedDirectorState : director?.getState() ?? null,
            tick: disposed ? lastTick : currentTick(), behavior: state?.behavior.kind ?? lastBehavior, paused: userPaused,
            motion: disposed ? requestedMotion : speciesOptions().motion, requestedMotion,
            reducedMotion: media.matches, hidden: Boolean(doc.hidden), offscreen, zeroSized, disposed,
            queuedFrames: frameId === null && !subscribed ? 0 : 1, pendingInputs: Number(pendingTarget !== null) + (director ? Number(pendingSelection !== null) + Number(pendingCue !== null) : Number(pendingDart)),
            droppedMilliseconds, renderedFrames, cols, rows, width, height, dpr, samples: sampleCount,
            occupied: lastGrid?.occupied ?? 0, clippedSamples: lastGrid?.clippedSamples ?? 0,
        };
    }
    function stopFrame() {
        const unsubscribe = releaseFrame;
        releaseFrame = null;
        subscribed = false;
        unsubscribe?.();
        if (frameId !== null) {
            win.cancelAnimationFrame(frameId);
            frameId = null;
        }
        previousTime = null;
        remainder = 0;
    }
    function dropInput() {
        pendingTarget = null;
        pendingDart = false;
        pendingSelection = null;
        pendingCue = null;
        if (!disposed)
            clearModelTarget();
    }
    function release() {
        if (disposed)
            return;
        lastTick = currentTick();
        lastBehavior = speciesState().behavior.kind;
        disposedDirectorState = director?.getState() ?? null;
        stopFrame();
        dropInput();
        disposed = true;
        resizeObserver?.disconnect();
        intersectionObserver?.disconnect();
        for (const remove of removeListeners.splice(0).reverse())
            remove();
        if (director)
            director.dispose();
        else
            model.dispose();
        lastGrid = null;
        canvas.width = 0;
        canvas.height = 0;
    }
    function notify() {
        if (!options.onStatus)
            return;
        try {
            options.onStatus(getStatus());
        }
        catch (error) {
            release();
            throw error;
        }
    }
    function listen(target, type, callback, listenerOptions) {
        target.addEventListener(type, callback, listenerOptions);
        removeListeners.push(() => target.removeEventListener(type, callback, listenerOptions));
    }
    function draw() {
        if (disposed || zeroSized || doc.hidden || offscreen)
            return;
        if (director) {
            const members = director.sample();
            sampleCount = members.reduce((sum, member) => sum + member.geometry.samples.length, 0);
            const pond = rasterizeDragonflyPond(members, { cols, rows, view, neutral });
            lastGrid = pond;
            paintDragonflyPond(context, pond, { width, height, dpr, neutral, labels: director.getOptions().labels });
        }
        else {
            const geometry = model.sample();
            sampleCount = geometry.samples.length;
            lastGrid = rasterizeDragonfly(geometry, { cols, rows, view, neutral });
            paintDragonfly(context, lastGrid, { width, height, dpr, neutral });
        }
        renderedFrames++;
    }
    function enqueueFrame() {
        if (!isActive() || frameId !== null || subscribed)
            return;
        if (options.frameSource) {
            subscribed = true;
            let unsubscribe;
            try {
                unsubscribe = options.frameSource.subscribe(onFrame);
            }
            catch (error) {
                subscribed = false;
                throw error;
            }
            if (typeof unsubscribe !== 'function')
                throw new TypeError('frameSource.subscribe must return a release function');
            if (!isActive() || !subscribed) {
                unsubscribe();
                subscribed = false;
            }
            else
                releaseFrame = unsubscribe;
        }
        else
            frameId = win.requestAnimationFrame(onFrame);
    }
    function reconcile() {
        if (disposed)
            return;
        stopFrame();
        dropInput();
        draw();
        enqueueFrame();
        notify();
    }
    function collectEvents(tick) {
        let sequence = speciesState().lastSeq + 1;
        const events = [];
        if (pendingTarget !== null)
            events.push({ type: 'pointer', tick, seq: sequence++, x: pendingTarget.x, y: pendingTarget.y });
        if (pendingDart)
            events.push({ type: 'dart', tick, seq: sequence });
        pendingTarget = null;
        pendingDart = false;
        return events;
    }
    function collectDirectorEvents(tick) {
        let sequence = director.getState().lastSeq + 1;
        const events = [];
        // Selection applies before the same-tick guide and cue, independent of DOM event frequency.
        if (pendingSelection !== null)
            events.push({ type: 'select', tick, seq: sequence++, id: pendingSelection });
        if (pendingTarget !== null)
            events.push({ type: 'pointer', tick, seq: sequence++, x: pendingTarget.x, y: pendingTarget.y });
        if (pendingCue !== null)
            events.push({ type: 'cue', tick, seq: sequence, cue: pendingCue });
        pendingSelection = null;
        pendingTarget = null;
        pendingCue = null;
        return events;
    }
    function onFrame(time) {
        frameId = null;
        if (!isActive()) {
            previousTime = null;
            remainder = 0;
            return;
        }
        try {
            if (!Number.isFinite(time))
                throw new TypeError('Animation timestamp must be finite');
            const oldBehavior = phaseSignature();
            if (previousTime !== null) {
                const elapsed = Math.max(0, time - previousTime) + remainder;
                const due = Math.floor((elapsed + 1e-8) / tickMilliseconds);
                const steps = Math.min(5, due);
                remainder = Math.max(0, elapsed - due * tickMilliseconds);
                droppedMilliseconds += (due - steps) * tickMilliseconds;
                for (let step = 0; step < steps; step++) {
                    const tick = currentTick() + 1;
                    if (director)
                        director.step(tick, collectDirectorEvents(tick));
                    else
                        model.step(tick, collectEvents(tick));
                }
            }
            previousTime = time;
            draw();
            enqueueFrame();
            if (oldBehavior !== phaseSignature())
                notify();
        }
        catch (error) {
            release();
            throw error;
        }
    }
    function resize() {
        if (disposed)
            return;
        const rect = canvas.getBoundingClientRect();
        zeroSized = !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0;
        if (zeroSized) {
            width = 0;
            height = 0;
            stopFrame();
            dropInput();
            lastGrid = null;
            canvas.width = 0;
            canvas.height = 0;
            notify();
            return;
        }
        width = Math.min(rect.width, 1200);
        height = Math.min(rect.height, 700);
        dpr = Number.isFinite(win.devicePixelRatio) ? Math.max(1, Math.min(2, win.devicePixelRatio)) : 1;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        cols = Math.max(72, Math.min(160, Math.floor(width / 7.5)));
        rows = Math.max(44, Math.min(88, Math.floor(height / 9.4)));
        reconcile();
    }
    function setTarget(x, y) {
        assertAlive();
        if (![x, y].every(Number.isFinite) || Math.abs(x) > 1 || Math.abs(y) > 1)
            throw new RangeError('Guide coordinates must be finite and normalized to -1..1');
        guide = { x, y };
        if (doc.hidden || offscreen || zeroSized)
            return;
        if (!isActive()) {
            setPose(x < 0 ? 0 : 1);
            draw();
            notify();
            return;
        }
        pendingTarget = guide;
    }
    function clearTarget() {
        assertAlive();
        pendingTarget = null;
        guide = { x: 0, y: 0 };
        clearModelTarget();
    }
    function pointer(event) {
        if (!isActive())
            return;
        const p = event;
        if (event.type === 'pointerdown' && p.button !== 0 && p.pointerType !== 'touch')
            return;
        const target = normalizeDragonflyPointer(p.clientX, p.clientY, canvas.getBoundingClientRect());
        if (target) {
            guide = target;
            pendingTarget = target;
        }
    }
    function setPaused(value) {
        assertAlive();
        if (typeof value !== 'boolean')
            throw new TypeError('paused must be boolean');
        userPaused = value;
        setModelPaused(value);
        reconcile();
    }
    function preferenceChanged() {
        if (disposed)
            return;
        configureModel({ motion: media.matches ? 'static' : requestedMotion });
        reconcile();
    }
    function keydown(event) {
        if (disposed)
            return;
        const key = event;
        if (key.altKey || key.ctrlKey || key.metaKey)
            return;
        if (director && /^[1-4]$/.test(key.key)) {
            const id = Number(key.key) - 1;
            if (director.getState().members.some(member => member.id === id)) {
                key.preventDefault();
                selectIndividual(id);
            }
            return;
        }
        if (key.code === 'Space' || key.key === ' ') {
            key.preventDefault();
            setPaused(!userPaused);
            return;
        }
        let x = guide.x, y = guide.y;
        if (key.key === 'ArrowLeft')
            x -= 0.2;
        else if (key.key === 'ArrowRight')
            x += 0.2;
        else if (key.key === 'ArrowUp')
            y -= 0.2;
        else if (key.key === 'ArrowDown')
            y += 0.2;
        else
            return;
        key.preventDefault();
        setTarget(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
    }
    function selectIndividual(id) {
        assertAlive();
        if (!director)
            throw new Error('The pond director was not enabled for this mount');
        if (!Number.isInteger(id) || !director.getState().members.some(member => member.id === id))
            throw new RangeError('Select an existing Dragonfly individual ID');
        if (!visible())
            return;
        if (isActive())
            pendingSelection = id;
        else {
            director.selectIndividual(id);
            draw();
            notify();
        }
    }
    function dartAction() {
        if (director) {
            cueAction('dart');
            return;
        }
        assertAlive();
        if (!visible())
            return;
        if (!isActive()) {
            setPose(speciesState().staticPose === 0 ? 1 : 0);
            draw();
            notify();
            return;
        }
        pendingDart = true;
    }
    function cueAction(cue) {
        assertAlive();
        if (!['dart', 'perch', 'return'].includes(cue))
            throw new TypeError('Unknown Dragonfly cue');
        if (!director) {
            if (cue === 'dart') {
                dartAction();
                return;
            }
            throw new Error('The pond director was not enabled for this mount');
        }
        if (!visible())
            return;
        if (!isActive()) {
            setPose(speciesState().staticPose === 0 ? 1 : 0);
            draw();
            notify();
            return;
        }
        pendingCue = cue;
    }
    const controller = {
        setPaused,
        configureDirector(patch) {
            assertAlive();
            if (!director)
                throw new Error('The pond director was not enabled for this mount');
            director.configure(patch);
            reconcile();
        },
        getDirectorState() { return disposed ? disposedDirectorState : director?.getState() ?? null; },
        getDirectorOptions() { return director?.getOptions() ?? null; },
        selectIndividual,
        cue: cueAction,
        configure(patch) {
            assertAlive();
            // Validate through the species before changing the remembered user policy.
            const next = configureModel(patch);
            if (patch.motion !== undefined)
                requestedMotion = next.motion;
            if (media.matches)
                configureModel({ motion: 'static' });
            reconcile();
        },
        setView(value) {
            assertAlive();
            if (value !== 'dorsal' && value !== 'oblique')
                throw new TypeError('Unknown Dragonfly view');
            view = value;
            draw();
            notify();
        },
        setNeutral(value) {
            assertAlive();
            if (typeof value !== 'boolean')
                throw new TypeError('neutral must be boolean');
            neutral = value;
            draw();
            notify();
        },
        setTarget, clearTarget,
        dart: dartAction,
        reset(seed) {
            assertAlive();
            resetModel(seed);
            guide = { x: 0, y: 0 };
            reconcile();
        },
        render() { assertAlive(); draw(); },
        exportText() {
            assertAlive();
            return gridToText(director ? rasterizeDragonflyPond(director.sample(), { cols, rows, view, neutral }) :
                rasterizeDragonfly(model.sample(), { cols, rows, view, neutral }));
        },
        getState() { return speciesState(); },
        getOptions() { return speciesOptions(); },
        getStatus,
        dispose() { if (disposed)
            return; release(); notify(); },
    };
    try {
        setModelPaused(userPaused);
        if (media.matches)
            configureModel({ motion: 'static' });
        listen(canvas, 'pointermove', pointer, { passive: true });
        listen(canvas, 'pointerdown', pointer, { passive: true });
        for (const type of ['pointerleave', 'pointercancel', 'lostpointercapture'])
            listen(canvas, type, () => { if (!disposed)
                clearTarget(); }, { passive: true });
        listen(canvas, 'keydown', keydown);
        listen(doc, 'visibilitychange', reconcile);
        listen(media, 'change', preferenceChanged);
        listen(win, 'resize', resize, { passive: true });
        if (doc.fonts)
            listen(doc.fonts, 'loadingdone', resize);
        resizeObserver = new environment.ResizeObserver(resize);
        resizeObserver.observe(canvas);
        if (environment.IntersectionObserver) {
            intersectionObserver = new environment.IntersectionObserver(entries => {
                if (disposed)
                    return;
                const entry = entries.find(item => item.target === canvas);
                if (!entry)
                    return;
                offscreen = !entry.isIntersecting;
                reconcile();
            });
            intersectionObserver.observe(canvas);
        }
        resize();
    }
    catch (error) {
        release();
        throw error;
    }
    return Object.freeze(controller);
}
