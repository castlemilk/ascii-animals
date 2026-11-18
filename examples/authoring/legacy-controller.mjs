/**
 * Review draft: thin policy bridge for the existing CuttlefishArtwork browser API.
 * Baseline: ascii-animals 7e5984d34a139b8de4643f1ed0607897a42d88dc.
 * Original adapter code; no geometry, renderer source, assets, or fonts copied.
 */
export function createLegacyCuttlefishController(canvas, {
  Artwork,
  options = {},
  onStateChange = () => {},
  environment = {
    document: globalThis.document,
    matchMedia: globalThis.matchMedia?.bind(globalThis),
    ResizeObserver: globalThis.ResizeObserver,
    IntersectionObserver: globalThis.IntersectionObserver,
  },
} = {}) {
  if (!canvas || typeof canvas.getBoundingClientRect !== 'function') {
    throw new TypeError('Provide a canvas element with an explicit display size.');
  }
  if (typeof Artwork !== 'function') throw new TypeError('Provide the loaded CuttlefishArtwork constructor.');
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Options must be an object.');
  if (typeof onStateChange !== 'function') throw new TypeError('onStateChange must be a function.');
  const {document: doc, matchMedia, ResizeObserver, IntersectionObserver} = environment;
  if (!doc?.addEventListener || !doc?.removeEventListener || typeof matchMedia !== 'function'
    || typeof ResizeObserver !== 'function' || typeof IntersectionObserver !== 'function') {
    throw new Error('This example requires document events, matchMedia, ResizeObserver and IntersectionObserver.');
  }
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  if (!media?.addEventListener || !media?.removeEventListener) {
    throw new Error('This example requires the modern MediaQueryList change event API.');
  }

  let artwork, sizeObserver, viewportObserver;
  let requestedPlay = false, running = false, disposed = false;
  let inViewport = false; // Wait for observation; do not animate before visibility is known.
  let reducedMotion = Boolean(media.matches), hidden = Boolean(doc.hidden);
  let hasSize = measureSize();
  let previousSignature = '';
  const removers = [];

  function measureSize() {
    const {width, height} = canvas.getBoundingClientRect();
    return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  }
  function getState() {
    const blockedBy = [];
    if (disposed) blockedBy.push('destroyed');
    if (!requestedPlay) blockedBy.push('user-paused');
    if (reducedMotion) blockedBy.push('reduced-motion');
    if (hidden) blockedBy.push('hidden');
    if (!inViewport) blockedBy.push('offscreen');
    if (!hasSize) blockedBy.push('zero-size');
    return Object.freeze({requestedPlay, running, disposed, reducedMotion, hidden,
      inViewport, hasSize, blockedBy: Object.freeze(blockedBy)});
  }
  function publish() {
    const state = getState(), signature = JSON.stringify(state);
    if (signature === previousSignature) return;
    previousSignature = signature;
    try {
      onStateChange(state);
    } catch (error) {
      // A failed consumer callback must not leave a live, unowned animation.
      try { release(); } catch { /* Preserve the original consumer error. */ }
      throw error;
    }
  }
  function reconcile() {
    if (disposed) return;
    // Re-read synchronous policies on explicit actions as well as observer events.
    // This closes the gap before a queued visibility/media/resize event arrives.
    reducedMotion = Boolean(media.matches);
    hidden = Boolean(doc.hidden);
    hasSize = measureSize();
    const next = requestedPlay && !reducedMotion && !hidden && inViewport && hasSize;
    if (running !== next) {
      artwork.setPaused(!next);
      running = next;
    }
    publish();
  }
  function assertAlive() {
    if (disposed) throw new Error('The cuttlefish controller has been destroyed.');
  }
  function listen(target, type, listener) {
    target.addEventListener(type, listener);
    removers.push(() => target.removeEventListener(type, listener));
  }
  function release() {
    if (disposed) return;
    disposed = true;
    requestedPlay = false;
    running = false;
    // Remove the bridge's resources first, then dispose the existing renderer.
    for (const remove of removers.splice(0).reverse()) remove();
    sizeObserver?.disconnect();
    viewportObserver?.disconnect();
    artwork?.destroy();
  }

  try {
    // Constructor options cannot bypass the bridge's initial paused policy.
    artwork = new Artwork(canvas, {...options, paused: true});
    listen(doc, 'visibilitychange', () => {
      hidden = Boolean(doc.hidden);
      reconcile();
    });
    listen(media, 'change', () => {
      reducedMotion = Boolean(media.matches);
      reconcile();
    });
    sizeObserver = new ResizeObserver(() => {
      if (disposed) return;
      hasSize = measureSize();
      reconcile();
    });
    viewportObserver = new IntersectionObserver(entries => {
      if (disposed) return;
      for (const entry of entries) {
        if (entry.target === canvas) inViewport = Boolean(entry.isIntersecting && entry.intersectionRatio > 0);
      }
      reconcile();
    }, {threshold: [0, 0.01]});
    sizeObserver.observe(canvas);
    viewportObserver.observe(canvas);
    reconcile();
  } catch (error) {
    release();
    throw error;
  }

  return Object.freeze({
    getState,
    play() { assertAlive(); requestedPlay = true; reconcile(); return running; },
    pause() { assertAlive(); requestedPlay = false; reconcile(); },
    setOptions(patch) {
      assertAlive();
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('The option patch must be an object.');
      if (Object.prototype.hasOwnProperty.call(patch, 'paused')) {
        throw new TypeError('Use play() or pause(); setOptions cannot change playback policy.');
      }
      reconcile();
      assertAlive(); // A consumer callback may have disposed the controller.
      artwork.setOptions({...patch});
    },
    getStats() { assertAlive(); return artwork.getStats(); },
    restart() { assertAlive(); reconcile(); assertAlive(); artwork.restart(); },
    pulse() {
      assertAlive();
      reconcile();
      if (!running) return false;
      artwork.pulse();
      // true means permitted and dispatched, not that an animal necessarily reacted.
      return true;
    },
    destroy() {
      if (disposed) return;
      release();
      publish();
    },
  });
}
