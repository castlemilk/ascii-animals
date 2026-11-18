# Dragonfly v1: typed species API

This directory is a private review module. It supplies TypeScript source and generated ESM/declarations, with no runtime dependencies. It is not a published npm package or an accepted shared species interface. No shared export map is changed.

## Start with the pure model

```ts
import { createDragonfly, type DragonflyInput } from './lib/index.js';

const dragonfly = createDragonfly({ seed: 17, motion: 'slow' });
const events: DragonflyInput[] = [
  { type: 'pointer', tick: 1, seq: 0, x: 0.7, y: -0.3 },
  { type: 'dart', tick: 1, seq: 1 },
];
const result = dragonfly.step(1, events);
if (result.state.behavior.kind === 'dart') {
  console.log(result.state.behavior.to, result.state.behavior.duration);
}
const geometry = dragonfly.sample(); // Rendering never advances state.
dragonfly.setPaused(true);
dragonfly.configure({ trackingSpeed: 0.25 }); // Preserves pause and tick.
dragonfly.reset(42); // Tick 0, new seed, same config and pause.
dragonfly.dispose(); // Idempotent; instance-local.
```

`types.ts` defines explicit options, input, state, discriminated behavior, geometry, result, replay and lifecycle types. `lib/*.d.ts` is generated from these TypeScript implementations. No hand-maintained declaration promises an unimplemented method.

## Options and validation

All numbers must be actual finite JavaScript numbers. No string coercion, clamping, `NaN`, infinities, unknown fields or explicit `undefined` values are accepted. Invalid input throws `TypeError` (wrong kind/unknown field) or `RangeError` (bounds/integer/order). Config batches validate completely before any state/options change.

| Option | Default | Accepted values | Semantics |
| --- | --- | --- | --- |
| `seed` | `17` | Integer 0…4,294,967,295 | Initial phase identity; change through `reset(seed)` only |
| `motion` | `'full'` | `'full'`, `'slow'`, `'static'` | Slow uses quarter-speed tracking/wing clock and fourfold dart/recovery duration; static freezes stepping |
| `followPointer` | `true` | Boolean | Enables target attraction; explicit darts remain available |
| `hoverRadius` | `0.03` | 0…0.08 | World-unit amplitude of small idle hover target |
| `trackingReach` | `0.28` | 0…0.4 | Pointer x extent; y extent is 0.8 of this |
| `trackingSpeed` | `0.36` | 0.05…0.8 | Maximum tracking world units/second before slow multiplier |
| `trackingAcceleration` | `1.6` | 0.2…4 | Tracking world units/second² before slow multiplier |
| `dartDistance` | `0.48` | 0.1…0.65 | Requested short world-unit translation; destination constrained to x ±0.52, y ±0.42 |
| `dartTicks` | `20` | Integer 18…60 | Full-mode duration at 60 Hz; captured when dart begins |
| `recoveryTicks` | `48` | Integer 18…180 | Stationary stabilization duration after dart |
| `cooldownTicks` | `90` | Integer 30…600 | Repeated dart requests ignored for this period |
| `wingHz` | `3` | 0.5…6 | Artistic wing cycle frequency, not a biological claim |
| `wingAmplitude` | `0.27` | 0…0.4 | Independent rotation about each wing root in radians |

`createDragonfly(partialOptions)` fills defaults. `configure(partialConfig)` updates all configuration fields except seed, atomically. A motion-mode change cancels the in-progress reaction, clears target/velocity and preserves the wing phase. Entering static also centers the poster and heading; switching full/slow holds the current position. Other configuration changes preserve pose, tick and reaction. Darts already in progress retain their captured path and duration. Changing config starts a new replay segment.

## Tick and input contract

Call `step(previousTick + 1, events)` exactly once per simulation tick. Integer ticks range from 1 through 2,147,483,647. The model never reads `Date`, `performance`, animation frames, DOM or fonts.

| Input discriminant | Fields beyond `tick` and `seq` | Meaning |
| --- | --- | --- |
| `'pointer'` | `x`, `y` in [-1,1] | Normalized guide target; no automatic dart |
| `'leave'` | None | Clear the target |
| `'dart'` | Optional `{x,y}` `direction`, each in [-1,1], nonzero vector | Explicit short dart; direction is normalized; without it use the latest target or a stable fallback |

At most 16 events fit a tick. Every event must use that exact next tick. `seq` is a nonnegative safe integer and must strictly increase globally across applied inputs. A malformed final event rejects the entire batch without applying earlier events. Events are applied in sequence order; first eligible dart wins. Repeated dart events during dart, recovery or cooldown are counted in `ignoredDarts`, with no queue.

`DragonflyStepResult` reports `kind`, `state`, `acceptedDart`, `ignoredDarts`. While paused or static, a valid call returns `'resting'` with **the same state and no consumed tick or sequence numbers**; all supplied inputs are ignored after validation. A malformed call still fails. Hosts should not poll a resting model.

Behavior is a discriminated union. `idle` and `approach` have no invented response timing fields. `dart` owns `from`, `to`, `initialVelocity`, `elapsed`, `duration`; `recover` owns its elapsed/duration; `cooldown` owns remaining ticks. The Hermite dart matches the incoming velocity and ends stationary. Tracking acceleration limits apply to tracking, not to the deliberate dart's separately bounded trajectory.

## State ownership, reset and disposal

- `getState()` and `getOptions()` return runtime-frozen values, including nested state vectors/behavior. Consumers cannot corrupt internal state through the returned snapshots.
- `sample()` returns fresh caller-owned geometry arrays/points. Editing them cannot affect a later sample or model. Grid buffers from the preview are likewise caller-owned, not borrowed internal buffers.
- `setPaused(boolean)` controls user pause only. It does not reset time, options or the reaction.
- `reset(seed?)` resets tick, event sequence, target, position, velocity, heading, reaction and wing phase from the chosen seed. It preserves all configuration and pause. Omitted seed reuses current seed.
- `setStaticPose(0 | 1)` changes a single deliberate pose without advancing ticks or scheduling. It sets a deterministic seed-relative wing phase as well as the static variant, so it is visible when paused in full/slow mode too. Resume continues from that phase.
- `clearTarget()` cancels transient host input without advancing ticks. It is a host lifecycle boundary, not an event recorded in the fixed-config replay fixture.
- `dispose()` is idempotent. Further mutators, `step()` and `sample()` throw; read-only state/options/status remain available. No other instance is affected.

## Replay and evidence limits

`replayDragonfly(record, renderEvery = 1)` accepts schema 1, species version `dragonfly-v1`, fixed initial options, <=21,600 ticks and <=4,096 ordered inputs. It rejects invalid/versioned/stale records before stepping. Rendering every 1, 2 or 5 ticks does not change simulation state or sample output. A static replay has zero simulation ticks.

The supplied fixture encodes fixed configuration. It does **not** record live option changes, resets, OS preference changes, hidden-state cancellations, or timing from actual mouse hardware. Those operations delimit replay segments. There is no saved-state restore or cross-version migration. Reproducibility is for the same species version, runtime, options, seed and explicit event/tick log; cross-engine transcendental math and system-font pixels are not promised identical.

## Geometry and provisional integration

The model emits finite world-space samples and named wing/eye/tip landmarks. Coordinates are right-handed for the preview: x right, y down, positive z nearer the viewer; thorax root is (0,0,0). Geometry contains root translation and bounded heading already. No camera/perspective/font is embedded in the model. One sample carries `x,y,z,tone,material,part,stableIndex`; tone is 0…1. Maximum output is 6,144 samples.

`writeDragonflyGeometry(model, writer)` structurally accepts the `GeometryWriter` sketch in PR #2, initially inspected at `e7c16104a1e90c8650f7d3e09cdb1124d0321308` and rechecked unchanged at `8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1`. It preflights capacity before writes and reports either `complete`, `insufficient-capacity` with zero writes, or `writer-rejected` with an explicit partial count. An external writer that throws propagates its error; its earlier side effects cannot be rolled back.

The proposed numeric materials are body 0, band 1, wing 2, vein 3, eye 4, leg 5. **These do not match the legacy cuttlefish's three-row atlas.** Camera coordinates, materials, ownership, tick/event semantics and writer overflow must be consolidated with the coordinator before integration. This is not drop-in renderer compatibility.

PR #2's `AnimalDefinition.update(state,input,dtSeconds)` sketch is not adopted: this model requires exact integer ticks, and silently translating arbitrary variable deltas would weaken the deterministic contract. No registry, package export or shared scheduler is copied or changed.

The TypeScript `createArtwork` facade was subsequently merged by the coordinator. It remains unchanged at inspected main `074b90a94bd3a747a68feed554e33a3ab0720f41`, with its species discriminator accepting only `'cuttlefish'`. Its optional `undefined` values mean omitted, and disposed mutators are no-ops. Dragonfly currently rejects explicit undefined option values and throws on disposed mutation; these differences are intentionally documented for coordinator-led contract consolidation. The writer remains an unexported proposal and no claim of direct `Artwork` substitutability is made.
