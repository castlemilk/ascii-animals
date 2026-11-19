# Dragonfly — the pond director

Original procedural ASCII dragonflies with paired large eyes, a long segmented
abdomen and four narrow, attached, independently phased wings. This extension
adds a small directed pond around the existing integrated TypeScript model.

The accepted `createDragonflyArtwork` adapter and `./dragonfly` package entry are
preserved. This Dragonfly-only flight study starts from main
`b8f222dab868821f27bf2a64a98434f3483fc8e6`. It gives the four transparent wings
clearer fore/hind separation, broader hindwing bases and restrained veins;
adds a tail-first dart with braking; and articulates a six-foot twig landing
followed by a deliberate relaunch.

[Matched screenshots, motion and review manifest](evidence/flight-study/README.md) ·
[Flight-study brief and references](UPLIFT.md) ·
[Director API/defaults](DIRECTOR-API.md) ·
[Integrated adapter](../../docs/DRAGONFLY-API.md)

The new review evidence is explicitly native Canvas, with fixed tick/input logs.
Local Chromium launch was denied (`socket() failed: Operation not permitted`),
and the cloud browser could not reach the local server. No real-browser CSS,
physical touch, screen-reader or device-performance pass is claimed. The shipped
API and lifecycle are also exercised with typed and instrumented host tests.

## Direct the pond

- **Pond patrol:** separate territories, lookout pauses, landings and takeoffs.
- **Hovering attention:** one visitor attends the guide while others keep their
  own motives near the reeds.
- **Reed relay:** staggered short crossings, route following and rests.
- Choose 1–4 visitors, select by name, and assign patroller/sentinel/skimmer/wanderer
  roles. Route, tempo, spacing, size and breeze shape the composition.
- **Dart backward** anticipates, retreats tail-first, brakes and returns.
  **Land on a twig** lowers six feet into a grip and quiets the wings.
  **Relaunch** gathers wing power, releases the feet and returns to the route. Pointer movement guides attention without triggering darts.

The demo provides keyboard/touch alternatives: native selectors and buttons,
Guide, Pause/Reset, Slow/Still, and canvas-scoped 1–4/arrow/D/L/R/Space shortcuts and visible-anatomy touch selection.
Reduced motion remains still; an explicit action changes the composed pose.
Hidden/offscreen/zero-size hosts suspend work. There is one canvas/subscription
per ensemble, not one animation callback per visitor.

## Preview and reproduce

The generated public-adapter demo is `dist/dragonfly/index.html`. From the repo root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
# Open http://127.0.0.1:8000/dragonfly/
```

The species-local source study at `species/dragonfly/index.html` can also be served
from the repository root. It uses the same compiled species host; the integrated
`dist` demo additionally uses the accepted public adapter/shared scheduler.

With TypeScript 5.9.3 available:

```sh
node scripts/build.mjs
node --test species/dragonfly/tests/*.test.mjs test/dragonfly-integration.test.mjs
node species/dragonfly/scripts/build.mjs --check
npm run typecheck
```

The generated ESM and declarations are committed. Runtime code requires no npm
runtime dependencies. The package remains private and unpublished.

To reproduce native evidence, use an already installed `@napi-rs/canvas` and ffmpeg:

```sh
# Optional: DRAGONFLY_CANVAS_MODULE=/absolute/path/to/@napi-rs/canvas/index.js
node species/dragonfly/scripts/capture-director.mjs /tmp/dragonfly-director-evidence
```

The capture program records the exact seed, tick/event sequence, source digests,
positions, phases, clipping and label counts. It exports PNG/text posters,
scene/motion contact sheets and an actual GIF. No font files or copied ASCII art
are bundled; installed system monospace fonts may differ between platforms.

The earlier director captures in `evidence/director/` are historical baseline
evidence; they do not show the flight-study changes.

## Evidence boundary and original provenance

Historical checks are recorded in [DIRECTOR-VALIDATION.md](DIRECTOR-VALIDATION.md).
The flight-study review manifest pins its exact source, commands, new captures
and remaining acceptance. Native images are visual evidence of the geometry and
painter, not browser layout acceptance. The package remains private/unpublished.

The original anatomy/geometry/font-rights provenance remains in
[AUTHORING.md](AUTHORING.md) and `authoring.json`. The original solo
[API](API.md), [validation record](VALIDATION.md) and [integration proposal](INTEGRATION.md)
are retained as historical records of the initial species delivery. They do not
supersede the accepted current package adapter or this additive director API.
No educational ray renderer, external ASCII artwork, third-party mesh or font
binary was copied into the director.
