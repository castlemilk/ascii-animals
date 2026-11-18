# Pufferfish verification and review

## Outcome and evidence categories

The original pufferfish, typed model, local adapter, browser controller, demo and tests are implemented under `species/pufferfish/`. The branch is intended for **draft review against main `0e446c47b491b751d484e40db753ec725652b515`**. Canonical integration with PR2, browser acceptance and deployment are not claimed.

During delivery, main advanced to `074b90a94bd3a747a68feed554e33a3ab0720f41`, merging PR2 and the catalogue. That source was inspected read-only and its compatibility is documented in `PROVENANCE.md` / `API.md`. All results below remain tied to the exact tested base above. Migrating the bridge, rerunning against the new generated renderer and recapturing its pixels are outstanding integration acceptance; no historical result is presented as a new-main pass.

| Category | Actual result | Evidence / limitation |
| --- | --- | --- |
| TypeScript source build | Passed, strict TS 5.9.3 | Checked-in JS/declarations re-emit byte-identically |
| Emitted declaration consumers | Passed | Bundler, NodeNext and ES2022-only server fixtures; 28 intentional negative cases across consumer/server files |
| Pufferfish tests | **39/39 passed**, zero skipped | 14 model, 19 controller/resource-bookkeeping, 6 geometry/legacy-cell tests |
| Original Cuttlefish regression | Passed | Original harness: 60 geometry cases, no nonfinite/clipped samples, reaction/targeting/pause/direction assertions |
| Original standalone rebuild | Passed, byte-identical | Rebuilt in a temporary copy; shared files untouched |
| SSR-safe imports | Passed | Pure species, controller and painter imported without DOM globals; no browser construction implied |
| Skill JSON validation | Passed | Actual reviewed validator; structure/bounds only |
| Rendered procedural imagery | Captured and reviewed | Native Skia Canvas calls the existing glyph renderer; not a browser screenshot |
| Minimum-grid review | Reviewed | Front/left/right, neutral/inflated at actual 360×270 pixels / 72×40 cells |
| Motion | Tick replay, continuity tests and captured sequence reviewed | Actual 18.5-second/278-frame GIF; no claim of real-time browser playback or a seamless GIF loop |
| Real browser launch | **Blocked before page creation** | Chromium failed with `socket() failed: Operation not permitted` and `ptrace: Operation not permitted` |
| Browser keyboard/touch/accessibility/heap | **Unrun** | Mock resources and native pixels do not substitute |
| Browser/device performance | **Unrun** | Native draw timings were slow and do not meet or certify the proposed browser budget |
| Npm/canonical/deployed feature | **Pending / not performed** | No public pufferfish export, catalogue release, merge or deployment |

Machine-readable command receipts, exact source/build SHA-256 values and exit codes are in [`evidence/checks.json`](evidence/checks.json). Raw outputs are under [`evidence/logs/`](evidence/logs/). Native capture metadata is [`evidence/native-capture.json`](evidence/native-capture.json).

## Commands and runtime

Execution used Node `v24.22.1`, TypeScript `5.9.3`, Python `3.12.14` and native `@napi-rs/canvas` `0.1.100` on Linux x64. The existing compiler was supplied through `PUFFERFISH_TSC`; no package installation was needed.

```sh
node species/pufferfish/scripts/build.mjs
node species/pufferfish/scripts/verify.mjs
```

Those helpers use an existing compiler. `verify.mjs` additionally ran the reviewed skill validator when `PUFFERFISH_SPEC_VALIDATOR` pointed at the fetched `validate-spec.mjs`. The exact executable/arguments and exit codes are retained in the command manifest. Reproduction on another machine can use ordinary `tsc` commands listed in the README.

The verification run includes:

```sh
node --test species/pufferfish/tests/controller.test.mjs \
  species/pufferfish/tests/geometry.test.mjs \
  species/pufferfish/tests/model.test.mjs
node scripts/check-engine.cjs
node --check dist/artwork.js
node --check dist/app.js
git diff --exit-code 0e446c47b491b751d484e40db753ec725652b515 -- dist scripts README.md .github
git diff --check
```

The standalone builder was copied with its actual input files into a temporary directory and executed there; generated `cuttlefish.html` matched the base bytes. The source checkout's `dist/` was not rewritten.

The first verification-helper run exposed a manifest-reading bug: assembled contact sheets use `sha256`, whereas raw PNGs use `pngSha256`. The helper incorrectly read only the latter. It now discriminates the actual manifest shapes, requires a valid hash, and rechecks every output. No asset was regenerated or accepted by weakening a comparison.

## Meaningful model and input tests

The model suite verifies exact default duration boundaries, sustained dwell versus a passing pointer, aspect-corrected proximity, hysteresis, retreat during every reaction phase, smooth recovery from partial inflation, cooldown and retreat-to-rearm, repeated-approach suppression, same-tick retreat precedence, deterministic every-tick state under 1/2/5-tick presentation grouping, independent seeds/instances, and no ambient random/time dependency.

Malformed config and events reject atomically, including unknown keys, NaN, Infinity, strings, fractional/out-of-range seeds and durations, invalid event discriminants, stale/duplicate/reversed sequences, wrong ticks, missing pointer coordinates and oversized batches. Reset/configure preserve old immutable snapshots and start the documented fresh run. A static poster never advances simulation or leaves a latent target.

An independent reviewer caught explicit `events:null` being accepted by `?? []`. The implementation now distinguishes omission from malformed null. The regression remains in the suite.

## Geometry, cells and bounds

Geometry is sampled across three seeds, all three quality levels, inflation-scale extremes and representative ticks in both reactions. Tests check finite coordinates/light, allowed material indices, fixed anatomy parts, both eye/pupil landmarks, body-intersecting fin/tail roots, fixed 42-spine count and bounded sample output.

| Quality | Actual samples | Limit |
| --- | ---: | ---: |
| Small | 4,572 | 16,000 |
| Standard | 7,994 | 16,000 |
| Fine | 12,922 | 16,000 |

Largest configured inflation remains inside the minimum-grid frame in all accepted views. Actual painter sample counts equal emitted geometry counts, so near-plane rejection did not silently discard samples in those tested cases. Exported text has exact row widths and printable ASCII/newlines only. The actual legacy cell pipeline gives identical output for the same log under 1/2/5-tick presentation grouping.

Native captures use the same `makeAtlas`, `_put`, `_rasterize` and `render` implementations from pinned main. The bridge does not instantiate the Cuttlefish constructor, so it introduces no inherited input handlers, polling loop, cuttlefish state or ink effects. The numerical fake verifies that painter construction creates no listeners, RAF or observers. The source hash test fails if the legacy dependency changes.

Hard caps include 16,000 samples, 160×90 cells, 16 input events/tick, two pending DOM input slots, five catch-up ticks/frame and zero particles. Main canvas backing is capped at 3.24M pixels. The existing atlas is a separate source-bounded allocation up to 9,331,200 pixels under this bridge's largest cells/DPR; actual browser/GPU memory was not measured.

## Lifecycle tests and fixes

The 19 controller tests use resource-accounting DOM/Canvas doubles with the actual legacy methods. They cover:

- Independent user pause, reduced motion, hidden, offscreen, zero-size and compact-view causes.
- Static touch/keyboard-equivalent actions in reduced, paused and compact views.
- Pause preservation through reset, config updates and visibility/preference changes.
- 7,000 incoming pointer/action events remaining within two pending slots.
- CSS-rectangle normalization under reflow and DPR 1/2/3.
- Safe retreat on pointer leave/cancel/lost capture/blur.
- Five-tick catch-up and dropped-time accounting; fresh clock after resume.
- Failure rollback, throwing callbacks, late RAF/observer/font callbacks, idempotent destruction, two independent instances and ten repeated mounts.
- Immediate stop when a transition callback pauses, destroys, resets or reconfigures during a catch-up frame.

Independent review found three concrete implementation defects and retained regression tests:

1. A `null` render patch could bypass raw validation through object spread. Raw patches now validate first.
2. A synchronous pause/destroy callback could leave the current frame advancing additional ticks. A clock-generation check stops it immediately.
3. Reset/configure from a callback could reuse an old accumulator and clock. The same generation invalidation discards stale work.

These tests prove the bookkeeping contract under the fake environment. They do not prove browser event delivery, DOM layout, screen-reader narration or absence of real-browser memory leaks.

## Bounded visual critique

The first native neutral/inflated pair was inspected independently from the geometry implementation. The round body and inflation were readable, but the neutral fins looked like tiny lateral smears, and the three-quarter eye pair was too compact.

One bounded correction changed only fin/eye geometry:

- Eyes grew from `0.17 + 0.025 × inflation` to `0.205 + 0.025 × inflation` and moved 0.03 local units forward.
- Fin spans grew to 0.56/0.62 plus 0.08×inflation, with rounder paddle outlines, stronger rims and roots intersecting the expanding shell.
- Body shape/shading, spines, sample counts and behavior timing remained unchanged.

| Before | After |
| --- | --- |
| ![Initial neutral frame](evidence/critique-before-neutral.png) | ![Revised neutral frame](evidence/native-neutral.png) |
| ![Initial inflated frame](evidence/critique-before-inflated.png) | ![Revised inflated frame](evidence/native-inflated.png) |

Final review confirms that the near paddle breaks the body silhouette clearly and the eye pair is stronger. The opposite fin remains more foreshortened in the three-quarter view; front view shows both paddles. The rear tail naturally occludes in front view and remains less prominent than the eyes/fins. This is a stylized pufferfish, not a scientific species model or a blind human recognition study.

Default, minimum-grid and neutral-tone contact sheets were inspected. Neutral-tone review preserves face contrast; it is not a flat silhouette-mask test. Actual grid dimensions are recorded, rather than inferred from the planned authoring dimensions.

## Captured sequence and motion evidence

The fixed seed-23 sequence starts with distant input, approaches at tick 61, retreats at tick 220, approaches again at tick 610 and retreats at tick 780. Final state is idle at tick 1110 after exactly two reactions.

| First encounter boundary | Tick |
| --- | ---: |
| Nearby approach begins | 61 |
| Belly inflation begins | 90 |
| Spine stage begins | 132 |
| Full hold begins | 168 |
| Retreat / recovery begins | 220 |
| Deflation complete / cooldown begins | 370 |
| Rearmed idle | 550 |

The GIF was decoded after encoding: **278 frames, 18,500 ms, 480×270, 986,439 bytes**. It uses a shared 64-color palette and intended 15-frame capture cadence; original PNGs preserve the authoritative unquantized frames. The loop repeats a seeded recording and is not asserted to have a perfect end-to-start animation seam. The live model has continuous oscillator phases and no periodic forced restart.

Motion assessment combines ordered actual frames with numerical continuity, phase/bounds and repeat-trigger tests. No one is claiming normal-speed interactive browser observation from this native/offline capture. Browser playback remains an explicit acceptance step.

## Performance evidence: no fabricated pass

The predeclared browser target was 5 seconds warmup plus 30 seconds at default quality, p95 step+draw ≤12 ms / p99 ≤20 ms. **That scenario did not run.**

Native capture timings are available, and they were slow:

| Native metric | Observed |
| --- | ---: |
| Model step p95 | 0.0766 ms |
| Native draw median | 508.0 ms |
| Native draw p95 | 1,672.3 ms |

This single shared-host Skia run pools replay, checkpoints, minimum-grid and monochrome draws, with no benchmark warmup. Draw measurements exclude PNG encoding/GIF assembly. They are not comparable to the proposed browser scenario and are not a frame-rate pass. Encoding the GIF at intended cadence does not turn these timings into real-time performance. No renderer optimization or speedup claim is made; profile the accepted canonical pipeline on a declared browser/device before release.

## Remaining acceptance

1. Real Chromium/Firefox/WebKit page rendering, default/minimum/large views, font fallback, DPR changes, zoom/reflow and actual keyboard/touch use.
2. Screen-reader behavior, focus visibility and contrast under actual browser rendering.
3. Real-browser heap/resource tracing, long sessions and framework mount/unmount if a framework adapter is later claimed.
4. Declared desktop and constrained-phone profiling with warmup/workload/timing breakdown; native capture is insufficient.
5. Central acceptance of the typed species/host contract and generated renderer. The now-merged PR2 facade accepts only literal `species:'cuttlefish'`; its changed atlas needs a deliberate bridge migration and new parity evidence on main `074b90a94bd3a747a68feed554e33a3ab0720f41` or its successor.
6. Canonical npm build inclusion, package subpath, tarball consumer and cross-species composition tests if those are added centrally.
7. Catalogue availability/demo linking and any Pages deployment remain with the coordinator after review. This PR changes no shared release files.

No browser security settings, credentials or permissions were changed to work around the launch failure. No merge, npm publication, paid service or deployment was performed as part of this species work.
