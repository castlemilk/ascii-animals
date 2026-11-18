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
