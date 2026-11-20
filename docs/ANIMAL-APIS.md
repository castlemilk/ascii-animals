# Typed animal API map

The package is currently named `ascii-animals-review` and is private/unpublished. Install the local tarball for the examples; these are not npm-registry installation instructions. All factories in this table are also named exports from the package root. Importing modules is SSR-safe; mount only after a browser element exists.

| Animal | Factory | Typed import | Host | Full configuration |
|---|---|---|---|---|
| Cuttlefish | `createArtwork` with `species: 'cuttlefish'` | `ascii-animals-review` | Canvas | [Marine API](TYPESCRIPT-API.md) |
| Manta ray | `createArtwork` with `species: 'manta'` | `ascii-animals-review` | Canvas | [Species notes](SPECIES.md) |
| Octopus | `createArtwork` with `species: 'octopus'` | `ascii-animals-review` | Canvas | [Species notes](SPECIES.md) |
| Fox | `createFoxArtwork` | `ascii-animals-review/fox` | Canvas | [Fox](FOX-API.md) |
| Dragonfly | `createDragonflyArtwork` | `ascii-animals-review/dragonfly` | Canvas | [Dragonfly](DRAGONFLY-API.md) |
| Gecko | `createGeckoArtwork` | `ascii-animals-review/gecko` | Canvas | [Gecko](GECKO-API.md) |
| Pufferfish | `createPufferfishArtwork` | `ascii-animals-review/pufferfish` | Canvas | [Pufferfish](PUFFERFISH-API.md) |
| Frog | `createFrogArtwork` | `ascii-animals-review/frog` | Canvas | [Frog](FROG-API.md) |
| Owl | `createOwlArtwork` | `ascii-animals-review/owl` | HTMLElement / DOM text | [Owl](OWL-API.md) |
| Seahorse | `createSeahorseArtwork` | `ascii-animals-review/seahorse` | Canvas | [Seahorse](SEAHORSE-API.md) |
| Crab | `createCrabArtwork` | `ascii-animals-review/crab` | Canvas | [Crab](CRAB-API.md) |
| Sea turtle | `createTurtleArtwork` | `ascii-animals-review/turtle` | Canvas | [Turtle](TURTLE-API.md) |
| Butterfly | `createButterflyArtwork` | `ascii-animals-review/butterfly` | Canvas | [Butterfly](BUTTERFLY-API.md) |

## Explicit contracts, not unsafe casts

The species keep their own interaction and timing contracts. A Fox pounce is not marine ink; a Gecko fixed-tick step is not elapsed seconds; Owl intentionally renders semantic text rather than pretending to accept a canvas. Use the inferred controller type and species guide for update, reaction, still-pose and export operations. No arbitrary third-party species-registration contract is advertised.

All browser adapters use the shared per-window scheduler. Pause, reduced-motion and disposal are tested, but static action behavior differs intentionally by species. Do not assume `pulse()` or an interaction always resumes animation. Dispose the returned controller when unmounting. The core scheduler is independently importable through `ascii-animals-review/core`.

The marine renderer bundles its three built-ins. Pufferfish currently depends on that private renderer implementation; it is not a zero-cost/lazy-isolated import. Other typed subpaths preserve their own model and rendering implementation. See measured package fixtures rather than assuming equal size or performance.

Implementation availability is separate from visual acceptance and live deployment; consult the catalogue and integration review for current status.

## Across-screen journeys

The separate `ascii-animals-review/movement` subpath provides typed, seeded
viewport paths. `ascii-animals-review/movement/marine` connects them to the
existing cuttlefish, manta and octopus renderer. Movement owns travel and lanes
when enabled; natural scene/formation options remain saved for disabling it.
Other species keep their existing pose contracts. See [Movement](MOVEMENT.md)
for timing, reverse, resize, reduced-motion policy, tests and the isolated controls
consumer that the navigation shell can mount.
