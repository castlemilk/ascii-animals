# Manta and cuttlefish eye, head and arm-crown anatomy review

## Scope and exact base

The original local anatomy patch starts at
`b8f222dab868821f27bf2a64a98434f3483fc8e6` of `castlemilk/ascii-animals`.
The first recessed-eye revision was stacked on the **actual prior patch**,
`ascii-animals-anatomy-b8f222d.patch`, SHA-256
`e7404caaf91298b52d9b6b6ff7886bf82eec04fab026be36de34fae1c8b0c85d`.
Main was rechecked on 19 November 2026 (Melbourne) and still points at the
original commit; it contains none of the local anatomy revisions. The same
public main was checked again for V4. The historical
**V3 rounded-crown revision** started at the delivered **V2 fuller head**:
`30e674b1223e897be429c33e285c44b5d79645cf`, tree
`82ef362ae18a62472de9e67dd52609cb1c7d3933`, cuttlefish source SHA-256
`0800d9d18387ec174f2b50cf6e2558a1e98c3278c552ad0da0d7fe22b004dd04`.
Every BEFORE image for V3 must render that exact result. The historical
**V4 progressive-head revision** starts at the actual delivered **V3 crown and
roots**, commit `8931bcc568cb5272f3a7b5eab0532c6c95c92858`, tree
`ef45da059fb583c86e3561eaeb5b3bf810fc244f`, cuttlefish source SHA-256
`cd1dc0d1cb60310afdaa86f2743be336fa97078a464f74511d6bf7af2d0d0f10`.
Every V4 BEFORE image renders these V3 bytes, including a replay of a delivered
V3 frame. The historical **V5 articulated crown/root refinement** starts at the
actual approved V4, commit `99cb8c503d70f8a407d6f2b3aff3c6b45af8f9bd`, tree
`30372b6c308c0734d9ea3adf73639fee396c6bd7`, cuttlefish source SHA-256
`e92beee50ae36c590191929370668d9e82e24f16f2e5716111e1678a883df83d`.
Public main was rechecked directly for V5 and still points at `b8f222d`.
Every V5 BEFORE image must reproduce the corresponding delivered V4 AFTER
pixels. Earlier main, eye-only, V2 and V3 results are historical context, never
substitutes for the V5 comparison base.

The present **V6 forward-eye and upper-root revision** starts at the exact
approved V5: commit `d638880513978c63b8cb1dfc97101463baa22966`, tree
`cb01b581891142b9e4c31167e5776f762ef2408b`, cuttlefish source SHA-256
`b65cb598f9944c1d89e8564db6707b684632cadcfd416e1365e1eb0bf58071dd`.
Public main was checked again for V6 and remains `b8f222d`. Every V6 BEFORE
frame reproduces a delivered V5 AFTER frame, with all 35 native hashes pinned
in the new reproduction script. Earlier revisions are historical controls,
not substitutes for the V6 baseline.

V6 intentionally extends the proximal transition of **only upper primary arms
1, 2 and 3 from normalized length .30 to .40**. Their free-arm geometry is
preserved exactly from .40 onward. The other five primary arms retain their
.30 boundary; both complete feeding tentacles, mantle, fins, beak and manta
remain exact. The former blanket .30 preservation claim applies to V5, not
V6. This explicit local extension lets the upper roots leave the brow before
turning toward the unchanged free arms; it does not alter their wave clocks,
curl, contact timing or scene choreography. The numerical boundaries are
renderer design choices, not anatomical measurements.

The prior patch tree is `3a336b913242e806afbf345e27e8a89f09ab8066`.
The review's local snapshot commit `07dca7bb54ce7d96e7525422203dd32173a96450`
identifies those bytes only; it is not a published upstream commit. The later
eye, fuller-head and V3 snapshots are also local review identifiers. V4 changes
the eye-bearing head profile, its tangent-continuous crown and short primary arm
roots. The eye attachment chart and shallow recess follow the new supporting
surface. Every mantle/fin sample, both full feeding tentacles, the primary arms
from their proximal 30-percent boundary onward, the beak and prior manta result
were retained in V4/V5; the specific V6 upper-root exception is stated above. Scenes,
trajectories, director configuration, interactions, navigation and package
exports retain their current contracts. Publication belongs to the integration
owner; this work is delivered as a patch without a push or deployment.

The current API was read from `docs/ANIMAL-APIS.md`. During the prior anatomy
review the `generate-reactive-ascii-animals` skill was read through GitHub, including its
anatomy, validation, accessibility, baseline and authoring-template references;
its SKILL.md blob was `8ef04dec7f4031f7e69b1319e182a7d722b41fe4`.
The skill's historical cuttlefish baseline is context, not this patch's base.

## Anatomical brief and references

This is original procedural, stylized geometry, not a measured anatomical
model. Cuttlefish eye treatment is informed by *Sepia officinalis*. Its three
recognition anchors remain the broad mantle and fin skirt, the head between
mantle and arms, and the attached arm crown. The manta retains its diamond disc,
pectoral fins and paired cephalic lobes with a trailing tail.

| Reference | Observation used | Rights and material copied |
| --- | --- | --- |
| [NOAA Fisheries: giant manta ray](https://www.fisheries.noaa.gov/species/giant-manta-ray) | Eyes are lateral; pectoral fins and cephalic lobes identify the animal. | Factual reference only; no image, diagram or geometry copied. |
| [Mäthger et al., 2013, Vision Research, DOI 10.1016/j.visres.2013.02.016](https://pubmed.ncbi.nlm.nih.gov/23474299/) | Bright-light cuttlefish pupils are W-shaped, dark-adapted pupils are circular; apparent aperture changes with viewing direction. | Factual reference only; no photograph or figure copied. |
| [Feord et al., 2020, Science Advances, DOI 10.1126/sciadv.aay6036](https://pmc.ncbi.nlm.nih.gov/articles/PMC6949036/) | Cuttlefish have lateral eyes and can move/converge them independently. | Factual reference only; no media copied. |
| [Iglesias et al., 2019, Journal of Experimental Biology, DOI 10.1242/jeb.174862](https://journals.biologists.com/jeb/article/222/1/jeb174862/275/Cyclic-nature-of-the-REM-sleep-like-state-in-the) | In *S. officinalis*, socket contraction squeezes surrounding tissue over the pupil during the observed sleep-like state. This supports tissue integration, not a new normal squint animation. | Factual reference only; no media copied. |
| [Imarazene et al., 2017, Frontiers in Physiology, DOI 10.3389/fphys.2017.00613](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2017.00613/full) | Species-specific development distinguishes iris, cornea and eyelid and their formation from surrounding tissue folds. | Factual reference only; developmental evidence is not an adult dimensional model. |
| [Tarazona et al., 2019, eLife, DOI 10.7554/eLife.43828](https://elifesciences.org/articles/43828) | *S. officinalis* has eight arms and two distinct retractile feeding tentacles; the arms carry suckers along their ventral surfaces. | Factual reference only. Developmental figures do not specify adult crown dimensions, taper lengths or the authored stagger. |
| [FAO AdriaMed: Sepia officinalis](https://www.faoadriamed.org/html/Species/SepiaOfficinalis.html) | Eight non-retractile arms surround the mouth, with two long retractile tentacles inserted laterally. | Species-specific structural reference; no photo identity or authored head-growth ratio is inferred. |

The implementation depicts a light-adapted W-shaped aperture. The existing
palette and directional shading are artistic lighting, not measured illumination;
this patch adds no physiological dilation or eye-movement API. Eye placement,
socket depth and proportions are authored choices, not biological constants.
The supplied underwater photographs guide the continuous head silhouette and
lateral placement only. They are not species identifications or geometric
measurements. They are kept separately as review references, never copied into
the procedural source or composited into the renderer's before/after pixels.
No font files, external art, new assets or dependencies are added.

## Local anatomy and views

The engine's local +X points toward the arms, ±Y is lateral and +Z is dorsal.
All points pass through the existing uniform object scale, body rotation,
perspective and shared depth buffer. Camera changes must not change attachment.

| Part | Attachment / geometry | View and occlusion policy |
| --- | --- | --- |
| Manta eye detail | Omitted in this dorsal presentation. Real manta eyes are lateral. | Remove the old upper/front discs without replacement glyphs; preserve every non-eye sample. |
| Cuttlefish anterior mantle and head | The mantle/fin profile is retained exactly. A separate cubic head profile starts tangent at X = .30 and grows in width and depth through the eye to the arm-root join at X = 1.02. | The eye region never shrinks below V3. Emitted skin, normals and eye coordinates follow the enlarged host surface. Growth budgets are authored visual choices, not measured species proportions. |
| Cuttlefish eye pair | Paired elliptical patches in a continuous head/crown X/angle chart, moved forward together in V6. A shallow inset meets a flush perimeter. | Every sample stays inside the supporting head envelope. Both the head normal and recessed patch normal cull against the actual perspective camera. |
| Cuttlefish socket and lid | Head samples are replaced only inside the socket interior. The rim overlaps flush skin, with a restrained upper-lid shadow. | No stalk, external sphere or domed button. The wider supporting head, rather than a larger eye opening, removes the remaining eye-centered bulge. |
| Cuttlefish iris | A material region of the recessed patch with analytic derivatives for its surface normals. | Bounded contrast avoids a luminous detached disc. Existing head/arm depth testing remains active. |
| Cuttlefish pupil | Dark W-shaped aperture in the head's anterior/dorsal surface chart. | It rotates with the head and simplifies continuously to a slit when projected width or height is insufficient. Sampling is centered at every LOD; a bounded coverage floor prevents a subcell slit from losing every depth-buffer cell to adjacent iris samples. |
| Rounded crown | A tangent-continuous curved shell rolls forward from the full head into eight short rounded lobes. Recessed valleys separate the lobes; the small oral center stays behind the unchanged beak. | The outer tissue ends at staggered positions rather than one transverse cap. Derivative-based unit normals follow the actual lobed surface. The common central shell is not extended as an opaque plate over the arms. |
| Proximal arms | Primary root support grows to .64/.43 lateral/dorsal, with thicker overlapping sleeves and staggered merges ending by 29 percent. Redistributed root-center motion avoids combining the steepest inward travel with the sleeve taper. The correction returns to zero value/slope at 28 percent; the support blend returns at 30 percent. | The original .56/.34 support is retained for both feeding tentacles and preserved distal tangent frames. Existing waves, curl, startle, escape and grip drive the root tissue. Distal positions, shading and suckers remain exact. |

The earlier recessed-eye revision removed a separate dome that extended about
`.089` model units beyond its head. That correction is retained. The new eye
chart uses the broader head profile and its analytic derivatives, with **zero
outward projection** in exact geometry and a shallow radial inset. Axial eye
half-width remains `.205`; the angular half-height `.31` and elevation `.18`
are retained from V3. The physical eye surface and its normals move with the
increasing head rather than remaining an absolute-space patch. These are
renderer dimensions, not measurements of a living
animal or of the reference photograph.

The V2 body/head change responded to a separate review finding: the old mantle
contracted sharply at its shoulder and the head tapered immediately in front of
the eyes. Recessing a patch inside that small spindle did not fix the silhouette.
That anterior profile carries body mass to the arm roots. V3 addresses its
remaining defect: the full head closed too rapidly into an almost common
transverse edge while the actual arm tubes stayed thin. The new crown and
overlapping sleeves distributed that handoff over a short region.

V4 responds to the next critique: V3 still gained only about 0.328 percent in
width and zero depth between the eye center and arm-root join, so the eye sat
in a nearly level barrel. V4 grows the measured section by about 6.13 percent
in width and 6.80–8.33 percent in depth over that same interval across supported
depth settings. The gain is distributed through the eye-bearing tissue rather
than concentrated in a flare at the front. The crown's position and tangent
match that rising profile. The primary sleeves and spatial blend are adjusted
together so the larger head stays supported by readable roots. Rear mantle,
fin motion and scene timing remain exact.

V5 addresses the residual shared inward-turning band at the crown. The V4
head profile, eye chart, eye surface and lid/iris treatment remain exact. The
crown now varies its radial roll by angular sector: shallow valleys turn
underneath the individual roots sooner, while a small delay under each root
carries its own part of the outer contour forward. Displacement and its first
derivative vanish at both crown endpoints; analytic normals include the
angular derivative as well as the axial derivative. The original axial lobe
reach and the mouth pole are retained. These roll amounts and the mild
asymmetry are authored modeling choices, not anatomical measurements.

The primary sleeves retain V4's centerlines, radius taper and merge stations,
but their added tissue has mildly oval cross-sections, broader around the
crown and slightly flatter in the radial direction. The oval strength varies
by root and vanishes with its sleeve. A small reused strip cache supplies
surface normals from neighboring positions, including the taper and rotating
arm frame. Its final row supplies a derivative neighbor only. Actual distal
samples from the 30-percent boundary onward use the original emission path;
both complete feeding tentacles and their animation remain exact. Additional
sampling is confined to this short root region. The cache is released on
disposal, and no motion, palette, lighting setup, global density or API changes
are introduced.

The improvement is deliberately bounded. Matched native review shows more
individual root surface structure in dorsal, three-quarter and frontal views;
broadside remains subtler, with a rounded dark shoulder still visible. The
delivery must not claim that the collar disappears in every view. Local
experiments that merely shifted a sharper width loss forward were rejected
by the unchanged silhouette guard.

V6 responds to the request for more anterior eyes and an upper arm origin.
The eye center moves from X = .78 to .87, with its .205 axial half-width,
.31 angular half-height, material and resolution-dependent pupil retained.
Its front edge now crosses the head/crown join. A shared analytic crown chart
supplies both the closing skin and the forward eye rim; the inverse anterior
coordinate uses the monotone rear branch of that chart. Position derivatives,
shallow recess and the supporting-surface facing test follow that same curved
host. The skin exclusion moves with the socket on both sides of the join.
The slight pre-existing left/right crown stagger is retained, so the paired
eye chart is equal while its most anterior surface follows its own local host.

The upper crown rolls underneath the individual upper sleeves earlier. The
three upper roots have modestly wider tangential faces and longer staggered
sleeves, ending at .38, .40 and .39; their center blend returns to the original
free-arm path at .40 with zero derivative. Other root boundaries retain V5's
values. The existing proximal-section cache grows from 24 to 32 reusable rows
to hold the longer strips. Their lighting normals still come from actual
surface differences, including the oval section and moving frame. No new
covering web or common opaque plate is added.

A first trial raised the middle of the old short transition. It improved
upper-root coverage but steepened the later fall and was rejected by the
existing .16 short-window silhouette guard. Broadening only tangential faces
passed geometric checks but remained too subtle in native renders. V6's
selected longer upper transition is visible in both broadside phases and
three-quarter views. The full cheek and distinct arm gaps remain readable.
A dark shoulder from lighting and overlap remains; mobile changes are smaller
because the attachment spans only a few cells. The result is a smoother upper
attachment, not elimination of every seam or reproduction of the photograph's
fixed downward posture.

In the supplied photograph, the visible brow curves down and forward and the
lower cheek flows into thick gathered arms. Individual arms become readable
at different positions. That continuous tissue is the visual target. The
photograph's downward, gathered arm posture is not frozen into the renderer:
the added sleeves follow the existing animated arm frames in ordinary and
encounter poses. A small mantle/head seam remains natural; a broad flat wall
across the arm crown does not. No species identity, literal length or radius
is inferred from the photograph.

ASCII here means the existing Canvas glyph atlas, not selectable text; points
mode uses the same projected geometry and tone buffer. The existing font stack,
palettes, glow, grid limits and 36,000-sample per-animal capacity are preserved.
Head skin retains the 88-point angular sampling introduced by V2. The crown
and wider proximal sleeves receive local sampling sufficient for their larger
surface area. Global point density, glyphs, palette, glow and depth/occlusion
behavior are unchanged.

## Validation and integration

Actual command results, runtime versions, matched-view capture settings,
source hashes and remaining browser/CI gaps ship in the delivery report and
manifest. The frozen historical fixtures are preserved. Exact comparisons cover
the mantle and fins, distal arms, beak, animation state, ownership and ink
outside the intentionally revised region, with separate head/eye tests and full
current-source/generated-build comparisons. The historical fixture remains
byte-for-byte intact.

`test/cuttlefish-eye-projection.test.mjs` compares emitted geometry with the
independently reconstructed emitted head surface and measures screen-space silhouette support
from broadside, opposite side, three-quarter, head-on, dorsal and rear-oblique
views at demo/mobile scales and with off-axis perspective. A separate head-profile
regression measures actual transverse extents from the mantle through the eye
and arm-root stations. Its shoulder guard still rejects the pinched `ed12581`
baseline; its progressive-growth guard rejects exact V3. It requires 6–15
percent growth in both axes from eye to root join, no shrink below V3 at fixed
stations, monotonicity and distributed growth, independently of the crown, eyes
and arm thickness. The 0.12-pixel
support tolerance covers finite sampling of the
reference envelope; it is not permission for a full character-cell protrusion.
The final-depth-buffer test also verifies that the aperture survives at resolving,
desktop and mobile scales in both display modes. A legible W is not claimed at
mobile scale. The coverage floor changes material sampling only, never geometry.

The historical V5 validation adds an exact V4 head/eye oracle and a separate geometric handoff negative
control. The oracle protects 22,398 emitted head-skin and eye samples across
18 phase/grip/LOD poses. The handoff test identifies actual final depth-buffer
owners and counts exposed forward-facing crown cells in a fixed outer-root
region; changing brightness cannot improve the count. Across six matched poses,
three-quarter exposure falls from 507 to 427 cells (15.78%), and frontal
exposure falls from 1,256 to 969 (22.85%). Every corresponding oblique/frontal
pose improves. Broadside remains nearly unchanged (107 to 109 cells across
the six poses), while dorsal falls from 227 to 220; narrow-band dorsal
occupancy falls from 82 to 73 summed rows. The side-view guard allows only
bounded native boundary-cell changes, and the rear control remains zero.

The acceptance test requires at least 10% oblique and 15% frontal improvement,
with no worse individual oblique/frontal pose. Exact V4 fails that new test as
intended. An earlier proposed 20% reduction of narrow-band occupancy in both
broadside and dorsal was not achieved and is explicitly not claimed. The
unchanged silhouette-drop, fullness, root-coverage, eye-projection and distal
preservation gates remain independent of this new visibility measurement.

The crown regression measures actual emitted geometry independently: the axial
spread of equal-radius crown contours, short-window width/depth drops, and
coverage between neighboring proximal arm cross-sections. Its negative control
is the exact V2 fuller-head source, not the older pinched head. A cutoff guard
also rejects merely moving the cliff farther forward. Cached crown normals are
checked against the shader's unit-normal contract. Distal-arm parity accounts
for denser proximal rings without relaxing comparisons after the merge. A
separate exact-V3 oracle includes the first distal ring at coarse detail: its
grip frame uses the original Float32 neighbor positions, so a long finite
difference cannot carry the new root correction into unchanged distal tissue.
The V5 validation's 166,962 exact V3 samples covered all mantle/fin tissue, both complete feeding
tentacles, all primary distal samples and the beak across three LODs, three
animation phases and two grip states. The historical V2 fixture is unchanged;
its absolute head/eye lock is replaced by surface-containment, projection,
aperture and profile invariants because that supporting skin now changes.
Crown columns are reconstructed from emitted ring order rather than assuming
a constant aspect ratio. The original cap negative control still fails, and
all closure, coverage and outline thresholds are retained. A join check
measures position and normal agreement between head and crown.

V6 retains those historical fixtures unchanged. An immutable V5 oracle now
locks the unaffected head skin outside the explicit union of the old and new
socket footprints. The authorized eye move replaces the former absolute eye
coordinate lock with an anterior-placement check plus the existing size,
shallow-recess, normal-alignment, pupil, far-side and projected-outline checks.
The support reference reconstructs both the sampled head and crown; a .00004
model-unit interpolation allowance accounts for the sampled crown while the
.12-pixel projected-outline ceiling is unchanged. Missing crown samples must
lie inside the moved socket mask, and all other emitted crown positions and
normals must exactly match the complete cached grid used by the reference.

The exact V5 upper-root negative control measures final depth-buffer ownership
at normal desktop scale: exposed upper crown and actual upper primary-root
coverage, rather than brightness. A second check samples the entire upper
handoff through X = 1.60, including its unchanged continuation. It retains the
.16 maximum radius loss over .05X and additionally requires a substantial
reduction of the worst upper drop and greater near-arm support than V5.
Exact V5 fails the new advancement/handoff controls as intended. The existing
all-direction fullness and neighboring-root coverage guards remain in force.
A separately recorded immutable V5 distal oracle applies the explicit new
upper .40 / other .30 boundaries; the older fixtures are not overwritten with
candidate output.

`scripts/render-cuttlefish-forward-roots-evidence.mjs` is the portable V6
capture entry point. It verifies the exact V5 staged tree and source hashes,
replays all saved V5 baseline pixels, pins the candidate source, and generates
native-scale pairs plus matched nearest-neighbor diagnostic crops. Its complete
suite includes broadside, three-quarter, dorsal, frontal, mobile, two animation
phases and unchanged manta controls in ASCII and points.

`scripts/render-cuttlefish-head-growth-evidence.mjs` generates V4 matched contact
sheets against exact V3, with source hashes checked before and after capture.
`scripts/render-cuttlefish-crown-evidence.mjs` retains historical V3 matched contact
sheets against the exact V2 fuller-head result. Broadside, three-quarter,
dorsal, frontal and mobile views are captured in ASCII and points at two
animation phases with matched cameras. The previous head/eye evidence scripts
remain reproducible historical comparisons. Captures use the actual Canvas
renderer and simulated DOM/lifecycle; they are not browser screenshots. Browser
input acceptance, browser-specific font pixels, device FPS and remote CI remain
separate checks. Captures explicitly distinguish normal scale from magnified crops.

V6 revision source overlaps: `src/animals/cuttlefish.js`'s crown chart,
forward eye surface and socket exclusions, upper primary `_arms` sleeves and
arm-specific proximal blend. The approved `headProfile`, anterior mantle,
fin motion, director, pose, interactions and all motion/timing formulas remain
unchanged. The prior manta source is unchanged. Generated classic/standalone
outputs and the pufferfish runtime embed these modules; regenerate them after
combining source patches. Navigation owners can consume the unchanged built
package contract.

## V7 eye placement and preserved upper brow

V7 starts from the exact V6 tree `fc7723e367c9795952c728d9a4f8a98e3f195168`
(unpublished review snapshot `037cd63b0a34ca0f129b6adedb9ea3d46a8465b8`).
The original user photographs were not exposed in this review session. The
actual V6 contact sheets and same-species common-cuttlefish photographs from
[MarLIN](https://www.marlin.ac.uk/species/detail/1098),
[MBL](https://www.mbl.edu/research/research-organisms/common-cuttlefish), and the
[Karlsruhe museum](https://conchylien.naturkundemuseum-karlsruhe.de/de/conchylien/aktuelles)
were inspected. These are visual references for the generic renderer, not an
identification of the original photographs or calibrated anatomical dimensions.

Three candidates isolate a larger anterior move, an upper-lateral surface turn,
and a deeper recess. The selected surface turn moves the eye chart center from
X=.87 / angle=.18 to X=.90 / angle=.52. Its half-width, angular span and shallow
recess are unchanged. The aperture, rim and skin replacement follow the existing
curved head/crown chart together. There is no new eye mesh or brow cap.

The visible improvement is local eye integration in broadside and three-quarter
demo renders. Frontal and dorsal samples show no obvious new protrusion; they
do not establish an equivalent aesthetic improvement. The entire V6 supporting
head/crown outline is preserved. This revision does not claim a new external
brow silhouette or a fix for the remaining head-to-arm shadow.

The renderer change is confined to the two eye-center constants. Mantle, fins,
all proximal and distal arms, feeding tentacles, beak, lighting, motion and
interaction methods stay exact. The V6 preservation oracle replaces the older
V5 socket-mask lock and is generated from V6, excluding only the exact union of
the old and new socket holes. Earlier oracle files remain historical evidence.

The independent sampled-crown test interpolation now uses ten nodes because
the previous cubic interpolation undershot the more curved upper-lateral host.
Eight/ten/twelve-node and independent Fourier convergence confirm that error;
the .00004 model-unit outward tolerance and .12-pixel silhouette tolerance are
unchanged. An outward-shifted rim still fails the same containment check.
Placement-specific height checks now use the sampled host's lateral quadrant
and the small aperture's alignment with its measured socket center.

Matched V6/V7 captures cover four views, ASCII/points, and times 2.4/6.8 seconds
at 1000 by 650 native pixels. They use the actual renderer with Skia Canvas and
a simulated DOM. Browser acceptance, continuous-animation fidelity, device FPS,
remote CI and original-photo matching are not claimed by this evidence.
# V7.1 follow-up: soften the visible upper attachment

The user subsequently supplied two reference photographs and a labeled anatomy
diagram, and requested softer head edges and a clearer head-to-arm transition.
Those actual images were inspected. Their species is not established here.
The long forward apron in the photographs includes apposed primary arms; it
must not be replaced by an elongated solid forehead.

Depth-cell attribution of exact accepted V7 identifies the visible upper
transition as primarily upper primary-arm attachment tissue. In the native
broadside camera, roots own all 11 outline cells in X=1.02..1.40 at both sampled
phases; in three-quarter they own 13/15 and 14/16. The small three-quarter peak
belongs to the initial section of upper arm 2. Head-only alternatives either
changed little at demo scale or introduced an unwanted hump/saddle, so they
were rejected.

V7.1 therefore makes a narrowly scoped **attachment-surface** correction:

- The radial section of the three upper primary-arm bases eases into the brow
  over u<.16, with a compact quintic return.
- Their existing tissue sleeves use a quintic taper over the unchanged merge
  intervals (.38, .40 and .39), retaining fullness through the early rollover
  and returning with two derivatives to the accepted distal surface.
- This changes upper proximal skin and attached surface details, including
  locally derived normals. It is not a claim that those complete roots remain
  geometrically identical.
- Centerlines, section frames, root offsets, path functions and motion remain
  exact V7. Upper-arm samples from u>=.40, the other five primary arms, both
  feeding tentacles, the beak, mantle/fins, entire head/crown/eyes, and common
  lighting remain protected by independent checks.

The production change is confined to `rootSleeve` and `_storeRootSection`.
It leaves the accepted V7 eye placement and all head profile parameters intact.
This isolated attachment correction should be reconciled with the parallel
upper-arm owner's work at those two functions; it does not replace their path
or posture work. Eight primary arms and two specialized feeding tentacles stay
distinct. Concealment/extension of the feeding tentacles is outside this patch.

The native matched comparison uses the same four views, ASCII/points and times
2.4/6.8 seconds as V7. The supported visual claim is modestly smoother upper
attachment contour. It is not exact photographic fidelity, corrected arm
origins, or an independently demonstrated real-browser/device result.
