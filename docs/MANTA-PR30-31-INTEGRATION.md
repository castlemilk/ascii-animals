# Local-only PR30 + PR31 integration review

Sources: PR30 `422ec16651f9db8dd7e6219bc77a92fe2471c044`, PR31 `bf7b74267176983089a82f2a95bcd0256ce3c623`, common main `b8f222dab868821f27bf2a64a98434f3483fc8e6`.

Resolution: retain PR30 wholesale, overlay PR31 `species/manta/**` and exact `src/animals/manta.js`. No cuttlefish edits. This is a local patch, not a merge or release.

Expected SHA-256:
- Cuttlefish: `de98d21f593751cdd69e66b2425ff72c064508e9af1d856fb434dd60099d569d`
- Manta: `507867c9c284da28d7ca6e625b68e45b7e59ae4a6e6e5d9f60fa769f3e2e14d6`

## Oracle decision

PR30's old manta oracle protected an eye-removal-only edit by pinning *every other sample*. PR31 deliberately changes wing silhouette, forehead, lobe thickness, materials and motion. Updating those hashes blindly would hide the reason for changed output. The integration replaces only that obsolete preservation assertion with semantic limits: no dorsal eye samples/protrusions, no ink, finite bounded sample budget, wing span, posterior tail attachment and two attached forward cephalic lobes. Retain ASCII/points and scale parity. Run PR31's more extensive geometry suite for forehead envelope, LOD/turn/lobe sweeps, traveling fin-wave lag and deterministic sampling. All cuttlefish historical preservation oracles remain untouched.

## Required local gate (not yet default root CI)

```sh
npm run build
node --test test/cuttlefish-*.test.mjs test/manta-anatomy.test.mjs species/manta/tests/*.test.mjs test/generated-demo.test.mjs test/parity.test.mjs
node node_modules/typescript/bin/tsc -p species/manta/tests/tsconfig.json
node species/manta/scripts/build-study.mjs
node species/manta/scripts/build-study.mjs --check
shasum -a 256 src/animals/cuttlefish.js src/animals/manta.js
git diff --check
```

Regenerate shared `dist` outputs from the combined sources; never select an entire conflicting generated bundle from either PR. The standalone reef study requires its separate study build and deliberate publication wiring. Its new API is not silently exported from the stable package.

Real-browser touch/layout/accessibility and visual acceptance remain pending. Native/mocked evidence and semantic tests do not replace those gates. No performance claim, push, merge or deployment is implied.

## Observed local result

Full central build, manta strict TypeScript fixture, separate study build/reproducibility check and diff whitespace check passed. Combined focused gate: **62 tests, 56 pass, 6 fail**, identically on Node26.7.0 and Node24.19.0 on this Mac. All 23 manta study tests, both reconciled manta anatomy tests, generated-artifact tests and parity tests passed. The six failures are exact historical cuttlefish preservation hashes (V3, V5, V6 and V7 surfaces/support), despite byte-identical PR30 cuttlefish source, helpers, fixtures and tests. Do not rebaseline these automatically. Integration is not a green merge candidate until the original cuttlefish preservation evidence/runtime differences are resolved.

Independent detached, unmodified PR30 baseline at `422ec16` reproduced exactly the same six failures: `node --test test/cuttlefish-*.test.mjs` returned 30 tests, 24 pass, 6 fail. This establishes that those failures precede the manta integration on this Mac; it does not establish whether the cause is historical oracle drift or platform floating-point differences.

## Strict portability resolution (supersedes the six-failure result above)

Recovered accepted V3/V5 originals from their original review archives, V6 from the original prerequisite patch, and V7 from its archived source. All primary sources match their existing independently pinned SHA-256. Test-only snapshots and provenance are under `test/fixtures/accepted/`. Historical JSON files are unchanged. Preservation tests compare exact fingerprints from accepted source and candidate executed on the same runtime, with no tolerance, rounding, skipped cases, relaxed scope or candidate-derived expected data. Added tamper/one-ULP rejection tests. The original cuttlefish source remains unchanged.

Observed: combined focused gate plus `test/accepted-baseline.test.mjs`: **64/64 pass on Node26.7.0**. All preservation/attachment tests plus two new negative controls: **13/13 pass on Node24.19.0**. The exact original Linux runtime was not available and is not claimed tested. No browser acceptance is implied.

## Batch1 integration

Local branch is based on batch1 `b4e545dfd98d9ee15f49520c5b54a8388b933212` and preserves PR30/31/36 as merge ancestors. Batch1 octopus source is byte-identical (`48c2f1ca0be6d2d36182a184a115c32c1c5245779e33f45ff67d8ae419937165`). Normal test/typecheck commands now include the manta suite and both study type fixtures. Normal build generates optional catalogue-linked manta/cuttlefish previews without replacing original study links or Octopus Den. Preview publication checks verify deterministic generated HTML and relative navigation. Full combined `npm test`: 824 passed, zero failed/skipped; full typecheck passed. Numerical/mock evidence only, no fresh real-browser acceptance or device performance claim.

Final local candidate additionally retains latest Butterfly #41 `11d21ae68c27f69821aa0a711ebd73f606df1590` as an ancestor. Full normal suite after that change: **827/827 passed, zero skipped**; expanded strict typecheck passed; repeat build preserved all 1,365 tracked/generated library/species/dist file bytes. Legacy renderer checks passed. Package checks passed with optional unavailable bundler checks unrun (`passed-with-unrun-optional-checks`); npm publication remains disabled. Original Linux fixture runtime remains untested; independent recovered baseline sources provide strict same-runtime preservation. Browser smoke is a separate acceptance gate, not implied by these results.
