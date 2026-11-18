import { clearFrogTarget, createFrog, normalizeFrogPointer, ownKeys, previewFrogTarget, resetFrog, stampFrogAction, stepFrog, validateTarget } from './frog.mjs';
import { createLegacyFrogPreview, validatePreview } from './legacy-preview.mjs';
/** Browser-only host; the imported module itself is safe without DOM globals. */
export function mountFrog(canvas, options = {}) {
    ownKeys(options, ['seed', 'config', 'paused', 'preview', 'onAction', 'previewFactory', 'frameSource'], 'mount');
    if (options.onAction !== undefined && typeof options.onAction !== 'function')
        throw new TypeError('onAction must be a function');
    if (options.previewFactory !== undefined && typeof options.previewFactory !== 'function')
        throw new TypeError('previewFactory must be a function');
    if (options.frameSource !== undefined && (!options.frameSource || typeof options.frameSource.subscribe !== 'function'))
        throw new TypeError('frameSource must provide subscribe');
    validatePreview(options.preview);
    const doc = canvas.ownerDocument, win = doc.defaultView;
    if (!win)
        throw new Error('Frog canvas must have a browsing context');
    if (options.paused !== undefined && typeof options.paused !== 'boolean')
        throw new TypeError('paused must be boolean');
    let state = createFrog({ ...(options.seed === undefined ? {} : { seed: options.seed }), ...(options.config === undefined ? {} : { config: options.config }) });
    let paused = options.paused ?? false, disposed = false, offscreen = false, zeroSize = true, undersized = false;
    let unsubscribe = null;
    let raf = null, lastTime = null, remainder = 0, nextSeq = 0;
    let pendingTarget, pendingLeap = false, coalescedInputs = 0, droppedMilliseconds = 0;
    let staticPose = 'rest', poseSelected = false, gesture = null;
    const media = win.matchMedia('(prefers-reduced-motion: reduce)');
    const preview = (options.previewFactory ?? createLegacyFrogPreview)(canvas, options.preview ?? {});
    const cleanup = [];
    const stepMs = 1000 / 60;
    let resizeObserver, intersectionObserver;
    const alive = () => { if (disposed)
        throw new Error('Frog controller disposed'); };
    const visible = () => !disposed && !doc.hidden && !offscreen && !zeroSize;
    const running = () => visible() && !undersized && !paused && !media.matches;
    function cancel() { if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    else if (raf !== null)
        win.cancelAnimationFrame(raf); raf = null; lastTime = null; remainder = 0; }
    function clearPending() { pendingTarget = undefined; pendingLeap = false; gesture = null; }
    function dispose() {
        if (disposed)
            return;
        disposed = true;
        cancel();
        clearPending();
        resizeObserver?.disconnect();
        intersectionObserver?.disconnect();
        for (const remove of cleanup.splice(0))
            remove();
        preview.dispose();
    }
    function announce(message) { try {
        options.onAction?.(message);
    }
    catch (error) {
        dispose();
        throw error;
    } }
    function draw() {
        if (!visible())
            return;
        // User pause freezes the existing tick's exact pose. A chosen static pose
        // persists through every redraw until reset or explicit Resume.
        try {
            preview.draw(state, { motion: !media.matches && !undersized && !poseSelected,
                ...(media.matches || undersized || poseSelected ? { staticPose } : {}) });
        }
        catch (error) {
            dispose();
            throw error;
        }
    }
    function schedule() { if (running() && raf === null) {
        if (options.frameSource) {
            raf = 0;
            try {
                unsubscribe = options.frameSource.subscribe(frame);
            }
            catch (error) {
                raf = null;
                throw error;
            }
        }
        else
            raf = win.requestAnimationFrame(frame);
    } }
    function suspendTransient() { clearPending(); state = clearFrogTarget(state); }
    function reconcile() { if (disposed)
        return; cancel(); suspendTransient(); draw(); schedule(); }
    function frame(now) {
        if (!options.frameSource)
            raf = null;
        if (!running()) {
            lastTime = null;
            remainder = 0;
            return;
        }
        try {
            if (!Number.isFinite(now))
                throw new TypeError('Invalid browser frame timestamp');
            if (lastTime !== null) {
                const elapsed = Math.max(0, now - lastTime), cap = stepMs * 5;
                const accepted = Math.min(elapsed, cap);
                droppedMilliseconds += elapsed - accepted;
                remainder += accepted;
                let steps = 0;
                while (remainder + 1e-7 >= stepMs && steps < 5) {
                    const events = [], tick = state.tick + 1;
                    if (pendingTarget !== undefined)
                        events.push(stampFrogAction(pendingTarget === null ? { type: 'leave' } : { type: 'target', ...pendingTarget }, tick, nextSeq++));
                    if (pendingLeap)
                        events.push(stampFrogAction({ type: 'leap' }, tick, nextSeq++));
                    pendingTarget = undefined;
                    pendingLeap = false;
                    state = stepFrog(state, tick, events).state;
                    remainder = Math.max(0, remainder - stepMs);
                    steps++;
                }
            }
            lastTime = now;
            draw();
            schedule();
        }
        catch (error) {
            dispose();
            throw error;
        }
    }
    function target(point) {
        alive();
        const valid = validateTarget(point);
        if (!visible())
            return;
        if (running()) {
            if (pendingTarget !== undefined)
                coalescedInputs++;
            pendingTarget = valid;
        }
        else {
            state = previewFrogTarget(state, valid);
            draw();
        }
    }
    function leap() {
        alive();
        if (!visible())
            return;
        if (media.matches || undersized) {
            clearPending();
            const poses = ['rest', 'crouch', 'airborne', 'landed'];
            staticPose = poses[(poses.indexOf(staticPose) + 1) % poses.length];
            draw();
            announce(`Static ${staticPose} pose. Motion stays off.`);
        }
        else if (paused) {
            announce('Paused. Resume to leap, or choose a static pose.');
        }
        else {
            if (pendingLeap)
                coalescedInputs++;
            pendingLeap = true;
            announce(state.behavior.kind === 'idle' || state.behavior.kind === 'interest' ? 'Leap requested toward the landing marker.' : 'Frog is completing its landing and cooldown.');
        }
    }
    function clearTarget() {
        alive();
        gesture = null;
        pendingLeap = false;
        if (running())
            pendingTarget = null;
        else {
            pendingTarget = undefined;
            state = clearFrogTarget(state);
            draw();
        }
    }
    function resize() {
        if (disposed)
            return;
        const r = canvas.getBoundingClientRect();
        const wasSuspended = zeroSize || undersized;
        zeroSize = ![r.width, r.height].every(Number.isFinite) || r.width <= 0 || r.height <= 0;
        undersized = !zeroSize && (r.width < 320 || r.height < 240);
        if (zeroSize) {
            cancel();
            suspendTransient();
            canvas.width = canvas.height = 1;
            return;
        }
        try {
            preview.resize(r.width, r.height, Number.isFinite(win.devicePixelRatio) && win.devicePixelRatio > 0 ? win.devicePixelRatio : 1);
            if (undersized || wasSuspended) {
                cancel();
                suspendTransient();
            }
            draw();
            schedule();
        }
        catch (error) {
            dispose();
            throw error;
        }
    }
    function listen(target, name, handler, options) {
        target.addEventListener(name, handler, options);
        cleanup.push(() => target.removeEventListener(name, handler, options));
    }
    function pointerTarget(event) {
        const p = normalizeFrogPointer(event.clientX, event.clientY, canvas.getBoundingClientRect());
        return p ? preview.targetAt(p) : null;
    }
    function reset(options = {}) {
        alive();
        const replacement = resetFrog(state, options);
        state = replacement;
        nextSeq = 0;
        staticPose = 'rest';
        poseSelected = false;
        droppedMilliseconds = 0;
        coalescedInputs = 0;
        reconcile();
        announce('Frog reset. Playback preference preserved.');
    }
    try {
        listen(canvas, 'pointermove', ((event) => {
            if (disposed)
                return;
            if (gesture && gesture.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 12)
                gesture = null;
            if (!running() || event.pointerType === 'touch')
                return;
            const p = pointerTarget(event);
            if (p)
                target(p);
        }), { passive: true });
        listen(canvas, 'pointerdown', ((event) => {
            if (!visible() || !event.isPrimary || event.button !== 0)
                return;
            gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }), { passive: true });
        listen(canvas, 'pointerup', ((event) => {
            if (disposed)
                return;
            const start = gesture;
            gesture = null;
            if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12)
                return;
            const p = pointerTarget(event);
            if (p) {
                target(p);
                leap();
            }
        }), { passive: true });
        for (const name of ['pointerleave', 'pointercancel', 'lostpointercapture'])
            listen(canvas, name, (() => { if (!disposed)
                clearTarget(); }), { passive: true });
        listen(canvas, 'keydown', ((event) => {
            if (disposed)
                return;
            if (event.target !== canvas || event.altKey || event.ctrlKey || event.metaKey)
                return;
            if (event.key.startsWith('Arrow')) {
                const direction = { ArrowLeft: [-.12, 0], ArrowRight: [.12, 0], ArrowUp: [0, -.12], ArrowDown: [0, .12] };
                const d = direction[event.key];
                if (!d)
                    return;
                event.preventDefault();
                const p = pendingTarget ?? state.target ?? state.position;
                target({ x: Math.max(-1, Math.min(1, p.x + d[0])), y: Math.max(-1, Math.min(1, p.y + d[1])) });
            }
            else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (!event.repeat)
                    leap();
            }
            else if (event.key === 'Escape') {
                event.preventDefault();
                clearTarget();
            }
        }));
        listen(doc, 'visibilitychange', reconcile);
        listen(media, 'change', (() => { if (disposed)
            return; if (!poseSelected)
            staticPose = 'rest'; reconcile(); announce(media.matches ? 'Reduced motion: static poses only.' : 'Motion preference updated.'); }));
        listen(win, 'resize', resize, { passive: true });
        // Observers are resolved from the owning window, supporting independent embeds.
        const env = win;
        resizeObserver = new env.ResizeObserver(resize);
        resizeObserver.observe(canvas);
        if (env.IntersectionObserver) {
            intersectionObserver = new env.IntersectionObserver(entries => {
                if (disposed)
                    return;
                const entry = entries.find(x => x.target === canvas);
                if (!entry || offscreen === !entry.isIntersecting)
                    return;
                offscreen = !entry.isIntersecting;
                reconcile();
            });
            intersectionObserver.observe(canvas);
        }
        resize();
    }
    catch (error) {
        dispose();
        throw error;
    }
    return Object.freeze({
        getState() { alive(); return state; },
        getStatus() {
            return Object.freeze({ tick: state.tick, phase: state.behavior.kind, paused, reducedMotion: media.matches,
                hidden: Boolean(doc.hidden), offscreen, zeroSize, undersized, disposed, scheduled: raf !== null,
                pendingInputs: Number(pendingTarget !== undefined) + Number(pendingLeap), coalescedInputs, droppedMilliseconds, staticPose });
        },
        target, leap, clearTarget, reset,
        setPaused(value) {
            alive();
            if (typeof value !== 'boolean')
                throw new TypeError('paused must be boolean');
            paused = value;
            if (!value)
                poseSelected = false;
            // Pending input is transient; committed gaze/target is part of the pose.
            cancel();
            clearPending();
            draw();
            schedule();
            announce(paused ? 'Paused.' : media.matches ? 'Static poses: reduced motion is active.' : 'Playing.');
        },
        setStaticPose(value) {
            alive();
            if (!['rest', 'crouch', 'airborne', 'landed'].includes(value))
                throw new TypeError('Unknown static pose');
            paused = true;
            staticPose = value;
            poseSelected = true;
            cancel();
            suspendTransient();
            if (visible())
                preview.draw(state, { motion: false, staticPose });
            announce(`Static ${value} pose. Playback paused.`);
        },
        updateConfig(patch) { alive(); const replacement = resetFrog(state, { config: patch }); state = replacement; nextSeq = 0; staticPose = 'rest'; poseSelected = false; reconcile(); announce('Frog configuration updated and reset. Playback preference preserved.'); },
        updatePreview(patch) { alive(); preview.update(patch); draw(); },
        exportText() { alive(); return preview.toText(); },
        dispose,
    });
}
