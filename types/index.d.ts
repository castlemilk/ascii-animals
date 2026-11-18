export { CuttlefishArtwork, createCuttlefish } from './animals/cuttlefish.js';
export type {
  CuttlefishOptions,
  CuttlefishStats,
  FishStats,
  Species,
  Scene,
  Palette,
  Formation,
  Behavior,
  ReactionStage,
} from './animals/cuttlefish.js';
export { createScheduler } from './core/index.js';
export type { Scheduler, SchedulerOptions, FrameCallback } from './core/index.js';

export { createArtwork, DEFAULT_OPTIONS, normalizeOptions } from './public/index.js';
export type { Artwork, ArtworkOptions, ArtworkConfig, ArtworkStats } from './public/index.js';

export { createFoxArtwork } from './public/fox.js';
export type { FoxArtwork, FoxBrowserOptions, FoxBrowserStatus, FoxOptions, FoxCreateOptions, FoxState, FoxInput } from './public/fox.js';

export { createDragonflyArtwork } from './public/dragonfly.js';
export type { DragonflyArtwork, DragonflyMountOptions, DragonflyBrowserStatus, DragonflyOptions, DragonflyState, DragonflyInput } from './public/dragonfly.js';

export { createGeckoArtwork } from './public/gecko.js';
export type { GeckoArtwork, GeckoMountOptions, GeckoControllerStatus, GeckoViewOptions } from './public/gecko.js';
export { createPufferfishArtwork } from './public/pufferfish.js';
export type { PufferfishArtwork, PufferfishMountOptions } from './public/pufferfish.js';
export { createFrogArtwork } from './public/frog.js';
export type { FrogArtwork, FrogMountOptions, FrogConfigPatch, FrogState, FrogInput } from './public/frog.js';
export {createOwlArtwork} from './public/owl.js';
export type {OwlArtwork,OwlBrowserOptions,OwlBrowserStatus,OwlOptions,OwlState} from './public/owl.js';
export * from './public/seahorse.js';

export * from './public/crab.js';
