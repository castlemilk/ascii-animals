export type Scene = 'swimby' | 'encounter' | 'reactive';
export type Palette = 'lagoon' | 'ultraviolet' | 'ember';
export type Formation = 'independent' | 'horizontal' | 'vertical' | 'diagonal' | 'random';
export type Behavior = 'auto' | 'cruise' | 'hover' | 'orbit' | 'curious' | 'encounter';
export type ReactionStage = 'idle' | 'react' | 'spray' | 'escape' | 'recover';

/** Values are normalized to the limits described in docs/API.md. */
export interface CuttlefishOptions {
  scene?: Scene;
  palette?: Palette;
  speed?: number;
  ripple?: number;
  density?: number;
  motion?: number;
  depthStrength?: number;
  mode?: 'ascii' | 'points';
  followPointer?: boolean;
  glow?: boolean;
  paused?: boolean;
  count?: number;
  formation?: Formation;
  size?: number;
  sizeVariation?: number;
  spacing?: number;
  reverse?: boolean;
  showLabels?: boolean;
  behaviors?: readonly Behavior[];
  autoStart?: boolean;
  reducedMotion?: 'system' | 'ignore';
  maxDpr?: number;
  maxPixels?: number;
  maxCells?: number;
  maxFps?: number;
  observeVisibility?: boolean;
}

export interface FishStats {
  /** One-based display identifier; do not confuse with internal zero-based IDs. */
  id: number;
  behavior: Exclude<Behavior, 'auto'>;
  phase: string;
  reactionStage: ReactionStage;
  visible: boolean;
  size: number;
}

export interface CuttlefishStats {
  fps: number;
  glyphs: number;
  time: number;
  phase: string;
  progress: number;
  agitation: number;
  reactionStage: ReactionStage;
  inkGlyphs: number;
  count: number;
  visibleCount: number;
  formation: Formation;
  fish: FishStats[];
  paused: boolean;
  running: boolean;
  destroyed: boolean;
  droppedSeconds: number;
  width: number;
  height: number;
  dpr: number;
  cells: number;
}

/** Import is safe without a DOM; construction requires a browser Canvas 2D. */
export class CuttlefishArtwork {
  constructor(canvas: HTMLCanvasElement, options?: CuttlefishOptions);
  readonly canvas: HTMLCanvasElement;
  readonly paused: boolean;
  readonly destroyed: boolean;
  setOptions(patch: CuttlefishOptions): void;
  setPaused(value: boolean): void;
  getStats(): CuttlefishStats;
  restart(): void;
  pulse(): void;
  /** Explicit simulation step in [0, .1] seconds; requires autoStart:false.
   * Ignores paused. Repeatability requires the same fixed step/input sequence.
   */
  advance(dtSeconds: number): void;
  resize(): void;
  render(): void;
  destroy(): void;
}

export function createCuttlefish(canvas: HTMLCanvasElement, options?: CuttlefishOptions): CuttlefishArtwork;
