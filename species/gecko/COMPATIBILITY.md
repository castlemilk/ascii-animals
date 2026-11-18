# Exact compatibility and proposed adapter

| Inspected source | Exact ref | Actual boundary |
| --- | --- | --- |
| Original authoring base | `0e446c47b491b751d484e40db753ec725652b515` | Cuttlefish browser IIFE; no species exports |
| Final integration base / inspected main | `074b90a94bd3a747a68feed554e33a3ab0720f41` | Merged canonical ESM/TS facade and catalogue; public species remains cuttlefish-only |
| Original import | `7e5984d34a139b8de4643f1ed0607897a42d88dc` | Ancestor with identical imported renderer blobs |
| Initial PR #2 review | `e7c16104a1e90c8650f7d3e09cdb1124d0321308` | Cuttlefish factory and scheduler; general geometry sketch only |
| PR #2 reviewed head, now merged | `8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1` | Strict TS `createArtwork`, still exclusively `species:'cuttlefish'` |
| Incoming catalogue PR #4 | `5015dbcffb75b1036b21b4b8e3e65bf0697a46f1` | Catalogue/demo/docs changes; no species runtime contract |

The earlier main `60235c9f127c394b163fd8c02de408c8ac2e7aa5` is an ancestor, not
the base used here. All incoming work was inspected read-only. Main advanced
during publication; the isolated gecko branch was rebased onto the final base.
PR #2 merged via `246dc33875d1270c11f6f3612614744e6f97562d`; PR #4 then merged
the reconciled catalogue. No gecko source change was required by that rebase.

Main's geometry/projection/atlas methods are private parts of CuttlefishArtwork;
renderer-active fields temporarily carry individual fish state. Calling `_put`
or `_rasterize` from a gecko would assume private cuttlefish semantics.

The now-merged root facade from PR #2 exports `createArtwork`, `DEFAULT_OPTIONS`,
`normalizeOptions`, and Artwork types. `ArtworkOptions.species` is only
`'cuttlefish'`, and createArtwork always constructs CuttlefishArtwork. The export
map remains `.`, `./cuttlefish`, `./core`. The core is scheduler-only. Its
AnimalDefinition/GeometryWriter sketch in `docs/EXTENDING.md` remains unchanged
and explicitly proposed, with no implementation or registration API.

Sources: [merged canonical renderer](https://github.com/castlemilk/ascii-animals/blob/074b90a94bd3a747a68feed554e33a3ab0720f41/src/animals/cuttlefish.js),
[latest TS facade](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/src/public/index.ts),
[extension sketch](https://github.com/castlemilk/ascii-animals/blob/8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1/docs/EXTENDING.md).

## Local architecture

| Files | Owns |
| --- | --- |
| `types.ts`, `species.ts` | Typed local facade; explicit options/input/state/result types |
| `gecko.ts` | Seeded contact gait, finite config, ordered events, six phases |
| `geometry.ts` | Original bounded surfaces/anatomy without DOM, fonts or clock |
| `preview.ts` | Small species review painter and printable ASCII cells |
| `browser.ts`, `demo.ts` | Demo input/policy/RAF/resource/page ownership |
| `proposed-adapter.ts` | Small proposal bridge to the documented but unimplemented generic species sketch |

The preview/host are local review tools, not a new universal engine. The ray core
was not copied. No shared exports, registry, renderer or root docs were edited.

## Semantic compatibility is intentionally explicit

| Area | Merged PR #2 facade | Gecko local API |
| --- | --- | --- |
| Species | Only cuttlefish | Local gecko; no shared registration |
| Configuration | Flat artwork/cuttlefish options | Species config separated from browser view/policy |
| Undefined patch values | Omitted | Rejected in species option patches |
| Update | Some scene/role changes reset choreography | Preserves seed/time/contacts/behavior |
| Reset | restart preserves pause | reset clears tick/events/gait; host preserves pause/policy |
| Time | advance(0..0.1 seconds), manual-only, ignores pause | One explicit integer tick; proposal accepts exactly 1/60 seconds |
| Reduced motion | Explicit play can override preference | Preference remains an independent rest cause |
| Disposal | Mutators become no-ops; snapshots readable | Mutators/read methods reject; browser status remains readable |
| Events | Cuttlefish pulse/pointer behavior | Validated normalized tick/sequence log with receipts |
| Geometry | Private cuttlefish engine | Pure gecko samples and a proposed writer mapping |

GeckoSpecies does **not** implement Artwork. These policies need consolidation
by the coordinator before asserting a common API.

## Proposed writer adapter — integration acceptance pending

`createProposedGeckoDefinition(materialIds)` matches the *shape* of the documented
AnimalDefinition sketch without importing a nonexistent runtime:

| Method/field | Gecko decision |
| --- | --- |
| create(options,seed) | Validate options/uint32 seed, return an owned model wrapper |
| update(state,input,dtSeconds) | Require exactly one 1/60-second tick; reject otherwise before mutation |
| sample(state,writer) | Finite world positions/tone; reserve full 12,288 capacity first |
| light | Local tone [0,1], not an assumed Cuttlefish shade rule |
| material | Host must supply skin/pad/eye/pupil numeric IDs |
| stableSeed | Stable sample ID within this one animal |
| describe(state) | Concise phase-aware alternative text |
| disposal | Host disposes the wrapper's model explicitly |

World x points right, y down, larger z is in front. Geometry is already posed,
including world-fixed feet; a future director must not apply the root transform
twice. The local view is x ±1.7, y ±1.3. Cross-species owner IDs/material tables,
camera conventions and depth ties remain central decisions.

Insufficient capacity rejects before writing. A writer rejection after reservation
throws and tells the host to discard the frame; the sketch offers no transactional
rollback. Tests use a local fixture writer, not a claimed merged renderer.

```ts
import { createProposedGeckoDefinition } from './compiled/proposed-adapter.js';
// Synthetic host material IDs, not existing Cuttlefish atlas rows.
const adapter = createProposedGeckoDefinition({skin:7,pad:8,eye:9,pupil:10});
const state = adapter.create({creepSpeed:0.1},37);
adapter.update(state,[{type:'guide',tick:1,seq:1,x:1,y:0}],1/60);
// adapter.sample(state, yourAcceptedWriter);
state.model.dispose();
```

After central acceptance, connect these samples to the canonical renderer and
compare the preserved contact/replay/visual fixtures. Package export, tarball
consumer test, shared scheduler integration, mixed-species rendering, catalogue
availability and deployment belong to that later integration step.
