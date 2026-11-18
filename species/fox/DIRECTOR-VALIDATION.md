# Fox director validation ledger

## Identity and scope

Branch: `feat/director-fox`. Original inspected runtime release: `c06114404900884814bef879a02f1a49a3e7d590`. Final delivery base: `c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02` (README-only intervening update). Exact final head/tree and file SHA-256 values belong in the downloadable validation manifest; a committed document cannot contain its own resulting commit hash without a cycle.

The authoring template was completed and committed before implementation. The current skill at `23e078642157a273e2b886222470bd247e5737b5`, reviewed parent `e721252075a30888198aafba0953a23fd07bd3c6`, and linked template/references were applied. [Authoring](DIRECTOR-AUTHORING.md) records anatomy, rights, silhouettes, event sequence, motion states, small-grid limits, budgets and static alternatives.

## Executed checks

| Command / evidence | Result | What it establishes |
| --- | --- | --- |
| `npm ci --ignore-scripts --offline` | Passed against existing cache | Reproducible pinned TypeScript dependencies; no paid service |
| `npm run build` | Passed; package check independently rebuilt again | Canonical TS → Fox local modules → integrated package/demo; no shared build changes |
| `npm run --ignore-scripts test` after the build | **338 tests, 338 passed, 0 failed/skipped** | Existing all-species/root regressions and new Fox cases; [full log](evidence/director/full-regression-tests.log) |
| `npm run typecheck` | Passed | Strict root and species checks, including the original 16 plus 26 new Fox expected-error assertions at this run; [log](evidence/director/typecheck.log) |
| `node --test test/fox-director-integration.test.mjs test/fox-integration.test.mjs species/fox/tests/browser.test.mjs` | **25/25 passed**, overlapping the full suite | New 10 director integration cases, existing 3 root integration/parity cases, existing 12 browser cases; [mock log](evidence/director/browser-mock-tests.log) |
| `node species/fox/scripts/check-director-legacy-parity.mjs` | **3,600 exact state and 720 exact geometry/text comparisons passed** | Original no-director numerical compatibility with release Git objects; [result](evidence/director/legacy-parity.json) |
| `node scripts/check-package.mjs --report species/fox/.test-output/director-package/report.json` | Passed with explicitly unrun optional bundlers | Actual repeatable npm tarball, offline install, SSR/root exports, TypeScript NodeNext/Bundler and ES-only core declarations; [report](evidence/director/package-check.json) |
| `node species/fox/scripts/check-director-package.mjs species/fox/.test-output/director-package/ascii-animals-review-0.0.0-review.0.tgz` | Passed on the existing local tarball | New `./fox` director runtime/defaults/replay plus strict NodeNext/Bundler positive usage and 14 additional negative assertions; throwing DOM globals during real SSR imports; [report](evidence/director/fox-package-consumer.json) |
| `node species/fox/scripts/render-director-evidence.mjs` | Completed; stable compiled hashes through capture | Actual native Canvas geometry/glyph rendering, 15 sampled frames/text grids, two contact sheets, 193-frame GIF and preserved before/after |
| `git diff --check` | Passed | Whitespace sanity only; not semantic acceptance |

The complete runtime suite includes **31 new Fox tests**: 12 pure director cases, 3 routing/rest cases, 6 executable demo cases and 10 integrated browser-controller cases. It includes 72 Fox tests overall. Do not add the separate 25-case pass to 338; it is a targeted rerun of overlapping tests.

The final reusable Fox type fixtures contain **56 expected-error assertions**: 16 original, 17 director core, 9 browser director and 14 packaged-entry cases. The last fixture also passed the standard Fox no-emit project after it was added. The packaged-entry harness substitutes only its two declared imports with the actual root/`./fox` package names inside a temporary offline consumer. The tested tarball was 264,918 bytes with SHA-256 `df3e3d63a32b2e5c60c999302c164fb5f060955337037487b1417388b81e7afb`.

The model tests cover atomic options/inputs, deterministic grouping/reset, bounded count/identity, transient/cooldown suppression, multi-stage cue behavior, all three scenes, distinct pure tableaux, SSR/disposal, and three 2,160-tick extreme geometry arcs. Every sampled original pose retains four leg chains and normalized bounds. Renderer tests assert printable owner-indexed grids and correct portrait presented-coordinate routing. Controller tests use explicit DOM/Canvas doubles and the real integrated scheduler; they exercise shared ownership, pause/reduced-motion/visibility/zero-size policy, coalesced storms, callbacks and teardown. Demo tests execute the real UI JavaScript against DOM doubles, including actual command wiring and export snapshot metadata.

The packed-package checker did **not** run esbuild (not installed), Rollup (no usable resolver) or Webpack (unavailable). TypeScript's Bundler resolution check is not a bundler-runtime test. Local `npm pack`/offline installation does not publish to the registry. The review package stays private and UNLICENSED; final package naming/licensing remain central decisions.

## Native capture and critique

Native output uses installed Skia through `@napi-rs/canvas`, FFmpeg and an installed Liberation Mono font, whose exact version/path/hash are in [native-render.json](evidence/director/native-render.json). The font binary is not bundled. The renderer outputs printable ASCII using original Fox polygons; no ASCII art is copied. A finite seeded replay supplies seven ordered events and 960 ticks. Render sampling never drives model state.

The GIF is 800×684 including a separate metadata footer; the actual desktop scene is 800×640 at 160×64 cells. The portrait scene is 390×446 at 112×64 cells, also with a 44px footer in its PNG. FFprobe confirmed 193 frames and 16.08 seconds. All 15 text-grid hashes and both before-image hashes were checked. Native compilation hashes identify the code that made the pixels, even though the capture occurred before the final commit/rebase; final-manifest verification compares those hashes to delivered runtime files.

One bounded critique loop corrected a real visible ground-plane defect. The preserved first frame places the far fox above the horizon. The corrected frame at the same scene/seed/tick lifts the horizon and places sparse grass/contact marks behind all actors. Rest-path anchoring, portrait hit/gaze mapping, reset/facing and stale-callback fixes have focused executable regressions. [Review](DIRECTOR-REVIEW.md) records these findings and the remaining small-scale readability limits.

## Reproduce locally

```sh
npm ci --ignore-scripts
npm run build
npm run typecheck
npm run --ignore-scripts test
node species/fox/scripts/check-director-legacy-parity.mjs
node scripts/check-package.mjs --report species/fox/.test-output/director-package/report.json
node species/fox/scripts/check-director-package.mjs species/fox/.test-output/director-package/ascii-animals-review-0.0.0-review.0.tgz
node species/fox/scripts/render-director-evidence.mjs
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8000/fox/` for the generated public-wrapper demo. Native capture additionally requires already installed Canvas/FFmpeg/Fontconfig; the capture script does not install them. The source ZIP and Git binary patch are intended for the exact recorded base. Apply the patch to a fresh checkout and use the same commands. The source ZIP contains the complete Fox source/tests/demo/evidence, its public wrapper/bridges, required reproduction context, and PR/validation handoff files; it is not an alternate renderer or standalone package release.

## Acceptance not run

- Real browser rendering/normal-speed playback of this new demo. Cloud inspection of live Cuttlefish/old Fox succeeded, but workspace loopback preview returned `ERR_CONNECTION_REFUSED`.
- Physical touch, phone GPU/font behavior, 200% zoom, focus order and screen-reader announcements. Native portrait output and event mocks do not establish these.
- Measured desktop/mobile frame-time percentiles, memory stability over a long session, or multi-widget real-device load. Bounded allocations and nominal GIF fps are not measurements.
- Actual esbuild/Rollup/Webpack bundle consumers; their optional central checks are explicitly unrun.
- New deployed Pages bytes, owner creative acceptance, GitHub CI/review, merge and release. None is implied by local testing or draft publication.

All GitHub publication must follow delivery of downloadable source ZIP, binary patch, PR body, exact base/head hashes and validation manifest in chat. A failed or approval-blocked publication path stops without retries or bypasses. No merge, deployment, npm publish, force push, credentials/settings change or unrelated communication is authorized here.
