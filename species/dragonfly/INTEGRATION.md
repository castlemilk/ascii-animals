# Integration boundary and source provenance

## Exact inspected state

| Source | Commit / status | What it actually provides |
| --- | --- | --- |
| ASCII Animals implementation base | `0e446c47b491b751d484e40db753ec725652b515` | Cuttlefish IIFE, microsite, regression harness and manual-only Pages workflow |
| Import | `7e5984d34a139b8de4643f1ed0607897a42d88dc`, merged by `60235c9f127c394b163fd8c02de408c8ac2e7aa5` | Original imported cuttlefish source |
| Incoming draft PR #2, initial audit | `e7c16104a1e90c8650f7d3e09cdb1124d0321308`, `feat/npm-library-review` | Private JavaScript/TypeScript-declaration candidate, scheduler, non-exported generic definition sketch |
| Incoming draft PR #2, final recheck | `8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1` | New TypeScript public facade and canonical generation; facade is cuttlefish-only; generic writer sketch remains unchanged |
| Incoming catalogue draft PR #4 | `5015dbcffb75b1036b21b4b8e3e65bf0697a46f1` | Marks Dragonfly in development; does not provide its runtime or shared extension contract |
| Main after coordinator merged PR #2 and PR #4 | `074b90a94bd3a747a68feed554e33a3ab0720f41` | Merged cuttlefish TypeScript facade and catalogue; shared species contract is still proposed |
| Dragonfly | `feat/animal-dragonfly`, this directory | Original TypeScript model, geometry, species-only preview, provisional writer adapter |

On initial inspection only PR #2 was open. Its work was read without modifying its branch. The implementation base contains no AGENTS.md, package manifest, LICENSE, exported species registry or public sampled-geometry hook. Its public constructor is `window.CuttlefishArtwork`.

The current source is newer than the old skill's baseline table. That table still describes PR #1 as a draft and initial main as only .gitignore; this task revalidated and uses the newer exact main above. No source-version claims are inferred from old screenshots or README recordings.

## Why this is additive

The cuttlefish `_put`, `_rasterize`, atlas and lifecycle are private and tightly coupled to active-fish transforms, materials, ink and browser construction. Its constructor calls rendering before a potential subclass would finish initialization. Adopting those internals would create a fragile dependency and extra cuttlefish allocations. No ray teaching core or cuttlefish engine was copied.

The small Dragonfly-only orthographic grid presenter exists to make the new animal concretely reviewable. It has no plug-in registry or generic scene engine. The coordinator can replace it when a shared renderer is accepted. No shared engine, package map, root README, registry, Pages workflow or another species directory changes in this PR.

## Current main reconciliation

The coordinator merged the TypeScript foundation and catalogue while Dragonfly draft PR #8 was publishing. Dragonfly keeps its exact original implementation base. The newer main at `074b90a94bd3a747a68feed554e33a3ab0720f41` was fetched into a separate detached temporary checkout, and this species directory was copied there for combined checks. No merge, rebase, other-author branch edit or shared source change was made by this work.

A focused independent source audit confirmed that `src/public/index.ts`, `docs/EXTENDING.md`, core scheduling and the package exports are byte-identical to inspected PR #2 head `8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1`. The merged facade accepts only `species: 'cuttlefish'`; `GeometryWriter` / `AnimalDefinition` remains an unexported documentation sketch. The package exports remain `.`, `./cuttlefish` and `./core`. There is no Dragonfly export or species registration API.

The compatibility conclusions below therefore still apply. Current-main regression results and their exact commands are recorded in [integration-main.json](evidence/integration-main.json) and [VALIDATION.md](VALIDATION.md). They establish coexistence with the merged foundation, not acceptance into its renderer or npm surface.

## Exact proposed compatibility

| Concern | Merged cuttlefish foundation / proposed generic contract | Dragonfly | Acceptance |
| --- | --- | --- | --- |
| Exported species contract | None | Explicit species-local TS types | Shared API pending |
| Geometry writer | Six numeric arguments in docs sketch | Structurally typed `writeDragonflyGeometry` adapter | Structural type checks only; runtime integration pending |
| Material IDs | Legacy atlas uses 0…2 | Proposed body/band/wing/vein/eye/leg 0…5 | Mapping consolidation required |
| Time | Cuttlefish variable `advance(dtSeconds)`; sketch takes delta | Exact next integer 60 Hz tick | Requires coordinator-owned stepping policy |
| Input | Cuttlefish pointer/touch behavior | Typed ordered normalized events | No invented interchangeable input API |
| Browser lifecycle | Hardened cuttlefish constructor/scheduler | Species-local bounded preview host | Public shared host adoption pending |
| Config | New cuttlefish TS facade validates strictly; optional undefined means omitted | Strict runtime validation and TS literal unions; explicit undefined rejected | Small semantics difference documented for consolidation |
| Package | Private merged foundation; no Dragonfly export | Private subdirectory, generated ESM/declarations | No npm publication or import claim |

The independent read-only interface audit checked `docs/EXTENDING.md`, `docs/API.md`, `docs/INTEGRATION-REVIEW.md`, `types/core/index.d.ts`, `types/animals/cuttlefish.d.ts`, `src/core/index.js`, `src/core/scheduler.js`, `examples/authoring/legacy-controller.mjs` and candidate `package.json`.

The prepublication recheck also read `src/public/index.ts` and `docs/TYPESCRIPT-API.md`. The new `createArtwork`/`Artwork` facade only accepts `species: 'cuttlefish'`. `docs/EXTENDING.md`, core scheduler and cuttlefish declarations remain byte-identical to the initial audit. The foundation's browser evidence remains that workstream's record; it was not independently reproduced here. Its disposed mutators are no-ops, while Dragonfly mutators throw after disposal. The writer adapter remains structural/provisional, with no changes needed for the newly merged interface.

## Source hashes

| Path | Hash type | Value |
| --- | --- | --- |
| implementation-base `dist/artwork.js` | SHA-256 | `381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91` |
| implementation-base `dist/app.js` | SHA-256 | `91b2677b43b51a3b6fc36c2c21c98f376ae83f9f70d78aaca3aceb30996a4669` |
| implementation-base `scripts/check-engine.cjs` | SHA-256 | `6b2ffa522510786d691be45c60214c25c074df5de30163fff011e8c1b1890db3` |
| PR2 `docs/EXTENDING.md` | Git blob | `efc3d2130af7a59e1d8e10b08cdb2a4b737bd898` |
| PR2 `types/core/index.d.ts` | Git blob | `27ca3339c738642ece13638d10221fd180c083e3` |
| PR2 `types/animals/cuttlefish.d.ts` | Git blob | `884f55029b0bbb7c7ac4446998d98e480a6fedf7` |
| PR2 initial `package.json` | Git blob | `8e1585d99e649560a833dd6fc4dafb131fe92669` |
| PR2 latest `src/public/index.ts` | Git blob | `43a3cca9726473cda8610d34b1a5e5eb379c9f4f` |
| PR2 latest `docs/TYPESCRIPT-API.md` | Git blob | `dbce24ea6cc1563517aa63b02f178509968ac400` |
| PR2 latest `package.json` | Git blob | `64d89263ca72e6a166ec634b47ccc174123f329d` |

Anatomy references, skill custody, original-construction ledger and font rights are in AUTHORING.md. The exact final changed-file digests are recorded in the review manifest. The repository owner retains the license/release decision. No font, museum image, external ASCII drawing, third-party mesh or generated concept art is bundled.

## Deployment and unrelated work

The merged manual Pages workflow only publishes `dist/`. A species folder outside it is not automatically deployed or linked by this PR. No deploy or workflow dispatch was performed. Manta, octopus and the other parallel species are separate work. The original microsite and its conversation were not accessed; no claims are made about their current state.
