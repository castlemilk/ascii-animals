# Current integration status

The TypeScript/canonical renderer foundation merged through PR #2 at `246dc33875d1270c11f6f3612614744e6f97562d`. The package remains private and unpublished. The root is now the animal catalogue, with the interactive study at `dist/cuttlefish-demo.html`. The review history below records evidence and limitations at the time of each review; it is not a current release announcement.

# Integration review — 2026-11-18

## Provenance and scope

This branch combines the npm-library Pro candidate and additive legacy authoring bridge against import commit `7e5984d34a139b8de4643f1ed0607897a42d88dc`. The coordinator read the original Cuttlefish conversation and recovered its newer source directly; the research reports retain their own narrower access limitations as historical evidence.

- [Authoring research](https://chatgpt.com/c/6afd5a39-3804-83ec-933a-23f5c94958ad)
- [Library research](https://chatgpt.com/c/6afd5a4e-a820-83ec-8c6e-54516f270e1d)

The package engine is canonical in `src/`. `npm run build` generates `lib/`, the browser-global `dist/artwork.js`, and offline `dist/cuttlefish.html`. The recorder and source viewer consume this same generated browser script. A source hash and reproducibility tests reject stale output. Imported GIFs remain historical recordings, not new-browser evidence. The exact original renderer is frozen under `test/fixtures/` only as a regression oracle.

## Independently rerun acceptance

On macOS arm64, Node 26.7.0:

- Copy-only ESM build passed.
- All 20 scheduler, lifecycle and numerical parity tests passed.
- All 7 authoring bridge cases passed against the real imported renderer with browser stubs.
- Existing numerical suite passed: 60 geometry combinations, 4,748,048 samples overall, no non-finite geometry or clipping in tested cases; targeted reaction order, neighbor movement, pause/reset, direction reversal and encounter hold passed.
- Actual local npm tarball, repeatability, offline installation, SSR import and private-subpath rejection passed.
- Strict TypeScript NodeNext/Bundler fixtures passed with TypeScript 5.7.3; four esbuild 0.28.2 production tree-shaking fixtures passed. Rollup/webpack not run.
- Browser/GPU/visual/touch/accessibility validation and measured heap retention were not run during integration.

Test commands: `npm run build`, `npm test`, `node scripts/check-authoring-bridge.mjs`, `npm run test:legacy`, `npm run check:package`. Optional TypeScript/esbuild checks require explicitly selected existing toolchains; consult the PR for their final outcome.

## Merge and release blockers

1. Canonical-source migration is implemented: bounded dependency-free global generation, the same source hash, offline bundling, module/global state parity and frozen legacy comparisons. Browser acceptance remains separate below.
2. Bounded visible Chrome acceptance completed as recorded below; cross-browser, strict file-protocol offline execution, accessibility and measured browser performance remain release coverage limitations. Existing GIFs remain historical.
3. Measure browser timing on representative devices. Shared-host stub-Canvas CPU results do **not** show a speedup and must not be described as improved FPS or power efficiency.
4. Final npm name, license and publication authorization remain unresolved. `private: true`, `UNLICENSED` and the publish-blocking script remain in place.
5. Track 3 animal definitions and Track 1 teaching core are separate proposed contracts. Reconcile them before integrating species into the public package.

The legacy controller remains an optional historical integration example and is regression-tested against the frozen baseline. The main microsite uses the canonical engine directly, not two controllers on one canvas.

## Canonical browser acceptance (Chrome, 2026-11-18)

Independent visible Chrome QA of the canonical build verified:

- Population bounds 1/12; diagonal/vertical/independent/random routes; role enable/disable and Orbit; school presets.
- Pause/play; reset preserving pause; deliberate reactive sequence; source modal showing the generated engine/hash.
- Dynamic reduced-motion change and reload starting paused.
- Desktop and 390-pixel mobile layout, no visible horizontal overflow, controls usable.
- PNG capture and 8-second school recording reach completion; actual downloaded PNG validates at 1845×1427, actual VP9 WebM at 1436×900 decodes with no errors, last packet timestamp 7.967 seconds.
- Standalone HTML executes over HTTP, with working Solo encounter and Pause. A discovered CSS-import removal defect was fixed, covered by regression tests, and retested on desktop/mobile.
- No browser console errors observed in these flows; temporary viewport/media emulation cleared.

The standalone file has embedded CSS/engine/app, no remote font import, and reproducibility checks. Direct `file://` browser execution was **not run** because the browser tool disallows that URL protocol; no bypass was attempted. This is not an assertion of a device-wide offline browser test. GPU performance, heap-retention measurements, full assistive-technology support and cross-browser compatibility remain unmeasured. These are release/coverage limitations, not claimed performance gains.

The added first-class TypeScript API work is separate from this canonical-browser acceptance and must rerun affected tests before merge. No npm release is authorized here.
