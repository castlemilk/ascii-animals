# Package identity and imports

[Documentation](README.md) · [Browser setup](GETTING-STARTED.md) · [Animal APIs](ANIMAL-APIS.md) · [Validation record](VALIDATION-2026-11-21.md)

This guide describes default branch `main` at [`f63b20e2045b1070b10bde2efc4eb3a8536e606b`](https://github.com/castlemilk/ascii-animals/tree/f63b20e2045b1070b10bde2efc4eb3a8536e606b), verified on 21 November 2026. Build that source and install its local tarball to reproduce the examples.

## Identity and availability

| Field | Value in this source |
| --- | --- |
| Package | `ascii-animals-review@0.0.0-review.0` |
| Publication | `private: true`; `prepublishOnly` deliberately throws |
| License | `UNLICENSED` |
| Module format | ESM (`type: "module"`); no CommonJS build or `require` condition |
| Root JavaScript / declarations | `lib/index.js` / `lib/index.d.ts` |
| Node engine | `>=20` |
| Runtime dependencies | None |
| Build dependency | TypeScript `5.9.3` |
| Tree-shaking declaration | `sideEffects: false` |

These are the [actual manifest fields](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/package.json), not a public-release promise. The manifest's Node range is not a browser support matrix.

On 21 November 2026, the [public registry endpoint for `ascii-animals-review`](https://registry.npmjs.org/ascii-animals-review) returned HTTP 404. There is no accessible registry artifact of this name to compare with the local source build. **Do not substitute `npm install ascii-animals`:** that [registry package](https://registry.npmjs.org/ascii-animals) is `1.0.1`, authored by Tudor Gheorghiu and linked to `Prodicode/ascii-animals`, an unrelated project. The dated checks are recorded in [validation](VALIDATION-2026-11-21.md).

## Build and install the local package

In an isolated checkout of the pinned commit:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm pack --dry-run --json --ignore-scripts
npm pack --json --ignore-scripts
```

Inspect the dry-run file list. The resulting file is `ascii-animals-review-0.0.0-review.0.tgz`. From your consumer project, install its absolute path:

```sh
npm install --offline --ignore-scripts --no-audit --no-fund \
  /absolute/path/to/ascii-animals-review-0.0.0-review.0.tgz
```

The install uses the tarball; the import name remains `ascii-animals-review`. Neither packing nor local installation publishes anything. [Getting started](GETTING-STARTED.md) supplies the complete browser host, module loading and cleanup; a bare npm specifier alone is not a browser URL.

The package allowlist contains `lib/`, root `README.md`, `NOTICE.md` and `docs/*.md`; npm also includes `package.json`. Nested documentation examples, `dist/` demo HTML, `demo/`, tests and media are not included by that allowlist. Use the repository for runnable example files. The [build script](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/scripts/build.mjs) generates JavaScript and declarations before packing; [package checks](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/scripts/check-package.mjs) validate the actual tarball and a separate consumer.

## All public entry points

There are **15 export-map entries: the root and 14 subpaths**. Each has a `types` condition first, followed by `import` and `default` pointing to the same ESM file. The declaration path below is the JavaScript path with `.js` replaced by `.d.ts`.

| Import after `ascii-animals-review` | JavaScript target | Main runtime API |
| --- | --- | --- |
| *(root)* | `lib/index.js` | `createArtwork`, all named artwork factories, `createScheduler`; selected model/default helpers |
| `/cuttlefish` | `lib/animals/cuttlefish.js` | `CuttlefishArtwork`, `createCuttlefish`, `createMarineDirector`, `normalizeMarineDirector` |
| `/core` | `lib/core/index.js` | `createScheduler` |
| `/fox` | `lib/public/fox.js` | `createFoxArtwork`, `createFox`, `createFoxDirector`; configuration and pose helpers |
| `/dragonfly` | `lib/public/dragonfly.js` | `createDragonflyArtwork`, `createDragonfly`, `createDragonflyDirector`; replay/configuration helpers |
| `/gecko` | `lib/public/gecko.js` | `createGeckoArtwork`, `createGecko`, `createGeckoDirector`; configuration helpers |
| `/pufferfish` | `lib/public/pufferfish.js` | `createPufferfishArtwork`, `createPufferfish`, `createPufferfishDirector`; stepping/pose/configuration helpers |
| `/frog` | `lib/public/frog.js` | `createFrogArtwork`, `createFrog`, `createFrogPond`; stepping/pose/director helpers |
| `/owl` | `lib/public/owl.js` | `createOwlArtwork`, `createOwl`, `createOwlDirector`; geometry/grid/poster helpers |
| `/seahorse` | `lib/public/seahorse.js` | `createSeahorseArtwork`, `createSeahorseModel`, `normalizeSeahorseOptions`, `SEAHORSE_DEFAULTS` |
| `/crab` | `lib/public/crab.js` | `createCrabArtwork`, `createCrabModel`, `normalizeCrabOptions`, `CRAB_DEFAULTS` |
| `/turtle` | `lib/public/turtle.js` | `createTurtleArtwork`, `createTurtleModel`, `normalizeTurtleOptions`, `TURTLE_DEFAULTS` |
| `/butterfly` | `lib/public/butterfly.js` | `createButterflyArtwork`, `createButterflyModel`, `normalizeButterflyOptions`, `BUTTERFLY_DEFAULTS` |
| `/movement` | `lib/public/movement.js` | `createMovementDirector`, `sampleMovement`, `normalizeMovementOptions`, movement defaults/tick rate |
| `/movement/marine` | `lib/public/movement-marine.js` | `createMarineMovementArtwork` |

The manifest is the import boundary. There is **no `/manta` or `/octopus` entry**, and no `createMantaArtwork` or `createOctopusArtwork` export. Use `createArtwork(canvas, { species: 'manta' })` or `{ species: 'octopus' }` from the root. `createArtwork` supports those two species and cuttlefish; it is not a universal factory for all 13 animals. Internal files under `lib/` are not public import paths even when present in the tarball. [Marine facade source](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/src/public/index.ts).

## Root convenience exports and species-specific APIs

All animal artwork factories in [Animal APIs](ANIMAL-APIS.md) are available from the root, as are `CuttlefishArtwork`, `createCuttlefish`, `createScheduler`, `DEFAULT_OPTIONS` and `normalizeOptions`. The separate `createMarineMovementArtwork` adapter is available only from `/movement/marine`. The seahorse, crab, turtle and butterfly model/normalizer/default exports are also at the root. The root does **not** re-export every species helper or director.

Use the appropriate subpath for `createMarineDirector`, `createFoxDirector`, `createDragonflyDirector`, `createGeckoDirector`, `createPufferfishDirector`, `createFrogPond`, `createOwlDirector`, `createMovementDirector` and `createMarineMovementArtwork`. Seahorse, crab, turtle and butterfly expose their scene behavior through their own artwork/model contracts; do not invent a uniformly named director factory. Compare the [runtime root exports](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/src/index.js) with the [root declarations](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/types/index.d.ts) and [public adapters](https://github.com/castlemilk/ascii-animals/tree/f63b20e2045b1070b10bde2efc4eb3a8536e606b/src/public).

Types such as `ArtworkOptions`, `FoxArtwork`, `MarineDirectorOptions` and `MovementSnapshot` are erased by TypeScript; they are not runtime values. Import them from the entry that declares them using `import type`:

```ts
import { createArtwork, type ArtworkOptions } from 'ascii-animals-review';
import {
  createMarineDirector,
  type MarineDirectorOptions,
} from 'ascii-animals-review/cuttlefish';
import { createFoxDirector } from 'ascii-animals-review/fox';
```

The first two factories require a browser canvas when called. A pure director/model has its own input and stepping contract; it does not mount a renderer just because it is named a director. See [animal APIs](ANIMAL-APIS.md) for the correct host, configuration and action methods.

## Browser, framework and server boundaries

ESM module import is designed to work without `window` or `document`; browser construction must wait for a real host element. This does not provide server-side canvas rendering. Use client mount/effect hooks and dispose the returned instance during cleanup; there is no exported React component or framework adapter. [Getting started](GETTING-STARTED.md) covers mounting and cleanup, and [validation](VALIDATION-2026-11-21.md) distinguishes source checks from executed consumer tests.

Root and animal TypeScript declarations refer to browser types, so include `DOM` in the consumer's `lib` configuration even when merely type-checking an SSR project. The `/core` scheduler declarations can be consumed with `ES2022` and no DOM library. Test actual package imports under your resolver; the existing package check uses both NodeNext and Bundler modes.

Zero runtime dependencies does not mean every entry has the same bundle cost. The marine engine includes cuttlefish, manta and octopus definitions; the pufferfish adapter imports that engine too. Prefer a species subpath when it fits, then measure your bundler output. [Pufferfish source](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/src/public/pufferfish.ts), [marine imports](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/src/animals/cuttlefish.js).

## Source, demo and future variants

The [live Pages catalogue](https://castlemilk.github.io/ascii-animals/) has a successful [deployment from this same SHA](https://github.com/castlemilk/ascii-animals/actions/runs/44660851191). The authored cuttlefish field study, manta reef and octopus den HTML are deployed too; their live bytes matched the committed `dist/` files in this review. Pages is a demo, not an npm release, and its [workflow is manually dispatched](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/.github/workflows/pages.yml).

Local artwork proposals, a generic variation selector, or additional APIs from later branches are outside this pinned contract. A new source commit alone does not establish a Pages deployment or package publication. See the dated [validation record](VALIDATION-2026-11-21.md) before describing a feature as shipped.
