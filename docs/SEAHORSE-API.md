# Seahorse: the eelgrass holdfast director

The Seahorse has a compatible single-animal study and three directed scenes:
`kelp-garden`, `tidal-duet` and `drift-passage`. A directed scene contains one to
four individuals with separate intentions, tail attachment, current response,
snout attention and arrival/rest/depart/return choreography.

The eelgrass revision starts from `b8f222dab868821f27bf2a64a98434f3483fc8e6`.
It adds solid segmented armour, a swept coronet, a genuinely opening tail coil,
moving eelgrass contact and three distinct cue phrases. The public declarations
are unchanged. `kelp-garden` and the `kelp` cell layer retain their API names;
the demo calls the habitat **Eelgrass garden**. See the current
[review record](../species/seahorse/EELGRASS-REVIEW.md).

The original director extended the **newly authored integrated Seahorse** inspected at base
`c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`. The exhausted earlier Pro chat's
implementation was not recovered. Canonical implementation is
[`src/public/seahorse.ts`](../src/public/seahorse.ts); the demo source is
[`species/seahorse/demo`](../species/seahorse/demo). See the
[authoring notes](../species/seahorse/AUTHORING.md) for the gap matrix and visual
decisions.

The package remains private/unpublished. Examples refer to the local packed
package, not an npm-registry release. `createSeahorseArtwork`,
`createSeahorseModel`, `normalizeSeahorseOptions` and `SEAHORSE_DEFAULTS` remain
available from the package root and the Seahorse subpath. Use the subpath for
species types.

## Mount a directed garden

```ts
import {
  createSeahorseArtwork,
  type SeahorseOptions,
  type SeahorseDirectorAction,
} from 'ascii-animals-review/seahorse';

const options = {
  scene: 'kelp-garden', count: 3, columns: 160, rows: 76,
  current: .3, duration: 28, stagger: .8, labels: true,
  individuals: [
    { role: 'sentinel', facing: 'left' },
    { role: 'explorer', scale: .9 },
    { role: 'dreamer', facing: 'right' },
  ],
} satisfies SeahorseOptions;

// The host owns layout, focusability and accessible descriptions.
canvas.tabIndex = 0;
canvas.setAttribute('aria-label', 'A garden of three ASCII seahorses');
const art = createSeahorseArtwork(canvas, options);

art.direct({ type: 'select', id: 1 });
art.guide(.5, -.2);                     // normalized stage coordinates
const release: SeahorseDirectorAction = { type: 'release' };
art.direct(release);                    // selected visitor; no motion override
art.update({ current: -.25 });

art.pause();
art.direct({ type: 'seek', progress: .42 });
art.direct({ type: 'inspect' });         // deliberate still pose while paused
art.direct({ type: 'anchor' });          // replaces that still pose immediately
const characters = art.getFrame().text;
const composition = art.getDirectorState();

art.restart();                         // preserves options and user pause
art.dispose();                         // idempotent; later mutators are no-ops
```

## Options, defaults and validation

Options validate before any model state changes. Unknown top-level, individual
and action keys reject. `undefined` leaves an existing option unchanged.
Numeric values must be finite and within the stated bounds. Defaults, resolved
configurations, nested individual entries and returned snapshots are frozen;
caller-owned individual arrays are defensively copied.

| Option | Allowed values | Default | Meaning |
|---|---|---|---|
| `scene` | `study`, `kelp-garden`, `tidal-duet`, `drift-passage` | `study` | Rendering and authored route |
| `count` | Integer 1–4 | `1` | Bounded number of individuals |
| `columns` | Integer 64–160 | `100` | Logical character-grid width |
| `rows` | Integer 36–100 | `60` | Logical character-grid height |
| `seed` | Integer 0–2147483647 | `7` | Repeatable individual phases and water detail |
| `choreography` | `cycle`, `hold` | `cycle` | Advance the route or hold a chosen beat |
| `duration` | 16–90 seconds | `28` | Nominal scene length at `speed: 1` |
| `stagger` | 0–3 seconds | `.8` | Per-ID offset along a cycling scene |
| `current` | −1–1 | `.3` | Signed current; negative flows left, positive right |
| `speed` | .25–2 | `1` | Autonomous pose tempo and future scene-clock rate |
| `scale` | .6–1.3 | `1` | Requested overall size, fitted to the composition |
| `individuals` | Readonly array of 0–4 entries | `[]` | Per-ID role, relative size and facing |
| `labels` | Boolean | `false` | Numbered labels; selected visitor has `*` |
| `behavior` | `hover`, `curious`, `holdfast` | `hover` | Legacy study behavior; directed scenes have their own routes |
| `facing` | `left`, `right` | `left` | Default facing, except inward-facing duet partners |
| `palette` | `brass`, `lagoon`, `rose` | `brass` | Animal colour; kelp and water have separate subdued tones |
| `sway` | 0–.4 world units | `.18` | Legacy study hover amplitude |
| `paused` | Boolean | `false` | Requested user pause; browser policy can also block playback |
| `reducedMotion` | `system`, `ignore` | `system` | Follow the live system preference unless explicitly opted out |

Each `individuals[id]` entry accepts only these optional fields:

| Field | Values | Resolution when omitted |
|---|---|---|
| `role` | `sentinel`, `explorer`, `dreamer`, `partner` | Normal order: sentinel, explorer, dreamer, partner. Complete pairs in `tidal-duet` default to partner. |
| `scale` | .75–1.2 | `1`; multiplied by global size before fitting |
| `facing` | `left`, `right` | Scene/global facing |

IDs are zero-based `0..count-1`. Names are Fern, Pip, Lumen and Tide in that
order. Labels and demo controls display numbers 01–04. Configured entries can
remain in the array while `count` is smaller; they become relevant when that ID
exists. Updating `individuals` replaces the array rather than merging by ID.

```ts
const next = art.getOptions().individuals.map(entry => ({ ...entry }));
next[1] = { ...next[1], role: 'partner', facing: 'left' };
art.update({ individuals: next });
```

`scale` is a request, not identical world size at every count or aspect ratio.
The director reserves room for anatomy, labels and movement, then fits visitors
into their slots. Four visitors use a two-by-two arrangement when width permits
and a vertical arrangement in narrow grids.

## Scenes and roles

| Scene | Composed behavior | Suggested starting count |
|---|---|---|
| `study` | Existing upright portrait, hover/curiosity/holdfast and legacy greeting | 1 |
| `kelp-garden` | Individual kelp holds; a keeper stays attached while an explorer ventures out and a dreamer makes a smaller excursion | 3 |
| `tidal-duet` | Neighboring partner IDs release, move inward, rise together and recover their own holds | 2 |
| `drift-passage` | A traveler loosens its tail, crosses part of the clearing with the current and returns along a lower arc | 1 |

All three directed scenes accept counts 1–4. Duet pairing uses IDs 0/1 and 2/3.
A partner without an existing neighbor has ordinary garden behavior. A
non-partner in the duet keeps its own garden intention. This is courtship-inspired
choreography, not a biological simulation.

In a garden rest stage, sentinels remain attached, explorers make the largest
excursions, dreamers make small excursions and partners use a middle amount.
Stronger currents suppress those excursions. Fins, small body sway and individual
blinks have independent seeded phases. Zero current does not pause autonomous
details. Directional route changes are continuous through zero current.

### Scene clock

`getDirectorState().progress` is the normalized scene clock in `[0,1)`.

| Arc | Progress | Default 28-second duration, speed 1 |
|---|---|---|
| `arrival` | `[0, .18)` | 0–5.04 s |
| `rest` | `[.18, .68)` | 5.04–19.04 s |
| `depart` | `[.68, .87)` | 19.04–24.36 s |
| `return` | `[.87, 1)` | 24.36–28 s, then the next arrival |

For a cycle, each 60 Hz tick advances the scene clock by `speed`. At constant
settings, the cycle lasts `duration / speed` seconds of advancing simulation.
Individual ID `i` follows progress offset by `i * stagger / duration`; the overall
arc is therefore not necessarily every visitor's current motive. Stagger is
disabled in hold mode.

`choreography: 'hold'` initializes at progress `.42`. Switching cycle to hold also
selects `.42`. The scene clock then stays still while explicit ticks can advance
idle details and interaction recovery. **Hold is not pause.** Seeking works in
hold mode and replaces the held beat; subsequent ticks retain that progress.
Switching back to cycle continues from the held progress.

Seek accepts finite `0..1`; `1` means loop origin `0`. It does not advance
`getState().tick`, change selection or start browser playback. It clears transient
director cues and pointer attention. The legacy greeting clock is separate. The
demo's Arrival, Rest, Release and Return still buttons pause and seek to `.08`,
`.42`, `.73` and `.93` respectively.

Changing `duration` preserves normalized progress. Changing `scene` or `seed`
clears director cues/attention and initializes the route at 0 for cycle or `.42`
for hold; integer tick and legacy greeting are preserved. Reducing count clamps
selection and removes cues for absent members. `reset()`/`restart()` resets both
clocks, selection to 0, attention and cues while keeping configuration.

## Director actions and recovery

The model and controller accept the typed `SeahorseDirectorAction` union:

```ts
type SeahorseDirectorAction =
  | { readonly type: 'select'; readonly id: number }
  | { readonly type: 'release' | 'anchor' | 'inspect' | 'startle'; readonly id?: number }
  | { readonly type: 'seek'; readonly progress: number };
```

An omitted cue ID targets the selected visitor. Supplying an ID does not change
selection. Selection and seek act immediately. Invalid commands reject before
changing selection, clocks, cues or output.

| Cue | Visible response | Total duration | Deliberate poster age |
|---|---|---|---|
| `release` | Prepare while held; uncoil, let go, drift, recontact and rewrap | 240 ticks / 4 s | 90 ticks |
| `anchor` | Reach the moving blade, establish grip, recover the route | 180 ticks / 3 s | 70 ticks |
| `inspect` | Notice first; pivot the head/snout and trunk toward the guide, retaining grip while the underlying route remains held | 180 ticks / 3 s | 70 ticks |
| `startle` | Tighten the coil before bracing against signed current; ease the torso back, then relax tension | 240 ticks / 4 s | 50 ticks |

In a held rest pose, release retains the completed grip through tick 24, opens and detaches
over ticks 24–66, travels through tick 145, returns over ticks 145–210 and
rewraps through tick 240. In a held sentinel the completed contact is restored
by tick 210. A moving/free route recovers to its underlying route instead of
being forced into an attachment when the cue expires. Cue timing does not pause
an evolving cycle route: departure can release its existing grip earlier.

Inspection spends its first 24 ticks noticing before the trunk approaches;
the skull, eye, coronet and tubular snout pivot together. Inspection and bracing
keep exact contact while the underlying route remains held. Bracing tightens
the coil over 28 ticks, delays its lean
until tick 24, then relaxes the torso before releasing coil tension. The demo
labels this existing `startle` action **Brace current**. These timings are
authored animation, not measured animal kinetics.

Cue durations are raw ticks and do not scale with `speed`.
Each visitor owns one cue slot. While moving, additional cues for the same
visitor are ignored until recovery completes; no event queue grows. Other
visitors can respond independently.

The pure model accepts `direct(action, true)` to choose the poster age without
advancing time. A poster replaces any existing cue for that visitor, so several
still gestures can be selected consecutively without reset. If explicit ticks
subsequently advance, the poster cue ages and recovers normally. Browser
`direct(action)` chooses the poster policy whenever motion is blocked. It has
no second argument that could override browser motion policy.

## Input and accessible controls

`guide(x,y)` accepts finite coordinates and clamps them to `[-1,1]`. Directed
scenes attract the selected snout and add a small vertical response when the
visitor is free. `clearGuide()` restores autonomous attention. Neither method
starts playback.

Pointer/touch coordinates use the fitted stage. A tap near a visitor selects it
and cues inspection; empty-water taps guide attention without selecting an
unrelated visitor. A tap carries its own position, without requiring preceding
hover. Pointer movement replaces one current target; live drawing stays with
the shared scheduler. Pointer leave/cancel clear the guide.

Keyboard shortcuts apply when the event target is the canvas; Alt/Ctrl/Meta
shortcuts are left alone. The host must make the canvas focusable. The demo also
supplies labelled native controls.

| Key | Operation |
|---|---|
| Left / Right | Select previous/next visitor, wrapping at the ends |
| Up / Down | Guide selected attention upward/downward |
| Enter | Inspect selected visitor; legacy study uses its greeting |
| H | Find a hold (`anchor`) |
| R | Release the tail |
| Escape | Clear guide attention |
| Space | Toggle requested user pause |

The demo exposes scene, population, current, tempo, individual role/size/facing,
cycle/hold, duration, stagger, colours and labels. Status text describes the arc
and selected motive; deliberate actions have a polite announcement region. ASCII
capture uses `getFrame().text`; PNG capture uses the host canvas. There is no
Seahorse video recorder or particle-rendering API in this change.

## State, frames and attachment geometry

`getDirectorState()` returns a deep-frozen `SeahorseDirectorState`: scene,
overall arc/progress, selected ID, current, world dimensions and members. Each
member exposes ID/name/role, fitted scale, facing, position, rotation, curl,
attention, motive, completed attachment if present and the actual tail endpoint.

`SeahorseMotive` is discriminated by `kind`. `anchored` includes `anchorId` and
`duet` includes `partnerId`; other kinds are `arriving`, `drifting`, `inspecting`,
`startled`, `recovering` and `returning`.

```ts
for (const member of art.getDirectorState().members) {
  if (member.motive.kind === 'duet') {
    console.log(member.name, 'shares a phrase with', member.motive.partnerId);
  }
  if (member.anchorId !== null && member.anchor !== null) {
    // Tail endpoint and holdfast coincide, including mirrored/scaled poses.
    console.log(member.tailTip, member.anchor);
  }
}
```

`anchorId` is non-null only when grip is complete. An `anchored` motive identifies
that same completed attachment. Other motives can coexist with grip, such as a
startled visitor that remains attached. Geometry uses the same spiral endpoint
as the director renderer; body translation compensates for facing, scale and
rotation to keep the tail in place. The anchor is a material point on the same
eelgrass curve that is drawn, so attached animals follow its sway. A depth test
places the rear coil behind that blade and its front return above it. Contact
is drawn by this overlap, with no artificial holdfast marker.

Directed coordinates are centered with positive Y downward. World height is
6.2; width is `6.2 * columns * .56 / rows`. The adapter fits that aspect into the
canvas and maps pointer coordinates through the same fit. Free poses reserve
room for rotated anatomy and labels before blending toward an attachment;
layout fitting may reduce requested scale.

`getFrame()`/`frame()` return immutable printable ASCII text and cells with
`glyph` and `tone` (0–9). Directed cells also expose `layer` (`water`, `kelp`,
`animal`, `label`) and `owner` (member ID or −1 for background). The old portrait
can omit these optional fields. System font rasterization is outside the
logical-cell determinism guarantee.

### Existing study consumers

Default `scene: 'study', count: 1` retains the original study controls and
`hover`, `curious`, `holdfast`, `guide`, `greet` and `pulse` behavior. The original
`SeahorseState` shape remains `tick`, `responseTick`, `targetX`, `targetY`;
director state has a separate getter. Its anatomy now shares the same plate,
head and tail painter as the garden. Appearance is intentionally revised;
the existing method signatures and greeting thresholds remain unchanged.

The legacy response is inspect at `[0,45)` ticks, curl at `[45,110)`, settle at
`[110,180)`, then idle. `speed` does not alter these thresholds. Repeated
`greet()`/`pulse()` during a legacy response remain ignored. `greet(true)` or a
blocked browser pulse starts at age 70, selecting the curl poster. This legacy
lock is separate from replaceable `direct(..., true)` posters.

Use a directed scene for new cue choreography and renderer-exact geometry.
For `study` plus one visitor, director snapshots are control bookkeeping in the
director coordinate system; they are **not** literal geometry of the close portrait.
Director-only cues do not replace that portrait renderer. Setting study count
above one selects the ensemble renderer, so the legacy portrait guarantee
applies specifically to `study` with count 1.

## Lifecycle, scheduling and bounded work

The model is DOM-free and SSR-safe to import. `advanceTicks(n)` accepts integer
`0..600`. Explicit stepping is independent of model `paused`; browser policy
belongs to the controller. Identical version, options, seed, ordered events and
integer ticks reproduce logical state/cells, including different tick batches.

`createSeahorseArtwork` mounts an existing browser canvas. It uses the shared
per-window scheduler by default. Browser-only `frameSource` accepts
`subscribe((timestampInMilliseconds) => void): () => void`; that source is
borrowed and never disposed by the artwork. No extra RAF loop is created for
individual visitors, cues or pointer input.

Requested pause, system reduced motion, hidden document, viewport visibility and
zero size independently stop subscriptions. `play()` clears requested pause
only. `getOptions().paused` is the requested setting; `getStatus().paused` is the
effective blocked state. Status also reports reduced motion, hidden/in-viewport,
disposed, legacy phase, integer tick and `droppedSeconds`.

Mounting a directed scene already paused or under reduced motion composes rest
at `.42`. Later reduced-motion changes stop at the current pose. Still cues and
seeks remain available. Restart preserves requested pause and all blockers,
returning to the model's initial beat: 0 for cycle, `.42` for hold.

The browser advances at most six ticks per frame, drops active wall time beyond
100 ms and reports it. Resume starts a fresh timestamp baseline; paused/hidden
time is not replayed. Logical grids cap at 160×100 (16,000 cells), population and
cue slots at four, and water tracers at 24. The garden adds eleven distant
ribbons and two short near-edge leaves. Canvas CSS dimensions cap at 2048 per
axis, DPR at 2 and backing dimensions at 4096 per axis. These are implementation
limits, not measured FPS or battery claims.

The host retains canvas ownership. `dispose()` removes owned pointer/key/resize/
visibility/media listeners, observers and scheduler subscriptions. It is
idempotent and does not affect other instances. Later mutators are no-ops;
getters remain readable. Construction failure rolls back acquired resources.

## Focused validation

Existing tests remain unchanged in
[`test/seahorse.test.mjs`](../test/seahorse.test.mjs). New coverage is in
[`test/seahorse-director.test.mjs`](../test/seahorse-director.test.mjs), with strict
positive/negative declaration fixtures in
[`species/seahorse/tests`](../species/seahorse/tests).
The eelgrass revision adds [`test/seahorse-eelgrass.test.mjs`](../test/seahorse-eelgrass.test.mjs)
for every-tick moving contact, held preparation, regrip, independent cue phases,
free-route recovery continuity, replay grouping and lifecycle policy.

```bash
npm run build
node --test test/seahorse.test.mjs test/seahorse-director.test.mjs test/seahorse-eelgrass.test.mjs
node node_modules/typescript/bin/tsc -p species/seahorse/tests/tsconfig.types.json
```

The current eelgrass evidence and exact-source results are in
[the revision review](../species/seahorse/EELGRASS-REVIEW.md). The original
director's earlier results are preserved as historical records in
[`species/seahorse/REVIEW.md`](../species/seahorse/REVIEW.md).

The current capture tool runs the actual built Canvas2D adapter in native
Skia Canvas with a fake DOM and deterministic frame source. It produces matched
1280×900 and 390×530 images and a 13-second sequence sampled at 12 fps. These
are native Canvas renders, **not browser screenshots or achieved-FPS evidence**.

Real-browser verification remains blocked in the authoring environment: local
Chromium failed before opening a page because socket creation was denied, and
the cloud browser could not reach the local preview. Physical touch, phone UI
reflow, screen readers, Safari/Firefox and browser performance remain separate
acceptance gates. No WCAG, device-FPS, battery or biological-accuracy claim
follows from numerical and native-render checks.
