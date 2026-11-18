# Integration review — 2026-11-18

## Provenance and scope

This branch combines the npm-library Pro candidate and additive legacy authoring bridge against import commit `7e5984d34a139b8de4643f1ed0607897a42d88dc`. The coordinator read the original Cuttlefish conversation and recovered its newer source directly; the research reports retain their own narrower access limitations as historical evidence.

- [Authoring research](https://chatgpt.com/c/6afd5a39-3804-83ec-933a-23f5c94958ad)
- [Library research](https://chatgpt.com/c/6afd5a4e-a820-83ec-8c6e-54516f270e1d)

The original `dist/` files and imported GIFs remain byte-identical. The package candidate lives in `src/`, with generated `lib/` ignored. Neither is silently represented as the other. No npm publishing, production deployment or merge was performed.

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

1. Consolidate the package and microsite/recorder/source-viewer/offline export into one canonical source with generated compatibility output. Until then this is an experimental extraction, not an accepted replacement renderer.
2. Perform visible browser acceptance for lifecycle transitions, exports, recording, pointer ownership, responsive layouts and old/new visual parity. Recapture demonstration media only after acceptance.
3. Measure browser timing on representative devices. Shared-host stub-Canvas CPU results do **not** show a speedup and must not be described as improved FPS or power efficiency.
4. Final npm name, license and publication authorization remain unresolved. `private: true`, `UNLICENSED` and the publish-blocking script remain in place.
5. Track 3 animal definitions and Track 1 teaching core are separate proposed contracts. Reconcile them before integrating species into the public package.

The legacy controller intentionally wraps the unchanged baseline; its policy suspension does not fix the baseline engine’s retained RAF subscription. Use the new package lifecycle directly for the extraction experiment, not both wrappers on one canvas.
