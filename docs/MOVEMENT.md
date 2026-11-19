# Across-screen movement

This is an additive local review implementation, rebased from its original
`b8f222d` prototype onto `59bd5be` without altering the reviewed marine renderers. The package is still the private,
unpublished `ascii-animals-review` package. Build it or install its local tarball;
these examples are not registry installation instructions.

## What is implemented

| Entry | Responsibility |
| --- | --- |
| `ascii-animals-review/movement` | Pure, typed, seeded viewport paths. No DOM, renderer, timers or scheduling. |
| `ascii-animals-review/movement/marine` | A concrete adapter for the existing cuttlefish, manta and octopus renderer. |
| `examples/movement/controls.mjs` | An isolated accessible controls view with a typed presentation port. |
| `examples/movement/main.mjs` | A lazy package consumer that mounts one marine renderer and the controls, with one disposer. |

Other species retain the contracts in [ANIMAL-APIS.md](ANIMAL-APIS.md). They do
not gain a fictional position setter. Their owners can use the pure movement
samples at their actual model/pose seams. The concrete adapter in this patch is
marine-only; no Fox, Gecko, Owl or other species integration is implied.

## Movement, formation and reactions

Movement answers **where a creature travels and when it arrives**. Formation
answers **how a natural scene arranges its cast**. These are separate options.

The marine adapter gives an enabled journey priority over the original world
route and formation placement. Lanes and stagger then determine member paths.
The original `formation`, scene and role options are retained and resume when
`enabled` becomes false. The adapter does not combine native formation routes
with another trajectory, and does not overwrite saved roles or mirror a canvas.

Native fins, wings, arms, glyph rendering, visible-owner hit testing and
species-specific reactions still run. A reaction temporarily takes priority over
a journey pose; its existing recovery blends back into the progressing route.
An octopus keeps its arm attention and a manta keeps its no-ink response. Pointer
following is bounded around the route. Reaction excursions are intentionally
outside nominal lane and endpoint guarantees.

The separate authored marine director is not exposed by the new factory. There
is one owner of world travel at a time. The internal bridge is pinned to the
current marine `_schoolPose`, `_camera` and lifecycle methods; it is not a public
arbitrary-species extension interface.

## Pure contract

```ts
import { createMovementDirector } from 'ascii-animals-review/movement';

const movement = createMovementDirector({
  enabled: true,
  seed: 17,
  path: 'diagonal',
  diagonalSlope: 'up',
  direction: 'forward',
  timing: { mode: 'duration', seconds: 16 },
  count: 3,
  cast: ['manta', 'cuttlefish', 'octopus'],
  lanes: 3,
  staggerSeconds: 1.3,
  lingerSeconds: 2,
  edgePadding: 32,
  silhouetteRadius: 100,
  repeat: true,
}, { width: 900, height: 600 });

movement.advanceTicks(60); // Explicit 60 Hz simulation, no automatic work.
const frame = movement.sample();
// frame.members: CSS-pixel centres, headings, tangents, phases and progress.
movement.reverse();       // Flip time direction at the same position.
movement.resize({ width: 390, height: 500 });
movement.dispose();
```

### Coordinates and timing

Coordinates are CSS pixels: positive X points right and positive Y points down.
Horizontal forward means left to right; vertical forward means top to bottom.
The two diagonal slopes and the route-direction option cover all four diagonals.
Free journeys choose a seeded horizontal or vertical passage with bounded
curvature. Profile cadence and small path variations distinguish smooth manta
gliding, cuttlefish pulses and octopus pulses; these are stylized motion profiles,
not biological models or replacement geometry.

`timing` is a discriminated union: provide either
`{ mode: 'duration', seconds }` or `{ mode: 'speed', pixelsPerSecond }`.
Duration is **moving time**, excluding linger and stagger. Speed is **average
arc-length speed**, with profile variation in instantaneous pace. The route uses
a fixed 96-segment length table and rounds travel duration up to a simulation
tick. Both are independent of the marine `speed` option, which still affects its
local animation. The marine `motion` option controls local articulation; journey
travel uses its own clock. Use pause to freeze the entire scene.

Linger holds the route centre stationary at the midpoint. Local appendage
animation may continue. Every member gets a stable ID and a delayed start;
repeat occurs at the end of the **whole cast cycle**, after the last member has
exited. Early members wait offscreen rather than wrapping through the scene.

`durationTicks` on the snapshot is that whole-cast cycle, including all stagger
and the last departure. Each member exposes its own `startTick` and
`durationTicks`. `tick` is the explicit simulation tick, which seek/reset can reposition;
`playheadTicks` is the
reversible path clock and may be fractional following responsive reflow.

### Route direction versus live reverse

`configure({ direction: 'reverse' })` changes the route endpoints at the current
normalized cast time. This may reposition the cast; it is a route edit.
`reverse()` changes playback direction while preserving each member's immediate
position and then retraces the same sampled path. Headings turn to the new travel
direction. Two reversals restore forward playback. Nonrepeating playback stops
at its first/last endpoint; repeating reverse playback crosses the seam only
while the cast is offscreen.

### Bounds, phases and lanes

The pure caller supplies a conservative `silhouetteRadius`. The start and end
centres clear the viewport by that radius plus `edgePadding`. The marine adapter
derives its radius from the actual cast's native analytic bounds, scale,
perspective and pointer allowance; callers cannot override its cast or radius.

Lane centres occupy an inset 80% viewport band. This is arrangement, not collision
avoidance or automatic silhouette packing. Large casts or large animals can
overlap; count, scale and lane count remain explicit. Path curvature can cross a
lane centreline. A single scalar radius is deliberately conservative.

Phases describe route-centre action: `waiting`, `enter`, `traverse`, `linger`,
`exit`, `complete`. Radius is used for endpoint clearance and the conservative
`visible` hint, not to prevent large-radius paths from ever reaching `traverse`.
The actual renderer remains authoritative for glyph visibility and hit ownership.

### Resize, deterministic replay and invalid input

Resize and configuration changes preserve normalized **whole-cast cycle time**.
They reflow coordinates to the new viewport. Speed timing recalculates duration
from the resized path length; individual phases can reflow when stagger or
relative member durations change. Resize is not a promise of unchanged pixels.
A zero-sized viewport produces finite, unavailable samples; the browser adapter
suspends scheduling until it has a visible size.

The reproducibility guarantee covers this module/version in the same JavaScript
engine, with identical initial options, viewport/configuration changes, integer
tick operations and input order. Neither font pixels across machines nor native
mouse-event delivery across browsers is promised identical. No ambient random
source, browser clock or DOM measurement is used by the pure module.

Unknown fields and invalid enums, nonfinite numbers, fractional counts/seeds,
sparse cast arrays, contradictory timing fields and out-of-bounds values throw
before mutation. Snapshots and nested configuration are frozen. Maximum cast is
12, viewport dimensions are 0..32768, seed is uint32, and one advancement accepts
at most 216000 ticks. Every other bound is declared in the implementation and
tested. No arbitrary callback or unbounded point list is accepted.

`sample()` never advances. `seek()` is an explicit absolute integer path time;
it does not schedule anything or reconstruct renderer reactions.
`dispose()` is idempotent. Later mutation calls are no-ops and snapshots remain
readable. Separate instances share no mutable path state.

## Concrete marine adapter

```ts
import { createMarineMovementArtwork } from 'ascii-animals-review/movement/marine';

const artwork = createMarineMovementArtwork(canvas, {
  enabled: true,
  path: 'horizontal',
  timing: { mode: 'speed', pixelsPerSecond: 85 },
  lanes: 3,
  staggerSeconds: 1.3,
  lingerSeconds: 2,
  repeat: true,
}, {
  count: 3,
  species: 'manta',
  speciesByAnimal: ['manta', 'cuttlefish', 'octopus'],
  size: .5,
  scene: 'reactive',
  followPointer: true,
});

artwork.configureMovement({ path: 'free', seed: 23 });
artwork.reverseMovement();
artwork.pause();
artwork.showMovementStill(.5);
artwork.configureMovement({ enabled: false }); // Restore natural routes.
artwork.dispose();
```

The factory uses the existing shared browser scheduler, not a second RAF loop.
Enabled journeys accumulate fixed 60 Hz ticks; at most six ticks run per rendered
frame. The inherited renderer bounds wall-time catch-up at 0.1 seconds and
reports discarded stall time in `getStats().droppedSeconds`. Hidden/offscreen or
zero-size scenes release their subscription. Resuming clears the wall-time
accumulator rather than replaying a hidden backlog.

The native factory default remains natural movement: `enabled` defaults to
false. Disabled rendering was compared against the original renderer for all
three marine species. The new factory composes user pause, system reduced
motion, document visibility, offscreen state, zero size and disposal.

System reduced motion is a hard automatic-playback gate in this adapter when
`reducedMotion: 'system'` is used. Calling play, moving the pointer, restarting or
editing configuration cannot bypass it. Entering reduction latches pause;
leaving reduction does not silently start playback. The sample does not expose
an ignore-preference switch. The underlying explicit `reducedMotion: 'ignore'`
artwork option remains available to deliberate library hosts.

An enabled journey mounted reduced/paused presents a midpoint still rather than empty entry water.
`getMovementState()` remains the real simulation state; `getMovementDisplay()`
may describe a display-only poster. Static redraw, resize and control changes do
not deliver ticks. `showMovementStill()` pauses and clears transient reactions
and ink; it does not alter the real path playhead. Playing continues from that
real playhead. A deliberate `seekMovement()` changes it without replaying native
reaction history. `advance()` requires `autoStart: false`; as in the existing
marine API, explicit recording steps may advance a user-paused scene. Enabled
journeys also block those steps under system reduction; disabled journeys retain
the native manual-step contract.

Pointer/touch events stay on the canvas. Native keyboard-equivalent action
buttons belong to the sample view: Space on the focused canvas toggles pause,
Enter triggers the existing `pulse()` scene action, and Tab leaves normally.
No global shortcut captures keys in form controls. The sample uses `reactive`,
where the action can startle an eligible animal. In native `swimby`, `pulse()`
restarts the scene instead; the adapter preserves that existing semantic.

## Mounting from the navigation work

`examples/movement/main.mjs` exports an async consumer with an abortable lazy
import. Copy/mount that isolated consumer or its port mapping inside the shell's
existing client component; do not copy the renderer or put a demo in an iframe.

```ts
const abort = new AbortController();
const demo = await mountMarineJourneyDemo({
  canvas,
  controlsHost,
  signal: abort.signal,
});
// On route change/unmount, abort() is sufficient; dispose() is also idempotent.
abort.abort();
demo?.dispose();
```

The import is cancelled logically if the route disappears before it resolves.
After mount, abort disposes the artwork, controls, media-query subscription and
canvas keyboard handler. The caller owns its canvas and host nodes. Include
`controls.css` in the shell stylesheet. Controls use a typed presentation port,
so the shell can reuse the view without depending on internal engine fields.
Call `refresh()` after external state/preference changes; the view has no
per-frame timers or announcements. The example provides native labels, fieldsets,
validation alerts, focus styles and narrow-layout rules. Real-browser keyboard,
touch and accessibility acceptance remain required; source semantics are not a
WCAG certification.

The standalone example maps the real package subpath to its built export via an
import map. From the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
python3 -m http.server 8000
# Open /examples/movement/ on that local server.
```

For Next.js, import the same subpath from the installed local package in a client
mount effect. The Next.js study stage now uses this single native adapter for Cuttlefish,
Manta and Octopus with motion disabled until the user opts in. The study's React
panel is distinct from the standalone sample, but shares the typed contract.
Its scope is path, starting direction, travel time, midpoint linger/still,
repeat and continuous reverse. Main routing, original studios and deployment
configuration are unchanged.

## Validation and remaining acceptance

The review bundle carries exact check logs and a touched-path manifest. Included
focused checks are:

```sh
node --test test/movement.test.mjs test/movement-marine.test.mjs test/movement-controls.test.mjs
node node_modules/typescript/bin/tsc -p test/tsconfig.movement.json
node node_modules/typescript/bin/tsc -p test/tsconfig.movement-marine.json
npm test
npm run typecheck
npm run test:legacy
npm run check:package
```

The optional controls browser test needs `ASCII_PLAYWRIGHT_MODULE` pointing at an
already-installed Playwright module and `ASCII_CHROMIUM` at its browser. The
available Chromium failed during launch with a socket permission denial in this
execution environment; no browser-control assertion passed. No permission or
security settings were changed. Touch hardware, focus/reflow, screen-reader
behaviour, Next mount/hydration, target-device frame timing and CI remain unrun.

`examples/movement/capture.mjs` can capture the actual built marine renderer
through an already-installed native Canvas module. Set `ASCII_CANVAS_MODULE` to
its `@napi-rs/canvas/index.js`. Its six deterministic frame captures and manifest
are useful raster evidence, explicitly **not browser screenshots**. Each native
raster pass runs in a separate process to bound retained font/atlas resources.
