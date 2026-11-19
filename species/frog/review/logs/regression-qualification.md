# Frog regression qualification

## Commands and baseline

Exact baseline: `b8f222dab868821f27bf2a64a98434f3483fc8e6`, read from an isolated unchanged checkout.

```sh
FROG_TEST_ROOT=/absolute/path/to/baseline-checkout \
  node --test --test-reporter=tap species/frog/tests/native-regressions.test.mjs
node --test --test-reporter=tap species/frog/tests/native-regressions.test.mjs
node --test --test-reporter=tap species/frog/tests/feeding-endpoint.test.mjs
node --check species/frog/scripts/check-browser-regressions.mjs
node --check species/frog/tests/native-regressions.test.mjs
node --check species/frog/tests/feeding-endpoint.test.mjs
```

The native command passed **2/2 on the baseline and 2/2 on the final generated candidate**, with raw results in `regression-baseline-native.log` and `regression-candidate-native.log`. The numerical feeding/raster test passed **2/2** on the final generated candidate. Syntax checks passed for all three new files. `regression-source-hashes.json` pins every canonical and generated frog module plus the new test/runner code used. These tests do not edit production or generated source.

## What the native checks establish

The first case mounts the actual generated controller with real native Canvas pixels and controlled host callbacks. The second executes the actual generated demo module, changing only its import binding to the same actual controller, against a small DOM double and real native Canvas. They establish bitmap preservation/redraw and scene-label publication under explicit event order; they do not establish a browser's observer timing, physical touch, layout, accessibility or performance.

Checked scenarios: 720×440 desktop, 390×520 phone, 360×260 DPR2, paused/reduced motion, zero-size restoration, offscreen scene changes, deferred destructive resize, lagging intersection visibility reconciliation, current radio/title state, focused-key static hunt after a pose, and idempotent disposal. The pixel gate is fixed at more than 200 pixels with at least one channel above 60 and more than 24 distinct bright colors, with a fully opaque background. These are nonblank gates; anatomy recognition is judged from separate full-resolution visual evidence.

## Native host qualification and failed iterations

An initial unadapted controller/native run was killed by SIGKILL, matching the deferred mutable-atlas cache issue. No browser/source patch was made to accommodate it.

The native test host snapshots each exact completed atlas to PNG, awaits `loadImage` decoding, and uses its immutable decoded Image during `drawImage`. It predecodes the declared viewport/DPR fixtures, then matches the newly rebuilt atlas by SHA-256 during the synchronous controller call. This preserves synchronous controller semantics and exact model/cell/atlas source. PNG reimport has a small native rounding/sampling delta; it is not claimed bit-identical to mutable-native-canvas or browser pixels. See the visual evidence's `native-atlas-parity.json` for the measured comparison.

A prior synchronous Image.src bridge reported complete/dimensions before pixels decoded. The new nonblank gate caught zero bright pixels with labels off; the demo-only check could have passed on label pixels. That failed run is retained in `regression-baseline-native-initial.log`. Awaiting full decode fixed the harness while keeping the pixel thresholds unchanged.

## Numerical feeding and raster checks

The endpoint test replays actual hunts for two seeds, the minimum/maximum supported body sizes, one/two/three actors and all four views. **96 contact cases** passed, including **28 cases that hit the reach cap**. Maximum normalized movement at contact was **0.0033693 body scales**, below the predeclared 0.05 limit. The attached prey returns toward the mouth and releases its effect slot.

The separate bounded raster case uses the exact geometry, projection, depth, glyph and sample code with Canvas method doubles. It makes two calls overlap a strike and six water ripples in all three scenes. Peak observed work was **59,075 total samples / 5,321 environment samples**, under the unchanged 60,000 / 6,246 caps. All three actor owners remain in the logical field. This is numerical budget evidence, not a Canvas pixel or browser performance result.

## Browser status

The Chromium runner was **not executed** after the main agent observed a process-singleton socket denial and the supported cloud browser could not reach the local server. No browser result is supplied by these tests.

For central browser acceptance after compiling and serving `dist/`:

```sh
node species/frog/scripts/check-browser-regressions.mjs \
  http://127.0.0.1:8000/frog/ /absolute/path/to/browser-evidence
```

It records source and served-asset hashes, real Chromium screenshots, pixel metrics, offscreen scene controls, viewport restoration, reduced-motion keyboard/pointer/touch-emulation actions, explicit pause persistence, live hop/hunt completion and disposal. It makes no security-flag workaround attempt. An emulated phone is not a physical-device result.
