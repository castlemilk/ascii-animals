import type { SeahorseArtwork, SeahorseBrowserOptions } from '../../../../lib/public/seahorse.js';

/** Private counterpart of the gallery's lifecycle shape; no shared import or registration. */
export interface BrassButtonMountOptions {
  readonly paused: boolean;
  readonly reducedMotion: boolean;
  readonly signal?: AbortSignal;
  readonly label?: string;
  readonly descriptionId?: string;
  readonly configuration?: SeahorseBrowserOptions;
}

export interface BrassButtonSession {
  readonly species: 'seahorse';
  readonly variation: 'brass-button';
  readonly element: HTMLCanvasElement;
  readonly canvas: HTMLCanvasElement;
  readonly controller: SeahorseArtwork;
  readonly disposed: boolean;
  play(): void;
  pause(): void;
  restart(): void;
  setReducedMotion(value: boolean): void;
  dispose(): void;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('Brass Button load cancelled.', 'AbortError');
}

/**
 * Explicit opt-in seam for a future host-owned choice. Original remains the
 * shared gallery's default. When changing a choice, the host first aborts any
 * pending load and disposes its current session, then awaits this mount using
 * a fresh signal. The returned session fits the existing one-renderer lifecycle:
 *
 * current?.dispose();
 * current = await mountBrassButton(host, { paused, reducedMotion, signal });
 *
 * No selector, route, public export, global switch state or animation loop is
 * installed here. Importing this module alone creates no DOM or subscriptions.
 * The host's VariationId/RendererSession unions do not yet include Brass Button;
 * their future registration and dispatch remain with the shared integration owner.
 */
export async function mountBrassButton(host: HTMLElement, options: BrassButtonMountOptions): Promise<BrassButtonSession> {
  if (!host?.ownerDocument?.defaultView) throw new TypeError('A browser host is required.');
  if (typeof options?.paused !== 'boolean' || typeof options.reducedMotion !== 'boolean')
    throw new TypeError('Explicit pause and reduced-motion policies are required.');
  throwIfAborted(options.signal);
  const { createBrassButtonArtwork } = await import('./runtime.js');
  throwIfAborted(options.signal);
  const motion = host.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)');

  const canvas = host.ownerDocument.createElement('canvas');
  canvas.dataset.rendererSpecies = 'seahorse';
  canvas.dataset.rendererVariation = 'brass-button';
  canvas.className = 'renderer-canvas';
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.minWidth = '0';
  canvas.style.touchAction = 'pan-y';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', options.label ?? 'Brass Button, an ASCII seahorse gripping eelgrass.');
  if (options.descriptionId) canvas.setAttribute('aria-describedby', options.descriptionId);
  canvas.textContent = 'This artwork needs Canvas 2D. Its description and controls remain available.';
  host.appendChild(canvas);

  let controller: SeahorseArtwork | undefined;
  let disposed = false, requestedPaused = options.paused, forcedReduced = options.reducedMotion;
  function synchronize(): void {
    if (disposed || !controller || controller.disposed) return;
    if (requestedPaused || forcedReduced || motion.matches) controller.pause();
    else controller.play();
  }
  function togglePlayback(): void {
    // A focused canvas may toggle user pause, never override host Still or OS reduction.
    if (forcedReduced || motion.matches) return;
    requestedPaused = !requestedPaused;
    synchronize();
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    options.signal?.removeEventListener('abort', dispose);
    motion.removeEventListener('change', synchronize);
    try { controller?.dispose(); } finally { canvas.remove(); }
  }
  try {
    // Construction is paused until ownership and both motion policies exist.
    // Structural assignment checks the existing Seahorse controller contract.
    controller = createBrassButtonArtwork(canvas, { ...options.configuration, paused: true, reducedMotion: 'system' }, togglePlayback);
    motion.addEventListener('change', synchronize);
    options.signal?.addEventListener('abort', dispose, { once: true });
    throwIfAborted(options.signal);
    synchronize();
    return Object.freeze({
      species: 'seahorse', variation: 'brass-button', element: canvas, canvas, controller,
      get disposed() { return disposed || controller!.disposed; },
      play() { requestedPaused = false; synchronize(); },
      pause() { requestedPaused = true; synchronize(); },
      restart() { if (disposed || controller!.disposed) return; controller!.restart(); synchronize(); },
      setReducedMotion(value: boolean) { forcedReduced = value; synchronize(); },
      dispose,
    });
  } catch (error) {
    dispose();
    throw error;
  }
}
