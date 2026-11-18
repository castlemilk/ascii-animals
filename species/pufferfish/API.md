# Pufferfish v1 · typed species-local API

## Status and ownership

This is a working local TypeScript API and a proposed integration slice. It does **not** establish the shared `ascii-animals` contract, augment PR2's declarations, add a package export, or create a registry. Tested main base is `0e446c47b491b751d484e40db753ec725652b515`. PR2 was initially inspected at `e7c16104a1e90c8650f7d3e09cdb1124d0321308` and re-inspected at then-draft head `8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1`. During delivery, PR2 and the catalogue merged into main `074b90a94bd3a747a68feed554e33a3ab0720f41`; its actual facade and authoring bridge were inspected read-only. The facade still supports only literal `'cuttlefish'`. This species remains on its recorded tested base, with migration to that new main unrun.

`src/` is authoritative. `build/` contains generated JavaScript and declarations so the demo runs without a compiler. Use `build/index.js` for DOM-free species logic; use `build/controller.js` and `build/legacy-painter.js` only for the browser integration. No module reads DOM globals at import time.

## Explicit types

| Type | Purpose |
| --- | --- |
| `PufferfishOptions` / `PufferfishConfig` | Optional input configuration and fully resolved immutable configuration |
| `PufferfishInput` / `PufferfishEvent` | Normalized pointer, deliberate approach or retreat; events include exact integer tick and sequence |
| `PufferfishPhase` | Discriminated union for idle, approach, inflating, holding, recovering and cooldown |
| `PufferfishState` | Immutable version/config/tick/sequence/phase/pointer/inflation/seed variation/reaction count |
| `PufferfishStepResult` | New state, optional phase-kind transition and count of deliberate approaches ignored during busy phases |
| `PufferfishSample`, `PufferfishSampleSink`, `PufferfishGeometryResult` | Original local geometry samples, bounded synchronous emission and exact counts/bounds |
| `PufferfishDefinition` | Species-local `create`, `step`, `sample`, `describe` interface |
| `PufferfishRenderOptions` / `PufferfishRenderResult` | Local presentation settings and actual rendered dimensions/cells/text |
| `PufferfishMountOptions`, `PufferfishController`, `PufferfishStatus` | Browser ownership, playback and resource inspection |
| `PufferfishActionResult` | `queued`, `static-poster`, or `suspended` outcome |

TypeScript cannot prove finite numeric values, valid integer ranges or event ordering. Runtime validation rejects those before allocation or state changes. Unknown object keys, malformed batches and explicitly undefined species config values also reject. Values are never silently coerced or clamped by the species API.

## Species configuration

All intervals use **60 integer ticks per second**. Durations and response sizes are artistic, not biological measurements.

| Option | Default | Accepted range / meaning |
| --- | ---: | --- |
| `seed` | `23` | Integer `0…4294967295`; controls stable phase variation |
| `approachRadius` | `0.30` | Finite `0.10…0.60`; aspect-corrected normalized nearby distance |
| `retreatRadius` | `0.42` | Finite `0.15…0.90`, strictly greater than approach radius |
| `dwellTicks` | `30` | Integer `6…3600`; sustained nearby dwell before inflation |
| `bellyTicks` | `42` | Integer `6…3600`; first smooth inflation stage to 55% |
| `spineTicks` | `36` | Integer `6…3600`; second stage to full inflation |
| `holdTicks` | `180` | Integer `6…3600`; maximum inflated hold before recovery |
| `recoveryTicks` | `150` | Integer `6…3600`; smooth deflation from captured current size |
| `cooldownTicks` | `180` | Integer `6…3600`; minimum rest, followed by retreat-to-rearm requirement |
| `inflationScale` | `1.65` | Finite `1.30…1.80`; maximum body radius multiplier |
| `wobble` | `1` | Finite `0…1`; whole-body bob/roll amplitude; fins retain continuous phases |

Use `resolvePufferfishOptions()` to validate and materialize defaults. A config is frozen; it does not retain mutable user input.

```ts
import { createPufferfish, configurePufferfish, resetPufferfish }
  from './species/pufferfish/build/index.js';

const original = createPufferfish({ seed: 23, inflationScale: 1.5 });
const newRun = configurePufferfish(original, { cooldownTicks: 240 });
const repeat = resetPufferfish(newRun);       // same config and seed, tick 0
const newIdentity = resetPufferfish(repeat, 77); // explicit new seed, tick 0
```

### Update/reset semantics

- `configurePufferfish(state, patch)` validates the full merged config atomically, then returns a **fresh deterministic run**. It clears phase, tick, input, event sequence and reaction count. It does not partially retime an active inflation.
- `resetPufferfish(state, seed?)` returns the same fresh-run state using current configuration and the current or explicitly supplied seed.
- Neither function mutates the old snapshot.
- Browser `configure()` / `reset()` use these semantics while preserving explicit user pause and system motion policy. Lifetime inspection counters (rendered frames, dropped wall time, coalesced inputs) remain controller-lifetime counters.
- `configureRender()` preserves the species state and tick. It revalidates presentation options and rebuilds the bounded atlas/grid, resetting the presentation clock so resize cannot create catch-up work.

## Behavior and event ordering

```ts
type PufferfishPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'approach'; readonly age: number }
  | { readonly kind: 'inflating'; readonly stage: 'belly' | 'spines'; readonly age: number }
  | { readonly kind: 'holding'; readonly age: number }
  | { readonly kind: 'recovering'; readonly age: number; readonly from: number }
  | { readonly kind: 'cooldown'; readonly remaining: number; readonly retreated: boolean };
```

`stepPufferfish(state, {tick, events})` consumes exactly the next tick (`state.tick + 1`). Maximum tick and event sequence are `2147483647`. A batch has at most 16 events. Each event must name that exact tick and have a strictly increasing nonnegative integer `seq` relative to all previous events in the run. The entire batch validates before the next state is produced. Omitted `events` means no new input; `null` is invalid.

| Input | Required fields | Effect |
| --- | --- | --- |
| `pointer` | `x`, `y` in `[-1,1]`, `aspect` in `[0.1,10]` | Persistent normalized target; distance is `hypot(x * aspect, y)` |
| `approach` | No coordinates | Deliberately place the target nearby; still observes dwell/cooldown |
| `retreat` | No coordinates | Clear nearby target; cancel anticipation or enter recovery |

All events also carry `tick` and `seq`. A retreat anywhere in the same validated batch takes precedence over a simultaneous near pointer or approach. Pointer input coalesces at the browser boundary, not in the replay model. Empty water does not react unless the actual normalized proximity becomes nearby and stays there long enough.

Once inflation begins, moving beyond `retreatRadius` starts recovery from the current size. Moving inside the approach boundary again during recovery or cooldown cannot restart it. A held nearby pointer times out after `holdTicks`; cooldown then waits indefinitely for a retreat before permitting a new approach. No pulse/particle list exists.

```ts
import { createPufferfish, stepPufferfish, PUFFERFISH_REPLAY }
  from './species/pufferfish/build/index.js';

let state = createPufferfish({ seed: 23 });
for (let tick = 1; tick <= 1110; tick++) {
  state = stepPufferfish(state, {
    tick,
    events: PUFFERFISH_REPLAY.filter(event => event.tick === tick),
  }).state;
}
// Reproducible final state: idle, two reactions, tick 1110.
```

The guarantee is same species/version/config/seed and ordered tick log → same state and logical cells in the tested runtime, regardless of 1/2/5-tick presentation grouping. It does not equate arbitrary live recordings or guarantee identical font pixels across platforms. Arbitrary serialized snapshot restore is unsupported; replay starts from config/seed. Public state inputs are trusted states created by this version, not an untrusted save-file format.

## Geometry and rendering

`samplePufferfish(state, sink, {quality, monochrome, staticPose})` emits finite local `x,y,z,light,material,seed,part` values. Coordinates are centered on the body, y points down, +z faces the observer. The painter applies whole-body bob/roll once. Appendages remain attached as the body expands. Material is strictly `0 | 1 | 2`, matching the actual existing atlas. Maximum output is 16,000 samples; overflow throws instead of silently truncating.

| Quality | Samples | Target columns |
| --- | ---: | ---: |
| `small` | 4,572 | 72 |
| `standard` | 7,994 | 120 |
| `fine` | 12,922 | 160 |

There are exactly 42 short radial spines and zero particles. Samples are original parametric geometry; no ASCII drawing, image or font file is embedded.

`PufferfishRenderOptions` defaults: `view:'right'`, `quality:'standard'`, `monochrome:false`, `maxDpr:2`. Views are `front | left | right`; left/right are ±0.68 rad three-quarter views. `maxDpr` must be finite `1…2`. Full rear/orbit views, mixed-species scenes, schools and formations are outside this slice.

Cells have aspect 1:1.35. Rows depend on the actual viewport: 900×506 gives 120×50, 900×675 gives 120×67, and minimum 360×270 gives 72×40. The initial authoring target of 120×68 was a plan; actual captures record their true dimensions. Hard ceilings are 160×90 cells, 1200×675 logical pixels, DPR≤2 and 3.24 million backing pixels. Very tall views reduce columns to honor row capacity. Below 360×270 CSS pixels the browser controller uses still poses; recognizability acceptance was checked at the declared minimum, not arbitrary tiny sizes.

Logical text export reads the same depth/glyph buffers that the actual Canvas renderer draws. It contains printable ASCII plus newline. It is not an interactive terminal renderer. Native raster captures use system fonts; the exact fallback face is not guaranteed. Neutral-tone review preserves face contrast rather than flattening all details into one solid intensity.

## Browser controller example

Load the existing `dist/artwork.js`, then pass its actual constructor object as a dependency. The bridge borrows methods and **does not construct a Cuttlefish instance** or start its loop.

```ts
import { mountPufferfish } from './species/pufferfish/build/controller.js';
import type { PufferfishLegacyDependency } from './species/pufferfish/build/legacy-painter.js';

const canvas = document.querySelector<HTMLCanvasElement>('#fish')!;
const legacy = (window as unknown as {
  CuttlefishArtwork: PufferfishLegacyDependency;
}).CuttlefishArtwork;

const fish = mountPufferfish(canvas, legacy, {
  species: { seed: 23, dwellTicks: 30 },
  render: { view: 'front', quality: 'standard', maxDpr: 2 },
  paused: false,
  onChange(status) { console.log(status.phase); },
  onError(error) { console.error(error); },
});

fish.approach();                 // queued input, or a deliberate static poster
fish.retreat();                  // no new pulse; safe recovery
fish.setPaused(true);
fish.configure({ seed: 77 });    // new deterministic run; remains paused
fish.configureRender({ view: 'left' }); // presentation only
fish.reset();                    // same current seed/config; remains paused
console.log(fish.getSnapshot(), fish.getStatus());
fish.destroy();                  // idempotent
```

### Lifecycle contract

- The controller owns one cancellable RAF path, input listeners, resize/intersection observers and a guarded fonts-ready continuation. The legacy renderer owns none of these in this bridge.
- User pause, reduced motion, hidden tab, offscreen canvas, zero size, compact viewport and disposal compose independently. Resting controllers do not schedule recurring RAF work.
- At most five simulation ticks run per frame. Excess wall time is dropped and reported. Suspension/reset invalidates the clock; resume starts fresh rather than catching up.
- Synchronous `onChange` callbacks can pause, reset, configure or destroy. A generation check stops stale work in that same catch-up frame.
- Pointer movement cannot override pause or reduced motion. Deliberate actions show static poses while paused/reduced/compact, with no simulation advancement or queued inflation. Hidden/offscreen/zero-sized actions return `suspended`.
- Leave, pointer cancel, lost capture, blur and suspension discard transient pointer traffic and arrange a normalized retreat on the first resumed tick. No time advances during suspension.
- `onChange` reports meaningful transitions/control changes; it is not a per-frame callback. A thrown callback stops and disposes the instance; `onError` receives the failure when supplied. Construction failure rolls back acquired resources and throws.
- `destroy()` cancels scheduled work, detaches listeners, disconnects observers and releases owned buffers/backing storage. Late callbacks are guarded. Two instances are independent.
- After destruction, `getSnapshot()` and `getStatus()` remain readable. Other calls throw a disposed error, except repeated `destroy()`, which is a no-op. This explicit choice differs from PR2's current no-op-after-disposal candidate and is an item for central consolidation.

There is no React/Vue/Svelte adapter, cross-instance scheduler, save/restore API or package-ready subpath claim in this branch. A future framework wrapper should own mount/update/destroy without putting simulation into framework renders.

## Exact compatibility with the central library candidate

The table records the inspected PR2 interface, now merged unchanged in the relevant facade/renderer files at main `074b90a94bd3a747a68feed554e33a3ab0720f41`. Merged repository source does not mean an npm release or acceptance of a new species contract. The added `createLegacyCuttlefishController` example constructs a Cuttlefish and forwards its public methods; it has no geometry injection seam and cannot host this pufferfish model.

| Concern | Inspected PR2 | This species | Coordinator acceptance needed |
| --- | --- | --- | --- |
| Public interface | Strict TS `createArtwork`, `Artwork`, `ArtworkOptions` and immutable config, with literal species `'cuttlefish'` only | Pure typed `PufferfishDefinition` and browser controller | Settle one shared typed species/host contract; current facade rejects pufferfish |
| Geometry writer | Design sketch only, not exported | Typed local sample sink | Map sample material, origin, normals, owner and capacity semantics |
| Renderer | Canonical JS generates classic `dist/artwork.js`; new 64px atlas cap and `spriteDrawSize` | Calls tested base main's `_put`, `_rasterize`, `makeAtlas`, `render` | Explicitly accept generated-renderer hash and private-field change; prove cell/pixel parity before replacing the base pin |
| Clock | Candidate manual `advance(dt)` and shared RAF scheduler | Explicit integer-tick model; bounded local host | Choose typed host/scheduler integration without changing replay semantics |
| State | Cuttlefish reaction string union, no full replay schema | Discriminated readonly phase/state/event/result types | Agree reusable pieces without leaking Cuttlefish-only options |
| Updates | Facade `update`, `getOptions`, `play`, `pause`, `restart`, `pulse`; undefined fields omitted | Explicit reset-on-species-`configure`, preserve-state `configureRender`, `setPaused`, `reset`, `approach`, `retreat`; undefined species fields reject | Map methods centrally and choose reset/undefined policy |
| Disposal | Facade `dispose`, later mutators no-op | `destroy`, mutators throw; readable status/snapshot | Pick and document a shared policy |
| Reduced motion | Explicit play can override system preference | System preference always keeps static alternatives | Retain this task's stricter requirement or decide it explicitly with owner |
| Exports | Merged private review package map | No shared package/export edits | Add accepted subpath centrally, then pack/type-consume it |
| Evidence | Candidate package/lifecycle checks | Original geometry, actual legacy logical cells, native Canvas renders | Real browser, mobile, heap, accessibility, package and device profiling |

The checked-in bridge is deliberately small and species-specific. It introduces no generic scene engine, projection implementation, atlas copy, registry or competing package core. The exact dependency hash is tested. Its methods are private and can break on a future migration; acceptance remains pending until the coordinator replaces that bridge against a settled typed seam.
