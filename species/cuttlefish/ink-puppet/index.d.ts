export interface InkPuppetOptions { seed?: number; autoStart?: boolean; paused?: boolean; size?: number; habitat?: boolean; }
export type PuppetAction = 'investigate' | 'retreat';
export type PuppetInput = { type: 'point'; x: number; y: number } | { type: 'leave' }
  | ({ type: PuppetAction } & ({ x: number; y: number } | { x?: never; y?: never }));
export interface PuppetStats { readonly tick: number; readonly time: number; readonly phase: string; readonly action: PuppetAction | null; readonly paused: boolean; readonly userPaused: boolean; readonly reducedMotion: boolean; readonly running: boolean; readonly destroyed: boolean; readonly inView: boolean; readonly hidden: boolean; readonly droppedSeconds: number; readonly width: number; readonly height: number; readonly dpr: number; readonly glyphs: number; readonly cells: number; }
/** Isolated prototype API; this is not a replacement for the marine package. */
export class InkPuppetArtwork {
  constructor(canvas: HTMLCanvasElement, options?: InkPuppetOptions);
  readonly canvas: HTMLCanvasElement; readonly paused: boolean; readonly destroyed: boolean;
  setTool(tool: PuppetAction): void;
  cue(input: PuppetInput): boolean;
  showStill(type?: PuppetAction | 'idle', seconds?: number, target?: { x: number; y: number }): boolean;
  setPaused(paused: boolean): void;
  setOptions(options: InkPuppetOptions): void;
  restart(): void;
  /** Exact explicit ticks from a bounded elapsed step; requires autoStart:false. */
  advance(seconds: number): void;
  render(): void; resize(): void; destroy(): void;
  getStats(): PuppetStats;
  getState(): Readonly<{ version: string; tickRate: number; seed: number; tick: number; phase: string; pointer: boolean; point: Readonly<{ x: number; y: number }>; action: Readonly<{ kind: PuppetAction; startTick: number; duration: number; strength: number; target: Readonly<{ x: number; y: number }>; origin: Readonly<{ x: number; y: number }>; direction: Readonly<{ x: number; y: number }> }> | null; cooldownUntil: number; sequence: number }>;
  subscribe(listener: (stats: PuppetStats) => void): () => void;
}
export function createInkPuppet(canvas: HTMLCanvasElement, options?: InkPuppetOptions): InkPuppetArtwork;
