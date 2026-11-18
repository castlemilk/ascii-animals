# Fox: typed species adapter

The fox is an original deterministic side-profile character with four independently
planted paws, tail/breathing motion, cautious guidance, and a crouch → airborne →
forepaw landing → recovery → cooldown response. It is not a cuttlefish geometry
preset. Its typed adapter is deliberately separate from `createArtwork`.

```ts
import { createFoxArtwork, createFox, type FoxInput } from 'ascii-animals-review/fox';

const fox = createFoxArtwork(canvas, {
  fox: { seed: 17, facing: 'right', tailSway: .1, pounceHeight: .24 },
  grid: { cols: 112, rows: 44, monochrome: false },
  onInputs(batch) { /* persist accepted tick-stamped inputs if required */ },
});
fox.guide(.8, .15);
fox.pounce();
fox.update({ tailSway: .08 });
fox.pause(); fox.restart(); // preserves user pause
fox.play();
fox.dispose(); // call on unmount; repeatable

// Headless fixed-tick simulation, independent from browser presentation.
const model = createFox({ seed: 17 });
const input: FoxInput = { type: 'pounce', tick: 1, seq: 0 };
model.step(1, [input]);
model.dispose();
```

The root also exports `createFoxArtwork` and the named Fox configuration/state
types. The `./fox` entry additionally exports the headless factory, pointer
normalizer, static poses, limits/defaults and strict option validator. This remains
a private review package; these examples refer to a locally installed tarball.

## Lifecycle and intentional differences

| Concern | Fox contract |
| --- | --- |
| Playback | `play`/`pause` aliases of `setPaused`; OS reduced motion stays authoritative. |
| Reset | `restart()` repeats the current seed with settings and pause preserved; `reset(seed?)` permits an explicit new seed. |
| Actions | `pulse` aliases `pounce`; while paused/reduced-motion it displays a still crouch without advancing time. `guide`, `leave`, and `showStaticPose` are explicit controls. |
| Configuration | `update` returns void; `configure` returns frozen normalized options. Active response plans retain captured settings through cooldown. |
| Time | Browser host runs bounded 60Hz fixed ticks. Headless `createFox().step(nextTick, orderedInputs)` advances one integer tick; there is no seconds-based `advance`/seek method. |
| Inspection | `getOptions`, `getState`, `getStatus`, `exportText`; snapshots do not expose mutable live model state. |
| Disposal | `dispose()` is idempotent. `getStatus`/`disposed` remain readable; other methods reject after teardown. |

All model options remain documented in [the species reference](../species/fox/README.md).
Supported facing is left/right profile, not arbitrary yaw. Unknown fields, malformed
values and supplied validator bases are validated before mutation. `grid` is a
mount-time rendering choice, not a model option. No multi-fox formation, mixed
species geometry, generic plugin contract, or custom font capability is implied.

## Scheduler and renderer ownership

The adapter borrows the same per-window scheduler as the canonical library, or a
consumer's explicitly supplied `frameSource`. It releases only its own subscription.
Its orthographic glyph renderer remains fox-specific; Cuttlefish's camera, ink and
renderer are untouched. Pointer/motion inputs cannot resume reduced motion.
Hidden/offscreen/zero-size/paused mounts stop work; callback failures dispose safely.

This is the adapter pattern for recovered species: preserve a truthful typed model,
provide explicit lifecycle aliases, borrow host scheduling without owning it, and
add a generated demo plus packed-consumer tests. Do not cast incompatible species
into the cuttlefish option type or create a second independently edited renderer.

## Build and test

`npm ci --ignore-scripts && npm test` compiles both canonical codebases and runs
root plus Fox tests. `npm run typecheck` includes Fox type fixtures.
`npm run check:package` tests the real offline tarball, root/subpath imports and
strict consumer types. No npm publication occurs.

The canonical Fox source is `species/fox/src/`; `scripts/build-fox.mjs` compiles it,
ships modules under `lib/species/fox/`, and generates the real-adapter demo at
`dist/fox/index.html`. Generated output is checked, not independently edited.
Pages already uploads `dist/`, so `/ascii-animals/fox/` is deployable once an approved
merge and manual Pages deployment occur. The source-only demo remains for study.

Numerical/mock tests do not prove browser appearance, accessibility or performance.
The original native screenshots/GIFs have recorded provenance; browser QA is a
separate gate, not inferred from those assets.
