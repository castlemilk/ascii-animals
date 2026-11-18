/** PRIVATE COMPATIBILITY BRIDGE, originally authored against main 0e446c47.
 * The integrated factory injects the current canonical ESM renderer prototype.
 * No constructor, loop or renderer fork; not a supported public engine API.
 */
import { finite, record } from './model.js';
import { posePufferfish, samplePufferfish } from './geometry.js';
import type { PufferfishQuality, PufferfishState, PufferfishView } from './types.js';

export const LEGACY_RENDERER_SHA256 = '381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91';
export const LEGACY_GLYPHS = '.,:;!i1l+txzvcofnae0&%8B@';
export interface PufferfishRenderOptions {
  readonly view?: PufferfishView;
  readonly quality?: PufferfishQuality;
  readonly monochrome?: boolean;
  readonly maxDpr?: number;
}
export type PufferfishRenderConfig = Readonly<Required<PufferfishRenderOptions>>;
export interface PufferfishRenderResult {
  readonly cols: number; readonly rows: number; readonly glyphs: number; readonly samples: number;
  readonly width: number; readonly height: number; readonly dpr: number; readonly text: string;
}
export interface PufferfishPainter {
  resize(width: number, height: number, dpr: number): boolean;
  configure(patch: PufferfishRenderOptions): void;
  draw(state: PufferfishState, staticPose?: boolean): PufferfishRenderResult;
  getConfig(): PufferfishRenderConfig;
  dispose(): void;
}
export interface PufferfishLegacyDependency { readonly prototype: object }
export const PUFFERFISH_RENDER_DEFAULTS: PufferfishRenderConfig = Object.freeze({
  view: 'right', quality: 'standard', monochrome: false, maxDpr: 2,
});
export function resolveRenderOptions(options: PufferfishRenderOptions = {}): PufferfishRenderConfig {
  record(options, ['view', 'quality', 'monochrome', 'maxDpr'], 'render options');
  const c = { ...PUFFERFISH_RENDER_DEFAULTS, ...options };
  if (!['front', 'left', 'right'].includes(c.view)) throw new TypeError('invalid view');
  if (!['small', 'standard', 'fine'].includes(c.quality)) throw new TypeError('invalid quality');
  if (typeof c.monochrome !== 'boolean') throw new TypeError('monochrome must be boolean');
  finite(c.maxDpr, 1, 2, 'maxDpr');
  return Object.freeze(c);
}
interface LegacyFish { id: 0; offset: 0; visible: boolean }
interface LegacySurface {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  atlas: HTMLCanvasElement; atlasCtx: CanvasRenderingContext2D;
  width: number; height: number; dpr: number; cols: number; rows: number;
  cellW: number; cellH: number; sprite: number; scale: number; cx: number; cyScreen: number;
  time: number; destroyed: boolean; depthAmount: number; objectScale: number; perspectiveStrength: number;
  worldX: number; worldY: number; worldZ: number; subjectVisibility: number;
  r00: number; r01: number; r02: number; r10: number; r11: number; r12: number; r20: number; r21: number; r22: number;
  sampleCount: number; glyphCount: number; minX: number; maxX: number; minY: number; maxY: number;
  samples: Float32Array; depth: Float32Array; tones: Uint8Array; glyphs: Uint8Array; kinds: Uint8Array;
  owners: Int16Array; visibility: Float32Array;
  colors: string[]; colorBytes: number[][]; plankton: never[];
  fish: LegacyFish[]; activeFish: LegacyFish;
  options: { scene: 'reactive'; mode: 'ascii'; glow: false; showLabels: false };
  palette: { low: number[]; middle: number[]; high: number[]; fin: number[]; atmosphere: number[] };
  _activateFish(fish: LegacyFish): void;
  _camera(time: number): void;
  _body(time: number): void;
  _arms(time: number): void;
  _beak(time: number): void;
  _saveFish(): void;
  _drawInk(): void;
  _put(x: number, y: number, z: number, light: number, material: number, seed: number): void;
  _rasterize(): void;
}
type LegacyMethod = (this: LegacySurface, ...args: never[]) => void;
function method(prototype: object, name: string): LegacyMethod {
  const value = (prototype as Record<string, unknown>)[name];
  if (typeof value !== 'function') throw new TypeError(`Pinned legacy renderer is missing ${name}`);
  return value as LegacyMethod;
}

export function createPufferfishPainter(canvas: HTMLCanvasElement, legacy: PufferfishLegacyDependency,
  options: PufferfishRenderOptions = {}, makeCanvas: () => HTMLCanvasElement = () => canvas.ownerDocument.createElement('canvas')): PufferfishPainter {
  let config = resolveRenderOptions(options);
  const render = method(legacy.prototype, 'render'), makeAtlas = method(legacy.prototype, 'makeAtlas');
  const put = method(legacy.prototype, '_put') as LegacySurface['_put'];
  const rasterize = method(legacy.prototype, '_rasterize');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D unavailable; the text description remains available.');
  const atlas = makeCanvas(), atlasCtx = atlas.getContext('2d');
  if (!atlasCtx) throw new Error('Glyph atlas Canvas 2D unavailable.');
  let frameState: PufferfishState | undefined, staticPose = true;
  let rawWidth = 0, rawHeight = 0, rawDpr = 1, disposed = false;
  const fish: LegacyFish = { id: 0, offset: 0, visible: false };
  const noop = (): void => {};
  const surface: LegacySurface = {
    canvas, ctx, atlas, atlasCtx, width: 0, height: 0, dpr: 1, cols: 0, rows: 0,
    cellW: 1, cellH: 1.35, sprite: 0, scale: 1, cx: 0, cyScreen: 0,
    time: 0, destroyed: false, depthAmount: 0.7, objectScale: 1, perspectiveStrength: 0.06,
    worldX: 0, worldY: 0, worldZ: 0, subjectVisibility: 1,
    r00: 1, r01: 0, r02: 0, r10: 0, r11: 1, r12: 0, r20: 0, r21: 0, r22: 1,
    sampleCount: 0, glyphCount: 0, minX: 0, maxX: 0, minY: 0, maxY: 0,
    samples: new Float32Array(16000 * 6), depth: new Float32Array(0), tones: new Uint8Array(0), glyphs: new Uint8Array(0),
    kinds: new Uint8Array(0), owners: new Int16Array(0), visibility: new Float32Array(0), colors: [], colorBytes: [],
    plankton: [], fish: [fish], activeFish: fish,
    options: { scene: 'reactive', mode: 'ascii', glow: false, showLabels: false },
    palette: { low: [28, 52, 58], middle: [186, 175, 116], high: [255, 248, 218], fin: [106, 194, 183], atmosphere: [31, 67, 73] },
    _activateFish(item) { this.activeFish = item; },
    _camera() {
      if (!frameState) return;
      const pose = posePufferfish(frameState, staticPose);
      const yaw = config.view === 'front' ? 0 : config.view === 'right' ? -0.68 : 0.68;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(pose.roll), sr = Math.sin(pose.roll);
      this.r00 = cr * cy; this.r01 = -sr; this.r02 = cr * sy;
      this.r10 = sr * cy; this.r11 = cr; this.r12 = sr * sy;
      this.r20 = -sy; this.r21 = 0; this.r22 = cy;
      this.worldY = pose.bob; this.cx = this.width / 2; this.cyScreen = this.height * 0.51;
      this.scale = Math.min(this.width / 5.2, this.height / 4.5);
    },
    _body() {
      if (!frameState) return;
      samplePufferfish(frameState, sample => {
        if (this.sampleCount >= 16000) throw new RangeError('Pufferfish sample cap exceeded');
        // The existing writer subtracts 0.30 from local x. Keep the species origin at zero.
        this._put(sample.x + 0.30, sample.y, sample.z, sample.light, sample.material, sample.seed);
      }, { quality: config.quality, monochrome: config.monochrome, staticPose });
    },
    _arms: noop, _beak: noop, _saveFish: noop, _drawInk: noop,
    _put: put,
    _rasterize() { rasterize.call(this); },
  };
  function alive(): void { if (disposed) throw new Error('Pufferfish painter is disposed'); }
  const painter: PufferfishPainter = {
    resize(width, height, dpr) {
      alive(); finite(width, 0, 100000, 'width'); finite(height, 0, 100000, 'height'); finite(dpr, 0.1, 10, 'DPR');
      rawWidth = width; rawHeight = height; rawDpr = dpr;
      if (width === 0 || height === 0) { surface.width = 0; surface.height = 0; canvas.width = canvas.height = 1; return false; }
      const factor = Math.min(1, 1200 / width, 675 / height);
      surface.width = width * factor; surface.height = height * factor; surface.dpr = Math.min(config.maxDpr, dpr);
      const targetCols = { small: 72, standard: 120, fine: 160 }[config.quality];
      surface.cellW = Math.max(surface.width / targetCols, surface.height / (90 * 1.35)); surface.cellH = surface.cellW * 1.35;
      surface.cols = Math.min(160, Math.ceil(surface.width / surface.cellW));
      surface.rows = Math.min(90, Math.ceil(surface.height / surface.cellH));
      const cells = surface.cols * surface.rows;
      surface.depth = new Float32Array(cells); surface.tones = new Uint8Array(cells); surface.glyphs = new Uint8Array(cells);
      surface.kinds = new Uint8Array(cells); surface.owners = new Int16Array(cells); surface.visibility = new Float32Array(cells);
      canvas.width = Math.max(1, Math.round(surface.width * surface.dpr)); canvas.height = Math.max(1, Math.round(surface.height * surface.dpr));
      makeAtlas.call(surface);
      return true;
    },
    configure(patch) {
      alive(); record(patch, ['view', 'quality', 'monochrome', 'maxDpr'], 'render patch');
      const next = resolveRenderOptions({ ...config, ...patch });
      config = next; if (rawWidth && rawHeight) painter.resize(rawWidth, rawHeight, rawDpr);
    },
    draw(state, still = false) {
      alive(); if (!surface.width || !surface.height) throw new Error('Cannot draw a zero-size pufferfish surface');
      frameState = state; staticPose = still; surface.time = state.tick / 60;
      render.call(surface);
      const lines: string[] = [];
      for (let row = 0; row < surface.rows; row++) {
        let line = '';
        for (let col = 0; col < surface.cols; col++) {
          const i = row * surface.cols + col;
          line += surface.depth[i] === -Infinity ? ' ' : LEGACY_GLYPHS[surface.glyphs[i]!]!;
        }
        lines.push(line);
      }
      return Object.freeze({ cols: surface.cols, rows: surface.rows, glyphs: surface.glyphCount, samples: surface.sampleCount,
        width: surface.width, height: surface.height, dpr: surface.dpr, text: lines.join('\n') });
    },
    getConfig: () => config,
    dispose() {
      if (disposed) return;
      disposed = surface.destroyed = true; frameState = undefined;
      atlas.width = atlas.height = canvas.width = canvas.height = 1;
      surface.samples = new Float32Array(0); surface.depth = new Float32Array(0); surface.owners = new Int16Array(0);
      surface.tones = surface.glyphs = surface.kinds = new Uint8Array(0); surface.visibility = new Float32Array(0);
    },
  };
  return painter;
}
