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
      const passingShade = actor && frameScene ? 1 - shadowAt(frameScene, actor.x) : 1;
      samplePufferfish(state, sample => {
        if (++combinedSamples > 16000 || this.sampleCount >= 16000) throw new RangeError('Pufferfish scene sample cap exceeded');
        // The existing writer subtracts 0.30 from local x. Keep the species origin at zero.
        this._put(sample.x + 0.30, sample.y, sample.z, sample.light * passingShade, sample.material, sample.seed);
      }, { quality: geometryQuality, monochrome: config.monochrome, staticPose, ...extra });
    },
    _arms: noop, _beak: noop, _saveFish: noop, _drawInk: noop,
    _put: put,
    _rasterize() { rasterize.call(this); },
  };
  /** The shadow is a soft light change across the reef, never a second animal.
   * Its passage starts before the director's defensive cue and clears during
   * recovery. Static poses use one fixed lighting state, just like the fins.
   */
  function shadowAt(scene: PufferfishDirectorState, x: number): number {
    if (scene.config.scene !== 'shadow' || staticPose) return 0;
    const progress = (scene.sceneTick - 180) / 420;
    if (progress <= 0 || progress >= 1) return 0;
    const envelope = Math.sin(progress * Math.PI) ** 2;
    const distance = (x - (-0.9 + progress * 1.8)) / 0.44;
    return 0.20 * envelope * Math.exp(-distance * distance);
  }
  /** Original asymmetric reef, three depth planes, and suspended grains.
   * Fixed topology: 1,198 samples. Quiet central water stays available to the
   * fish; the nearest rim remains at the lower edges. No effect queues or
   * additional renderer resources, and all scenery keeps one non-actor owner.
   */
  function sampleReef(scene: PufferfishDirectorState): void {
    const time = staticPose ? 0 : scene.sceneTick;
    const strength = Math.abs(scene.flow);
    const submit = (x: number, y: number, z: number, light: number, material: number, seed: number): void => {
      if (++combinedSamples > 16000) throw new RangeError('Pufferfish scene sample cap exceeded');
      const lens = 1 - z * surface.perspectiveStrength;
      surface._put(x * surface.width / (2 * surface.scale) * lens + 0.30,
        y * surface.height / (2 * surface.scale) * lens, z,
        light * (1 - shadowAt(scene, x)), config.monochrome ? 2 : material, seed);
    };
    // Far sand: two interrupted, gently curved bands rather than a hard floor.
    for (let band = 0; band < 2; band++) for (let point = 0; point < 65; point++) {
      const u = point / 64, x = -0.94 + u * 1.88;
      const wave = Math.sin(u * 7 + band * 1.9) * 0.025 + Math.sin(u * 19) * 0.008;
      submit(x, 0.70 + band * 0.075 + wave, -1.8 - band * 0.18,
        0.10 + (point % 7 === 0 ? 0.025 : 0), 0, 80_000 + band * 70 + point);
    }
    // Broad limestone at left, a smaller broken shoulder, and a low central
    // pebble: different silhouettes establish three destinations without clones.
    const rocks = [
      { x: -0.64, y: 0.79, width: 0.23, height: 0.09, depth: -0.95 },
      { x: -0.40, y: 0.80, width: 0.10, height: 0.055, depth: -1.20 },
      { x: 0.02, y: 0.82, width: 0.17, height: 0.047, depth: -1.08 },
    ];
    for (const [rock, shape] of rocks.entries()) {
      for (let ring = 0; ring < 5; ring++) for (let point = 0; point < 24; point++) {
        const r = ring / 4, angle = point / 23 * Math.PI;
        const crest = Math.sin(angle), chip = 0.88 + 0.12 * Math.cos(angle * 5 + rock);
        submit(shape.x + Math.cos(angle) * r * shape.width,
          shape.y - crest * r * shape.height * chip, shape.depth + crest * r * 0.09,
          0.20 + crest * 0.17 + (ring === 4 ? 0.04 : 0), 0, 81_000 + rock * 150 + ring * 25 + point);
      }
    }
    // Three unequal sea-fronds rise from the left rock. A common signed bend
    // follows the current, with gentle independent tip lag on each strand.
    for (let stem = 0; stem < 3; stem++) {
      const root = -0.74 + stem * 0.065, height = [0.17, 0.24, 0.15][stem]!;
      const bend = scene.flow * 0.075 + Math.sin(time * 0.005 + stem * 1.3) * 0.012;
      for (let point = 0; point < 22; point++) {
        const u = point / 21;
        submit(root + bend * u * u + Math.sin(u * 5) * 0.008,
          0.75 - u * height, -0.83, 0.34 + u * 0.10, 1, 82_000 + stem * 100 + point);
      }
      for (let leaf = 1; leaf <= 5; leaf++) for (let point = 0; point < 4; point++) {
        const u = leaf / 6, v = point / 3, sign = leaf % 2 ? 1 : -1;
        submit(root + bend * u * u + sign * v * (0.035 - u * 0.017),
          0.75 - u * height - Math.sin(v * 1.6) * 0.018,
          -0.82, 0.28 + v * 0.08, 1, 82_050 + stem * 100 + leaf * 4 + point);
      }
    }
    // Two fluted sponge cups, offset in depth and size, give the right side a
    // porous material and an open rim; their lip is never a glowing solid disk.
    for (let cup = 0; cup < 2; cup++) {
      const center = 0.60 + cup * 0.125, base = 0.79 - cup * 0.022;
      const height = cup ? 0.235 : 0.155, depth = cup ? -1.08 : -0.86;
      for (let ring = 0; ring < 8; ring++) for (let point = 0; point < 18; point++) {
        const u = ring / 7, angle = point / 18 * Math.PI * 2;
        const radius = (0.026 + u * 0.029) * (1 + Math.sin(angle * 5 + u) * 0.07);
        const pores = point % 5 === 0 && ring % 3 === 1 ? -0.13 : 0;
        submit(center + Math.cos(angle) * radius + u * u * (cup ? 0.022 : -0.012),
          base - u * height + Math.sin(angle) * 0.011,
          depth + Math.sin(angle) * 0.06, 0.28 + Math.max(0, Math.cos(angle + 0.7)) * 0.19 + pores,
          0, 83_000 + cup * 200 + ring * 18 + point);
      }
      for (let point = 0; point < 18; point++) {
        const angle = point / 18 * Math.PI * 2;
        submit(center + Math.cos(angle) * 0.044 + (cup ? 0.022 : -0.012),
          base - height + Math.sin(angle) * 0.010 + 0.006,
          depth + Math.sin(angle) * 0.06 + 0.005, 0.15, 0, 83_160 + cup * 200 + point);
      }
    }
    // Small fan shells lie flat in the central rubble. Dense edge samples read
    // as short ridges at phone size instead of isolated decorative punctuation.
    for (let shell = 0; shell < 2; shell++) for (let rib = 0; rib < 5; rib++) {
      for (let point = 0; point < 13; point++) {
        const u = point / 12, angle = -0.9 + rib * 0.45;
        submit(-0.08 + shell * 0.21 + Math.sin(angle) * u * 0.065,
          0.813 - Math.cos(angle) * Math.sin(u * 1.4) * 0.032,
          -0.99 + shell * 0.02 + u * 0.025, 0.26 + u * 0.12, 0,
          84_000 + shell * 100 + rib * 13 + point);
      }
    }
    // A broken near rim at the corners closes the composition without a line
    // crossing under the fish. Positive depth belongs only to this low border.
    for (const side of [-1, 1]) for (let point = 0; point < 48; point++) {
      const u = point / 47;
      submit(side * (0.94 - u * 0.42), 0.91 + Math.sin(u * 8 + side) * 0.018,
        0.18, 0.15 + Math.sin(u * Math.PI) * 0.08, 0, 85_000 + (side + 1) * 50 + point);
    }
    // Sparse advected grains provide scale and signed flow. They stay in the
    // outer water bands; no arrows, persistent trails or particles on the face.
    for (let grain = 0; grain < 32; grain++) {
      const lane = grain % 4, seed = (Math.imul(grain + 1, 1597334677) >>> 0) / 4294967296;
      const travel = (seed + time * scene.flow * 0.00014) % 1;
      const x = -0.92 + ((travel + 1) % 1) * 1.84;
      const y = lane < 2 ? -0.71 + lane * 0.21 : 0.39 + (lane - 2) * 0.13;
      submit(x, y + Math.sin(time * 0.003 + grain) * 0.008, -1.5,
        0.09 + strength * 0.10 + (grain % 7 === 0 ? 0.045 : 0), 1, 86_000 + grain);
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
      // Fine detail is a ceiling, not a reason to make phone glyphs microscopic.
      // Smooth density changes avoid a resize threshold that suddenly doubles
      // the cell count. The public 72-column small preset stays exact.
      const densityMix = Math.max(0, Math.min(1, (surface.width - 520) / 180));
      const qualityCols = { small: 72, standard: 120, fine: 160 }[config.quality];
      const targetCols = config.quality === 'small' ? 72 : 96 + (qualityCols - 96) * densityMix;
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
