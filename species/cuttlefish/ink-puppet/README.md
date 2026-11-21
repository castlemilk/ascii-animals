# Cuttlefish / Inquisitive Ink Puppet

A species-local, opt-in **2D ASCII character prototype**. It is review work against
main `f63b20e2045b1070b10bde2efc4eb3a8536e606b`, not a shipped gallery replacement.
Only this directory is added. The original marine API, Cuttlefish renderer,
full-lens encounter, small swimmers, distribution files and other species remain
unchanged.

Start with [REVIEW.md](./REVIEW.md) for findings, evidence and limitations,
[CONCEPTS.md](./CONCEPTS.md) for the two editable directions, and
[IMAGEGEN-PROMPTS.md](./IMAGEGEN-PROMPTS.md) for the exact reference-board prompts.
[AUTHORING.md](./AUTHORING.md) preserves the brief written before implementation.

## Try the review

From the repository root, serve the checkout using an ordinary local HTTP server
and open `/species/cuttlefish/ink-puppet/`. For example:

```sh
python3 -m http.server 8765
```

The downloadable `ink-puppet.html` is a self-contained alternative. Rebuild it
without installing dependencies:

```sh
node species/cuttlefish/ink-puppet/build-preview.mjs --out ../cuttlefish-review/ink-puppet.html
```

The preview embeds source modules and styles. No concept image draws the animal.
The review environment could not open this local preview in its browser; real
browser acceptance remains open. Native evidence is labelled accordingly.

Choose **Offer a shrimp** or **Disturb the water**, then tap the water. Input
position changes heading, approach/reach or escape direction; a nearby
disturbance produces a stronger retreat. An active action locks its target and
finishes before another is accepted, followed by a 0.6-second cooldown.

Focus the canvas to use arrows for target placement, `I` for investigation, `R`
for retreat, `Space` for pause and `Escape` for restart. The static motion keys
and deliberate paused taps compose stills. They do not override reduced motion.
The View menu also mounts the unmodified canonical gallery configuration,
full-lens encounter and 35% swimmers as references. Those are separate renderers;
the new puppet does not claim their three-dimensional camera behavior.

## Local API

```js
import { createInkPuppet } from './browser.mjs';

const artwork = createInkPuppet(canvas, { seed: 7, size: 1 });
artwork.cue({ type: 'investigate', x: 0.3, y: -0.1 });
// Coordinates are normalized around the canvas centre: -0.5 through 0.5.
// cue returns false for invalid, conflicting or unavailable actions.
artwork.setPaused(true);
artwork.showStill('retreat', 1.75, { x: 0.25, y: -0.1 });
const snapshot = artwork.getState(); // detached and readonly
artwork.destroy();
```

The declarations are in `index.d.ts` with a direct `.mjs` import bridge. This is
an isolated API, not a new public package export. The model is pure fixed-tick
state; the renderer builds printable-ASCII glyph/color/owner grids; the adapter
owns input, visibility, the shared scheduler and Canvas presentation.

## Verify

```sh
node --test species/cuttlefish/ink-puppet/*.test.mjs
node --test test/cuttlefish-study-director.test.mjs test/cuttlefish-study-adapter.test.mjs test/cuttlefish-encounter-framing.test.mjs test/independent-swimby.test.mjs
node node_modules/typescript/bin/tsc -p species/cuttlefish/ink-puppet/tsconfig.json
```

Executed result: **29 prototype tests, 25 canonical tests and TypeScript 5.9.3
strict type checking pass**. The repository-wide suite is not claimed. The test
hosts simulate DOM and Canvas; they are not browser or phone measurements.

Native capture requires `@napi-rs/canvas`, FFmpeg, FFprobe and installed Liberation
Mono. Resolve Canvas from the checkout or set
`CODEX_PRIMARY_RUNTIME_NODE_MODULES` to the directory containing it. No font
binary is bundled.

```sh
node species/cuttlefish/ink-puppet/capture-native.mjs --out ../cuttlefish-review/evidence/native
node species/cuttlefish/ink-puppet/capture-inputs.mjs --out ../cuttlefish-review/evidence/native
```

The capture scripts write outside the repository. Their manifests record exact
source hashes, options, viewports, model ticks, input logs and runtime provenance.
SVG output contains editable text glyphs. The MP4s are 1x model replays, not
browser screen recordings or performance claims.

## Integration boundary

No merge, push, publication, deployment or package-export change is part of this
patch. A future gallery integration needs explicit coordination and separate
verification of canonical lens/patrol parity, multi-animal behavior, real browser
input, reduced-motion changes and target-device frame time.
