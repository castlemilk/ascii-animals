# Gecko director — a little world after dark

This opt-in Gecko extension was authored against main **`c06114404900884814bef879a02f1a49a3e7d590`**. It gives Mica, Pip and Slate different reasons to move through an original nighttime wall. Each visitor still uses the existing Gecko model, analytic geometry, attached tail, contact gait and glyph raster. The director supplies goals and scene timing; it does not drag planted feet with a separate scene transform.

The [completed authoring brief](AUTHORING.md) records the design, references and acceptance targets. The [base manifest](base-manifest.json) records source hashes. Runtime contracts are in [`director.ts`](../src/director.ts), [`browser.ts`](../src/browser.ts), [`types.ts`](../src/types.ts) and the existing [`Gecko public facade`](../../../src/public/gecko.ts). The [package API guide](../../../docs/GECKO-API.md) preserves the solo interface.

## Mount through the existing typed facade

```ts
import {
  createGeckoArtwork,
  type GeckoDirectorActionResult,
  type GeckoDirectorOptionsPatch,
} from 'ascii-animals-review/gecko';

declare const canvas: HTMLCanvasElement;
const options: GeckoDirectorOptionsPatch = {
  scene: 'moonlit-wall', population: 3, tempo: 1, boldness: .55,
  roles: ['scout', 'hunter', 'sentry'],
  reverse: false, showRoutes: false, autonomy: true,
};
const wall = createGeckoArtwork(canvas, {
  config: { seed: 37 },
  director: options,
  view: { grid: 'auto', neutral: false, maxDpr: 2 },
});
wall.selectGecko('pip');
const action: GeckoDirectorActionResult = wall.direct({
  type: 'moth', id: 'pip', x: .25, y: -.2,
});
wall.configureDirector({ tempo: .8, showRoutes: true });
wall.pause();
wall.direct({ type: 'shadow', id: 'mica' }); // a still composition, no tick
wall.reset(); // keeps configuration and explicit pause
wall.dispose();
```

Omitting `director` retains the original solo. `{ director: {} }` selects director defaults. The page's three-resident presentation is an example configuration, not a new default for all Gecko consumers. The package remains private and UNLICENSED; the extension is review code, not an npm publication or a shared-species contract accepted on behalf of the other animals.

### Configuration defaults and validation

| Director option | Default | Accepted values / effect |
| --- | --- | --- |
| `scene` | `'moonlit-wall'` | `'moonlit-wall'`, `'lantern-hunt'`, `'passing-shadow'` |
| `population` | `3` | Integer 1–3; stable order `mica`, `pip`, `slate` |
| `tempo` | `1` | Finite `.4–1.6`; score rate and bounded gait pace |
| `boldness` | `.55` | Finite `0–1`; investigation duration and nearby-shadow sensitivity |
| `roles` | `['scout', 'hunter', 'sentry']` | One to three known roles; missing trailing slots use the corresponding defaults |
| `reverse` | `false` | Reverse authored route progression |
| `showRoutes` | `false` | Draw route guides in the wall raster |
| `autonomy` | `true` | Advance the scene score and autonomous goals; explicit cues still work when false |

Option/config/event objects reject unknown keys. Director options require actual booleans, known enum strings and finite numbers inside their ranges; an explicit `undefined` in an options patch is invalid. `GeckoDirectorOptionsPatch` and runtime validation are both part of the contract. The constructor accepts `{ seed?, heading?, options?, animal? }`: seed is uint32, default `37`; an optional common heading is finite in `[-π, π]`. Without it, the three original headings are `-1.3`, `-.7`, and `2.65` radians. Per-member seeds are derived deterministically from the scene seed.

Director animal defaults use the existing artistic options with `creepSpeed: .15`, `turnRate: .95`, and `stepTicks: 15`. All other defaults and bounds are the [original Gecko options](../README.md#types-defaults-and-validation). `tempo` adjusts member speed, turn rate and step duration within those bounds; Slate also uses a `.85` speed factor. `updateAnimal` changes the shared base animal settings, then resolves each member's pace. On a browser mount, use `update` for that same operation and `configureDirector` for the scene options.

The director owns member habitats and their constant scales. Its headless constructor has no `habitat` field. A director browser mount rejects `config.habitat`; director reset accepts only seed and heading. Solo configuration/reset retains its separate habitat extension.

## Scenes are intentions; the feet decide the outcome

| Scene | Ordered score | Nominal cycle at tempo 1 |
| --- | --- | --- |
| Moonlit wall | emerge → climb → inspect → traverse → perch | 1,440 simulation ticks / 24 seconds |
| Lantern hunt | notice → stalk → poise → strike → return | 1,320 simulation ticks / 22 seconds |
| Passing shadow | peek → explore → shadow → shelter → return → settle | 1,440 simulation ticks / 24 seconds |

These seconds describe simulation time. A browser can discard excess elapsed time after a stall. `arc.progress` measures the current beat, not the whole cycle; `beatIndex` and `cycle` are zero-based. `scoreTick` advances by `tempo` per simulation tick only while autonomy is enabled. A loop does not teleport bodies back to their initial poses and does not promise identical first/last pixels.

The score selects goals and opportunities. Individual `motive`, `emotion`, `goal`, actual `body.behavior`, and `catches` describe what a visitor is doing. A hunter does not catch the moth merely because the score says `strike`: its real head must be close and facing the moth during a strike opportunity. A distant or badly aligned visitor can miss and try again. Inspection and settlement likewise depend on reaching a goal; a score label is not proof of arrival. The first active `hunter` owns the automatic lantern hunt, falling back to the first visitor if no hunter is assigned. A deliberate moth cue can give another named visitor an interest.

A selected shadow can produce a delayed reaction in nearby neighbours. Cooldowns are independent and measured in simulation ticks. A busy shadow does not restart or prolong the recipient's recovery. A return cue sets a home goal; it does not move the body there instantly. Routes yield around nearby residents while the original joint/contact rules continue to govern movement. This is a stylized in-plane wall study, not a new perspective-anatomy renderer or a collision-physics claim.

## Inputs, ownership and result types

| Browser operation | Meaning |
| --- | --- |
| `selectGecko(id)` | Select an active `mica`, `pip`, or `slate`, without advancing time. `null` enables nearest-visitor ownership. |
| `guide(x, y)` | Finite normalized guidance, clamped to `[-1,1]`; ignored while motion is suspended. |
| `clearGuide()` | Release current pointer investigation. |
| `direct({ type: 'moth', id?, x?, y? })` | Place a temporary moth interest for the chosen visitor. |
| `direct({ type: 'shadow', id?, x?, y? })` | Deliberate alarm, subject to the target's busy/cooldown rule. |
| `direct({ type: 'return', id? })` | Ask for a return to the resident's home. |
| `direct({ type: 'inspect', id?, x?, y? })` | Investigate a point; without coordinates, invite a point ahead of the selected head. |

Cues require both coordinates when either is provided; both must be finite in `[-1,1]`. Named targets must be in the current cast. The browser captures the target when it accepts the cue, so a later selection change does not silently retarget queued input. Without an explicit ID it uses the selected resident, or the nearest resident when selection is `null`.

Pointer coordinates are read from the CSS rectangle and converted through the actual letterboxed/focused viewport; DPR is not part of input coordinates. Normalized director inputs map to the 6.6×4.4 world, with movement goals bounded to its habitat. Native canvas-focused arrows and Space, guide buttons, scene/cast controls and cue buttons supply keyboard alternatives. Pointer/touch handlers are passive; the page does not suppress normal touch scrolling.

`direct` returns the discriminated `GeckoDirectorActionResult`:

- `queued`: accepted for a future simulation tick; not a claim that a hunt, retreat or return is already complete.
- `static`: a deliberate presentation-only still was selected while motion is gated.
- `ignored/resting` or `ignored/busy`: inspect the reason instead of announcing a successful surprise.

Legacy `guide`, `startle`, and facade `pulse` keep `GeckoActionResult` (`queued`, `static`, `ignored/resting`). Director `startle` / `pulse` alias a shadow and map a busy result to that legacy shape. Use `direct` when contextual result detail matters. The browser coalesces the latest guide/leave intent and the latest deliberate cue into bounded slots; it is not an event recorder. Headless receipts distinguish applied events from ignored busy shadows.

## State and stable operations

`getDirectorSnapshot()` returns defensive state with `arc`, resolved `options`, `selectedId`, pointer/moth/shadow cues and the individual records. Each record carries ID, role, full Gecko body, goal, motive, emotion, tail expression, route, cooldown and catch count. `GeckoSceneArc` is discriminated by `scene`; body behavior and stance/swing feet retain their existing discriminants.

`configureDirector` validates before replacing options. Surviving residents keep their identity and contact state when population changes; removed residents are disposed, and newly added residents begin at their authored homes. Removing the selected resident chooses the first survivor. Changing scene resets its score and temporary scene intentions, while preserving resident poses, contacts and ongoing physical recovery. The browser clears stale pending guidance/cues and a deliberate poster when reconfiguring. The demo preserves hidden residents' role assignments when its population is reduced and later restored.

`reset` recreates the cast, clears time, events and temporary cues, restores selection to Mica, and retains resolved director/animal settings. An optional valid seed or common heading replaces the previous one. It does not override user pause. `selectGecko`, live configuration and rendering do not covertly call a simulation step.

For compatibility, browser `getSnapshot()` and `getStatus().phase` report the first member. Use the director snapshot to inspect a selected resident. `getStatus().director` is a small summary; sparse `onStatus` notifications expose scene/policy changes without a per-frame live-region feed. After disposal only status/disposal metadata and repeated `dispose()` remain usable. A borrowed scheduler and other mounted artworks remain owned by their hosts.

## Explicit deterministic example

Run after `npm run build`. The same version, seed, resolved configuration and ordered event sequence produce the same state; wall-clock rendering cadence is not an input.

<!-- deterministic-example -->
```ts
import { createGeckoDirector, type GeckoDirectorEvent } from 'ascii-animals-review/gecko';

const input: readonly GeckoDirectorEvent[] = [
  { tick: 1,   seq: 1, type: 'select', id: 'pip' },
  { tick: 60,  seq: 2, type: 'moth', id: 'pip', x: .25, y: -.2 },
  { tick: 240, seq: 3, type: 'shadow', id: 'mica', x: -.45, y: .1 },
  { tick: 500, seq: 4, type: 'return', id: 'mica' },
  { tick: 720, seq: 5, type: 'guide', id: 'pip', x: .2, y: -.4 },
  { tick: 721, seq: 6, type: 'leave' },
];
function replay() {
  const director = createGeckoDirector({
    seed: 37,
    options: { scene: 'lantern-hunt', population: 3, tempo: 1, boldness: .55 },
  });
  try {
    for (let tick = 1; tick <= 900; tick++) {
      director.step(input.filter(event => event.tick === tick));
    }
    return director.getSnapshot();
  } finally {
    director.dispose();
  }
}
const first = replay();
const second = replay();
if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Replay diverged');
console.log({ tick: first.tick, selected: first.selectedId, beat: first.arc.beat });
```

Each batch must use the next exact tick and globally increasing positive sequence numbers; at most 32 events are accepted per tick. Validation precedes mutation. Empty ticks use `step()` or `step([])`. Selection can also be recorded as a `select` event. To reproduce live option changes, apply the same validated update at the same point in the tick sequence. Compare state or glyph cells under a fixed version/runtime; font rasterization and pixels across browsers/devices are a separate concern.

## Recipes restart settings; they do not record an encounter

`exportRecipe()` on the headless director and `exportScene()` on the browser return a versioned `GeckoDirectorRecipe`. It contains `kind: 'gecko-scene-recipe'`, seed, optional common heading, resolved director options, base animal options and `startsAtTick: 0`. A supplied heading is retained. If it is omitted, the authored per-resident headings are used again.

```ts
import { createGeckoDirector } from 'ascii-animals-review/gecko';

const original = createGeckoDirector({ seed: 37, heading: -.7 });
const recipe = original.exportRecipe();
const restarted = createGeckoDirector({
  seed: recipe.seed,
  ...(recipe.heading === undefined ? {} : { heading: recipe.heading }),
  options: recipe.options,
  animal: recipe.animal,
});
original.dispose();
restarted.dispose();
```

A recipe contains no tick history, current positions, catches, selected visitor, transient cues, pause setting or input log. It is not a snapshot-import format or a recording. Check the version/kind of imported JSON before mapping its fields into the validated constructor. The demo offers a JSON download; it does not currently include a recipe-upload UI. PNG captures the current canvas; text exports the current glyph cells. Neither export is an animated recording.

## Static alternatives, lifecycle and budgets

With explicit pause or live reduced motion, `direct` composes a still moth, shadow, return or inspect presentation. It derives this from current state, without advancing ticks or moving planted contacts. The return still is a calm expression at the current location, not a teleport home. `getDirectorSnapshot()` remains the simulation snapshot; `getStatus().directorPoster` tells the host which static presentation is selected. Resuming motion clears the deliberate poster. Guide inputs do not animate a paused/reduced-motion scene.

Hidden document, bfcache freeze, offscreen intersection, zero size and insufficient width compose with explicit pause. Suspended input is cleared, resume does not catch up hidden time, and nonpersisted navigation disposes the demo. The latest live reduced-motion preference remains authoritative. Disposal is idempotent, releases listeners/observers and the host's one frame subscription, and guards late callbacks. The browser catches up at most five 60 Hz ticks per callback and reports dropped milliseconds.

| Bound / layout | Implemented value |
| --- | --- |
| Residents | At most 3 |
| Animal sample capacity | At most 36,864 total |
| Environment marks | At most 4,096 |
| Director raster ceiling | 256×168 / 43,008 cells |
| Automatic desktop raster | 224×144 across a 6.6×4.4 wall |
| Automatic close view | 112×72, centered on selected resident below 640 CSS px or at population 1 |
| Minimum director canvas width | 320 CSS px; solo remains 360 px |
| Explicit host grid | Existing 112–192 columns and 50–86 rows; use `auto` for director defaults |
| Canvas | At most 1000×780 logical draw dimensions; DPR ≤2; backing pixels can reach 2000×1560 |
| Browser pending intents | Latest guide/leave plus latest deliberate cue |

These are source-enforced bounds, not a measured frame-time or heap pass. The predeclared browser target is p95 update/render work ≤16.7 ms at the default three-resident desktop setup after a 2-second warmup and 30-second collection. That target remains unmeasured.

## Reproduce and assess the evidence

From the repository root, using its locked TypeScript compiler:

```sh
npm run build
node node_modules/typescript/bin/tsc -p species/gecko/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p species/gecko/test/tsconfig.json
node --test species/gecko/test/*.test.mjs test/gecko-integration.test.mjs
node --test test/generated-demo.test.mjs test/demo-module-dependencies.test.mjs
```

For manual inspection on a machine with a usable local browser, serve `dist` using a normal local web server and open its `/gecko/` path. For example, `python -m http.server 8000 --bind 127.0.0.1 --directory dist`. This is a reproduction instruction, not a claim that a browser pass occurred here. The build continues to rewrite the demo entry to the real public Gecko factory.

The evidence categories must remain separate:

- **Source / types / stubs:** deterministic state, geometry/contact bounds, input validation, typed consumers and lifecycle ownership can be tested without a browser. Run the commands against the exact reviewed revision and retain their results.
- **Native Canvas:** fresh raster captures can establish the actual glyph geometry, attached tail and scene composition. They do not exercise DOM layout, browser font rendering, native touch, accessibility or browser performance.
- **Live deployed baseline:** on 18 November 2026 the cloud browser actually exercised the existing Cuttlefish and previous solo Gecko pages. That comparison motivated this extension. Its screenshots and exports are baseline evidence, not captures of the new director.
- **New director browser:** the local Chromium attempt failed during startup. No supported cloud preview URL was exposed, and no Sites/Work/deployment workaround was used. New-page desktop/mobile DOM interaction, physical touch, screen reader, reduced motion, bfcache and downloaded-export behavior remain unverified in a real browser.
- **Performance / deployment:** no new browser frame-time/heap claim, npm publication or deployment follows from this change. Record the pending browser and performance gates explicitly in the review artifacts and PR.

### Final base refresh

The implementation was inspected and authored on `c06114404900884814bef879a02f1a49a3e7d590`. Before final validation, current main advanced to `c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02` through a shared README status reconciliation only. The isolated director branch was fast-forwarded to that exact base; no runtime contract changed, and the shared README is outside this species diff.
