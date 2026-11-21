# Frog: typed leap study and optional pond director

**Current source contract:** checked against [`main` at `f63b20e2045b`](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/src/public/frog.ts) on 21 November 2026. The API below is present in that source. Use the [local-package setup](GETTING-STARTED.md); [current validation](VALIDATION-2026-11-21.md) separates the built package, live Pages and npm availability. Older authoring bases and capture results below are historical evidence, not additional release claims.

The `ascii-animals-review/frog` entry exposes `createFrogArtwork`, the pure `createFrog`/`stepFrog`/`sampleFrog` model and generated strict TypeScript declarations. The root entry also exports `createFrogArtwork`. This package remains private and unpublished.

```ts
import { createFrogArtwork } from 'ascii-animals-review/frog';
const frog = createFrogArtwork(canvas, {
  seed: 23, config: { jumpHeight: .85, flightTicks: 42 },
  preview: { view: 'front', cols: 144, rows: 80 }, paused: true,
});
frog.target({ x: .7, y: .2 });
frog.play(); frog.pulse();
frog.pause(); frog.restart(); // reset keeps user pause
frog.update({ jumpHeight: .7 }); // validated atomic config reset
frog.updatePreview({ view: 'left' }); // presentation-only
frog.dispose();
```

## Optional pond director

Pass `director: { scene: 'moonlit-chorus', count: 3 }` to opt into an original lily-pad ensemble through the same factory. Omitting `director` preserves the single-frog default. Other scenes are `stillwater` and `firefly-supper`; layouts, cue tempo, autonomy and three per-ID roles are validated typed options. Named actors share one renderer and one existing scheduler subscription.

New methods are `getPondState`, `updateDirector`, `selectFrog`, `setRole`, `call`, `hunt` and `ripple`. `getState` keeps returning one `FrogState` (the selected actor in director mode), and `pulse` still means leap. A hop reserves its destination; calls schedule at most two one-generation answers; a firefly invitation aligns with a reachable perch. Director/body updates deterministically reset the ensemble and preserve explicit pause. Paused/reduced Call/Hunt/Ripple choose deliberate stills without ticks or travel.

The [species-local director API](../species/frog/director/API.md) documents every default, validation rule, immutable state/input/result union, pure replay example, lifecycle semantic and budget. [Director evidence](../species/frog/director/EVIDENCE.md) distinguishes executed checks, native rendered captures and unrun browser/device gates. No shared package/core/registry contract changes are required.

## Honest lifecycle and configuration

This is a fixed 60 Hz model with a latched ballistic landing point, not the marine choreography clock. `pulse()` maps to `leap()`. `update()` maps to validated `updateConfig()` and resets simulation with the same seed while preserving pause. `restart()` maps to `reset()`. OS reduced motion remains authoritative: deliberate Leap cycles static poses rather than travelling. At most five ticks run after a visible stall; hidden time is discarded. Existing `target`, `clearTarget`, `setStaticPose`, `getState`, `getStatus`, `exportText`, and `reset({ seed: 23 })` remain available. `reset` takes an optional object, not a numeric seed. `updateDirector(patch)` can enable director mode on a solo mount and resets the ensemble after validating the preview.

All mutation/state/export methods reject after disposal; status and the facade's `disposed` remain readable. Disposal is idempotent and releases only this instance's shared-scheduler subscription. Settings reject unknown/nonfinite/out-of-range values before mutation. `frameSource` may supply an explicit borrowed continuous scheduler; otherwise the per-window shared scheduler is used.

The source's complete config/view/phase contract is retained in `species/frog/README.md`. Supported body settings include size, jump height/distance, crouch/flight/landing/recovery/cooldown tick counts and throat amplitude. Supported presentation controls are front/left/right/profile, bounded character dimensions and single-tone. There is no arbitrary serialized-state restore, universal species registration or cross-refresh-rate pixel-determinism claim.

## Source and renderer boundary

Recovered source ZIP `ascii-animals-frog-source.zip`, archived commit `15cc96bb80b37ad9993de1ff259ee41c29c5e39a`, originated in the requested Frog Pro chat. Only its `species/frog` subtree was imported; its stale root demo/workflow were not applied.

`species/frog/src/*.mts` remains canonical. The former private-global adapter has been made a self-contained typed glyph atlas/projection/depth pass, retaining original geometry, glyph ramp, sampling and color math. It does not read `window.CuttlefishArtwork` or install a global. The legacy-named module is an internal compatibility filename, not a dependency. Built package modules and `dist/frog/` are generated from this typed source; current demo uses the actual packaged factory.

The supplied native PNG/GIF evidence is historical, not a recording of this integration's browser runtime. The original minimum-grid all-landmark recognition gate was partial; profile view remains diagnostic. No browser FPS, GPU, memory or universal-font claim is made. Independent visible browser acceptance is recorded on the integration PR separately.

## Reproduce

`npm ci --ignore-scripts`, `npm test`, `npm run typecheck`, and `npm run check:package` cover runtime/model, shared scheduling, numerical glyph output, strict consumer types, actual tarball and SSR imports. `npm run build` regenerates package and public demo. Serve `dist/` and open `/frog/` for visual acceptance. No catalogue availability or deployment is implied by a source PR.
