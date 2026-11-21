# Animal API map

This map describes the package built from [`main` at `f63b20e2045b1070b10bde2efc4eb3a8536e606b`](https://github.com/castlemilk/ascii-animals/tree/f63b20e2045b1070b10bde2efc4eb3a8536e606b), checked on 21 November 2026. Its actual identity is **`ascii-animals-review@0.0.0-review.0`**, with `private: true`. Follow [Getting started](GETTING-STARTED.md) to install the exact local tarball. Do not substitute the unrelated npm package named `ascii-animals`.

All factories below are named runtime exports from the package root. Subpaths expose additional species-specific models, helpers and types; the root does not re-export every helper. Imports are ESM and DOM-free. Browser construction requires an element from an owning browser document. A nonzero CSS size is needed to display and animate it; a zero-sized host may be accepted and suspended, subject to that adapter's sizing rules. [Validation](VALIDATION-2026-11-21.md) distinguishes source, built-package, live Pages and registry evidence.

## Choose the factory and option shape

The option column shows a small valid starting configuration, not the complete defaults. There is no universal animal-options object.

| Animal | Factory and supported import | Host | Example options | Full guide |
| --- | --- | --- | --- | --- |
| Cuttlefish | `createArtwork` from `ascii-animals-review` | Canvas | `{ species: 'cuttlefish', count: 1 }` | [Marine facade](TYPESCRIPT-API.md) |
| Manta ray | `createArtwork` from `ascii-animals-review` | Canvas | `{ species: 'manta', count: 1 }` | [Marine species](SPECIES.md) |
| Octopus | `createArtwork` from `ascii-animals-review` | Canvas | `{ species: 'octopus', count: 1 }` | [Marine species](SPECIES.md) |
| Fox | `createFoxArtwork` from `ascii-animals-review/fox` | Canvas | `{ fox: { seed: 17, paused: true } }` | [Fox](FOX-API.md) |
| Dragonfly | `createDragonflyArtwork` from `ascii-animals-review/dragonfly` | Canvas | `{ model: { seed: 17, motion: 'slow' } }` | [Dragonfly](DRAGONFLY-API.md) |
| Gecko | `createGeckoArtwork` from `ascii-animals-review/gecko` | Canvas | `{ config: { seed: 37, options: { creepSpeed: .1 } } }` | [Gecko](GECKO-API.md) |
| Pufferfish | `createPufferfishArtwork` from `ascii-animals-review/pufferfish` | Canvas | `{ species: { seed: 23 }, paused: true }` | [Pufferfish](PUFFERFISH-API.md) |
| Frog | `createFrogArtwork` from `ascii-animals-review/frog` | Canvas | `{ seed: 23, config: { jumpHeight: .7 }, paused: true }` | [Frog](FROG-API.md) |
| Owl | `createOwlArtwork` from `ascii-animals-review/owl` | HTMLElement containing DOM text | `{ owl: { seed: 7 }, paused: true }` | [Owl](OWL-API.md) |
| Seahorse | `createSeahorseArtwork` from `ascii-animals-review/seahorse` | Canvas | `{ seed: 7, scene: 'study', paused: true }` | [Seahorse](SEAHORSE-API.md) |
| Crab | `createCrabArtwork` from `ascii-animals-review/crab` | Canvas | `{ seed: 7, scene: 'study', paused: true }` | [Crab](CRAB-API.md) |
| Sea turtle | `createTurtleArtwork` from `ascii-animals-review/turtle` | Canvas | `{ seed: 7, scene: 'study', paused: true }` | [Sea turtle](TURTLE-API.md) |
| Butterfly | `createButterflyArtwork` from `ascii-animals-review/butterfly` | Canvas | `{ seed: 7, director: { scene: 'specimen' }, paused: true }` | [Butterfly](BUTTERFLY-API.md) |

`createArtwork(canvas, options)` accepts only `cuttlefish`, `manta` and `octopus` as its `species`. It does not select the other ten factories. There are no public `/manta`, `/octopus` or `/animals/...` package subpaths. The `/cuttlefish` entry exposes the compatibility `CuttlefishArtwork` class and `createCuttlefish`, with its own `setOptions`/`setPaused`/`destroy` methods. Prefer the strict root facade for new marine integrations.

The three marine species share one renderer. Pufferfish also uses that renderer privately; its separate subpath is not evidence of a zero-cost isolated dependency. Source/demo study files are not automatically exported package APIs. A URL that displays an animal and a package subpath that imports it are separate contracts.

Sources: [package export map](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/package.json), [runtime root](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/src/index.js), [root declarations](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/types/index.d.ts) and the linked per-species source references.

## Direct a scene and trigger an interaction

Each scene is opt-in through that animal's options. The marine director uses `createMarineDirector` from `/cuttlefish`, documented in [Marine director](MARINE-DIRECTOR.md); the strict `createArtwork` facade below controls classic scenes only. These APIs are present in the pinned source; this table does not turn another branch's art variants or a local prototype into a released feature.

| Factory | Scene/director options | Scene update | Deliberate interaction |
| --- | --- | --- | --- |
| `createArtwork` (classic scene, not the marine director) | `{ scene: 'reactive', count: 3, formation: 'independent' }` — classic scene; use `/cuttlefish` for the marine director | `update({ scene: 'encounter' })` | `pulse()` starts the applicable scene reaction; it does not play a paused scene |
| `createFoxArtwork` | `{ director: { scene: 'dusk-hunt', count: 2 } }` | `configureDirector({ scene: 'moon-play' })` | `cue('rustle')`, `pounce()`; `pulse()` is pounce |
| `createDragonflyArtwork` | `{ director: { scene: 'patrol', count: 3 } }` | `configureDirector({ scene: 'relay' })` | `cue('dart')`, `setTarget(x, y)`; `pulse()` is dart |
| `createGeckoArtwork` | `{ director: { scene: 'moonlit-wall', population: 3 } }` | `configureDirector({ scene: 'lantern-hunt' })` | `direct({ type: 'moth', x: .25, y: -.2 })`; `pulse()` is startle/shadow |
| `createPufferfishArtwork` | `{ director: { scene: 'reef', count: 2 } }` | `configureDirector({ scene: 'current' })` | `invite(x, y)`, `approach()`, `retreat()`; `pulse()` invokes approach and returns `void` |
| `createFrogArtwork` | `{ director: { scene: 'moonlit-chorus', count: 3 } }` | `updateDirector({ scene: 'firefly-supper' })` | `call()`, `hunt()`, `ripple()`; `pulse()` is leap |
| `createOwlArtwork` | `{ director: { scene: 'duet', count: 2 } }` | `updateDirector({ scene: 'roost' })` | `cue({ kind: 'call', target: 0 })`; `pulse()` is react/stretch |
| `createSeahorseArtwork` | `{ scene: 'kelp-garden', count: 3 }` | `update({ scene: 'tidal-duet' })` | `direct({ type: 'release' })`, `direct({ type: 'anchor' })` |
| `createCrabArtwork` | `{ scene: 'forage', count: 3 }` | `update({ scene: 'tide' })` | `cue('signal')`, `cue('shelter')`, `nextBeat()` |
| `createTurtleArtwork` | `{ scene: 'reef-passage', count: 3 }` | `update({ scene: 'blue-drift' })`; `direct(scene)` also applies its preset | `inspect(0, -.9)` for breath; `inspect(0, .9)` for dive |
| `createButterflyArtwork` | `{ director: { scene: 'morning', count: 4 } }` | `update({ director: { scene: 'roost' } })` | `guide(x, y)`, `cue('gather')`, `cue('breeze')`, `release()` |

Fox, Dragonfly, Gecko and Owl must be created with `director` to use director mutation methods. Pufferfish `configureDirector` and Frog `updateDirector` can enable director mode later; they validate and reset the scene. Changing scene, selecting an actor and restarting do not all have the same reset behavior. Read the relevant guide before recording/replaying those edits.

## Timing and disposal are species-specific

Browser factories schedule themselves. Do not add a second animation loop unless an API explicitly supports manual drive. Headless model ticks are simulation ticks, not milliseconds and not browser RAF timestamps.

| API family | Explicit simulation clock | After browser `dispose()` |
| --- | --- | --- |
| Marine `Artwork` | `advance(seconds)` only with `autoStart: false`; finite `0..0.1` per call, even if paused | Mutators are no-ops; options/stats remain readable |
| Fox | Headless `step(nextTick, inputs?)`, exactly the next absolute integer tick | Other operations reject; `getStatus()` and `disposed` remain readable |
| Dragonfly | Headless `step(nextTick, inputs?)`, exactly the next absolute integer tick | Mutations/export reject; state, options, status and director snapshots remain readable |
| Gecko | Headless `step(events?)` advances one tick; each event carries the expected next tick and ordered sequence | Other operations reject; `getStatus()` and `disposed` remain readable |
| Pufferfish | Pure `stepPufferfish(state, { tick, events })` returns the next result; tick must be next | Mutations/export reject; state/director snapshots, options and status remain readable |
| Frog | Pure `stepFrog(state, nextTick, inputs?)` returns the next result | Other operations reject; `getStatus()` and `disposed` remain readable |
| Owl | Headless `advance(nextTick, inputs?)`, exactly the next absolute integer tick; **not elapsed seconds** | Other operations reject; `getStatus()` and `disposed` remain readable |
| Seahorse, Crab, Turtle, Butterfly | Pure model `advanceTicks(delta)` accepts an integer `0..600`; explicit stepping is independent of browser pause policy | Mutators are no-ops; snapshots remain readable |

Every browser factory supports idempotent disposal and releases its own default shared-scheduler subscription. Dispose on unmount, cancel application-owned timers, abort application listeners and unsubscribe application subscriptions. Do not rely on identical canvas clearing or DOM retention: Dragonfly clears its backing canvas during disposal; Owl removes its owned DOM text nodes. The embedding application continues to own the host element.

For all ten non-marine factories, `play()` clears requested pause without overriding an active system reduced-motion policy. Seahorse, Crab, Turtle and Butterfly additionally expose an explicit `reducedMotion: 'ignore'` opt-out. Marine `createArtwork` has different override semantics: omitted `paused` respects the system preference, while deliberate `play()` or `paused: false` can resume. Do not spread a common `paused: false` default into every factory and assume equivalent accessibility behavior.

Sources: [public adapters](https://github.com/castlemilk/ascii-animals/tree/f63b20e2045b1070b10bde2efc4eb3a8536e606b/src/public), [Fox browser host](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/species/fox/src/browser.ts), [Dragonfly browser host](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/species/dragonfly/src/browser.ts), [Gecko browser host](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/species/gecko/src/browser.ts), [Pufferfish controller](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/species/pufferfish/src/controller.ts), [Frog controller](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/species/frog/src/controller.mts) and [Owl browser host](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/species/owl/src/browser.ts).

## Keyboard and touch belong to the correct layer

Give interactive canvases focusability (`tabindex="0"`), a concise accessible label, visible instructions and native buttons. Canvas drawings of glyphs are not an accessible text substitute. Decorative artwork should not take keyboard focus. Pointer/touch listeners do not supply the surrounding control labels, focus treatment or keyboard alternatives.

| Browser factory | Keyboard behavior installed by the library |
| --- | --- |
| Marine, Fox, Owl, Butterfly | None; keyboard controls shown in their demos are application code. Provide native buttons or scoped key bindings. |
| Dragonfly | Arrows guide; Space toggles pause. In director mode, `1`–`4` select and `D`/`L`/`R` request dart/perch/return. |
| Gecko | Arrows guide, Space toggles pause, Escape clears. Director mode adds `M` for moth and `C` for contextual inspection. |
| Pufferfish | Director mode only: `1`–`3` select, `I` invites, `A` approaches, Escape retreats, Space toggles pause, `R` resets. |
| Frog | Arrows target, Enter/Space leap, Escape clears. Pond mode adds `1`–`3` selection and `C`/`H`/`R` call/hunt/ripple. Space is an action, not pause. |
| Seahorse | Left/right select, up/down guide, Enter inspects, `H` anchors, `R` releases, Space toggles pause, Escape clears. |
| Crab | Arrows guide, `1`–`5` select, `F`/`S`/`H` forage/signal/shelter, `N` advances chapter, Space toggles pause, Escape clears. |
| Turtle | Arrows guide, Enter inspects, `B` breathes, `D` dives, Escape clears. Supply a native pause control. |

Bindings attach to the host, not the whole page. Keep touch scrolling available, offer deliberate controls that do not require hover and avoid duplicating a library binding in your own handler. The species guides specify their tap/guide and reduced-motion still behavior; API/source checks do not certify physical-device touch or screen-reader acceptance.

## Across-screen journeys

`ascii-animals-review/movement` exposes typed seeded viewport paths. `ascii-animals-review/movement/marine` connects them to the cuttlefish/manta/octopus renderer. When enabled, movement owns travel and lanes while natural scene/formation settings remain saved for disabling it. This does not make the other ten factories marine adapters. See [Movement](MOVEMENT.md) for its distinct lifecycle, resize, reverse and reduced-motion policy.
