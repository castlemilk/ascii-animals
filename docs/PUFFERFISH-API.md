# Pufferfish: explicit typed adapter and optional director

**Current source contract:** checked against [`main` at `f63b20e2045b`](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/src/public/pufferfish.ts) on 21 November 2026. The API below is present in that source. Use the [local-package setup](GETTING-STARTED.md); [current validation](VALIDATION-2026-11-21.md) separates the built package, live Pages and npm availability. Older authoring bases and capture results below are historical evidence, not additional release claims.

## Integrated uplift and compatibility

The integrated fine-spine and recovery uplift was authored from main `b8f222dab868821f27bf2a64a98434f3483fc8e6`, verified on **2026-11-19 UTC**. Public types, factory names, options, validation, input events and lifecycle semantics are unchanged. The revised geometry, material, reef composition and choreography are described in [the uplift brief](../species/pufferfish/UPLIFT-BRIEF.md). Exact-source verification and evidence belong to [the uplift review](../species/pufferfish/UPLIFT-REVIEW.md); earlier director and solo evidence is historical.

`createPufferfishArtwork` is available from `ascii-animals-review/pufferfish` and the package root. Omit `director` to keep the centered solo encounter and its existing configuration defaults. Supplying `director` opts into one to three visitors with individual roles and a shared scene clock.

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

The integrated uplift develops two distinct encounters within those existing scenes and inputs. A reef invitation begins with 30 ticks of braking, then a cautious approach, inspection and backing away into drift. A defensive approach produces a short recoil before belly expansion and spine erection, holds position while guarded, then releases volume across three stages with two hesitation shelves before controlled drift resumes. Default notice/belly/spine/hold/recovery/cooldown durations remain **30 / 42 / 36 / 180 / 150 / 180 ticks**. The recovery shelves are authored animation, not a claim about the timing of real pufferfish recovery.

## Input, snapshots and controls

`invite(x = 0, y = -0.25)` and `approach()` address the selected visitor. `retreat()` clears invitations/proximity and gives the whole scene space; the pure director gives retreat precedence over simultaneous cues and suppresses automatic threat cues for 240 simulation ticks. The `pulse()` factory alias invokes `approach()` but returns `void`. Call `invite`, `approach` or `retreat` directly when you need their `PufferfishActionResult`: `queued`, `static-poster`, or `suspended`.

Coordinates use normalized canvas space: `x` and `y` in `[-1, 1]`, positive right/down. Pointer proximity uses CSS size and aspect, not backing-store DPR. A tap selects the actor that owns the visible cell; a tap in empty water invites the selected actor there. Touch scrolling is not a hover or a completed tap. Pointer leave/cancel, lost capture and window blur clear proximity. Native action buttons provide the same deliberate alternatives without hover.

In director mode with the canvas focused, keys `1`–`3` select an available visitor, `I` invites, `A` approaches, `Escape` gives space, `Space` pauses/resumes and `R` resets. Shortcuts are scoped to the canvas and do not consume form editing. All demo controls also use ordinary keyboard and touch interaction.

`getSnapshot()` returns the selected actor's immutable simulation state. `getDirectorSnapshot()` returns the complete immutable scene simulation, or `null` in solo mode. It includes the resolved configuration, scene tick/beat, actor positions and velocities, motives, gaze, fin effort, threat, invitations and selection. Inspect these snapshots without mutating them.

`getOptions()` returns the configured species settings, including the base seed. Selecting another visitor does not change those settings; that visitor's derived seed belongs to its individual `getSnapshot()` state.

`getStatus()` describes the presented scene. Its `director.actors` summaries include the displayed role, motive, phase and threat, including deliberate still poses. This distinction matters while paused or reduced: an inflated poster can be visible while the simulation snapshot and its tick remain unchanged. Demo labels use the presented status; configuration and replay use simulation snapshots. `onChange` reports meaningful changes and bounded periodic director updates, rather than requiring an extra rendering loop.

The pure exports include `createPufferfishDirector`, `stepPufferfishDirector`, configuration/reset/selection helpers, readonly director/actor/input/result types, and defaults/limits. As with the original model, stepping consumes exactly the next integer tick, with a batch of at most 16 events carrying strictly increasing sequence numbers. Same seed, configuration and ordered tick events produce the same state independently of presentation grouping. Arbitrary serialized snapshot restoration is not an untrusted save-file API.

## Species and rendering options

Species options remain `seed`, `approachRadius`, `retreatRadius`, `dwellTicks`, `bellyTicks`, `spineTicks`, `holdTicks`, `recoveryTicks`, `cooldownTicks`, `inflationScale` and `wobble`. Their established defaults and validation are unchanged; see the pure-model tables in [the original source specification](../species/pufferfish/API.md). Proposal-era package/integration notes in that historical document are superseded by this integrated API page.

Rendering supports:

- `view`: `front`, `left`, `right`; default `right`.
- `quality`: `small` (up to 72 columns), `standard` (up to 120), `fine` (up to 160); library default `standard`, director demo default `fine`. At logical widths up to 520 pixels, both `standard` and `fine` use a 96-column ceiling. That ceiling interpolates to the selected wide-view maximum at 700 pixels. The 90-row ceiling may reduce the effective column count further.
- `mode`: `ascii` or `points`; default `ascii`. Both use the canonical render path.
- `monochrome`: boolean, default `false`.
- `maxDpr`: finite `1…2`, default `2`.

Geometry remains procedural and species-local. The revised animal has an oblong Arothron-inspired resting trunk, disproportionate belly/flank expansion, fixed surface spots, a pale underside and fine skin spinules. The muzzle, lateral iris caps, small fins and short fan tail remain readable as the trunk changes shape. Surface markings stay attached to the stretching skin; they are not randomized each frame. The scene uses bounded ensemble detail with sparse reef relief and particulate depth. Its whole-scene ceiling remains 16,000 samples; the latest reviewed three-actor frame used 15,622. Grid and render limits remain 160×90 cells, 1,200×675 logical pixels and DPR at most 2. These are allocation/work budgets, not a measured FPS claim.

Three-visitor compositions apply a visual geometry multiplier of `0.72` through 520 logical pixels wide, interpolating smoothly to `1` at 700 pixels. Centers stay in the same normalized coordinates; visible-cell selection uses the actual reduced geometry. The private painter reports that multiplier as `sceneScale`. The director's proximity threshold remains a logical interaction radius around the actor center, not an exact pixel-silhouette hit test. Narrow ensemble labels show names; the semantic roster retains roles and motives. This bounded correction addresses the recorded mobile crowding without changing solo geometry.

`exportText()` reads the actual logical glyph grid. In points mode it still returns that character representation; it is not a bitmap-to-text conversion. The demo can show the frame or save it as a `.txt` file. System monospace fonts provide the glyphs; no font asset or copied ASCII drawing is bundled.

## Lifecycle and integration

`paused`, `onChange`, `onError` and an optional borrowed `frameSource` remain mount options. The public factory borrows the existing per-window scheduler used by other artwork. Pufferfish never disposes that scheduler and does not add a loop for each visitor.

Pause, reduced motion, hidden/offscreen state, zero size and compact view suspend independently. Width below 360 or height below 270 CSS pixels uses deliberate still compositions. Reduced motion remains authoritative after `play()`. Selection, invitation, approach and retreat can present still alternatives without advancing time. `invite`/`approach`/`retreat` return `suspended` while hidden or zero-sized; offscreen they can return `static-poster`, but drawing stays suspended until visible. None of these receipts promises an immediate visible render. Fixed-tick catch-up remains capped at five ticks, pending input is coalesced, and stale callbacks cannot restart disposed work.

The original controller names remain available: `configure`, `setPaused`, `reset`, `approach`, `retreat`, `getSnapshot`, `getStatus`, `exportText`, `destroy`. Factory aliases remain `update`, `play`, `pause`, `restart`, `pulse`, `dispose`. Disposal is idempotent; other mutations reject afterwards, while state/status remain inspectable. No seconds-based `advance` alias is invented.

The private painter calls actual canonical `render`, `makeAtlas`, `_put` and `_rasterize` methods without constructing a marine animal or copying a renderer. Future canonical changes must rerun compatibility checks. `npm run build` compiles authoritative `species/pufferfish/src` and generates package modules, species builds and `dist/pufferfish/` with its canonical ESM dependencies. The source demo's legacy-shaped mount is transformed by the Pufferfish-specific builder; the generated integrated demo has no global renderer dependency. The current source build regenerates those outputs; the original species uplift handoff excluded generated files.

## Provenance and acceptance boundary

The historical uplift review used the `b8f222dab868821f27bf2a64a98434f3483fc8e6` base stated above. Its [native capture script](../species/pufferfish/scripts/capture-uplift-native.mjs) records the exact freshly built source/runtime hashes, matched desktop and phone settings, state/cell/pixel hashes and motion excerpts through native Skia Canvas. Those captures are not browser evidence. The separate [real-Chromium harness](../species/pufferfish/scripts/review-uplift.mjs) is supplied for central review, but local Chromium was blocked before loading a page, and the cloud-browser route could not reach the local service and encountered a policy block. No new browser acceptance is claimed. Syntax validation alone is not a pass of the harness or its assertions.

The **earlier shipped director** started from integrated main `c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`, after release `c06114404900884814bef879a02f1a49a3e7d590`. Its [director brief](../species/pufferfish/DIRECTOR-BRIEF.md) records that revision's anatomy, scenes, deterministic inputs, budgets and acceptance gates.

The original recovered handoff had head `35b9e643037ac39b9db18563828beaf7ca2b458a`, tree `88d7136f980b3366439118617fba3045975346fd`, and tested base `0e446c47b491b751d484e40db753ec725652b515`. Only its species paths were integrated. The original renderer hash is retained as historical provenance against a frozen oracle; the current demo uses the canonical module.

The released solo integration received the bounded Chrome review recorded in [visual acceptance](VISUAL-ACCEPTANCE.md), including visible inflation/recovery, mobile and static reduced-motion poses. That is baseline evidence. Original `species/pufferfish/evidence` PNG/GIF captures are historical native-Canvas output. Neither is a new director visual, device-performance, accessibility or cross-browser pass. Director-specific tests/captures and their actual limits must be read separately; source changes or state labels alone do not prove that a scene was visibly accepted.

The package remains private and unpublished. This implementation does not authorize npm publication, deployment or changes to the shared catalogue.

See [uplift review](../species/pufferfish/UPLIFT-REVIEW.md) for that authoring revision's exact commands, evidence and remaining gates. [Director verification](../species/pufferfish/DIRECTOR-VERIFICATION.md) and [director native evidence](../species/pufferfish/evidence/director/README.md) remain historical records of the earlier director revision.
