# Butterfly API — garden director

This extends the newly authored butterfly integrated on main; it does not recover code from an unavailable conversation. The package remains `ascii-animals-review`, private and unpublished. These examples use its existing local package subpath.

## Start a garden

```ts
import {createButterflyArtwork, createButterflyModel} from 'ascii-animals-review/butterfly';

const art = createButterflyArtwork(canvas, {
  columns: 144,
  rows: 68,
  director: {
    scene: 'morning', count: 4, path: 'meadow',
    roles: ['forager', 'scout', 'basker', 'wanderer'],
    sceneSeconds: 32, breeze: 0.2, spread: 1,
    pointerMode: 'attract', showLabels: true
  }
});
art.update({director: {path: 'ribbon', breeze: -0.5}}); // nested merge
art.guide(0.4, -0.2); // normalized logical garden coordinates
art.cue('gather');   // inspect the invitation, then recover
art.release();      // cancel attention/cue; return to the authored scene
art.pause();
art.nextAct();      // a deliberate still composition, never an implicit Play
art.cue('rest');    // folded-wing resting tableau while paused
const {members, actLabel} = art.getGarden();
const sceneDescriptions = art.getScenes(); // deeply frozen labels / four acts
const text = art.getFrame().text;
art.dispose();
```

`createButterflyArtwork`, `createButterflyModel`, `normalizeButterflyOptions` and `BUTTERFLY_DEFAULTS` remain the same named runtime exports. New types are additive. Scene metadata is exposed through `getScenes()` to avoid changing the shared package/root runtime barrel. No new shared registration contract, scheduler, or package export is required.

## Compatibility and defaults

Calling `createButterflyArtwork(canvas)` or `createButterflyModel()` still selects the original single `specimen`. Its `behavior`, `sway`, guide, greeting phases, and logical geometry remain available. Garden direction is opt-in in the library; the demo opts into First light. `specimen` intentionally renders the original one-animal close study; stored director population/roles/path apply when a garden scene is selected.

| Existing option | Default | Valid values |
| --- | --- | --- |
| `columns` / `rows` | `120` / `50` | Integer 80–180 / 32–90 |
| `seed` | `7` | Integer 0–2147483647 |
| `speed` | `1` | 0.25–2 |
| `scale` | `1` | 0.6–1.3 |
| `sway` | `0.18` | 0–0.4; specimen only |
| `facing` | `'left'` | `'left'`, `'right'`; mirrors local anatomy |
| `behavior` | `'hover'` | `'hover'`, `'curious'`, `'perch'`; specimen only |
| `palette` | `'brass'` | `'brass'`, `'lagoon'`, `'rose'` |
| `paused` | `false` | Boolean |
| `reducedMotion` | `'system'` | `'system'`, `'ignore'`; inherited explicit opt-out |

| `director` option | Default | Valid values / meaning |
| --- | --- | --- |
| `scene` | `'specimen'` | `'specimen'`, `'morning'`, `'nectar'`, `'breeze'`, `'roost'` |
| `count` | `1` | Integer 1–6; garden population |
| `path` | `'meadow'` | `'meadow'`, `'ribbon'`, `'spiral'`; affects flight, while feeding/rest acts retain their targets |
| `roles` | `[]` | At most 6 entries: `'auto'`, `'forager'`, `'scout'`, `'basker'`, `'wanderer'` |
| `sceneSeconds` | `32` | 18–60 scene seconds per four-act cycle, before `speed` |
| `breeze` | `0.2` | −1–1; negative is leftward, positive rightward |
| `spread` | `1` | 0.6–1.25; flight-path breadth |
| `pointerMode` | `'attract'` | `'attract'`, `'breeze'`, `'off'` |
| `showLabels` | `false` | Boolean; numbered visitors match the role ledger |

All numbers must be finite; counts, seeds and grid sizes must also be integers. Unknown keys, invalid nested values, sparse role arrays, null settings and unsupported strings reject before mutation. `undefined` leaves the previous setting unchanged. Nested director patches merge; a supplied role array replaces the previous array. Inputs are copied and outputs deeply frozen.

Automatic roles cycle through forager, scout, basker, wanderer, forager, scout. Explicit roles take priority. Roles are tendencies within a scene: a storm's shelter act or a roost's final rest can direct all visitors. Paths do not override feeding/stem targets. Seeded phase and size differences remain individual. Reducing count removes highest IDs; increasing it preserves surviving positions and creates deterministic new IDs. Changing seed rebuilds garden identities. Changing scene restarts the scene arc and clears attention; appearance changes preserve a paused arrangement. Changing scene duration preserves its progress. Changing speed preserves the garden's continuous animation phase.

## Four authored arcs

Each scene repeats four equal-length acts. Role-specific timing and targets make the visitors take different actions within an act.

| Scene | Act 1 | Act 2 | Act 3 | Act 4 |
| --- | --- | --- | --- | --- |
| First light | Forager/basker warm; scout/wanderer are already airborne | Staggered first flight | Forager inspects then feeds; scout explores; wanderer glides; basker rests | Settle into sun |
| Nectar rounds | Follow the scent | Inspect blooms | Sip nectar; scout can depart early | Glide to another bloom |
| Passing breeze | Read the air | Ride an undulating ribbon | Fold into shelter | Inspect and return to flowers |
| Evening roost | Last forage | Lantern-like ascent | Choose individual stems | Fold to rest |

The continuous wing clock is separate from scene progress. `nextAct()` changes the act without advancing the global tick or jumping the wing clock. Live actors ease toward new targets with bounded separation and heading interpolation. The repeat seam retains positions and eases into the next act; it does not teleport the ensemble. These are stylized authored behaviors, not biological simulation claims.

## Inputs and contextual recovery

`guide(x, y)` accepts finite coordinates clamped to −1…1. Browser pointer coordinates are mapped through the canvas CSS rectangle **and** any letterboxing; DPR does not alter input. Pointer motion coalesces to the latest coordinate before each animation callback, with no event queue growth. Automatic pointer motion is ignored while blocked; explicit API/keyboard actions may select a still pose.

Attraction interests nearby foragers/scouts; a basker keeps its place unless it is the only visitor. Breeze produces a local lift and glide. A tap starts the chosen cue at the tap's actual location. A successful touch release, ordinary pointer leave, or lost capture ends pointer attention while allowing the explicit cue to complete. `pointercancel` cancels it. Explicit `release()` cancels attention and cues and starts a 90-tick recovery; while paused it selects a static recovery composition.

| Cue | Live sequence | Total duration | Paused/reduced alternative |
| --- | --- | --- | --- |
| `'gather'` | Inspect the invitation, then recover; baskers remain independent | 300 ticks | Curious visitors gathered around the invitation |
| `'breeze'` | Flutter into the lift → glide → shelter → recover | 300 ticks | Folded shelter pose with character breeze marks |
| `'rest'` | Inspect a stem → perch → recover | 420 ticks | Folded resting visitors on distinct stems |

The same live cue cannot repeatedly reset its own clock. A different cue replaces it; there is no queued backlog. The same cue **can** be retargeted in a still view, because no ticks would otherwise expire it. `ButterflyActivity` distinguishes flower inspection (`target: 'flower', flower`) from invitation inspection (`target: 'invitation'`); `nectar`/`perch` carry a flower ID. Flutter, glide, bask, shelter and recover are separate states.

The demo provides native controls and canvas-scoped keys: arrows move the invitation; Enter offers nectar; B sends breeze; N advances the act; Space toggles pause; Escape releases. Tab is never trapped. Touch keeps `pan-y` scrolling. The role ledger does not announce every frame; user actions have a separate polite status region.

## Model, lifecycle and timing

The pure model adds `getGarden()`, `getScenes()`, `cue(action, poster?)`, `nextAct(poster?)` and `release()`. Existing `configure`, `advanceTicks`, `guide`, `greet`, `reset`, `frame`, getters and `ButterflyPhase = 'idle' | 'approach' | 'display' | 'settle'` remain intact. Legacy response boundaries remain 45/110/180 ticks. New act names never widen that existing phase union.

`advanceTicks(n)` accepts integers 0–600. Equal engine version, seed, options, ordered inputs and integer ticks produce equal logical cells and state, including when advances are partitioned differently. This does not promise equal pixels across fonts or engines, equal physical mouse recordings, cross-version restoration, or a serialized replay-file API.

The browser adds `getGarden()`, `getScenes()`, `cue`, `nextAct` and `release` to its existing methods. It borrows the shared per-window scheduler or a caller-owned `frameSource`. It never disposes that source. Catch-up remains capped at six ticks per callback and 0.1 s; excess time is exposed as `droppedSeconds`. Pause, reduced motion, hidden document, offscreen, zero size and disposal are independent blocking causes. Resume resets the wall-clock accumulator. Reset preserves options and requested pause while clearing ticks, inputs, cue, cycle and seeded state. Disposal is idempotent; later mutations are no-ops, and listeners/observers/subscriptions are removed. Importing the package does not access the DOM; only mounting requires a browser canvas.

System reduced motion remains authoritative even after Play, updates, reset or cues. A still garden has useful scene/act/cue choices. The demo's separate 250 ms status timer stops while hidden and on pagehide; non-persisted teardown removes its listeners. No framework adapter is introduced or certified.

## Rendering and budgets

A single shared grid holds at most 180×90 = **16,200 cells**. The garden has at most **6 actors**, **6 flowers**, **22 pollen marks** and **3×23 breeze samples**. There is no unbounded particle pool or input queue. Per-actor inverse rasterization is limited to its local cell rectangle. Backing dimensions remain at most 2048×2048 CSS pixels with DPR capped at 2 (4096×4096 backing pixels).

The renderer emits printable ASCII only, preserves a 0.56 cell aspect through letterboxing, and keeps anatomy attached through opening and rotation. Numbered colors identify individuals; palette treatment applies throughout the garden. A garden-only LOD floor gives fully open forewings about 13 columns at sparse settings; folded wings are intentionally narrower. Conservative edge fitting insets the visual root and label at extreme positions/scales. `getGarden()` reports intended normalized simulation positions, before this visual fitting. The world is not a pixel-accurate picking API.

The text export is the logical character grid, not a terminal emulator. Canvas pixels use the installed monospace fallback; no fonts or external images are bundled. The demo exports a PNG and plain text. Video recording/export, an alternative particle renderer, and framework wrappers are not implemented by this change.

## Validation and remaining gates

See [the authoring/review record](BUTTERFLY-DIRECTOR-REVIEW.md) and the handoff validation manifest for exact commands, hashes and evidence categories. Numerical and lifecycle tests are separate from actual browser validation.

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
node node_modules/typescript/bin/tsc -p species/butterfly/tests/tsconfig.json
node --test test/butterfly.test.mjs test/butterfly-director.test.mjs
npm run check:package
# Optional, in a normal environment with installed Playwright/Chromium:
node species/butterfly/tests/browser-check.mjs
# Native Canvas pixel evidence, not browser proof; requires @napi-rs/canvas:
node species/butterfly/tests/render-native.mjs
```

This review environment blocked a normal Chromium launch with `socket() failed: Operation not permitted`; its cloud browser could inspect the live reference but could not reach the local demo. The supplied images are **native Canvas renders through the real renderer with a simulated lifecycle host**. They do not prove CSS reflow, real browser keyboard/touch, screen-reader behavior, phone usability, memory behavior or performance. Browser/device acceptance remains a coordinator gate; no FPS or WCAG certification is claimed.
