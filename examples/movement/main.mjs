import { mountMovementControls } from './controls.mjs';

/** A package consumer, intentionally independent of navigation and React.
 * Returns one disposer for the artwork, view and local handlers. The shell can
 * pass an AbortSignal to cancel a lazy import during a route change. */
export async function mountMarineJourneyDemo({ canvas, controlsHost, signal }) {
  if (signal?.aborted) return null;
  const { createMarineMovementArtwork } = await import('ascii-animals-review/movement/marine');
  if (signal?.aborted) return null;
  const artwork = createMarineMovementArtwork(canvas, {
    enabled: true, path: 'horizontal', direction: 'forward', seed: 17,
    timing: { mode: 'duration', seconds: 16 }, lingerSeconds: 2,
    edgePadding: 32, lanes: 3, staggerSeconds: 1.3, repeat: true
  }, {
    species: 'manta', speciesByAnimal: ['manta', 'cuttlefish', 'octopus'],
    count: 3, size: .5, sizeVariation: .1, scene: 'reactive',
    formation: 'independent', followPointer: true, showLabels: false,
    seed: 17, glow: true, density: 1.1, depthStrength: .7
  });
  const document = canvas.ownerDocument;
  const view = document.defaultView;
  const disposers = [];
  let controls, disposed = false;
  let durationSeconds = 16, speedPixelsPerSecond = 85;
  function listen(target, event, listener) {
    target.addEventListener(event, listener);
    disposers.push(() => target.removeEventListener(event, listener));
  }
  function refresh() { controls?.refresh(); }
  const port = {
    getMovementControls() {
      const options = artwork.getMovementOptions(), state = artwork.getMovementState();
      const paused = artwork.getStats().paused;
      const travel = state.playbackDirection < 0 ? 'Rewinding the current journey' : 'Travelling forward';
      return {
        ...options, timing: options.timing.mode, durationSeconds, speedPixelsPerSecond,
        paused, reducedMotion: artwork.reducedMotion,
        status: !options.enabled ? 'Natural scene movement. Journey settings are saved.'
          : artwork.reducedMotion ? 'Static composition for reduced motion.'
          : paused ? 'Paused. Change settings or choose a midpoint still.'
          : `${travel}. Three species share the viewport; each keeps its own reactions.`
      };
    },
    configureMovementControls(patch) {
      const current = artwork.getMovementOptions();
      const nextDuration = patch.durationSeconds ?? durationSeconds;
      const nextSpeed = patch.speedPixelsPerSecond ?? speedPixelsPerSecond;
      const mode = patch.timing ?? current.timing.mode;
      const { timing, durationSeconds: duration, speedPixelsPerSecond: speed, ...rest } = patch;
      artwork.configureMovement({ ...rest, timing: mode === 'duration'
        ? { mode, seconds: nextDuration } : { mode, pixelsPerSecond: nextSpeed } });
      durationSeconds = nextDuration; speedPixelsPerSecond = nextSpeed;
    },
    toggleMovementPause() { artwork.getStats().paused ? artwork.play() : artwork.pause(); },
    reverseMovement() { artwork.reverseMovement(); },
    restartMovement() { artwork.restart(); },
    showMovementStill(progress) { artwork.showMovementStill(progress); }
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const remove of disposers.splice(0)) remove();
    controls?.dispose();
    artwork.dispose();
  }
  try {
    controls = mountMovementControls(controlsHost, port);
    const media = view.matchMedia('(prefers-reduced-motion: reduce)');
    listen(media, 'change', refresh);
    listen(canvas, 'keydown', event => {
      if (event.target !== canvas) return;
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (event.key === ' ') port.toggleMovementPause();
        else artwork.pulse();
        refresh();
      }
    });
    if (signal) listen(signal, 'abort', dispose);
    if (signal?.aborted) { dispose(); return null; }
    // Start the running sample near the viewport edge. A reduced-motion mount
    // retains its meaningful poster and an untouched simulation clock.
    if (!artwork.getStats().paused) artwork.seekMovement(Math.round(artwork.getMovementState().durationTicks * .22));
    return Object.freeze({ artwork, controls, port, refresh, dispose });
  } catch (error) { dispose(); throw error; }
}
