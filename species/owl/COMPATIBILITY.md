# Exact integration boundary

## Source pins

| Source | Exact revision | Meaning |
| --- | --- | --- |
| Owl's final merged base | `074b90a94bd3a747a68feed554e33a3ab0720f41` | Main after PR2 foundation and PR4 catalogue merged; own branch rebased without conflicts |
| Original implementation base | `0e446c47b491b751d484e40db753ec725652b515` | Main at authoring/implementation checkout; includes import merge and manual Pages workflow |
| User-specified earlier main | `60235c9f127c394b163fd8c02de408c8ac2e7aa5` | PR1 merge, ancestor of actual base |
| Cuttlefish import | `7e5984d34a139b8de4643f1ed0607897a42d88dc` | Original imported artwork; all current base paths remain byte-identical to the final merged base |
| PR2 first inspected | `e7c16104a1e90c8650f7d3e09cdb1124d0321308` | Initial ESM/library candidate, no universal species seam |
| PR2 inspected source | `8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1` | Strict TS facade and canonical build; now merged, cuttlefish only |
| PR2 merge | `246dc33875d1270c11f6f3612614744e6f97562d` | Foundation is merged; general species writer remains unaccepted |
| PR4 final source | `f5b37b7c072147dc6efec16d47698c9294c0e7f1` | Catalogue reconciled with the merged foundation, included in final main base |
| Authoring skill | `e721252075a30888198aafba0953a23fd07bd3c6` | Reviewed skill plus linked references/template read |

The original implementation base had no package manifest or public species host. During final delivery, main advanced to include PR2 and PR4. The Owl branch was rebased onto that exact main; no Owl path conflicted. The authoritative Cuttlefish renderer is now `src/animals/cuttlefish.js`, with generated browser/standalone outputs. Its geometry, projection, glyph and lifecycle methods remain private and Cuttlefish-specific. `render()` calls `_body`, `_arms` and `_beak`; `_put` and `_rasterize` depend on Cuttlefish position/material/active-fish state. Those methods are not an accepted species seam.

## What the merged foundation actually offers

At [the inspected head](https://github.com/castlemilk/ascii-animals/tree/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1), `src/public/index.ts` exports `createArtwork`, `DEFAULT_OPTIONS`, `normalizeOptions` and the typed `ArtworkOptions`, `ArtworkConfig`, `ArtworkStats` and `Artwork` facade. `species` is explicitly the literal **`'cuttlefish'`**. Its package is private with exports for `.`, `./cuttlefish` and `./core`. There is no accepted owl/species injection or registry.

The merged foundation has canonical package-to-browser/standalone generation. The source files below, plus the export map and core entry point, are byte-identical between the inspected PR2 head and final main. Existing foundation tests, typechecking, canonical build, authoring bridge and catalogue checks were rerun after the rebase; see [validation](VALIDATION.md). Its earlier reports of browser QA were not rerun here and are not evidence for Owl.

| File at inspected PR2 head and final main | Git blob |
| --- | --- |
| `src/public/index.ts` | `43a3cca9726473cda8610d34b1a5e5eb379c9f4f` |
| `types/index.d.ts` | `0ca237fa867d3bb87b172c0532f4e6e76f198aaa` |
| `types/core/index.d.ts` | `27ca3339c738642ece13638d10221fd180c083e3` |
| `src/core/scheduler.js` | `0b90c3a3f6b1b762b1542e90c227cc5b5a01960b` |
| `docs/EXTENDING.md` | `efc3d2130af7a59e1d8e10b08cdb2a4b737bd898` |
| `docs/TYPESCRIPT-API.md` | `dbce24ea6cc1563517aa63b02f178509968ac400` |

## Exact semantic comparison

| Concern | Merged strict facade | Owl local proposal |
| --- | --- | --- |
| Construction | `createArtwork(canvas, options)` | DOM-free `createOwl(options)` plus separate `mountOwl(host, options)` |
| Species | `'cuttlefish'` only | `'owl'`; no shared package export |
| Simulation | `advance(seconds)`, manual mode, up to .1s; explicitly ignores pause | Exact next integer tick at60Hz with validated ordered inputs; pause is host policy |
| Options | Unknown/invalid values reject; explicit undefined means omitted | Unknown/invalid values reject; explicit undefined field values reject |
| Reset | `restart()` preserves pause | Core `reset(seed?)`; browser reset preserves pause and all independent blockers |
| Disposal | Idempotent; later mutators no-op, snapshots readable | Idempotent; later core/host methods reject except disposed/status inspection |
| Reduced motion | Explicit play/paused:false can override OS policy | OS reduced-motion remains independent; deliberate controls change static poses |
| Glyph output | Canonical Cuttlefish Canvas renderer | Owl-only diagnostic text sampler; integration pending |
| Scheduler | `subscribe(callback): unsubscribe`, plus owner `dispose/size` | Accepts structural subscribe subset and never disposes shared source |

These differences are intentional and documented, not hidden under an assertion of structural `Artwork` compatibility. Consolidation belongs to the central library owner.

## Minimal adapter proposal

PR2's [extension document](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/docs/EXTENDING.md) still labels `GeometryWriter` and `AnimalDefinition` as **design sketches, not exported candidate APIs**. The writer shape has not changed between the two inspected heads.

`src/adapter-proposal.ts` mirrors that writer signature locally and takes original Owl samples. A host must explicitly supply its material IDs, coordinate units and y direction. Owl uses local x-right/y-down coordinates and larger z toward the viewer; no cuttlefish offset/camera/table is assumed. The supplied ordinals are repeatable for the same grid/snapshot but are not stable anatomical identities across motion or density changes.

All sample values and remaining capacity are preflighted before writes. If the destination refuses or throws despite preflight, its frame may be partial and must be discarded. There is no silent clipping or invented transactional rollback.

The browser's optional `OwlFrameSource` matches the **implemented, merged** scheduler subset. A species-local test imports the actual merged `src/core/scheduler.js`, mounts two Owls, and verifies one shared RAF, independent pause/disposal, zero-subscriber cancellation, fresh resume timing and continued scheduler reuse. Native browser/RAF infrastructure is still simulated. The Owl runtime itself accepts dependency injection and does not take ownership of the shared source; no published-package integration is claimed.

## Acceptance owned by the coordinator

1. Agree on deterministic ticks versus variable-step facades, input routing, immutable snapshots and disposal semantics.
2. Accept local coordinates, source material IDs, sample identity and a bounded writer contract.
3. Provide canonical projection/glyph/lifecycle seams usable by both the existing cuttlefish and the owl.
4. Run actual-browser visual, accessibility and performance acceptance of the integrated owl, keeping the current Cuttlefish regressions.
5. Choose package subpaths, licensing and release policy in the central branch.

This species PR adds no shared exports, registry, engine changes, documentation rewrites or deployment hooks. It remains additive to the exact main base above.

The separately owned catalogue was first inspected at `5015dbcffb75b1036b21b4b8e3e65bf0697a46f1`, then refreshed at merged final source `f5b37b7c072147dc6efec16d47698c9294c0e7f1`. Its current Owl status is “In development”; the public catalogue does not load this species. `docs/catalogue-maintenance.md` was read. Owl availability, links, counts and package exports remain the coordinator's integration decision; this branch edits none of them.
