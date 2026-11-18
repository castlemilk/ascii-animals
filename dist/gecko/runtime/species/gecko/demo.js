import { createGeckoArtwork as mountGecko } from '../../public/gecko.js';
import { createGecko } from './gecko.js';
import { renderGeckoGrid } from './preview.js';
/** Exported for deliberate local inspection; no window singleton is installed. */
export let geckoDemo = null;
function element(id) {
    const node = document.getElementById(id);
    if (!node)
        throw new Error(`Missing gecko demo element: ${id}`);
    return node;
}
const canvas = element('gecko');
const phase = element('phase');
const pause = element('pause');
const help = element('scene-help');
const feedback = element('action-status');
const fallback = element('fallback');
const fallbackMessage = element('fallback-message');
const frame = element('text-frame');
const titles = {
    idle: 'Resting', approach: 'Curious', startle: 'A little startled', retreat: 'Stepping back', recover: 'Finding courage', cooldown: 'Taking a moment'
};
const listeners = [];
function listen(target, event, handler) {
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
}
function announce(message) { feedback.textContent = message; }
function refresh(status) {
    phase.textContent = status.reducedMotion ? 'Still portrait' : status.paused ? 'Paused' : titles[status.phase];
    pause.textContent = status.paused ? 'Play' : 'Pause';
    pause.setAttribute('aria-pressed', String(status.paused));
    pause.setAttribute('aria-label', status.paused ? 'Play gecko animation' : 'Pause gecko animation');
    help.textContent = status.reducedMotion
        ? 'Reduced motion: Startle selects a still pose.'
        : status.paused ? 'A quiet moment. Play when you are ready.' : 'Move gently to invite a few steps.';
    fallback.hidden = !(status.tooSmall || status.zeroSize);
    if (status.tooSmall)
        fallbackMessage.textContent = 'This gecko needs 360 pixels of space. Its plain-text portrait is still available below.';
}
function refreshText() {
    if (geckoDemo)
        frame.textContent = geckoDemo.exportText();
    else {
        const poster = createGecko();
        try {
            frame.textContent = renderGeckoGrid(poster.getSnapshot(), { cols: 112, rows: 50 }).text;
        }
        finally {
            poster.dispose();
        }
    }
}
try {
    geckoDemo = mountGecko(canvas, { onStatus: refresh });
    listen(pause, 'click', () => {
        if (!geckoDemo)
            return;
        const paused = !geckoDemo.getStatus().paused;
        geckoDemo.setPaused(paused);
        announce(paused ? 'Paused. Take your time.' : geckoDemo.getStatus().reducedMotion ? 'Reduced motion keeps the portrait still.' : 'The gecko is moving again.');
    });
    listen(element('reset'), 'click', () => {
        geckoDemo?.reset();
        announce('Back to the beginning. Your playback preference is preserved.');
    });
    listen(element('startle'), 'click', () => {
        const action = geckoDemo?.startle();
        announce(action?.outcome === 'static' ? 'A still pose with a curled tail.' : 'A small surprise. Give the gecko a moment to recover.');
    });
    for (const button of document.querySelectorAll('[data-guide]')) {
        listen(button, 'click', () => {
            const [x, y] = (button.dataset.guide ?? '').split(',').map(Number);
            if (x === undefined || y === undefined)
                return;
            const action = geckoDemo?.guide(x, y);
            announce(action?.outcome === 'ignored' ? 'The portrait is still. Play to invite steps when motion is enabled.' : 'A new direction to explore.');
        });
    }
    listen(element('rest'), 'click', () => { geckoDemo?.clearGuide(); announce('No need to hurry.'); });
    listen(element('pace'), 'input', event => {
        const value = Number(event.currentTarget.value);
        geckoDemo?.update({ creepSpeed: value });
        element('pace-value').textContent = value < .07 ? 'Slow' : value > .13 ? 'Brisk' : 'Gentle';
    });
    listen(element('curl'), 'input', event => {
        const value = Number(event.currentTarget.value);
        geckoDemo?.update({ curlStrength: value });
        element('curl-value').textContent = `${Math.round(value * 100)}%`;
    });
    listen(element('neutral'), 'change', event => {
        geckoDemo?.setView({ neutral: event.currentTarget.checked });
    });
}
catch (error) {
    geckoDemo?.dispose();
    geckoDemo = null;
    for (const release of listeners.splice(0).reverse())
        release();
    fallback.hidden = false;
    fallbackMessage.textContent = 'The animated canvas is unavailable here. The gecko has a broad head, four splayed pad-toed feet, and a long attached tail. Its plain-text portrait is available below.';
    phase.textContent = 'Text portrait';
    help.textContent = 'A quiet text portrait is available below.';
    for (const control of document.querySelectorAll('.interaction-panel button, .interaction-panel input, .playback button'))
        control.disabled = true;
    announce('Animation unavailable; the plain-text portrait remains usable.');
    console.warn('Gecko canvas unavailable', error);
}
listen(element('refresh-text'), 'click', refreshText);
listen(element('text-details'), 'toggle', event => {
    if (event.currentTarget.open)
        refreshText();
});
refreshText();
function disposeDemo() {
    geckoDemo?.dispose();
    for (const release of listeners.splice(0).reverse())
        release();
}
listen(window, 'pagehide', event => {
    // A persisted page keeps both its controller and controls. The controller
    // suspends on pagehide and redraws on pageshow without clearing user pause.
    if (!event.persisted)
        disposeDemo();
});
