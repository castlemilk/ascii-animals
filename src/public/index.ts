import { CuttlefishArtwork } from '../animals/cuttlefish.js';
import type { CuttlefishOptions, CuttlefishStats, Behavior } from '../animals/cuttlefish.js';

/** The supported built-in species. New species are not implied by this API. */
export interface ArtworkOptions extends CuttlefishOptions { species?: 'cuttlefish' }
export type ArtworkConfig = Readonly<Required<ArtworkOptions>>;
export type ArtworkStats = Readonly<CuttlefishStats>;

/** Defaults before applying the host's reduced-motion preference. */
export const DEFAULT_OPTIONS: ArtworkConfig = Object.freeze({
  species: 'cuttlefish', scene: 'swimby', palette: 'lagoon', mode: 'ascii',
  count: 4, formation: 'independent', behaviors: Object.freeze([]),
  size: .7, sizeVariation: .45, spacing: 1, reverse: false, showLabels: false,
  speed: 1.05, ripple: 1.3, density: 1.1, motion: 1.2, depthStrength: 1.2,
  followPointer: false, glow: true, paused: false, autoStart: true,
  reducedMotion: 'system', maxDpr: 2, maxPixels: 8294400, maxCells: 65536,
  maxFps: 60, observeVisibility: true
});
const enums: Partial<Record<keyof ArtworkOptions, readonly string[]>> = {
  species: ['cuttlefish'], scene: ['swimby', 'encounter', 'reactive'],
  palette: ['lagoon', 'ultraviolet', 'ember'], mode: ['ascii', 'points'],
  formation: ['independent', 'horizontal', 'vertical', 'diagonal', 'random'],
  reducedMotion: ['system', 'ignore']
};
const ranges: Partial<Record<keyof ArtworkOptions, readonly [number, number]>> = {
  speed: [.3, 2], ripple: [.3, 2], density: [.6, 1.5], motion: [0, 2], depthStrength: [0, 2],
  count: [1, 12], size: [.35, 1.4], sizeVariation: [0, 1], spacing: [.65, 1.6],
  maxDpr: [.5, 2], maxPixels: [65536, 16777216], maxCells: [1024, 262144], maxFps: [10, 120]
};
const integers = new Set(['count', 'maxPixels', 'maxCells']);
const behaviors: readonly Behavior[] = ['auto', 'cruise', 'hover', 'orbit', 'curious', 'encounter'];

/** Validate a patch before applying it. Unlike the legacy API, invalid values
 * are rejected rather than silently coerced/clamped. Undefined means omitted.
 * Returns a frozen, independent configuration, including an immutable role list.
 */
function mergeOptions(patch: ArtworkOptions, base: ArtworkConfig): ArtworkConfig {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Options must be an object.');
  // Inspect unknown keys at runtime too: JavaScript callers do not have TS checks.
  for (const key of Object.keys(patch)) if (!Object.hasOwn(DEFAULT_OPTIONS, key)) throw new TypeError(`Unknown option: ${key}`);
  const clean: ArtworkOptions = {};
  for (const key of Object.keys(DEFAULT_OPTIONS) as (keyof ArtworkOptions)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    const choices = enums[key], range = ranges[key];
    if (choices) {
      if (typeof value !== 'string' || !choices.includes(value)) throw new TypeError(`Invalid ${key}`);
    } else if (range) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < range[0] || value > range[1] || (integers.has(key) && !Number.isInteger(value))) throw new RangeError(`Invalid ${key}: expected ${range[0]}..${range[1]}`);
    } else if (key === 'behaviors') {
      if (!Array.isArray(value) || value.length > 12 || !Array.from(value).every(role => behaviors.includes(role))) throw new TypeError('Invalid behaviors: expected up to 12 supported roles.');
    } else if (typeof value !== 'boolean') throw new TypeError(`Invalid ${key}: expected boolean`);
    // Validation above narrows each value by its field schema; defineProperty
    // preserves the field without an unsafe union assignment or any cast.
    Object.defineProperty(clean, key, { value, enumerable: true });
  }
  return Object.freeze({ ...base, ...clean, behaviors: Object.freeze([...(clean.behaviors ?? base.behaviors)]) });
}

/** Validate options against immutable defaults. Undefined properties are omitted. */
export function normalizeOptions(options: ArtworkOptions = {}): ArtworkConfig {
  return mergeOptions(options, DEFAULT_OPTIONS);
}

export interface Artwork {
  readonly species: 'cuttlefish';
  readonly canvas: HTMLCanvasElement;
  readonly disposed: boolean;
  /** Independent immutable snapshot; includes effective playback pause. */
  getOptions(): ArtworkConfig;
  getStats(): ArtworkStats;
  /** Atomic validation. Scene/formation changes reset choreography; role changes reset that animal. */
  update(options: ArtworkOptions): void;
  play(): void;
  pause(): void;
  /** Reset the performance without changing pause state. */
  restart(): void;
  /** Scene action: replay swim-by, or startle an eligible animal. Never resumes playback. */
  pulse(): void;
  /** Manual drive only (autoStart:false). Explicit advancement ignores pause. */
  advance(seconds: number): void;
  resize(): void;
  render(): void;
  /** Idempotent teardown. Later mutators are no-ops, snapshots remain readable. */
  dispose(): void;
}

/** Browser-only construction, SSR-safe module import; zero runtime dependencies. */
export function createArtwork(canvas: HTMLCanvasElement, options: ArtworkOptions = {}): Artwork {
  let config = normalizeOptions(options);
  // Omitted pause must not override a system reduced-motion preference.
  const { species: _species, paused: _paused, ...initial } = config;
  const engine = new CuttlefishArtwork(canvas, options.paused === undefined ? initial : { ...initial, paused: options.paused });
  const snapshot = (): ArtworkConfig => Object.freeze({ ...config, paused: engine.paused, behaviors: Object.freeze([...config.behaviors]) });
  return Object.freeze({
    species: 'cuttlefish', canvas,
    get disposed() { return engine.destroyed; },
    getOptions: snapshot,
    getStats: () => engine.getStats(),
    update(patch: ArtworkOptions) {
      if (engine.destroyed) return;
      const next = mergeOptions(patch, snapshot());
      const { species: _species, paused: _paused, reducedMotion: _motion, ...raw } = next;
      const playback: CuttlefishOptions = {};
      if (patch.paused !== undefined) playback.paused = patch.paused;
      if (patch.reducedMotion !== undefined) playback.reducedMotion = patch.reducedMotion;
      engine.setOptions({ ...raw, ...playback });
      config = next;
    },
    play() { engine.setPaused(false); }, pause() { engine.setPaused(true); },
    restart() { engine.restart(); }, pulse() { engine.pulse(); },
    advance(seconds: number) { engine.advance(seconds); },
    resize() { engine.resize(); }, render() { engine.render(); },
    dispose() { engine.destroy(); }
  });
}
