# Seahorse — eelgrass direction review

## Scope and integration base

- Repository: `castlemilk/ascii-animals`.
- Exact base: `b8f222dab868821f27bf2a64a98434f3483fc8e6`.
- Working branch: `feat/seahorse-eelgrass-direction`.
- Canonical implementation: [`src/public/seahorse.ts`](../../src/public/seahorse.ts).
- This revision owns Seahorse source, its demo, species documentation, tests and
  review tools. Shared engines, entry points, workflows and other species are
  outside the patch. Generated `dist` changes are excluded.
- Publication boundary: a working branch and draft PR for central review only;
  no merge, deployment, repository settings change or package publication.

This is a new visual and movement revision of the shipped holdfast director.
The earlier `AUTHORING.md` and `REVIEW.md` describe historical acceptance;
this record and the delivery manifest describe the eelgrass revision.

## Animal brief and reference grounding

The subject is a stylized genus-level seahorse, not a species identification
model. Its three recognition anchors are a tubular snout on a bowed neck, an
upright armoured trunk with a low coronet, and a tapering prehensile coil.
Both mirrored profiles, bounded body lean and head pivot are supported; a full
frontal or three-dimensional turn is not implemented.

| Primary reference | Observation used | Custody |
| --- | --- | --- |
| [Seattle Aquarium — Seahorses](https://www.seattleaquarium.org/animal/seahorses/) | Bony rings, coronet, upright swimming and plant-grasping tail | Read for anatomy; no image or artwork copied |
| [Australian Museum — White's Seahorse](https://australian.museum/learn/animals/fishes/whites-seahorse-hippocampus-whitei-bleeker-1855/) | Limited trunk flexibility, dorsal/pectoral fin control, prehensile hold, rigid tubular snout and species-dependent coronet/ring counts | Read for construction; no photograph or diagram copied |

References were consulted on 19 November 2026. Geometry and choreography are
original procedural work. The eleven stylized trunk rows and three neck rows
are an artistic detail level; the tail is not a taxonomically counted model.
Cue timing, current strength and greeting responses are authored animation,
not biological or fluid simulation claims. No downloaded reference art,
photograph, model geometry or font binary is shipped.

## Construction and visual decisions

The single-animal study and directed garden now share one anatomy painter.
Continuous filled neck, breast and pelvis geometry supports curved plate seams
and two longitudinal ridges. Low, uneven tubercles break the back edge without
turning into a row of large spines. The coronet is a small swept shape attached
to the skull. Eye, crown and complete snout use the same head transform, so
inspection rotates a rigid head instead of bending the snout like a straw.

The tail shares one curve between rendering and contact solving. Opening changes
its angular sweep as well as its radius; an unfurling tail therefore changes
shape. The tapered end returns inside the coil. When held, the distal rear arc
passes behind the blade and the returning arc passes in front. No artificial
contact dot or asterisk is needed to indicate attachment.

Eelgrass replaces the old branching frond. Eleven faint distant ribbons,
midground holdfast blades, sparse suspended matter and two low foreground leaves
give the clearing depth. The main blade and contact point use exactly the same
curve. Its lateral sway moves the animal's attachment; a fixed world-space
marker is no longer mistaken for contact with a moving plant.

The logical representation remains a printable ASCII grid displayed through
Canvas2D text. Logical cells keep glyph, tone, layer and visible owner. The
compatibility layer name `kelp` and scene ID `kelp-garden` remain unchanged even
though the visible habitat is eelgrass. No new runtime dependency was added.

The demo uses 160×76 cells on desktop and 100×76 on a phone. A phone garden
preset opens with one visitor, while desktop retains three; explicit population
choices survive resize. Labels start off. Small grids and four visitors remain
supported, with less anatomical detail; equal readability at every count and
permitted grid is not claimed.

## Authored movement phrases

The existing arrival/rest/depart/return scenes, roles and typed actions remain.
The following cues now have different timing and different causes of movement.
All ages below are 60 Hz simulation ticks, independent of `speed`.

| Existing action | Anticipation | Response | Recovery |
| --- | --- | --- | --- |
| `startle` / **Brace current** | Tighten the coil during ticks 0–28; torso lean starts after tick 24 | Lean against the configured signed current through a separate brace envelope | Torso eases back from 144–216; coil tension releases from 174–240 |
| `release` | In a held rest pose, look and begin uncoiling while contact remains complete through tick 24 | Let go during 24–66, then drift and hover through 145 | Lead the tail back during 145–210, then rewrap and settle through 240 |
| `inspect` | Notice and turn the complete head during the first 30 ticks | Approach begins after tick 24; a held animal pivots around its tail, a free animal keeps its route | Body approach eases out from 112–180; head attention settles from 130–180 |
| `anchor` | Reach into the hold over the first 54 ticks | Increase grip and curl on the moving blade | Recover the prior route over 120–180 |

The brace uses the existing `startle` action against `current`; it does not add
a new action or simulate a water impulse. Brace and inspection keep exact tail
contact while the underlying route remains held. In a held rest pose, release
genuinely detaches before returning. Cues do not pause an evolving cycle route:
its departure can release an existing grip earlier. Free travelers and duet
partners join and recover their ongoing
routes without a forced attachment snapping away when a cue expires.

Each visitor still has one cue slot. Repeated live cues are ignored until that
slot recovers; no unbounded event queue is introduced. Deliberate still cues
replace the selected poster without advancing the clock or starting playback.
Fins retain independent seeded phases and do not move their attachment roots.

## Interaction, lifecycle and compatibility

Pointer motion guides the selected animal. A tap carries its own normalized
position, selects a nearby visitor and cues inspection without requiring hover.
Leaving or cancelling a pointer clears attention. Empty-water taps guide without
selecting an unrelated visitor. Native buttons provide all deliberate gestures.

The focused canvas retains arrows for selection/attention, Enter for inspection,
R for release, H for anchoring, Escape to clear and Space to toggle pause.
Modified shortcuts and keys directed at other controls are not intercepted.
The demo's document order is artwork, director controls, still poses, then roster;
desktop places the controls alongside the artwork and phone keeps that order.
Compact scene buttons bring the artwork above the old large editorial cards.

Requested pause, reduced motion, hidden state, offscreen state and zero size
remain independent blockers. Cues, pointer attention, resize and restart do not
override them. The controller borrows the shared scheduler; no per-animal RAF
or cue timer was added. Disposal remains idempotent with post-disposal mutators
inert and multiple instances isolated.

Public declarations are byte-identical to the baseline. The verified SHA-256 of
`lib/public/seahorse.d.ts` is
`01b6049824a4c2a92480e6b51fe106366a7ac803eb8550f7dc39d3f0154ecf4c`.
Methods, defaults, action unions and snapshot shapes remain compatible.
The study's appearance intentionally changes; its original greeting timing and
controls remain. A study director snapshot is still bookkeeping, not literal
portrait geometry. See [`SEAHORSE-API.md`](../../docs/SEAHORSE-API.md).

Determinism means the same implementation, options, seed, ordered inputs and
integer tick sequence reproduce logical state/cells, including 1/2/5-tick
grouping. It does not promise matching pixels across browsers or fonts.
Existing limits remain: four visitors/cue slots, 160×100 cells, explicit steps
of 0–600 ticks, six browser catch-up ticks, 100 ms active-time cap, DPR ≤2 and
2048 CSS pixels per canvas axis. These limits are not performance measurements.

## Review iterations that changed the result

1. Hollow-looking rib lines were replaced with a continuous solid body fill,
   curved seams and narrow highlights, so armour reads as volume.
2. A hook-like tail was revised to return inside a visible coil, while opening
   changes both sweep and radius.
3. A fixed rear-depth interval missed the upper blade crossing in held/braced
   poses. Depth now follows the coil angle; separate crossing probes check that
   the lower return is in front and the upper wrap is behind the blade.

## Executed evidence and remaining gates

| Evidence | Status and boundary |
| --- | --- |
| Full tests | 626/626 passed on the final built source with `npm run test --ignore-scripts`; the build had already passed separately |
| Focused Seahorse tests | 39/39 passed on the final built source: 10 original plus 29 director/eelgrass |
| Project and species type checks | `npm run typecheck` and the Seahorse TypeScript fixture passed |
| Packed-consumer checks | Passed repeatable tarball, offline install, SSR imports, exports and NodeNext/Bundler/server types; esbuild, Rollup and Webpack execution were not run |
| Geometry probe | 1,440 poses / 4,844,468 emitted points; zero nonfinite or out-of-world points in declared samples |
| Contact depth probe | 18 crossing cases passed across left/right facing, −1/0/+1 current and held/preparation/braced poses |
| Native still captures | 33 final states captured across desktop solo, phone solo and desktop ensemble, matched to the pinned baseline with identical options |
| Native motion captures | 314 frames completed: 157 desktop and 157 phone, ticks 0–780 inclusive, sampled every five ticks at 12 fps; brace at 30, release at 300, inspect at 570 |
| Demo source checks | JavaScript syntax, HTML nesting/57 unique IDs and whitespace checks passed; no browser-layout claim |
| Real browser | Blocked: local Chromium 156.0.8078.79 (Debian 13) failed socket creation with `EPERM`; cloud browser refused `127.0.0.1:8764` |

Native captures call the actual built `createSeahorseArtwork` drawing code in
`@napi-rs/canvas` 0.1.100 (Skia), with Node 24.22.3, DejaVu Sans Mono, a fake DOM
and a deterministic frame source. Full-size still surfaces are 1280×900 and 390×530;
they are **native Canvas renders, not browser screenshots or phone UI captures**.
Motion surfaces are 780×660 and 390×530 over a 13-second simulation span.
The sampled motion is not a browser recording or evidence of achieved FPS.
The review inspected representative individual frames and numeric continuity;
normal-speed video playback was not observed in a browser.

The generated `capture-manifest.json` records options, ticks, viewport, source
module/font hashes and logical-frame hashes. The bounds tool's JSON records
the exact source/module hashes and actual point/crossing results. The delivery
review manifest is authoritative for final files and hashes; do not substitute
this prose for it or infer an unrecorded final source hash.

Numerical/fake-DOM checks do not establish browser reflow, real pointer/touch
dispatch, font fallback, screen-reader behaviour, Safari/Firefox compatibility,
physical-phone performance, heap growth, battery cost or WCAG conformance.
Those remain central review gates. Bounds probes cover declared finite samples,
not an exhaustive mathematical proof. No biological-accuracy claim is made.

## Reproduction and central integration

Run from the repository after applying the species-only patch:

```sh
npm ci --ignore-scripts
npm run build
node --test test/seahorse.test.mjs test/seahorse-director.test.mjs test/seahorse-eelgrass.test.mjs
npm test
npm run typecheck
node node_modules/typescript/bin/tsc -p species/seahorse/tests/tsconfig.types.json
node scripts/check-package.mjs --report artifacts/seahorse-package.json
node species/seahorse/tools/review-eelgrass-bounds.mjs artifacts/seahorse-bounds.json
node species/seahorse/tools/capture-eelgrass.mjs artifacts/seahorse-stills
node species/seahorse/tools/capture-eelgrass.mjs artifacts/seahorse-motion lib/public/seahorse.js --motion
```

Captures require an existing `@napi-rs/canvas` installation and the stated font;
`SEAHORSE_CANVAS_MODULE` and `SEAHORSE_FONT_FILE` can name supported local paths.
No review dependency is added to the package. Capture the pinned baseline with
the same tool/options and its built module path for matched before/after images.

Central generation command: **`npm run build`**. This regenerates the package and
demo from canonical inputs; generated output is intentionally absent from this
independently applicable patch. With a working browser, serve `dist`, open
`seahorse/index.html` and complete desktop/phone, keyboard/touch, live preference,
resize, repeated poster, lifecycle and performance review before acceptance.
