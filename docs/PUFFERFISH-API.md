# Pufferfish: explicit typed adapter

```ts
import { createPufferfishArtwork } from 'ascii-animals-review/pufferfish';
const art = createPufferfishArtwork(canvas, {
  species: { seed: 17, inflationScale: 1.65, wobble: 0.2 },
  render: { view: 'right', quality: 'standard', monochrome: false, maxDpr: 2 },
});
art.pulse(); // approach, staged belly inflation then spines, hold/recovery/cooldown
art.retreat();
art.pause();
art.pulse(); // explicit static inflated pose; never resumes playback
art.configureRender({ view: 'front', quality: 'fine' });
art.update({ dwellTicks: 40 }); // validated atomic species patch
art.restart(); // retains user pause and configuration
art.dispose(); // idempotent; never disposes the borrowed scheduler
```

The root export also provides `createPufferfishArtwork`. Pufferfish is intentionally not a marine `createArtwork` species: it has its own immutable 60 Hz state machine and deliberate static poses, not the marine reaction clock. The subpath exports the full typed model (`createPufferfish`, `stepPufferfish`, replay events, geometry and configuration types). No import reads browser globals; mounting requires a sized browser Canvas2D. A DOM-free model can be read from the species source; the public browser entry's declarations include DOM types.

## Configuration and lifecycle

All supported species options: `seed`, `approachRadius`, `retreatRadius`, `dwellTicks`, `bellyTicks`, `spineTicks`, `holdTicks`, `recoveryTicks`, `cooldownTicks`, `inflationScale`, `wobble`. See the [source API specification](../species/pufferfish/API.md) for exact ranges/defaults. Rendering supports front/left/right view, small/standard/fine quality, monochrome and maxDpr 1–2. Unknown/nonfinite/invalid fields reject before applying a patch. `getOptions()` returns the immutable current species configuration. Render updates use `configureRender`.

`paused`, `onChange`, `onError`, and an optional borrowed `frameSource` are mount options. By default the adapter borrows the same per-window scheduler as Fox and the marine renderer. The controller never disposes that scheduler. User pause, reduced motion, hidden/offscreen, zero size and compact sizes suspend scheduling independently. Reduced motion remains authoritative even after `play()`. Width below 360 or height below 270 uses a still view; Approach/Retreat controls choose explicit static poses. Pointer inputs coalesce and fixed-tick catch-up is capped. Canvas sizes, sample counts and grid density remain bounded.

The original controller names (`configure`, `setPaused`, `reset`, `approach`, `retreat`, `getSnapshot`, `getStatus`, `exportText`, `destroy`) remain available. Factory aliases are `update`, `play`, `pause`, `restart`, `pulse`, `dispose`. Mutating methods reject after disposal; status/snapshot getters remain inspectable. No seconds-based `advance` alias is invented.

## Source and integration evidence

Recovered handoff SHA256 checks all passed. Original Git head `35b9e643037ac39b9db18563828beaf7ca2b458a`, tree `88d7136f980b3366439118617fba3045975346fd`, tested base `0e446c47b491b751d484e40db753ec725652b515`. Only its 91 `species/pufferfish/` paths were imported; no old engine, root site or package files were copied over current main.

The supplied private painter calls a narrow set of canonical renderer prototype methods without invoking the marine constructor or starting a second loop. This remains **private coupling**, not a supported public geometry plugin API. Canonical render/atlas/raster behavior is exercised by the imported geometry/controller suite and generated demo checks. The original renderer SHA is retained as historical provenance and checked against the frozen oracle; the actual current demo uses the canonical ESM module, not that oracle. Future canonical engine changes must rerun this compatibility suite.

`npm run build` compiles the strict TS model/controller, the public factory and generated `dist/pufferfish/` demo from one source. The generated demo has no global renderer dependency. Original evidence PNG/GIF files under `species/pufferfish/evidence` remain **historical native-Canvas output**, not screenshots from this integration or browser performance proof. The original native capture was slow; no FPS improvement or new native/browser performance claim is made.

Integration tests cover shared scheduling/disposal, pause and reduced-motion static action, compact view, immutable and atomic config, SSR package import and strict positive/negative consumer types. Browser acceptance remains pending until independently recorded. No npm publication or deployment is included in this draft.
