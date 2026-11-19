# Cuttlefish — an authored field study

## Custody and scope

An opt-in, cuttlefish-only extension. The canonical marine renderer, public
factories, shared scheduler, other species, exports and generated files stay
unchanged. The public integration base is
`b8f222dab868821f27bf2a64a98434f3483fc8e6`.
The same additive patch is tested over the reconstructed private V7.1 tree
`7bf307ddaee15040f883262d2b3dd4907e5eb79e`; its renderer SHA-256 is
`de98d21f593751cdd69e66b2425ff72c064508e9af1d856fb434dd60099d569d`.
This is an authored common-cuttlefish-inspired creature, not a measured species
model. The linked private conversation was not readable through web retrieval;
the actual V7.1 archive, source, report and manifest were available and checked.

## Authoring brief, established before implementation

The three anchors are the broad flattened mantle with one thin fin ribbon,
the substantial eye-bearing head, and its continuous upper arm crown.
Keep the reviewed V7.1 head, recessed lateral eyes, root sleeves, primary-arm
centerlines and distal geometry. Eight primary arms remain; the two fully
retractile feeding tentacles are concealed in these nonfeeding performances.
The existing raster glyph atlas and points renderer remain the medium; this
is not terminal text. No reference photographs or font files are redistributed.

Minimum review width is 390 pixels, with a 560-pixel artwork area. Matched
desktop canvas captures use 1100 × 640 pixels. The intended full-page desktop
review is 1440 × 1000 CSS pixels; real-browser layout review remains unrun. Inspect broadside,
three-quarter, turn, alert, ink, retreat and recovery at actual native scale.
Background contrast remains subordinate to the animal: two distant substrate
contours, sparse suspended particles, and a small near-field vegetation layer.
No decorative fish or busy texture sits behind the brow.
The solo study uses the inherited maximum supported size of 1.4, selected after
native review found that 1.16 obscured head/fin detail on the phone canvas.
An unspecified size for multiple animals stays at 1.16; an explicit size wins.

| Performance | Anticipation | Response | Recovery |
| --- | --- | --- | --- |
| Hover and investigate | Brief orientation toward a held point | Fin-led approach with standoff, then an inspection hold | Ease back into the same quiet hover |
| Turn | Settle before rotating | A controlled turn toward a ±145° heading with a slight bank | Unwind into the current without a hard direction flip |
| Jet and ink retreat | Turn toward the disturbance, then inherited arm contraction | One local ink release and a mantle-first departure | Decelerate and return through inherited eased recovery |

Timing and cue semantics are art direction. Pointer dwell invites investigation;
tap and labelled buttons provide the same action. Focused artwork keys provide
investigate, turn, retreat, pause and reset. Ordinary pointer motion never
spontaneously emits ink. Active sequences reject conflicting actions. A pointer
leave or cancel clears interest. Reduced motion begins with a static study;
explicit still selection never resumes playback.

The study model advances by integer 60 Hz ticks. The subclass substeps the
inherited simulation at that rate and draws once per presentation batch.
Same seed, normalized input order and tick sequence reproduce model and logical
cell state on the same JavaScript runtime; pixel identity across fonts, devices
or browser engines is not promised. Simulation work remains capped at six ticks
per inherited 0.1-second frame budget. Paused, hidden, offscreen and zero-size
scenes retain the inherited scheduler's rest behavior.

## Reference ledger

Consulted 19 November 2026. Reference facts inform independently authored code.
No photograph, diagram, ASCII drawing, geometry or font is copied into assets.

| Primary source | Observation used | Interpretation boundary |
| --- | --- | --- |
| [MBL common cuttlefish](https://www.mbl.edu/research/research-organisms/common-cuttlefish) | Eight arms, two completely retractile feeding tentacles; mantle fin; pigment organs. Roger Hanlon photographs show broad continuous head/arm contours and restrained camouflage on sand. | Proportions and exact texture are authored. Reference photos are research only. |
| [Monterey Bay Aquarium](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/common-cuttlefish) | Rippling lateral fin, camouflage and defensive ink. | The habitat and interaction sequence are fictional compositions. |
| [Gladman & Askew 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10560557/) | Low-speed fin locomotion and high-speed jet escape. | No measured animal speeds are simulated. |
| [Jastrebsky et al. 2016](https://pubmed.ncbi.nlm.nih.gov/26944502/) | Coordinated fin/jet control during turning. | Dwarf-cuttlefish performance is not a calibration for this artwork. |
| [Mäthger et al. 2013](https://pubmed.ncbi.nlm.nih.gov/23474299/) | Constricted W-shaped pupils. | Keep inherited lateral eye projection; do not force a frontal W icon. |

## Integration and evidence

### Apply one additive patch

`cuttlefish-study.patch` adds new files. It does not contain a replacement arm,
head or mantle implementation. Apply it once to either supported baseline:

1. **Exact public source:** check out commit
   `b8f222dab868821f27bf2a64a98434f3483fc8e6`, then apply the study patch.
2. **Reviewed private V7.1:** use the verified V7.1 checkout directly. If
   reconstructing from the original private archive, start at that same public
   commit and apply its existing prerequisite patches in this order:

| Existing archive patch | Expected complete Git tree |
| --- | --- |
| `prerequisites/exact-v6-from-public-main.patch` | `fc7723e367c9795952c728d9a4f8a98e3f195168` |
| `prerequisites/exact-v7-from-v6.patch` | `88a1a50e9f0691954c214d8a919f825209a38627` |
| `patches/ascii-animals-v7-to-v7-1.patch` | `7bf307ddaee15040f883262d2b3dd4907e5eb79e` |

Use `git apply --check --index`, then `git apply --index`, then `git write-tree`
for each historical patch and compare the complete tree before continuing.
After the V7.1 tree matches, apply **only the new study patch**. Do not add another
arm candidate or apply the historical patches again over an existing V7.1 tree.
The archive is a private prerequisite; this public branch does not redistribute
its source or substitute an invented reconstruction.

```sh
git apply --check --index /absolute/path/cuttlefish-study.patch
git apply --index /absolute/path/cuttlefish-study.patch
npm ci
npm run build
node --test test/cuttlefish-study-director.test.mjs test/cuttlefish-study-adapter.test.mjs
node node_modules/typescript/bin/tsc -p test/tsconfig.cuttlefish-study.json
npm test
npm run typecheck
npm run test:legacy
npm run check:package
```

`npm run build` regenerates the repository's existing package and demos. The
central integrator owns any resulting shared/generated commits. This patch
contains no generated entry points or generated copies of other species.
If central integration also refreshes the repository's standalone copies, its
existing follow-up command is `python3 scripts/build-standalone.py`. Run that
only in the integration checkout; it does not wire this opt-in study into the
catalogue or change its package exports automatically.

The existing package exports map, public factories and declarations are
unchanged. The new study is opt-in through a source/build-relative import:

```js
import { createCuttlefishStudy } from './lib/animals/cuttlefish-study.js';

const study = createCuttlefishStudy(canvas,
  { automatic: true, habitat: true },
  { seed: 20261119, count: 1 });

study.cueStudy({ type: 'investigate', x: .24, y: -.06 });
// After this sequence finishes:
study.cueStudy({ type: 'turn', x: -.24 });
study.showStudyStill('retreat', 1.55); // Pauses; composes the ink-emission state.
study.destroy();
```

There is **no published `ascii-animals-review/cuttlefish-study` export** yet.
Choosing a package subpath, adding a catalogue link, changing the default
cuttlefish factory, and regenerating shared entries belong to central
integration. The standalone review page is
`examples/cuttlefish-study/index.html` after building. To make a portable local
review file without deploying anything:

```sh
node scripts/build-cuttlefish-study-preview.mjs --out /absolute/path/cuttlefish-study-preview.html
```

### API and interaction details

`createCuttlefishStudy(canvas, studyOptions, artworkOptions)` returns a
`CuttlefishStudyArtwork`, which retains the inherited artwork API. Its additional
methods are `cueStudy`, `getStudy`, `setStudy` and `showStudyStill`. All four study
configuration fields are booleans: `automatic`, `habitat`, `restrainedSkin`, and
`concealFeedingTentacles`, each defaulting to `true`. The new adapter accepts
unsigned 32-bit seeds and cuttlefish-only species arrays. These restrictions do
not alter the original factory's contract.

Coordinates use the canvas CSS rectangle normalized to `[-.5,.5]` on both axes.
A held pointer invites investigation after 0.6 seconds when the target has
changed sufficiently. A tap explicitly invites inspection. The three labelled
buttons support touch and keyboard activation; focused-canvas shortcuts are
`I`, `T`, `R`, arrow keys, Space and Escape. Browser shortcuts with Alt, Control or
Meta and normal Tab navigation are left alone. Keyboard controls are in the demo,
not global listeners installed by the package.

Investigation lasts 6.9 seconds, turning 5.1 seconds, and retreat 10.5 seconds.
Retreat emits one inherited startle at study time 0.9 seconds: contraction lasts
0.34 seconds before ink emission begins, so the first visible ink is around
study time 1.24 seconds. These are authored simulation timings. The coarse
director phase and the inherited reaction stage are separate; the demo displays
the actual reaction stage during escape.

Active actions finish before another begins. Rejected or invalid cues return
`false` without mutating the director. Snapshots are frozen copies. `pulse()`
requests retreat without unpausing. Paused taps/buttons select an explicit
still; `showStudyStill` also pauses and does not schedule animation. A zero-size
canvas refuses still composition until it has an observation area. An explicit
caller `paused` option retains the inherited override of the system preference.

The study controls independent formation. If a caller selects an inherited
formation or enables the inherited marine director, its pose takes precedence;
the study's timing still advances, so callers should choose one director. Default
review settings use one animal, independent formation and no inherited director.

### Preserving the reviewed anatomy

The subclass inherits the canonical body, eyes and arms. A fixed raw-sample
buffer draws the complete inherited arm routine, checks its known sample count,
and passes on the untouched eight-primary-arm prefix while withholding the final
two feeding-tentacle streams. This is a **draw-visibility gate**, not a new
physical retraction/strike simulation. The two feeding tentacles remain present
in inherited geometry and can be shown with `concealFeedingTentacles: false`.

Both exact baselines and all three inherited geometry levels are pinned. Unknown
sample topology falls back to the complete inherited stream and reports
`anatomy.feedingVisibility: 'unsupported-topology'`. The independent test oracle
runs the original arm code with only its loop limits changed in memory to eight;
it checks every retained raw sample rather than reproducing the gate's count
formula. The source file itself stays byte-for-byte unchanged.

Quiet skin treatment scales only inherited body detail, preserves the original
eye shading and fin material, and adds a small seed-stable broad pigment field.
Fin energy uses the original ripple parameter. Retreat keeps the inherited
easing but bounds displacement to the observation volume and shortens the local
ink cloud's lifetime. A 0.8-pixel directional edge catches light around the
existing dark ink characters; no new smoke shape, particle path or bright ink
pigment is substituted. Native review selected it after the original dark
plume proved difficult to see against the water. The plume remains restrained,
especially during its initial overlap with the body. Habitat uses two low substrate contours and two small
eelgrass stands, behind the animal. These additions do not replace geometry.

Inherited private methods used here are pinned implementation seams, **not a
stable public plugin interface**. A new upstream renderer requires repeating the
sample oracle and visual review before reusing the adapter.

### What was actually verified

The public full suite passed **637/637**; the reconstructed V7.1 full suite passed
**672/672**. The focused study tests passed **19/19** on each source, including
seeded replay across presentation groupings, one-shot jet emission, primary-arm
sample preservation, invalid input, zero-size stills, reduced motion and disposal.
TypeScript API fixtures, the existing typecheck and legacy checks also passed.
The final external manifest records commands, versions, hashes and package
results; optional missing bundlers are not claimed as verified.

Native evidence is produced by `scripts/capture-cuttlefish-study.mjs` from these
exact modules using `@napi-rs/canvas` with a simulated DOM. It is **not a browser
screenshot**, real phone test, CSS layout review or browser input acceptance.
Before/after material comparisons normalize both models to the same authored
study pose, seed, options and time; the baseline keeps its original body, skin,
fins and all ten arm/tentacle streams. Separate after-only sequences show the
new choreography. The capture receipt records dimensions, font, frames and any
native harness adaptations.

```sh
node scripts/capture-cuttlefish-study.mjs --repo /absolute/public-checkout --out /absolute/evidence
node scripts/capture-cuttlefish-study.mjs --repo /absolute/v71-checkout --out /absolute/evidence
```

Run these sequentially. The capture tool requires `@napi-rs/canvas`, FFmpeg and
Liberation Mono; they are review-environment dependencies, not added runtime
package dependencies. It also accepts `--stills-only` or `--movies-only`. Motion
is recorded at normal speed as 12-fps video from the 60-Hz simulation, with a
short quiet tail after each recovery. This is not a measured browser frame rate.

Local Playwright Chromium failed before page creation with a process socket
permission error. The attached browser could not reach the local preview, then
denied further observation of its failed page by URL policy. Browser work stopped
at that boundary. Full-page layout, real touch/keyboard behavior, focus order,
browser reduced-motion rendering and device performance remain acceptance checks
for central review. The portable HTML previews are supplied for that review.
