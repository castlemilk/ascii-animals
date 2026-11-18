# Gecko: explicit typed adapter

The source recovered from PR #9 (`848ae9af63466b95edc6e31fc9290266492c3b49`) is canonical under `species/gecko/src`. This integration preserves its four pad-toed stance/swing feet, planted toes, careful approach, startle → retreat → recovery → cooldown, long curling tail and deterministic ordered inputs. It does not replace the gecko with Cuttlefish geometry or claim a universal species engine.

```ts
import { createGeckoArtwork } from 'ascii-animals-review/gecko';
const art = createGeckoArtwork(canvas, {
  config: { seed: 7, options: { creepSpeed: .1, curlStrength: .8 } },
  view: { grid: 'auto', neutral: false, maxDpr: 2 },
});
art.guide(.4, -.2); // normalized world input
art.pulse(); // queued startle, or deliberate static curl if motion is suspended
art.pause(); art.restart(); // restart never overrides pause
art.play();
art.dispose(); // idempotent; never disposes a peer or borrowed scheduler
```

Root named `createGeckoArtwork` and `./gecko` reference the same factory. The subpath also exports the headless `createGecko`, options resolver/defaults/limits, and generated TypeScript contracts. All original controller methods remain available: update, setView, setPaused, guide, clearGuide, startle, reset, exportText, redraw, getSnapshot, getStatus, dispose. Lifecycle aliases add play/pause/restart/pulse, plus canvas/species/disposed metadata. There is no `any`-cast into another species.

## Timing and policy

The model has integer 60 Hz ticks, ordered events, bounded five-tick browser catch-up and explicit dropped-time telemetry. Browser mounts borrow the package scheduler by default, or a supplied `frameSource`; each owns only its subscription. Explicit source options/configuration are strict and bounded. Initial seed/heading are reset-only. Live options affect the original model semantics, not a generic renderer abstraction.

Pause, reduced motion, document visibility, page suspension, intersection, zero size and minimum 360 CSS-pixel width independently gate animation. Small layouts intentionally show the source demo's text fallback rather than an illegible tiny raster. Static curl does not override motion preferences. Neutral glyphs and text export are native source capabilities. Model getters return defensive snapshots; getStatus remains available after disposal.

## Build and verification

`npm run build` compiles the actual species TypeScript with the root locked compiler, compiles the public facade, and generates `dist/gecko/`. The demo imports the real public factory and has no remote runtime dependencies. The older source-local standalone remains research evidence, not the canonical package demo.

Original 32 species tests were independently rerun before changes. Integration adds shared-scheduler lifecycle, reduced-motion/static curl, base-validation regression, generated-demo and strict packed-consumer checks. Native browser QA is separate; mock tests and inherited images do not constitute fresh browser evidence. No performance speedup is claimed. Package remains private and UNLICENSED; no npm publication.
