/** PRIVATE COMPATIBILITY BRIDGE, originally authored against main 0e446c47.
 * The integrated factory injects the current canonical ESM renderer prototype.
 * No constructor, loop or renderer fork; not a supported public engine API.
 */
import { finite, record } from './model.js';
import { posePufferfish, samplePufferfish } from './geometry.js';
import type { PufferfishQuality, PufferfishState, PufferfishView } from './types.js';
import type { PufferfishDirectorState } from './director-types.js';

export const LEGACY_RENDERER_SHA256 = '381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91';
export const LEGACY_GLYPHS = '.,:;!i1l+txzvcofnae0&%8B@';
export interface PufferfishRenderOptions {
  readonly view?: PufferfishView;
  readonly quality?: PufferfishQuality;
  readonly monochrome?: boolean;
  readonly maxDpr?: number;
  readonly mode?: 'ascii' | 'points';
}
export type PufferfishRenderConfig = Readonly<Required<PufferfishRenderOptions>>;
export interface PufferfishRenderResult {
  readonly cols: number; readonly rows: number; readonly glyphs: number; readonly samples: number;
  readonly width: number; readonly height: number; readonly dpr: number; readonly text: string;
  /** Number of selectable actors; procedural reef/current cells are excluded. */
  readonly actorCount: number;
  /** Scene-only narrow-trio geometry multiplier; actor centers stay normalized. */
  readonly sceneScale: number;
}
export interface PufferfishPainter {
  resize(width: number, height: number, dpr: number): boolean;
  configure(patch: PufferfishRenderOptions): void;
  draw(state: PufferfishState, staticPose?: boolean): PufferfishRenderResult;
  drawScene(state: PufferfishDirectorState, staticPose?: boolean): PufferfishRenderResult;
  /** Normalized CSS coordinates, -1..1. Only the visible cell owner is selected. */
  hitActor(x: number, y: number): number | null;
  getConfig(): PufferfishRenderConfig;
  dispose(): void;
}
export interface PufferfishLegacyDependency { readonly prototype: object }
export const PUFFERFISH_RENDER_DEFAULTS: PufferfishRenderConfig = Object.freeze({
  view: 'right', quality: 'standard', monochrome: false, maxDpr: 2, mode: 'ascii',
});
export function resolveRenderOptions(options: PufferfishRenderOptions = {}): PufferfishRenderConfig {
  record(options, ['view', 'quality', 'monochrome', 'maxDpr', 'mode'], 'render options');
  const c = { ...PUFFERFISH_RENDER_DEFAULTS, ...options };
  if (!['front', 'left', 'right'].includes(c.view)) throw new TypeError('invalid view');
  if (!['small', 'standard', 'fine'].includes(c.quality)) throw new TypeError('invalid quality');
  if (typeof c.monochrome !== 'boolean') throw new TypeError('monochrome must be boolean');
  if (c.mode !== 'ascii' && c.mode !== 'points') throw new TypeError('invalid render mode');
  finite(c.maxDpr, 1, 2, 'maxDpr');
  return Object.freeze(c);
}
interface LegacyFish { id: number; offset: 0; visible: boolean }
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
  options: { scene: 'reactive'; mode: 'ascii' | 'points'; glow: false; showLabels: false };
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
  let frameState: PufferfishState | undefined, frameScene: PufferfishDirectorState | undefined, staticPose = true;
  let combinedSamples = 0, actorCount = 1, sceneScale = 1, hasFrame = false;
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
    options: { scene: 'reactive', mode: config.mode, glow: false, showLabels: false },
    palette: { low: [28, 52, 58], middle: [186, 175, 116], high: [255, 248, 218], fin: [106, 194, 183], atmosphere: [31, 67, 73] },
    _activateFish(item) { this.activeFish = item; },
    _camera() {
      const actor = frameScene?.actors[this.activeFish.id];
      if (frameScene && !actor) {
        // The final dense ID belongs only to scenery. It shares the canonical
        // depth buffer, but picking filters it out rather than aliasing a fish.
        this.r00 = this.r11 = this.r22 = 1;
        this.r01 = this.r02 = this.r10 = this.r12 = this.r20 = this.r21 = 0;
        this.worldX = this.worldY = this.worldZ = 0; this.objectScale = 1;
        this.subjectVisibility = 0.58;
        this.cx = this.width / 2; this.cyScreen = this.height / 2;
        this.scale = Math.min(this.width / 5.2, this.height / 4.5);
        return;
      }
      const state = actor?.state ?? frameState;
      if (!state) return;
      const pose = posePufferfish(state, staticPose);
      const baseYaw = config.view === 'front' ? 0 : config.view === 'right' ? -0.68 : 0.68;
      const yaw = actor ? Math.max(-1.05, Math.min(1.05, baseYaw + actor.yaw)) : baseYaw;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(pose.roll), sr = Math.sin(pose.roll);
      this.r00 = cr * cy; this.r01 = -sr; this.r02 = cr * sy;
      this.r10 = sr * cy; this.r11 = cr; this.r12 = sr * sy;
      this.r20 = -sy; this.r21 = 0; this.r22 = cy;
      this.scale = Math.min(this.width / 5.2, this.height / 4.5);
      this.objectScale = actor ? actor.scale * sceneScale : 1; this.subjectVisibility = 1; this.worldZ = 0;
      this.worldX = actor ? actor.x * this.width / (2 * this.scale) : 0;
      this.worldY = actor ? actor.y * this.height / (2 * this.scale) + pose.bob * actor.scale * sceneScale : pose.bob;
      this.cx = this.width / 2; this.cyScreen = this.height * (actor ? 0.5 : 0.51);
    },
    _body() {
      const actor = frameScene?.actors[this.activeFish.id];
      if (frameScene && !actor) { sampleReef(frameScene); return; }
      const state = actor?.state ?? frameState;
      if (!state) return;
      const geometryQuality = frameScene && frameScene.actors.length > 1 ? 'small' : config.quality;
      const extra = actor ? { gaze: actor.gaze, finEffort: actor.finEffort } : {};
      samplePufferfish(state, sample => {
        if (++combinedSamples > 16000 || this.sampleCount >= 16000) throw new RangeError('Pufferfish scene sample cap exceeded');
        // The existing writer subtracts 0.30 from local x. Keep the species origin at zero.
        this._put(sample.x + 0.30, sample.y, sample.z, sample.light, sample.material, sample.seed);
      }, { quality: geometryQuality, monochrome: config.monochrome, staticPose, ...extra });
    },
    _arms: noop, _beak: noop, _saveFish: noop, _drawInk: noop,
    _put: put,
    _rasterize() { rasterize.call(this); },
  };
  /** Sparse original reef and current lines, sampled through the same writer.
   * Fixed topology: 987 reef samples and 90 current samples, no effect queues.
   */
  function sampleReef(scene: PufferfishDirectorState): void {
    const submit = (x: number, y: number, z: number, light: number, material: number, seed: number): void => {
      if (++combinedSamples > 16000) throw new RangeError('Pufferfish scene sample cap exceeded');
      const lens = 1 - z * surface.perspectiveStrength;
      surface._put(x * surface.width / (2 * surface.scale) * lens + 0.30,
        y * surface.height / (2 * surface.scale) * lens, z, light, config.monochrome ? 2 : material, seed);
    };
    for (let station = 0; station < 3; station++) {
      const center = (station - 1) * 0.64;
      // Half-dome rock clusters give the route destinations a stable landmark.
      for (let ring = 0; ring <= 6; ring++) for (let arc = 0; arc <= 28; arc++) {
        const r = ring / 6, angle = arc / 28 * Math.PI;
        submit(center + Math.cos(angle) * r * 0.16, 0.77 - Math.sin(angle) * r * (0.065 + station * 0.01),
          -1.2 + r * Math.sin(angle) * 0.07, 0.27 + Math.sin(angle) * 0.17, 0, 80_000 + station * 1000 + ring * 31 + arc);
      }
      for (let stem = 0; stem < 3; stem++) {
        const height = 0.12 + stem * 0.045;
        const root = center + (stem - 1) * 0.052;
        const bend = scene.flow * 0.05 + Math.sin((staticPose ? 0 : scene.sceneTick) * 0.004 + station + stem) * 0.008;
        for (let point = 0; point <= 16; point++) {
          const u = point / 16;
          submit(root + bend * u * u, 0.74 - u * height, -1.03, 0.43, 1, 84_000 + station * 400 + stem * 100 + point);
        }
        for (let leaf = 1; leaf <= 5; leaf++) for (let point = 0; point < 5; point++) {
          const u = leaf / 6, v = point / 4, sign = leaf % 2 ? 1 : -1;
          submit(root + bend * u * u + sign * v * 0.025, 0.74 - u * height - v * 0.018,
            -1.02, 0.39, 1, 85_500 + station * 400 + stem * 100 + leaf * 6 + point);
        }
      }
    }
    // Six small stream ribbons indicate signed flow. Their topology remains
    // fixed at slack water; contrast and length vary continuously with flow.
    const strength = Math.abs(scene.flow), direction = scene.flow < 0 ? -1 : 1;
    for (let ribbon = 0; ribbon < 6; ribbon++) {
      const centerX = -0.66 + (ribbon % 3) * 0.66;
      const centerY = ribbon < 3 ? -0.68 : 0.35;
      const drift = Math.sin((staticPose ? 0 : scene.sceneTick) * 0.006 + ribbon) * 0.018 * strength;
      for (let point = 0; point < 9; point++) {
        const u = point / 8;
        submit(centerX + direction * (u - 0.5) * (0.045 + 0.12 * strength) + drift,
          centerY + Math.sin(u * Math.PI) * 0.012, -1.4, 0.045 + 0.30 * strength, 1, 88_000 + ribbon * 20 + point);
      }
      for (let wing = -1; wing <= 1; wing += 2) for (let point = 0; point < 3; point++) {
        const u = point / 2;
        submit(centerX + direction * (0.5 * (0.045 + 0.12 * strength) - u * 0.025 * strength) + drift,
          centerY + wing * u * 0.018 * strength, -1.4, 0.045 + 0.30 * strength, 1, 88_200 + ribbon * 10 + (wing + 1) * 2 + point);
      }
    }
  }
  function validateScene(scene: PufferfishDirectorState): void {
    if (!scene || scene.version !== 'pufferfish-director-v1' || !Array.isArray(scene.actors)
        || scene.actors.length < 1 || scene.actors.length > 3) throw new TypeError('Expected a director with 1..3 actors');
    if (!Number.isSafeInteger(scene.tick) || scene.tick < 0 || !Number.isFinite(scene.sceneTick)) throw new RangeError('Invalid director clock');
    if (!scene.config || typeof scene.config.labels !== 'boolean' || scene.config.count !== scene.actors.length)
      throw new TypeError('Director count/labels must match its actors');
    finite(scene.flow, -1, 1, 'flow');
    if (!Number.isInteger(scene.selected) || scene.selected < 0 || scene.selected >= scene.actors.length) throw new RangeError('Invalid selected actor');
    for (const [index, actor] of scene.actors.entries()) {
      if (!actor || actor.id !== index) throw new RangeError('Director actor IDs must be dense and ordered');
      finite(actor.x, -1, 1, 'actor x'); finite(actor.y, -1, 1, 'actor y'); finite(actor.scale, 0.15, 1.5, 'actor scale');
      finite(actor.yaw, -Math.PI, Math.PI, 'actor yaw'); finite(actor.finEffort, 0, 1, 'finEffort');
      record(actor.gaze, ['x', 'y'], 'actor gaze');
      finite(actor.gaze.x, -1, 1, 'gaze x'); finite(actor.gaze.y, -1, 1, 'gaze y');
      if (typeof actor.name !== 'string' || actor.name.length < 1 || actor.name.length > 32
          || !['explorer', 'sentinel', 'drifter'].includes(actor.role)) throw new TypeError('Invalid actor label');
      posePufferfish(actor.state, true);
    }
  }
  function sceneLabels(scene: PufferfishDirectorState): void {
    if (!scene.config.labels) return;
    const c = surface.ctx, compact = surface.width < 700 && scene.actors.length > 1;
    const labelWidth = compact ? 72 : 164, halfWidth = labelWidth / 2;
    c.save(); c.font = `${surface.width < 520 ? 10 : 11}px monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const actor of scene.actors) {
      if (!surface.fish[actor.id]?.visible) continue;
      const x = Math.max(halfWidth + 4, Math.min(surface.width - halfWidth - 4, (actor.x + 1) * surface.width / 2));
      const bodyScale = 1 + actor.state.inflation * (actor.state.config.inflationScale - 1);
      const y = Math.max(16, Math.min(surface.height - 16,
        (actor.y + 1) * surface.height / 2 + (0.92 * bodyScale * actor.scale * sceneScale * surface.scale) + 18));
      c.fillStyle = 'rgba(8,13,15,0.86)'; c.fillRect(x - halfWidth, y - 10, labelWidth, 20);
      c.fillStyle = actor.id === scene.selected ? '#fff4cb' : '#a6c2bd';
      const label = `${actor.id === scene.selected ? '> ' : ''}${actor.name.slice(0,16)}${compact ? '' : ` / ${actor.role}`}`;
      c.fillText(label, x, y, labelWidth - 8);
    }
    c.restore();
  }
  function result(): PufferfishRenderResult {
    const lines: string[] = [];
    for (let row = 0; row < surface.rows; row++) {
      let line = '';
      for (let col = 0; col < surface.cols; col++) {
        const i = row * surface.cols + col;
        line += surface.depth[i] === -Infinity ? ' ' : LEGACY_GLYPHS[surface.glyphs[i]!]!;
      }
      lines.push(line);
    }
    return Object.freeze({ cols: surface.cols, rows: surface.rows, glyphs: surface.glyphCount, samples: combinedSamples,
      width: surface.width, height: surface.height, dpr: surface.dpr, text: lines.join('\n'), actorCount, sceneScale });
  }
  function alive(): void { if (disposed) throw new Error('Pufferfish painter is disposed'); }
  const painter: PufferfishPainter = {
    resize(width, height, dpr) {
      alive(); finite(width, 0, 100000, 'width'); finite(height, 0, 100000, 'height'); finite(dpr, 0.1, 10, 'DPR');
      rawWidth = width; rawHeight = height; rawDpr = dpr;
      hasFrame = false;
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
      alive(); record(patch, ['view', 'quality', 'monochrome', 'maxDpr', 'mode'], 'render patch');
      const next = resolveRenderOptions({ ...config, ...patch });
      config = next; surface.options.mode = config.mode;
      if (rawWidth && rawHeight) painter.resize(rawWidth, rawHeight, rawDpr);
    },
    draw(state, still = false) {
      alive(); if (!surface.width || !surface.height) throw new Error('Cannot draw a zero-size pufferfish surface');
      if (typeof still !== 'boolean') throw new TypeError('staticPose must be boolean');
      posePufferfish(state, still);
      frameScene = undefined; frameState = state; staticPose = still; surface.time = state.tick / 60;
      surface.fish = [fish]; actorCount = 1; combinedSamples = 0; sceneScale = 1;
      render.call(surface);
      hasFrame = true;
      return result();
    },
    drawScene(scene, still = false) {
      alive(); if (!surface.width || !surface.height) throw new Error('Cannot draw a zero-size pufferfish surface');
      if (typeof still !== 'boolean') throw new TypeError('staticPose must be boolean');
      validateScene(scene);
      frameScene = scene; frameState = undefined; staticPose = still; surface.time = scene.tick / 60;
      actorCount = scene.actors.length; combinedSamples = 0;
      // Native 360px review exposed overlap at maximum trio inflation. Preserve
      // normalized actor centers and ownership while opening breathing room.
      // This affects only director trios; original solo pixels remain intact.
      const widthMix = Math.max(0, Math.min(1, (surface.width - 520) / 180));
      sceneScale = actorCount === 3 ? 0.72 + 0.28 * widthMix * widthMix * (3 - 2 * widthMix) : 1;
      surface.fish = Array.from({ length: actorCount + 1 }, (_, id) => ({ id, offset: 0, visible: false }));
      render.call(surface); sceneLabels(scene); hasFrame = true;
      return result();
    },
    hitActor(x, y) {
      alive(); finite(x, -1, 1, 'hit x'); finite(y, -1, 1, 'hit y');
      if (!hasFrame || !surface.width || !surface.height) return null;
      const col = Math.min(surface.cols - 1, Math.floor((x + 1) * surface.width / (2 * surface.cellW)));
      const row = Math.min(surface.rows - 1, Math.floor((y + 1) * surface.height / (2 * surface.cellH)));
      const index = row * surface.cols + col, owner = surface.owners[index];
      return owner !== undefined && owner >= 0 && owner < actorCount && surface.visibility[index]! > 0.2 ? owner : null;
    },
    getConfig: () => config,
    dispose() {
      if (disposed) return;
      disposed = surface.destroyed = true; frameState = undefined; frameScene = undefined; hasFrame = false;
      atlas.width = atlas.height = canvas.width = canvas.height = 1;
      surface.samples = new Float32Array(0); surface.depth = new Float32Array(0); surface.owners = new Int16Array(0);
      surface.tones = surface.glyphs = surface.kinds = new Uint8Array(0); surface.visibility = new Float32Array(0);
    },
  };
  return painter;
}
