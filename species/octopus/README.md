# Octopus — the dim den

An octopus-only art and interaction revision for the canonical marine renderer.
The integration base is `b8f222dab868821f27bf2a64a98434f3483fc8e6`.

## Existing API, richer animal

No public option, export or method changes. This is still a valid typed consumer
of the private local review package:

```ts
import { createArtwork } from 'ascii-animals-review';

const octopus = createArtwork(canvas, {
  species: 'octopus', count: 1, scene: 'reactive',
  formation: 'independent', behaviors: ['hover'],
  size: 1.3, sizeVariation: 0, density: 1.45,
  palette: 'ember', glow: false, followPointer: true,
  speed: 1, seed: 17, reducedMotion: 'system',
});

octopus.pulse();   // Existing deliberate startle; never resumes pause.
octopus.pause();
octopus.restart(); // Keeps pause.
octopus.dispose();
```

The den is active for a **single octopus in independent, reactive hover/curious
behaviour**. Mixed casts, cruise/orbit, formations and enabled marine directors
keep their existing routes. They still receive the revised anatomy, exposed
sucker surfaces, local texture and reaction articulation. The existing
`tidepool-investigation` director is preserved; this patch does not add a new
shared director enum or replace its body blocking.

The shared catalogue's current octopus demo still defaults to that director.
Use the owned preview or the solo configuration above to review the den; wiring
it into a shared shell belongs to central integration.

The den's rockwork is an octopus-local Canvas underlay. It is excluded from the
animal sample/depth/owner buffers. Empty rock therefore stays empty water for
the existing animal hit test.

## What to look for

- Rounded mantle, warmer lateral eye mounds, shallow arm webbing, and eight
  independently posed tapered chains. Paired suckers roll with each oral arm
  surface instead of always facing the camera.
- Three arm tips remain fixed in world coordinates as the mantle shifts.
  Their curved chains retain forty equal links and the existing joint limit.
- A new invitation causes a visible small lean before a travelling bend extends
  one leading arm and a delayed neighbour. A local dark skin band crosses the
  mantle/head/web; it is not emitted light or a whole-animal brightness flash.
- The shared startle gathers, emits ink, and jets mantle-first. Contact release
  and replanting occur at unequal times. Ink remains the existing bounded
  world-space effect.
- Fast cancel/re-entry queues behind the current peel. A new target can trigger
  another examination without leaving the canvas. Startling mid-reach preserves
  the initial pose and gathers from it instead of snapping to neutral.

These are authored, stylized behaviours. The anatomical and behavioural
references, cross-species borrowings and rights ledger are in
[review/AUTHORING.md](review/AUTHORING.md). Phone rendering preserves the overall
silhouette and exposed sucker highlights; it does not resolve every paired cup
or make all eight overlapping arms separately countable in every pose.

## Review example

After the repository build, serve the repository and open
`species/octopus/preview.html`. This module example imports the actual built
marine class. It provides native buttons and canvas-scoped shortcuts:

| Input | Action |
| --- | --- |
| Gentle pointer movement | Invite inspection at that location |
| Tap empty water / Examine | Invite a reach; touching the animal retains its existing startle |
| Arrow keys, with canvas focus | Move the invitation |
| Enter | Repeat examination |
| J / Startle | Gather, ink, depart and recover |
| Escape / Release | Peel away from the invitation |
| Space / Pause | Hold or resume the current pose |
| Restart | Reset the seeded study while preserving pause |

The shell owns no timer or animation loop. System reduced motion starts with a
still. Motion-related controls keep that state; only explicit Play resumes it.
Listeners are aborted and the marine controller destroyed on page hide.

To create an independent HTML review file without modifying shared outputs:

```sh
node species/octopus/scripts/build-preview.mjs --out /absolute/path/octopus-den-preview.html
```

The builder uses the exact canonical source and records its input hash. The
standalone is a generated review artifact, not a new package export.

## Verification and central integration

The source patch intentionally excludes shared generated files. The central
integrator should apply it against the base, then run the existing build:

```sh
git apply --check octopus-den.patch
git apply octopus-den.patch
npm ci --ignore-scripts
npm run build
node --test test/species-geometry.test.mjs species/octopus/tests/*.test.mjs
npm test
npm run typecheck
npm run check:package
```

`npm run build` regenerates the marine compatibility bundle, standalone demos,
package output, and dependent copies such as the pufferfish runtime. Those
generated changes belong to central integration. If using the repository's
complete Pages preparation path, also run its existing
`python3 scripts/build-standalone.py` step. No workflow or deployment command is
part of this patch.

The existing `npm test` command does not discover this new owned test directory;
run the explicit `species/octopus/tests/*.test.mjs` command shown above as well.

Native evidence is reproducible with an already installed `@napi-rs/canvas`
and, for motion, `ffmpeg`:

```sh
node --expose-gc species/octopus/scripts/render-evidence.mjs /absolute/output --motion
```

This uses real geometry and Canvas2D calls with a simulated browser host.
It is **native Canvas evidence**, not browser screenshots, responsive CSS
acceptance, actual phone touch, or device-performance evidence. The manifest
records the source hashes, native backing-store adaptation, fixed-step event
log and output checksums. Browser acceptance remains a separate review gate.
