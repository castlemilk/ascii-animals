# Owl integration

The recovered Pro implementation is now integrated through the explicit `ascii-animals-review/owl` subpath and root named exports. The package remains private and unpublished. Owl is a semantic DOM-text artwork, not a canvas implementation of the marine `Artwork` interface.

```ts
import { createOwlArtwork } from 'ascii-animals-review/owl';
const owl = createOwlArtwork(document.querySelector<HTMLElement>('#owl')!, {
  owl: { seed: 7, headYawLimitDeg: 28, reactionStrength: 0.8 },
  grid: { cols: 96, rows: 54 },
});
owl.guide(0.5, -0.2);
owl.pulse(); // explicit blink → ruffle → stretch; may be ignored in cooldown
owl.pause();
owl.restart(); // preserves user pause
console.log(owl.exportText());
owl.dispose();
```

## Contract

`play`, `pause`, `restart`, and `pulse` are ergonomic aliases for `setPaused(false)`, `setPaused(true)`, `reset`, and `react`. Original methods remain available: `guide`, `leave`, `update`, `setGrid`, `getStatus`, `getSnapshot`, and `exportText`. The instance identifies `species: 'owl'`, its host `element`, and `disposed`.

The owning window shares one default animation scheduler with other integrated artworks. Each instance removes only its own subscription. An explicit borrowed `frameSource` or environment frame functions remain authoritative. Pause, hidden/offscreen state, reduced motion, a small host, and disposal suspend animation. Reduced-motion Guide/React displays an intentional still pose without advancing simulation. Play does not override that preference.

Configuration is validated before mutation. The full typed `OwlOptions` supports seed, bounded head yaw/pitch, attention smoothing, idle amplitude, reaction strength, feather contrast, and blink/ruffle/stretch/recovery/cooldown tick durations. Seed changes through `reset(seed)` rather than `update`. Browser options separately configure grid, initial pause, frame source, status callback and environment. Grid supports columns, rows and silhouette; browser cell aspect is fixed at 0.55. See [the species reference](../species/owl/README.md) for exact defaults, limits and action outcomes.

The pure `createOwl` model is DOM-free and uses absolute integer ticks via `advance(tick, orderedInputs)`, not elapsed milliseconds. `renderOwlGrid` exposes the text sampler and `makeOwlPoster` creates nonmutating still poses. The old speculative shared adapter proposal is deliberately not a public package export. `createArtwork({species:'owl'})` is not supported.

## Provenance and evidence

Imported the actual recovered Owl review ZIP's `source/species/owl` subtree, not its stale repository root. Source, numerical tests, historical handoff, manifests and rasterized GIF remain available under `species/owl`; historical results are not new integration/browser evidence.

Integration validation: original 40 Owl tests plus two factory/scheduler tests, 108 combined repository tests, strict TypeScript, real packed-package offline/SSR import, NodeNext/Bundler type consumers and esbuild fixtures. Generated `dist/owl` imports the compiled public factory, rather than an independent renderer. Browser typography, mobile layout and interactions require separate real-browser acceptance; no browser performance or font equivalence claim is made by numerical/mock tests. Nothing is published to npm by these checks.
