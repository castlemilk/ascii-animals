import { createFoxArtwork as mountFox } from './runtime/public/fox.js';
import { staticFoxPose } from './runtime/species/fox/model.js';
import { buildFoxGrid } from './runtime/species/fox/preview.js';

const byId = id => document.getElementById(id);
const canvas = byId('fox');
const actions = new AbortController();
let controller;
const announce = message => { byId('action-status').textContent = message; };
const labels = { idle: 'At rest', stalk: 'Cautious steps', sniff: 'Investigating', crouch: 'Preparing',
  airborne: 'In the air', landing: 'Forepaws first', recover: 'Settling', cooldown: 'Taking a breath' };
function displayStatus(status) {
  byId('phase').textContent = status.staticPose ? `Still · ${status.staticPose}` : labels[status.phase];
  byId('pause').textContent = status.paused ? 'Resume' : 'Pause';
  byId('pause').setAttribute('aria-pressed', String(status.paused));
  byId('motion-note').textContent = status.reducedMotion
    ? 'Reduced motion: controls select still poses. Automatic motion stays off.'
    : status.paused ? 'Paused. Reset and settings preserve your pause.' : 'Motion runs only while this study is visible.';
}
function listen(id, event, callback) {
  byId(id).addEventListener(event, () => {
    try { callback(); } catch (error) { announce(`Could not apply the change: ${error.message}`); }
  }, { signal: actions.signal });
}

try {
  controller = mountFox(canvas, { fox: { seed: 17 }, onStatus: displayStatus });
  listen('pounce', 'click', () => {
    controller.pounce();
    const status = controller.getStatus();
    announce(status.paused || status.reducedMotion ? 'Static crouch shown. Playback remains still.' : 'Pounce requested. The fox crouches before it leaps; another pounce is available after recovery.');
  });
  listen('pause', 'click', () => {
    controller.setPaused(!controller.getStatus().paused);
    const status = controller.getStatus();
    announce(status.reducedMotion ? 'Reduced motion remains active.' : status.paused ? 'Animation paused.' : 'Animation resumed.');
  });
  listen('reset', 'click', () => {
    controller.reset(17); byId('guide').value = 'none'; announce('Seed 17 restored. Settings and your pause choice are preserved.');
  });
  listen('guide', 'change', () => {
    const value = byId('guide').value;
    if (value === 'none') controller.leave();
    else controller.guide({ left: -.8, center: 0, right: .8 }[value], .15);
    announce(value === 'none' ? 'Guide removed.' : `Guide placed ${value === 'center' ? 'near the center' : `to the ${value}`}.`);
  });
  listen('facing', 'change', () => { controller.configure({ facing: byId('facing').value }); announce('Side profile updated. An active pounce finishes with its original settings.'); });
  listen('tail', 'input', () => { const value = Number(byId('tail').value); controller.configure({ tailSway: value }); byId('tail-value').textContent = value.toFixed(3); });
  listen('height', 'input', () => { const value = Number(byId('height').value); controller.configure({ pounceHeight: value }); byId('height-value').textContent = value.toFixed(2); });
  listen('show-poster', 'click', () => { controller.showStaticPose(byId('poster').value); announce('Still specimen shown. Playback is paused.'); });
  listen('capture', 'click', () => { byId('text-frame').textContent = controller.exportText(); announce('Current character frame captured below.'); });
} catch (error) {
  const specimen = buildFoxGrid(staticFoxPose({ seed: 17 }), { cols: 80, rows: 32 });
  byId('text-frame').textContent = specimen.text;
  document.querySelector('.text-export').open = true;
  canvas.hidden = true;
  for (const element of document.querySelectorAll('.director button,.director input,.director select')) element.disabled = true;
  byId('capture').disabled = true;
  byId('phase').textContent = 'Text specimen';
  announce(`The interactive Canvas preview is unavailable. A static character specimen is available below. ${error.message}`);
}

// A bfcache entry retains its mount, whose visibility handler suspends work.
// A genuine departure releases the preview and this page's control listeners.
window.addEventListener('pagehide', event => {
  if (!event.persisted) { controller?.dispose(); actions.abort(); }
}, { signal: actions.signal });
