# Local package checks and future release acceptance

[Documentation](README.md) · [Package/import contract](PACKAGE.md) · [Browser setup](GETTING-STARTED.md) · [Performed validation](VALIDATION-2026-11-21.md)

`ascii-animals-review@0.0.0-review.0` remains a private local review package with `license: "UNLICENSED"` and publication deliberately disabled. The commands below build, pack and test locally. Package naming, licensing and a future publication require separate release decisions; this documentation change does not publish or deploy anything.

## Source and rollout boundary

On 21 November 2026, the default branch was verified as `main` at [`f63b20e2045b1070b10bde2efc4eb3a8536e606b`](https://github.com/castlemilk/ascii-animals/tree/f63b20e2045b1070b10bde2efc4eb3a8536e606b). This is the source baseline for the current developer documentation and its examples.

The linked [GitHub Pages catalogue](https://castlemilk.github.io/ascii-animals/) was deployed from that same SHA by successful [workflow run 44660851191](https://github.com/castlemilk/ascii-animals/actions/runs/44660851191); [deployment 7931525989](https://api.github.com/repos/castlemilk/ascii-animals/deployments/7931525989/statuses) reports success at `2026-11-20T02:30:42Z`. Home and all 13 canonical animal routes returned HTTP 200 during this review. The [Pages workflow](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/.github/workflows/pages.yml) manually builds and deploys `demo/out/`; subsequent source edits do not automatically update the live site.

The [original integration review](INTEGRATION-REVIEW.md) records the earlier import, saved-site history and then-open checks. Its PR #1 baseline and historical access restrictions do not describe the current branch or deployed demo. Use the [dated validation record](VALIDATION-2026-11-21.md) for checks performed on this documentation patch; the procedures below are not a claim that every release gate has been run.

Recheck the target branch before applying a patch or releasing. Preserve later animal work and resolve overlapping changes against the actual target commit. Local-only variants or new APIs require their own source, package and deployment evidence before being described as shipped.

## Package shape

The [current manifest](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/package.json) is ESM-only with **15 export-map entries**: `.`, `./cuttlefish`, `./core`, `./fox`, `./dragonfly`, `./gecko`, `./pufferfish`, `./frog`, `./owl`, `./seahorse`, `./crab`, `./turtle`, `./butterfly`, `./movement`, and `./movement/marine`. Each entry must have real JavaScript and declaration targets in the packed tarball. [PACKAGE.md](PACKAGE.md) maps their APIs, type-only exports and director import boundaries. There are no `./manta` or `./octopus` entries: those species use the marine factories. No framework adapter is exported; the runtime dependency graph is empty.

The public [registry endpoint for `ascii-animals-review`](https://registry.npmjs.org/ascii-animals-review) returned 404 on 21 November 2026. The existing [`ascii-animals@1.0.1`](https://registry.npmjs.org/ascii-animals) belongs to another repository, `Prodicode/ascii-animals`. Validate this project using its exact local tarball, not that registry name.

The current `files` list includes `lib/`, root `README.md`, `NOTICE.md` and `docs/*.md`; npm also includes `package.json`. Nested examples and demo HTML/media are repository resources, not packed examples. Preserve this boundary and check the actual tarball for unintended files. Keep `private: true` and `license: "UNLICENSED"` until the owner decides otherwise.

ESM imports should have explicit relative `.js` suffixes where required. Validate declarations under both `moduleResolution: NodeNext` and `moduleResolution: Bundler`; a test that only imports source by relative path misses package-export failures. `types` conditions should precede runtime conditions. A CJS build is a later compatibility decision with its own declarations and parity checks, not an automatic requirement for a browser-first first release. [Package/type references](SOURCE-REFERENCES.md)

## Local verification sequence

Read scripts before running them. The exact commands and outputs actually run by this review belong in its verification log; this section describes the repeatable release procedure, not an execution claim.

1. Check the source commit/tree and review diff. Record Node/npm/tool versions and machine metadata.
2. Build from canonical source into a clean output directory. Rebuild again and compare bytes, excluding deliberately variable metadata. A deterministic build does not imply a deterministic tarball unless its metadata is also controlled.
3. Run numerical compatibility checks and lifecycle tests for the changed species. For marine changes, include targeted click ownership, neighbors continuing to move, reaction order, scene/formation reset behavior, pause preservation, direction reversal, and arm movement during the encounter hold. Use each [animal's own contract](ANIMAL-APIS.md) for other species.
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
| Visual compatibility | Changed species' supported scenes, populations, poses and interactions; marine independent/each route, 1/4/12 fish, size/density extremes, palettes, point mode, glow on/off | Captures or review notes against the correct source baseline; no missing anatomy or clipping regression. |
| Input | Mouse/touch/pen if supported; zero-size event; enter/leave; click visible overlapping fish; rapid repeated sweeps | Correct target, no empty-water hit, no scroll blocking, agitation behavior preserved. |
| Playback | Manual Pause, explicit Play, restart paused, startle paused, reduced-motion initial/change | No silent resume; stable paused image and clear control state. |
| Visibility | Hide/return tab, scroll off/on screen, zero-size/show, detach/dispose | No stale callbacks or time jump; no unrequested auto-resume. |
| Resize | Orientation, fullscreen, CSS resize, DPR change, repeated equal size, very large canvas | Bounded effective bitmap/cells, sensible appearance, no growth after repeated cycles. |
| Lifecycle | 50 mount/dispose cycles; two canvases; dispose one while the other runs; constructor failure | Listener/observer/scheduler counts return to baseline; independent state preserved. |
| Framework | SSR import; host-framework development mount/cleanup/remount | No browser-global import failure, duplicate loop, hydration error, or retained disposed renderer. |
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

The package and generated browser-global demos have different loading contracts: npm consumers use ESM imports, while generated legacy pages supply their own bridge. Do not copy a `window.CuttlefishArtwork` example into a package consumer or import an unexported internal file. Build scripts regenerate both outputs from canonical source; validate generated output when its inputs change.

Reduced-motion, paused interactions, resize, disposal and manual-stepping semantics differ across species. Marine `pulse()` does not resume playback; `advance()` is a bounded explicit manual driver, not seek. Effective DPR/cell caps can reduce detail on very large screens. A safe server import does not establish hydration correctness or server-side image rendering. Review the [animal contracts](ANIMAL-APIS.md) and [browser setup](GETTING-STARTED.md), and attach the actual verification results to any release proposal.
