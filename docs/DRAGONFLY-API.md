# Dragonfly typed adapter

## Additive pond director

The Dragonfly entry now also offers an opt-in bounded ensemble. Passing
`director: { scene: 'patrol', count: 3 }` to `createDragonflyArtwork` enables pond
patrol, hovering attention and reed relay. Each of 1–4 named individuals retains
its own role, seeded route, perch and multi-stage dart/return response.

```ts
import { createDragonflyArtwork, createDragonflyDirector } from 'ascii-animals-review/dragonfly';
const pond = createDragonflyArtwork(canvas, { director: { scene: 'relay', count: 4 } });
pond.selectIndividual(2);
pond.setTarget(.6, -.35);
pond.cue('dart');
pond.configureDirector({ route: 'figure-eight', tempo: .8, breeze: .2 });
const ensemble = pond.getDirectorState(); // separate from the legacy getState()
pond.dispose();

const headless = createDragonflyDirector({ scene: 'patrol', count: 3 }, { seed: 17 });
headless.step(1, [{ type: 'cue', cue: 'perch', tick: 1, seq: 0 }]);
headless.dispose();
```

Omitting `director` preserves the existing solo experience. Model configuration,
legacy snapshots and replay retain their meaning. Director options and events
have distinct types, defaults, validation, snapshots and exact-tick semantics.
All visitors share one existing scheduler subscription and one composed canvas.
The implementation and full contract are documented in
[the species director API](../species/dragonfly/DIRECTOR-API.md), including which
model options affect ensemble motion, accessibility, fixed phase windows,
configuration/reset/disposal semantics, bounds and evidence limits. This addition
is pending integration review; it is not a shared species-contract migration.

## Original solo adapter

`createDragonflyArtwork` is a dedicated browser adapter for the original four-wing,
segmented-abdomen Dragonfly model. It preserves hover/tracking, deliberate dart,
stabilization/recovery/cooldown, and full/slow/static motion. It does not pretend to
be a cuttlefish preset or adopt the unaccepted generic geometry-writer proposal.

```ts
import { createDragonflyArtwork, createDragonfly, type DragonflyInput } from 'ascii-animals-review/dragonfly';
const animal = createDragonflyArtwork(canvas, {
  model: { seed: 17, motion: 'slow', wingAmplitude: .27 },
  view: 'oblique', neutral: false,
});
animal.setTarget(.5, -.2); animal.dart();
animal.update({ motion: 'full', followPointer: true });
animal.pause(); animal.restart(); // preserves pause
animal.play();
animal.setView('dorsal'); animal.setNeutral(true);
const frame = animal.exportText();
animal.dispose(); // repeatable

// Headless deterministic fixed-tick model, not a wall-clock seek API.
const model = createDragonfly({ seed: 17 });
const event: DragonflyInput = { type: 'dart', tick: 1, seq: 0 };
model.step(1, [event]); model.dispose();
```

The root also exports the factory and named Dragonfly types. The dedicated
`./dragonfly` entry adds the headless factory, bounded replay helper, validated
options/defaults/limits and species types. This is still a private review package,
not an npm publication claim.

## Explicit lifecycle

The factory preserves `configure`, `setPaused`, `reset(seed?)`, `setTarget`,
`clearTarget`, `dart`, `setView`, `setNeutral`, `render`, `exportText`, `getState`,
`getOptions`, `getStatus` and `dispose`. Its ergonomic aliases are `update`,
`play`, `pause`, `restart` and `pulse` (dart/change-pose). `species` is the literal
`dragonfly`; `disposed` is readable after teardown.

Pause/reset retain the user's playback choice. Reduced motion forces still mode;
Play does not override it. Deliberate Guide/Dart changes a static pose while
paused/static/reduced; pointer movement never resumes it. Leaving reduced motion
restores the remembered requested motion subject to user pause. Configuration
changes and host suspension are not serialized by the fixed-configuration replay
helper; start a new replay log for them.

State/options/status snapshots remain readable after teardown. Mutating operations
reject; disposal is idempotent. A headless model steps exactly the next integer tick
at a fixed 60Hz simulation rate, while slow mode scales authored motion. There is
no seconds-based `advance`, unbounded seek, or general mixed-species state contract.

## Integration and ownership

The adapter borrows the canonical per-window scheduler by default. An explicit
`frameSource` may supply a compatible subscription source; only this mount's
subscription is removed. Canvas ownership, independent model state, observers and
input listeners stay instance-local. Renderer geometry and preview remain original
Dragonfly TypeScript in `species/dragonfly/src`, not an independently edited copy.

The default host is resolved from the canvas's owning document. Tests may inject
an explicit environment. Browser options reject unknown keys and invalid callbacks.
Supported model option bounds are in the maintained species API reference:
https://github.com/castlemilk/ascii-animals/blob/main/species/dragonfly/API.md

## Generated demo and validation

`npm run build` compiles species TypeScript, generates package modules, and builds
`dist/dragonfly/` using the real public adapter. After approved Pages deployment the
route is `/ascii-animals/dragonfly/`. The local source study remains separate for
research. Catalogue registration is handled by its owner; no release status is
inferred from a local demo.

`npm test` includes original species and adapter integration regressions.
`npm run typecheck` compiles strict source and species type consumers.
`npm run check:package` checks actual offline tarball imports, positive/negative
TypeScript fixtures and reproducibility. Mock tests/native evidence do not certify
real browser rendering, touch, accessibility or performance. Browser QA is separate.
