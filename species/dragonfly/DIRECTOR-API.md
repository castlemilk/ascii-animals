# Dragonfly pond director API

The existing typed `./dragonfly` entry and opt-in pond director are preserved.
This flight study is based on main `b8f222dab868821f27bf2a64a98434f3483fc8e6`.
It changes Dragonfly-owned geometry, choreography, presentation and controls;
public factories, method signatures, option fields and cue/phase unions remain.
The original solo factory, model, replay and aliases remain. Shared scheduling,
entry points and generated distributions are central integration concerns.

## Browser usage

```ts
import {
  createDragonflyArtwork,
  type DragonflyDirectorOptions,
} from 'ascii-animals-review/dragonfly';

const choreography = {
  scene: 'patrol', count: 3, route: 'banks', tempo: 1,
  roles: ['patroller', 'sentinel', 'skimmer', 'wanderer'],
} satisfies Partial<DragonflyDirectorOptions>;

const pond = createDragonflyArtwork(canvas, {
  director: choreography,       // omit for the original solo experience
  model: { seed: 17, motion: 'full' },
  onStatus(status) {
    // A coarse phase/selection/lifecycle notification, not per-frame telemetry.
    console.log(status.director?.arc);
  },
});
pond.selectIndividual(1);       // stable zero-based ID, active on the next tick
pond.setTarget(.6, -.35);        // normalized canvas coordinates, y increases down
pond.cue('dart');               // selection → pointer → cue in the same host batch
pond.configureDirector({ scene: 'relay', count: 4, tempo: .8 });
pond.clearTarget();             // resume authored autonomous motives
pond.cue('perch');              // selected visitor lands and grips its twig
pond.cue('return');             // spool wings, release grip and relaunch; or cancel toward route
pond.pause();
pond.pulse();                   // an explicit alternate still arrangement
pond.restart();                 // retains configuration and user pause
pond.play();                    // still respects system reduced motion
pond.dispose();                 // idempotent; removes this subscription only
```

Calling `cue('dart')`/`pulse()` is a deliberate action; pointer motion alone never
triggers a dart. Repeated dart/perch cues during a response are ignored. An
explicit return may cancel a response. A held perch ignores pointer attention
until a dart or return releases it. Other individuals continue their own routes.

Browser methods add `configureDirector`, `getDirectorOptions`,
`getDirectorState`, `selectIndividual` and `cue`. On a solo mount, director getters
return `null`; director configuration/selection/perch/return reject. `cue('dart')`
on a solo mount delegates to the existing dart action. `configure`/`update` still
take model configuration, not scene options. `getState()` still returns the
primary `DragonflyState`, not an ensemble disguised as the legacy state.

## Defaults and validation

| Director field | Default | Accepted values and purpose |
| --- | --- | --- |
| `scene` | `patrol` | `patrol`, `attention`, `relay`; authored motive selection |
| `count` | `3` | Integer 1–4; stable IDs 0–3 |
| `route` | `banks` | `banks`, `figure-eight`, `orbit`; territory path shape |
| `tempo` | `1` | Finite .4–1.6; authored clock and motion limits |
| `spread` | `1` | Finite .65–1.1; horizontal territory/reed spacing |
| `scale` | `.4` | Finite .28–.48; geometry scale; ID size factor `1 − .035 × id` |
| `breeze` | `.12` | Finite −.5–.5; bounded route drift, not a force simulation |
| `labels` | `true` | Boolean; canvas identity labels; semantic cast controls remain |
| `roles` | `[patroller, sentinel, skimmer, wanderer]` | Exactly four declared roles, including inactive slots |

`validateDragonflyDirectorOptions(patch)` returns a complete frozen configuration.
Creation and configuration reject unknown fields, explicitly undefined fields,
nonfinite numbers, coercible strings, out-of-range values, invalid roles and
sparse role arrays. Validation completes before changing state. The roles tuple
is copied/frozen so caller mutation cannot change the director.

`configure` preserves the scene clock, retained identities, seeds, current poses
and in-progress responses. Changed routes/scenes become new goals without a
teleport. Removed members are disposed; added members begin at their own local
tick zero, using `seed + id × 104729` modulo 2³². Removing the selected member
clamps selection to the last remaining ID. An in-flight cue keeps the anchor it
captured when started. Configuration begins a new deterministic replay segment.

### Relation to model options

The original model keeps all its existing options and validation. In director
mode, `seed`, `motion`, `followPointer`, `wingHz` and `wingAmplitude` affect the
ensemble. Director-owned root motion replaces the solo hover/tracking/dart path;
solo fields such as `trackingReach`, `trackingSpeed`, `trackingAcceleration`,
`dartDistance`, `dartTicks`, `recoveryTicks`, `cooldownTicks` and `hoverRadius` do
not tune these scene routes. They remain accepted model fields for compatibility.
Use director `tempo`, `route`, `spread`, `breeze`, `scene` and roles for scene
motion. The director's cue windows and physical caps below are deliberately
fixed in this version. This separation is explicit, not a shared contract claim.

## Authored scenes and roles

| Scene | Visible arc | Individual variation |
| --- | --- | --- |
| Pond patrol | Land/rest → lift → separate territory route → lookout → return | Sentinel rests longer; skimmer follows quicker uninterrupted paths; wanderer has a slower irregular vertical rhythm |
| Hovering attention | Selected visitor approaches/holds the guided position; release returns control to its motive | Other visitors hover near reeds; the sentinel settles; a manual held perch takes precedence |
| Reed relay | Staggered rest → takeoff → short crossing → territory patrol → landing | A 720 authored-tick cycle with 180-tick offsets, each visitor retaining its own route and reed |

Patrol cycles are 1,080 authored ticks, or 840 for the sentinel. The director is a
bounded pond, not a collision-avoidance system: moving wings may briefly overlap
during crossings. Default territory spacing and a two-row still/perch arrangement
protect the main silhouettes. Four visitors at minimum spacing and maximum size
can be crowded; labels may be omitted when no nonoverlapping position fits.

A manual dart captures the current heading and retreats tail-first along its
rear axis. Anticipation creates room near the lower bank. In an ensemble, a
bounded, one-time choice of lateral lane reduces overlap with nearby wings;
there is no per-frame avoidance noise. Pointer position directs hovering but
does not turn the explicit backward cue into forward pursuit.

The cue runs anticipation/launch (24–73 authored ticks depending on clearance),
dart 30, brake/settle 54, return 90, then cooldown/land 60. It returns toward the
captured pre-cue point, or its twig if it started perched. Perch uses 100 approach
+ 60 landing ticks, then waits for actual position, velocity, attitude, six-foot
grip and wing-power convergence before declaring `perched`. Return from a held
perch begins with a 42-tick wing spool-up/grip release/lift, then 100 return + 45
settle ticks. A return from flight omits that takeoff. These are goal windows,
not promises of exact arrival at a timestamp; acceleration stays bounded.

Scene `arc` is a coarse summary: `arrive`, `patrol`, `intercept`, `return`, `rest`.
Per-member tagged phases are `patrol`, `attention`, `hover`, `launch`, `dart`,
`settle`, `return`, `land`, `perched`, `cooldown`, with `elapsed`/`duration` in
authored ticks. Duration zero denotes an open-ended phase. This scene state is
separate from the preserved legacy model behavior union.

## Headless deterministic API

```ts
import {
  createDragonflyDirector,
  type DragonflyDirectorInput,
  type DragonflyDirectorStepResult,
} from 'ascii-animals-review/dragonfly';

const director = createDragonflyDirector({ count: 3 }, { seed: 17 });
const events: readonly DragonflyDirectorInput[] = [
  { type: 'select', tick: 1, seq: 0, id: 1 },
  { type: 'pointer', tick: 1, seq: 1, x: .6, y: -.35 },
  { type: 'cue', tick: 1, seq: 2, cue: 'dart' },
];
const result: DragonflyDirectorStepResult = director.step(1, events);
if (result.kind === 'advanced') console.log(result.state.members);
for (let tick = 2; tick <= 300; tick++) director.step(tick);
const originalGeometry = director.sample();
director.dispose();
```

The director reads no DOM, wall clock, scheduler or ambient randomness. Import is
SSR-safe. `step` requires exactly the next integer scene tick, in 1..2,147,483,647,
at a fixed 60 Hz simulation rate. At most 16 events are accepted per tick. Each
event must match that tick, have a nonnegative safe-integer sequence strictly
greater than all prior sequences, and contain exactly its declared fields:

| Event `type` | Payload |
| --- | --- |
| `select` | Existing integer `id` |
| `pointer` | Finite `x`, `y` in −1..1; y increases down |
| `leave` | No extra payload |
| `cue` | `cue: 'dart' | 'perch' | 'return'` |

The complete event batch is validated atomically and applied in supplied order.
`acceptedCue` reports whether any cue was accepted; `ignoredCues` counts response
repeats. Paused/static calls still validate, return `kind: 'resting'`, consume no
tick/sequence/events, and count cues as ignored. They are not deferred to resume.

`getState()` returns a fresh deeply frozen snapshot: scene tick/lastSeq, scene,
arc, selection, normalized target, and members with ID/name/seed/role,
position/perch/velocity/heading, phase and local model tick. Snapshot identity is
not stable; contents and meaning are. `sample()` returns fresh transformed
geometry and landmarks per member. The existing procedural geometry is reused;
wing roots/tips, eyes and abdomen tip receive the same transform as samples.

`configureModel` preserves the original model validation, rejects seed changes,
and applies the patch to every member. `reset(seed?)` is the seed-change seam; it
clears clocks, sequences, input, response and selection while keeping options and
pause. `selectIndividual` is immediate in the headless API. `setStaticPose(0|1)`
selects a composed arrangement without advancing time. `clearTarget` removes the
guide. `dispose` is idempotent; subsequent mutations and sampling reject, while
state/options snapshots remain readable.

## Host ownership, accessibility and budgets

The public adapter uses the accepted per-window scheduler. An ensemble owns one
subscription, one canvas, and 1–4 independent models. An explicitly supplied
`frameSource` remains borrowed. It must return an unsubscribe function. Teardown
removes only the host's listeners/observers/subscription; peers remain active.

The host coalesces pointer, selection and cue to at most three events per tick in
selection → pointer → cue order. It runs at most five fixed steps per callback.
Hidden, offscreen and zero-size suspension clear transient inputs and drop wall
time, without replaying stale catch-up on return. Pause/static/reduced motion
schedule no animation; deliberate Guide/Dart actions change a still arrangement.
System reduced motion wins over Play and remembered requested full motion.

The demo provides native scene/population/role/route controls and named cast
selection. While the canvas has focus, keys 1–4 select existing visitors, arrows
guide, D darts backward, L lands, R relaunches, and Space toggles pause. Buttons/selectors provide the equivalent touch
and keyboard actions without requiring a drag. Tapping visible anatomy selects its actual frontmost owner before guiding it.
Pointer movement never resumes a still pond. Native scrolling remains available on touch. Selected identity has
corner markers as well as color and a named semantic control. The live region
announces explicit user actions; animation phase changes are not announced each
frame. Labels and neutral silhouettes are configurable. PNG/text capture uses
the actual current canvas/cell grid. There is no browser video recorder in this
extension; the reproducible offline GIF is evidence, not a new runtime API.

Fractional browser frames interpolate private root/heading/wing-phase/attitude/
grip poses before generating geometry. Blade spans remain rigid. Public
`director.sample()` remains exact-tick and read-only. The species-internal host
seam is not added to the public package entry. `exportText()` captures the last
painted cells, so a fractional frame agrees with a simultaneous PNG; an unpainted
host falls back to exact sampling. Same seed, options, tick/input log and engine
version reproduce the same state and cells. Old-version pixels are not promised.

On a narrow page, semantic controls can sit below the canvas. The demo brings the
pond into view and retains at most one pending selection, guide and cue, applied
in that order after visibility is confirmed. It clears the intent before applying
it, and cancels it on hiding, reset, configuration or disposal. The host's own
hidden/offscreen/zero-size input discard policy is unchanged.

Limits: ≤24,576 samples overall (currently 3,874 per visitor), ≤160×88 cells,
72×44 minimum grid, logical paint bounds 1,200×700, DPR 1–2, no trails/history or
particle growth. Root bounds are x ±1.3, y −.65..1.05, z .04–.32. Pace is tempo
times .25 in slow mode (otherwise tempo). Desired cruise speed is .9×pace and dart speed is 2.6×pace. The spring uses
3.2×pace acceleration outside dart and 9×pace during dart, with the final
velocity change bounded as well. The global acceleration ceiling is 9×pace.
A settling visitor may temporarily exceed desired cruise while braking.
Configuration retains velocity: after lowering tempo or entering Slow, inherited
speed decays under the new acceleration bound instead of being instantly clipped.
The overall speed ceiling across allowed configurations is 4.16 (2.6×1.6) scene
units/s; fixed-configuration traces enforce the corresponding 2.6×pace bound.
Wings continue during approach, taper near contact and stop only at settled
perch. These are numerical budgets, not measured device-performance claims.

See [DIRECTOR.md](DIRECTOR.md) for the pre-code brief and scene matrix,
[DIRECTOR-VALIDATION.md](DIRECTOR-VALIDATION.md) for actual evidence and remaining
gates, and `tests/types/director.ts` for positive and negative typed consumers.
