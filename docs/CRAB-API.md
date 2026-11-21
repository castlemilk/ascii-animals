# Crab API — tidepool theatre

**Current source contract:** checked against [`main` at `f63b20e2045b`](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/src/public/crab.ts) on 21 November 2026. The API below is present in that source. Use the [local-package setup](GETTING-STARTED.md); [current validation](VALIDATION-2026-11-21.md) separates the built package, live Pages and npm availability. Older authoring bases and capture results below are historical evidence, not additional release claims.

The tidal-flat revision starts from verified `main` commit
`b8f222dab868821f27bf2a64a98434f3483fc8e6` and preserves the existing crab
public types and director API. The package remains the private, unpublished
`ascii-animals-review` review candidate. Use a local build or tarball for these
examples, not an assumed npm release.

The canonical implementation is [`src/public/crab.ts`](../src/public/crab.ts).
The default remains the single-crab **`study`**. The demo starts with one resident
on the tidal flat; its resident control still supports all five. It selects an
80×32 grid on narrow canvases, 112×45 at intermediate widths, and 140×56 on wide
canvases. Names start hidden to leave the silhouette clear.
See the [tidal-flat authoring record](../species/crab/TIDAL-FLAT-AUTHORING.md)
and [review manifest](../species/crab/evidence/tidal-flat/review-manifest.json).

The new anatomy uses a continuous grooved shield, an underside rim, modestly
unequal palms, hooked movable fingers and four jointed walking legs on each side.
Theatre feet stay fixed in world space through stance and finish their airborne
step even when the body stops. Rock ledges keep fixed world geometry; body height
and crouch determine whether a crab appears in front of or behind the lip.

## Typed entry points

```ts
import {
  createCrabArtwork, createCrabModel, normalizeCrabOptions, CRAB_DEFAULTS,
  type CrabOptions, type CrabSceneState,
} from 'ascii-animals-review/crab';

// Existing single-crab usage remains valid.
const study = createCrabModel({ behavior: 'curious', seed: 7 });
study.guide(-1, 0);
study.greet();
study.advanceTicks(45);
console.log(study.getPhase()); // 'defend'

const options = {
  scene: 'forage', count: 3, formation: 'arc', labels: true,
  director: 'auto', actDuration: 240, tide: 0.2, current: 0.25,
  cast: [
    { role: 'curious', label: 'Pip', size: 1 },
    { role: 'shy', label: 'Moss', size: 0.9 },
    { role: 'territorial', label: 'Brine', size: 1.06 },
  ],
} as const satisfies CrabOptions;

// Mount after the caller-owned canvas exists in a browser document.
const theatre = createCrabArtwork(canvas, options);
theatre.select(2); // Resident IDs are zero-based.
theatre.cue('signal');
theatre.update({ director: 'manual' });
theatre.setBeat('forage'); // Internal action proceeds; chapter is held.
const unsubscribe = theatre.subscribe(status => {
  console.log(status.scene, status.beat, status.paused);
});
const snapshot: CrabSceneState = theatre.getScene();

// On unmount:
unsubscribe();
theatre.dispose();
```

The four runtime entry points are also available from the package root. Both
entry points expose the crab declarations. No shared registration contract,
marine renderer, core scheduler or package export was replaced for this director.

## Options, defaults and validation

`normalizeCrabOptions()` resolves against `CRAB_DEFAULTS`. Model `configure()`
and artwork `update()` validate the complete candidate before mutation. Omitted
or `undefined` fields retain their previous values. Cast input is copied;
returned configuration, cast arrays and cast entries are frozen.

| Option | Default | Accepted value / meaning |
|---|---|---|
| `columns` | `120` | Integer 80–180 logical cells |
| `rows` | `50` | Integer 32–90 logical cells |
| `seed` | `7` | Integer 0–2,147,483,647; deterministic resident offsets and sand |
| `speed` | `1` | Finite 0.25–2; study motion or theatre footwork, not chapter/cue duration |
| `scale` | `1` | Finite 0.6–1.3; subject to theatre legibility and height fitting |
| `sway` | `0.18` | Finite 0–0.4; study scuttle and small theatre inspection offset |
| `facing` | `'left'` | `'left'` or `'right'`; mirrored anatomy, not current direction |
| `behavior` | `'scuttle'` | `'scuttle'`, `'curious'`, `'guard'`; legacy study behavior |
| `palette` | `'brass'` | `'brass'`, `'lagoon'`, `'rose'`; brass also distinguishes roles by color |
| `paused` | `false` | Boolean browser playback request |
| `reducedMotion` | `'system'` | `'system'` or explicit `'ignore'` |
| `scene` | `'study'` | `'study'`, `'forage'`, `'signals'`, `'tide'` |
| `count` | `1` | Integer 1–5; theatre ensemble cardinality |
| `formation` | `'arc'` | `'arc'`, `'terraces'`, `'shoreline'`; count-aware home/patch layouts |
| `cast` | `[]` | At most five readonly `{ role?, label?, size? }` entries, assigned by ID |
| `director` | `'auto'` | `'auto'` advances chapters; `'manual'` holds chapter transitions |
| `actDuration` | `240` | Integer 120–720 ticks: 2–12 seconds at logical 60 Hz |
| `tide` | `0.35` | Finite 0–1; water reach, combined with the authored tide-scene wash |
| `current` | `0.35` | Finite −1–1; negative left, positive right, zero still; water and retreat bias |
| `labels` | `false` | Boolean resident names/selection markers in theatre frames |

A cast entry accepts `role: 'shy' | 'curious' | 'territorial'`, a `label` of
1–12 printable ASCII characters containing at least one non-space character,
and finite `size` from 0.8 to 1.2. Missing entries/fields use these defaults:

| ID | Label | Role | Size |
|---|---|---|---|
| 0 | Pip | curious | 1 |
| 1 | Moss | shy | 0.9 |
| 2 | Brine | territorial | 1.06 |
| 3 | Dot | curious | 1 |
| 4 | Flint | territorial | 1 |

Entries beyond `count` are retained for later count increases; `cast` does not
implicitly change `count`. Unknown option/entry keys, invalid discriminants,
labels or non-object options reject with `TypeError`. Invalid numeric ranges,
fractional integer fields, non-array/oversized cast values and resident sizes
reject with `RangeError`; invalid cast members reject with `TypeError`.
Nonfinite numeric values are never accepted. Invalid IDs and beats outside the
current scene reject with `RangeError`; unknown cue names reject with `TypeError`.

**Size fitting:** theatre keeps approximately 20 columns of complete crab
silhouette, including legs, even in dense 80-column compositions. The requested
count/scale/individual-size radius is clamped above this legibility floor and
below a grid-aspect height limit. Reducing `scale` or `size` below the floor may
therefore produce no further visible shrinkage. Fitting applies only to theatre
scenes; it is not a promise of identical pixels or continuous size response at
every density. At four/five residents, `arc` and `shoreline` share a two-row
arrangement to keep the cast in view; terraces remains staggered.

## Scenes and individual motives

| Scene | Ordered chapters | Direction |
|---|---|---|
| `study` | Legacy study; director metadata uses `arrive` | One crab with original scuttle/curiosity/guard and notice/defend/settle response |
| `forage` | `arrive → forage → signal → return` | Emerge, sift individual patches, call across the pool, return to familiar rocks |
| `signals` | `arrive → signal → challenge → return` | Staggered calls, territorial display, curiosity/shy withdrawal, then dispersal |
| `tide` | `forage → retreat → shelter → return` | Brace, seek cover, hide/peek, then staggered return as water recedes |

Residents have individual homes, patches, identities, gaits, claw poses and idle
offsets. Shy residents wait longer, seek cover near visitors and signal more
quietly. Curious residents investigate nearby guidance and are preferred for
sand lures. Territorial residents hold their patch and raise a claw. Grooming,
inspection, sifting and rest occur without a click. These are stylized authored
behaviors, not biological or fluid simulation.

`director:'manual'` lets the selected chapter progress internally to its final
tick, then holds it there. Animation continues: idle motives and repeated claw
gestures remain live. `nextBeat()` advances and wraps after the last chapter.
`setBeat()` selects a chapter belonging to the current scene. Either clears
active cues and pending replies. Auto mode repeats the full arc and increments
`cycle`.

## Model and behavior API

`createCrabModel()` imports and runs without a DOM, browser globals, wall clock,
fonts or timers. The pure model does not interpret `paused` as prohibiting an
explicit `advanceTicks()` call; the browser controller owns playback policy.

| Method | Contract |
|---|---|
| `getOptions()` | Frozen resolved configuration |
| `getState()` | Legacy `{ tick, responseTick, targetX, targetY }` snapshot |
| `getPhase()` | Unchanged `idle` / `notice` / `defend` / `settle` phase |
| `getScene()` | Frozen director, guide and resident snapshots |
| `configure(patch)` | Validated atomic option merge |
| `advanceTicks(n)` | Integer 0–600 ticks; zero is a no-op |
| `guide(x,y)` / `clearGuide()` | Finite coordinates clamped to −1–1; clear releases proximity input |
| `select(id)` | Existing zero-based resident ID |
| `cue(action,id?,poster?)` | `'forage'`, `'signal'`, `'shelter'`; omitted ID means selected resident |
| `setBeat(beat,poster?)` / `nextBeat(poster?)` | Select or advance an authored chapter |
| `greet(poster?)` | Legacy reaction; in theatre also requests the selected resident's signal |
| `reset()` | Tick-zero reset of inputs, reaction, director, selection and residents; preserve options |
| `frame()` | Frozen logical cells, printable ASCII text, dimensions and legacy phase |

`CrabSceneState` includes `scene`, `beats`, `beat`, `beatIndex`, `progress`,
`cycle`, `tideLevel`, `current`, `selectedId`, `guide` and `actors`.
`CrabResidentState` exposes identity, role, size, position, `home`, `patch`,
claws, gaze, crouch and eight feet with world coordinates, `planted` and `lift`.
Its `behavior` is a discriminated `CrabBehaviorState` union with normalized
`progress` and these `kind` values:

```ts
type CrabActivity =
  | 'rest' | 'scuttle' | 'forage' | 'signal' | 'retreat'
  | 'shelter' | 'return' | 'inspect' | 'groom' | 'brace';
```

Read actor behavior for theatre activity. `getPhase()` deliberately remains the
legacy greet response rather than an aggregate of residents. Its timing remains
notice at ticks 0–44, defend at 45–109, settle at 110–179, then idle. An active
greet does not restart on repeated calls. The legacy poster uses response age 70.

### Cue priority, bounds and recovery

Each resident has at most **one active explicit cue** and **one pending delayed
reply**, with no growing queue. A cue occupies 300 logical ticks. Another ordinary
cue during that resident's active cue is ignored. A signal schedules staggered
replies for eligible idle neighbours; replies do not recursively queue replies.

Explicit cues override that resident's chapter and proximity plan. Otherwise
nearby guidance can adjust the authored plan, except during bracing, retreat or
shelter. Clearing guidance does not cancel an accepted cue. Forage approaches a
bounded lure, works the claw and returns toward the scene's intended position.
Forage holds a short anticipation before its sideways approach. Shelter braces
for 18 ticks, retreats through tick 90, hides to tick 150, checks outside to tick
195, then returns. A signal prepares a low pose, raises its lead claw before the
second claw, holds the open display and lowers both with separate timing.
Completion restores current scene motives. These durations are authored, not
biological measurements.

The model's optional `poster` flag composes an informative still: cues use their
120-tick pose, chapters their midpoint. It may replace an active cue. The browser
automatically selects a poster while playback is blocked, without advancing the
model tick or starting playback.

### Configuration and reset

Palette, labels and no-op updates preserve movement and planted feet. Grid,
global size, count and individual size changes deliberately reseat feet.
Formation updates change destination anchors. Scene changes restart the chapter
and cue state and release active proximity guidance; seed changes rebuild
director residents. Neither implicitly resets the legacy model tick counter.
`actDuration` updates preserve relative chapter position. Reducing count clamps
selection to a surviving ID. Use model `reset()` or browser `restart()` for a
complete tick-zero replay; restart preserves the requested pause preference.

## Browser controller and input

The artwork retains
`getOptions/getStatus/getFrame/update/play/pause/restart/pulse/guide/resize/dispose`
and adds `getScene/select/cue/setBeat/nextBeat/clearGuide/subscribe`.
`CrabBrowserOptions` optionally accepts a caller-owned
`frameSource: { subscribe(callback): () => void }` with millisecond timestamps.
Neither that source nor the shared scheduler is disposed by the crab.

The controller borrows one shared per-window scheduler subscription. It advances
60 Hz fixed ticks, caps catch-up at 0.1 seconds/six ticks per callback, and reports
discarded time as `droppedSeconds`. Resume starts a fresh timestamp without hidden
time catch-up. Invalid timestamps do not advance. Pause, system reduced motion,
document hiding, offscreen intersection and zero-sized canvas remove the
subscription. `play()` does not override `reducedMotion:'system'`.

`getOptions().paused` is the explicit pause request; `getStatus().paused` includes
environmental suspension. Disposal is idempotent, removes owned listeners and
observers, clears subscribers and leaves the canvas caller-owned. Mutation
methods become no-ops afterward. Mount failures roll back installed resources.

`subscribe(listener)` immediately supplies frozen `CrabStatus` and returns an
idempotent remover. Playback notifies at most once per 12 logical ticks; direct
actions notify immediately. Identical callbacks have independent subscriptions.
A failed initial callback is removed. The demo uses this stream, not a second
animation loop or polling timer.

Coordinates run from `(-1,-1)` at canvas top-left to `(1,1)` at bottom-right.
Pointerdown resolves visible ownership before changing guidance: a crab glyph
selects its resident and requests a role-specific cue. Rocks, labels and covered
anatomy are not invisible creature hitboxes. A visible rock tap instead selects
the nearest shelter's resident and requests its shelter cue. Sand taps choose the nearest curious
resident, or nearest resident when none is curious. Touch/pen release, cancel,
leave and lost capture clear guidance. Nonprimary pointer events are ignored.

With canvas focus, arrows move the guide, `1`–`5` select, `F` forages, `S` signals,
`H` shelters, `N` advances chapter, Space toggles requested pause, and Escape
clears guidance. Control/Meta/Alt shortcuts are left alone. Embedders supply the
focusable canvas, accessible description and equivalent controls; the demo does.

## Rendering, budgets and accessibility

All actors, shelters, sand, waves and labels share one ASCII grid. `CrabCell`
adds optional `owner` and `layer` metadata; old consumers still read `glyph` and
`tone`. Frames and cells are immutable. Equal seeds and ordered ticks/input
events produce equal logical cells; device pixels depend on font/rasterization.

Budgets are five residents, eight feet each, 180×90 cells, one cue/one reply per
resident, and 18 current marks plus grid-bounded scenery. CSS dimensions cap at
2048 per axis and DPR at 2, giving at most 4096 backing pixels per axis.
Zero-sized canvases allocate zero backing dimensions. These are implementation
bounds, not measured FPS or memory guarantees.

System monospace fonts are used; no font, texture, image or tracking asset is
bundled. The optional native evidence harness uses installed DejaVu Sans Mono,
not a product font dependency.

The demo provides labelled controls, per-resident roles, a described focusable
canvas, skip link, visible focus styles, at least 44 CSS-pixel control heights,
responsive CSS and `touch-action:pan-y`. User actions receive polite
announcements; changing per-frame state is not a live region. Paused and reduced
motion chapter/cue controls compose distinct stills. ASCII `.txt` and PNG
snapshots retain at most one object URL until replacement/disposal. There is no
recorder in this revision. These provisions still require real browser and
assistive-technology acceptance.

## Validation and remaining gates

The 42 crab checks cover the existing model/lifecycle/director contracts plus
anticipation, held display, shelter visibility, toe continuity at three speeds,
rock input, replay batches, current direction and fitted shelter reachability.
The strict consumer fixture covers existing usage and positive/negative types.
The public crab declaration file is byte-identical to the pinned baseline.
Run species checks on a fresh build:

```sh
npm run build
node --test test/crab.test.mjs test/crab-director.test.mjs test/crab-tidal-flat.test.mjs
node node_modules/typescript/bin/tsc -p species/crab/tests/tsconfig.json
```

The revision has **not** received DOM/browser acceptance. Local Chromium could
not create a socket; the cloud browser could not reach localhost and policy
blocked further observation. No bypass or Work conversion was attempted.

Actual adapter Canvas2D output was rendered through `@napi-rs/canvas` 0.1.100 with
a mocked lifecycle and installed DejaVu Sans Mono. The capture has 64 matched
fixtures at desktop (980×700, 140×56 cells) and phone canvas size (390×280, 80×32),
plus 18 seconds of ordered actions sampled every six ticks. That 10 Hz sampling
is an evidence export rate, not measured device performance. Full-size originals,
ASCII frames, comparison sheets and MP4/GIF motion are in the review bundle.

The compact manifest records final commands, results, exact hashes and remaining
gates. Browser CSS, actual pointer/touch/keyboard delivery, screen readers,
downloads and device performance remain unverified. Generated `dist` files are
excluded from this crab-only patch; central integration runs `npm run build`.
