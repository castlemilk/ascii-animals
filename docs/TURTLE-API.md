# Sea turtle API and reef director

This is the turtle-local implementation in the private, unpublished `ascii-animals-review`
package. Its integrated source is `src/public/turtle.ts`, not `src/species/turtle`.
It borrows the existing scheduler and does not depend on the canonical marine renderer.

## Start with an authored passage

```ts
import { createTurtleArtwork } from 'ascii-animals-review/turtle';

const art = createTurtleArtwork(canvas, {
  scene: 'reef-passage',
  count: 3,
  columns: 160,
  rows: 64,
  showLabels: true,
  current: -0.35,
  individuals: [
    { id: 0, label: 'Neri', role: 'navigator' },
    { id: 1, label: 'Moss', role: 'forager', interest: 0.9 },
    { id: 2, label: 'Luma', role: 'drifter', size: 0.8 },
  ],
});

art.stage('arrival'); // Deliberately compose a visible moment in the arrival.
art.select(1);
art.inspect(0.15, 0.35); // Invite only the selected traveler toward this point.
art.update({ current: -0.65, route: 'channel' });
const unsubscribe = art.subscribe(status => {
  // Semantic changes, not a second animation loop.
  console.log(status.act, status.phase, status.selectedId);
});

art.pause();
art.stage('linger'); // A complete still tableau; never resumes playback.
art.update({ depth: 0.8 }); // Still composition updates immediately.
unsubscribe();
art.dispose();
```

Importing either the root package or turtle subpath is SSR-safe. Mount requires an
`HTMLCanvasElement` in a browser document. Do not substitute the Owl DOM-text host
or another animal's elapsed-time contract. No new root runtime export is required:
the existing four turtle values remain `createTurtleArtwork`, `createTurtleModel`,
`normalizeTurtleOptions`, and `TURTLE_DEFAULTS`.

## Compatibility

Calling `createTurtleModel()` or `createTurtleArtwork(canvas)` still selects the
original **single, centered study**. Existing option names, methods, tick bounds,
and the `idle → inspect → streamline → settle` response remain available.
`getState()` keeps exactly `{ tick, responseTick, targetX, targetY }`.
Director state is returned separately by `getDirectorState()`.

The demo opts into the ensemble explicitly. `direct('study')` returns to the
original composition. Director-only controls are disabled there; `count`, routes,
individual overrides, labels, and scene timing affect authored scenes. `scale`,
`behavior`, `facing`, `palette`, `guide`, and `pulse` retain their study behavior.

Frames keep `columns`, `rows`, `cells`, `text`, and the legacy `phase`. Produced
cells additionally include `ownerId: number | null` for visible-glyph targeting.
The property is optional in `TurtleCell` so existing structurally constructed cells
remain valid. Empty water, scenery, labels, and guide marks have no animal owner.

## Three authored scenes

| Scene | Intent and individual motives | `direct()` preset |
| --- | --- | --- |
| `reef-passage` | A loose procession enters at staggered times; navigator keeps the passage, forager occasionally inspects, drifter takes longer glides. Departure carries them out in order. | 3 turtles; shelf; depth .5; current -.35; 8 / 18 / 10 seconds |
| `seagrass-stop` | A closer forager tilts toward the meadow and alternates inspection with strokes; companions occupy different lanes and depths. The group banks away after a longer stay. | 3 turtles; channel; depth .35; current -.15; 9 / 24 / 11 seconds |
| `blue-drift` | Spacious open water with longer coasts, a quiet drifter and a higher lookout. Use count 1 for solitary exploration. | 2 turtles; arc; depth .75; current .30; 12 / 26 / 12 seconds |

These are authored, stylized encounters, not claims that sea turtles travel in
coordinated schools or that the current is a fluid simulation.

`direct(scene)` applies the listed preset plus `behavior: 'glide'`, resets the
scene clock, clears reactions/guide, and preserves seed, grid, palette, overall
scale, individual overrides, direction, choreography mode, and user pause.
`update({ scene })` switches only the scene and retains the caller's other options.
The constructor uses exactly the supplied options plus defaults; it does not
silently apply `direct()` presets.

`stage(act)` selects a representative tableau at 73% of arrival, 45% of linger,
or 44% of departure. It clears reactions and repositions deterministically without
advancing the integer simulation tick. Running scenes then continue from that
point. This is an explicit editorial cut, distinct from continuous normal playback.

## Options, defaults, and validation

All numeric options require finite numbers. Integers are required where marked.
Unknown keys, invalid enums, malformed nested overrides, holes, and duplicates
reject **before configuration or scene state changes**. `undefined` values in an
otherwise valid option patch are ignored. Options and nested snapshots are frozen;
caller-owned override arrays are copied.

| Option | Default | Accepted values / meaning |
| --- | --- | --- |
| `columns` | 120 | Integer 80–180 |
| `rows` | 50 | Integer 32–90 |
| `seed` | 7 | Integer 0–2,147,483,647; deterministic identities/cadence |
| `speed` | 1 | .25–2; director and local-motion pace |
| `scale` | 1 | .6–1.3; overall geometry scale |
| `sway` | .18 | 0–.4; bounded idle path variation |
| `facing` | `left` | `left`, `right`; passage direction |
| `behavior` | `glide` | `glide`, `curious`, `rest`; curious gives guide interest a wider reach, rest quiets flippers |
| `palette` | `brass` | `brass`, `lagoon`, `rose` |
| `paused` | false | Requested user pause; other blocking causes remain independent |
| `reducedMotion` | `system` | `system`, `ignore`; demo always uses the system policy |
| `scene` | `study` | `study`, `reef-passage`, `seagrass-stop`, `blue-drift` |
| `count` | 1 | Integer 1–5 in directed scenes |
| `route` | `shelf` | `shelf`, `channel`, `arc`; lane shape/composition |
| `spacing` | 1 | .6–1.6; lane separation, bounded at outer stage margins |
| `depth` | .5 | 0–1; overall water depth, keeping per-member depth differences |
| `current` | -.25 | -1–1; west to east. Shared signed drift, scenery flow, and stroke effort/duty change with assistance relative to travel direction |
| `director` | `loop` | `loop`, `once`, `hold` |
| `arrivalSeconds` | 8 | 4–20 scene seconds |
| `lingerSeconds` | 18 | 6–45 scene seconds |
| `departureSeconds` | 10 | 4–20 scene seconds |
| `showLabels` | false | Supplementary ASCII names; the demo's readable roster remains available |
| `showRoute` | false | Sampled route guide; optional composition aid |
| `individuals` | `[]` | At most 5 overrides, each with unique integer `id` 0–4 |

An individual override accepts `label` (1–18 plain ASCII characters, starting with
a letter or digit), `role`, `size` (.7–1.25), and `interest` (0–1). Allowed label
characters after the first are letters, digits, spaces, `.`, `_`, and `-`.
Unspecified fields use stable ID defaults or the scene's role defaults.

The roles are `navigator`, `forager`, `drifter`, `lookout`, and `explorer`.
They change cadence, glide duty, vertical/path variation, inspection, and interest;
they are not merely labels. The five default names are Neri, Moss, Luma, Aster, and
Sol. Count changes retain surviving IDs and saved overrides; removed members lose
active reactions before returning. Selection clamps to a remaining member.

## Model and behavior API

```ts
import { createTurtleModel } from 'ascii-animals-review/turtle';

const model = createTurtleModel({ scene: 'blue-drift', count: 1, seed: 19 });
model.stage('linger');
model.advanceTicks(120);
model.inspect(-0.1, 0.2, 0);
model.advanceTicks(90);
const traveler = model.getDirectorState().members[0]!;
if (traveler.reaction.kind !== 'none') {
  console.log(traveler.reaction.kind, traveler.reaction.progress);
}
console.log(model.frame().text);
```

| Method | Semantics |
| --- | --- |
| `configure(patch, poster?)` | Atomic validated merge. Optional `poster: true` deliberately recomposes without ticking; browser uses this while blocked |
| `advanceTicks(ticks)` | Integer 0–600 per call; pure model only. No DOM or wall clock |
| `guide(x, y)` | Finite coordinates clamped to [-1,1]; sets a guide for the selected traveler |
| `clearGuide()` | Clears guide and legacy target coordinates |
| `inspect(x, y, id?, poster?)` | Validates first; selects the ID, marks the point, and invites one response. Defaults to selected ID |
| `greet(poster?)` | Original study response; in a directed scene invites selected member near the current guide or just ahead |
| `select(id)` | Integer ID of an active member; rejects invalid IDs |
| `direct(scene)` | Apply a named authored preset |
| `stage(act)` | Explicit arrival/linger/departure tableau, preserving tick/pause |
| `reset()` | Tick, scene clock, motion clock, reactions, cooldowns, selection, and guides reset; options retained |
| `getState()` / `getPhase()` | Original study-compatible state and reaction phase |
| `getDirectorState()` | Frozen scene state, act/progress/cycle, marker, selected ID, and per-member snapshots |
| `frame()` | Pure bounded ASCII cell rendering; does not advance simulation |

Directed responses use raw ticks: **inspect 0–89 → bank 90–159 → recover 160–279**,
then ordinary motion. Repeated moving invitations during the response and until
tick 340 from its trigger do not restart it or enqueue work. Deliberate static
invitations may replace a previous still pose. Inspection displacement is limited
against the authored neighbor footprints so a request does not collapse the
existing silhouette separation. It is not a collision physics engine; extreme
user compositions can intentionally overlap.

Autonomous member `motion` is one of `gliding`, `stroking`, `banking`, `inspecting`,
`resting`, `recovering`, or `surfacing`. `reaction` is the discriminated union
`{ kind: 'none' }` or `{ kind: 'inspect' | 'bank' | 'recover', progress }`.
Positions are normalized frame coordinates and may be outside [-1,1] during
arrival/departure. Greater `depth` means smaller, dimmer and painted farther back.

The legacy study response remains inspect at ages 0–44, streamline at 45–109,
settle at 110–179, then idle. It still ignores repeated greetings while active;
`greet(true)` selects the age-70 streamline poster.

## Clocks, loops, and reproducibility

The model uses integer simulation ticks at 60 Hz. Director/local-motion time
accumulates `speed / 60` per tick, so changing pace does not re-evaluate a previous
clock through a new multiplier. Reaction timing uses raw ticks independently of
pace. The original study retains its historical sampled `tick * speed` motion.

`loop` resets the route only after all travelers have departed offstage. `once`
ends with `phase: 'complete'`; the browser then releases its scheduler subscription.
`hold` keeps the current act position while strokes and autonomous personality
continue. A model constructed in `hold` begins at a linger composition.

Equal options, seed, normalized ordered actions and integer tick sequence produce
equal logical state/cells in the same JS engine/version, irrespective of when
frames are sampled. Reset is tested against a fresh equivalent model. There is
no ambient random source, input history buffer, serialized restore API, or
cross-version/pixel determinism promise. Fonts affect pixels, not logical cells.

## Browser input, still scenes, and lifecycle

`createTurtleArtwork` exposes the model's observation methods plus `update`,
`play`, `pause`, `restart`, `pulse`, `guide`, `clearGuide`, `direct`, `stage`,
`select`, `inspect`, `subscribe`, `resize`, and `dispose`. Browser `inspect` chooses
a static poster automatically when motion is blocked. Existing mutators and new
mutators no-op after disposal; snapshots remain readable. Subscription callbacks
are synchronous consumer code and should not throw or reconfigure recursively.

- Pointer moves coalesce to one pending guide. They never draw once per event or
  alter a paused/reduced-motion poster. Hover interest belongs to the selected
  traveler and requires proximity; `curious` expands that reach.
- Pointer down uses its own CSS-rectangle coordinates, so touch needs no prior
  move. A visible owned glyph selects that turtle. Empty water offers a point to
  the currently selected traveler. Labels/scenery have no animal ownership.
- Pointer leave, cancel, lost capture, or blocking clears transient hover guidance.
  Deliberate keyboard/control/inspection markers remain until cleared. The adapter
  does not capture pointers or prevent touch scrolling.
- On a focusable canvas only, arrows place a guide, Enter invites inspection, and
  Escape clears it. Tab and modified keys are untouched. Consumers own `tabindex`,
  semantic labels, the pause button, and the surrounding control surface.
- User pause, reduced motion, hidden document, offscreen state, zero size, completed
  one-pass scene, and disposal compose independently. Clearing one cannot clear
  another. Reduced motion is authoritative even after `play()` under system policy.
- A paused or reduced-motion directed mount/restart chooses a meaningful linger
  still. Scene acts and deliberate controls redraw without advancing ticks or
  starting playback. Static options update the composition immediately.
- `subscribe` sends an initial status and subsequent semantic changes: act,
  tenth-of-act progress, member motive, selection, or playback policy. It returns
  an idempotent unsubscribe function. It is not a per-frame callback or another RAF.
- The browser borrows the shared per-window scheduler or optional `frameSource`.
  It never disposes that source. It cancels its subscription when blocked, resets
  wall-time accumulation on resume, caps catch-up at six ticks, and reports excess
  wall time as `droppedSeconds`.
- `dispose` removes this instance's subscriptions, observers, listeners, pending
  guide, last frame and subscriber references. It is idempotent and never removes
  another instance's resources. The caller still owns the supplied Canvas.

## Budgets and evidence boundaries

Source caps: 5 travelers in one logical frame; at most 180×90 = 16,200 cells;
0–600 explicit ticks per call; 6 browser catch-up ticks; one coalesced pointer
slot; no queued invitations, particle pool, timer, downloaded font, or runtime
package dependency. Backing dimensions retain the integrated limits of 2048 per
logical axis and DPR ≤2: at most 4096×4096 pixels. These are bounds, not FPS claims.

The demo chooses 160×64 cells on desktop or 100×40 on an initially narrow screen.
At 390px native capture the small names are supplementary; the readable HTML
roster is the primary selection surface. Actual phone/browser accessibility is a
remaining gate.

Reproduce the implemented checks from a fresh checkout:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node --test test/turtle.test.mjs test/turtle-director.test.mjs
node node_modules/typescript/bin/tsc -p species/turtle/tests/tsconfig.json
npm run typecheck
npm test
npm run check:package
```

`node species/turtle/scripts/render-evidence.mjs <directory> --gif` captures the
actual controller with a real native Canvas context and a mocked document/scheduler
host. It requires the optional installed `@napi-rs/canvas` verification
tool (and `ffmpeg` for GIF); these are not production dependencies. The runner
checks compiled source-map parity before capturing and records exact options,
ticks, hashes, native version and resource cleanup in its manifest.

Native Canvas pictures support geometry/composition critique. They are **not
browser screenshots, responsive CSS acceptance, phone tests, or performance
measurements**. The local Chromium runner was attempted but could not launch:
`socket() failed: Operation not permitted`. Browser input, real CSS reflow,
assistive technology, sustained device performance and heap testing remain open.
