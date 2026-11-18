export { CuttlefishArtwork, createCuttlefish } from './animals/cuttlefish.js';
export type {
  CuttlefishOptions,
  CuttlefishStats,
  FishStats,
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

export {createOwlArtwork} from './public/owl.js';
export type {OwlArtwork,OwlBrowserOptions,OwlBrowserStatus,OwlOptions,OwlState} from './public/owl.js';
