# Owl integration

**Current source contract:** checked against [`main` at `f63b20e2045b`](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/src/public/owl.ts) on 21 November 2026. The API below is present in that source. Use the [local-package setup](GETTING-STARTED.md); [current validation](VALIDATION-2026-11-21.md) separates the built package, live Pages and npm availability. Older authoring bases and capture results below are historical evidence, not additional release claims.

The recovered Pro implementation is now integrated through the explicit `ascii-animals-review/owl` subpath and root named exports. The package remains private and unpublished. Owl is a semantic DOM-text artwork, not a canvas implementation of the marine `Artwork` interface.

```ts
import { createOwlArtwork } from 'ascii-animals-review/owl';
const owl = createOwlArtwork(document.querySelector<HTMLElement>('#owl')!, {
  owl: { seed: 7, headYawLimitDeg: 28, reactionStrength: 0.8 },
  grid: { cols: 96, rows: 54 },
});
owl.guide(0.5, -0.2);
owl.pulse(); // explicit blink → ruffle → stretch; may be ignored in cooldown
owl.pause();
owl.restart(); // preserves user pause
console.log(owl.exportText());
owl.dispose();
```

## Contract

`play`, `pause`, `restart`, and `pulse` are ergonomic aliases for `setPaused(false)`, `setPaused(true)`, `reset`, and `react`. Original methods remain available: `guide`, `leave`, `update`, `setGrid`, `getStatus`, `getSnapshot`, and `exportText`. The instance identifies `species: 'owl'`, its host `element`, and `disposed`.

The owning window shares one default animation scheduler with other integrated artworks. Each instance removes only its own subscription. An explicit borrowed `frameSource` or environment frame functions remain authoritative. Pause, hidden/offscreen state, reduced motion, a small host, and disposal suspend animation. Reduced-motion Guide/React displays an intentional still pose without advancing simulation. Play does not override that preference.

Configuration is validated before mutation. The full typed `OwlOptions` supports seed, bounded head yaw/pitch, attention smoothing, idle amplitude, reaction strength, feather contrast, and blink/ruffle/stretch/recovery/cooldown tick durations. Seed changes through `reset(seed)` rather than `update`. Browser options separately configure grid, initial pause, frame source, status callback and environment. Grid supports columns, rows and silhouette; browser cell aspect is fixed at 0.55. See [the species reference](../species/owl/README.md) for exact defaults, limits and action outcomes.

The pure `createOwl` model is DOM-free and uses absolute integer ticks via `advance(tick, orderedInputs)`, not elapsed milliseconds. `renderOwlGrid` exposes the text sampler and `makeOwlPoster` creates nonmutating still poses. The old speculative shared adapter proposal is deliberately not a public package export. `createArtwork({species:'owl'})` is not supported.

## Optional twilight director

The director is an additive Owl-specific API. Omitting `director` retains the existing single-Owl behavior and grid selection. Passing `director: {}` opts into the two-Owl defaults below. The public factory still takes an `HTMLElement`, uses the existing Owl geometry and glyph sampler, and renders one composed DOM text grid. It does not introduce a marine renderer or a shared species contract.

```ts
import {
  createOwlArtwork,
  type OwlBrowserOptions,
} from 'ascii-animals-review/owl';

const options = {
  owl: { seed: 7, headYawLimitDeg: 28, reactionStrength: 0.85 },
  director: {
    scene: 'duet', count: 2, layout: 'split',
    roles: ['sentinel', 'dreamer'], tempo: 0.85, sociability: 0.9,
  },
} satisfies OwlBrowserOptions;

// Invoke in a browser after the host has a display size.
const owls = createOwlArtwork(document.querySelector<HTMLElement>('#owl')!, options);
owls.guide(0.6, -0.3, 1); // Ember: right/up in Ember's own viewport
owls.cue({ kind: 'call', target: 0 }); // visual call and delayed companion reply; no audio
owls.updateDirector({ layout: 'bough', alertness: 0.55 });
owls.pause(); // freeze the current displayed scene
owls.cue({ kind: 'stretch', target: 1 }); // deliberate still, without advancing time
const frame = owls.exportText();
owls.reset(7); // retain options and pause; rewind both Owls deterministically
owls.dispose(); // remove only this instance's DOM, listeners and clock subscription
```

The complete [typed director example](../species/owl/examples/typed-director.ts) covers browser ownership, an explicit still scene and deterministic pure-model input. Its repository-relative import resolves the built public Owl entry; an installed review package uses `ascii-animals-review/owl` as above.

### Options and validation

`OwlDirectorOptions` is a partial `OwlDirectorConfig`. Creation fills omitted fields from `OWL_DIRECTOR_DEFAULTS`; `updateDirector(patch)` and pure `director.update(patch)` retain unmentioned fields.

| Option | Runtime default | Accepted values and effect |
| --- | --- | --- |
| `scene` | `'lookout'` | `'lookout'`, `'duet'`, `'roost'`; selects the autonomous scene arc. |
| `count` | `2` | Exactly `1` or `2`; visible cast size. Ash is `0`, Ember is `1`. |
| `layout` | `'bough'` | `'bough'` connects the wide perches, `'split'` staggers them, `'close'` brings them together. A narrow host stacks the Owls. |
| `tempo` | `1` | Finite `0.5..1.5`; autonomous scene-beat speed, independent of cue and core reaction ticks. |
| `alertness` | `0.7` | Finite `0..1`; scales the attention excursion within configured head limits. |
| `sociability` | `0.65` | Finite `0..1`; companion participation and response strength. Above `0.15`, a visible companion joins deliberate cues; above `0.6`, a curious companion can follow guided attention. |
| `breeze` | `0.3` | Finite `0..1`; small periodic feather ruffles. |
| `autonomous` | `true` | Boolean; `false` holds the autonomous beat while explicit cues, core reactions and small idle changes remain available. It is not a pause control. |
| `roles` | `['sentinel', 'dreamer']` | Exactly two roles from `'sentinel'`, `'curious'`, `'dreamer'`, even in solo mode; one role for each stable actor identity. |

Sentinels scan farther and keep watch through rest; curious Owls follow movement and, at sufficient sociability, a companion's attention; dreamers scan less and carry heavier eyelids. The demo's authored preset cards set several options together and deliberately differ from runtime defaults. Changing only `scene` through the API does not silently replace roles, layout or other options.

Unknown keys, wrong types, nonfinite numbers, out-of-range options, malformed roles and inactive actor targets throw before mutation. Numeric options are not coerced. Explicit `undefined` is not an option value; omit optional fields. Attention and cue coordinates must be finite and are clamped to `[-1, 1]`, with positive `x` right and positive `y` down **within the addressed Owl's viewport**. `guide(x, y)` and omitted cue/input targets address Ash (`0`). Omitted cue coordinates are `x: -0.65` for Ash or `0.65` for Ember, and `y: -0.25`. Pointer events are different: the DOM host selects the visible Owl from the composed text, then maps the point into that Owl's local coordinates. `targetOwlActor(grid, x, y)` accepts scene-wide normalized coordinates for that selection.

### Authored arcs and explicit cues

| Scene | Phase sequence and duration in scene beats | Readable interaction |
| --- | --- | --- |
| `lookout` | `survey` 240 → `listen` 180 → `alert` 120 → `settle` 240 | Independent scanning gives way to listening, focused attention and feather settling. |
| `duet` | `call` 180 → `answer` 180 → `shared-watch` 240 → `settle` 180 | Ash offers a visual call; Ember answers; they watch opposite edges before resting. |
| `roost` | `survey` 180 → `stretch` 240 → `rest` 540 → `wake` 120 | Staggered wing movement makes room for a long doze and a gradual return to watch. |

At 60 ticks/second and `tempo: 1`, lookout and duet repeat every 13 seconds; roost repeats every 18 seconds. These are deterministic simulation durations, not measured browser throughput. `OwlDirectorPhase` exposes `kind`, `progress` and `cycle`. A deliberate cue temporarily selects the visible phase while the autonomous beat continues underneath.

`cue({ kind: 'rustle', target, x, y })` interrupts with alert → listen → settle over 300 ticks; a participating companion waits 48 ticks. `call` runs call → answer → settle over 300 ticks with a 96-tick companion delay. Calls are silent visual choreography. `stretch` schedules the existing blink → ruffle → stretch → recovery core cycle for the selected Owl, with the participating companion's turn 60 ticks later. Its director window lasts 360 ticks. Each accepted cue is followed by a 60-tick director cooldown; additional cues in that window are ignored rather than replayed later.

The configurable core reaction cycle can outlast the 360-tick director stretch window. Before accepting a stretch, the director checks the selected core's readiness and, when a companion turn is scheduled, that companion's readiness at its scheduled tick. Core behavior and director phase remain separate: a core may still be in response, recovery or cooldown after the director returns to its autonomous scene.

Browser actions return the existing discriminated `OwlActionResult`: `{ kind: 'queued' }` means input was coalesced for the upcoming tick, **not** that the director accepted the cue; `{ kind: 'poster', poster: 'react' | 'attention' }` reports a display-only still. At most one pending attention/leave and one pending cue are retained; the latest deliberate cue wins before that tick. Pure `advance` reports exact `acceptedCues` and `ignoredCues`. With direction enabled, existing `react()` and `pulse()` request a stretch from Ash. Native cue buttons and keyboard controls belong to the demo; the library does not intercept page keyboard shortcuts.

### State, updates and lifecycle

The director owns a fixed pair of seeded Owl cores, including in solo mode. Both advance; `state.actors` exposes only the visible cast. Returning to duet preserves Ember's identity, role and evolving state. Ash uses the supplied seed; Ember uses `(seed ^ 0x9e3779b9) >>> 0`. No populations, per-actor timers or unbounded queues are created.

Each `OwlDirectorActor` exposes `id`, `name`, `role`, `motive`, `simulation` and `pose`. `simulation` is the existing core's authoritative `OwlState`, including its discriminated `behavior`. `pose` adds bounded scene eyelid, feather and wing direction for rendering; it does not rewrite the core's behavior label. Use `pose` for visuals and `simulation` for reaction/recovery inspection.

| API | Meaning |
| --- | --- |
| `getDirectorSnapshot()` | Director simulation; no deliberate static poster applied. `null` for an instance created without `director`. |
| `getStatus().director` / `getSnapshot().director` | The displayed director scene, including a frozen frame or an explicit still with `poster: true`. |
| `getSnapshot().simulation` / `.displayed` | Existing primary-Ash compatibility fields. Other actors are in the director snapshot. |
| `updateDirector(patch)` | Validated director patch; clears pending browser input and a display-only poster. Changing scene restarts the beat and clears the director cue/cooldown, while keeping ticks and core state. |
| `update(patch)` | Apply existing `OwlOptionsPatch` to both cores; use `reset(seed)` to change seed. Pure-model equivalent: `updateOwl(patch)`. |
| `reset(seed?)` / `restart()` | Preserve options and motion policy; clear input, cue, cooldown and posters; rewind both cores, scene beat and sequence bookkeeping. The reset scene starts at tick zero. |
| `pause()` / `setPaused(true)` | Freeze the current scene without selecting a different pose. `play()` never overrides reduced motion or other lifecycle blockers. |
| `guide`, `cue`, `leave` while stopped | Select deliberate attention, reaction or rest stills without changing simulation tick or consuming a core reaction. For example, select `scene: 'roost'`, then call `leave()` to show the dozing still. |
| `dispose()` | Idempotently release both cores and owned browser resources; pure director methods reject later calls. Browser `getStatus()` remains available after disposal. |

`onStatus` may run during construction. Use its supplied status instead of referencing a controller that has not yet been assigned. Notifications are deduplicated by meaningful policy, configuration, phase and motive changes, not emitted for every progress/tick change. A consumer that needs an occasional exact progress snapshot can read it when its own UI needs it; the director does not require a second timer.

The demo deliberately selects an appropriate still on initial mount, scene selection and restart when motion is stopped: a guided lookout, a visual duet call or a dozing roost. This is demo choreography using the methods above. Simply pressing Pause still freezes the current frame.

Imports and the pure director are SSR-safe; mounting still requires a real owning document and sized element. The integrated browser factory borrows the existing shared per-window scheduler, at 60 fixed ticks/second with at most five catch-up steps per frame. Hidden/offscreen, zero-sized or small hosts, reduced motion, pause and disposal use the existing suspension policy. Resuming discards stopped wall time. These are bounded scheduling rules, not a claim that all devices sustain the target rate.

### Pure ticks and composition

`createOwlDirector(directorOptions, owlOptions)` has no DOM, scheduler or renderer ownership. Call `advance` with **exactly the next integer tick**: `1`, `2`, `3`, and so on. All events in a batch must name that tick and have nonnegative safe-integer `seq` values strictly increasing across the replay. A batch allows at most 16 events and is validated completely before state changes. Cue data is nested under `cue`:

```ts
import { createOwlDirector, renderOwlDirectorGrid, type OwlDirectorInput } from 'ascii-animals-review/owl';
const director = createOwlDirector({ scene: 'duet' }, { seed: 7 });
const events = [
  { tick: 1, seq: 0, type: 'attention', target: 1, x: -0.6, y: -0.2 },
  { tick: 1, seq: 1, type: 'cue', cue: { kind: 'call', target: 0 } },
] satisfies readonly OwlDirectorInput[];
const result = director.advance(1, events);
const text = renderOwlDirectorGrid(result.state, { cols: 144, rows: 60 }).text;
director.dispose();
```

`makeOwlDirectorPoster(state, poster)` returns a nonmutating deliberate still. `renderOwlDirectorGrid` composes the existing per-Owl sampler, original perch atmosphere and brief cue marks into one grid. Every visible Owl retains at least 64×36 cells. Logical cell aspect is `0.55`; the composed grid is capped at 14,400 cells.

| Cast/composition | Accepted composed grid | Automatic browser choice |
| --- | --- | --- |
| Solo | Overall 64–160 columns and 36–90 rows, subject to the existing sampler's aspect limits | 96×54 |
| Wide duet | 128–160 columns × 48–90 rows | 144×60 when host width is at least 700 px |
| Stacked duet | 64–112 columns × 80–90 rows | 80×90 below 700 px |

These director defaults apply only when no explicit grid is supplied. An explicit grid is retained and validated before a cast/layout change; a solo-sized 96×54 grid cannot be reused for a duet. `OwlDirectorGrid` adds `layout`, `actorRects` and per-cell `owners` to `OwlGrid`, supporting visible-cell hit testing; empty clearing positions choose the nearest perch. `silhouette: true` omits atmosphere and cue marks for silhouette review.

The Owl subpath exports the director factory, resolver, defaults, limits, poster maker, compositor and targeting helper, plus explicit `OwlDirectorOptions`, `OwlDirectorConfig`, `OwlDirectorInput`, `OwlDirectorCue`, `OwlDirectorState`, actor/phase/result types and grid types. This is implemented Owl API; no common package contract is implied. Demo text export contains the complete currently displayed text grid. Its configuration JSON contains the seed, resolved Owl options and director configuration; it does not capture input history, the current simulation or a recording. Reproduction of a particular motion requires the same seed, configuration, ordered events and exact integer tick sequence.

## Provenance and evidence

Imported the actual recovered Owl review ZIP's `source/species/owl` subtree, not its stale repository root. Source, numerical tests, historical handoff, manifests and rasterized GIF remain available under `species/owl`; historical results are not new integration/browser evidence.

Integration validation: original 40 Owl tests plus two factory/scheduler tests, 108 combined repository tests, strict TypeScript, real packed-package offline/SSR import, NodeNext/Bundler type consumers and esbuild fixtures. Generated `dist/owl` imports the compiled public factory, rather than an independent renderer. Browser typography, mobile layout and interactions require separate real-browser acceptance; no browser performance or font equivalence claim is made by numerical/mock tests. Nothing is published to npm by these checks.

The counts above describe the earlier integration. The director adds separate [pure-model/composition tests](../species/owl/tests/director.test.mjs), [host lifecycle tests](../species/owl/tests/director-host.test.mjs), positive/negative type fixtures and [rendered scene evidence](../species/owl/evidence/director/). Rasterized logical-grid frames and GIFs document actual model output, not native browser typography or measured performance. The director validation manifest accompanying the review artifacts distinguishes run checks from remaining browser/device and coordinator acceptance gates.
