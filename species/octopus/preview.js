import { CuttlefishArtwork } from '../../lib/animals/cuttlefish.js';

// An octopus-only example using the existing marine class. The class owns all
// animation, drawing, pointer response and scheduling; this shell owns controls.
const PREVIEW_OPTIONS = Object.freeze({
  species: 'octopus', speciesByAnimal: [], count: 1, scene: 'reactive',
  formation: 'independent', behaviors: ['hover'], size: 1.3, sizeVariation: 0,
  density: 1.45, palette: 'ember', glow: false, seed: 17, followPointer: true,
  autoStart: true, reducedMotion: 'system', observeVisibility: true,
});
const clampAim = value => Math.max(-.42, Math.min(.42, value));

export function mountOctopusPreview(doc = document, Artwork = CuttlefishArtwork) {
  const view = doc.defaultView;
  const ids = ['octopus-canvas', 'examine', 'release', 'startle', 'pause', 'restart',
    'action-status', 'playback-state', 'motion-note'];
  const nodes = Object.fromEntries(ids.map(id => [id, doc.getElementById(id)]));
  if (!view || ids.some(id => !nodes[id])) throw new Error('The octopus study is missing a required control.');
  const canvas = nodes['octopus-canvas'], status = nodes['action-status'];
  const scope = new view.AbortController();
  const artwork = new Artwork(canvas, PREVIEW_OPTIONS);
  const motion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  let disposed = false, aim = [.08, .20];
  const on = (target, type, callback, options = {}) => target?.addEventListener(type, callback, { ...options, signal: scope.signal });
  const announce = text => { if (!disposed) status.textContent = text; };
  const pausedMessage = 'The study is still. Choose Play to see a movement sequence; the controls will not resume it automatically.';

  function syncPlayback() {
    if (disposed) return;
    const paused = artwork.paused;
    nodes.pause.textContent = paused ? 'Play' : 'Pause';
    nodes.pause.setAttribute('aria-label', paused ? 'Play animation' : 'Pause animation');
    nodes['playback-state'].textContent = paused ? 'Still' : 'Playing';
    nodes['motion-note'].hidden = !motion?.matches;
    nodes['motion-note'].textContent = paused
      ? 'Reduced motion is on. The study stays still. Choose Play when you want to animate it.'
      : 'Reduced motion is on. You chose to play the animation; Pause returns to a still.';
  }

  function sendPointer(type, point = aim) {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    canvas.dispatchEvent(new view.PointerEvent(type, {
      clientX: r.left + (point[0] + .5) * r.width,
      clientY: r.top + (point[1] + .5) * r.height,
      pointerType: 'touch', bubbles: false,
    }));
    return true;
  }

  function examine(restartCue = false) {
    if (disposed) return;
    if (artwork.paused) { announce(pausedMessage); return; }
    if (artwork.getStats().reactionStage !== 'idle') {
      announce('Let the octopus finish its departure and return before inviting another reach.'); return;
    }
    if (restartCue) {
      // A deliberate button/Enter request can repeat at the same location.
      // Sample the release edge without advancing time; the species handles
      // any ongoing peel/recovery before accepting the next examination.
      sendPointer('pointerleave'); artwork.render();
    }
    if (sendPointer('pointermove')) {
      if (restartCue) artwork.render();
      announce('Invitation set. Watch for the small turn before neighbouring arms unfold.');
    }
  }

  function release() {
    if (disposed) return;
    sendPointer('pointerleave');
    announce(artwork.paused ? 'Invitation cleared. The study remains still.' : 'Invitation released. The reaching tips peel back toward the den.');
  }

  function startle() {
    if (disposed) return;
    if (artwork.paused) { announce(pausedMessage); return; }
    if (artwork.getStats().reactionStage !== 'idle') {
      announce('The octopus is already responding. Its arms will settle at different moments on the return.'); return;
    }
    artwork.pulse();
    announce('A disturbance: gather, ink, then a mantle-first departure. Give it time to return.');
  }

  function togglePlayback() {
    if (disposed) return;
    artwork.setPaused(!artwork.paused); syncPlayback();
    announce(artwork.paused ? 'Paused. The current pose is held.' : 'Playing. Move gently or choose Examine to invite a reach.');
  }

  function restart() {
    if (disposed) return;
    artwork.restart(); aim = [.08, .20]; syncPlayback();
    announce(artwork.paused ? 'Restarted as a still. Choose Play when you are ready.' : 'The octopus is back in its den. A fresh study begins.');
  }

  function dispose() {
    if (disposed) return;
    disposed = true; scope.abort(); artwork.destroy();
  }

  try {
    on(nodes.examine, 'click', () => examine(true));
    on(nodes.release, 'click', release);
    on(nodes.startle, 'click', startle);
    on(nodes.pause, 'click', togglePlayback);
    on(nodes.restart, 'click', restart);
    on(canvas, 'pointermove', event => {
      if (disposed || artwork.paused || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
      const r = canvas.getBoundingClientRect(); if (!r.width || !r.height) return;
      aim = [clampAim((event.clientX - r.left) / r.width - .5), clampAim((event.clientY - r.top) / r.height - .5)];
    }, { passive: true });
    on(canvas, 'pointerdown', event => {
      if (disposed || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY) || event.button > 0) return;
      if (artwork.paused) { announce(pausedMessage); return; }
      // The canonical pointerdown listener runs first. An animal hit has
      // already started its reaction; leave that response untouched. In this
      // solo reactive scene, an idle result is an empty-water invitation.
      if (artwork.getStats().reactionStage !== 'idle') {
        announce('The octopus gathers its arms before departing. Watch the slower, uneven return.'); return;
      }
      const r = canvas.getBoundingClientRect(); if (!r.width || !r.height) return;
      aim = [clampAim((event.clientX - r.left) / r.width - .5), clampAim((event.clientY - r.top) / r.height - .5)];
      examine(true);
    }, { passive: true });
    on(canvas, 'keydown', event => {
      if (disposed || event.target !== canvas || event.altKey || event.ctrlKey || event.metaKey) return;
      const moves = { ArrowLeft: [-.045, 0], ArrowRight: [.045, 0], ArrowUp: [0, -.045], ArrowDown: [0, .045] };
      const move = moves[event.key];
      const action = event.key === 'Enter' ? () => examine(true) : event.key.toLowerCase() === 'j' ? startle
        : event.key === ' ' ? togglePlayback : event.key === 'Escape' ? release : null;
      if (!move && !action) return;
      event.preventDefault();
      if (event.repeat && !move) return;
      if (move) {
        if (artwork.paused) { announce(pausedMessage); return; }
        aim = [clampAim(aim[0] + move[0]), clampAim(aim[1] + move[1])]; examine();
      } else action();
    });
    on(motion, 'change', () => {
      syncPlayback();
      if (motion.matches) announce('Reduced motion is on. The current pose is held; choose Play only when you want movement.');
    });
    // A cached history entry resumes this same document. Keep its controls and
    // renderer alive; ordinary navigation still releases both.
    on(view, 'pagehide', event => { if (!event.persisted) dispose(); });
    syncPlayback();
    announce(artwork.paused ? 'A still view of the den. Choose Play when you want to explore its movement.'
      : 'The den is quiet. Move gently, tap the water, or choose Examine.');
  } catch (error) { dispose(); throw error; }
  return Object.freeze({ dispose, getStats: () => artwork.getStats() });
}

if (typeof document !== 'undefined') {
  try { mountOctopusPreview(document); }
  catch (error) {
    const status = document.getElementById('action-status');
    if (status) { status.textContent = 'This study could not start. Canvas 2D and the built animal module must be available.'; status.dataset.error = 'true'; }
    for (const control of document.querySelectorAll('[data-action]')) control.disabled = true;
  }
}
