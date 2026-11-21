# Octopus: Pocket Trickster

An isolated, editable ASCII character prototype against main
`f63b20e2045b1070b10bde2efc4eb3a8536e606b`. This patch adds only
`species/octopus/trickster/**`. It does not replace the shared octopus renderer,
change package exports, alter another species, or publish anything.

The character is a tactile mischief-maker: large slit eyes, eight attached curled
arms, a leading arm that reaches a real target, and a squash/ink/sideways-peek
sequence. Artwork is a bounded grid of printable ASCII glyphs drawn with
`CanvasRenderingContext2D.fillText`. There are no runtime image assets, downloaded
fonts, or new dependencies.

## Try the standalone prototype

From the repository root:

```sh
node species/octopus/trickster/build.mjs /tmp/pocket-trickster.html
```

Open the resulting HTML locally in a browser. Its script and CSS are inline; it
requires no server or network requests. The supplied review bundle already
contains `pocket-trickster.html` built from this source. The ordinary module page
at `species/octopus/trickster/index.html` can also be served by an existing local
development server.

Tap/click the water to offer a pearl, or use **Offer a pearl**. The left/right
position selects the tactile arm and the target. **Release** interrupts the reach
from its current pose. Tap the character or choose **Ink peekaboo** to gather,
hide, peek from the disturbance side, and settle. Busy actions do not queue an
unbounded series of reactions.

Focus the canvas for keyboard controls: arrows move the invitation, Enter invites,
J starts ink peekaboo, Escape releases, and Space pauses. Tab remains normal page
navigation. Semantic buttons provide the same actions. Reduced motion starts with
a meaningful still; **Play** is an explicit opt-in. Restart, pointer input and
resize do not silently override pause or the system preference.

## Editable parts

| File | Owns |
| --- | --- |
| `core.mjs` | Seeded 60 Hz state, original arm curves, expressive poses, action timing and input outcomes |
| `render.mjs` | ASCII grid, silhouette, eyes, palette, contact accents and graphic habitat |
| `browser.mjs` | Local controller, pointer/keyboard input, shared scheduler subscription, visibility and teardown |
| `preview.mjs`, `index.html`, `style.css` | Prototype controls, accessible labels and responsive shell |
| `build.mjs` | Dependency-free standalone export |
| `review/CONCEPTS.md` | Two art directions, motion keys, palettes and verbatim ImageGen prompts |
| `review/REVIEW.md` | Shipped-art critique, evidence provenance, measured limits and remaining work |

The review bundle includes six editable SVG/text cell maps for idle, contact and
peek at desktop and phone sizes. These are actual renderer output. The two
ImageGen boards are concept references; they are not screenshots or runtime art.

## Local API

```js
import {createOctopusTrickster} from './browser.mjs';

const octopus = createOctopusTrickster(canvas, {seed: 17});
octopus.invite(.7, .33);
// Later, while the reach is active:
octopus.release();
octopus.pulse(-.5, 0);
// On host teardown:
octopus.destroy();
```

This is a separately named prototype API, **not a drop-in replacement for
`createArtwork`**. Public package behavior is preserved by leaving the package
and shared renderer untouched. Types for the local core/controller are supplied
in `core.d.mts` and `browser.d.mts`.

Manual deterministic replay uses `{autoStart: false, paused: false,
reducedMotion: 'ignore'}` and `advance(1 / 60)`. Inputs are applied on the next
fixed tick. Coordinates are clamped to x `[-.9, .9]`, y `[-.65, .7]`. The core
contains no clock, DOM or random-global access. The guarantee covers the same
implementation, seed, normalized input log and ticks; font pixels can differ by
platform. State serialization/cross-version restoration is not an API promise.

Resource bounds: eight arm curves, at most 4096 cells, 64 queued inputs, five
catch-up steps, DPR at most 2, and a capped canvas backing store. With the default
visibility observation enabled and IntersectionObserver available, hidden,
offscreen, zero-size, paused and destroyed controllers do not retain recurring
animation callbacks. Elapsed hidden time is discarded on resume. Listener,
observer and shared-scheduler teardown is idempotent.

## Checks

```sh
npm ci --ignore-scripts
npm run build
node --test species/octopus/trickster/tests/*.test.mjs
node --test test/public-api.test.mjs test/species-geometry.test.mjs test/lifecycle.test.mjs test/scheduler.test.mjs species/octopus/tests/*.test.mjs
node node_modules/typescript/bin/tsc -p species/octopus/trickster/tests/tsconfig.json
```

Recorded result: build passed; 38 prototype tests passed; 45 selected existing
contract/species tests passed; local TypeScript declarations compiled. This is
not a claim that the repository's entire test suite ran.

Optional evidence runners are separate from package/runtime dependencies:

```sh
node species/octopus/trickster/tests/capture.mjs --out=/tmp/octopus-browser-evidence
node --expose-gc species/octopus/trickster/tests/render-native.mjs --motion --out=/tmp/octopus-native-evidence
```

The browser runner expects a checkout directory named `ascii-animals`, Playwright,
a sandbox-capable Chromium and ffmpeg for video. It resolves a normal installed
Playwright package first and accepts `--playwright=/absolute/path/to/index.mjs`
and `--chromium=/absolute/path/to/chromium` overrides. It was prepared but could
not run in the review environment. The native runner expects `@napi-rs/canvas` and
ffmpeg as external review dependencies. It reads the pinned main commit with
`git show`; keep that commit available. Native evidence is explicitly labelled
and does not prove browser layout, trusted input or physical-phone performance.

The native raster-and-draw p95 exceeded the declared 16 ms reference; this is a
reviewable visual prototype, not a production performance sign-off. See the
review before coordinating any integration into the gallery or classic study.
