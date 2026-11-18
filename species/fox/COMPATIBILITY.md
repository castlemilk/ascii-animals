# Fox compatibility review — read only

## Latest incoming proposal — 18 November 2026

Before the fox push, re-inspected PR #2 at exact head **`8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1`**, following the earlier review of `e7c16104a1e90c8650f7d3e09cdb1124d0321308`. The comparison contains nine additional commits, including merges of the existing main history. PR #2 remains an open draft. This read-only review did not modify that branch, execute its build, or import its proposed package into the fox.

**The latest proposal adds a real TypeScript public facade and canonical browser generation. It still supports only cuttlefish and does not provide a generic species or geometry extension point. No fox model change or competing shared contract is required.** The sections below headed “Initial review” retain the original findings as historical evidence; the deltas in this section take precedence over their older export and migration status statements.

### Current public surface

| Area | Actual interface at `8c530b10…` | Fox compatibility |
| --- | --- | --- |
| New strict facade | `createArtwork(canvas: HTMLCanvasElement, options?: ArtworkOptions): Artwork`; `normalizeOptions`; `DEFAULT_OPTIONS` | Available in the draft package root. `ArtworkOptions extends CuttlefishOptions` with `species?: 'cuttlefish'`; `Artwork.species` is `'cuttlefish'`. Neither `'fox'` nor a species definition is accepted. |
| New facade types | `Artwork`, `ArtworkOptions`, `ArtworkConfig`, `ArtworkStats` | These are cuttlefish options/stats and lifecycle wrappers, not a generic species contract. |
| Existing exports | `CuttlefishArtwork`, `createCuttlefish`, `createScheduler` | Retained. Package export paths remain `.`, `./cuttlefish`, `./core`; no `./fox` or public geometry writer exists. |
| Scheduler | `Scheduler.subscribe((timestampMs: number) => void): () => void` | Source and declarations are byte-identical to the earlier head. The implemented fox-local `FoxFrameSource` injection remains structurally compatible. Only the fox's subscription is released. |
| Geometry sketch | `AnimalDefinition<State, Options, Input>` / `GeometryWriter` in `docs/EXTENDING.md` | This document is also byte-identical and still labels the interfaces a design sketch. The new facade does not adopt them. |

The new facade validates unknown keys, enum and Boolean values, finite numeric ranges, integer resource/population limits and role arrays before forwarding an update. It returns immutable configuration snapshots and copies and freezes role arrays. Its optional `undefined` fields mean omitted. Fox's `configure` similarly validates atomically, but explicitly provided `undefined` option values are rejected; this distinction is intentional and documented rather than hidden by an adapter.

### Exact lifecycle and time differences

The draft facade has `getOptions`, `getStats`, `update`, `play`, `pause`, `restart`, `pulse`, `advance`, `resize`, `render`, and `dispose`. `update` returns `void`; fox `configure` returns the validated `FoxOptions`. Cuttlefish scene/formation changes reset its choreography; fox keeps an active pounce's captured settings through recovery/cooldown, then applies any updated morphology.

The candidate's `advance(seconds)` remains finite `[0, 0.1]` manual time, requires `autoStart:false`, and explicitly ignores pause. Fox's `step(nextIntegerTick, orderedInputs)` is a separate deterministic API and validates without consuming inputs or time while paused. Its `reset(seed?)` also has a seeded-replay meaning that is not provided by the facade's `restart()`.

Both preserve user pause across restart/reset and do not let reaction input resume playback. The facade permits an explicit `play()` or `paused:false` to override its initial system-motion pause. The fox browser host keeps reduced motion static. After candidate `dispose`, mutators are no-ops and snapshots remain readable; after fox core `dispose`, other operations throw, while the fox browser host retains only its documented diagnostic `getStatus()` access. A common naming wrapper would not erase these semantic differences, so this PR does not claim `Artwork` substitutability.

### Canonical rendering status changed; species integration remains pending

The candidate now implements `scripts/build-demo.mjs`: it generates the browser-global `dist/artwork.js` and embedded standalone HTML from `src/core/scheduler.js` plus `src/animals/cuttlefish.js`, records a source hash, and checks stale output. `scripts/build.mjs` also compiles `src/public/index.ts` using pinned TypeScript `5.9.3`. The original imported renderer is retained as `test/fixtures/legacy-artwork.cjs` for regression comparison. This supersedes the initial review's statement that the candidate still required canonical site/package generation.

This consolidation is implemented **in the unmerged proposal**, and is distinct from extracting an accepted generic species geometry/material/camera contract. The latter remains unresolved. The current renderer still owns cuttlefish geometry and private fish state; its new facade does not expose `_put`, `_camera`, `_rasterize`, a registry, or a species factory hook. The fox's additive implementation and species-local preview therefore remain appropriate. Shared exports/catalog adoption, accepted geometry mapping, packed-package integration and mixed-species rendering remain coordinator work.

The upstream `docs/INTEGRATION-REVIEW.md` now records bounded Chrome acceptance for the canonical cuttlefish build. That is an upstream evidence report, not a browser test run by this fox review and not evidence that fox is integrated or deployed. Its remaining device-performance, accessibility and cross-browser limits are also explicitly recorded upstream.

### Pinned evidence for the latest inspection

| File at `8c530b10…` | Git blob SHA |
| --- | --- |
| `src/public/index.ts` | `43a3cca9726473cda8610d34b1a5e5eb379c9f4f` |
| `types/index.d.ts` | `0ca237fa867d3bb87b172c0532f4e6e76f198aaa` |
| `package.json` | `64d89263ca72e6a166ec634b47ccc174123f329d` |
| `src/core/scheduler.js` | `0b90c3a3f6b1b762b1542e90c227cc5b5a01960b` (unchanged) |
| `types/core/index.d.ts` | `27ca3339c738642ece13638d10221fd180c083e3` (unchanged) |
| `src/animals/cuttlefish.js` | `cd3b09764e4625e7afea34f93fa657337cab7ad9` |
| `docs/EXTENDING.md` | `efc3d2130af7a59e1d8e10b08cdb2a4b737bd898` (unchanged) |
| `scripts/build-demo.mjs` | `0af74694ce843110e025cb3c024860aeb5feee54` |
| `docs/INTEGRATION-REVIEW.md` | `18d6852e1224de765827d1c4a126ca44011fc272` |

Sources: [exact comparison](https://github.com/castlemilk/ascii-animals/compare/e7c16104a1e90c8650f7d3e09cdb1124d0321308...8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1), [TypeScript facade](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/src/public/index.ts), [typed API documentation](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/docs/TYPESCRIPT-API.md), [package export map](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/package.json), [scheduler](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/src/core/scheduler.js), [extension sketch](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/docs/EXTENDING.md), [canonical build](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/scripts/build-demo.mjs), [upstream acceptance report](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/docs/INTEGRATION-REVIEW.md).

## Initial review — historical head `e7c16104…`

Reviewed on 18 November 2026. The following sections describe that earlier exact head; consult the latest-head section above for subsequent changes.

### Pinned sources

- Main: `0e446c47b491b751d484e40db753ec725652b515`.
- Library PR #2: `e7c16104a1e90c8650f7d3e09cdb1124d0321308`; draft, based on import branch `7e5984d34a139b8de4643f1ed0607897a42d88dc`.
- Main tree has `dist/`, scripts, docs, README and manual Pages workflow; no `package.json`, `src/`, `types/` or species registry.
- Candidate package is private `ascii-animals-review@0.0.0-review.0`, `UNLICENSED`; it is not a published package or accepted species contract.

### Actual public interfaces at the initial head

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

### Geometry reuse at the initial head

In `src/animals/cuttlefish.js` (blob `243a92171a70de2c450abadad7ed86fc9ad15639`):

- `render()` always calls `_body()`, `_arms()`, `_beak()` for its internal fish states before `_rasterize()`.
- `_put(x, y, z, light, kind, seed)` applies cuttlefish object transformation and projection and writes six float fields. This is an internal method, not a general writer.
- `_rasterize()` assumes active fish ownership, cuttlefish visibility, scene depth/fog, shared atlases/materials and camera fields.
- `_camera()` reads encounter grip/front state, routes, school state, fixed cuttlefish extents, object scale and local normal caches.
- Glyph atlas has three material rows of 24 tones and 25 glyphs; arbitrarily adding a fox material index would break that private mapping.

The inherited browser global on main is `window.CuttlefishArtwork`, not a generic species renderer. Treating private methods as extension hooks, subclassing its fish state, or copying its renderer into the fox would create coupling rather than reuse an established contract.

### Smallest viable local adapter

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

### Proposed geometry contract is not merged or exported

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

### Lifecycle compatibility details

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

### Initial outstanding acceptance

- Adopt one common species contract, coordinates, glyph/material mapping, writer limits and event schema.
- Canonical renderer extraction for site/recorder/package.
- Add fox subpath/exports and shared registry/catalog only in the central integration change.
- Packed-package import and compatibility tests against the actual accepted package.
- Mixed-species camera/occlusion and device performance.
- Browser/framework integrations beyond the actual local demonstration's verified scope.

### Initial source links

- [PR #2](https://github.com/castlemilk/ascii-animals/pull/2)
- [Public declarations](https://github.com/castlemilk/ascii-animals/blob/e7c16104a1e90c8650f7d3e09cdb1124d0321308/types/animals/cuttlefish.d.ts)
- [Scheduler declarations](https://github.com/castlemilk/ascii-animals/blob/e7c16104a1e90c8650f7d3e09cdb1124d0321308/types/core/index.d.ts)
- [Scheduler runtime](https://github.com/castlemilk/ascii-animals/blob/e7c16104a1e90c8650f7d3e09cdb1124d0321308/src/core/scheduler.js)
- [Cuttlefish source](https://github.com/castlemilk/ascii-animals/blob/e7c16104a1e90c8650f7d3e09cdb1124d0321308/src/animals/cuttlefish.js)
- [Extension proposal](https://github.com/castlemilk/ascii-animals/blob/e7c16104a1e90c8650f7d3e09cdb1124d0321308/docs/EXTENDING.md)
- [Candidate integration limits](https://github.com/castlemilk/ascii-animals/blob/e7c16104a1e90c8650f7d3e09cdb1124d0321308/docs/INTEGRATION-REVIEW.md)
