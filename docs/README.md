# ASCII Animals developer documentation

Start with [Getting started](GETTING-STARTED.md) to build the local package and
run a complete browser example. This documentation describes the runtime at
[`f63b20e2045b1070b10bde2efc4eb3a8536e606b`](https://github.com/castlemilk/ascii-animals/tree/f63b20e2045b1070b10bde2efc4eb3a8536e606b),
initially verified as the default `main` branch on 21 November 2026. The
[validation record](VALIDATION-2026-11-21.md#draft-pr-base-refresh) records the
later PR base refresh after the README-only change merged; runtime is unchanged.

## Choose a guide

| Task | Guide |
| --- | --- |
| Install and see an animal in a browser | [Getting started](GETTING-STARTED.md) — local tarball, native browser modules and complete runnable examples |
| Choose an import or understand package types | [Package contract](PACKAGE.md) — name/version, all 15 export entries, ESM, declarations and npm status |
| Configure cuttlefish, manta or octopus | [Strict TypeScript API](TYPESCRIPT-API.md) — validated options, defaults, methods and timing |
| Use another animal | [Animal API map](ANIMAL-APIS.md) — all 13 animals, their own hosts, options, inputs and lifecycle contracts |
| Mount in a UI and clean up correctly | [Browser integration](BROWSER-INTEGRATION.md) — sizing, keyboard/touch, reduced motion, disposal and framework/SSR ownership |
| Direct a mixed marine scene | [Marine director](MARINE-DIRECTOR.md) and the [runnable director example](examples/browser/director.html) |
| Add viewport journeys | [Movement](MOVEMENT.md) — the separate movement and marine movement subpaths |
| Review what was actually checked | [Validation, 21 November 2026](VALIDATION-2026-11-21.md) |
| Prepare a future release | [Release checks](RELEASE.md) — procedures and outstanding decisions, separate from completed verification |

## Source, demo and package are different artifacts

| Artifact | Verified state |
| --- | --- |
| Initial default-branch inspection | `main` at `f63b20e2045b1070b10bde2efc4eb3a8536e606b`; see the validation record for the refreshed PR base |
| Local package | `ascii-animals-review@0.0.0-review.0`; `private: true`; `UNLICENSED`; ESM with declarations |
| [Live Pages catalogue](https://castlemilk.github.io/ascii-animals/) | Successful deployment of that same source SHA; home and all 13 canonical animal routes returned HTTP 200 |
| npm registry | `ascii-animals-review` returned HTTP 404; `ascii-animals` belongs to another repository |

Use a built local tarball. **Do not substitute `npm install ascii-animals`.** See
[Package contract](PACKAGE.md) for source and registry evidence. HTTP and
deployment checks establish availability and provenance; they do not establish
visual quality, device performance or interaction acceptance.

The optional cuttlefish field study, manta reef study and octopus den are present
in this source and deployed. A proposed generic variation selector, another
branch or an artwork prototype from a separate local review is not established
by that fact. Import only the APIs exported by the installed package; a live HTML
study does not automatically create a package entry point.

## Reading older review documents

[API.md](API.md), the original [integration review](INTEGRATION-REVIEW.md), and
older species acceptance records preserve historical provenance and tests. Their
then-current branches, package coverage and pending integration statements are
not the current installation contract. Use the guides above for integration and
the dated validation record for this documentation patch's evidence.
