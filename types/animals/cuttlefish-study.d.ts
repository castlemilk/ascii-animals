import { CuttlefishArtwork, type CuttlefishOptions } from './cuttlefish.js';

export interface CuttlefishStudyOptions {
  automatic?: boolean;
  habitat?: boolean;
  restrainedSkin?: boolean;
  concealFeedingTentacles?: boolean;
}
export type CuttlefishStudyConfig = Readonly<Required<CuttlefishStudyOptions>>;
export type CuttlefishStudyAction = 'investigate' | 'turn' | 'retreat';
export type CuttlefishStudyCue =
  | { type: 'pointer'; x: number; y: number }
  | { type: 'release' }
  | { type: CuttlefishStudyAction; x?: number; y?: number };
export interface CuttlefishStudySnapshot {
  readonly tick: number;
  readonly time: number;
  readonly seed: number;
  readonly automatic: boolean;
  readonly action: Readonly<{ kind: CuttlefishStudyAction; startTick: number; age: number; duration: number;
    target: readonly [number, number]; source: 'manual' | 'dwell' | 'automatic'; jetFired: boolean }> | null;
  readonly phase: string;
  readonly progress: number;
  readonly target: readonly [number, number];
  readonly pointer: boolean;
  readonly dwellTicks: number;
  readonly nextAutomaticTick: number;
  readonly config: CuttlefishStudyConfig;
  readonly anatomy: Readonly<{ primaryArms: 8; feedingTentacles: 2;
    feedingVisibility: 'verified' | 'unsupported-topology' | 'inherited' }>;
  readonly disposed: boolean;
}

/** Additive, pinned cuttlefish-only subclass. Existing package factories are unchanged. */
export class CuttlefishStudyArtwork extends CuttlefishArtwork {
  constructor(canvas: HTMLCanvasElement, study?: CuttlefishStudyOptions, artwork?: CuttlefishOptions);
  /** Coordinates use CSS-rect-normalized [-.5,.5]. Does not unpause. */
  cueStudy(input: CuttlefishStudyCue): boolean;
  getStudy(): CuttlefishStudySnapshot;
  setStudy(patch: CuttlefishStudyOptions): void;
  /** Pauses and composes an explicit frame; never subscribes to the scheduler. */
  showStudyStill(action?: 'hover' | CuttlefishStudyAction, seconds?: number, point?: { x: number; y: number }): boolean;
}
export function normalizeCuttlefishStudy(options?: CuttlefishStudyOptions, previous?: CuttlefishStudyConfig): CuttlefishStudyConfig;
export function createCuttlefishStudy(canvas: HTMLCanvasElement, study?: CuttlefishStudyOptions, artwork?: CuttlefishOptions): CuttlefishStudyArtwork;
