# Validation, independent critique and remaining acceptance

## Result

**36 species tests pass**, the strict TypeScript build and generated-declaration consumers pass, and the unchanged cuttlefish regression and standalone rebuild pass. Native Canvas glyph frames, a contact sheet, a smallest-grid poster and a 91-frame GIF were produced and independently inspected. **Real-browser acceptance is blocked before page launch.** Nothing is merged, published to npm or deployed by this work.

Implementation base: `0e446c47b491b751d484e40db753ec725652b515`, branch `feat/animal-dragonfly`. The entire proposed change is under `species/dragonfly/`. Main was rechecked at the same hash before publication preparation. The coordinator then merged PR #2 and PR #4 during publication. A separate detached checkout at newer main `074b90a94bd3a747a68feed554e33a3ab0720f41` plus the copied Dragonfly directory passed the additional checks below. The merged TS facade remains cuttlefish-only and the generic writer sketch is unchanged. See INTEGRATION.md.

## New-main coexistence check

The exact record is [integration-main.json](evidence/integration-main.json). It combines current main `074b90a94bd3a747a68feed554e33a3ab0720f41` with Dragonfly implementation commit `32d653de9bf85581d90c42fce72229d5dbaa54fc`. The only executed species-code change afterward is check-runner metadata: it now records the actual checked checkout HEAD separately from the fixed original implementation base.

| Check on newer main | Observed result |
| --- | --- |
| `node scripts/build.mjs` | TypeScript facade and canonical demo generation pass |
| `node --test test/*.test.mjs` | **25/25** library regression tests pass; numerical/server and stubbed lifecycle evidence |
| `python3 scripts/check-catalogue.py` | Pass; 13 unique catalogue entries, local links/anchors and preserved study/standalone |
| `node scripts/check-authoring-bridge.mjs` | **7/7** stubbed authoring-bridge tests pass |
| `node species/dragonfly/scripts/check.mjs` | Strict build/type consumers, **36/36** species tests, cuttlefish numerical regression, syntax and standalone reproducibility all pass again |
| `git diff --exit-code -- dist` | Exit 0; no shared generated output changed |

The newer-main standalone checksum is `56e0752721b76efa7805f359c7164631d9dea944715072a046c5bedb1438bdc4`, unchanged by rebuilding that checkout. It differs from the original-base checksum recorded below because the coordinator's intervening canonical generation changed main. These checks establish coexistence, not generic species-renderer integration, browser acceptance, package publication or deployment.

The initially reused compiler was no longer present when this optional follow-up began; both setup failures are retained in the raw record. TypeScript 5.9.3 was then installed in this task's own temporary tools directory with lifecycle scripts disabled. No source or dependency configuration in another checkout was edited. No other-author branch was changed, and no merge or rebase was performed.

## Evidence categories

| Evidence | Actually executed / observed | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| TypeScript 5.9.3 | Strict source build; generated declaration consumer; 14 negative cases | Typed options/events/results, discriminants, API declarations, intentional type rejection | A universal shared species API |
| Node 24.22.1 numerical tests | 18 model tests | Replay, seeds, atomic inputs, bounds, attached geometry, response continuity, state ownership, writer reporting | Raster pixels or browser input |
| Node preview tests | 4 tests | ASCII row widths/glyphs, bounded grids, no clipping in extreme supported motion/views, invalid grids and numeric letterboxing | Font/device visual fidelity |
| Browser-host bookkeeping stubs | 14 tests | Scheduled-resource ownership, suspension, reset/pause, coalescing, static controls, failed setup and disposal | Browser observers, native touch, screen-reader behavior or heap leaks |
| Existing cuttlefish harness | `node scripts/check-engine.cjs`, exit 0 | Baseline numeric regressions preserved, including original targeting/reaction/encounter | Browser parity or a new library integration |
| Native Canvas 0.1.100 | Actual `@napi-rs/canvas` text rendering of the same cells/painter | Pixel appearance of this native renderer; original geometry; sequence capture | Browser rendering, GPU pacing, live pointer or deployed state |
| Chromium 156.0.8078.79 with Playwright 1.62.1 | Attempted launch, exit 1 before page execution | Exact environment block and reproducible runner | No browser pass of any kind |

Raw test output: [checks.json](evidence/checks.json). Browser failure, with empty executed-test/artifact arrays: [browser/report.json](evidence/browser/report.json). Rendering environment, event fixture, frame/tick/phase/state hashes: [render-metadata.json](evidence/render-metadata.json). File digests: [source-manifest.json](evidence/source-manifest.json).

## Commands and results

The recorded check runner executes from repository root:

```sh
node species/dragonfly/scripts/build.mjs
node species/dragonfly/scripts/build.mjs --check
node --test species/dragonfly/tests/model.test.mjs \
  species/dragonfly/tests/preview.test.mjs species/dragonfly/tests/browser.test.mjs
node scripts/check-engine.cjs
node --check dist/artwork.js
node --check species/dragonfly/scripts/browser-smoke.mjs
python3 scripts/build-standalone.py
```

All above commands exited 0 in the original-base recording. TypeScript was already installed in the workspace and selected through `DRAGONFLY_TSC`; that initial recording required no package installation. The standalone checksum stayed exactly `edd0bc75c960c24e04d94864e750bf8ce5b254ae818d6af74b3a5f001062c5f2`. No root/dist files changed. The later temporary compiler installation is described above; no paid service was used.

The actual skill's bounded JSON validator accepted `authoring.json`. Its own 8 tests passed after the required cuttlefish example fixture was fetched; the first local run had 7/8 with an ENOENT because that reference fixture had not yet been downloaded. No validator behavior or threshold was changed. The teaching ray implementation was read as a reference and was not copied into this species.

Native evidence command:

```sh
node species/dragonfly/scripts/render-evidence.mjs /tmp/dragonfly-render
```

The installed native Canvas module was selected through `DRAGONFLY_CANVAS`. FFmpeg converted the actual 15 fps PNG sequence to the supplied GIF. Python 3.12.14, Node 24.22.1 and the host's installed fonts were used. No font binaries ship. `fc-match monospace` reported DejaVu Sans Mono; exact native Canvas fallback selection was not instrumented, and cross-platform pixel identity is not promised.

The real-browser runner was executed with installed Playwright and `/usr/bin/chromium`. Chromium aborted during process initialization: `socket() failed: Operation not permitted`, followed by `ptrace: Operation not permitted`. No local page was reached and no browser screenshot was generated. No security configuration was changed to work around the denial.

## Substantive test coverage

- Identical state, sample and logical-cell output for the same seed/log rendered every 1, 2 or 5 ticks. Distinct seeds change phase without changing topology.
- Strict defaults; nonfinite/wrong-type/out-of-range inputs; whole-batch rejection for stale/duplicate/out-of-order event sequences; <=16 events/tick.
- Full-mode tracking speed/acceleration/heading/root limits under abrupt target reversals, and slow-mode pace semantics.
- Explicit dart → recover → cooldown order, ignored repeated triggers, independent cubic interpolation verifying incoming and terminal path velocity.
- Four wing roots sampled at their own thorax attachments; rigid blade lengths; finite tones/samples; ten tapering abdomen segments; caller-owned geometry.
- Frozen nested state/options; paused/static steps consume neither tick nor sequence; reset preserves configuration and pause; disposed mutators reject without affecting another instance.
- Writer preflight causes no partial writes on known capacity shortage; later writer refusal reports exact partial output.
- Small/max grid ASCII-only export, finite projection and zero clipping through extreme supported motion; explicit rejection of malformed/oversized grid and samples.
- 5,000 pointer events coalesce into one target; 500 repeated actions occupy at most one pending dart; taps guide without implicitly darting.
- User pause OR reduced motion OR hidden OR offscreen OR zero size composes correctly; maximum five catch-up ticks; excess elapsed time reported, no hidden-time replay.
- Independent/repeated mounts, listener/observer/RAF cleanup, setup failure rollback, callback-failure rollback and late callback guards. These remain mock resource checks, not memory-leak certification.

## Bounded independent critique and fixes

Reviewers received the actual brief/types/source and raw native frames, without an expected verdict. The interface reviewer first confirmed that neither merged main nor the incoming generic sketch supplies an accepted shared species renderer. It recommended the original small preview and an explicitly provisional writer adapter.

| Finding | Evidence before fix | Change | Verification after fix |
| --- | --- | --- | --- |
| Missing required replay options silently defaulted | A log without `options`, or with `options: undefined`, was accepted | Require the metadata object before creating the model | Both cases now reject; atomic replay tests pass |
| Abdomen popped when wing phase wrapped | Near-seam tip jump **0.0549701314** world units; ordinary tick test showed a **0.0527363597** wrap step versus **0.0035159754** ordinary maximum | Replace the fractional wrapped-phase harmonic with a smaller integer-period curve | Independent near-seam delta **2.158834918e-9**; default tick-step bound <0.006 and relative continuity test pass |
| Paused full-mode “Change pose” did nothing | `setStaticPose(1)` left sampled geometry byte-identical; zero logical cells changed | Explicit pose also selects a deterministic seed-relative wing phase | **374 cells change** at 120×64 oblique; tick stays 0, pause stays true, motion stays full; no RAF starts |
| Eyes merged into one bright cap | Overlapping eye domes at centers ±0.132, radius 0.145; native default/small frames confirmed it | Centers ±0.17 and radius 0.128 create a medial valley | Independent default and 72×44 re-review identifies two lobes more clearly; four wings and abdomen remain readable |
| Host exposed a mutable owned model | `getModel()` could bypass pause/dispose ownership | Replace it with frozen state/options snapshots | Ownership regression passes; browser status behavior is a typed discriminant |
| Late saved keyboard callback could mutate disposed host | Source review of callback lifetime | Guard after disposal | Saved keyboard/frame/observer callbacks perform no further work in bookkeeping tests |

The first contact-sheet composition also stretched frame proportions. Its layout now preserves the 840×580 frame aspect at half size. The final image is not distorted.

Before/after evidence: [before-eye-separation.png](evidence/before-eye-separation.png) and [frame-000.png](evidence/frame-000.png). Small-grid phase review: [small-grid-wing-phases.png](evidence/small-grid-wing-phases.png). Full sequence: [contact-sheet.png](evidence/contact-sheet.png) and [dragonfly.gif](evidence/dragonfly.gif).

## Resource results and honest performance boundary

Actual emitted geometry is **4,348 samples** against a predeclared 6,144 cap. The six selected default frames occupy 622–634 cells and clip zero samples. The tested 72×44 extreme-motion views also clip zero samples. These are workload/geometry measurements, not achieved FPS.

Hard limits are one specimen, 160×88 cells, 16 events/tick, two pending browser actions, five catch-up ticks/frame, DPR <=2 and 1,200×700 logical backing area (3.36M pixels maximum). No particles, mesh downloads, telemetry or external requests are involved. Pointer coordinates use CSS rectangles; glyph projection uses explicit 0.68 aspect letterboxing.

Predeclared **browser** targets remain p95 simulation+draw <=8 ms and p99 <=16 ms at 900×600 after 3 s warmup over 30 s. They are **unmeasured** because the browser did not start. A 15 fps GIF and quick Node tests do not meet or measure those targets. No native-Canvas timing is substituted for browser/device evidence.

## Remaining acceptance for the coordinator

1. Execute the included real-browser runner on a supported host; inspect the actual page, keyboard focus, DPR/resize, scrolling, touch emulation, live reduced-motion changes and fallback UI.
2. Review real phone interaction, 200% zoom/reflow and screen-reader narration. Native controls and descriptive markup are implemented; no WCAG conformance claim is made.
3. Profile browser timing and long-session memory on named desktop/mobile hardware. Normal-speed interactive playback has not been observed in this environment; the evidence is a native frame sequence plus temporal/numerical review.
4. Consolidate species types, ticks/inputs, material IDs, camera/ownership semantics and disposal policy with the central TS library migration. The supplied writer fits only the documentation sketch; mixed-species scenes, npm exports and framework adapters are not accepted.
5. Decide whether/how the species is included in the catalogue and manual Pages deployment. This PR does not edit shared catalogue or deployment files.

Draft status is deliberate. The implementation, tests and visual evidence are concrete and reviewable, while these remaining gates remain plainly open.
