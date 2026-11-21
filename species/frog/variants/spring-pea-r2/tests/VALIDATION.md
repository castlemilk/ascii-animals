# Spring Pea R2 — private validation

**The final private matrix passed 20/20, with no skips and no source changes during the run.** This is a new, additive reconstruction on current main `26ee6ffc623e0adb2256e66d5b7cefc9ff36c7dd`. It is not a recovery of the missing original patch/ZIP based on `f63b20e`.

The final run used Node `v24.22.3`, started at `2026-11-21T04:50:36Z`, and completed at `04:51:15Z`. [validation.json](validation.json) records the exact command, matching Git HEAD before/after, and before/after SHA-256 values for the wrapper, preview, pose, geometry, base manifest and all three test files. `final-tests.log` contains the complete TAP result.

The durable review ZIP is separate from this repository. Code-formatted evidence filenames below refer to that bundle; links point to files tracked here.

## Results and scope

| Gate | Result | Evidence type |
| --- | --- | --- |
| Five private contract tests | 5/5 | Numerical cell rendering and source fingerprints |
| Five private geometry/attachment/camera tests | 5/5 | Canonical state plus private posed geometry |
| Ten Original/R2 wrapper and lifecycle tests | 10/10 | Real controller, scheduler and numerical previews on controlled host doubles |
| Consolidated canonical Frog/public/scheduler tests on the final base | 83/83 | Existing unmodified tests, without duplicate integration imports |
| Private review toggle and visibility-bridge tests on the final base | 8/8 | Controlled DOM and event doubles |
| Repository typecheck, including Frog single/director API types | Passed | TypeScript |
| Tracked files changed from current main | None | Protected hashes match and `git diff --name-only` was empty |
| Actual candidate browser/device acceptance | Blocked | No browser acceptance claim |

The final canonical command passed **83 distinct tests**, recorded in `canonical-final-base.log`; `canonical-typecheck-final-base.log` records the successful repository typecheck. `review/review-tests-final-base.log` records the eight toggle, disposal, BFCache and bounded visibility-bridge checks. None is an actual browser test.

Earlier canonical runs on `3b5ffcce` are retained in `canonical-frog-baseline.log`, `canonical-pond-public-scheduler.log` and `canonical-typecheck.log`. Their 45/45 and 69/69 reported cases include 31 repeated pond/director cases through an integration entrypoint; they must not be reported as 114 unique tests.

Main advanced during reconstruction. [BASE-COMPATIBILITY.json](../BASE-COMPATIBILITY.json) records that the Frog tree, public factory, shared scheduler, root package files, README and build script are unchanged between the initial `3b5ffcce` pin and final `26ee6ffc` pin. Earlier native captures retain their original labels and exact runtime hashes. The `final-tests-at-3b5ffcce.log` and `validation-at-3b5ffcce.json` remain historical evidence; final acceptance uses the rerun on `26ee6ffc` above.

## Integration and preservation

The private wrapper calls the same compiled `createFrogArtwork` factory as Original and injects only `createSpringPeaPreview`. The public facade supplies its existing shared scheduler; the variant adds no model, timer, event queue or lifecycle owner. A mixed Original/R2 test verifies one pending animation-frame request, identical canonical states for the same actions, independent pause/disposal and complete resource release.

The contract suite verifies every protected file hash in [BASE.json](../BASE.json), including public Frog code, canonical model/controller/renderer source, package files and the root README. It also captures Original's default 144 × 80 cell output before variant import, draws the variant, then verifies both existing and newly created Original previews produce the same original text. Private wrapper validation matches the public facade for invalid option containers, and injecting the private factory leaves frozen caller options unchanged.

R2 cell exports remain printable ASCII and bounded. Rendering cannot mutate the canonical state. Single and pond sequences replay identically under 1/2/5-tick presentation grouping. Different mapped aims produce different latched landing points. The hunt replay reaches tracking, strike, settling and rest; a busy call stays ignored, while a later deliberate call is accepted and settles.

## Character and camera gates

The private geometry tests verify the tongue root lies on the sampled mouth seam in all supported views, four still poses, both extreme body sizes and opposite gaze directions. The root remains exact at every tested extension, and full extension reaches the bounded target exactly. Front expressions retain two separate cream eye regions containing their pupils. The leap has measured compression, broadening, launch extension, gathered descent and impact squash; planted toes do not slide during anticipation, and landing reaches the committed point.

The camera sweep infers the active camera from the actual `targetAt()` inverse mapping. It does **not** copy `springPeaCamera()` constants into the test. It reaches each legal corner through valid input events, then leaps in place at that corner in four views. Default, maximum and an intermediate body configuration are covered; phone and desktop shapes also exercise backing-size clamps.

The final sweep passed **5,456 frame/configuration/view cases and 1,008 fixed-camera checks** with the predeclared **3 px minimum geometric margin**:

| Edge | Smallest measured margin |
| --- | ---: |
| Left | 13.51 px |
| Right | 13.51 px |
| Top | 33.40 px |
| Bottom | 52.78 px |

The complete phase sweep uses a 320 × 240 logical stage. Additional rest/corner cases use 390 × 520 and 1440 × 1000 shapes. These are geometric sample bounds, not claims about glyph-pixel clipping for every font or browser, and they do not exhaust every continuous configuration.

Feeding checks covered **96 contact combinations**, including **28 reach-capped cases**, across two seeds, both body-size extremes, all actor counts/IDs and four views. Maximum contact travel was **0.00337 body scales**, below the unchanged 0.05 gate. Feeding waits until planted; the caught insect returns continuously and its effect slot is released.

## Supplemental outcome and pond API checks

These scripts are separate from the 20-test matrix and do not change its frozen runtime or test files.

[input-outcomes.mjs](input-outcomes.mjs) and [its result](input-outcomes.json) replay the exact private-review seed/configuration to tick 400. Choosing pad ID 1 versus 3 produces settled positions `(-0.02, -0.22)` versus `(-0.70, -0.58)`. Hunt aims `(0.36, -0.40)` versus `(-0.76, -0.70)` both catch their prey, return and settle on those different pads. The recorded phase transitions show anticipation, response and recovery. This establishes input-dependent model outcomes, not browser event delivery.

[check-pond-picking.mjs](check-pond-picking.mjs) and [its result](pond-picking-validation.json) check 1/2/3 actors at 720 × 440 and 390 × 520 with the same requested 180 × 100 grid. Every present stable actor ID is recoverable through the actual owner-cell picking API; an outside point returns `null`. The maximum inverse error for all six pad coordinates is **6.66 × 10⁻¹⁶**. No host animation frame is scheduled by the standalone preview.

| Viewport | Actors | Total samples | Per-actor occupied cells |
| --- | ---: | ---: | --- |
| 720 × 440 | 1 | 18,723 | 808 |
| 720 × 440 | 2 | 36,653 | 605 / 588 |
| 720 × 440 | 3 | 54,583 | 499 / 497 / 497 |
| 390 × 520 | 1 | 18,723 | 168 |
| 390 × 520 | 2 | 36,653 | 135 / 123 |
| 390 × 520 | 3 | 54,583 | 109 / 106 / 109 |

These cell counts establish owner presence and picking coverage. They are not an anatomy-recognition or phone-legibility rating.

## Input, suspension and cleanup

The parameterized Original/R2 lifecycle tests use the actual preview factories, canonical controller and shared scheduler. They verify focused arrow/Enter input, native form-key preservation, deliberately tapped touch events, drag/cancel handling, bounded pending inputs and committed landing targets. Reduced motion produces distinct static responses without advancing ticks or scheduling animation. Live preference changes enter and leave that mode correctly.

Offscreen, hidden and zero-size causes compose with explicit pause. Offscreen pointer traffic and frame delivery do not draw or advance the model; destructive backing resize is deferred until visible. Resume resets the clock and retains the five-tick catch-up ceiling. Disposal and setup failure release listeners, observers, frames and preview resources; saved callbacks are inert afterward.

These are controlled host-event tests. They do not establish actual touchscreen behavior, browser layout, assistive technology, device frame rate or browser heap stability.

## Historical fixture failures

The first logs are intentionally retained:

- `initial-contract-lifecycle.log`: 13/14 passed. The test incorrectly expected a motive named `hunt`; the canonical action actually proceeds through `track`, `hop`, `strike` and `settle`. The assertion was corrected to require the real stages.
- `fixture-and-wrapper-check.log` and `historical-busy-call-fixture.log`: the fixture expected a call at tick 200, while the hunt correctly remained in its settle phase until tick 225. The final test explicitly asserts that busy call is ignored, adds an accepted call at tick 240, and verifies rest by tick 400. `historical-busy-call-fixture-validation.json` records the earlier 19/20 result.
- `initial-geometry.log`: the first geometry pass preceded the final eye/tuck/lean refinement. Final acceptance uses the final log and hashes above.

These failures required test-fixture corrections, not changes to canonical behavior or weaker thresholds. No visibility, sample, backing, attachment, camera-margin or lifecycle gate was reduced.

## Reproduction

Build the canonical checkout using its existing documented build command so that `lib/public/frog.js` is available. Then, from the repository root:

```sh
node --test --test-concurrency=1 --test-reporter=tap \
  species/frog/variants/spring-pea-r2/tests/contract.test.mjs \
  species/frog/variants/spring-pea-r2/tests/lifecycle.test.mjs \
  species/frog/variants/spring-pea-r2/tests/geometry.test.mjs
node species/frog/variants/spring-pea-r2/tests/input-outcomes.mjs
node species/frog/variants/spring-pea-r2/tests/check-pond-picking.mjs
```

Run the private review-page tests with VM module support (including on Node 26):

```sh
node --experimental-vm-modules --test \
  species/frog/variants/spring-pea-r2/review/scripts/*.test.mjs
```

The exact consolidated canonical command on the final base was:

```sh
node --test --test-concurrency=1 \
  species/frog/tests/core.test.mjs \
  species/frog/tests/geometry.test.mjs \
  species/frog/tests/lifecycle.test.mjs \
  species/frog/tests/demo.test.mjs \
  species/frog/tests/feeding-endpoint.test.mjs \
  species/frog/tests/wetland-choreography.test.mjs \
  test/frog-integration.test.mjs \
  test/frog-director-integration.test.mjs \
  test/scheduler.test.mjs
npm run typecheck
```

The private files are deliberately absent from package exports, shared routes and the default renderer. The browser acceptance attempt for this R2 work was policy-blocked; no alternate route or weakened security setting was used. Native renderer stills/motion and editable concept files elsewhere in this review are separate evidence categories. Their existence does not convert this numerical/lifecycle matrix into browser acceptance.
