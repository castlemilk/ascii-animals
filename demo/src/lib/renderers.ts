/**
 * Demo-only lifecycle bridge. Every runtime import below resolves the built
 * review package's public export map for canonical animals. The local
 * variation studies are distinct, opt-in renderers, not package exports.
 * Type imports are erased and do not load inactive species at runtime.
 */
import type { ArtworkOptions } from 'ascii-animals-review';
import type { OctopusTricksterController } from '../../../species/octopus/trickster/browser.mjs';
import type { InkPuppetController } from './ink-puppet.mjs';
import type { VariationId } from './variations';
import type { MarineMovementArtwork } from 'ascii-animals-review/movement/marine';
import type { ButterflyArtwork } from 'ascii-animals-review/butterfly';
import type { CrabArtwork } from 'ascii-animals-review/crab';
import type { DragonflyArtwork } from 'ascii-animals-review/dragonfly';
import type { FoxArtwork } from 'ascii-animals-review/fox';
import type { FrogArtwork } from 'ascii-animals-review/frog';
import type { GeckoArtwork } from 'ascii-animals-review/gecko';
import type { OwlArtwork } from 'ascii-animals-review/owl';
import type { mountPufferfishCharacter } from '../../../species/pufferfish/build/character.js';
import type { PufferfishArtwork } from 'ascii-animals-review/pufferfish';
import type { SeahorseArtwork } from 'ascii-animals-review/seahorse';
import type { TurtleArtwork } from 'ascii-animals-review/turtle';

export type MarineSpeciesId = 'cuttlefish' | 'manta' | 'octopus';
export function isMarineSpecies(species: SpeciesId): species is MarineSpeciesId {
  return species === 'cuttlefish' || species === 'manta' || species === 'octopus';
}
export type SpeciesId = MarineSpeciesId | 'seahorse' | 'crab' | 'turtle'
  | 'pufferfish' | 'frog' | 'butterfly' | 'dragonfly' | 'gecko' | 'owl' | 'fox';

/** A movement extension narrows session.species before using its real API. */
export interface RendererControllers {
  cuttlefish: MarineMovementArtwork;
  manta: MarineMovementArtwork;
  octopus: MarineMovementArtwork;
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
 * Marine starts with journey mode disabled in its one canonical renderer. The
 * independent authored studios are not mounted or altered by this bridge.
 */
export interface RendererConfigurations {
  cuttlefish: ArtworkOptions;
  manta: ArtworkOptions;
  octopus: ArtworkOptions;
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
  readonly variation: 'original';
  readonly controller: RendererControllers[S];
};

type TricksterSession = RendererLifecycle & {
  readonly species: 'octopus';
  readonly variation: 'pocket-trickster';
  readonly controller: OctopusTricksterController;
};

type PuppetSession = RendererLifecycle & {
  readonly species: 'cuttlefish';
  readonly variation: 'ink-puppet';
  readonly controller: InkPuppetController;
};

type CurmudgeonSession = RendererLifecycle & {
  readonly species: 'pufferfish';
  readonly variation: 'reef-curmudgeon';
  readonly controller: ReturnType<typeof mountPufferfishCharacter>;
};

// Marine deliberately shares one supported engine. Other members retain their
// exact native controller types: a fixed-tick guide is not a marine advance.
type TrouperSession = RendererLifecycle & {
  readonly species: 'crab'; readonly variation: 'tidepool-trouper'; readonly controller: CrabArtwork;
};
type SunpatchSession = RendererLifecycle & {
  readonly species: 'butterfly'; readonly variation: 'sunpatch'; readonly controller: ButterflyArtwork;
};

export type RendererSession = TrouperSession | SunpatchSession | CurmudgeonSession | PuppetSession | TricksterSession | SessionFor<MarineSpeciesId> | {
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

function ownLifecycle<T>(
  playback: PlaybackController,
  element: HTMLElement,
  options: RendererMountOptions,
  identity: T,
): RendererLifecycle & T {
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

  const session: RendererLifecycle & T = {
    ...identity, element,
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

function ownSession<S extends SpeciesId>(
  species: S, controller: RendererControllers[S], element: HTMLElement, options: RendererMountOptions,
): SessionFor<S> {
  return ownLifecycle(controller, element, options, { species, controller, variation: 'original' as const });
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

function mountVariationCanvas<T extends { species: SpeciesId; variation: Exclude<VariationId, 'original'>; controller: unknown }>(
  species: T['species'], variation: T['variation'], host: HTMLElement, options: RendererMountOptions,
  create: (canvas: HTMLCanvasElement) => { playback: PlaybackController; identity: T },
): RendererLifecycle & T {
  throwIfAborted(options.signal);
  const canvas = prepareElement(species, host.ownerDocument.createElement('canvas'), options);
  canvas.dataset.rendererVariation = variation;
  canvas.textContent = 'This artwork needs Canvas 2D. Its description and navigation remain available.';
  host.appendChild(canvas);
  let playback: PlaybackController | undefined;
  try {
    const instance = create(canvas);
    playback = instance.playback;
    return ownLifecycle(playback, canvas, options, instance.identity);
  } catch (error) {
    try { playback?.dispose(); }
    finally { canvas.remove(); }
    throw error;
  }
}

async function mountTrickster(host: HTMLElement, options: RendererMountOptions): Promise<TricksterSession> {
  const { createOctopusTrickster } = await import('../../../species/octopus/trickster/browser.mjs');
  return mountVariationCanvas('octopus', 'pocket-trickster', host, options, canvas => {
    const active = createOctopusTrickster(canvas, { seed: 23, paused: true, reducedMotion: 'system' });
    let released = false;
    const playback: PlaybackController = {
      get disposed() { return released; },
      play() { active.setPaused(false); },
      pause() { active.setPaused(true); },
      restart() { active.restart(); },
      dispose() { released = true; active.dispose(); },
    };
    return { playback, identity: { species: 'octopus', variation: 'pocket-trickster', controller: active } as const };
  });
}

async function mountPuppet(host: HTMLElement, options: RendererMountOptions): Promise<PuppetSession> {
  const { createInkPuppetVariant } = await import('./ink-puppet.mjs');
  return mountVariationCanvas('cuttlefish', 'ink-puppet', host, options, canvas => {
    const { controller, playback } = createInkPuppetVariant(canvas);
    return { playback, identity: { species: 'cuttlefish', variation: 'ink-puppet', controller } as const };
  });
}

async function mountCurmudgeon(host: HTMLElement, options: RendererMountOptions): Promise<CurmudgeonSession> {
  const { mountPufferfishCharacter } = await import('../../../species/pufferfish/build/character.js');
  return mountVariationCanvas('pufferfish', 'reef-curmudgeon', host, options, canvas => {
    const controller = mountPufferfishCharacter(canvas, {
      species: { seed: 23 }, director: { count: 1 }, paused: true,
    });
    const playback: PlaybackController = {
      get disposed() { return controller.getStatus().destroyed; },
      play() { controller.setPaused(false); },
      pause() { controller.setPaused(true); },
      restart() { controller.reset(); },
      dispose() { controller.destroy(); },
    };
    return { playback, identity: { species: 'pufferfish', variation: 'reef-curmudgeon', controller } as const };
  });
}

async function mountTrouper(host: HTMLElement, options: RendererMountOptions): Promise<TrouperSession> {
  const { createTidepoolTrouperArtwork } = await import('../../.private-renderers/src/public/crab/variants/tidepool-trouper.js');
  return mountVariationCanvas('crab', 'tidepool-trouper', host, options, canvas => {
    const controller = createTidepoolTrouperArtwork(canvas, { seed: 23, scene: 'study', count: 1, paused: true, reducedMotion: 'system' });
    return { playback: controller, identity: { species: 'crab', variation: 'tidepool-trouper', controller } as const };
  });
}

async function mountSunpatch(host: HTMLElement, options: RendererMountOptions): Promise<SunpatchSession> {
  const { createSunpatchButterflyArtwork } = await import('../../.private-renderers/species/butterfly/variations/sunpatch/index.js');
  return mountVariationCanvas('butterfly', 'sunpatch', host, options, canvas => {
    const controller = createSunpatchButterflyArtwork(canvas, { seed: 23, director: { scene: 'specimen' }, paused: true, reducedMotion: 'system' });
    return { playback: controller, identity: { species: 'butterfly', variation: 'sunpatch', controller } as const };
  });
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
  variation: VariationId = 'original',
): Promise<RendererSession> {
  throwIfAborted(options.signal);
  if (species === 'octopus' && variation === 'pocket-trickster') return mountTrickster(host, options);
  if (species === 'cuttlefish' && variation === 'ink-puppet') return mountPuppet(host, options);
  if (species === 'pufferfish' && variation === 'reef-curmudgeon') return mountCurmudgeon(host, options);
  if (species === 'crab' && variation === 'tidepool-trouper') return mountTrouper(host, options);
  if (species === 'butterfly' && variation === 'sunpatch') return mountSunpatch(host, options);
  switch (species) {
    case 'cuttlefish':
    case 'manta':
    case 'octopus': {
      const { createMarineMovementArtwork } = await import('ascii-animals-review/movement/marine');
      return mountCanvas(species, host, options, canvas => createMarineMovementArtwork(canvas, {
        enabled: false, timing: { mode: 'duration', seconds: 8 },
        lingerSeconds: 0, repeat: true, edgePadding: 16,
      }, {
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
