# Source provenance and integration custody

## Exact base and inspected state

This species was authored in an independent checkout on `feat/animal-pufferfish`, based on actual `main` **`0e446c47b491b751d484e40db753ec725652b515`**. The worktree was clean before writing the authoring brief. All additions are under `species/pufferfish/`.

That base includes merge `60235c9f127c394b163fd8c02de408c8ac2e7aa5` of the original import `7e5984d34a139b8de4643f1ed0607897a42d88dc`, followed by manual Pages PR3. The user-supplied older main baseline was therefore not assumed current. Main remained `0e446c47…` at the initial publication check, then advanced during delivery as recorded below. The implementation was not silently rebased and its captures were not relabeled.

The actual tree contains no AGENTS.md, package.json or LICENSE at this base. Its supported API is the browser `window.CuttlefishArtwork` constructor. No npm/species registry contract was inferred. The existing page controls, renderer, numerical tests, standalone builder, README and manual-only Pages workflow were read before integration decisions.

| Existing source | SHA-256 |
| --- | --- |
| `dist/artwork.js` | `381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91` |
| `dist/app.js` | `91b2677b43b51a3b6fc36c2c21c98f376ae83f9f70d78aaca3aceb30996a4669` |
| `scripts/check-engine.cjs` | `6b2ffa522510786d691be45c60214c25c074df5de30163fff011e8c1b1890db3` |

[Pinned main tree](https://github.com/castlemilk/ascii-animals/tree/0e446c47b491b751d484e40db753ec725652b515) · [actual renderer](https://github.com/castlemilk/ascii-animals/blob/0e446c47b491b751d484e40db753ec725652b515/dist/artwork.js).

## Actual skill applied

The requested SKILL.md at `23e078642157a273e2b886222470bd247e5737b5` and reviewed head `e721252075a30888198aafba0953a23fd07bd3c6` were both fetched. Their SKILL.md blob is identical: `8ef04dec7f4031f7e69b1319e182a7d722b41fe4`.

Read at the reviewed head:

- `SKILL.md`
- `assets/authoring-template.md` (blob `c21bdb67d2348cfd24339d96edafd6084bddd721`)
- `references/cuttlefish-baseline.md`
- `references/authoring-and-glyphs.md`
- `references/portable-contract.md`
- `references/accessibility-performance.md`
- `references/validation.md`
- `references/quickstart.md`
- `references/examples.md`
- `assets/reference/contracts.d.ts`, `assets/reference/NOTES.md`, `assets/reference/core.mjs`
- `assets/examples/ray.authoring.json`, `scripts/validate-spec.mjs`

[Reviewed workflow](https://github.com/skunkworq/skunkworq-skills/blob/e721252075a30888198aafba0953a23fd07bd3c6/generate-reactive-ascii-animals/SKILL.md) · [authoring template](https://github.com/skunkworq/skunkworq-skills/blob/e721252075a30888198aafba0953a23fd07bd3c6/generate-reactive-ascii-animals/assets/authoring-template.md).

The historical Cuttlefish baseline in the skill is treated as dated evidence. Its former unmerged-PR1 status is superseded by the current main read. The educational ray's contract and code were read as a reference and **not copied** into this species or its renderer. Its tests are not counted as pufferfish tests.

`AUTHORING.md` was completed before source implementation. The bounded JSON validator from the reviewed skill was read before execution and run against `authoring.json`. It validates structure and bounds only; it does not certify anatomy, rights, visual quality or runtime behavior.

## Incoming PR2: inspected twice, never edited

Initial inspection used draft library PR2 at `e7c16104a1e90c8650f7d3e09cdb1124d0321308`. Its actual `types/animals/cuttlefish.d.ts`, `types/core/index.d.ts`, `src/core/index.js` and `docs/EXTENDING.md` showed a Cuttlefish class, injected scheduler and a non-exported geometry design sketch. No public species plugin API existed.

The second read found PR2 still open/draft at **`8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1`**. The incoming object was fetched for read-only inspection without switching or editing the owner's branch. New source actually read:

- [`src/public/index.ts`](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/src/public/index.ts)
- [`docs/TYPESCRIPT-API.md`](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/docs/TYPESCRIPT-API.md)
- `types/animals/cuttlefish.d.ts`, `types/core/index.d.ts`, `src/core/index.js`
- `scripts/build-demo.mjs` and the changed private atlas/render methods

That candidate now has a strict TypeScript `createArtwork` facade with `ArtworkOptions`, immutable defaults and validated updates. **Its species discriminator accepts only `'cuttlefish'`.** It has no accepted external geometry writer or pufferfish registration API. The shared scheduler and Cuttlefish declarations remain unchanged from the initial read.

Its generated `dist/artwork.js` has SHA-256 **`6f24de296d54e81957910ac16ead48a0f4d9f7986fb96de4f87fb099b619b4f7`**. `_put` and `_rasterize` method bodies remain identical, but `makeAtlas` now caps sprites at 64 pixels and sets `spriteDrawSize`, which `render` consumes. This species deliberately continues to pin the **main** renderer hash. Source resemblance is not a parity pass or approval to silently swap dependencies. The coordinator must accept that generated-renderer dependency and rerun parity/captures when integrating.

The exact lifecycle/type differences and proposed mapping are in `API.md`. No PR2 package exports, engine source, scheduler, facade or declarations were changed. No claim is made that PR2's `createArtwork({species:'pufferfish'})` works.

## Incoming catalogue PR4

Draft PR4 was inspected at `5015dbcffb75b1036b21b4b8e3e65bf0697a46f1`. It lists pufferfish with id `pufferfish`, Ocean habitat and planned/in-development status, with no released demo. It imports no pufferfish source and preserves the main renderer blob.

No catalogue file is edited here. At that inspection, the catalogue and central library owners needed to reconcile the standalone entry: PR4's builder read `dist/cuttlefish-demo.html`, while PR2's `scripts/build-demo.mjs` read `dist/index.html`. This was an observed cross-PR integration concern, subsequently resolved in main as recorded below.

## Final delivery reconciliation: PR2 and PR4 merged

While publication was being attempted, actual main advanced to **`074b90a94bd3a747a68feed554e33a3ab0720f41`**, incorporating PR2 merge `246dc33` and PR4 merge `074b90a`. That new main was fetched and inspected without switching or editing another author's branch. Its `src/public/index.ts`, `docs/EXTENDING.md`, authoring controller/guide, package manifest, generated renderer, builder and Pages workflow were read.

The TypeScript facade and generated renderer match the previously inspected PR2 head. Its public discriminator remains `'cuttlefish'`; the package has only root, cuttlefish and core subpaths, remains private, and contains no accepted pufferfish writer/registry. `examples/authoring/legacy-controller.mjs` composes lifecycle policy around a constructed Cuttlefish instance. It does not expose geometry injection and is not a generic species host. Its bridge checker defaults to the frozen `test/fixtures/legacy-artwork.cjs`, whose hash matches our older tested renderer; that historical fixture is not a new canonical runtime seam.

The earlier builder conflict is **resolved in new main**: `scripts/build-demo.mjs` now reads `dist/cuttlefish-demo.html`. The catalogue still does not publish a pufferfish demo. Pages remains manually dispatched.

The pufferfish source, tests and native captures still target exact base `0e446c47…` and renderer SHA-256 `381f4706…`. No new-main parity, canonical package integration or recapture is claimed. The existing dependency-hash assertion deliberately rejects the new generated renderer until the coordinator accepts the private atlas change and reruns the integration checks. The full source archive preserves the tested base dependency for reproduction. This historical base is a review boundary, not a request to revert main or copy the old engine into the species folder.

## Original work and rights

Geometry, behavior, typed local API, controller, tests and demo were independently authored for this request. No external ASCII drawing, model, animal image or font binary was copied. The animal is explicitly stylized; timings and geometric ratios do not claim biological validation.

The existing renderer is a same-repository runtime dependency, used in place through a local bridge. Its procedural glyph atlas, projection/depth logic and draw loop are not replicated. Existing Cuttlefish state/controls are not instantiated by the pufferfish controller. The repository owner retains the eventual code-license decision.

The font stack is inherited as names only. Native evidence uses installed font resolution and records its inventory; the exact selected fallback was not instrumented. No redistribution right is inferred from a font name. All frames/GIFs come from executable procedural geometry; no generated concept image is used as implementation evidence.

## Source versus deployment and conversation

The current task and steering instructions were read. The historical microsite conversation was not retrieved and is not reconstructed from memory. The saved microsite and its live deployment were not used as current runtime evidence. No deployed pufferfish, npm publication, shared README/catalogue update, merge or deployment is claimed.

The branch's exact captured species source hashes are in `evidence/native-capture.json`; final verification source/build hashes are in `evidence/checks.json`. Image hashes and normalized event logs make the visual critique reproducible. Native Canvas, mocked lifecycle tests and unavailable real-browser acceptance remain separate categories.
