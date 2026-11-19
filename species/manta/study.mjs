import { createMantaReef } from './reef-artwork.mjs';

const byId = id => document.getElementById(id);
const canvas = byId('manta'), buttons = [...document.querySelectorAll('[data-still]')];
const liveHelp = byId('interaction-help').textContent;
let artwork, unsubscribe, disposed = false;
const listeners = [];
function on(target, type, handler) { target.addEventListener(type, handler); listeners.push(() => target.removeEventListener(type, handler)); }
function announce(message) { byId('status').textContent = message; }
function refresh() {
  if (!artwork || disposed) return;
  const state = artwork.getReef();
  byId('phase').textContent = state.phase;
  byId('motion-state').textContent = artwork.paused ? state.still ? 'Still study' : 'Paused' : 'Live study';
  byId('play').textContent = state.still ? 'Resume live' : artwork.paused ? 'Play' : 'Pause';
  byId('play').setAttribute('aria-label', state.still ? 'Resume the saved live manta route' : artwork.paused ? 'Play manta animation' : 'Pause manta animation');
  byId('interaction-help').textContent = state.still ? 'Still study. Resume live returns to the saved route; choose Bank left or Bank right to inspect either side.' : liveHelp;
  for (const button of buttons) button.setAttribute('aria-pressed', String(state.still === button.dataset.still));
  for (const id of ['left-bank', 'right-bank']) byId(id).disabled = !artwork.paused && state.responseAge !== null;
}
function bank(side) {
  if (artwork.bank(side)) announce(artwork.paused ? `A still of the manta banking ${side < 0 ? 'left' : 'right'}.` : `The manta will bank ${side < 0 ? 'left' : 'right'}, then slowly recover.`);
  refresh();
}
function destroy() {
  if (disposed) return;
  disposed = true; unsubscribe?.(); listeners.splice(0).forEach(off => off()); artwork?.destroy();
}
try {
  artwork = createMantaReef(canvas);
  on(byId('play'), 'click', () => { artwork.setPaused(!artwork.paused); refresh(); announce(artwork.paused ? 'Animation paused.' : 'Animation playing.'); });
  on(byId('left-bank'), 'click', () => bank(-1));
  on(byId('right-bank'), 'click', () => bank(1));
  on(byId('current'), 'change', () => { artwork.setReef({current:Number(byId('current').value)}); refresh(); announce('The current direction has changed.'); });
  for (const button of buttons) on(button, 'click', () => { artwork.showReefStill(button.dataset.still); refresh(); announce(`${button.textContent} still selected. Animation is paused.`); });
  on(byId('habitat'), 'change', () => { artwork.setReef({habitat:byId('habitat').checked}); refresh(); });
  on(byId('points'), 'change', () => { artwork.setOptions({mode:byId('points').checked ? 'points' : 'ascii'}); refresh(); });
  on(byId('restart'), 'click', () => { artwork.restart(); refresh(); announce('The study restarted. Playback setting preserved.'); });
  on(canvas, 'keydown', event => {
    if (event.repeat) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); bank(event.key === 'ArrowLeft' ? -1 : 1); }
    else if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); artwork.setPaused(!artwork.paused); refresh(); }
    else if (event.key === 'Escape') { artwork.setPaused(true); refresh(); }
  });
  on(canvas, 'pointerup', refresh);
  on(document, 'visibilitychange', refresh);
  // A sparse status timer only reads snapshots. It never drives simulation.
  const timer = setInterval(refresh, 300); unsubscribe = () => clearInterval(timer);
  on(window, 'pagehide', event => { if (event.persisted) { artwork.setPaused(true); refresh(); } else destroy(); });
  on(window, 'pageshow', refresh);
  refresh();
} catch (error) {
  destroy();
  byId('error').hidden = false;
  byId('error').textContent = `The manta study could not start: ${error.message}`;
  document.querySelectorAll('button,select,input').forEach(control => { control.disabled = true; });
}
