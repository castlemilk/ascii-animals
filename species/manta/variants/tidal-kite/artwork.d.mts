import { CuttlefishArtwork } from '../../../../lib/animals/cuttlefish.js';
import type { ReefArtworkOptions } from '../../reef-artwork.mjs';
import type { ReefConfig, ReefOptions, ReefPose, ReefSequence, ReefStage, ReefStill, ReefTarget } from './reef-director.mjs';
export type { ReefArtworkOptions } from '../../reef-artwork.mjs';
export type { ReefConfig, ReefOptions, ReefPose, ReefSequence, ReefStage, ReefStill, ReefTarget } from './reef-director.mjs';

export interface TidalKiteSnapshot {
  readonly options: ReefConfig; readonly current: number; readonly clock: number;
  readonly responseAge: number | null; readonly side: -1 | 1; readonly phase: string;
  readonly stage: ReefStage; readonly sequence: ReefSequence; readonly still: ReefStill | null;
  readonly invitationAge: number | null; readonly invitationTarget: Readonly<ReefTarget> | null;
  readonly busy: boolean; readonly reducedMotion: boolean;
}

/** Private opt-in adapter. One renderer owns its scheduler and canvas resources.
 * The declared ancestor avoids widening Original's four-still snapshot type.
 * This is not a public package export or a MarineMovementArtwork controller. */
export class MantaTidalKiteArtwork extends CuttlefishArtwork {
  constructor(canvas: HTMLCanvasElement, reefOptions?: ReefOptions, artworkOptions?: ReefArtworkOptions);
  readonly reefPose: ReefPose;
  readonly disposed: boolean;
  play(): void;
  pause(): void;
  dispose(): void;
  setReef(options: ReefOptions): void;
  getReef(): Readonly<TidalKiteSnapshot>;
  bank(side?: -1 | 1): boolean;
  /** Finite normalized x/y in [-0.5, 0.5]; paused input composes a still. */
  invite(target: ReefTarget): boolean;
  showReefStill(still: ReefStill): boolean;
  setOptions(options: ReefArtworkOptions): void;
  setDirector(options: null): void;
}

export function createMantaTidalKite(canvas: HTMLCanvasElement, reefOptions?: ReefOptions,
  artworkOptions?: ReefArtworkOptions): MantaTidalKiteArtwork;
