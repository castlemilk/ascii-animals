# Fox: typed character and meadow director

## Availability and compatibility

At inspected main **`c06114404900884814bef879a02f1a49a3e7d590`**, Fox is already integrated through `createFoxArtwork` and the `ascii-animals-review/fox` subpath. This branch adds an **opt-in meadow director** and an updated Fox demo. The director additions described here are proposed source in this unmerged change; they are not a claim that the current live Pages release already contains them.

Main subsequently advanced to **`c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`** with a README-only status reconciliation. The delivery branch includes that unchanged central documentation; the Fox runtime baseline is identical to the inspected release.

The package remains private and unpublished. Examples refer to the locally built package or tarball, not an npm-registry release. Existing `createFoxArtwork` remains available from the root and `./fox`. **New director helpers and explicit director types are exported through `./fox` only**; this change adds no root exports, shared registry, or generic species contract.

Omit `director` to keep the original single-character behavior, its `FoxState` schema, closed behavior/static-pose unions, and fixed-tick timing contract. Supplying `director: {}` enables the default meadow. A mounted controller cannot switch between those two modes; dispose and create a new mount when changing mode.

## Create a meadow

Mount after the canvas has a browser document and a nonzero CSS size. Imports themselves are SSR-safe.

```ts
import {
  createFoxArtwork,
  type FoxDirectorInput,
} from 'ascii-animals-review/fox';

const listeners = new AbortController();
let latestInputs: readonly FoxDirectorInput[] = []; // Bounded inspection example.
const meadow = createFoxArtwork(canvas, {
  fox: { seed: 17, pounceHeight: .24 },
  director: {
    scene: 'dusk-hunt',
    count: 2,
    roles: ['hunter', 'lookout'],
    pace: 1,
    curiosity: .7,
  },
  grid: { cols: 160, rows: 64, monochrome: false },
  onDirectorInputs(batch) { latestInputs = batch; },
});

// Native controls remain usable by mouse, touch and keyboard.
// Actions are processed when the mount is visible and has a nonzero size.
rustleButton.addEventListener('click', () => meadow.cue('rustle'), {
  signal: listeners.signal,
});
restButton.addEventListener('click', () => meadow.showTableau('rest'), {
  signal: listeners.signal,
});

function unmount() {
  listeners.abort();
  meadow.dispose();
}
```

The example retains only the most recent batch. For a full replay, stream batches to application-owned storage and also record configuration, selection and reset operations as described below. The library does not retain an unbounded event log.

## Authored scenes and cast

| Scene value | Visible composition and arc | Automatic motives for IDs 0, 1, 2 |
|---|---|---|
| `dusk-hunt` | Attentive ears and muzzle, listening pauses, cautious investigation, a captured crouch/leap/forepaw landing, then settling | Hunter, lookout, playmate |
| `moon-play` | Play bows, curved paths, raised expressive tails, staggered short hops, then rest | Playmate, playmate, lookout |
| `den-watch` | Folded resting silhouettes and quiet tail poses, with a sentinel listening nearby | Dreamer, lookout, dreamer |

Stable IDs are **0 Ember**, **1 Pip**, and **2 Bracken**. Each actor has its own seeded phases and original Fox model. Count changes preserve surviving actors' identities and model clocks; newly added actors start their own model clock at zero. The director has a separate global tick. The composed view uses depth lanes and switches to stacked lanes on a narrow grid.

Each scene has an authored `arrival → listening → investigation → response → settling` cycle. `pace` advances that scene clock by 0.5–1.5 authored ticks per simulation tick; the cycle is 1,800 authored ticks. It does not retime a captured leap, change the 60 Hz simulation tick domain, or accelerate a deliberate cue's attention/cooldown durations. Roles and seeded idle episodes keep the cast from moving in lockstep. These are stylized behaviors, not biological gait claims.

### Full director configuration

These properties belong inside the browser's `director` object or directly in `createFoxDirector`. `configureDirector`/headless `configure` accept partial patches.

| Option | Default | Accepted values | Effect |
|---|---:|---|---|
| `scene` | `dusk-hunt` | `dusk-hunt`, `moon-play`, `den-watch` | Selects the authored arc and automatic role assignment |
| `count` | 2 | Literal integer `1`, `2`, or `3` | Bounded cast size |
| `pace` | 1 | Finite 0.5–1.5 | Scene-clock tempo; animal ticks remain fixed |
| `curiosity` | 0.7 | Finite 0–1 | Pointer attention and head interest; zero disables autonomous pointer pursuit |
| `wind` | 0.3 | Finite −1–1 | Direction and amplitude of bounded meadow-grass sway |
| `spacing` | 1 | Finite 0.8–1.15 | Spreads scene anchors |
| `showLabels` | `true` | Boolean | Names and selection marker in the rendered scene |
| `roles` | `['auto','auto','auto']` | Up to three entries: `auto`, `hunter`, `playmate`, `lookout`, `dreamer` | Overrides motives by stable actor ID |

A roles array may retain entries for temporarily absent actors, so decreasing the cast does not discard those assignments. Missing entries behave as `auto`. Unknown keys, sparse/invalid role arrays, explicit `undefined` values in director option patches, nonfinite values and out-of-range numbers throw before mutation. Returned options and role arrays are frozen copies. `resolveFoxDirectorOptions(patch?, base?)` exposes the same validation and validates a supplied base too.

Animal anatomy and pounce settings remain in `fox`. Their complete defaults/ranges are in [the species reference](../species/fox/README.md#animal-configuration). Browser seed and initial pause are `fox.seed` and `fox.paused`; the default seed is 17. Headless `createFoxDirector` also accepts a top-level uint32 `seed`, which takes precedence over `fox.seed`.

## Contextual interaction

| Input/action | Running meadow | Paused or reduced-motion meadow |
|---|---|---|
| Pointer movement / `guide(x,y)` | The selected fox notices; holding a guide permits a cautious approach when its motive allows it | Pointer movement cannot animate. Deliberate `guide` chooses the listening tableau |
| Click/tap on the scene | A localized rustle is routed through the composed scene to an individual | Chooses an attentive still composition without advancing time |
| `cue('rustle', id?, point?)` | Listen, investigate/sniff, then make a short pounce and recover | `listen` tableau |
| `cue('play', id?, point?)` | Playful investigation/bow and hop; companions notice and may answer after a bounded delay | `pounce` tableau |
| `cue('pounce', id?)` / `pounce()` / `pulse()` | Starts the selected fox's captured crouch/leap/landing response | `pounce` tableau |
| `cue('rest', id?)` | Temporarily rests the chosen fox while the others continue their motives | `rest` tableau |
| `leave()` | Clears queued transient guide/cue and schedules a recorded leave input | Clears transient input without resuming playback |

A cue without an ID or point uses current selection. A located cue without an ID chooses the nearest actor; an explicit valid ID takes precedence. Coordinates are finite normalized values and clamp to `[-1,1]`. In headless events, cue `x` and `y` must be supplied together. IDs must refer to a currently present actor. Repeated cues while that actor is already investigating or in a captured response are ignored rather than retained in a queue.

The still tableau named **`pounce` is the pre-leap crouch**, not a frozen airborne pose. `listen`, `pounce`, and `rest` are separate from the original `FoxStaticPose` vocabulary. A still scene does not simulate elapsed time.

## Controller semantics

| Method | Contract |
|---|---|
| `configureDirector(patch)` | Atomic director validation. Non-scene changes retain global/actor clocks and surviving identities. A changed scene restarts only its authored clock/beat and clears scene interest; it retains global tick, seed, animal settings, and pause. Browser pending transient inputs are discarded. |
| `getDirectorOptions()` / `getDirectorState()` | Frozen options/state when enabled; `null` on an ordinary single-Fox mount. Director state includes actors, motives, beat, intent, selected ID and individual model state. |
| `selectFox(id)` | Immediate selection with no simulation tick or input-sequence advance. Clears a pending cue. Record the selection separately for replay. |
| `configure(patch)` / `update(patch)` | Update animal settings, not scene settings. In director mode apply the validated patch to all animals. An unrelated patch preserves actor-specific facing. Captured responses finish with their captured settings. `configure` returns normalized shared settings; `update` returns `void`. |
| `getState()` / `getOptions()` | Preserve the original API shape: primary actor 0's `FoxState`, and shared animal settings. Use director inspection for the full cast or each actor's current facing/options. |
| `setPaused(boolean)` / `pause()` / `play()` | User pause is independent of reduced motion. `play()` cannot override the OS preference or visibility policy. |
| `reset(seed?)` / `restart()` | Reset global and actor clocks, scene progress, selected ID, intent and transient inputs. Retain director options, animal settings and user pause. Omitted seed repeats the current seed; `restart()` aliases omitted-seed reset. |
| `showTableau(value)` | Deliberately pauses and draws `listen`, pre-leap `pounce`, or `rest`. |
| `showStaticPose(value)` | Original API remains supported. In director mode `idle`, `sniff`, `crouch` map to `rest`, `listen`, `pounce`. |
| `exportText()` | Returns the actual rectangular printable ASCII grid currently represented, including a deliberate tableau. No HTML is generated. |
| `getStatus()` | Lifecycle policy, counters, current director state/tableau, backing/grid dimensions and dropped wall time. Readable after disposal. |
| `dispose()` | Idempotent; releases only this mount's resources/subscription. Other operations reject afterward, except `getStatus()` and `disposed`. |

Director mutation methods (`configureDirector`, `cue`, `selectFox`, `showTableau`) reject when the mount was created without `director`. They do not silently enable it. Selecting/changing scene does not clear user pause. Scene-directed locomotion may later turn a fox within its supported left/right profiles; it never promises arbitrary yaw or a frontal pose.

## Headless deterministic director and replay

```ts
import {
  createFoxDirector,
  type FoxDirectorInput,
} from 'ascii-animals-review/fox';

const director = createFoxDirector({ seed: 17, count: 2, scene: 'dusk-hunt' });
const batch = [
  { type: 'select', tick: 1, seq: 0, id: 1 },
  { type: 'cue', tick: 1, seq: 1, cue: 'rustle', id: 1, x: .45, y: .35 },
] as const satisfies readonly FoxDirectorInput[];

const result = director.step(1, batch);
for (let tick = 2; tick <= 420; tick++) director.step(tick);
const frame = director.getFrame();       // Detached original geometry per actor.
const still = director.getFrame('rest'); // Pure snapshot; no tick/state mutation.
director.dispose();
```

`step` requires exactly the next safe integer tick, with at most 16 input events whose sequence numbers strictly increase. The whole batch validates before any actor advances. Paused steps validate but consume no tick/input. The result reports `advanced`/`paused`, state, accepted event count and a cue outcome; an ignored-busy cue is still a consumed, sequenced input. There is no seconds-based `advance`, arbitrary seek, or serialized-state restore contract.

The headless director provides `getOptions`, `getFoxOptions`, `getState`, `getFrame`, `configure`, `configureFox`, `select`, `step`, `setPaused`, `isPaused`, `reset`, and `dispose`. `select(id)` is an immediate metadata operation; use a tick-stamped `select` event when it belongs inside the input replay. All headless operations except repeated `dispose` throw after disposal.

In browser director mode, `onDirectorInputs` receives frozen consumed normalized batches, including policy-generated leave events. The legacy `onInputs` callback is for the single-Fox mode. **Input batches alone do not record immediate selection, configuration, pause or reset operations.** Record those edits in an application-owned timeline, or keep configuration constant and use tick-stamped selection for a fixed replay. An exact same-version seed/options/event/edit sequence yields reproducible state/cells; font pixels across platforms and independently recorded pointer sessions are not promised identical.

## Rendering, accessibility and lifecycle

Director grids accept **integer columns 112–160 and rows 48–64**. Default is **160×64**, or **112×64** below 640 CSS pixels if columns were not explicitly supplied. `monochrome` defaults false. The original single-Fox defaults/ranges remain unchanged. Grid settings are mount-time options, not director or animal update properties.

The scene compositor reuses the existing Fox polygon rasterizer separately for each actor. Per-pose limits remain 48 polygons and 1,024 vertices; three actors bound the total at 144 polygons/3,072 vertices. The scene grid is at most 10,240 cells. `maxAccents: 48` bounds **grass stems**, not total background glyphs: the scene also has up to 16 stem tips, a fixed horizon/moon/star composition, and bounded contact/cue marks. There are no unbounded particles, trails, actor lists or event logs. Physical cells retain their 1:2 width/height ratio with letterboxing. Narrow scenes stack depth lanes to preserve readable anatomy.

The browser backing remains capped at 1280×768 logical pixels and DPR≤2. One mounted meadow borrows one shared scheduler subscription, not one loop per actor. Hidden, offscreen, zero-size, paused and reduced-motion conditions compose; resumption resets accumulated wall time. At most five fixed ticks run per callback, and dropped wall time is reported. Canvas/observer setup failures and throwing consumer callbacks roll back owned resources. Importing modules makes no DOM reads.

Use native controls for scene, cast, motives, pause and deliberate stills. The included demo adds canvas-focused arrow guidance, Enter rustle, P pounce, Space pause, and Escape clear-guide, with equivalent labeled buttons. It does not intercept these keys elsewhere on the page. Continuous telemetry is not a live region; user actions receive concise status text. Reduced motion keeps automatic motion off; `showTableau('listen')`, `showTableau('pounce')`, and `showTableau('rest')` provide deliberate alternatives without animation. A Canvas-unavailable demo exposes a static text specimen and description.

## Source, reproduction and evidence

Canonical source is `species/fox/src/`; declaration bridges are under `src/species/fox/`. The Fox-specific public adapter is `src/public/fox.ts`. `scripts/build-fox.mjs` compiles modules and generates the integrated demo at `dist/fox/`; generated files should not be edited independently.

```sh
npm ci --ignore-scripts
npm run build
npm run typecheck
node --test test/fox-integration.test.mjs test/fox-director-integration.test.mjs species/fox/tests/*.test.mjs
```

Serve `dist/` locally and open `/fox/` to inspect this branch's integrated demo. The canonical study demo also remains under `species/fox/demo/`. The [authoring record](../species/fox/DIRECTOR-AUTHORING.md) records the inspected main, scope, scenes, budgets and evidence plan. [Director model tests](../species/fox/tests/director.test.mjs) and [consumer type fixtures](../species/fox/tests/types/director.ts) exercise the new contract.

Source documentation does not establish a final acceptance pass. Distinguish actual browser interaction, native Canvas captures, explicit mocks, compiler tests and numerical tests in the accompanying review/validation artifacts. The original `VALIDATION.md` and original native GIF describe the earlier single-Fox implementation, not acceptance of this director. Deployment, package publication, real-device performance, physical touch and assistive-technology acceptance require their own recorded evidence.
