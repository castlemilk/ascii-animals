# Typed marine API

This is the strict `createArtwork` contract in source revision
`f63b20e2045b1070b10bde2efc4eb3a8536e606b`. The package is
`ascii-animals-review@0.0.0-review.0`, a private review candidate. These imports
refer to the package built and installed from that source; see
[Getting started](GETTING-STARTED.md) for installation and the
[validation record](VALIDATION-2026-11-21.md) for publication evidence.

```ts
import {
  createArtwork,
  DEFAULT_OPTIONS,
  normalizeOptions,
  type Artwork,
  type ArtworkOptions,
} from 'ascii-animals-review';

const options: ArtworkOptions = {
  species: 'cuttlefish',
  count: 1,
  scene: 'reactive',
  followPointer: true,
};

// Validation is DOM-free. Construction belongs in the browser mount lifecycle.
const validated = normalizeOptions(options);
```

`createArtwork` supports **cuttlefish, manta and octopus**. The other animals have
their own factories, option types and controllers; see [Animal APIs](ANIMAL-APIS.md).
The build emits this facade's JavaScript, declarations and embedded-source maps
from [`src/public/index.ts`](../src/public/index.ts). The root declaration entry
is assembled from [`types/index.d.ts`](../types/index.d.ts); TypeScript is a
development dependency, not a runtime dependency.

## Configuration

`DEFAULT_OPTIONS` is frozen. `normalizeOptions(options)` validates against those
defaults without reading the DOM, and returns a frozen independent configuration.
`artwork.getOptions()` returns a fresh frozen snapshot with the engine's current
pause state. Both `behaviors` and `speciesByAnimal` are copied and frozen.

| Option | Default | Accepted values / meaning |
| --- | --- | --- |
| `species` | `'cuttlefish'` | `'cuttlefish'`, `'manta'`, `'octopus'`. |
| `speciesByAnimal` | `[]` | Up to 12 supported marine species, indexed from zero; missing entries use `species`. |
| `seed` | `0` | Integer `0`–`4294967295`. |
| `scene` | `'swimby'` | `'swimby'`, `'encounter'`, `'reactive'`. |
| `palette` | `'lagoon'` | `'lagoon'`, `'ultraviolet'`, `'ember'`. |
| `mode` | `'ascii'` | `'ascii'` or `'points'`. |
| `count` | `4` | Integer `1`–`12`. |
| `formation` | `'independent'` | `'independent'`, `'horizontal'`, `'vertical'`, `'diagonal'`, `'random'`. |
| `behaviors` | `[]` | Up to 12 entries: `'auto'`, `'cruise'`, `'hover'`, `'orbit'`, `'curious'`, `'encounter'`; missing entries act as `'auto'`. |
| `size` | `0.7` | `0.35`–`1.4`. |
| `sizeVariation` | `0.45` | `0`–`1`. |
| `spacing` | `1` | `0.65`–`1.6`. |
| `speed` | `1.05` | `0.3`–`2`; not a universal multiplier for reaction and particle time. |
| `ripple` | `1.3` | `0.3`–`2`. |
| `density` | `1.1` | `0.6`–`1.5`; grid and glyph density. |
| `motion` | `1.2` | `0`–`2`; zero is not equivalent to pausing. |
| `depthStrength` | `1.2` | `0`–`2`. |
| `reverse` | `false` | Boolean; reverses the shared route. |
| `showLabels` | `false` | Boolean. |
| `followPointer` | `false` | Boolean; optional pointer-following behavior. Pointer events also have scene-specific effects. |
| `glow` | `true` | Boolean. |
| `paused` | `false` | Boolean; omitting it allows the constructor to honor system reduced motion. |
| `autoStart` | `true` | Boolean; permits automatic scheduling. Use `false` for explicit manual stepping. |
| `reducedMotion` | `'system'` | `'system'` or `'ignore'`; see the policy below. |
| `maxDpr` | `2` | `0.5`–`2`; a ceiling, not a guaranteed effective DPR. |
| `maxPixels` | `8294400` | Integer `65536`–`16777216`; main canvas backing-pixel limit. |
| `maxCells` | `65536` | Integer `1024`–`262144`; separate limit for each body/ink grid. |
| `maxFps` | `60` | `10`–`120`; automatic cadence ceiling, not a guaranteed frame rate. |
| `observeVisibility` | `true` | Boolean; enables offscreen suspension when `IntersectionObserver` is available. |

The strict facade rejects unknown keys, unsupported enums, non-Boolean flags,
non-finite or out-of-range numbers, fractional integer fields and invalid arrays.
`update(patch)` validates the entire patch before changing the renderer; it does
not silently clamp invalid input. At runtime, `undefined` values mean omitted;
with TypeScript's `exactOptionalPropertyTypes`, omit an optional property instead
of assigning `undefined`.

Scene or formation changes rebuild the cast's choreography. Role changes rebuild
the affected animal; species or seed changes rebuild affected species state.
Density/resource changes recalculate backing buffers, while a palette change
rebuilds the glyph atlas. Updating these visual settings is not a substitute for
`restart()` when a replay from time zero is required. See
[`setOptions()` and `_syncFish()`](../src/animals/cuttlefish.js) and
[Species](SPECIES.md) for mixed-school behavior.

Arbitrary font, palette-color and third-party species registration options are not
part of this facade. The named palette, font stack and glyph repertoire come from
the renderer. Do not cast an undocumented key into `ArtworkOptions` to bypass the
contract: runtime validation also rejects unknown keys.

## Controller methods

| Member | Contract |
| --- | --- |
| `species`, `canvas`, `disposed` | Current marine species, caller-owned canvas and teardown state. |
| `getOptions()` | Independent frozen configuration snapshot, including actual user pause. |
| `getStats()` | Fresh reporting object with `paused`, `running`, dimensions, counts and simulation state; treat it as output, not live state to mutate. |
| `update(patch)` | Atomic strict validation; preserves fields omitted from the patch. |
| `play()` / `pause()` | Change user playback state. `play()` can explicitly override a reduced-motion pause in this marine API. |
| `restart()` | Reset time, pointer/reaction state and choreography while preserving pause. |
| `pulse()` | While playing, replay `'swimby'` or startle an eligible animal in the other scenes. Does nothing while paused, disposed or zero-sized; never starts playback. |
| `resize()` | Read the canvas's CSS box, recalculate bounded buffers, and render if sized. |
| `render()` | Draw the current state without advancing simulation time. |
| `advance(seconds)` | Manual simulation and rendering, described below. |
| `dispose()` | Idempotent teardown; later mutators are no-ops and snapshots remain readable. |

`getStats().paused` is user playback state. `running` means the instance is
subscribed to automatic scheduling. For example, an offscreen or zero-sized
instance can have `paused: false` and `running: false`. `fps` is an engine estimate,
and `droppedSeconds` is simulation time discarded by its catch-up limit; neither
is a GPU presentation metric. `phase` is descriptive copy, while `reactionStage`
has the declared stage union. Cast IDs in `getStats().fish` are **one-based**;
option-array indexes are zero-based. See the
[declarations](../types/animals/cuttlefish.d.ts).

## Reduced motion and scheduling

With the default `reducedMotion: 'system'`, **omit `paused`** to respect the current
`prefers-reduced-motion: reduce` preference. Explicit constructor `paused: false`
and a later `play()` are deliberate playback overrides. A transition into reduced
motion pauses an active instance. A transition out of reduced motion does not
resume it automatically. Updating `reducedMotion` back to `'system'` rechecks the
preference unless the same patch explicitly supplies `paused`.

Automatic work is suspended while paused, document-hidden, zero-sized, disposed,
or offscreen when visibility observation is enabled and supported. Eligible
instances share one scheduler per owning window. Disposing one artwork removes
only its subscription; do not dispose a scheduler borrowed by other instances.
These are marine guarantees from
[`CuttlefishArtwork`](../src/animals/cuttlefish.js) and the
[shared scheduler](../src/core/scheduler.js), not a universal animal policy.

Fox, Dragonfly, Gecko and Owl keep system reduced motion authoritative even after
their `play()` method is called. Some species also render a deliberate static
reaction instead of ignoring an action while paused. Consult the individual
species page before constructing a shared control abstraction.

## Manual timing

Construct with `autoStart: false`, then call `advance(seconds)` with a finite
number in `[0, 0.1]`. Each call simulates and renders. Calls explicitly advance
even while `paused`; they also bypass automatic visibility/reduced-motion
suspension. A zero-sized or disposed instance does not advance. `play()` does not
enable scheduling while `autoStart` remains `false`.

The host owns the manual loop, visibility checks, reduced-motion policy and
cancellation. For repeatable state, restart and use the same options, viewport,
ordered inputs and step sequence. This is not arbitrary-time seeking, a portable
recording format, or a promise of identical pixels across browsers/fonts/DPRs.
Other species expose fixed ticks or different stepping APIs; never assume they
accept these same seconds.

## Director and legacy API boundary

`createArtwork()` returns the strict `Artwork` facade. It does **not** expose
`setDirector`, `cueDirector` or `showDirectorStill`. Marine choreography is
available through `createMarineDirector` from `ascii-animals-review/cuttlefish`;
that factory returns `CuttlefishArtwork` with `setPaused()` and `destroy()`.
Its ordinary artwork options use the renderer's normalization contract rather
than this strict facade. See [Marine director](MARINE-DIRECTOR.md) and the
[historical/legacy contract](API.md).

For DOM mounting, responsive sizing, accessible controls and framework cleanup,
see [Browser integration](BROWSER-INTEGRATION.md). Source declarations and the
package built from the pinned revision define implemented behavior; local build
success alone does not verify deployment, visual quality or real-device access.
