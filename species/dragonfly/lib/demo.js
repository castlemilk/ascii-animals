import { mountDragonfly } from './browser.js';
import { createDragonfly } from './model.js';
import { gridToText, rasterizeDragonfly } from './preview.js';
function requireElement(id) {
    const element = document.getElementById(id);
    if (!element)
        throw new Error(`Dragonfly demo requires #${id}`);
    return element;
}
function initializeDragonflyDemo() {
    const canvas = requireElement('dragonfly');
    const pause = requireElement('pause');
    const dart = requireElement('dart');
    const dartLabel = requireElement('dart-label');
    const reset = requireElement('reset');
    const motion = requireElement('motion');
    const view = requireElement('view');
    const guide = requireElement('guide');
    const neutral = requireElement('neutral');
    const phase = requireElement('phase');
    const motionLabel = requireElement('motion-label');
    const actionStatus = requireElement('action-status');
    const textFrame = requireElement('text-frame');
    const capture = requireElement('capture');
    const fallback = requireElement('canvas-fallback');
    let host = null;
    const teardown = [];
    function status(value) {
        pause.textContent = value.paused ? 'Resume' : 'Pause';
        pause.setAttribute('aria-pressed', String(value.paused));
        const still = value.reducedMotion || value.motion === 'static' || value.paused;
        dartLabel.textContent = still ? 'Change pose' : 'Invite a dart';
        phase.textContent = still ? (value.paused ? 'Paused' : 'Still specimen') : ({ idle: 'Hovering', approach: 'Following', dart: 'Darting', recover: 'Settling', cooldown: 'Resting' }[value.behavior] ?? value.behavior);
        motionLabel.textContent = value.reducedMotion ? 'REDUCED MOTION · STILL' : `${value.requestedMotion.toUpperCase()} MOTION`;
    }
    function listen(target, event, action) {
        target.addEventListener(event, action);
        teardown.push(() => target.removeEventListener(event, action));
    }
    function announce(message) { actionStatus.textContent = message; }
    try {
        host = mountDragonfly(canvas, { onStatus: status });
        listen(pause, 'click', () => {
            if (!host)
                return;
            host.setPaused(!host.getStatus().paused);
            announce(host.getStatus().paused ? 'Paused. Change pose remains available.' : host.getStatus().reducedMotion ? 'Reduced-motion preference keeps the specimen still.' : 'Playback resumed.');
        });
        listen(dart, 'click', () => {
            if (!host)
                return;
            const before = host.getStatus();
            host.dart();
            announce(before.paused || before.motion === 'static' || before.reducedMotion ? 'Alternate still pose.' : before.behavior === 'recover' || before.behavior === 'cooldown' || before.behavior === 'dart' ? 'The dragonfly is settling. Another dart will be available shortly.' : 'A short dart, then a steady hover.');
        });
        listen(reset, 'click', () => { host?.reset(); guide.value = 'free'; announce('Returned to the original seed and pose. Pause and motion preferences are preserved.'); });
        listen(motion, 'change', () => { host?.configure({ motion: motion.value }); announce(host?.getStatus().reducedMotion ? 'Your system requests reduced motion. The specimen stays still.' : `${motion.selectedOptions[0]?.textContent ?? 'Motion'} selected.`); });
        listen(view, 'change', () => { host?.setView(view.value); announce('View changed.'); });
        listen(neutral, 'change', () => { host?.setNeutral(neutral.checked); announce(neutral.checked ? 'Neutral silhouette.' : 'Material tones restored.'); });
        listen(guide, 'change', () => {
            if (!host)
                return;
            const targets = { left: [-0.8, 0], right: [0.8, 0], up: [0, -0.8], down: [0, 0.8], center: [0, 0] };
            const target = targets[guide.value];
            if (target)
                host.setTarget(target[0], target[1]);
            else
                host.clearTarget();
            announce(target ? `Guide: ${guide.selectedOptions[0]?.textContent ?? 'center'}.` : 'Free hover.');
        });
        listen(capture, 'click', () => { if (host)
            textFrame.textContent = host.exportText(); announce('Captured one character frame.'); });
        textFrame.textContent = host.exportText();
        listen(window, 'pagehide', () => { for (const remove of teardown.splice(0))
            remove(); host?.dispose(); host = null; });
        // A deliberate local review handle; no telemetry, upload or external service.
        Object.defineProperty(window, 'dragonflyPreview', { value: host, configurable: true });
    }
    catch (error) {
        for (const remove of teardown.splice(0))
            remove();
        host?.dispose();
        host = null;
        fallback.hidden = false;
        canvas.hidden = true;
        for (const control of [pause, dart, reset, motion, view, guide, neutral])
            control.disabled = true;
        const poster = createDragonfly({ motion: 'static' });
        textFrame.textContent = gridToText(rasterizeDragonfly(poster.sample(), { cols: 72, rows: 44, view: 'dorsal', neutral: true }));
        poster.dispose();
        capture.disabled = true;
        announce(error instanceof Error ? error.message : 'The character canvas is unavailable.');
    }
}
// The entry is also safe to import during server-side module inspection.
if (typeof document !== 'undefined')
    initializeDragonflyDemo();
