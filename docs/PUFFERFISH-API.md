# Pufferfish: explicit typed adapter and optional director

`createPufferfishArtwork` is available from `ascii-animals-review/pufferfish` and the package root. Omit `director` to keep the original centered solo encounter and its existing defaults. Supplying `director` opts into one to three visitors with individual roles and a shared scene clock.

```ts
import { createPufferfishArtwork } from 'ascii-animals-review/pufferfish';

const art = createPufferfishArtwork(canvas, {
  species: { seed: 23, inflationScale: 1.65, wobble: 1 },
  director: {
    scene: 'reef', count: 2, roles: ['explorer', 'sentinel'],
    tempo: 1, current: 0.35, curiosity: 0.75,
    size: 1, spacing: 1, labels: true,
  },
  render: { view: 'right', quality: 'fine', mode: 'ascii', maxDpr: 2 },
});

art.selectActor(1);          // dense, zero-based ID; no simulation tick advances
art.invite(0.25, -0.2);      // a calm invitation in normalized canvas coordinates
art.approach();              // selected visitor notices, then inflates in stages
art.retreat();               // give the whole group room to recover
art.pause();
art.pulse();                 // deliberate static inflated pose; never resumes playback
art.configureDirector({ scene: 'current', current: -0.5 }); // fresh scene, still paused
art.configureRender({ mode: 'points' }); // preserve simulation state
art.restart();               // keep current configuration and user pause
art.dispose();               // idempotent; borrowed scheduler remains available
```

Pufferfish has its own immutable 60 Hz model and deliberate still poses. It is not a value for the marine `createArtwork` factory. The browser adapter uses the canonical marine renderer privately; no public geometry registration API is implied. Importing modules reads no browser globals. Mount only after sizing a browser Canvas2D.

## Director configuration

The following defaults apply when director mode is enabled, including `director: {}`. They do not change the default solo factory call.

| Option | Default | Accepted values / meaning |
| --- | --- | --- |
| `scene` | `'reef'` | `'reef'`, `'current'`, or `'shadow'` |
| `count` | `2` | Integer `1…3`; actor IDs are `0…count−1` |
| `tempo` | `1` | Finite `0.5…1.5`; scales scene choreography, not inflation/recovery timing |
| `current` | `0.35` | Finite `−1…1`; negative flows left, positive right, zero is still |
| `curiosity` | `0.75` | Finite `0…1`; influences exploration and invitation response |
| `spacing` | `1` | Finite `0.8…1.2`; separation within the bounded composition |
| `size` | `1` | Finite `0.8…1.1`; object size, separate from inflation |
| `labels` | `true` | Boolean; display individual labels |
| `roles` | `['explorer', 'sentinel']` | Readonly array with exactly `count` entries; each `'explorer'`, `'sentinel'`, or `'drifter'` |

When roles are omitted, their order is explorer, sentinel, drifter, truncated to count. Changing count without supplying roles regenerates those defaults. Repeated roles are allowed. Unknown keys, explicit `undefined`, invalid enums, non-finite values, out-of-range values, non-integer count and wrong-length role arrays reject before applying changes. Caller arrays are copied into immutable configuration.

`configureDirector(patch)` starts a fresh deterministic scene and clears transient interaction. It enables the director if the controller was previously solo. It preserves user pause, species settings and rendering settings. Population changes reset actor identities. `configure`/`update` start a fresh run with the current director configuration; `reset(seed?)`/`restart()` preserve it too. Render changes through `configureRender` preserve the simulation.

### Three scenes

- **Reef ramble (`reef`):** discovery, closer inspection, gathering and rest. Explorers seek new places, sentinels keep watch, and drifters move more quietly.
- **Returning tide (`current`):** rising flow, shelter, a return into the current and slack water. Current direction and strength alter movement and fin effort.
- **Passing shadow (`shadow`):** watchfulness, a passing threat, release and resumed exploration. A local defensive reaction occurs at most once per scene cycle. Explicit retreat gives the group a quiet interval.

A cycle spans 1,200 scene ticks. At tempo 1 that is 20 simulated seconds. Actor movement approaches targets with bounded velocity. Each actor retains the original deliberate dwell, belly inflation, short-spine extension, hold, recovery and cooldown. Scene tempo does not shorten those safety timings. There is no growing pulse, particle or action queue.

## Input, snapshots and controls

`invite(x = 0, y = -0.25)` and `approach()` address the selected visitor. `retreat()` clears invitations/proximity and gives the whole scene space; the pure director gives retreat precedence over simultaneous cues and suppresses automatic threat cues for 240 simulation ticks. The `pulse()` factory alias remains an approach. These actions return a discriminated `PufferfishActionResult`: `queued`, `static-poster`, or `suspended`.

Coordinates use normalized canvas space: `x` and `y` in `[-1, 1]`, positive right/down. Pointer proximity uses CSS size and aspect, not backing-store DPR. A tap selects the actor that owns the visible cell; a tap in empty water invites the selected actor there. Touch scrolling is not a hover or a completed tap. Pointer leave/cancel, lost capture and window blur clear proximity. Native action buttons provide the same deliberate alternatives without hover.

With the canvas focused, keys `1`–`3` select an available visitor, `I` invites, `A` approaches, `Escape` gives space, `Space` pauses/resumes and `R` resets. Shortcuts are scoped to the canvas and do not consume form editing. All demo controls also use ordinary keyboard and touch interaction.

`getSnapshot()` returns the selected actor's immutable simulation state. `getDirectorSnapshot()` returns the complete immutable scene simulation, or `null` in solo mode. It includes the resolved configuration, scene tick/beat, actor positions and velocities, motives, gaze, fin effort, threat, invitations and selection. Inspect these snapshots without mutating them.

`getOptions()` returns the configured species settings, including the base seed. Selecting another visitor does not change those settings; that visitor's derived seed belongs to its individual `getSnapshot()` state.

`getStatus()` describes the presented scene. Its `director.actors` summaries include the displayed role, motive, phase and threat, including deliberate still poses. This distinction matters while paused or reduced: an inflated poster can be visible while the simulation snapshot and its tick remain unchanged. Demo labels use the presented status; configuration and replay use simulation snapshots. `onChange` reports meaningful changes and bounded periodic director updates, rather than requiring an extra rendering loop.

The pure exports include `createPufferfishDirector`, `stepPufferfishDirector`, configuration/reset/selection helpers, readonly director/actor/input/result types, and defaults/limits. As with the original model, stepping consumes exactly the next integer tick, with a batch of at most 16 events carrying strictly increasing sequence numbers. Same seed, configuration and ordered tick events produce the same state independently of presentation grouping. Arbitrary serialized snapshot restoration is not an untrusted save-file API.

## Species and rendering options

Species options remain `seed`, `approachRadius`, `retreatRadius`, `dwellTicks`, `bellyTicks`, `spineTicks`, `holdTicks`, `recoveryTicks`, `cooldownTicks`, `inflationScale` and `wobble`. Their established defaults and validation are unchanged; see the pure-model tables in [the original source specification](../species/pufferfish/API.md). Proposal-era package/integration notes in that historical document are superseded by this integrated API page.

Rendering supports:

- `view`: `front`, `left`, `right`; default `right`.
- `quality`: `small` (72 columns), `standard` (120), `fine` (160); library default `standard`, director demo default `fine`.
- `mode`: `ascii` or `points`; default `ascii`. Both use the canonical render path.
- `monochrome`: boolean, default `false`.
- `maxDpr`: finite `1…2`, default `2`.

The original sample geometry remains parametric: round bodies, readable eyes, broad fins, short tails and radial spines. The scene uses bounded ensemble detail and original sparse reef geometry, with a whole-scene ceiling of 16,000 samples. Grid and render limits remain 160×90 cells, 1,200×675 logical pixels and DPR at most 2. These are allocation/work budgets, not a measured FPS claim.

Three-visitor compositions apply a visual geometry multiplier of `0.72` through 520 logical pixels wide, interpolating smoothly to `1` at 700 pixels. Centers stay in the same normalized coordinates; visible-cell selection uses the actual reduced geometry. The private painter reports that multiplier as `sceneScale`. The director's proximity threshold remains a logical interaction radius around the actor center, not an exact pixel-silhouette hit test. Narrow ensemble labels show names; the semantic roster retains roles and motives. This bounded correction addresses the recorded mobile crowding without changing solo geometry.

`exportText()` reads the actual logical glyph grid. In points mode it still returns that character representation; it is not a bitmap-to-text conversion. The demo can show the frame or save it as a `.txt` file. System monospace fonts provide the glyphs; no font asset or copied ASCII drawing is bundled.

## Lifecycle and integration

`paused`, `onChange`, `onError` and an optional borrowed `frameSource` remain mount options. The public factory borrows the existing per-window scheduler used by other artwork. Pufferfish never disposes that scheduler and does not add a loop for each visitor.

Pause, reduced motion, hidden/offscreen state, zero size and compact view suspend independently. Width below 360 or height below 270 CSS pixels uses deliberate still compositions. Reduced motion remains authoritative after `play()`. Selection, invitation, approach and retreat can present still alternatives without advancing time; hidden/offscreen/zero-size actions are suspended. Fixed-tick catch-up remains capped at five ticks, pending input is coalesced, and stale callbacks cannot restart disposed work.

The original controller names remain available: `configure`, `setPaused`, `reset`, `approach`, `retreat`, `getSnapshot`, `getStatus`, `exportText`, `destroy`. Factory aliases remain `update`, `play`, `pause`, `restart`, `pulse`, `dispose`. Disposal is idempotent; other mutations reject afterwards, while state/status remain inspectable. No seconds-based `advance` alias is invented.

The private painter calls actual canonical `render`, `makeAtlas`, `_put` and `_rasterize` methods without constructing a marine animal or copying a renderer. Future canonical changes must rerun compatibility checks. `npm run build` compiles authoritative `species/pufferfish/src` and generates `dist/pufferfish/` with its canonical ESM dependencies. The source demo's legacy-shaped mount is transformed by the Pufferfish-specific builder; the generated integrated demo has no global renderer dependency.

## Provenance and acceptance boundary

This director starts from current integrated main `c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`, after release `c06114404900884814bef879a02f1a49a3e7d590`. It extends the integrated species rather than replaying the historical handoff branch. The pre-implementation [director brief](../species/pufferfish/DIRECTOR-BRIEF.md) records anatomy, scenes, deterministic inputs, budgets and acceptance gates.

The original recovered handoff had head `35b9e643037ac39b9db18563828beaf7ca2b458a`, tree `88d7136f980b3366439118617fba3045975346fd`, and tested base `0e446c47b491b751d484e40db753ec725652b515`. Only its species paths were integrated. The original renderer hash is retained as historical provenance against a frozen oracle; the current demo uses the canonical module.

The released solo integration received the bounded Chrome review recorded in [visual acceptance](VISUAL-ACCEPTANCE.md), including visible inflation/recovery, mobile and static reduced-motion poses. That is baseline evidence. Original `species/pufferfish/evidence` PNG/GIF captures are historical native-Canvas output. Neither is a new director visual, device-performance, accessibility or cross-browser pass. Director-specific tests/captures and their actual limits must be read separately; source changes or state labels alone do not prove that a scene was visibly accepted.

The package remains private and unpublished. This implementation does not authorize npm publication, deployment or changes to the shared catalogue.

See [director verification](../species/pufferfish/DIRECTOR-VERIFICATION.md) for the current test results and remaining gates, and [native evidence](../species/pufferfish/evidence/director/README.md) for actual rendered artifacts and the bounded critique loop.
