import { createCuttlefish } from '../lib/animals/cuttlefish.js';

// Host-owned controls use one abortable listener scope. There is no stats timer.
const element = id => document.getElementById(id);
const controls = new AbortController();
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
let artwork;
function status() {
  const paused = artwork.getStats().paused;
  element('play').disabled = !paused;
  element('pause').disabled = paused;
  element('startle').disabled = paused;
  element('status').textContent = paused ? 'Paused. Press Play to animate.' : 'Playing. Animation rests when the canvas is not visible.';
}
try {
  artwork = createCuttlefish(element('artwork'), { scene: 'reactive', count: 4, paused: true });
  const on = (id, type, callback) => element(id).addEventListener(type, callback, { signal: controls.signal });
  on('play', 'click', () => { artwork.setPaused(false); status(); });
  on('pause', 'click', () => { artwork.setPaused(true); status(); });
  on('restart', 'click', () => { artwork.restart(); status(); });
  on('startle', 'click', () => artwork.pulse());
  on('count', 'change', event => artwork.setOptions({ count: Number(event.target.value) }));
  on('formation', 'change', event => artwork.setOptions({ formation: event.target.value }));
  motion.addEventListener('change', status, { signal: controls.signal });
  window.addEventListener('pagehide', event => {
    if (!event.persisted) { controls.abort(); artwork.destroy(); }
  }, { signal: controls.signal });
  status();
} catch (error) {
  controls.abort(); artwork?.destroy();
  element('status').textContent = `The animation could not start: ${error.message}`;
  document.querySelectorAll('button, select').forEach(control => { control.disabled = true; });
}
