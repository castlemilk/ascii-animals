# Executed checks and acceptance boundary

## Exact source identities

- Required GitHub base: `7e5984d34a139b8de4643f1ed0607897a42d88dc`, draft PR #1,
  branch `feat/cuttlefish-microsite-import`.
- All 21 imported file blobs match local microsite source
  `afcce9941c5fa13ca5c658564e73388e603dff14`. Local hosting metadata is excluded.
- Original renderer Git blob: `cecc7fc7f33ce5c6232d4c4bf8668b08dba7848b`.
- Original renderer SHA-256:
  `381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91`.
- Candidate renderer SHA-256:
  `2697d484f9cb23e5e2248600d1a39d6121d505f787a29eea6d41006abd56d062`.
- Candidate scheduler SHA-256:
  `f39ac308f3eda2186ffb1e50da1fccc69128a94d7c91952629ad27cbe97792cd`.

These identities describe code that was inspected and executed locally. They do
not identify a new deployed Site version. The supplied conversation transcript
and live runtime were inaccessible (HTTP 403; Chat tab-read tools unavailable).
Site metadata links the project to that conversation and identifies saved
version 4 with source `6214a09171fa328beec984edd6533c33e83ce9f1`, an older source.

## Numerical and lifecycle checks actually executed

On Node v24.22.1, Linux x64:

| Check | Result | Scope |
| --- | --- | --- |
| Imported `scripts/check-engine.cjs` | PASS | 60 geometry cases, 4,748,048 instrumented samples overall, max 23,764 of 36,000 sample slots, zero non-finite/clipped samples detected; click ownership, reaction order, neighbor continuity, pause/reset, reverse routes, encounter hold |
| `node --test test/*.test.mjs` | 20 PASS, 0 failures/skips | Scheduler, lifecycle, budgets, manual time, source parity and replay |
| Fixed-step source parity | PASS | 1/4/12 animals; matching fish/ink state and hashes of sample/depth/owner/glyph buffers against imported `dist/artwork.js` |
| Same-sequence replay | PASS | Two fresh candidate instances reproduce the same state under identical step/input sequence |
| Final independent probes | PASS | Atlas cap, long thin grids, buffer cleanup, continuous options preserve clock advancement |

The 20 candidate tests include shared scheduling; zero subscribers while paused,
hidden, offscreen or zero-sized; fresh-time resume; preference transitions;
idempotent destruction; inert later mutators; construction rollback; missing
ResizeObserver fallback; independent documents; invalid pointer positions;
main/grid/atlas/axis bounds; bounded manual stepping; clock continuity during
control/size changes; callback error isolation; and subscription changes during
dispatch. Canvas calls in these checks are stubs. They establish numerical and
ownership properties, not browser raster correctness.

## Package checks

The supplied `scripts/check-package.mjs` was exercised using Node v24.22.1,
npm 11.9.0, TypeScript 5.9.3, and esbuild 0.25.12. It verifies:

- Copy-only build and every explicit export/declaration target.
- `npm pack --dry-run --json --ignore-scripts` and actual local pack, matching
  file lists, restrictive allowlist, and repeated identical tarball bytes.
- An actual offline install of that tarball with install scripts disabled.
- Fresh-process root, cuttlefish and core ESM imports without DOM globals;
  root/subpath identities; all public method names; blocked private imports.
- Strict TypeScript consumers in NodeNext and Bundler resolution modes, including
  expected-error negative cases, plus a DOM-free core-only consumer.
- Real esbuild package resolution and tree-shaking for core, root/core, animal,
  and unused-root imports, with output bytes, gzip bytes, hashes and module graph.

The exact final tarball hash, file list, sizes and execution receipt are in the
companion `package-check.json`. They are kept outside this packed document to
avoid a self-referential tarball hash. Missing optional toolchains are reported
as NOT RUN by the script; they are never silently counted as passes.

No React hydration, CJS build, Rollup/webpack/Vite consumer, real-browser Canvas,
GPU, screen-reader, touch, or device-performance claim follows from these tests.

## Measured CPU paths, not browser FPS

Each population has 45 warmup callbacks and 120 measured callbacks per repetition,
five repetitions: 600 measured callbacks. Configuration is 947×707 CSS pixels,
DPR 1, density 1.1, glow on, reactive scene, independent formation. The host is a
shared Linux x64 system with Intel Xeon Platinum 8573C and Node v24.22.1.

| Animals | Import median | Candidate median | Import p95 | Candidate p95 |
| --- | ---: | ---: | ---: | ---: |
| 1 | 1.123 ms | 1.187 ms | 2.464 ms | 3.285 ms |
| 4 | 3.409 ms | 4.062 ms | 5.613 ms | 5.945 ms |
| 12 | 9.900 ms | 11.206 ms | 13.469 ms | 22.854 ms |

No CPU rendering speed improvement was demonstrated. The candidate observations
are slower in this run, and both shared-host noise and different automatic/manual
drivers limit causal comparison. The baseline uses queued rAF; the candidate uses
manual `advance`. End-state glyph/grid/sample/visible counts and draw-command
counts match; final time differs only about 1.47e-13 seconds from timestamp
arithmetic. This is a useful reproducible CPU-path baseline, not a controlled
regression verdict or a claim that the candidate meets a 60 fps device budget.

Canvas rasterization, blur execution, GPU, layout, frame presentation, device
power and retained browser memory are excluded. A controlled representative-device
comparison remains required before performance claims or adopting defaults.

## Calculated budgets

The imported 3840×2160 CSS canvas at DPR 2 has 33,177,600 backing pixels, or
126.5625 MiB under a four-byte RGBA8 storage assumption for the main canvas alone.
The baseline's five canvas surfaces total approximately 131.922 MiB under that
assumption, plus approximately 4.898 MiB of typed arrays/ImageData in the supplied
calculation. These are formulas, not measured memory. They exclude driver copies,
padding, object heaps and implementation overhead.

The candidate's default main bitmap limit is 8,294,400 pixels (31.640625 MiB under
the same main-surface assumption), with separate grid and atlas bounds. This is
a requested allocation ceiling, not a measured process-memory saving. Browser
memory and visual quality at effective downscaled density/DPR still need review.

## Not executed / remaining acceptance

`bench/browser-benchmark.html` is a real-Canvas measurement fixture and the small
`examples/` host demonstrates library integration. Their scripts were syntax
checked; neither was exercised in a browser during this review. No new GIFs or
screenshots were recorded. Existing imported GIFs remain historical evidence.

Before a release candidate is adopted: reconcile the coordinator's current head;
choose license/name/support policy; integrate the full microsite and exporter from
one canonical source; complete the browser/accessibility/input matrix; run real
Canvas/device benchmarks; and verify the eventual release artifact. No npm
publication, remote push, issue/PR creation, merge, deployment, credential or
shared-setting change was performed by this review.
