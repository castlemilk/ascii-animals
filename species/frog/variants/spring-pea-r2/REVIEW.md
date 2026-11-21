# Spring Pea R2 — reconstruction handoff

**This is a NEW revision. It is not the missing original Spring Pea patch or ZIP.**

Final patch base: `26ee6ffc623e0adb2256e66d5b7cefc9ff36c7dd`.
Initial main and native capture base: `3b5ffcce7bea56e1402fc16d0edc2c14c3cd5779`.
The missing original revision was based on `f63b20e2045b1070b10bde2efc4eb3a8536e606b`.

Main advanced during this work. The final checkout was fast-forwarded before
packaging. `BASE-COMPATIBILITY.json` records that every Frog path, public Frog
facade, shared scheduler, root package file and build script was byte-identical
between the initial and final pins. The final validation runs use the final pin.
The native plates retain their truthful initial capture labels and runtime
fingerprints; they depict the same Frog sources present at the final base.

## Scope and integration

All patch paths are additions under `species/frog/variants/spring-pea-r2/`.
Original is preserved. No shared route, gallery selector, default renderer,
public export, package file, README, canonical/generated Frog source, merge,
deployment or publication is part of this change.

`index.mjs` is the explicit opt-in entry. It calls the existing compiled
`createFrogArtwork` facade with the private `createSpringPeaPreview` factory.
The returned API and canonical model, action rules, seeded state, event ordering,
shared scheduler, keyboard/touch mapping, reduced motion, visibility/size gates
and cleanup remain owned by that facade/controller. The adapter owns only
pose treatment, bounded geometry/cell work and synchronous ASCII painting.

The private review page uses one canvas and one active controller. Switching
Original/R2 disposes the previous controller before recreating the same seed and
composition. See `INTEGRATION.md` for the local URL and opt-in import.

## Critique of the observed shipped Frog

The public gallery, Frog study and classic pond were inspected in a browser on
21 November 2026. Their screenshots and identities are in
`review/evidence/browser/`. The deployed commit was not exposed, so those images
are labelled observed public-site evidence; they are not proof that deployment
matches the final git pin.

The gallery card has a recognizable crouched outline, but the character is small
within a large dark field. In the paused study, raised eyes and the wide squat
body identify Frog, while dense mixed letters and low green-on-green contrast
make the face difficult to read. The classic pond gives the species useful
context and distinct actor roles, yet the same texture language covers frogs,
water and pads. At its captured viewport, those layers compete with the face
and the limb silhouette. This is an art/readability critique of the observed
stills; it does not claim the existing choreography is absent or broken.

The exact-base native Original comparison confirms the dense texture and weak
small-size face under the same seed, scene, viewport and requested grid as R2.
It is separately labelled native Canvas, not a screenshot of the site.

## Two directions and the selected character

The retained raster boards are Spring Pea and Reed Rascal. Their original
filenames, byte lengths and SHA-256 hashes are in `PROVENANCE.json`.
The review ZIP contains those exact board bytes. `review/concepts/` supplies
newly authored, editable SVG interpretations, their authoring script and explicit
reconstructed art briefs. The old generation prompts/editable source were not
recovered.

Spring Pea uses a round, broad head/body, separated cream eye domes, folded
haunches, lime contour, coral tongue and restrained teal habitat. Reed Rascal
uses a kite body, trapezoid eyes, angular legs and a wary expression on cream.
Spring Pea is implemented because its compressed body and rounded haunches fit
the requested spring-loaded acting.

The first R2 native pass had noisy hollow eye cells, a bright slab of torso
glyphs and an almost invisible mouth. The final pass widens the eye footprint,
quiets the body/throat interiors, rounds the haunch joints and exposes a light
lip curve. The renderer uses deterministic printable ASCII for the character,
tongue and habitat; it does not display the concept drawing as artwork.

## Two moments with consequential input

| Moment | Anticipation | Response | Settle | Input consequence |
| --- | --- | --- | --- | --- |
| Startled leap | Low loaded crouch over four planted contacts | Directional stretch, then a narrower gathered fall | Broad contact squash, landing droplets and recovery | The chosen reachable pad is the committed destination; busy triggers do not queue another leap. |
| Firefly snap | Eyes track; the frog approaches a reachable perch and plants | Coral tongue extends from the same transformed mouth point used by the face; insect and tongue tip meet exactly | Caught insect follows retraction, then the frog rests | Aim changes the selected perch and contact location. |

`tests/input-outcomes.mjs` reproduces four explicit cases using the private
review configuration. Two landing choices settle on pads 1 and 3 respectively.
Hunt aims `(0.36,-0.4)` and `(-0.76,-0.7)` both catch, but settle on pads 1 and 3
respectively. The result JSON includes every phase transition and exact inputs.

## Matched evidence

All native comparisons use seed 23, one actor, stillwater scene, shelter layout,
autonomy off and the same requested preview configuration. Desktop canvases are
900 × 520; phone-sized canvases are 356 × 300. R2 deliberately selects fewer,
larger cells on narrow surfaces. These are art-at-size checks, not responsive
browser layout or device tests.

| Deliverable | Location in the ZIP |
| --- | --- |
| Rest, silhouette, hunt, source-pixel crops and supported views | `review/evidence/native/` |
| Matched Original/R2 desktop and phone leap clips | `matched-*-leap-normal-speed.mp4` in that directory |
| Matched Original/R2 desktop and phone hunt clips | `matched-*-hunt-normal-speed.mp4` in that directory |
| R2 solo clips and staged contact sheets | `spring-pea-r2-*` files in that directory |
| Exact events, ticks, source/font hashes and image checks | Native manifests, timelines and `validation.json` |
| Actual public-site screenshots | `review/evidence/browser/` |
| Development frames independently inspected before freeze | `review/evidence/development/` |

The clips encode one frame per two 60 Hz model ticks at 30 fps. The leap is
106 frames / 3.533 seconds; the hunt is 151 frames / 5.033 seconds. Leap input is
tick 24 → pad 4; hunt input is tick 24 → `(0.36,-0.4)`, reaching pad 1, catching
and returning to rest. Files were encoded and probed; contact sheets were
inspected. **Normal-speed playback in a video player/browser was not reviewed.**
Encoding rate is not a measured runtime frame-rate result.

An initial native capture of Original was blank because the capture host did
not await image decoding for its atlas snapshot. The host was corrected, all
provisional captures were regenerated, and the final 96 named stills pass an
actual foreground-pixel check. Original production code was never changed.

## Validation and open gates

`tests/VALIDATION.md` and `review/REVIEW-NOTES.md` give exact commands and results.
The private matrix covers Original preservation, API/options, deterministic
state/cells, fixed camera, planted contacts, mouth/tongue attachment, input,
shared scheduling, reduced motion, hidden/offscreen/zero-size suspension and
disposal. Canonical Frog/public/scheduler tests and repository type checks are
recorded separately. Supplemental picking covers all one/two/three-actor cases.

The camera sweep has 5,456 frame/configuration/view cases, 1,008 fixed-camera
checks and a predeclared 3 px geometric margin. Feeding checks cover 96 contact
combinations. These numerical checks are not browser glyph-pixel or performance
claims. The direct renderer owns no RAF, timer, event listener or observer.

The private local page could not be reached by the cloud browser. An explicit
security-policy rejection prohibited workarounds. `review/BROWSER-STATUS.md`
retains the exact failure and separates the later successful public-site visit.
Candidate browser layout/reflow, real keyboard/touch/focus/scroll, live browser
reduced-motion/offscreen behavior, assistive technology and device performance
remain open acceptance gates. Controlled-host tests do not close them.

The front view is the strongest character view. Eyes, smile and folded haunches
remain coarse at phone scale compared with the vector references. The fixed
camera preserves room for legal jumps and leaves deliberate empty sky at rest.
This is a private reviewable prototype; shared exposure is a separate integration
decision. No generated image or native render is presented as browser evidence.
