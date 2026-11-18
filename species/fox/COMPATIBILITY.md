# Fox compatibility review — read only

Reviewed on 18 November 2026.

## Pinned sources

- Main: `0e446c47b491b751d484e40db753ec725652b515`.
- Library PR #2: `e7c16104a1e90c8650f7d3e09cdb1124d0321308`; draft, based on import branch `7e5984d34a139b8de4643f1ed0607897a42d88dc`.
- Main tree has `dist/`, scripts, docs, README and manual Pages workflow; no `package.json`, `src/`, `types/` or species registry.
- Candidate package is private `ascii-animals-review@0.0.0-review.0`, `UNLICENSED`; it is not a published package or accepted species contract.

## Actual public interfaces in PR #2

`types/animals/cuttlefish.d.ts` (blob `884f55029b0bbb7c7ac4446998d98e480a6fedf7`) declares:

- `CuttlefishArtwork(canvas: HTMLCanvasElement, options?: CuttlefishOptions)`.
- Factory `createCuttlefish(canvas, options?)`.
- Methods `setOptions`, `setPaused`, `getStats`, `restart`, `pulse`, `advance(dtSeconds)`, `resize`, `render`, `destroy`.
- Species-specific `Scene`, `Palette`, `Formation`, `Behavior`, `ReactionStage`, `FishStats`, `CuttlefishStats`.
- No `Species`, `AnimalDefinition`, `GeometryWriter`, registry, pluggable renderer or normalized event-log type.

`types/core/index.d.ts` (blob `27ca3339c738642ece13638d10221fd180c083e3`) exports the only generic runtime seam:

```ts
type FrameCallback = (timestampMs: number) => void;
interface SchedulerOptions {
  requestFrame: (callback: FrameCallback) => number;
  cancelFrame: (id: number) => void;
  onError?: (error: unknown) => void;
}
interface Scheduler {
  subscribe(callback: FrameCallback): () => void;
  dispose(): void;
  readonly size: number;
}
function createScheduler(options: SchedulerOptions): Scheduler;
```

The callback receives the host animation-frame timestamp in milliseconds. An unsubscribe function is idempotent. `src/core/scheduler.js` implements these semantics and additionally has internal `getBrowserScheduler(view)`; that helper is NOT exported by the public `./core` entry. The fox must not deep-import it.

`package.json` (blob `8e1585d99e649560a833dd6fc4dafb131fe92669`) exports only `.`, `./cuttlefish`, `./core`. There is no `./fox` entry.

## What geometry reuse currently means

In `src/animals/cuttlefish.js` (blob `243a92171a70de2c450abadad7ed86fc9ad15639`):

- `render()` always calls `_body()`, `_arms()`, `_beak()` for its internal fish states before `_rasterize()`.
- `_put(x, y, z, light, kind, seed)` applies cuttlefish object transformation and projection and writes six float fields. This is an internal method, not a general writer.
- `_rasterize()` assumes active fish ownership, cuttlefish visibility, scene depth/fog, shared atlases/materials and camera fields.
- `_camera()` reads encounter grip/front state, routes, school state, fixed cuttlefish extents, object scale and local normal caches.
- Glyph atlas has three material rows of 24 tones and 25 glyphs; arbitrarily adding a fox material index would break that private mapping.

The inherited browser global on main is `window.CuttlefishArtwork`, not a generic species renderer. Treating private methods as extension hooks, subclassing its fish state, or copying its renderer into the fox would create coupling rather than reuse an established contract.

## Smallest viable local adapter

Keep fox simulation, geometry, normalized inputs and deterministic tick semantics in its own TypeScript files. Keep the demonstrator species-local. Explicitly label central integration acceptance pending.

For scheduling compatibility, accept this structural host injection:

```ts
/** Species-local dependency shape. PR #2 Scheduler is assignable to this. */
export interface FoxFrameSource {
  subscribe(callback: (timestampMs: number) => void): () => void;
}
```

The browser host can use the injected source for automatic frames, subscribing only while running, sized, visible and motion policy permits. On pause/suspension/disposal, it calls its own returned unsubscribe only. It must NEVER call `dispose()` on an externally supplied shared scheduler. The parent/coordinator can pass PR #2 `createScheduler(...)` after that package is accepted; no shared source or export edits are needed in the fox branch. A local structural type test establishes assignability, not installed-package/runtime integration.

If an explicit PR #2 vocabulary adapter is useful, aliases can map `setOptions -> configure`, `restart -> reset`, `destroy -> dispose`, and `setPaused(bool)` to local playback controls, but such mapping is a FOX-LOCAL proposal. Do not promise full `CuttlefishArtwork` substitutability: it has fish/ink/formation-specific options and statistics.

Do not implement arbitrary `advance(dtSeconds)` merely to match the candidate class. Fox's required integer-tick replay is stronger and different. A later bridge may accumulate dt into fixed ticks, cap catch-up, expose discarded wall time, and keep rendering separate. This needs explicit testable policy and should not claim partition equivalence across differing event logs.

## Proposed geometry contract is not merged or exported

`docs/EXTENDING.md` (blob `efc3d2130af7a59e1d8e10b08cdb2a4b737bd898`) explicitly labels the following as a design sketch:

```ts
interface GeometryWriter {
  readonly capacity: number;
  readonly count: number;
  write(x: number, y: number, z: number,
        light: number, material: number, stableSeed: number): boolean;
}
interface AnimalDefinition<State, Options, Input> {
  create(options: Options, seed: number): State;
  update(state: State, input: Input, dtSeconds: number): void;
  sample(state: State, writer: GeometryWriter): void;
  describe(state: State): string;
}
```

This sketch leaves coordinate system, camera ownership, material tables, composition, input schema and disposal unresolved. A future fox adapter can emit its independently authored geometry into a writer supplied by the coordinator, with an explicit axis/unit/material conversion and overflow results. There is no honest direct adapter to the current CuttlefishArtwork renderer without a centrally owned extraction.

## Lifecycle compatibility details

Implemented candidate semantics, from `src/animals/cuttlefish.js` and `docs/API.md`:

- Import is SSR-safe; construction requires Canvas 2D and a browser document.
- `restart()` preserves pause.
- `pulse()` does not implicitly resume paused playback.
- `setOptions()` may reset fish state for scene/formation changes; fox must document its own update/reset effects instead of inheriting these unrelated rules.
- `advance(dtSeconds)` only allows `autoStart: false`, finite [0,0.1] seconds, and explicitly ignores pause. That must not be presented as fox's integer tick API.
- Hidden/offscreen/zero-size/paused/destroyed states unsubscribe automatic work.
- `destroy()` is idempotent; candidate post-destroy mutators are no-ops, and stats remain readable. If fox chooses post-dispose errors, document the intentional difference.
- Reduced-motion constructor policy can be overridden by explicit `paused: false`; transitions to reduced motion pause; leaving reduced motion does not auto-resume. Fox may use a stronger hard static policy but must state that difference.
- `examples/authoring/legacy-controller.mjs` wraps the old global only; it does not solve generic geometry and is not a replacement for the candidate scheduler.

## Acceptance that remains with the coordinator

- Adopt one common species contract, coordinates, glyph/material mapping, writer limits and event schema.
- Canonical renderer extraction for site/recorder/package.
- Add fox subpath/exports and shared registry/catalog only in the central integration change.
- Packed-package import and compatibility tests against the actual accepted package.
- Mixed-species camera/occlusion and device performance.
- Browser/framework integrations beyond the actual local demonstration's verified scope.

## Direct source links

- [PR #2](https://github.com/castlemilk/ascii-animals/pull/2)
- [Public declarations](https://github.com/castlemilk/ascii-animals/blob/e7c16104a1e90c8650f7d3e09cdb1124d0321308/types/animals/cuttlefish.d.ts)
- [Scheduler declarations](https://github.com/castlemilk/ascii-animals/blob/e7c16104a1e90c8650f7d3e09cdb1124d0321308/types/core/index.d.ts)
- [Scheduler runtime](https://github.com/castlemilk/ascii-animals/blob/e7c16104a1e90c8650f7d3e09cdb1124d0321308/src/core/scheduler.js)
- [Cuttlefish source](https://github.com/castlemilk/ascii-animals/blob/e7c16104a1e90c8650f7d3e09cdb1124d0321308/src/animals/cuttlefish.js)
- [Extension proposal](https://github.com/castlemilk/ascii-animals/blob/e7c16104a1e90c8650f7d3e09cdb1124d0321308/docs/EXTENDING.md)
- [Candidate integration limits](https://github.com/castlemilk/ascii-animals/blob/e7c16104a1e90c8650f7d3e09cdb1124d0321308/docs/INTEGRATION-REVIEW.md)

