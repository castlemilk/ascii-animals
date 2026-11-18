# Combined marine director

The marine director adds opt-in choreography for **cuttlefish, manta rays, and octopuses** through the existing `ascii-animals-review/cuttlefish` entry. It uses their canonical renderer, geometry, buffers, input, ink, and shared scheduler. It does not replace the package root API, add a species registry, or run a separate renderer or animation loop.

This implementation was inspected and started at release [`c06114404900884814bef879a02f1a49a3e7d590`](https://github.com/castlemilk/ascii-animals/tree/c06114404900884814bef879a02f1a49a3e7d590), then fast-forwarded onto current main [`c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`](https://github.com/castlemilk/ascii-animals/tree/c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02) before final validation. That intervening change only reconciles the README; all marine baseline files are identical. The actual marine source is `src/animals/`, including the shared private cuttlefish renderer; the marine animals are not under `src/species/`. The earlier dist-only proposal is not the integration base.

## Gap and scene matrix

The existing [cuttlefish study](../dist/cuttlefish-demo.html) already has population and formation controls, per-individual roles, scene choreography, curiosity and disturbance, rendering modes, and capture tools. The preceding marine demo exposed fewer of those controls and repeatedly assigned hover/curious roles. The director gives the combined cast a shared temporal structure while preserving the original presentation when it is disabled.

| Gap | Implemented direction | Scene |
| --- | --- | --- |
| Independent hovering has little shared purpose | Staggered approaches, a shared exchange, separate explorations, and a return to deeper water | **Reef rendezvous** |
| Banking has little compositional role | Mantas trace rising loops and gliding passes while other animals hold different stations | **Upwelling ballet** |
| Octopus curiosity depends almost entirely on pointer movement | Autonomous arm attention follows a ledge; a deliberate invitation becomes a persistent inspection target | **Tidepool investigation** |
| Changes to the cast erase individual character | Stable individual roles, selected focus, and separate species/role controls | All scenes |
| Paused or reduced-motion users miss the scene | Explicit chapter stills and invitations that compose a still without starting playback | All scenes |

Each scene has the same four chapter identifiers with scene-specific labels. The shared director clock coordinates the cast; small per-member offsets stagger participation. Arrival and departure return through the same distant station with a smooth blend, rather than wrapping a visible animal across the screen.

| Scene ID | Arrive | Engage | Explore | Depart |
| --- | --- | --- | --- | --- |
| `reef-rendezvous` | Gather at the reef | Exchange a glance | Follow separate curiosities | Dissolve into the current |
| `upwelling-ballet` | Find the rising water | Trace the spiral | Glide across the light | Release the turn |
| `tidepool-investigation` | Approach the ledge | Inspect a small discovery | Probe the next crevice | Return to shelter |

The defaults start at one quarter of the cycle, giving an immediately populated composition. Restart explicitly replays the performance from its beginning. A whole sequence is deterministic for the same configuration, seed, dimensions, step sequence, and ordered input cues; this is not a claim that pixels or ink are identical across browser engines or arbitrary timestep changes.

## Typed entry and construction

Importing the entry and normalizing configuration are SSR-safe. Construction requires a browser Canvas 2D element. The package remains a private local review package; the import below refers to an installed local package/tarball, not an npm publication.

```ts
import {
  createMarineDirector,
  normalizeMarineDirector,
  CuttlefishArtwork,
  type MarineDirectorOptions,
  type MarineChapter,
  type MarineCue,
} from 'ascii-animals-review/cuttlefish';

const direction = {
  scene: 'reef-rendezvous',
  duration: 40,
  current: 0.35,
  spread: 1,
  intimacy: 1,
  autonomy: 1,
  focus: 1,
  roles: ['guide', 'forager', 'sentinel'],
  backdrop: true,
} satisfies MarineDirectorOptions;

// Pure validation; does not allocate a canvas or read a DOM.
const validated = normalizeMarineDirector(direction);

const marine = createMarineDirector(canvas, validated, {
  count: 3,
  species: 'manta',
  speciesByAnimal: ['manta', 'octopus', 'cuttlefish'],
  scene: 'reactive',
  behaviors: ['hover', 'hover', 'curious'],
  size: 0.76,
  sizeVariation: 0.2,
  density: 1.2,
  followPointer: true,
  reducedMotion: 'system',
  seed: 17,
});

// Scene metadata is immutable and uses the same IDs as validation.
const choices = CuttlefishArtwork.directorScenes;
marine.setDirector({ scene: 'tidepool-investigation', focus: 2 });
marine.cueDirector({ type: 'invite', x: 0.20, y: 0.15 });
marine.cueDirector({ type: 'release' });

marine.setPaused(true);
marine.showDirectorStill('explore');
marine.cueDirector({ type: 'invite', x: -0.15, y: 0.20 });

// Only an explicit playback action chooses to animate again.
marine.setPaused(false);
marine.cueDirector({ type: 'disturb', id: 2 });

// Restore the existing scene/formation/behavior presentation.
marine.setDirector(null);

// Unmount using the returned legacy marine controller's lifecycle method.
marine.destroy();
```

`createMarineDirector(canvas, directorOptions?, artworkOptions?)` returns the existing `CuttlefishArtwork` class. Its methods are `setOptions`, `setPaused`, `restart`, `pulse`, `advance`, `resize`, `render`, and `destroy`, plus the additive director methods. It is not the `Artwork` facade with `update`, `play`, `pause`, and `dispose`; do not mix the two controller vocabularies.

The package root's strict `createArtwork`/`ArtworkOptions` schema is unchanged. Do not pass `director`, `duration`, or a new scene ID to `createArtwork` and cast away the error. Existing consumers continue to use the three inherited scene IDs and their established lifecycle. Use the existing marine subpath for the additive director API, or call `setDirector` on an existing `CuttlefishArtwork` instance.

## Director configuration and validation

`normalizeMarineDirector()` always applies fixed director defaults and returns an immutable independent snapshot. `setDirector(patch)` merges a patch with the currently active director configuration; `setDirector(null)` disables it. Undefined optional values mean omitted. Unknown keys, wrong types, unsupported enums, non-finite numbers, out-of-range values, fractional focus IDs, sparse role arrays, and more than twelve role entries are rejected.

| Option | Default | Valid values and effect |
| --- | --- | --- |
| `scene` | `reef-rendezvous` | One of the three scene IDs above |
| `duration` | `40` | 20–80 seconds for a cycle at the default travel amount |
| `current` | `0.35` | −1…1; signed current changes direction and energy, not allocation limits |
| `spread` | `1` | 0.65–1.5; composition spacing |
| `intimacy` | `1` | 0–1.5; strength of attention/invitation responses |
| `autonomy` | `1` | 0–1.5; secondary independent motion and foraging attention |
| `focus` | `1` | One-based integer 1–12; mounting/updating also checks that this member exists |
| `roles` | `[]` | Up to twelve role entries; omitted/`auto` entries get species-appropriate roles |
| `backdrop` | `true` | Boolean; enables the director's contextual habitat/current drawing |

Role arrays are copied and frozen. The immutable scene metadata and configuration snapshots cannot be used to mutate another instance. Director updates are validated before committing them, so a rejected patch does not partially change the scene.

Setting a focus beyond the actual cast is rejected by the mounted controller. If a later inherited `setOptions({count: ...})` update reduces the cast below the current focus, focus moves to the last remaining member. Existing valid focus and the copied role list are preserved. Changing the authored scene starts its composed quarter-cycle view; `restart()` is the explicit replay from time zero.

```ts
const roleSource = ['guide', 'forager'] as const;
normalizeMarineDirector({ roles: roleSource });

// Runtime validation rejects these, including for JavaScript callers:
normalizeMarineDirector({ duration: Number.NaN });
normalizeMarineDirector({ focus: 1.5 });
normalizeMarineDirector({ current: 2 });

// Expected static errors in a type-test fixture:
// @ts-expect-error Unknown director scene.
normalizeMarineDirector({ scene: 'random-ocean' });
// @ts-expect-error Director cues are discriminated; invitations need both coordinates.
const incomplete: MarineCue = { type: 'invite', x: 0.2 };
// @ts-expect-error Chapter identifiers are explicit.
const unknownChapter: MarineChapter = 'jump';
```

The inherited `CuttlefishOptions` contract remains the compatibility renderer's documented normalization/clamping behavior. This addition does not silently convert that whole API into the strict root facade. The director configuration itself is strictly validated.

### Roles and cast size

| Role | Choreographic intent |
| --- | --- |
| `auto` | Resolve a stable species-appropriate role |
| `guide` | Lead a route or exchange, with broader independent movement |
| `forager` | Explore local targets, especially with the octopus's arms |
| `sentinel` | Hold a quieter station and watch neighboring activity |
| `companion` | Participate around the lead without duplicating its exact pose |

Automatic roles resolve octopus to forager, the leading manta to guide, and the leading cuttlefish to sentinel; additional members can resolve to companions. Scene role and inherited `behaviors` are separate concepts. The director supplies its own blocking when enabled; inherited behaviors remain available for the classic presentation when it is disabled.

The host still supports **1–12 animals**, but **3–6** is the recommended starting range for a legible authored mixed scene. A twelve-animal scene remains a dense composition, not a promise that every arm or facial feature will read on a small screen. Portrait layout rearranges the stations; it does not create a different renderer. In the default mixed cast `[manta, octopus, cuttlefish]`, choose focus **2** for Tidepool investigation so the octopus is the selected explorer.

## Clocks, inputs, pause, and still alternatives

Director chapter progression and body animation have separate purposes. At default Motion **1.2**, `duration` gives the director cycle's seconds. Lower Motion slows choreography in proportion to `motion / 1.2`; values above 1.2 retain the nominal chapter rate. Motion zero holds the director clock. The inherited Speed control changes body animation cadence independently. A motionless presentation can therefore still have breathing/fin movement while playing. **Pause** is the control that freezes automatic animation altogether.

The host retains the existing scheduler subscription and manual-drive contract. `advance(seconds)` requires `autoStart:false`, accepts 0–0.1 seconds, and is an explicit simulation step even when paused. Neither scene metadata nor `render()` owns another clock. Fixed-step recording/tests should use the same input order and dimensions as the reference sequence.

`showDirectorStill(chapter)` deliberately pauses and composes a representative midpoint of `arrive`, `engage`, `explore`, or `depart`. It sets the geometry clock to that chapter's clock and clears transient reactions and ink, so repeating the choice gives a repeatable pose and a previous escape does not cover the still. It does not start playback. This offers an understandable alternative to animating under reduced motion; it is not a seek API for reconstructing arbitrary past ink.

`cueDirector` accepts a discriminated input:

| Cue | Effect |
| --- | --- |
| `{type:'invite', x, y}` | Set a persistent point of interest with coordinates −0.5…0.5 relative to canvas center; selected animal investigates and companions give space |
| `{type:'release'}` | Release the invitation; interest settles while running, or immediately composes the released pose when paused |
| `{type:'disturb', id?}` | Disturb the specified one-based member, or the current focus; never resumes paused playback |

An explicit invitation can compose a paused still without advancing time. Ambient pointer movement and deliberate cue actions are different input paths: the host continues to filter ordinary pointer movement, while a touch or keyboard action can set a persistent invitation. Cues do not require direct manipulation of private engine fields. Input adapters should clamp/validate normalized coordinates, label the selected animal, and provide clear invitation/release and reaction controls.

Manta responses bank and glide without ink. Octopus gathers its arms, emits visible violet glyph ink, retreats, and returns. Cuttlefish retains its existing curiosity, disturbance, mantle-first escape, and darker ink. The director supplies a coherent scene to return to; it does not replace those species' bounded reaction clocks.

Ink emitted during an authored encounter uses 60% of the inherited launch speed, a 3–4-second particle lifetime, and a smaller age-dependent spread. This keeps the response visible while clearing the composition for recovery. The particle retains that profile if the director is later disabled; newly emitted classic ink keeps its original speed, lifetime, and spread. The existing global 1,150-particle cap is unchanged.

System reduced motion is still governed by the existing `reducedMotion:'system'` contract. Omitted pause honors that preference; explicit `paused:false` or `setPaused(false)` is a deliberate playback override. Director scene/control changes preserve pause. Restart preserves pause. Destroy is idempotent and removes the controller's input/observer/scheduler resources; host UI timers and listeners must also be cleared on unmount.

`getDirector()` provides an immutable director snapshot: enabled state, configuration, scene/chapter/progress, clock/cycle, selected focus, invitation, and bounded member summaries with role, motive, visible state, and phase. Use `getStats()` for the established rendering/playback statistics. Read snapshots at a modest UI rate rather than adding a second animation loop.

## Canonical source and generation ownership

The choreography model and opt-in host integration live in `src/animals/cuttlefish.js`; species-specific geometry/attention changes remain in `src/animals/manta.js` and `src/animals/octopus.js`. These are the current integrated source files. The existing `types/animals/cuttlefish.d.ts` bridge exposes the marine additions and re-exports `types/animals/marine-director.d.ts`. This preserves the project's existing private-JavaScript renderer and declaration strategy; it does not invent a second package build or cast a new incompatible object into the root facade.

Use the established marine generation pipeline:

```sh
node scripts/build-demo.mjs
node scripts/build-demo.mjs --check
```

It generates `dist/artwork.js`, `dist/cuttlefish.html`, and `dist/animals-standalone.html` from canonical marine source and the existing demo inputs. Do not edit those generated renderer/standalone files as independent implementations. The [marine demo](../dist/animals.html) and [self-contained marine page](../dist/animals-standalone.html) use the same engine. The [original recording page](../dist/record.html) remains the original cuttlefish recording flow; its existence does not certify recording of every new director scene.

The package-wide build also generates copied runtimes for other species. **Pufferfish imports the private marine renderer** and therefore deserves a compatibility check even though its behavior is outside this change. Director behavior is opt-in; default construction does not activate it. This branch does not commit another owner's copied pufferfish runtime or rewrite its source. The coordinator can regenerate those copies from the combined accepted source through the existing build pipeline. No shared core scheduler, root package exports, catalogue, or other species is replaced here.

## Review and acceptance

The scene implementation is inspectable runtime code. The accompanying validation manifest is the authority for commands actually run, source/head hashes, and results. Historical cuttlefish or original Track 3 screenshots do not prove the new director's appearance. Native Canvas frame evidence, if supplied, is real renderer execution with its stated fixture limitations; it is not browser or device-performance evidence.

Minimum scene review should establish:

1. **Reef rendezvous:** the initial cast is visibly composed; arrivals are staggered; the exchange changes attention; the exploration and departure chapters produce distinct arrangements without visible wrapping.
2. **Upwelling ballet:** a manta follows its banking/gliding trajectory with a recognizable broad wing plane; companions occupy meaningful stations; reversing current changes the intended circulation without turning a still into an accidental jump.
3. **Tidepool investigation:** octopus arms lead the inspection; an invitation changes its attention and composition; a disturbance gives visible ink and recovery; neighboring species do not simply duplicate the same escape motion.
4. **Individual motives:** changing one member's role/focus changes that member's activity; ordinary appearance controls preserve the role list.
5. **Still alternatives:** all four chapter buttons produce meaningful, paused compositions; invitation/release and scene changes do not choose Play on the user's behalf.

Required compatibility checks include legacy cuttlefish buffer parity with the director disabled, canonical/generated marine parity, existing strict `createArtwork` validation, immutable/atomic director updates, type-positive and type-negative consumers through the existing marine subpath, deterministic fixed-step replay, independent instances, bounded geometry/ink/population, shared scheduler ownership, SSR-safe imports, and disposal after repeated mounting. Recheck the pufferfish dependency separately from visually reviewing the marine demo.

Remaining browser/device gates include actual keyboard and touch delivery, pointer cancellation, narrow layouts, browser font metrics, zoom/DPR resize, OS reduced-motion changes, hidden-tab return, back/forward restoration, PNG/export behavior, and representative device frame-time/memory measurements. No browser pass or performance claim should be inferred from numerical tests alone. The approximately **44×25-cell** octopus arm-resolution limit remains; numeric eight-arm topology does not guarantee eight distinguishable arms at that resolution.
