# Gecko: a foothold in the night

Review base: `b8f222dab868821f27bf2a64a98434f3483fc8e6` on
`castlemilk/ascii-animals/main`, reverified before publication. Scope is entirely
`species/gecko/**`. This review is for central integration by Bear.

## What changed

The Tokay-inspired silhouette has a broader head, narrow neck, fuller spotted
trunk, golden slit eyes, banded tapering tail, and individually oriented pale
toe pads. Fixed plaster lips, recessed masonry, cracks, a lantern and edge fern
give the animal a wall with depth. The animal remains the brightest layer.
Reference observations and rights are recorded in [AUTHORING.md](AUTHORING.md).

The climb assesses its target, peels one fan, transfers that foot, adheres,
pulls through the supporting limbs, and settles. The support order remains
front-left, rear-right, front-right, rear-left. Palm position, fan angle and
toe spread are latched at contact, including when options change; no renderer
translation substitutes for locomotion.

The hunt tracks a visible insect, braces, advances the body in a short supported
pounce, catches only near the emitted jaw, pauses, replants displaced feet one
at a time, and resumes its route. A new cue owns the target; interrupts and
unreachable targets release the hunt. Timings are authored for legibility.

Climb and Offer moth sit immediately above the canvas. Portrait controls use a
two-by-two arrangement and at least 44 px target height. Pointer/touch guidance
and existing controls remain; focused-canvas C climbs, M offers a moth, Escape
releases guidance, arrows guide and Space pauses. Source inspection and mocked
host tests support these claims; real-browser interaction is still a review gate.

## Review the evidence

All supplied artwork captures use the actual compiled Gecko renderer through
`@napi-rs/canvas`. **They are native Canvas renders, not browser screenshots.**

| Evidence | Purpose |
| --- | --- |
| [Matched desktop](evidence/matched-native-desktop.png) | Before/after, 1000 × 680 artwork panels, seed 37, moonlit wall tick 360 |
| [Matched phone](evidence/matched-native-phone.png) | Before/after, 390 × 390 artwork panels, same seed/tick and selected Mica |
| [Climb states](evidence/after-native-moonlit-wall-states.png) | Support, lifted front foot, weight transfer and inspection |
| [Hunt states](evidence/after-native-lantern-hunt-states.png) | Brace, actual catch, sequential recovery and return |
| [Climb motion](evidence/after-native-moonlit-wall.mp4) | Uninterrupted normal-speed simulation excerpt |
| [Hunt motion](evidence/after-native-lantern-hunt.mp4) | Uninterrupted normal-speed simulation excerpt |
| [Directed actions](evidence/after-native-directed-sequences.mp4) | Climb and Offer moth cues, two six-second encounters with an explicit cut between them |
| [Capture manifest](evidence/native-evidence.json) | Exact runtime, source/file hashes, cues, ticks, commands and limits |

The same explicit grids are used on both sides: 224 × 144 desktop and
112 × 72 phone. The selected phone camera intentionally changes from the
baseline's 3.4 × 2.6 world window to 2.55 × 2.75. This is part of the improvement,
not a later image crop. The browser's full-wall automatic grid changes to
224 × 112; the comparison keeps the old grid constant to isolate the artwork.
Capture manifests record exact source hashes, cues, ticks and file digests.

Chromium failed before page load (`socket() failed: Operation not permitted`).
The advertised cloud browser could not reach the local server, and rejected
local-file navigation by policy. No further browser route was attempted after
that rejection. The browser harness is supplied for central review, and no
browser/device performance, layout, accessibility or interaction pass is claimed.

## Source and compatibility

Canonical TypeScript and its species-local compiled JavaScript/declarations
are included. Public factory signatures, event/recipe shapes, scene IDs and
stable member IDs remain compatible. `GeckoFoot.toeSpread` is an optional
additive contact field; older snapshots fall back to the option value. The
director's new driven-locomotion seam stays internal to the species and is not
added to the shared public facade. Replay state/cell hashes intentionally change
for the new anatomy and gait; strict seeded repeatability and default-habitat
parity remain tested.

No shared engine, public facade, export map, root `lib/`, `dist/`, other animal,
dependency, or workflow is changed. The existing integer 60 Hz simulation,
bounded queues, sample caps, resize/pause/reduced-motion and disposal contracts
remain in force. Test results are in [validation-results.json](validation-results.json).
The compact review index is [review-manifest.json](review-manifest.json).

Final gates: 80/80 Gecko tests; source and public type contracts; 8/8 package,
scheduler and generated-demo integration tests; root package build; and the
local tarball consumer/SSR/NodeNext/Bundler type checks. The package checker
explicitly leaves optional esbuild/Rollup/Webpack checks and real-browser
acceptance unrun. Twenty generated Gecko files in the isolated package build
match the frozen species build byte for byte.

## Apply and generate centrally

From a clean checkout of the review base, apply the independently usable patch:

```sh
git apply --check gecko-anchored-wall.patch
git apply gecko-anchored-wall.patch
npm ci --ignore-scripts --no-audit --no-fund
node node_modules/typescript/bin/tsc -p species/gecko/tsconfig.json
node --test species/gecko/test/*.test.mjs
node node_modules/typescript/bin/tsc -p species/gecko/test/tsconfig.json
```

Bear can regenerate shared package/demo outputs using the existing commands:

```sh
npm run build
npm run typecheck
npm test
npm run check:package
```

`npm run build` invokes the existing Gecko compiler/copy and real-adapter demo
generation. `npm test` also runs that build through its pretest hook. If the
species-local offline HTML is desired, install/use esbuild externally and run
`GECKO_ESBUILD_MODULE=/absolute/path/to/esbuild/lib/main.js node species/gecko/scripts/standalone.mjs`.
No generated shared output is included in this species branch.

During central integration, update the automatic full-wall grid entry in
`docs/GECKO-API.md` from 224 × 144 to 224 × 112. That shared document is outside
this branch's species-only scope.

For exact-source browser review, serve the checkout and point the supplied
`species/gecko/scripts/capture-anchored-wall.mjs` at
`/species/gecko/index.html` using its documented `--url` argument. Review the
generated `dist/gecko/` package demo separately after the central build.
Complete the page-layout, pointer, touch, keyboard, reduced-motion and lifecycle
checks in a working browser before final acceptance. The accompanying native
capture scripts reproduce the artwork and directed replays without a browser.
