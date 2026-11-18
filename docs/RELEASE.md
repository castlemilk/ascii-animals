# Local package checks and future release acceptance

This review does not publish npm, modify a remote, create issues/PRs, merge, deploy, or change credentials/settings. `ascii-animals-review@0.0.0-review.0` is a private local review identity. No claim is made that `ascii-animals` or any proposed scope is available in a registry. Package naming and license require an owner decision.

## Source and rollout boundary

The initial GitHub read found `main` at `84bd1f84fab0f5f5dec053c0d10562c10be8c188` with `.gitignore` only. Local site HEAD was `afcce9941c5fa13ca5c658564e73388e603dff14`. Site metadata linked the project to conversation `6afd2c72-71ec-83ec-b182-835c5e7f86b1`, with accessible saved version 4 at `6214a09171fa328beec984edd6533c33e83ce9f1`. Full conversation and live-site runtime access were blocked. The coordinator then identified draft PR #1, branch `feat/cuttlefish-microsite-import`, head `7e5984d34a139b8de4643f1ed0607897a42d88dc`. Its 21 imported blobs match the local snapshot, excluding hosting metadata. This exact import commit is the patch base. The candidate modifications remain local; neither saved-site parity nor deployment is implied.

The coordinator should compare the delivered base hashes against the branch they actually own. Apply a patch only after checking its prerequisite tree and resolving overlapping work. Do not overwrite later school/animal changes with the snapshot. Preserve the original source snapshot separately until the package and demo have equivalent acceptance evidence.

## Package shape

The candidate is ESM-only with explicit `.`, `./cuttlefish`, and `./core` entry points. Each entry must have real JavaScript and declaration targets in the packed tarball. Root and animal imports expose `CuttlefishArtwork`/`createCuttlefish`; core exports scheduling support. No React adapter is claimed. Keep the default runtime dependency graph empty.

Use a restrictive `files` list. Exclude site HTML, GIFs, screenshots, benchmark output, test fixtures, untracked recordings, source-custody archives, local deployment metadata, and credentials. Include README, declarations, implementation files, and license/notice material appropriate to the owner's decision. The absence of a LICENSE in the inspected tree cannot be repaired by inventing a permissive grant. Keep `private: true` and `license: "UNLICENSED"` through this review.

ESM imports should have explicit relative `.js` suffixes where required. Validate declarations under both `moduleResolution: NodeNext` and `moduleResolution: Bundler`; a test that only imports source by relative path misses package-export failures. `types` conditions should precede runtime conditions. A CJS build is a later compatibility decision with its own declarations and parity checks, not an automatic requirement for a browser-first first release. [Package/type references](SOURCE-REFERENCES.md)

## Local verification sequence

Read scripts before running them. The exact commands and outputs actually run by this review belong in its verification log; this section describes the repeatable release procedure, not an execution claim.

1. Check the source commit/tree and review diff. Record Node/npm/tool versions and machine metadata.
2. Build from canonical source into a clean output directory. Rebuild again and compare bytes, excluding deliberately variable metadata. A deterministic build does not imply a deterministic tarball unless its metadata is also controlled.
3. Run numerical compatibility checks and lifecycle tests. Keep the original known behaviors: targeted click ownership, neighbors continue moving, reaction order, scene/formation reset behavior, pause preservation, direction reversal, and continued arm movement during the encounter hold.
4. Run SSR import in a fresh Node process without browser globals. Exercise every public runtime entry, declaration entry, and blocked internal subpath. Do not instantiate a browser canvas on the server.
5. Run `npm pack --dry-run --json --ignore-scripts`, inspect the manifest, then `npm pack --json --ignore-scripts` after the explicit build. Compare the actual tarball file list to the allowlist. Neither command publishes a package.
6. Install that exact local tarball into a temporary consumer with scripts disabled and network disabled/offline mode. Test bare package imports and the documented subpaths; do not test only workspace symlinks.
7. Compile representative typed consumers in NodeNext and Bundler modes. Include invalid options expected to fail type checking so that an accidental `any` declaration does not pass unnoticed.
8. Run a production bundle fixture, one importing the animal, one importing only core, and one importing nothing. Capture output bytes and module graph. Check that unused animals, React, browser-global wrappers, and page code are absent where expected. One bundler result does not certify every bundler.
9. Execute the browser acceptance matrix below and record exact devices/browser versions. Repeat the benchmark with the same scenarios and renderer settings, and retain raw output.
10. Have the release owner resolve license, final package name/scope, version policy, supported runtimes, provenance, and publication authorization. This review stops before publication.

`npm pack` supports both JSON and dry-run output. Script suppression is deliberate here because the explicit build has already been inspected and executed. Verify output freshness with hashes rather than rely on a `prepack` hook that silently changes files. [npm pack reference](https://docs.npmjs.com/cli/v11/commands/npm-pack/)

## Browser acceptance matrix

| Area | Scenarios | Required evidence |
| --- | --- | --- |
| Visual compatibility | Three scenes; independent/each route; 1/4/12 fish; size/density extremes; palettes; point mode; glow on/off | Captures or review notes against the correct source baseline; no missing anatomy or clipping regression. |
| Input | Mouse/touch/pen if supported; zero-size event; enter/leave; click visible overlapping fish; rapid repeated sweeps | Correct target, no empty-water hit, no scroll blocking, agitation behavior preserved. |
| Playback | Manual Pause, explicit Play, restart paused, startle paused, reduced-motion initial/change | No silent resume; stable paused image and clear control state. |
| Visibility | Hide/return tab, scroll off/on screen, zero-size/show, detach/dispose | No stale callbacks or time jump; no unrequested auto-resume. |
| Resize | Orientation, fullscreen, CSS resize, DPR change, repeated equal size, very large canvas | Bounded effective bitmap/cells, sensible appearance, no growth after repeated cycles. |
| Lifecycle | 50 mount/dispose cycles; two canvases; dispose one while the other runs; constructor failure | Listener/observer/scheduler counts return to baseline; independent state preserved. |
| Framework | SSR import; React development mount/cleanup/remount if adapter adopted | No browser-global import failure, duplicate loop, hydration error, or retained disposed renderer. |
| Accessibility | Keyboard-only controls, screen-reader description, fallback, reduced motion | Named buttons, no per-frame announcements, readable static alternative. |
| Export | PNG still; current page source viewer; standalone HTML rebuild; recorder | Downloads use the candidate-derived engine; no missing imports/offline failures. |
| Performance | Representative desktop and phone, explicit viewport/DPR/quality, scene and ink cases | Warmup, sample count, p50/p95/p99, frame cadence, long tasks, allocation/heap observations. |

Browser names in a proposed matrix are not support claims. Record Chrome/Firefox/WebKit/Safari/iOS versions actually exercised. Native browser validation and accessibility review remain acceptance tasks if the environment cannot run them.

## Performance report requirements

Record the source/candidate hashes, scenario options, viewport, effective DPR/cell count, browser/Node version, operating system, CPU/device, run order, warmup, frame count, repetitions, and what was timed. Keep raw JSON/CSV, median and tail latency, and any outliers. For an optimization comparison, alternate baseline and candidate order and avoid concurrent unrelated CPU work when possible.

Different claims need different evidence:

- Fewer queued callbacks: scheduler/listener-count test or browser tracing.
- Less JavaScript work: controlled CPU benchmark and profile.
- Lower heap churn: allocation profile or appropriate GC-aware measurement.
- Higher frame rate: actual visible browser run with presentation/cadence evidence.
- Lower power use: device-level measurement; a pause fix alone does not quantify battery savings.

Do not convert stubbed-Canvas Node milliseconds into browser FPS. Do not call calculated typed-array capacity measured memory. A benchmark harness is useful even when a run reports no speedup; publish that result honestly.

## Compatibility risks to review

The candidate introduces import-safe ESM and explicit subpaths, so the original `window.CuttlefishArtwork` script consumer needs a bridge or a module-based demo update. The candidate defaults can pause for reduced motion and visibility; zero-size no longer renders a fallback canvas. `pulse()` no longer silently resumes or emits the old resume event. `advance()` is a bounded manual driver, not seek. Effective DPR/cell caps may reduce detail on very large screens. Shared scheduling must not let one instance's exception prevent other instances from continuing. Original source viewer and standalone builder assume a single global script, so they must be tested after any integration. These changes warrant a prerelease and visual review even when numerical tests pass.
