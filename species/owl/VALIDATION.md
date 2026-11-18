# Validation record

Scope: original Owl work only. The final base is main **`074b90a94bd3a747a68feed554e33a3ab0720f41`**, after the TypeScript foundation and catalogue merged during delivery. The original implementation base was `0e446c47b491b751d484e40db753ec725652b515`. The own branch was rebased without conflicts; all changes remain under `species/owl/`. Source/API provenance is in [compatibility](COMPATIBILITY.md). The pre-code brief was committed before implementation and remains the first species commit: `3e657f99b37f9faa400cffed37099bbbadebbc54` after rebase, formerly `f531cb726c01102673c34d38fee551e9137c2ef2`.

## Executed results

| Check | Actual result | Evidence type |
| --- | --- | --- |
| Strict TypeScript project build, 5.9.3 | Pass; emitted JS + declarations | Compiler, actual source |
| Strict positive/negative type fixtures | Pass; intentional wrong event/options/state mutation/unsafe resolver calls require errors | Compiler against emitted declarations |
| Species/core/geometry/adapter/host suite | **40 tests passed, 0 failed, 0 skipped** | Executed real core/geometry and actual merged scheduler; host infrastructure simulated |
| Deterministic replay | Same state/cells at1/2/5-tick render grouping | Numerical/logical, not cross-platform pixels |
| Maximum behavior sequence |1,220 ticks with maximum durations/amplitudes, extreme head bounds, planted attachments | Executed geometry/state tests |
| ASCII/bounds | Equal-width printable ASCII;57 surfaces;160×90 maximum logical cells; minimum-grid anchors | Executed text/geometry assertions |
| Skill authoring spec | Pass bounded JSON validator | Structure/bounds only, not certification |
| Skill validator + teaching reference checks |29 tests passed | Unmodified external skill evidence; no reference code copied into Owl |
| Existing Cuttlefish regression | Pass:60 geometry scenarios, finite projection, reaction order, targeting, neighbors, pause/reset, directions, encounter | Original suite uses stub Canvas/DOM |
| Existing JS syntax / standalone reproduction | Pass; generated standalone identical to base | Syntax + byte comparison |
| Merged foundation regression after rebase | **25 passed, 0 failed, 0 skipped** | Real facade/engine/scheduler; Canvas/DOM infrastructure simulated |
| Merged authoring bridge after rebase | **7 passed, 0 failed, 0 skipped** | Existing bridge and legacy renderer, simulated host |
| Merged canonical build/types/catalogue | Pass; current generated output byte-identical to final base | Build, strict TypeScript, static catalogue assertions and syntax |
| Independent review | Found and retested pause/config fixes; original39-test run and final40-test merged-base run + strict types passed | Independent automated review, not human approval |
| Visual evidence | Contact sheets,97 recorded logical frames,8 selected poses,6 minimum-grid/silhouette poses | Executed glyph output rasterized with Pillow |
| Actual browser | **Blocked before page launch** | Observed Chromium socket/ptrace denial; no browser result |

The initial full build caught TS7053 in the small adapter; the first subsequent test invocation therefore saw stale build output and failed. The explicit sample annotation fixed the compiler error, the build was regenerated, and clean complete runs passed. The final report is from a successful fresh build, not from the stale outputs. Review corrections and their reproductions are preserved in [REVIEW.md](REVIEW.md).

## Commands actually run

In `species/owl/`, with existing Nodev24.22.1 and TypeScript5.9.3:

```sh
OWL_TSC=/workspace/scratch/5bc33bd36e8d/toolchain/node_modules/typescript/lib/tsc.js node scripts/build.mjs
OWL_TSC=/workspace/scratch/5bc33bd36e8d/toolchain/node_modules/typescript/lib/tsc.js node scripts/build.mjs --types-only
node --test --test-reporter=tap tests/*.test.mjs
node --check demo/demo.mjs
node scripts/capture-logical.mjs
python3 scripts/render-evidence.py
```

Successful exit0 for each. `OWL_TSC` is an existing environment compiler; a reviewer should point it to their own installed5.9.3 compiler or install the pinned local development dependency. No runtime dependency installation was required. The Python renderer used Python3.12.14, Pillow13.0.0 and the installed DejaVu Sans Mono font, SHA-256 `54bf827eb99404e8f430c330ad30f063334f637eba0109b6a18d4f566a8e9dd8`. No font binary is bundled.

From repository root:

```sh
node --check dist/artwork.js
node --check dist/app.js
node scripts/check-engine.cjs
python3 scripts/build-standalone.py
git diff --exit-code -- dist/
```

Each exited0. The original Cuttlefish report had4,748,048 sampled points overall, maximum23,764 samples in one animal buffer, no nonfinite values and no near-plane clipping. The initial log is retained as `evidence/cuttlefish-regression.log`. These checks use stub Canvas/DOM; they are not a Cuttlefish browser claim. All current base files are byte-identical to the final merged base.

## Verification after the foundation and catalogue merged

The final branch was rebased onto `074b90a94bd3a747a68feed554e33a3ab0720f41`. The same TypeScript5.9.3 compiler was reused read-only through an ignored local dependency link; no dependencies were downloaded. The following current-main checks completed successfully:

```sh
node scripts/build.mjs
node node_modules/typescript/lib/tsc.js -p tsconfig.json --noEmit
node --test --test-reporter=tap test/*.test.mjs
node scripts/check-engine.cjs
node scripts/check-authoring-bridge.mjs
python3 scripts/check-catalogue.py
node --check dist/catalogue.js
python3 scripts/build-standalone.py
git diff --exit-code -- dist/ src/ types/ scripts/ package.json package-lock.json
```

The foundation suite passed25 tests; the authoring bridge passed7. The current numerical Cuttlefish script checks the preserved legacy fixture and passed its60 geometry scenarios. The current foundation suite additionally checks canonical generated-demo/source parity. The catalogue gate passed13 entries with only Cuttlefish available, preserving the coordinator's Owl integration status. Raw outputs are in `evidence/merged-main-tests.tap`, `merged-main-cuttlefish.log`, `merged-main-authoring-bridge.log` and `merged-main-catalogue.log`.

The strict Owl build/type fixtures and complete suite were rerun:40 passed,0 failed/skipped. The added test executes the actual merged `src/core/scheduler.js` with two Owls. It checks one shared RAF, independent pause/disposal, cancellation at zero subscribers, fresh resume and later scheduler reuse. Native RAF/DOM remains simulated. No geometry or behavior algorithm changed during the refresh, so the existing97 recorded grid hashes remain applicable and were verified against the refreshed build.

Package/tarball checks and browser QA reported by the foundation author were not rerun or adopted as Owl acceptance. This branch does not alter shared exports, runtime source, catalogue, dependencies or workflows.

The pinned skill's `scripts/validate-spec.mjs owl.authoring.json`, `scripts/validate-spec.test.mjs` and `assets/reference/core.test.mjs` were run from a separate read-only source evidence copy. All29 skill/reference tests passed. These are in addition to the40 Owl tests, not counted as Owl functionality.

## Visual and motion assessment

The contact sheet shows fixture ticks0,60,98,125,184,226,280,420: neutral, attention, blink, ruffle, stretch, recovery, cooldown and resting. The small-grid sheet contains front, left/right attention, static stretch, neutral silhouette and stretched silhouette at64×36. The independent reviewer found the owl recognizable and the eyes, beak, wings, feet and branch legible. The ruffle is deliberately subtle fine-plumage movement, with21/39 changed glyphs at minimum/default resolution in the reviewer's comparison.

The GIF is made from actual text grids every five simulation ticks (12Hz presentation of a60Hz simulation), with an explicitly disclosed repeat/reset seam. Numeric phase and attachment tests establish ordered, bounded motion. No reviewer claimed to watch real-time browser playback; normal-speed human motion assessment remains pending.

## Timing and resource evidence

[Node sampling measurements](evidence/node-sampling.json) record host/runtime and p50/p95/p99 for actual simulation plus geometry/text-grid work. These are opportunistic Node measurements over481 calls with120 warmup calls excluded. They are **not browser performance**, include no browser style/layout/paint or heap measurement, and do not establish the predeclared8ms/16ms browser targets.

Source/tests bound the model to96 surfaces (57 used),14,400 cells,16 events/core tick, at most2 coalesced host actions, five catch-up ticks/frame and no particles. DOM text has no Canvas backing store; DPR does not change simulation coordinates. Mocks assert owned scheduling/listener/observer cleanup and multi-instance isolation, not real-browser leak absence.

## Explicitly unrun or blocked acceptance

- Actual Chromium/Firefox/WebKit rendering, real keyboard traversal, focus visibility, font fallback, resizing and native observer timing.
- Actual live reduced-motion/hidden/offscreen interaction outside the simulated host suite.
- Normal-speed human review of the ruffle, wing motion and clip reset seam.
- Real-phone touch/scroll/reflow and a real screen reader.
- Browser30s performance workload after2s warmup, frame/paint intervals, long-session heap behavior and thermal/device comparisons.
- Framework double mount/unmount: no framework adapter is supplied or claimed.
- Canonical shared renderer/species contract, material/coordinate/identity consolidation and packed-package consumer integration.
- Deployment, npm publication or live-site acceptance; none was authorized or performed.

The exact Chromium failure is recorded in [browser-launch.txt](evidence/browser-launch.txt). `scripts/browser-smoke.mjs` is a runnable follow-up harness for a supported environment and is **not recorded as run here**. It deliberately reports blocked/failed status instead of fabricating screenshots or changing browser security settings.

Fixed-width `evidence/frame-*.txt` files deliberately retain trailing space cells and blank final rows. A species-local `.gitattributes` exemption covers those two whitespace rules only for these data files; source/document whitespace checks remain active. Removing those spaces would corrupt the declared row width.
