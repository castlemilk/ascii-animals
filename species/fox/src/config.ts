import type { FoxOptions, FoxOptionsInput } from './types.js';

export const FOX_LIMITS = Object.freeze({ tickRate: 60, maxTick: 0x7fffffff,
  eventsPerTick: 16, maxPolygons: 48, maxVertices: 1024,
  minCols: 80, minRows: 32, maxCols: 160, maxRows: 64,
  rootMin: -.2, rootMax: .2, groundY: .55 });

export const FOX_DEFAULTS: FoxOptions = Object.freeze({ facing: 'right', scale: .7,
  breathing: .009, tailSway: .075, stalkSpeed: .0018, sniffDepth: .045,
  pounceDistance: .20, pounceHeight: .24, crouchTicks: 24, airTicks: 36,
  landingTicks: 12, recoveryTicks: 36, cooldownTicks: 72 });

const ranges: Record<Exclude<keyof FoxOptions, 'facing'>, readonly [number, number, boolean]> = {
  scale: [.58,.72,false], breathing: [0,.025,false], tailSway: [0,.16,false],
  stalkSpeed: [.0005,.004,false], sniffDepth: [0,.1,false],
  pounceDistance: [.08,.3,false], pounceHeight: [.1,.34,false],
  crouchTicks: [12,60,true], airTicks: [20,60,true], landingTicks: [8,30,true],
  recoveryTicks: [12,90,true], cooldownTicks: [30,180,true],
};

export function finite(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
  return value;
}
export function integer(value: unknown, lo: number, hi: number, name: string): number {
  const n = finite(value, name);
  if (!Number.isSafeInteger(n) || n < lo || n > hi) throw new RangeError(`${name} must be an integer in ${lo}..${hi}`);
  return n;
}
export function plain(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError(`${name} must be a plain object`);
}
export const clamp = (n: number, a: number, b: number): number => Math.min(b, Math.max(a, n));
export const smooth = (n: number): number => { const t = clamp(n, 0, 1); return t*t*(3-2*t); };

/** Strict, atomic validation. Unknown fields and explicit undefined are errors. */
export function resolveFoxOptions(patch: FoxOptionsInput = {}, base: FoxOptions = FOX_DEFAULTS): FoxOptions {
  plain(patch, 'options');
  for (const key of Object.keys(patch)) {
    if (!Object.hasOwn(FOX_DEFAULTS, key)) throw new TypeError(`Unknown fox option: ${key}`);
    if (key === 'facing') {
      if (patch[key] !== 'left' && patch[key] !== 'right') throw new TypeError('facing must be left or right');
    } else {
      const [lo, hi, whole] = ranges[key as keyof typeof ranges];
      const value = finite(patch[key as keyof FoxOptions], key);
      if (value < lo || value > hi || (whole && !Number.isInteger(value))) throw new RangeError(`${key} must be ${whole ? 'an integer ' : ''}in ${lo}..${hi}`);
    }
  }
  return Object.freeze({ ...base, ...patch });
}
