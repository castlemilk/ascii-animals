# Integration update

See `docs/FROG-API.md` in the repository root for the current typed factory, package and self-contained rendering integration. The material below is retained as historical source handoff context, not current package status.

# Frog integration boundary

## Exact source state

This branch starts at main **`0e446c47b491b751d484e40db753ec725652b515`**. The supplied earlier baseline `60235c9f127c394b163fd8c02de408c8ac2e7aa5` is its parent. PR3 added the manual Pages deployment; the original import `7e5984d34a139b8de4643f1ed0607897a42d88dc` remains intact.

Main has the `window.CuttlefishArtwork` IIFE and no package exports, species registry, public geometry writer, or TypeScript source contract. The only additions in this PR are under `species/frog/`. There is no change to another author's branch or the shared engine.

PR2 was inspected first at `e7c16104a1e90c8650f7d3e09cdb1124d0321308`, then refreshed read-only at **`8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1`** before handoff. The latter adds a strict TypeScript `createArtwork` facade and generated canonical demo. Its actual `src/public/index.ts` still accepts only `species: 'cuttlefish'`. `docs/EXTENDING.md` still calls `AnimalDefinition`/`GeometryWriter` a design sketch, not an exported interface. PR2 remains separately owned and unmerged in this audit.

Incoming catalogue PR4 was also read without checkout/edit at `5015dbcffb75b1036b21b4b8e3e65bf0697a46f1`: its source adds catalogue assets, keeps `dist/artwork.js` unchanged, moves the study to `dist/cuttlefish-demo.html`, and changes the standalone builder input. Its Frog card remains “In development” with no demo link. It does not add a species seam or overlap `species/frog/`. Catalogue/release-status updates remain with that owner after integration acceptance.

Sources: [base tree](https://github.com/castlemilk/ascii-animals/tree/0e446c47b491b751d484e40db753ec725652b515), [PR2 typed facade](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/src/public/index.ts), [PR2 extension sketch](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/docs/EXTENDING.md), [PR2 TypeScript semantics](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/docs/TYPESCRIPT-API.md).

## Implemented local seams

The species logic and geometry are original TypeScript. They have no DOM, wall clock, fonts, renderer, registry, framework or package dependency. `frogSpecies` is a concrete frog-local typed object, not a replacement shared interface. Its methods are `create`, explicit-next-tick `step`, and bounded `sample`; every state result is immutable.

The preview is deliberately a temporary **internal adapter**, not a copied renderer. It loads `dist/artwork.js` in place and calls four existing prototype methods on an isolated typed data host:

| Actual method reused | Mapping and limitation |
| --- | --- |
| `_put(x,y,z,light,kind,seed)` | Frog samples already have world coordinates. Adapter adds `.30` to x to cancel the cuttlefish-specific origin subtraction. Uses identity rotation/scale and intentional orthographic projection. Checks the 32,000 cap before every call and checks emitted/accepted counts; legacy hard cap is 36,000. |
| `_rasterize()` | Existing sample-to-cell projection, Float32 depth, owner, material, tone and glyph mapping. One frog owner 0; no claim about a mixed-species director. |
| `makeAtlas()` | Existing glyph metrics/font fallback/tone rows. Frog supplies a local green palette, using only existing material indices 0,1,2. Font binaries are not redistributed. |
| `_projectWorld()` | Ground ring and reachable landing reticle use the same fixed projection. These overlays are disclosed non-glyph UI. |

`_world()` was inspected but is not called: `_put()` already inlines that transform. No method is monkey-patched and the legacy constructor is never instantiated. Thus the frog does not inherit the Cuttlefish pointer handlers, polling RAF, observer or zero-size fallback. The frog-local controller owns and releases its resources.

The exact legacy SHA-256 is `381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91`. Native evidence/test setup verifies this hash before executing the already-reviewed source. Browser setup checks the required methods; it cannot verify the file hash through method presence. Do not silently substitute a different renderer revision. The regression should fail on a changed source and require adapter review.

PR2's newer `makeAtlas()` adds atlas limits and `spriteDrawSize` behavior; its host expectations and sprite placement differ. Swapping in PR2's regenerated `dist/artwork.js` without porting/testing this adapter is **not accepted compatibility**. This is a concrete integration task for the canonical renderer owner, not a reason to preserve two engines.

## Compatibility with current proposed public API

| Concern | PR2 at `8c530b1…` | Frog-local implementation | Consolidation needed |
| --- | --- | --- | --- |
| Species | `ArtworkOptions.species?: 'cuttlefish'` | Literal `frog`; no root registration | Owner chooses the shared typed extension point; frog is not assignable to current `Artwork`. |
| Config | `ArtworkConfig`, `normalizeOptions`, `update` | `FrogConfig`, `configureFrog`, `updateConfig` | Separate species-specific schemas; both reject unknown/nonfinite/out-of-range fields. Frog supplied undefined config fields reject; PR2 treats undefined as omitted. |
| Update behavior | Some edits preserve time, scene/formation reset | All geometry/timing config updates reset at same seed, preserve pause; preview view/grid changes preserve simulation | Do not silently map names without preserving/resetting the documented state. |
| Simulation | `advance(seconds)` in 0..0.1, manual drive ignores pause | `stepFrog(state,nextTick,orderedInputs)` returns immutable result, exact 60Hz logical steps | Scheduler must feed a bounded fixed-step driver; seconds are not replay ticks. |
| State | `ArtworkStats`/config snapshot | Discriminated seven-phase `FrogState`, `FrogStepResult`, latched leap plan | Keep frog's phase semantics; no `ink`, `encounterGrip` or fish fields in species state. |
| Reset | `restart()` | `reset()` / pure `resetFrog()` | Both preserve user pause. Frog can explicitly reseed on reset. |
| Disposal | Idempotent; later mutators no-op and snapshots readable | Idempotent; later mutations/getState/export throw; getStatus remains readable | Deliberate semantic difference to settle centrally, not hide behind a cast. |
| Reduced motion | `play()` can intentionally override system preference | Pointer/play never override reduced motion; deliberate static pose alternatives | Keep accessible policy explicit when a common facade is accepted. |
| Scheduler | Candidate `createScheduler` subscribe/unsubscribe/dispose | Own bounded preview RAF; no pending main export | Replace only host scheduling after acceptance; species stays clock-free. |
| Geometry writer | Documented six-argument `write` sketch | Typed sample sink with x/y/z/light/material/stable sampleId/part | Simple mapping shown below; clipping/overflow/material/coordinate ownership remain acceptance decisions. |

### Small proposed writer mapping (not an exported shared API)

When the owner accepts the sketched writer, the local callback maps without changing frog anatomy:

```ts
// writer is supplied by the future accepted host; this is illustrative only.
sampleFrog(state, sample => {
  const accepted = writer.write(sample.x, sample.y, sample.z,
    sample.light, sample.material, sample.sampleId);
  if (!accepted) throw new RangeError('Frog geometry writer overflow or rejection');
});
```

Before adopting this, distinguish clipping from capacity failure, agree coordinate/scale ownership, stable animal IDs, normal/material handling, and the scheduler's input boundary. Never load arbitrary unreviewed species code as data. The frog's output cap cannot stop malicious synchronous code from looping forever.

## Required central acceptance

1. Accept a real typed species/writer/controller contract and resolve the differences above; add a frog-specific adapter against that exact revision.
2. Move projection/depth/atlas reuse to that public internal seam and remove this temporary private host adapter. Preserve one canonical renderer.
3. Run native cell parity and actual browser visual/input/accessibility/lifecycle tests against the merged engine. Profile the declared workload on target devices.
4. Decide package subpath, registry/catalog and documentation ownership in one coordinated change. Run real tarball consumers for that package; this PR does not invent an npm import.
5. Resolve minimum-grid all-anchor recognition, diagnostic profile status, and normal-speed human motion review. Keep present evidence gaps visible.

The existing Pages workflow uploads only `dist` from main and is manually dispatched. This frog demo is **local source only**, not a deployed page or an added catalog entry. No merge, deployment, npm publication, settings or license change is part of this PR.
