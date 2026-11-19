/**
 * Demo-only lifecycle bridge. Every runtime import below resolves the built
 * review package's public export map; no renderer is copied into this app.
 * Type imports are erased and do not load inactive species at runtime.
 */
import type { Artwork } from 'ascii-animals-review';
import type { ButterflyArtwork } from 'ascii-animals-review/butterfly';
import type { CrabArtwork } from 'ascii-animals-review/crab';
import type { DragonflyArtwork } from 'ascii-animals-review/dragonfly';
import type { FoxArtwork } from 'ascii-animals-review/fox';
import type { FrogArtwork } from 'ascii-animals-review/frog';
import type { GeckoArtwork } from 'ascii-animals-review/gecko';
import type { OwlArtwork } from 'ascii-animals-review/owl';
import type { PufferfishArtwork } from 'ascii-animals-review/pufferfish';
import type { SeahorseArtwork } from 'ascii-animals-review/seahorse';
import type { TurtleArtwork } from 'ascii-animals-review/turtle';

export type MarineSpeciesId = 'cuttlefish' | 'manta' | 'octopus';
export type SpeciesId = MarineSpeciesId | 'seahorse' | 'crab' | 'turtle'
  | 'pufferfish' | 'frog' | 'butterfly' | 'dragonfly' | 'gecko' | 'owl' | 'fox';

/** A movement extension narrows session.species before using its real API. */
export interface RendererControllers {
  cuttlefish: Artwork;
  manta: Artwork;
  octopus: Artwork;
  seahorse: SeahorseArtwork;
  crab: CrabArtwork;
  turtle: TurtleArtwork;
  pufferfish: PufferfishArtwork;
  frog: FrogArtwork;
  butterfly: ButterflyArtwork;
  dragonfly: DragonflyArtwork;
  gecko: GeckoArtwork;
  owl: OwlArtwork;
  fox: FoxArtwork;
}

/**
 * The movement owner's opt-in point BEFORE a controller is constructed. Several
 * species cannot switch from solo to director mode after mounting. These are
 * each factory's actual public options, not a fabricated common movement API.
 * Marine's newer /cuttlefish director factory is intentionally not substituted
 * for createArtwork here; that change is an explicit integration handoff.
 */
export interface RendererConfigurations {
  cuttlefish: NonNullable<Parameters<typeof import('ascii-animals-review').createArtwork>[1]>;
  manta: NonNullable<Parameters<typeof import('ascii-animals-review').createArtwork>[1]>;
  octopus: NonNullable<Parameters<typeof import('ascii-animals-review').createArtwork>[1]>;
  seahorse: NonNullable<Parameters<typeof import('ascii-animals-review/seahorse').createSeahorseArtwork>[1]>;
  crab: NonNullable<Parameters<typeof import('ascii-animals-review/crab').createCrabArtwork>[1]>;
  turtle: NonNullable<Parameters<typeof import('ascii-animals-review/turtle').createTurtleArtwork>[1]>;
  pufferfish: NonNullable<Parameters<typeof import('ascii-animals-review/pufferfish').createPufferfishArtwork>[1]>;
  frog: NonNullable<Parameters<typeof import('ascii-animals-review/frog').createFrogArtwork>[1]>;
  butterfly: NonNullable<Parameters<typeof import('ascii-animals-review/butterfly').createButterflyArtwork>[1]>;
  dragonfly: NonNullable<Parameters<typeof import('ascii-animals-review/dragonfly').createDragonflyArtwork>[1]>;
  gecko: NonNullable<Parameters<typeof import('ascii-animals-review/gecko').createGeckoArtwork>[1]>;
  owl: NonNullable<Parameters<typeof import('ascii-animals-review/owl').createOwlArtwork>[1]>;
  fox: NonNullable<Parameters<typeof import('ascii-animals-review/fox').createFoxArtwork>[1]>;
}

export interface RendererMountOptions {
  /** User playback intent, separate from the system motion preference. */
  readonly paused: boolean;
  readonly reducedMotion: boolean;
  /** Aborting while a chunk loads prevents construction; after mount it disposes. */
  readonly signal?: AbortSignal;
  readonly label?: string;
  readonly descriptionId?: string;
  readonly configuration?: Partial<RendererConfigurations>;
}

interface RendererLifecycle {
  /** Only this child belongs to the session; the caller owns its parent. */
  readonly element: HTMLElement;
  readonly disposed: boolean;
  /** Remembers intent, but never overrides prefers-reduced-motion. */
  play(): void;
  pause(): void;
  restart(): void;
  /** Does not overwrite user pause intent. */
  setReducedMotion(value: boolean): void;
  /** Idempotent. Releases the native controller before removing its host. */
  dispose(): void;
}

type SessionFor<S extends SpeciesId> = RendererLifecycle & {
  readonly species: S;
  readonly controller: RendererControllers[S];
};

// Marine deliberately shares one supported engine. Other members retain their
// exact native controller types: a fixed-tick guide is not a marine advance.
export type RendererSession = SessionFor<MarineSpeciesId> | {
  [S in Exclude<SpeciesId, MarineSpeciesId>]: SessionFor<S>
}[Exclude<SpeciesId, MarineSpeciesId>];

type PlaybackController = {
  readonly disposed: boolean;
  play(): void;
  pause(): void;
  restart(): void;
  dispose(): void;
};

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('Renderer load cancelled.', 'AbortError');
}

function ownSession<S extends SpeciesId>(
  species: S,
  controller: RendererControllers[S],
  element: HTMLElement,
  options: RendererMountOptions,
): SessionFor<S> {
  // This is the real, shared playback surface, not a cast of species commands.
  const playback: PlaybackController = controller;
  const motion = element.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let requestedPaused = options.paused;
  let reducedMotion = options.reducedMotion;

  function synchronize(): void {
    if (disposed || playback.disposed) return;
    if (requestedPaused || reducedMotion || motion?.matches) playback.pause();
    else playback.play();
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    options.signal?.removeEventListener('abort', dispose);
    motion?.removeEventListener('change', synchronize);
    try { playback.dispose(); }
    finally { element.remove(); }
  }

  const session: SessionFor<S> = {
    species, controller, element,
    get disposed() { return disposed || playback.disposed; },
    play() { requestedPaused = false; synchronize(); },
    pause() { requestedPaused = true; synchronize(); },
    restart() {
      if (disposed || playback.disposed) return;
      playback.restart();
      synchronize();
    },
    setReducedMotion(value) { reducedMotion = value; synchronize(); },
    dispose,
  };

  try {
    motion?.addEventListener('change', synchronize);
    options.signal?.addEventListener('abort', dispose, { once: true });
    throwIfAborted(options.signal);
    synchronize();
    return Object.freeze(session);
  } catch (error) {
    dispose();
    throw error;
  }
}

function prepareElement<E extends HTMLElement>(
  species: SpeciesId,
  element: E,
  options: RendererMountOptions,
): E {
  element.dataset.rendererSpecies = species;
  element.className = species === 'owl' ? 'renderer-text' : 'renderer-canvas';
  element.style.display = 'block';
  element.style.width = '100%';
  element.style.height = '100%';
  element.style.minWidth = '0';
  element.tabIndex = 0;
  element.setAttribute('role', species === 'owl' ? 'group' : 'img');
  element.setAttribute('aria-label', options.label ?? `${species} ASCII artwork`);
  if (options.descriptionId) element.setAttribute('aria-describedby', options.descriptionId);
  return element;
}

function mountCanvas<S extends Exclude<SpeciesId, 'owl'>>(
  species: S,
  host: HTMLElement,
  options: RendererMountOptions,
  create: (canvas: HTMLCanvasElement) => RendererControllers[S],
): SessionFor<S> {
  throwIfAborted(options.signal);
  const canvas = prepareElement(species, host.ownerDocument.createElement('canvas'), options);
  canvas.textContent = 'This artwork needs Canvas 2D. Its description and navigation remain available.';
  host.appendChild(canvas);
  let controller: RendererControllers[S] | undefined;
  try {
    controller = create(canvas);
    return ownSession(species, controller, canvas, options);
  } catch (error) {
    try { controller?.dispose(); }
    finally { canvas.remove(); }
    throw error;
  }
}

/**
 * No eager runtime imports, prefetches, secondary animation clocks or globals.
 * All construction is paused; ownership and motion policy are established before
 * playing. A stale asynchronous import never acquires a canvas or subscription.
 */
export async function mountRenderer(
  species: SpeciesId,
  host: HTMLElement,
  options: RendererMountOptions,
): Promise<RendererSession> {
  throwIfAborted(options.signal);
  switch (species) {
    case 'cuttlefish':
    case 'manta':
    case 'octopus': {
      const marine = await import(/* webpackExports: ["createArtwork"] */ 'ascii-animals-review');
      return mountCanvas(species, host, options, canvas => marine.createArtwork(canvas, {
        // The default swim-by starts out of frame. Reactive presents a legible
        // still immediately without manually advancing or changing anatomy.
        seed: 7, scene: 'reactive', count: 1, size: 1, followPointer: true,
        ...options.configuration?.[species],
        species, paused: true, reducedMotion: 'system',
      }));
    }
    case 'fox': {
      const { createFoxArtwork } = await import('ascii-animals-review/fox');
      const configuration = options.configuration?.fox;
      return mountCanvas(species, host, options, canvas => createFoxArtwork(canvas, {
        ...configuration, fox: { ...configuration?.fox, paused: true },
      }));
    }
    case 'dragonfly': {
      const { createDragonflyArtwork } = await import('ascii-animals-review/dragonfly');
      return mountCanvas(species, host, options, canvas => createDragonflyArtwork(canvas, {
        ...options.configuration?.dragonfly, paused: true,
      }));
    }
    case 'gecko': {
      const { createGeckoArtwork } = await import('ascii-animals-review/gecko');
      return mountCanvas(species, host, options, canvas => createGeckoArtwork(canvas, {
        ...options.configuration?.gecko, paused: true,
      }));
    }
    case 'pufferfish': {
      const { createPufferfishArtwork } = await import('ascii-animals-review/pufferfish');
      return mountCanvas(species, host, options, canvas => createPufferfishArtwork(canvas, {
        ...options.configuration?.pufferfish, paused: true,
      }));
    }
    case 'frog': {
      const { createFrogArtwork } = await import('ascii-animals-review/frog');
      return mountCanvas(species, host, options, canvas => createFrogArtwork(canvas, {
        ...options.configuration?.frog, paused: true,
      }));
    }
    case 'owl': {
      const { createOwlArtwork } = await import('ascii-animals-review/owl');
      throwIfAborted(options.signal);
      const element = prepareElement(species, host.ownerDocument.createElement('div'), options);
      host.appendChild(element);
      let controller: OwlArtwork | undefined;
      try {
        controller = createOwlArtwork(element, { ...options.configuration?.owl, paused: true });
        return ownSession(species, controller, element, options);
      } catch (error) {
        try { controller?.dispose(); }
        finally { element.remove(); }
        throw error;
      }
    }
    case 'seahorse': {
      const { createSeahorseArtwork } = await import('ascii-animals-review/seahorse');
      return mountCanvas(species, host, options, canvas => createSeahorseArtwork(canvas, {
        ...options.configuration?.seahorse, paused: true, reducedMotion: 'system',
      }));
    }
    case 'crab': {
      const { createCrabArtwork } = await import('ascii-animals-review/crab');
      return mountCanvas(species, host, options, canvas => createCrabArtwork(canvas, {
        ...options.configuration?.crab, paused: true, reducedMotion: 'system',
      }));
    }
    case 'turtle': {
      const { createTurtleArtwork } = await import('ascii-animals-review/turtle');
      return mountCanvas(species, host, options, canvas => createTurtleArtwork(canvas, {
        ...options.configuration?.turtle, paused: true, reducedMotion: 'system',
      }));
    }
    case 'butterfly': {
      const { createButterflyArtwork } = await import('ascii-animals-review/butterfly');
      return mountCanvas(species, host, options, canvas => createButterflyArtwork(canvas, {
        ...options.configuration?.butterfly, paused: true, reducedMotion: 'system',
      }));
    }
  }
}
