import { CuttlefishArtwork, type CuttlefishOptions } from '../../lib/animals/cuttlefish.js';
import type { ReefConfig, ReefOptions, ReefPose, ReefSequence, ReefStage, ReefStill } from './reef-director.mjs';
export type { ReefConfig, ReefOptions, ReefPose, ReefSequence, ReefStage, ReefStill } from './reef-director.mjs';
export interface ReefArtworkOptions extends Omit<CuttlefishOptions, 'species' | 'count' | 'formation' | 'scene' | 'speciesByAnimal' | 'behaviors'> {
  species?: 'manta'; count?: 1; formation?: 'independent'; scene?: 'reactive';
  speciesByAnimal?: readonly [] | readonly ['manta'];
  behaviors?: readonly [] | readonly ['auto' | 'hover' | 'curious'];
}
export interface ReefSnapshot {
  readonly options: ReefConfig; readonly current: number; readonly clock: number;
  readonly responseAge: number | null; readonly side: -1 | 1; readonly phase: string;
  readonly stage: ReefStage; readonly sequence: ReefSequence; readonly still: ReefStill | null;
}
/** Species-local review adapter; the established package exports are unchanged. */
export class MantaReefArtwork extends CuttlefishArtwork {
  constructor(canvas: HTMLCanvasElement, reefOptions?: ReefOptions, artworkOptions?: ReefArtworkOptions);
  readonly reefPose: ReefPose;
  setReef(options: ReefOptions): void;
  getReef(): Readonly<ReefSnapshot>;
  bank(side?: -1 | 1): boolean;
  showReefStill(still: ReefStill): boolean;
  setOptions(options: ReefArtworkOptions): void;
  /** The study owns its direction; use setReef to change it. */
  setDirector(options: null): void;
}
export function createMantaReef(canvas: HTMLCanvasElement, reefOptions?: ReefOptions, artworkOptions?: ReefArtworkOptions): MantaReefArtwork;
