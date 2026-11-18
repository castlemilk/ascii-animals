# Dragonfly director — validation and bounded critique

## Scope, provenance and review identity

The implementation started from actual main
`c06114404900884814bef879a02f1a49a3e7d590` on a new isolated
`feat/director-dragonfly` branch. The base tree is
`e5d06d06fe264ba526b41e953d22a5c8a80fe7c1`. Current package APIs,
`docs/ANIMAL-APIS.md`, Dragonfly source/declaration bridges, the public adapter,
build scripts, scheduler and regressions were read before editing. No open PRs
were returned in the initial read. The prior Dragonfly delivery branch was not
replayed. There was no AGENTS.md in the inspected repository/ancestor paths.

A later read found main at `c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`, merging
PR #21. Its only difference from the implementation base is the shared README's
live-status reconciliation. That incoming diff was read without changing it.
Our implementation base remains exact; no shared README is included in the patch.
The downloadable validation manifest records the final commit/tree and patch
application checks, avoiding a self-referential commit hash in this tracked file.
Fixed-width ASCII text captures intentionally retain trailing spaces and blank
rows; raw test logs retain their original output. Whitespace checks exclude only
those capture `.txt` and raw `.log` files. Preserve them when applying the patch.

The actual authoring skill and linked template/references were applied. Requested
skill commit: `23e078642157a273e2b886222470bd247e5737b5`; reviewed skill commit:
`e721252075a30888198aafba0953a23fd07bd3c6`. Read SKILL.md SHA-256:
`fdaf582ce7d2154a96c328521d53e9791d9898fe1038b52764ff925d77ddb453`.
Read authoring-template SHA-256:
`a7e0be87464d19c122edc9a5c775e5c0f5fd66e03f4e6771130712e7bba4a716`.
The pre-code [director brief](DIRECTOR.md) completes the anatomy, silhouette,
small-grid, glyph/font rights, input/tick/seed, behavior, lifecycle, accessibility
and budget decisions for this extension. Original anatomical source provenance
and geometry authorship remain in `AUTHORING.md`/`authoring.json`.

The director and pond composition are original species-local work. They reuse
existing Dragonfly geometry, projection, glyph ramps and Canvas painter. No ray
teaching core, marine renderer, copied ASCII artwork, mesh or font binary was
added. A projection helper was factored from existing code so reeds and animals
use the same exact transform. The accepted public wrapper/scheduler is reused;
no shared engine, package export map, registry, catalogue or other species source
was rewritten. API additions are confined to Dragonfly's existing entry.

## Actual executed checks

Environment: Node 24.22.1, npm 11.9.0, TypeScript 5.9.3, Linux x64.
Native visual captures used installed `@napi-rs/canvas` 0.1.100 and ffmpeg.

| Check | Actual result | Evidence boundary |
| --- | --- | --- |
| Final `node scripts/build.mjs` | Passed; generated Dragonfly demo has 15 files | Compiled source and integrated generated modules |
| Final Dragonfly and public integration tests | **85 passed, 0 failed, 0 skipped** | Numerical/API, geometry/compositor and instrumented host tests |
| Final species declaration-consumer check | Passed; positive examples and 19 new negative type assertions | TypeScript 5.9.3, strict/exact optional/unchecked-index settings |
| Repository-wide package-listed tests | **344 passed, 0 failed, 0 skipped** before the final targeted motion/still corrections | Existing applicable regressions; final affected suites rerun afterward |
| Root `npm run typecheck` | Passed | Root and all listed species type fixtures |
| Offline package harness | Passed mandatory checks; optional bundlers remain unrun | Exact final package details in `evidence/director/validation/package-check.json` |
| Native capture | Six posters, two contact sheets, 193-frame GIF, fixed event log | Actual native Canvas glyph rendering; no browser FPS claim |
| Diff/patch integrity | Recorded in downloadable manifest after local commit | Exact blob hashes and binary-patch reconstructed tree |

The final 85 tests comprise 18 original model + 14 original host + 4 original
preview + 20 director + 16 director host + 7 pond compositor + 6 public adapter
integration tests. The 344 and 85 figures overlap; they are not added together.
Raw outputs are under `evidence/director/validation/`. The final offline tarball
contains 156 files, 260,017 compressed bytes, SHA-256
`0482e1eaa9623301e3e869e298051958e5c92825d7139ff1e37ede0451eb56fc`.
It was created for local validation only; no package was published.

Headless coverage includes exact next-tick/ordered events and atomic rejection,
1/2/5-tick sampling determinism, independent seed/clock ownership, full response
ordering and return, bounded velocity/acceleration, continued airborne wings,
stationary settled perch, selected-only input, geometry/landmark attachment,
configuration/count/reset/pause/static/disposal and SSR without ambient time or
randomness. Type tests cover distinct model/director domains and invalid events,
roles/options, readonly snapshots and preserved legacy consumers.

Host coverage uses explicit DOM/Canvas bookkeeping stubs. It checks one borrowed
subscription for four members, shared scheduler coexistence with solo Dragonfly
and Fox, ordered input coalescing, reduced motion, hidden/offscreen/zero-size
suspension, resize/DPR bounds, rollback, disposal and late callbacks. These stubs
do not establish browser font/rendering, focus behavior, AT output or device FPS.

The compositor tests check depth ownership and stable ties, input-order
independence, exact solo neutral equivalence, sample/grid bounds, tested scene
clipping, label rectangles and actual perch projection. At 72×44 in both views,
four static pose-0 visitors each retain at least 24 visible cells and 75% of
their standalone footprint, with zero clipped samples. This is a bounded
visibility check, not a universal visual-recognition score.

## Live baseline comparison and new visual evidence

The live Cuttlefish demo was inspected in Chrome: scene selector, population,
roles, current, formation controls and a multi-visitor horizontal procession.
The live Dragonfly baseline exposed the original single-specimen hover/dart
interaction. This directly informed the gap/behavior/scene matrix, without
copying the marine implementation or its public contract.

The cloud browser could not open the new local server at
`http://127.0.0.1:8789/dragonfly/` (`net::ERR_CONNECTION_REFUSED`). No new browser
interaction or screenshot pass is claimed. Earlier launch restrictions recorded
in the original species evidence are historical; this extension's local-preview
failure is the connection refusal above. No deployment was used as a workaround.

The new visual evidence is generated by `scripts/capture-director.mjs` from the
actual compiled species code. The manifest gives source SHA-256 values, complete
configuration, seed, tick/event sequence, member poses/phases and grid counts.
The deterministic sequence is seed 17, patrol/3/banks, select ID 1 at tick 90,
guide (.6,−.35) at 91, dart at 140, leave at 420, perch at 480, return at 720,
ending at 960. The GIF samples every five ticks at 12 fps. The loop resets to the
starting arrangement and is deliberately not described as seamless.

All six final posters and all 193 sampled animation frames have zero clipped
samples. Scene posters cover patrol, attention and a four-member relay; the
minimum-grid specimen and four-member neutral still use 72×44 at 360×286.
Native labels were placed for all visitors in those six captures. A separate
72-scenario layout sweep during review placed 192 labels without rectangle
collisions; the committed reproducible tests cover layout independently with a
clearly labeled deterministic width fixture.

Final visual review found recognizable paired heads, segmented trailing abdomens
and attached wing groups. The staggered static panel now reads as four distinct
visitors. Full-motion relay crossings can occlude individuals temporarily; the
relay poster is not evidence that all four wings of every actor stay unobscured.
The minimum grid loses vein detail, and moving anatomy can crowd at the largest
scale/smallest spacing. Lower population/scale and the neutral still alternative
remain deliberate controls. No unsupported claim of universal readability is made.

## Bounded critique and implemented corrections

| Observed issue | Concrete correction | Evidence/regression |
| --- | --- | --- |
| Initial patrol placed all three visitors on the right bank | Separate assigned territories with role-specific paths and bounded drift | `before-spacing.png` versus final `patrol.png`; scene/bounds tests |
| Labels overlapped anatomy or one another | Selected-first bounded candidate placement; omit label if no safe slot fits | Native label sweep and committed compositor tests; cast UI remains available |
| Decorative reeds were not actual landing locations | Reuse the exact original world-to-cell projector for stems and perches | Held body/perch contact tested in two views/two grids; original solo comparison preserved |
| Dart-to-settle hard speed cap caused a velocity discontinuity | Cap final velocity change as well as spring acceleration; brake gradually | Before: 48.0449786 units/s²; after default maximum 9.000000000000007 (bound 9), tempo 1.6 maximum 14.400000000000004 (bound 14.4), slow maximum 2.2500000000000018 (bound 2.25) |
| A distant requested perch stopped wings while still airborne | Use final phase and distance to contact; keep positive wing motion during approach | Original failure at tick 23, still .9823831 units from reed; final distant-transition regression passes |
| Three static visitors merged into two main silhouettes | Stagger actual reed homes into two rows | `before-still-spacing.png` versus final four-member `still.png`; minimum-grid footprint regression |
| Dart at an already-reached pointer was almost invisible | Request a bounded deliberate excursion with deterministic inward fallback, then retain the original return anchor | Settled-pointer test: .0376332-unit pre-fix excursion → .6438219 after; return error .0005850, return speed .0002427 |

The native before-dart fixture showed only .0115369 units of displacement between
launch tick 140 and settle tick 190; its manifest and temporal contact sheet are
retained as `before-dart-*`. That figure differs from the dedicated settled-hover
regression above because the measured intervals and pointer fixtures differ.
The same native tick-140→190 interval is .5697183 units after correction.
No fabricated visual or performance pass is inferred from either measurement.

Independent read-only review identified the airborne wing-stop and confirmed the
final landing, still-placement and dart corrections. It also checked API scopes,
scheduler ownership, input/teardown, keyboard/touch controls and reduced-motion
source paths. The review did not independently execute a browser or benchmark.

## Reproduction

From the exact base with the supplied binary patch applied:

```sh
node scripts/build.mjs
node --test species/dragonfly/tests/*.test.mjs test/dragonfly-integration.test.mjs
node species/dragonfly/scripts/build.mjs --check
npm run typecheck
node scripts/check-package.mjs --report /tmp/dragonfly-package-check.json
# Full package-listed regressions (runs a build first):
npm test
```

To capture native evidence with an already installed Canvas module and ffmpeg:

```sh
# Optionally set DRAGONFLY_CANVAS_MODULE to the module's absolute index.js path.
node species/dragonfly/scripts/capture-director.mjs /tmp/dragonfly-director-evidence
```

To inspect the generated integrated demo, serve `dist` over HTTP, then open
`/dragonfly/`. The source ZIP contains committed generated JS/types and the
self-contained `dist/dragonfly` module graph; root-wide tests require the recorded
repository base, not just the species overlay. No network or runtime dependency
is needed to view the served generated demo.

## Remaining acceptance gates

- Execute the new integrated demo in a real browser: scene/cast/cue flows,
  pointer + keyboard + touch, resize/DPR, live reduced-motion changes, focus,
  export and unavailable-Canvas fallback. Local browser execution was blocked.
- Review real phone hardware, 200% zoom/reflow, screen readers and touch scrolling.
- Measure browser simulation+draw timings and long-session memory on named
  hardware with one and four members. Native/Node tests are not browser timings.
- Run optional esbuild/Rollup/webpack consumer checks when those tools are
  available; the mandatory offline import/type/reproducibility checks passed.
- Coordinator accepts the Dragonfly-specific API addition, scene aesthetic and
  runtime integration. There is no proposal to replace the shared animal contract.
- Draft PR review and any later merge/deployment/release remain separate. No npm
  publication, merge, deployment, force push or settings/credential change occurs
  as part of this implementation. Artifact export precedes any publication attempt.
