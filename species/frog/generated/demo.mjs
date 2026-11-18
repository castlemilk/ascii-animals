import { mountFrog } from './controller.mjs';
const canvas = document.querySelector('#frog');
const status = document.querySelector('#status');
const pause = document.querySelector('#pause');
const target = document.querySelector('#target');
const poses = document.querySelector('#pose');
const cleanups = [];
let controller;
const presets = { right: { x: .7, y: .35 }, left: { x: -.7, y: .35 }, center: { x: 0, y: .2 }, far: { x: .2, y: -.65 } };
function on(selector, event, fn) {
    const element = document.querySelector(selector);
    element.addEventListener(event, fn);
    cleanups.push(() => element.removeEventListener(event, fn));
}
function sync() { if (!controller)
    return; const s = controller.getStatus(); pause.textContent = s.paused ? 'Resume' : 'Pause'; pause.setAttribute('aria-pressed', String(s.paused)); }
try {
    await document.fonts?.ready;
    controller = mountFrog(canvas, { onAction: message => { status.textContent = message; sync(); } });
    if (controller.getStatus().reducedMotion)
        status.textContent = 'Reduced motion is active. Leap cycles static poses; no automatic movement.';
    on('#leap', 'click', () => controller.leap());
    on('#pause', 'click', () => { controller.setPaused(!controller.getStatus().paused); poses.value = ''; sync(); });
    on('#reset', 'click', () => { controller.reset(); poses.value = ''; sync(); });
    on('#target', 'change', () => { if (presets[target.value])
        controller.target(presets[target.value]);
    else
        controller.clearTarget(); });
    on('#pose', 'change', () => { if (poses.value)
        controller.setStaticPose(poses.value); sync(); });
    on('#view', 'change', event => controller.updatePreview({ view: event.target.value }));
    on('#size', 'change', event => controller.updateConfig({ size: Number(event.target.value) }));
    on('#height', 'change', event => controller.updateConfig({ jumpHeight: Number(event.target.value) }));
    on('#silhouette', 'change', event => controller.updatePreview({ silhouette: event.target.checked }));
    on('#text', 'click', () => { const pre = document.querySelector('#specimen'); pre.textContent = controller.exportText(); pre.hidden = false; });
    const dispose = () => { for (const remove of cleanups.splice(0))
        remove(); controller?.dispose(); };
    const pagehide = () => dispose();
    window.addEventListener('pagehide', pagehide, { once: true });
    cleanups.push(() => window.removeEventListener('pagehide', pagehide));
    // Debug hook is demo-local; no package/global engine API is established.
    Object.defineProperty(window, '__frogDemo', { value: Object.freeze({ controller, dispose }), configurable: true });
}
catch (error) {
    for (const remove of cleanups.splice(0))
        remove();
    controller?.dispose();
    canvas.hidden = true;
    document.querySelector('#fallback').hidden = false;
    for (const control of document.querySelectorAll('button,input,select'))
        control.disabled = true;
    status.textContent = error instanceof Error ? error.message : 'The interactive frog could not initialize.';
}
