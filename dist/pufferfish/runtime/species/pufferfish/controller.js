import { configurePufferfish, createPufferfish, describePufferfish, finite, pufferfishPoster, PUFFERFISH_LIMITS, record, resetPufferfish, stepPufferfish } from './model.js';
import { createPufferfishPainter, resolveRenderOptions } from './legacy-painter.js';
export function normalizePufferfishPointer(clientX, clientY, rect) {
    finite(clientX, -1e7, 1e7, 'clientX');
    finite(clientY, -1e7, 1e7, 'clientY');
    finite(rect.left, -1e7, 1e7, 'rect.left');
    finite(rect.top, -1e7, 1e7, 'rect.top');
    finite(rect.width, 0, 1e5, 'rect.width');
    finite(rect.height, 0, 1e5, 'rect.height');
    if (!rect.width || !rect.height)
        return null;
    const aspect = rect.width / rect.height;
    if (aspect < 0.1 || aspect > 10)
        return null;
    const x = (clientX - rect.left) / rect.width * 2 - 1, y = (clientY - rect.top) / rect.height * 2 - 1;
    if (x < -1 || x > 1 || y < -1 || y > 1)
        return { type: 'retreat' };
    return { type: 'pointer', x, y, aspect };
}
/** Browser lifecycle only. No legacy constructor/listener/RAF is created by the painter. */
export function mountPufferfish(canvas, legacy, options = {}) {
    record(options, ['species', 'render', 'paused', 'onChange', 'onError', 'frameSource'], 'mount options');
    if (options.paused !== undefined && typeof options.paused !== 'boolean')
        throw new TypeError('paused must be boolean');
    for (const cb of ['onChange', 'onError'])
        if (options[cb] !== undefined && typeof options[cb] !== 'function')
            throw new TypeError(`${cb} must be a function`);
    if (options.frameSource !== undefined && typeof options.frameSource?.subscribe !== 'function')
        throw new TypeError('frameSource must provide subscribe');
    let unsubscribe = null;
    let state = createPufferfish(options.species);
    const renderConfig = resolveRenderOptions(options.render);
    const doc = canvas.ownerDocument, win = doc.defaultView;
    if (!win)
        throw new Error('mountPufferfish requires a browser document');
    const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motion.matches, paused = options.paused ?? false, hidden = doc.hidden;
    let offscreen = false, zeroSized = true, compact = false, destroyed = false;
    let raf = null, previous = null, accumulator = 0, dropped = 0;
    let clockGeneration = 0;
    let frames = 0, coalesced = 0, failure = null;
    let pendingPointer = null, pendingAction = null;
    let poster = null, lastRender = null;
    let painter;
    const cleanups = [];
    const resting = () => paused || reduced || hidden || offscreen || zeroSized || compact || destroyed;
    const blocked = () => hidden || offscreen || zeroSized || destroyed;
    const shown = () => poster === null ? state : pufferfishPoster(state, poster);
    function alive() { if (destroyed)
        throw new Error('Pufferfish controller is disposed'); }
    function status() {
        const visibleState = shown();
        return Object.freeze({ tick: state.tick, phase: visibleState.phase.kind, description: describePufferfish(visibleState),
            userPaused: paused, reducedMotion: reduced, hidden, offscreen, zeroSized, compact, destroyed,
            running: !resting(), queuedFrames: raf === null && unsubscribe === null ? 0 : 1, droppedMilliseconds: dropped,
            renderedFrames: frames, coalescedInputs: coalesced, pendingInputs: Number(pendingPointer !== null) + Number(pendingAction !== null), failure });
    }
    function cancel() {
        clockGeneration++;
        const release = unsubscribe;
        unsubscribe = null;
        release?.();
        if (raf !== null)
            win.cancelAnimationFrame(raf);
        raf = null;
        previous = null;
        accumulator = 0;
    }
    function destroy() {
        if (destroyed)
            return;
        destroyed = true;
        cancel();
        pendingAction = pendingPointer = null;
        for (const cleanup of cleanups.splice(0).reverse()) {
            try {
                cleanup();
            }
            catch { /* Continue owned-resource cleanup. */ }
        }
        painter?.dispose();
        painter = undefined;
    }
    function fail(error) {
        failure = error instanceof Error ? error.message : String(error);
        destroy();
        options.onError?.(error);
    }
    function guarded(work) {
        if (destroyed)
            return;
        try {
            work();
        }
        catch (error) {
            fail(error);
        }
    }
    function notify() { options.onChange?.(status()); }
    function draw() {
        if (destroyed || zeroSized || hidden || offscreen || !painter)
            return;
        lastRender = painter.draw(shown(), resting());
        frames++;
    }
    function clearTarget() {
        pendingPointer = null;
        // A normalized retreat is consumed on the first resumed tick. No time advances while resting.
        pendingAction = { type: 'retreat' };
    }
    function schedule() {
        if (resting() || raf !== null || unsubscribe !== null)
            return;
        if (options.frameSource) {
            const generation = clockGeneration;
            unsubscribe = () => { }; // Guard a synchronous frame source from reentrant subscription.
            const release = options.frameSource.subscribe(timestamp => { if (!destroyed && generation === clockGeneration)
                frame(timestamp); });
            if (typeof release !== 'function')
                throw new TypeError('frameSource.subscribe must return an unsubscribe function');
            if (resting() || generation !== clockGeneration)
                release();
            else
                unsubscribe = release;
        }
        else
            raf = win.requestAnimationFrame(frame);
    }
    function reconcile() {
        cancel();
        if (resting())
            clearTarget();
        draw();
        schedule();
        notify();
    }
    function tick() {
        const next = state.tick + 1;
        const inputs = [pendingPointer, pendingAction].filter((v) => v !== null);
        const events = inputs.map((input, i) => ({ ...input, tick: next, seq: state.lastSequence + i + 1 }));
        const result = stepPufferfish(state, { tick: next, events });
        state = result.state;
        pendingPointer = pendingAction = null;
        if (result.transition !== null)
            notify();
    }
    function frame(timestamp) {
        raf = null;
        guarded(() => {
            if (resting()) {
                previous = null;
                return;
            }
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
                    if (resting() || clockGeneration !== generation)
                        return;
                }
                accumulator -= ticks * (1000 / 60);
                if (available > ticks) {
                    const skipped = (available - ticks) * (1000 / 60);
                    accumulator -= skipped;
                    dropped += skipped;
                }
                if (accumulator < 0)
                    accumulator = 0;
            }
            previous = timestamp;
            draw();
            schedule();
        });
    }
    function resize() {
        if (destroyed || !painter)
            return;
        const rect = canvas.getBoundingClientRect();
        zeroSized = !painter.resize(rect.width, rect.height, win.devicePixelRatio || 1);
        compact = !zeroSized && (rect.width < 360 || rect.height < 270);
        reconcile();
    }
    function listen(target, type, callback) {
        const safe = event => guarded(() => callback(event));
        target.addEventListener(type, safe, { passive: true });
        cleanups.push(() => target.removeEventListener(type, safe));
    }
    function action(inflated) {
        alive();
        if (blocked())
            return Object.freeze({ kind: 'suspended', phase: shown().phase.kind });
        if (paused || reduced || compact) {
            poster = inflated;
            pendingPointer = pendingAction = null;
            guarded(() => { draw(); notify(); });
            return Object.freeze({ kind: 'static-poster', phase: shown().phase.kind });
        }
        if (pendingAction)
            coalesced++;
        pendingAction = { type: inflated ? 'approach' : 'retreat' };
        return Object.freeze({ kind: 'queued', phase: state.phase.kind });
    }
    const controller = {
        configure(patch) {
            alive();
            const next = configurePufferfish(state, patch);
            state = next;
            poster = null;
            pendingPointer = pendingAction = null;
            guarded(reconcile);
        },
        configureRender(patch) {
            alive();
            record(patch, ['view', 'quality', 'monochrome', 'maxDpr'], 'render patch');
            const next = resolveRenderOptions({ ...painter.getConfig(), ...patch });
            guarded(() => { painter.configure(next); reconcile(); });
        },
        setPaused(value) {
            alive();
            if (typeof value !== 'boolean')
                throw new TypeError('paused must be boolean');
            paused = value;
            if (!value && !reduced)
                poster = null;
            guarded(reconcile);
        },
        reset(seed) {
            alive();
            const next = resetPufferfish(state, seed);
            state = next;
            poster = null;
            pendingPointer = pendingAction = null;
            guarded(reconcile);
        },
        approach: () => action(true), retreat: () => action(false),
        getSnapshot: () => state, getStatus: status,
        exportText() { alive(); return lastRender?.text ?? ''; }, destroy,
    };
    try {
        painter = createPufferfishPainter(canvas, legacy, renderConfig);
        listen(canvas, 'pointermove', event => {
            const pointer = event;
            if (resting() || pointer.pointerType === 'touch')
                return;
            const next = normalizePufferfishPointer(pointer.clientX, pointer.clientY, canvas.getBoundingClientRect());
            if (!next) {
                clearTarget();
                return;
            }
            if (pendingPointer)
                coalesced++;
            pendingPointer = next;
        });
        for (const type of ['pointerleave', 'pointercancel', 'lostpointercapture'])
            listen(canvas, type, clearTarget);
        listen(win, 'blur', clearTarget);
        listen(win, 'resize', resize);
        listen(doc, 'visibilitychange', () => { hidden = doc.hidden; reconcile(); });
        listen(motion, 'change', () => { reduced = motion.matches; poster = reduced ? false : null; reconcile(); });
        const ro = new win.ResizeObserver(() => guarded(resize));
        cleanups.push(() => ro.disconnect());
        ro.observe(canvas);
        const io = new win.IntersectionObserver(entries => guarded(() => {
            const entry = entries.find(item => item.target === canvas);
            if (entry) {
                offscreen = !entry.isIntersecting;
                reconcile();
            }
        }));
        cleanups.push(() => io.disconnect());
        io.observe(canvas);
        // Promise has no cancellation API; callback checks disposal before touching resources.
        if (doc.fonts)
            void doc.fonts.ready.then(() => guarded(resize), error => { if (!destroyed)
                fail(error); });
        resize();
        if (destroyed)
            throw new Error(failure ?? 'Pufferfish setup failed');
    }
    catch (error) {
        destroy();
        throw error;
    }
    return controller;
}
