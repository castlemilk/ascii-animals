# Private Spring Pea R2 adapter

This is a new reconstruction, not the missing original Spring Pea patch or ZIP.
Its exact source base is recorded in `BASE.json`. The earlier revision was made
against `f63b20e2045b1070b10bde2efc4eb3a8536e606b`; those bytes were not recovered.

Every addition is contained in `species/frog/variants/spring-pea-r2/`. The
Original Frog, public exports, shared route, default renderer, package files and
README files are unchanged. Nothing selects this variant unless a caller imports
this private adapter. It is intentionally absent from the npm export map and
the shared gallery selector.

## Run the private review

From the repository root, install the existing locked dependencies and build:

```sh
npm ci
npm run build
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/species/frog/variants/spring-pea-r2/review/`.
The review page owns one canvas and one active controller. Switching Original
and R2 disposes the previous controller before mounting the replacement with
the same seed and composition.

## Opt in explicitly

After the normal build, a private local host can use:

```js
import { createSpringPeaArtwork } from
  './species/frog/variants/spring-pea-r2/index.mjs';

const artwork = createSpringPeaArtwork(canvas, { seed: 23 });
// Existing Frog controller methods and public facade aliases are retained.
artwork.pause();
artwork.play();
artwork.dispose();
```

The wrapper delegates to the same compiled `createFrogArtwork` facade as
Original, injecting `createSpringPeaPreview` through the existing
`previewFactory` seam. It owns that option; a caller-provided `previewFactory`
does not replace R2. All remaining configuration is validated by the canonical
factory. The returned controller, species identity, event log, replay model,
keyboard/touch mapping, user pause, reduced motion, visibility/size gates and
cleanup remain canonical. No additional timer, animation loop or model is
introduced by the rendering adapter.

The private preview uses the canonical generated model and choreography modules.
Keep its base and the built `lib/` output aligned. Do not copy this adapter into
an unrelated installed package version and assume its private imports are a
stable public API. A future integration must explicitly decide where to expose
the variant; this patch makes no such shared integration decision.

## Review boundaries

The review page is local evidence tooling, not a new shared route. Its controls
exist to compare the same input sequence and to exercise the canonical gates.
Generated concept boards are art direction; native Canvas exports and actual
browser captures are separately identified in the review packet. See
`REVIEW.md` and `tests/VALIDATION.md` for exact commands, results and remaining
limits.
