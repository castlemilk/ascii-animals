# Developer documentation validation — 21 November 2026

## Initial verification baseline and scope

Verified default branch **`main`**, commit
[`f63b20e2045b1070b10bde2efc4eb3a8536e606b`](https://github.com/castlemilk/ascii-animals/commit/f63b20e2045b1070b10bde2efc4eb3a8536e606b).
Both GitHub repository/branch metadata and `git ls-remote --symref … HEAD`
confirmed it; a final remote-head check remained unchanged. Checks took place on
21 November 2026, from 15:00 AEDT (04:00 UTC).

### Draft PR base refresh

Before the authorized branch push, `main` advanced to
[`3b5ffcce7bea56e1402fc16d0edc2c14c3cd5779`](https://github.com/castlemilk/ascii-animals/commit/3b5ffcce7bea56e1402fc16d0edc2c14c3cd5779)
through README PR #52. Comparing that commit with the initial baseline showed
only `README.md` changed; package configuration, runtime, declarations and tests
were identical. The documentation branch was rebased onto this new `main`,
preserving the merged README. Fresh PR validation uses a tarball from the rebased
documentation tree and records its separate digest in the PR description. The
initial tarball and Pages evidence below remain tied to their original source.

The review changes **`docs/` only**: installation/import guidance, the package
contract, 13-animal API map, ten dedicated species guides, marine configuration,
browser lifecycle guidance, two complete browser examples and reproducible
example verifiers. Historical import material is explicitly labeled. Root README,
package manifest, runtime, demo metadata and deployment configuration are outside
the patch. The initial local verification phase made no remote repository writes or PRs.
The owner subsequently authorized a new docs-only branch and a draft PR; its
description records the exact head and fresh test results. Merge coordination
remains with Bear. No merge, npm publication or deployment is part of this work.

## Source, live demo and npm

| Check | Observed result |
| --- | --- |
| Package manifest | `ascii-animals-review@0.0.0-review.0`, private, `UNLICENSED`, ESM, Node `>=20`, TypeScript `5.9.3`, no runtime dependencies |
| Public exports | 15 entries, each with actual JavaScript and declaration targets; no `/manta` or `/octopus` entry |
| Pages provenance | Successful deployment `7931525989` from the same SHA; [manual workflow run](https://github.com/castlemilk/ascii-animals/actions/runs/44660851191) completed successfully |
| Live HTTP | [Home](https://castlemilk.github.io/ascii-animals/) and all 13 `/animals/<species>/` routes returned HTTP 200 |
| Authored marine studies | `cuttlefish-study.html`, `manta-reef.html`, `octopus-den.html` and `cuttlefish-demo.html` returned 200; each was byte-identical to its `dist/` file at the pinned SHA |
| npm candidate | [Public registry endpoint](https://registry.npmjs.org/ascii-animals-review) returned HTTP 404; no published candidate artifact was available to execute |
| npm name collision | [`ascii-animals@1.0.1`](https://registry.npmjs.org/ascii-animals) points to `Prodicode/ascii-animals`, a different project |

Deployment evidence: [deployment list](https://api.github.com/repos/castlemilk/ascii-animals/deployments?environment=github-pages&per_page=5)
and [success status](https://api.github.com/repos/castlemilk/ascii-animals/deployments/7931525989/statuses),
dated `2026-11-20T02:30:42Z`. These checks establish provenance, HTTP availability
and matching study bytes. They do not establish live interaction acceptance.
Other local art prototypes and proposed generic variation controls remain outside
the documented source contract.

## Exact package used for example verification

`npm ci --ignore-scripts --no-audit --no-fund` and `npm run build` succeeded.
The verification tarball uses the runtime built from the pinned source; its
manifest, root README/notice and original top-level documentation were taken from
that exact git revision, before this documentation patch. It contains **210 files**,
**615,309 bytes**, and has SHA-256:

```text
6de35f80aabcf48a26e86ed5e227cba8758716de14a99ab40844fb532d51746b
```

Repacking after applying this docs patch changes tarball documentation and thus
its digest. The unchanged version string alone does not prove byte identity.
The verification scripts record the supplied tarball's digest and installed
manifest; they do not infer provenance from its name.

## Executed validation

Environment: Node **24.22.3**, npm **11.19.1**, TypeScript **5.9.3**.

| Check | Result and boundary |
| --- | --- |
| Isolated package consumer | PASS — installed the supplied tarball offline with scripts disabled and an empty temporary npm cache; no source symlink or type path alias |
| Documentation TypeScript | PASS — 25 actual fences from 14 guides, compiled under strict NodeNext and Bundler resolution: 50 fixture checks |
| Continuations and type assertions | PASS — 3 continuation fixtures use their actual prior code; 2 explanatory types match installed declarations; 3 expected static-error cases validated |
| Browser example JavaScript | PASS — `basic.js` and `director.js` checked with `checkJs` in both compiler modes |
| SSR imports | PASS — all 15 export entries imported in separate fresh Node processes with no browser globals |
| Export boundaries | PASS — `/lib/index.js`, `/manta` and `/octopus` rejected with `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| Standalone examples | PASS — 5 pure-model/import/normalization examples executed successfully |
| Source declaration suites | PASS — the repository's complete `npm run typecheck` command |
| Targeted source tests | PASS — 31 tests across public facade, lifecycle, scheduler and marine director suites; mock/numerical host tests, not browser pixels |
| Patch structure | PASS — whitespace check; changes limited to `docs/`; application to a pristine checkout of the exact base; resulting documentation bytes match the reviewed files |
| Documentation links | PASS — local file targets in changed Markdown resolve in the repository |

Browser-construction examples were **typechecked**, not executed as native
browser interactions. The marine invalid-input demonstration intentionally
contains runtime failures and is typechecked only. Continuation fixtures prove
declaration compatibility, not a runnable sequence after an earlier snippet's
cleanup.

## Browser execution and access limits

The exact tarball was also installed into a separate browser consumer. Its marine
renderer bytes matched the tarball. Playwright **1.62.1** was available, but the
bundled browser executable was absent. System Chromium terminated before opening
a page because the execution environment denied its process-singleton socket:
`socket() failed: Operation not permitted` (`SIGABRT`).

**Zero automated browser checks executed; no browser screenshots were produced.**
The connected Chrome fallback could not reach the workspace's loopback preview
(`ERR_CONNECTION_REFUSED`). No publication or remote preview deployment was used
to bridge that gap. GitHub source, deployment metadata, Pages HTTP and npm registry
access were available; the missing capability is a browser that can execute these
local examples in this environment.

The runnable verifier covers real Canvas output, native keyboard and touch
controls, initial/change reduced motion, paused invitations and octopus focus,
resize/zero-size recovery, cleanup/remount and actual back/forward-cache behavior.
It was syntax-checked, but its browser assertions remain unexecuted here. It does
not synthesize cache events or report mocked Canvas behavior as browser evidence.
Physical-device touch, screen-reader behavior, other engines and performance are
also unverified.

## Reproduce the checks

From a checkout containing this documentation patch, after building and packing:

```sh
node docs/verify-examples.mjs \
  /absolute/path/ascii-animals-review-0.0.0-review.0.tgz \
  /absolute/path/documentation-validation.json
npm run typecheck
node --test test/public-api.test.mjs test/lifecycle.test.mjs \
  test/scheduler.test.mjs test/marine-director.test.mjs
```

For native browser checks, first create the isolated consumer using
[Getting started](GETTING-STARTED.md). Make Playwright and a usable Chromium
available to the verifier. Its Node module resolution must find `playwright`;
it does not install tooling, modify the package manifest or download a browser.
An isolated tool directory can be supplied through `NODE_PATH`:

```sh
NODE_PATH=/absolute/path/browser-tools/node_modules \
node docs/verify-browser.mjs \
  --consumer /absolute/path/browser-consumer \
  --output /absolute/path/browser-evidence \
  --tarball /absolute/path/ascii-animals-review-0.0.0-review.0.tgz
```

Use `--executable /absolute/path/to/chromium` or `ASCII_CHROMIUM` for an already
installed browser; otherwise Playwright uses its installed Chromium. Review
`browser-validation.json` for actual passes/failures. A successful syntax check is
not a browser pass. Compact HTTP/deployment/registry evidence, package and compiler
reports, source-test logs and the failed browser launch record were retained with
the original downloadable review artifacts. They are not automatically attached
to a later PR. The PR description records its own exact head, tested tarball digest
and fresh results; the commands above reproduce the checks without those files.
