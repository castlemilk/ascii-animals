# Manta / Reef shadows

A manta-only source and interaction study based on main
`b8f222dab868821f27bf2a64a98434f3483fc8e6`.

The existing public `createArtwork(canvas, {species:'manta'})` receives the new
anatomy, material and flexible fin motion. The two directed sequences and reef
habitat are in this **species-local study**, not a new stable package export.
Its typed adapter consumes the actual built marine renderer and uses its
existing input, scheduler, buffers, reduced-motion and disposal contract.

## Run the study

From the repository root:

```sh
npm ci --ignore-scripts
npm run build
node species/manta/scripts/build-study.mjs --out=artifacts/manta-reef.html
```

Open the resulting self-contained HTML in a normal browser. It needs Canvas 2D,
but no server, network dependency, downloaded font or external image. The
unbundled `species/manta/index.html` can also be served from the repository root
after building. The breadcrumb in that source view points to the local catalogue;
the movable bundled file links to the source repository.

### Controls

| Action | Result |
| --- | --- |
| Move the pointer gently | Manta attention changes heading and fin loading |
| Click/tap a visible manta cell | Commit a bank on that side; empty water is excluded |
| Bank left/right buttons; focused-canvas arrow keys | Choose a bank direction, with anticipation and slow recovery |
| Pause; focused-canvas Space/Enter; Escape | Toggle playback or explicitly pause |
| Current selector | Change the route, eased over three simulation seconds |
| Four still buttons | Inspect distinct authored poses with animation paused |
| Resume live after a still | Return to the previously saved live clock |
| Reef habitat / Point study | Inspect the habitat or the same geometry as points |

A bank takes 8.8 seconds: 0–.8 anticipation, .8–3 response, 3–8.8 recovery.
Additional banks during that response are ignored. Bank controls while paused
show a still without starting animation. The system reduced-motion preference
starts static; only an explicit Play action resumes it. Touch scrolling is
preserved by `touch-action: pan-y`.

## Verification

The regular Pro Chat environment produced **native Canvas evidence**, not
real-browser screenshots. Native captures include matched 1100×620 and 390×470
before/after images, five study states at each size, a 32-second current loop,
and a 13-second recording with a bank accepted at t=2 seconds. Both movies retain
real timing. See `REVIEW.md` and the private review archive for results and hashes.

```sh
npm test
npm run typecheck
npm run check:package
node --test species/manta/tests/*.test.mjs
node node_modules/typescript/bin/tsc -p species/manta/tests/tsconfig.json
node species/manta/scripts/build-study.mjs --out=artifacts/manta-reef.html --check
```

The full repository commands generate shared outputs, so they were run in an
isolated validation copy. The patch itself contains only `src/animals/manta.js`
and `species/manta/**`. No other species, shared engine, public entry point,
package manifest, workflow or committed generated asset is changed.

### Reproduce native evidence

Prepare a separate clean checkout of the pinned baseline and run its normal
build. Install `@napi-rs/canvas` externally and make it available to Node (for
example with `NODE_PATH`); it is intentionally not added to the package. The
composition helper additionally uses Pillow and ffmpeg.

```sh
node species/manta/scripts/capture-native.mjs --baseline=/path/to/built-baseline --out=/path/to/native
python3 species/manta/scripts/compose-evidence.py --input=/path/to/native --out=/path/to/review --movies
```

The capture helper rejects stale `src`/`lib` manta bytes. It uses the unchanged
renderer with a mocked DOM and native raster backend. A host-only glyph-crop
cache avoids that backend retaining a full mutable atlas per glyph. A direct
versus cached phone frame differed in one RGBA channel by 1/255; geometry and
cell data were identical. These captures do not establish browser pixel parity,
DOM layout, real touch delivery, accessibility or device performance.

## Central integration

Apply the independent patch onto the pinned main (or cherry-pick the review
branch), then let the central owner generate shared entries:

This change supersedes the **manta hunk only** of the earlier anatomy candidate.
It already includes the dorsal-eye deletion; do not apply that deletion twice.
Other species in that earlier candidate remain outside this patch's ownership.

```sh
git apply --check manta-reef-b8f222d.patch
git apply manta-reef-b8f222d.patch
npm ci --ignore-scripts
npm run build
node scripts/build-demo.mjs --check
node species/manta/scripts/build-study.mjs --out=dist/manta/index.html
```

Run the verification commands above and review the study in actual desktop and
phone browsers before approval. The study directory is not currently included
in the npm package's `files` list; adoption as a stable export, catalogue entry
or shared director chapter requires central integration. This patch does not
perform that integration or alter deployment automation.

Anatomy, source references, the earlier no-eye candidate reconciliation,
coordinate bounds and movement decisions are in `ART-DIRECTION.md`.
