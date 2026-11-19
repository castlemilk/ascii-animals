# Frog pond director API

This is an additive extension of the integrated private `ascii-animals-review/frog` entry. It uses the existing public `createFrogArtwork` factory, body model, anatomical geometry, glyph pass and shared per-window scheduler. The package remains private and unpublished. Omitting `director` retains the original single-frog behavior.

## Browser use

```ts
import { createFrogArtwork } from 'ascii-animals-review/frog';
import type { FrogDirectorOptions, FrogPondState } from 'ascii-animals-review/frog';

const director: FrogDirectorOptions = {
  scene: 'moonlit-chorus', count: 3, layout: 'arc', tempo: 1,
  autonomy: true, roles: ['caller', 'hunter', 'dreamer'],
};
const artwork = createFrogArtwork(canvas, {
  seed: 23,
  director,
  config: { jumpHeight: .85, maxDistance: 1.2 },
  preview: { cols: 180, rows: 100, labels: true, trajectories: false, renderFps: 20 },
  onPondChange(state: FrogPondState) {
    // Readonly snapshot. Update non-live role/phase labels, not a second timer.
    console.log(state.scenePhase, state.actors.map(a => a.motive.kind));
  },
});
artwork.selectFrog(1);                  // Pip; stable ID, independent of role
artwork.hunt({ x: .7, y: -.5 });       // invite a firefly above a safe perch
artwork.call();                        // explicit call, then bounded replies
artwork.ripple({ x: -.25, y: .15 });  // water disturbance, nearest frog listens
artwork.target({ x: -.72, y: -.55 });
artwork.leap();                        // selected frog; free/reachable pad required
artwork.pause();
artwork.call();                        // deliberate fixed calling study while paused
artwork.setRole(1, 'dreamer');          // preserves current position/committed leap
artwork.updateDirector({ scene: 'stillwater', count: 2 }); // deterministic reset, keeps pause
artwork.play();
artwork.dispose();                     // idempotent, owns only its subscription
```

Calls are immediate requests. At most one deliberate action is pending for the next model tick; issuing `hunt`, `call` and `ripple` together replaces earlier pending actions. Space them across ticks when creating a scripted performance. A queued action retains the selected actor ID from the time it was requested even if selection changes before the tick.

## Director configuration

Every supplied field validates before mutation. Unknown keys, coercible strings, non-finite values, out-of-range values, explicit `undefined` fields and malformed role tuples reject. Arrays/config are copied and frozen. IDs are stable integers; absent actors cannot be selected. Body configuration remains `FrogConfig`; director settings do not silently change hop physics.

| Option | Default | Accepted values | Effect |
| --- | --- | --- | --- |
| `scene` | `moonlit-chorus` | `stillwater`, `firefly-supper`, `moonlit-chorus` | Selects autonomous cue priorities and visible setting |
| `count` | `3` | Literal integer `1`, `2`, or `3` | Creates Moss, then Pip, then Fern |
| `layout` | `arc` | `arc`, `stepping-stones`, `shelter` | Six authored pad coordinates; initial actors occupy pads 0–count−1 |
| `tempo` | `1` | Finite `.5…1.5` | Changes cue/reply spacing and scene arc durations; body phase tick durations are unchanged |
| `autonomy` | `true` | Boolean | Enables scene cues; deliberate actions and their bounded recovery/replies still work when false |
| `roles` | `['caller','hunter','dreamer']` | Exactly three validated roles, even when count is lower | Stable-ID motives for future cues, retained by reset |

Moss/Pip/Fern keep IDs 0/1/2. Caller leads chorus cues; hunter gets first invitation in the hunting scene; dreamer favors long attention/rest in Stillwater. Roles influence priorities; they do not prevent deliberate actions or turn one actor into a different species. When the preferred role is absent, the next available actor can act.

Body defaults and bounds remain unchanged:

| Body option | Default | Accepted range |
| --- | --- | --- |
| `size` | `1` | `.75…1.15` |
| `jumpHeight` | `.85` | `.45…1.1` |
| `maxDistance` | `1.2` | `.2…1.5` normalized pad-plane units |
| `crouchTicks` | `14` | Integer `6…60` |
| `flightTicks` | `42` | Integer `24…90` |
| `landingTicks` | `12` | Integer `6…36` |
| `recoveryTicks` | `24` | Integer `6…120` |
| `cooldownTicks` | `18` | Integer `1…120` |
| `throatAmplitude` | `.06` | `0….08`; idle breath only, separate from explicit call envelope |

Seed defaults to 23; accepted creation/reset seed is an integer `0…4294967295`. Actor seeds derive from scene seed and stable ID; no ambient random source is used.

The director's fixed authored behavior durations are exported as readonly `FROG_POND_LIMITS`: call 84 ticks, track 36, strike 30, settle 48, base listen 72, ripple TTL 90, base firefly TTL 240, first reply delay 36 plus 30 ticks for the next neighbor before tempo scaling. They are constants for this version, not configurable constructor fields. The wetland revision slows the strike from 12 to 30 ticks so projection, contact and attached return can be read as characters. Its insect lifetime extends when valid configured body timings require more time to approach and recover. The default scene arc is 90 opening + 480 activity + 120 settling + 210 quiet ticks. Autonomy schedules cues only in activity; ongoing actions recover naturally into the quiet interval.

### Presentation

`FrogPreviewOptions` retains `cols` (default144, range72…180), `rows` (default80, range40…100), `view` (`front`, `left`, `right`, diagnostic `profile`), and `silhouette` (defaultfalse). Actual grid dimensions preserve the existing 1:1.35 cell ratio.

New options are `labels` (defaulttrue), `trajectories` (defaultfalse), and `renderFps` (default20, finite12…30). They affect pond presentation only. The demo opts into a maximum180×100 grid. `renderFps` is a presentation cap, not a measured performance promise; the fixed model still advances at60Hz. User actions/resizes can force immediate redraws. `updatePreview` preserves model/director state.

`FrogPondPreviewFrame.actorGlyphs` is a frozen length3 array indexed by stable IDs0/1/2; absent actors report zero. It counts final occupied raster cells after occlusion, not pixels or emitted samples. `geometry` describes only the selected actor; `samples` counts the full frog/environment scene and `glyphs` counts all occupied cells.

## Behavior and scene semantics

| Scene / interaction | Multi-stage behavior | Bounds and recovery |
| --- | --- | --- |
| Stillwater | Long rests, independent gaze/breath phases, listening, occasional short pad change | Dreamer takes longer listening intervals; no continuous chasing |
| Firefly supper | Notice a small light → supported stalk → safe approach and recovery → planted tongue projection, contact and attached return → settle | One active insect; a blocked chase can miss without claiming an impossible capture |
| Moonlit chorus | A caller expands its throat → neighbors answer at delayed times → silence | At most two replies, generation1 only; replies do not create more replies |
| Manual hop | Target preview → crouch → latched ballistic arc → landing compression → recovery → cooldown | Free reachable destination; source and destination both protected until touchdown; one crouch/flight globally |
| Water ripple | A ring spreads → nearest available frog turns/listens → rest | At most six effects, each with finite TTL; no delayed action queue |
| Paused/reduced action | Fixed call, hunt or ripple composition | No tick, travel, effect aging or scheduling; explicit play clears the selected still unless OS reduced motion remains active |

A hunt point is a normalized **perch preference**, not a guarantee that the insect appears at the exact supplied coordinate. It chooses the nearest eligible free pad reachable by a short hop (at most `.95` or the lower configured maxDistance); if none is available, it appears above the current perch. This keeps the target, landing and strike coherent. A later reservation conflict can cause a bounded stationary miss.

Pad occupancy uses exact IDs. Model landing coordinates are within `1e-10` of pad coordinates because the existing body model uses floating-point interpolation. Flight plans remain immutable, and later pointer movement never bends an active trajectory. This is deliberately bounded scene choreography, not general collision simulation.

## Typed state and pure stepping

Exports include `FrogScene`, `FrogRole`, `FrogPondLayout`, `FrogDirectorConfig`, `FrogDirectorOptions`, `FrogPondOptions`, `FrogPondState`, `FrogPondActor`, `FrogPondMotive`, `FrogPondPad`, `FrogPondAction`, `FrogPondInput`, `FrogPondStepResult`, ripple/firefly/reply types and the existing body/input/geometry/controller types.

`FrogPondMotive` is a discriminated union: `rest`, `listen`, `call`, `track`, `hop`, `strike`, `settle`. Narrowing `kind` exposes only the relevant fields. The existing `FrogBehavior` union still owns body phases: idle, interest, crouch, flight, landing, recovery, cooldown. `getState()` continues to return a single `FrogState`—the selected actor in pond mode. `getPondState()` returns the whole immutable ensemble, or null in original mode.

```ts
import { createFrogPond, stepFrogPond, posePondFrog } from 'ascii-animals-review/frog';
import type { FrogPondInput } from 'ascii-animals-review/frog';

let pond = createFrogPond({ seed: 23, director: { autonomy: false } });
const events: readonly FrogPondInput[] = [
  { type: 'call', frogId: 0, tick: 1, seq: 0 },
];
const result = stepFrogPond(pond, 1, events);
pond = result.state;
for (let tick = 2; tick <= 120; tick++) pond = stepFrogPond(pond, tick).state;
for (const actor of pond.actors) {
  if (actor.motive.kind === 'call') console.log(actor.motive.reply);
  const pose = posePondFrog(pond, actor);
  console.log(actor.name, pose.origin, result.ignoredActions);
}
```

Each step must use exactly `state.tick + 1`; at most8 inputs address that next tick, with globally strictly increasing nonnegative integer `seq`. The entire batch validates before any state is produced. Each actor model advances one logical tick; body-launch sequences remain local and are not confused with director event sequence numbers. Model clock maximum is2,147,483,647 ticks. Manual hop/call/hunt/ripple suppress a competing same-tick autonomous cue. Input types are readonly; caller-owned event objects are not frozen. Returned state and phases are frozen snapshots; `notices` and `ignoredActions` expose rejected busy/unreachable/occupied requests.

Available actions:

| Action | Required data |
| --- | --- |
| `target` | normalized `x,y` in `[-1,1]` |
| `leave` | none |
| `select` | present `frogId` |
| `hop` | present `frogId`, valid `padId` |
| `call` | present `frogId` |
| `hunt` | present `frogId`, normalized `x,y` |
| `ripple` | normalized `x,y` |

`configureFrogDirector(patch, base?)` validates/copies a config. `resetFrogPond(state, options?)` merges validated seed/body/director options and recreates the initial ensemble. `selectPondFrog`, `setPondRole` and `previewPondTarget` are explicit zero-time edits; they preserve committed travel. `posePondFrog` and `pondPointToWorld` are frog-specific geometry helpers; they are not a new shared species contract. The source sampler `sampleFrogPose` reuses the same anatomical path internally rather than introducing a duplicate model.

Replay determinism applies to the same source/runtime/config/seed and event log. Tests compare 1/2/5-tick presentation groupings; they do not promise bit-identical trigonometry across engines or pixels across fonts. The included deterministic replay is a fixture, not a browser event recorder or arbitrary serialized-state restore API.

## Controller lifecycle and inputs

| Operation | Semantics |
| --- | --- |
| Omitted `director` | Original single-frog mode and cadence |
| `updateDirector(patch)` | Enables pond if absent, otherwise merges config; validates then resets the ensemble, retaining explicit pause |
| `updateConfig` / facade `update` | Resets body and ensemble using the current director config/seed; retains pause |
| `reset({seed?})` / `restart()` | Clears cues/effects/targets/pending input and resets ticks; retains current config and pause |
| `selectFrog(id)` | Selects a present stable actor; clears transient aiming, preserves queued deliberate actor ownership |
| `setRole(id, role)` | Future-cue role edit, preserved by reset; no teleport, active-plan or clock reset |
| `target`, `leap`, facade `pulse` | Target/hop selected actor. Invalid occupied/reserved/unreachable aim is rejected rather than hopping somewhere else. With no target, Hop chooses nearest free reachable pad |
| `call`, `hunt(point?)`, `ripple(point?)` | Next-tick action while playing; deliberate still study while paused/reduced/undersized. Explicit invalid points, including null, reject |
| `setStaticPose` | Pauses on rest/crouch/airborne/landed; no scene timer |
| `onPondChange` | Called after rendering a changed state identity; no separate timer; use non-live labels |
| `onAction` | Sparse feedback for deliberate actions; autonomous every-tick updates are not announced |
| `dispose` | Idempotent; unsubscribes only this instance, removes listeners/observers, frees atlas/buffers |

After disposal, mutation/state/export methods throw; `getStatus()` and facade `disposed` remain readable. Callback/setup/draw errors dispose owned resources. A supplied `frameSource` is borrowed; otherwise `createFrogArtwork` uses the existing per-window shared scheduler. There is one subscription for the pond, not one per actor. Low-level `mountFrog` retains its original standalone RAF fallback when no source is injected; consumers should prefer the public factory for shared ownership.

Pause, OS reduced motion, hidden document, offscreen, zero size and undersized canvas compose. Below320×240 CSS pixels the scene is static. Zero size reduces the display canvas to1×1; its retained atlas and typed buffers are released on disposal. Resume establishes a new timestamp and discards hidden wall time. A long visible stall accepts at most five60Hz ticks and records dropped milliseconds. No interval, social timeout or per-animal RAF exists.

Canvas focus: 1/2/3 selects an actor, arrows aim, Enter/Space hops, C calls, H invites a hunt, R ripples, Escape clears aiming. Alt/Ctrl/Meta-modified keys, nested form controls and Tab are not intercepted; Shift alone does not disable scene shortcuts. Pointer movement only aims. A tap on visible frog glyphs selects its owner; a tap on a pad asks for a hop; water creates a ripple. Pointer normalization uses the CSS rect, independent of DPR. A12px drag excursion, cancel, leave or lost capture cancels the tap; scroll uses `touch-action:pan-y`. Native buttons/selects provide all actions without hover. The demo uses≥44px controls, visible focus, descriptions and sparse live status; physical touch and screen-reader acceptance remain separate gates.

## Resource and integration boundary

Maximum3 actors,6 pads,6 ripples,1 firefly,2 replies; one crouch/flight at a time;8 events per pure tick and2 pending host inputs. The glyph pass reuses one32,000-sample workspace for each actor and environment, one atlas and one depth/owner/cell field. Original geometry emits17,918 samples per frog; complete pond cap60,000; environment cap6,246; grid≤180×100; DPR≤2; logical backing≤1200×700. These are enforced budgets, not evidence of device frame time or heap behavior.

No root package exports, core, shared scheduler, catalogue, registry or marine source changed. `src/public/frog.ts` already reexports the frog module and wraps the existing controller; it requires no rewrite. Existing declaration bridges under `src/species/frog` continue resolving generated strict declarations. Generated source JS/types and `dist/frog` are committed through the existing builder. Shared renderer consolidation, if desired later, belongs to the coordinator; this patch extends the frog renderer already merged at the exact base recorded in `base-manifest.json`.
