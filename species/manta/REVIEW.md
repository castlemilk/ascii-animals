# Compact review manifest

**Status:** source and native evidence ready for review; real-browser acceptance
pending. Base: `b8f222dab868821f27bf2a64a98434f3483fc8e6` (main verified by Git and
GitHub API). Branch: `review/manta-reef-shadows`. Review date: 19 November 2026.

**Owned scope:** `src/animals/manta.js` and `species/manta/**`. Public typed
exports, shared engine, other species, generated shared entries, package and
workflows are unchanged. No merge, deployment or Work conversion was performed.

**Reconciliation:** preserves removal of the earlier candidate's two raised
dorsal eye discs. Adds swept flexible pectorals with tip/chord lag, a flatter
disc, a broad head, fuller attached cephalic lobes, neutral charcoal/ivory dorsal
material, and a continuous trailing tail. No reference photo or model is bundled.

**Two sequences:** tangent-led current glide with anticipation, lower-energy
sailing and recovery; interactive counter-bank → ~1.12-radian bank → slow unroll
over 8.8 seconds. Habitat: three subdued reef strata, a projected shadow, sparse
sediment, two small sea fans and current tracers. The barrel bank is authored
motion, not a natural feeding somersault simulation.

## What ran

| Gate | Recorded result |
| --- | --- |
| Full isolated `npm run build` | Passed |
| Full `npm test` | 618 passed, 0 failed, 0 skipped |
| `npm run typecheck` | Passed |
| `npm run check:package` | Passed with optional toolchain checks unrun |
| Manta runtime/geometry/UI suite | 23 passed, 0 failed, 0 skipped |
| Manta strict NodeNext fixture | Passed |
| Self-contained study build and `--check` | Passed; nine actual source modules |
| Native capture | 14 PNGs; 1100×620 and 390×470; seed 17 |
| Native motion | 32s current loop at 10fps; 13s bank clip at 15fps, bank at t=2s |
| Numerical clipping sweep | 1,530 cases per viewport; no sampled clipping |

The UI integration test executes the actual study module and adapter against a
mocked DOM populated from its HTML. It checks real glyph changes, controls,
held-key suppression, still labels, scheduling and disposal. Native button
keyboard activation is simulated; this is not browser accessibility acceptance.

The clipping sweep's minimum projected margins were 21.32px at 320×470,
23.58px at 390×470, and 71.66px at 1100×620. These are numerical host results,
not browser or device performance measurements.

Package checks covered packing, reproducible bytes, offline consumer install,
SSR, method identity, private-subpath blocking, NodeNext/Bundler TypeScript
fixtures and a core-only no-DOM fixture. **esbuild, Rollup and Webpack checks
were not run.** The exact status is `passed-with-unrun-optional-checks`.

## Evidence boundary

- Native backend: `@napi-rs/canvas`, actual built renderer, mocked browser
  bookkeeping. Matched comparisons use identical options, viewport, seed and
  240 × 1/60-second ticks. Final presentation is rendered normally; intermediate
  presentation draws are suppressed without skipping simulation.
- A native glyph-crop cache avoids backend atlas-snapshot memory growth. It does
  not change geometry/cells; a direct/cached comparison found one of 873,600
  RGBA channels differed by 1/255.
- Actual Chromium launch was attempted, but the runtime rejected socket
  creation (`Operation not permitted`). The connected cloud browser rejected
  the local-file URL under its allowed HTTP(S) protocol policy. No workaround,
  external hosting, deployment or Work conversion was attempted.
- Browser layout, actual focus/accessibility, touch scrolling/cancellation,
  Safari/Chrome font rasterization and real-phone performance remain unverified.
  Mocked-host interaction assertions are reported separately from native images.

## Source identity

Canonical manta SHA-256:
`507867c9c284da28d7ca6e625b68e45b7e59ae4a6e6e5d9f60fa769f3e2e14d6`

Director SHA-256:
`ac63714bea5aaff497c525f3347f156d548470eb1e6709b575e5738c1edc8f42`

The private review archive contains complete runtime hashes, raw validation
logs, package report, numerical sweep, capture metadata, full-size originals,
labelled comparisons, movies and the independent patch. Reproduction and
central generation commands are in `README.md`. The patch carries source only;
the complete reef study is not silently added to the stable package exports.
