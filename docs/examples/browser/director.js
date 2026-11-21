// @ts-check
import { createMarineDirector } from 'ascii-animals-review/cuttlefish';

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
const play = button('play'), pause = button('pause'), left = button('invite-left');
const right = button('invite-right'), release = button('release'), still = button('still');
const disturb = button('disturb'), mountButton = button('mount'), disposeButton = button('dispose');
const ownedButtons = [play, pause, left, right, release, still, disturb, disposeButton];

/** @type {import('ascii-animals-review/cuttlefish').CuttlefishArtwork | null} */
let marine = null;
/** @type {AbortController | null} */
let controls = null;
let restoreState = { mounted: false, paused: true };

/** This factory returns the legacy marine controller: setPaused / destroy.
 * @param {boolean} [restorePaused] Previous playback state after page-cache restoration.
 */
export function mount(restorePaused) {
  if (marine) return marine;
  const current = createMarineDirector(hostCanvas, {
    scene: 'tidepool-investigation', focus: 2,
    roles: ['guide', 'forager', 'sentinel'],
  }, {
    species: 'manta', speciesByAnimal: ['manta', 'octopus', 'cuttlefish'],
    count: 3, seed: 17, size: 0.7, density: 0.9,
    maxDpr: 1.5, maxFps: 30, reducedMotion: 'system', paused: true,
  });
  marine = current;
  controls = new AbortController();
  const { signal } = controls;
  /** @param {string} action */
  const describe = action => {
    statusElement.textContent = `${action} · ${current.paused ? 'paused' : 'playing'}`;
  };
  play.addEventListener('click', () => { current.setPaused(false); describe('Scene'); }, { signal });
  pause.addEventListener('click', () => { current.setPaused(true); describe('Scene'); }, { signal });
  left.addEventListener('click', () => {
    current.setDirector({ focus: 2 });
    current.cueDirector({ type: 'invite', x: -0.3, y: 0.1 }); describe('Invited left');
  }, { signal });
  right.addEventListener('click', () => {
    current.setDirector({ focus: 2 });
    current.cueDirector({ type: 'invite', x: 0.3, y: 0.1 }); describe('Invited right');
  }, { signal });
  release.addEventListener('click', () => { current.cueDirector({ type: 'release' }); describe('Released'); }, { signal });
  still.addEventListener('click', () => { current.showDirectorStill('explore'); describe('Explore still'); }, { signal });
  disturb.addEventListener('click', () => {
    current.cueDirector({ type: 'disturb', id: 2 }); describe('Disturb requested');
  }, { signal });
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  motion.addEventListener('change', event => {
    if (event.matches) current.setPaused(true);
    describe('Scene');
  }, { signal });
  for (const control of ownedButtons) control.disabled = false;
  mountButton.disabled = true;
  current.showDirectorStill('explore');
  if (restorePaused === false && !motion.matches) current.setPaused(false);
  describe(restorePaused === undefined ? 'Explore still' : 'Restored scene');
  return current;
}

export function dispose() {
  controls?.abort();
  controls = null;
  marine?.destroy();
  marine = null;
  for (const control of ownedButtons) control.disabled = true;
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
  restoreState = { mounted: marine !== null, paused: marine?.paused ?? true };
  dispose();
});
window.addEventListener('pageshow', event => {
  if (event.persisted && restoreState.mounted) {
    const previous = restoreState;
    restoreState = { mounted: false, paused: true };
    mountSafely(previous.paused);
  }
});
mountSafely();
