# Fox / Dusk in the Meadow

An original TypeScript Fox with pointed ears, a long muzzle, four articulated legs and a pale-tipped bushy tail. The integrated character supports cautious stalking/sniffing and a captured **crouch → airborne → forepaw landing → recovery → cooldown** response. The opt-in meadow director adds attentive ears/head, expressive tails, rest poses and three authored scenes.

**Review base:** main **`b8f222dab868821f27bf2a64a98434f3483fc8e6`**, verified on 19 November 2026, already includes the director. This candidate improves the fox's coat, paw loading and directed sequences inside `species/fox/`. Shared engines, package entry points and workflows are unchanged. This is a review candidate, not a deployment claim. The public guide remains [docs/FOX-API.md](../../docs/FOX-API.md).

## Dusk coat and directed movement

The [dusk authoring record](DUSK-AUTHORING.md) records the reference observations,
rights and fixed budgets. A darker back and shoulders sit over a warm flank;
attached coat ribbons follow the low-carried brush into its pale tip. Layered
grass banks and a distant ridge leave the animals an open lane. Phone layouts
give one or two foxes wider lanes so coat and paw separation remain readable.

`rustle` now gives the fox time to triangulate with its ears, creep, plant and
sniff before the captured pounce. `play` raises the tail first, holds the current
head for 20 ticks, then follows with head/ears, shoulder bow, careful steps and
an answering hop. The hunt/play takeoff preparations still start at cue ages
205/130 ticks. Both finish their response and settle before accepting another
invitation. Tail-first curiosity is an authored expression, not a claim that
the exact timing reproduces observed animal behaviour.

Paws already planted ahead now bear weight until the body catches up; scene
anchors no longer drift independently beneath stationary feet. These are
intentional motion/pose changes, so historical exact-pose/cell parity scripts
against the earlier fox are not acceptance gates for this revision. Same-source
seeded replay, the public typed contract and its validation policies remain.

See the [dusk review evidence](evidence/dusk/README.md) for matched desktop/phone
native renders, both motion sequences, exact validation and the open browser
and device-performance gates.

## Try this branch

From the repository root:

```sh
npm ci --ignore-scripts
npm run build
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8000/fox/`. This serves the integrated demo generated from the canonical Fox TypeScript and uses the actual public adapter/shared scheduler. The source study demo remains under `species/fox/demo/` when serving the repository root.

Choose **Dusk hunt**, **Moonlit mischief**, or **Den watch**; direct Ember, Pip or Bracken; assign a motive; and make a localized invitation. Count is bounded to 1–3. Pointer movement attracts attention; holding a guide permits investigation. Click/tap creates a local rustle. The demo includes native scene/cast/role controls, tempo/curiosity/wind/spread, pause/reset, deliberate still tableaux, actual ASCII text capture and browser PNG capture.

With the canvas focused, arrows guide, Enter rustles, C invites tail curiosity, P pounces, Space pauses and Escape clears the guide. The **Tail curiosity** button exposes the second sequence in every scene without requiring a hover or keyboard shortcut. The equivalent labeled controls work without canvas keyboard commands. Reduced motion remains authoritative; it offers listen, pre-leap crouch and rest tableaux. No action silently resumes animation. Canvas failure exposes a static text specimen.

## Public API: keep the single Fox or opt into the director

The package is private and unpublished. These imports refer to a locally built `ascii-animals-review` package/tarball.

```ts
import { createFoxArtwork } from 'ascii-animals-review/fox';

// Existing consumer: original single-character behavior is retained.
const solo = createFoxArtwork(soloCanvas, {
  fox: { seed: 17, facing: 'right', pounceHeight: .24 },
});

// Existing director API: an explicit director option enables the composed meadow.
const meadow = createFoxArtwork(meadowCanvas, {
  fox: { seed: 17 },
  director: { scene: 'dusk-hunt', count: 2, roles: ['hunter', 'lookout'] },
});

// Use these in deliberate control handlers after the mount becomes visible.
function inviteEmber() {
  meadow.selectFox(0);
  meadow.cue('rustle', 0, { x: .45, y: .35 });
}
function showAStill() { meadow.showTableau('rest'); }
function dispose() { solo.dispose(); meadow.dispose(); }
```

`getState()` retains the original `FoxState` shape and reports the primary actor in director mode. `getDirectorState()` reports the cast, motives, selected ID, global scene clock and individual model clocks; it returns `null` for a single-Fox mount. New director helpers/types are available at **`ascii-animals-review/fox`**, not added to the package root. The existing factory's root export remains supported.

The full director API/defaults/behavior table, replay example, lifecycle and integration boundaries are documented in [the public Fox guide](../../docs/FOX-API.md). The mode is chosen at mount time: `director: {}` enables defaults; omitting it preserves the original mode. Director mutation methods on a single-Fox mount throw instead of silently changing its mode.

### Scenes and configuration

| Scene | What it composes | Automatic motives |
|---|---|---|
| `dusk-hunt` | Listen, track/sniff, crouch/leap/land, settle; a lookout gives the hunter space | Hunter, lookout, playmate |
| `moon-play` | Tail-led attention, play bows, measured steps and staggered answering hops | Playmate, playmate, lookout |
| `den-watch` | Tucked rest beside a listening sentinel | Dreamer, lookout, dreamer |

Director defaults are `scene: 'dusk-hunt'`, `count: 2`, `pace: 1`, `curiosity: .7`, `wind: .3`, `spacing: 1`, `showLabels: true`, `roles: ['auto','auto','auto']`. Accepted ranges are count 1–3, pace .5–1.5, curiosity 0–1, wind −1–1 and spacing .8–1.15. Roles are `auto`, `hunter`, `playmate`, `lookout` or `dreamer`; at most three entries, including spare entries retained for absent actors. Scene/role names, booleans and finite numeric bounds are validated atomically; malformed/unknown fields and sparse arrays reject.

Stable IDs 0/1/2 name Ember/Pip/Bracken. Surviving actors retain identity/model clocks through count changes; newly added actors start their own model clock at zero. Non-scene settings retain simulation clocks. Changing scene restarts the authored scene clock and clears interest while preserving global tick, settings, seed and pause. Reset restores global/actor clocks, selection and transient state while retaining configuration and user pause.

`pace` changes the 1,800-authored-tick scene cycle, not the underlying 60 Hz fixed-tick domain or a captured leap. Explicit cues temporarily direct one actor; an investigating/reacting actor ignores another cue until it can respond. Companions can notice and answer a play invitation after a bounded delay. The style is authored and expressive, not a claim of biological gait fidelity.

## Headless original model

The original headless factory is still supported through `ascii-animals-review/fox`. Canonical local imports for source work are shown here:

```ts
import { createFox } from './species/fox/lib/model.js';
import type { FoxInput, FoxStepResult } from './species/fox/lib/types.js';

const fox = createFox({ seed: 17, facing: 'right', pounceHeight: .24 });
const guidance = [
  { type: 'guide', tick: 1, seq: 0, x: .8, y: .15 },
] as const satisfies readonly FoxInput[];
const result: FoxStepResult = fox.step(1, guidance);
if (result.kind === 'advanced') console.log(result.state.behavior.kind);
fox.step(2, [{ type: 'pounce', tick: 2, seq: 1 }]);
fox.configure({ tailSway: .1 });
const pose = fox.getPose();
fox.setPaused(true);
fox.reset();   // Retains options and pause.
fox.dispose(); // Idempotent; other model operations now reject.
```

`FoxSpecies`, `FoxOptions`, `FoxInput`, `FoxState`, `FoxBehavior`, `FoxStepResult` and `FoxPose` remain explicit. The original behavior union is unchanged. State/options snapshots are recursively frozen; geometry sampling returns detached geometry. The source example and type fixtures are in [examples/typed-usage.ts](examples/typed-usage.ts) and [tests/types/contract.ts](tests/types/contract.ts).

| Method | Original model semantics |
|---|---|
| `createFox(options?)` | Seed 17, tick 0, idle, unpaused. Seed is uint32. |
| `step(tick, inputs?)` | Exactly the next integer tick, at most 16 events, atomic batch validation. Paused steps validate but consume neither tick nor input. |
| `configure(patch)` | Validate before mutation. Keep clock/sequence/pause. Captured pounce settings remain active through cooldown; later morphology changes replant paws safely. |
| `getState()` / `getOptions()` | Frozen snapshots, independent of clock/DOM reads. |
| `getPose()` | Original normalized geometry, four articulated joint chains and named silhouette anchors. |
| `setPaused(boolean)` / `isPaused()` | Explicit playback policy. |
| `reset(seed?)` | Clear time, input sequence, guide, response and feet; retain options/pause. Omitted seed repeats current seed. |
| `dispose()` | Idempotent. Other headless model methods reject afterward. |
| `staticFoxPose(options?, pose?)` | Deterministic `idle`, `sniff` or `crouch`; does not advance a live model. |
| `normalizeFoxPointer(x,y,rect)` | CSS coordinates to finite clamped `[-1,1]` values. Native DOMRect is accepted; nonpositive size returns null. |

## Animal configuration

These options belong in browser `fox`, headless `createFox`, or a `configure`/`update` animal patch. Unknown fields, explicit undefined option values, nonfinite numbers, numeric strings, fractional duration ticks and out-of-range settings reject. Seed and initial pause are creation settings, not anatomy update properties.

| Option | Default | Accepted values | Meaning |
|---|---:|---|---|
| `facing` | `right` | `left`, `right` | Side profile; director locomotion may later turn individual actors |
| `scale` | .70 | .58–.72 | Anatomy scale within normalized model bounds |
| `breathing` | .009 | 0–.025 | Local torso amplitude |
| `tailSway` | .075 | 0–.16 | Independent tail motion amplitude |
| `stalkSpeed` | .0018 | .0005–.004 | Maximum root travel per tick before easing |
| `sniffDepth` | .045 | 0–.10 | Bounded muzzle lowering |
| `pounceDistance` | .20 | .08–.30 | Requested travel, limited by guide and model bounds |
| `pounceHeight` | .24 | .10–.34 | Model-space arc height |
| `crouchTicks` | 24 | Integer 12–60 | Anticipation duration |
| `airTicks` | 36 | Integer 20–60 | Flight duration |
| `landingTicks` | 12 | Integer 8–30 | Forepaw-first absorption |
| `recoveryTicks` | 36 | Integer 12–90 | Settling duration |
| `cooldownTicks` | 72 | Integer 30–180 | Repeated-pounce suppression |

The model's root remains at x = −.2….2, with ground at y = .55; positive y points down. Each model pose remains in `[-1,1]`. The director composes these original poses using a separate scene transform, expression and ownership grid rather than expanding the original model contract into a shared renderer. Resting scene paths hold their position; body/tail expression remains local. Supported facing is left/right only.

## Deterministic director and replay

`createFoxDirector`, `FoxDirectorOptions`, `FoxDirectorState`, `FoxDirectorInput`, `FoxActorIntent`, `FoxDirectorFrame` and related types are exported by the existing `./fox` subpath. Director state has its own schema/version and never adds new variants to the legacy `FoxBehavior` union.

Headless director events are `guide`, `leave`, `select` and `cue`, each with the next integer `tick` and increasing `seq`. Cues are `rustle`, `pounce`, `play`, `rest`; optional IDs must reference a present actor and optional coordinates must be supplied together. Finite coordinate overflow clamps to the normalized range. Whole batches validate before mutation; maximum batch size is 16.

`getFrame('listen' | 'pounce' | 'rest')` is pure: it neither changes state nor advances a clock. **The `pounce` tableau depicts the pre-leap crouch.** Browser `showTableau` additionally sets user pause. Browser `selectFox` and headless `select` change selection immediately without changing tick/sequence, while a tick-stamped `select` event belongs in the deterministic input log.

`onDirectorInputs` records consumed normalized director batches, including generated leave events; legacy `onInputs` applies only to single-Fox mode. Record immediate selection, configuration, pause/reset operations separately if reproducing a complete interactive session. Fixed same-version seed/options/event/edit sequences reproduce model state and cells across rendering groups. No arbitrary seek/state restore, cross-platform font-pixel identity or equivalence of independently recorded pointer sessions is promised.

## Rendering, ownership and accessibility

Original single-Fox grids retain their defaults of 112×44 (80×32 on narrow hosts), with integer columns 80–160 and rows 32–64. Director grids use **160×64** by default or **112×64** below 640 CSS pixels, accepting integer columns **112–160** and rows **48–64**. `monochrome` defaults false. Grid choices are mount-time settings. Physical cells preserve a 1:2 ratio with letterboxing; narrow casts use stacked depth lanes.

Each pose has at most 48 polygons/1,024 vertices; the cast bounds total geometry at 144 polygons/3,072 vertices. Scene cells are bounded at 10,240. `maxAccents = 48` means **48 grass stems**, with up to 16 tips and separately fixed horizon/moon/star scenery plus bounded contact/cue marks. It is not a claim of only 48 total background glyphs. There are no growing particle/trail pools.

`createFoxArtwork` borrows the integrated per-window scheduler; an explicit `frameSource` may supply `subscribe(timestampMsCallback): unsubscribe`. A meadow uses one subscription, and disposal releases only that subscription. Direct internal `mountFox` retains its one-RAF fallback when no source is supplied. Backing storage is capped at 1280×768 logical pixels and DPR≤2. At most five simulation ticks run per frame, and dropped wall time is reported.

User pause, reduced motion, hidden document, offscreen and zero size independently block automatic work. Resumption resets the wall-time accumulator. Suspension clears transient input; a consumed policy leave can clear stale guidance. Repeated disposal and stale callbacks are inert; setup/callback failures release owned resources. Module import remains SSR-safe; mounting requires Canvas 2D and observers.

Use the demo's native labeled controls and description for interaction without pointing. Canvas-specific keyboard handling runs only when focused. User-action announcements are separate from non-live scene telemetry. Reduced motion cannot be overridden by pointer activity or `play()`, and still actions do not advance simulation. Text export uses textContent, not HTML. Browser PNG capture saves the currently rendered canvas; it does not imply that video recording or a particular device's performance has been tested.

## Source and validation

- Canonical source: `species/fox/src/`; generated local modules: `species/fox/lib/`.
- Integrated package adapter: `src/public/fox.ts`; declaration bridges: `src/species/fox/`.
- `scripts/build-fox.mjs` produces `lib/species/fox/` and `dist/fox/` from those sources.
- [Director authoring record](DIRECTOR-AUTHORING.md), [new runtime tests](tests/director.test.mjs), and [director type fixtures](tests/types/director.ts).
- [Public API guide](../../docs/FOX-API.md) for exact controller configuration/reset/disposal behavior and replay examples.

From the repository root:

```sh
npm run build
npm run typecheck
node --test test/fox-integration.test.mjs test/fox-director-integration.test.mjs species/fox/tests/*.test.mjs
```

The original [AUTHORING.md](AUTHORING.md), [COMPATIBILITY.md](COMPATIBILITY.md), [REVIEW.md](REVIEW.md), [VALIDATION.md](VALIDATION.md), and `evidence/native-fox-replay.gif` preserve the earlier single-Fox authoring history. Their original integration-pending/proposal statements are historical and are superseded for current package integration by the main source and public API guide. Their numerical/mock/native evidence does not establish acceptance of the new director.

Final director test results, before/after rendered critique and unrun gates belong in the new handoff evidence. This README does not claim final browser, accessibility or performance acceptance. Native Canvas output, browser output, explicit mocks and numerical/compiler checks must remain distinct. No merge, deployment or npm publication is implied by the branch documentation.
