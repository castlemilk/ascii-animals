// @ts-check
import { createArtwork } from 'ascii-animals-review';

/** @param {string} id */
function button(id) {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLButtonElement)) throw new Error(`Missing button: ${id}`);
  return element;
}
const canvas = document.getElementById('artwork');
const status = document.getElementById('status');
if (!(canvas instanceof HTMLCanvasElement) || !status) throw new Error('Missing example markup');
const hostCanvas = canvas;
const statusElement = status;
const play = button('play'), pause = button('pause'), restart = button('restart');
const action = button('action'), mountButton = button('mount'), disposeButton = button('dispose');

/** @type {import('ascii-animals-review').Artwork | null} */
let artwork = null;
/** @type {AbortController | null} */
let controls = null;
let restoreState = { mounted: false, paused: true };

/** Own one controller per canvas. This example function is not a package export.
 * @param {boolean} [restorePaused] Previous playback state after page-cache restoration.
 */
export function mount(restorePaused) {
  if (artwork) return artwork;
  const current = createArtwork(hostCanvas, {
    species: 'cuttlefish', scene: 'reactive', count: 1, seed: 17,
    maxFps: 30, maxDpr: 1.5, reducedMotion: 'system',
    // Omit paused so the constructor can honor the OS preference.
  });
  if (restorePaused) current.pause();
  artwork = current;
  controls = new AbortController();
  const { signal } = controls;
  const describe = () => {
    statusElement.textContent = current.getStats().paused ? 'Mounted · paused' : 'Mounted · playing';
  };
  play.addEventListener('click', () => { current.play(); describe(); }, { signal });
  pause.addEventListener('click', () => { current.pause(); describe(); }, { signal });
  restart.addEventListener('click', () => { current.restart(); describe(); }, { signal });
  action.addEventListener('click', () => { current.pulse(); describe(); }, { signal });
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  motion.addEventListener('change', event => {
    if (event.matches) current.pause();
    describe();
  }, { signal });
  for (const control of [play, pause, restart, action, disposeButton]) control.disabled = false;
  mountButton.disabled = true;
  describe();
  return current;
}

/** Release both the package controller and the host's control listeners. */
export function dispose() {
  controls?.abort();
  controls = null;
  artwork?.dispose();
  artwork = null;
  for (const control of [play, pause, restart, action, disposeButton]) control.disabled = true;
  mountButton.disabled = false;
  statusElement.textContent = 'Disposed · last canvas frame retained';
}

/** @param {boolean} [restorePaused] */
function mountSafely(restorePaused) {
  try { mount(restorePaused); }
  catch (error) {
    dispose();
    statusElement.textContent = `Artwork unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}
// These four page-owned listeners live for the document's lifetime.
mountButton.addEventListener('click', () => mountSafely());
disposeButton.addEventListener('click', dispose);
window.addEventListener('pagehide', () => {
  restoreState = { mounted: artwork !== null, paused: artwork?.getStats().paused ?? true };
  dispose();
});
window.addEventListener('pageshow', event => {
  if (event.persisted && restoreState.mounted) {
    const previous = restoreState;
    restoreState = { mounted: false, paused: true };
    // Constructor policy remains authoritative if reduced motion became active away.
    mountSafely(previous.paused);
  }
});
mountSafely();
