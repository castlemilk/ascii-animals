# Cuttlefish Ink Puppet — implementation review

**21 November 2026, Australia/Melbourne.** Reviewable isolated prototype against
current main `f63b20e2045b1070b10bde2efc4eb3a8536e606b`.

The result is an original 2D ASCII character with a broad mantle, recessed lateral
eye, continuous shoulder/arm crown, broad expressive skin bands, an investigation
and a soft retreat. It is deliberately isolated under this species directory.
The shipped renderer and its approved full-lens and small-swimmer behavior are
preserved unchanged. This is not a claim that the new 2D puppet implements the
existing three-dimensional camera, multi-animal API or encounter choreography.

## 1. Baseline actually reviewed

The source checkout and a final read-only `git ls-remote origin refs/heads/main`
both identify the commit above. Superseded Seahorse #42 and Gecko #44 drafts were
not used. The canonical Cuttlefish source SHA-256 remains:

```text
de394dc99c7d6455b9bc7fd942a810372a3c22fe65fc739ef7cd1dc672c1f8fe
```

The following surfaces were distinguished:

| Surface | Actual implementation / observation |
| --- | --- |
| [Live gallery species page](https://castlemilk.github.io/ascii-animals/animals/cuttlefish/) | Inspected in the live browser and captured at desktop width. The committed gallery mounts the canonical Cuttlefish through the marine movement adapter, with movement initially disabled. Seed 7, one animal, reactive scene, selected size 1, pointer following and the default size variation of 0.45 are retained in the native baseline. |
| [Live classic study](https://castlemilk.github.io/ascii-animals/cuttlefish-demo.html) | Inspected and captured in the live browser. It exposes swim-by, close encounter and startle/ink, with school and renderer controls. The retained screenshot shows four small independent swimmers, paused at 70% selected scale. |
| Canonical source at current main | `src/animals/cuttlefish.js`; exact source is used by the matched native baseline and by the prototype's three source-reference views. |
| Separate authored study | `src/animals/cuttlefish-study.js`; read and regression-tested, but not confused with the gallery's default renderer. |

The live pages did not provide an independently verified deployed commit receipt.
The browser captures therefore establish what was visibly shipped at the supplied
URLs; the exact-main claim belongs to the separately hashed checkout and native
reproduction. No browser screenshot is presented as proof of a specific deployed
SHA.

### Critique of the gallery and classic

The existing cuttlefish has useful anatomy and framing: a flattened mantle, a
continuous fin, an arm crown, lateral eye geometry and a range of motion. The
classic study already has real encounters, patrol and ink behavior. Calling it
literally unanimated would be inaccurate.

The visual hierarchy is the issue. Fine alphanumeric luminance texture, skin
mottling and glow distribute attention across the whole creature. At phone
dimensions the eye competes with similarly weighted body cells, and the arm crown
can read as a dense fringe. The gallery's subdued reactive pose shows the volume
more strongly than it communicates a character's intention. The classic has
more behavior, but small individuals still lose the face and pose contrast.

The separate authored study already reduces detail and adds deliberate timing.
Its compact investigation excursion and gentle turns still stay close to the
same hovering construction. More surface detail would not solve the requested
character problem. The new direction instead changes silhouette, arm gathering,
head aim, body counterlean, skin-band contrast and input-dependent displacement.

The existing recessed eye geometry is a constraint to respect, not an invitation
to add external eyeballs. The full-lens framing and small-scale independent
swimming are also preserved. Their canonical regression tests remain green.

## 2. Two directions were shown before implementation

Two ImageGen boards were generated and displayed before choosing a renderer.
They were concept references, never executable ASCII or animation evidence.
The exact prompts are retained in `IMAGEGEN-PROMPTS.md`; both editable briefs,
part inventories, keys and tradeoffs are in `CONCEPTS.md`.

| Direction | Shape / palette / acting | Decision |
| --- | --- | --- |
| **A: Inquisitive Ink Puppet** | Broad rounded flattened mantle; compact arm bundles; copper, cream and seafoam on ink blue; gather, counterlean, approach/reach, mantle-first soft retreat. | Selected. It answers the user's direction and keeps substantial connected shapes at phone size. |
| **B: Tide Calligrapher** | Tapered leaf mantle on a diagonal S-curve; long separated ribbon arms; navy/chalk with a vermilion signal band; hinge, banner, fold and drift. | Retained as a distinct alternative. It changes construction and movement rhythm, not just colour. Its thin ribbons carry a larger phone-legibility risk. |

The anatomy references were the Monterey Bay Aquarium's
[common cuttlefish](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/common-cuttlefish)
and [broadclub cuttlefish](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/broadclub-cuttlefish),
the [W-pupil study](https://pubmed.ncbi.nlm.nih.gov/23474299/), and
[WHOI's cuttlefish overview](https://www.whoi.edu/ocean-learning-hub/multimedia/sensitive-creature/).
The references inform the lateral fin, recessed horizontal pupil, eight primary
arms plus two feeding tentacles, skin changes and jet propulsion. The specific
proportions, emotions, palette and timing are authored cartoon decisions. No
source photography, diagram, mesh, font binary or existing ASCII artwork is
copied into the new renderer.

## 3. What changed in the character

The implementation uses original analytic silhouettes and attached arm paths,
sampled directly into a bounded ASCII cell grid. Canvas paints one flat background
and individual text glyphs. There is no animal image, vector underpainting,
gradient shading layer or image-generated runtime asset.

The body has a broad copper mass and a thin seafoam fin. A few cream pigment bands
replace the original fine tonal ramp. The head overlaps the shoulder and all arm
roots; eight primary paths read as overlapping bundles, with two additional
feeding paths revealed during the reach. The lateral eye is recessed in a head
plane. Four punctuation characters form the W when sufficient cells exist; it
simplifies to `w` at phone or smaller footprints. It never grows into a bulging
eye to preserve detail. The shallow turn is a stylized 2D foreshortening, not a
measured three-dimensional anatomical reconstruction.

The nine palette entries include background, habitat and ink shades. Most animal
cells use a smaller set of repeated directional punctuation and broad fill marks.
Sparse seagrass brackets, low sand contours and current dashes frame the creature
without competing with it. The initial matched scene has 1,119 animal glyphs on
desktop and 360 on phone, compared with 2,173 and 587 occupied canonical animal
cells respectively. These are renderer-specific occupancy counts, not a claim
that the two geometries or cell metrics are identical.

Early glyph renders exposed scattered eye highlights and an overfilled radial
arm fan. Those were revised to a coherent recessed slit/W and grouped attached
curves. A conservative arm-path bounds check removed most unnecessary segment
distance calculations. The final evidence uses the revised renderer, not the
earlier attractive concept board as a substitute.

## 4. Two input-dependent moments

The model runs at 60 logical ticks per second. Coordinates are normalized around
the stage centre, from -0.5 to 0.5 on each axis. The input target is committed at
action start. Pointer movement updates one next-target slot; it cannot drag an
active gesture around or create a growing queue. Conflicting actions are rejected
until the current action and its 36-tick cooldown finish.

| Moment | Anticipation | Response | Settling and input consequence |
| --- | --- | --- | --- |
| **Investigate / offer a shrimp** | 0–0.65 s: arms gather, mantle checks, head aims and skin bands change. | 0.65–1.8 s: bounded approach; 1.8–2.6 s: two feeding tentacles reach; 2.6–3.1 s: hold. | 3.1–4.3 s: retract; 4.3–6 s: return to seeded swimming. Left/right and vertical placement alter heading, approach and reach. Left-side input turns through a shallow frontal pose. |
| **Soft jet / disturb the water** | 0–0.65 s: contraction; 0.65–1.05 s: warning pose with no ink yet. | 1.05–2.4 s: mantle-first movement away from the disturbance, gathered arms and delayed sparse ink. | 2.4–5.8 s: decelerate and relax. Ink is gone by 3.7 s. Opposite-side disturbances reverse escape direction; nearer disturbances increase response strength. |

The shrimp interaction is a bounded stylized reach: the marker disappears at the
hold phase. It does not implement ecological prey behavior, a collision simulation
or separate hit/miss outcomes. The actual implemented difference is route,
heading, reach and proximity-driven retreat strength.

The desktop and phone MP4s replay an investigation at tick 0 toward `(0.3,-0.1)`
and a retreat at tick 400 toward `(0.25,-0.1)`. Both end at tick 780 in quiet swim
with no active action. The input-outcome sheet additionally exposes opposite-side
and near/far cases that are not present in that single recorded sequence.

## 5. Lifecycle, determinism and compatibility

The existing public API is unchanged. `createInkPuppet` and `InkPuppetArtwork` are
local provisional exports from this directory; no package subpath is added.
`index.d.ts` and `browser.d.mts` support direct import type checking.

The pure model uses a uint32 seed, finite normalized inputs and integer ticks.
Snapshots are detached and frozen. Replays at presentation groupings of 1, 2, 5
and 6 ticks produce the same state and cell output in the tested runtime. Pixel
identity across different fonts and browser engines is not promised.

The adapter composes explicit pause, reduced motion, hidden document, offscreen
intersection, zero-size host and destruction. It unsubscribes from the shared
frame scheduler when resting. Resume resets the presentation clock; foreground
catch-up is capped at six ticks and excess wall time is recorded, preventing a
large hidden-tab backlog. One thousand pointer moves cause zero immediate
rasterizations and one scheduled paint in the regression. The page uses
event-driven status updates rather than a background polling interval.

Reduced motion begins with a meaningful still. Deliberate static-key selection or
a paused tap composes an informative frame without starting motion. Keyboard and
touch use the same normalized target semantics. Pointer cancellation clears
transient interest; explicit action targets remain committed. Destroy removes
owned listeners and observers and is idempotent.

Declared bounds: one animal, one active action, one pending target, 180×100 maximum
logical cells, up to 34 candidate ink glyphs, DPR at most 2, backing-store area at
most 4,194,304 pixels and each backing dimension at most 4,096. The observation
volume is fixed from viewport and selected scale; it does not reframe or zoom to
each pose. At large scale travel is constrained to preserve the full silhouette.

## 6. Evidence and exact meaning

The accompanying review package separates `evidence/browser/` and
`evidence/native/`. File names and image/video headers retain their evidence type.

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| `live-gallery-desktop.jpg`, `live-classic-desktop.jpg` | Real desktop browser appearance at the supplied shipped URLs. | Exact deployed SHA, prototype browser acceptance or a phone viewport. |
| `matched-desktop.png`, `matched-phone.png` | Exact-main canonical renderer beside the new renderer, at 1100×640 and 390×560 respectively; seed 7, DPR 1, selected scale 1, elapsed time 0. Canonical default size variation 0.45 is preserved. | Browser screenshots or identical poses/camera models. Labels explicitly say different authored poses. |
| `motion-keys.png` / `.svg` | Actual glyph output at anticipation, reach, jet and settling keys. SVG contains editable text glyphs. | Continuous timing by itself. |
| `normal-speed-desktop.mp4`, `normal-speed-phone.mp4` | 13.000 s, 24 fps, 312-frame native replays of the 60 Hz model at 1x time. Both gestures and quiet return are included. | Browser screen capture, device frame rate, touch or MediaRecorder verification. |
| `input-outcomes.png` / `.svg`, `phone-small-scale.png` | Native glyph comparisons of distinct input targets and reduced scale. | Physical phone or browser layout acceptance. |
| `native-manifest.json`, `inputs-manifest.json` | Executed-source hashes, input/tick logs, effective options and renderer/runtime provenance. | A deployment or publication receipt. |

Native runtime: Node 24.22.3, `@napi-rs/canvas` 0.1.100, FFmpeg 7.1.5, Linux x64 and
installed Liberation Mono. No font is redistributed. The canonical glyph-atlas
cache was checked for exact RGBA and representative scaled/cropped-draw parity
before use. A final source-consistency guard passed after capture.

In the complete recorded sequences, zero animal cells touch an outer grid edge;
minimum visible animal glyphs are 916 on desktop and 295 on phone. Maximum ink
cells are 13 and 15. Native raster-plus-Canvas work measured median/p95 of
9.43/22.92 ms desktop and 4.35/17.07 ms phone after 20 warm-up frames, excluding
encoding. These are host-native work measurements, not browser FPS or phone
hardware measurements. Browser performance remains unresolved.

## 7. Executed verification

| Check | Result |
| --- | ---: |
| Pure prototype model tests | 12/12 passed |
| Prototype adapter/lifecycle tests | 11/11 passed |
| Prototype logical renderer tests | 6/6 passed |
| Canonical study/director, study adapter, full-lens framing and independent swimming | 25/25 passed |
| **Combined targeted regression** | **54/54 passed** |
| Strict TypeScript 5.9.3 direct-import smoke, including eight expected rejection cases | Passed |
| Additional maximum-size envelope audit: three viewports, both actions, four corner targets, eight ticks | 192/192 checked cases; no animal/feeding-tentacle edge cells |
| Two encoded MP4 timing checks | Both 13.000 s, 24 fps, 312 frames |

The final independent reviewer reran all 54 tests, inspected the desktop/phone
comparisons and keyframes, and extracted frames across both movies. Tests use
actual model/cell output and simulated DOM/Canvas. The log is
`logs/final-independent-regression.txt` in the review package. Type/syntax,
patch-application and artifact checks are recorded separately in the package
manifest and logs. The repository-wide test suite and a release build are not
claimed; no package entry point or shared code changed.

Independent review found two concrete implementation issues that were fixed:
pointer movement originally requested immediate paints, and rapid rejected taps
could announce success. Pointer updates are now coalesced to the scheduler, and
the page announces the controller's accepted/rejected result. Further fixes
preserve pause across source-view changes, retain the gallery's true default size
variation, clean up failed recording attempts and give phone controls 44-pixel
minimum dimensions.

## 8. Remaining issues and acceptance boundary

1. **Prototype browser/device verification is open.** The browser could not reach
   the isolated local server; file navigation was explicitly blocked, and native
   Chrome could not create required sockets. No restriction was bypassed. The
   supplied standalone preview is reviewable but has not been executed in that
   browser. Real keyboard focus, touch/scroll behavior, live motion-preference
   changes, MediaRecorder output, actual offscreen observation, responsive page
   layout and target-device frame time still need browser acceptance.
2. **The phone face is restrained.** Its pupil is a small `w` within a long dark
   lateral band. It stays recessed and legible, but can read as a graphic visor
   instead of an almond-shaped aperture. Most expression comes from body and arm
   acting. At 35% scale further detail is deliberately lost rather than enlarged.
3. **Several arm tips still read as fine parallel ribbons.** The connected crown
   and whole gesture are clearer than individually articulated fingers. Further
   simplification is an art-direction choice for a later revision.
4. **Phone ink is subtle.** Retreat direction and body contraction carry the
   response; the small plume may be missed. It should not be described as a
   dramatic ink explosion.
5. **Canonical parity is preservation, not migration.** Full-lens framing,
   independent small swimming, existing API and multi-animal behavior remain in
   the untouched original. Moving this character into those modes is a separate
   integration decision with additional tests and visual acceptance.

This handoff is a reviewable character direction and scoped prototype. No remote
Git write, merge, publication or deployment was performed.
