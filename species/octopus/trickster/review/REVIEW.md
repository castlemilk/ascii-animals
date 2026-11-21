# Octopus character review — Pocket Trickster

Reviewed 21 November 2026, Australia/Melbourne.

**Result:** an original, octopus-only isolated prototype, editable concepts and a
reviewable patch based on current main
`f63b20e2045b1070b10bde2efc4eb3a8536e606b`. Both art directions were shown before
implementation. Pocket Trickster was selected for its face, soft silhouette and
phone-scale readability. No existing tracked source was changed; no remote write,
pull request, merge, publication or deployment was performed.

This follows the existing `skunkworq/skunkworq-skills`
`generate-reactive-ascii-animals` workflow: scoped authoring brief, original
geometry, deterministic tick/input contract, lifecycle ownership, two staged
interactions, explicit evidence provenance and a review before integration.

## 1. What actually ships

The live [gallery octopus](https://castlemilk.github.io/ascii-animals/animals/octopus/)
and [classic Octopus Den](https://castlemilk.github.io/ascii-animals/octopus-den.html)
were inspected in a real browser. The gallery was captured at 1440 × 1000 and
390 × 844; the classic den at 1440 × 1100. Those are browser viewport captures, not
the matched art-only canvases below. The downloaded live den HTML exactly matched
the checked-out distribution file, SHA-256
`ba6fc9f99a5bddb7c06177cd863a76f2c670b78f2d58ab37cd2007cf2e4daa63`.

The source review used the pinned main
[octopus](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/src/animals/octopus.js),
[gallery renderer](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/demo/src/lib/renderers.ts)
and [classic preview](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/species/octopus/preview.js).
It did not use the superseded Seahorse #42 or Gecko #44 drafts.

### Gallery critique

The silhouette identifies an octopus, but the narrow upright mantle and repeated
downward arms dominate. At phone scale, the small eyes, surface marks and suckers
compress into a textured column. The subject reads as a specimen more readily
than a character with a particular intention. Several arm contours compete at
similar weight, so there is little separation between a supporting arm and the
arm doing something interesting.

The existing system already contains movement and reaction. The design issue is
the amount of expressive change those mechanics communicate: the gaze and leading
arm are visually weak beside the dense mantle, and the silhouette remains close
to its resting shape through much of the interaction. Adding more surface detail
would not address that hierarchy.

### Classic den critique

The larger ember presentation gives the arm construction, suckers and rock shelf
more room. It also increases competition: the patterned mantle, many small arm
marks and textured rock share the same visual frequency. The gaze is still tiny.
The den therefore demonstrates the procedural model better than it communicates
curiosity, hesitation, contact or mischief.

There is good existing work to preserve: eight articulated arms, support contacts,
an invitation/reach sequence and a gather/ink/jet/return reaction. The proposal
changes the character language in an isolated study; it does not pretend those
mechanics were absent from main or replace them without coordination.

Real-browser evidence files are `live-gallery-desktop.jpg`,
`live-gallery-phone.jpg` and `live-den-desktop.jpg`. The extra
`live-den-desktop-1444x947.jpg` is another desktop view, not a phone capture.

## 2. Two directions, one deliberate choice

| Direction | Shape, face and habitat | Motion character | Decision |
| --- | --- | --- | --- |
| A — Pocket Trickster | Soft coral mantle, large cream slit eyes, uneven lids, thick loops with open gaps; one seafoam ledge and shell | Curious reach, curled recoil, compact ink hide, one-eyed peek | Selected: eyes and arm roles survive a coarse phone grid |
| B — Ink Magician | Low tilted violet kite mantle, narrow amber eyes, long angular ribbon arms; one sharp rock plane | Low stalk, diagonal stretch, theatrical ink curtain and sideways reveal | Distinct alternative; the angular anatomy needs more work at small sizes |

The ImageGen boards show silhouettes, faces and staged keys. They are visual
references, not executable ASCII or evidence of tested motion. Their complete
prompts and palettes are in `CONCEPTS.md`. The runtime geometry is original code.
The implementation borrows B's sideways peek but uses A's larger face and soft arm
loops. Its horizontal pupil treatment is explicit in the glyph renderer.

The finished glyph art is intentionally graphic: coral arm contours, cream eyes,
blue ink, sparse sucker circles and quiet habitat marks. Parentheses, slashes,
underscores and negative space carry the main shape. A small set of glyph roles
replaces the old surface-detail hierarchy. This is not a claim of fewer displayed
glyphs in every configuration: the gallery baseline and candidate measure
different content, and the candidate's larger character can use more cells.

Six editable SVG/text pairs export actual cell layouts for idle, contact and peek
at 960 × 600 and 390 × 500. Each SVG contains individual text cells rather than
an embedded raster picture. `core.mjs` and `render.mjs` are the editable motion
and art sources. The prototype is a front-view cartoon, not a full 3D turn library.

## 3. Two input-dependent moments

### Reach, contact, recoil

The eyes lead and the body leans for 0.5 seconds while the selected arm coils.
During the next second that arm unfolds on a curved path. From 1.5–2.2 seconds
its actual tip is at the invitation coordinates, with a small pearl/contact
accent. From 2.2–3.6 seconds the tip peels back and the body settles.

Left and right inputs select different tactile arms. Target position changes the
extension and the final contact, rather than merely triggering a canned pose.
Release during the action snapshots the current curve and starts a continuous
1.2-second recoil; it does not jump back to idle. The contact unit checks require
the chosen tip to equal the target on both sides.

### Gather, ink, peek, settle

A disturbance first squashes the mantle, widens the eyes and gathers the arms
for 0.45 seconds. The ink hides the character through 1.25 seconds. From
1.25–2.65 seconds one eye and a hooked arm appear at the chosen edge. The cloud
then recedes and the arms return with staggered motion by 4.6 seconds.

The disturbance side changes the peek edge. A startle can interrupt a reach from
its current pose; repeated startles while already in ink are ignored and counted.
No unlimited action queue builds up. Full hide was reviewed and corrected after
four to seven residual arm cells were found: the main body and all eight original
arms are now omitted during full conceal, leaving only the intended peek layer.

Keyboard and semantic buttons expose both actions. Canvas arrows move the aim;
Enter invites, J startles, Escape releases and Space pauses. Pointer hit-testing
uses the actual occupied character cells. The touch policy permits vertical page
scrolling. Trusted browser and physical-touch delivery remain unverified here.

## 4. Matched evidence and what it proves

The exported bundle contains 80 raw native PNGs, 16 labelled comparison/sequence
sheets, two normal-speed MP4s, two GIF previews, and a provenance manifest. Every
comparison sheet says **NATIVE CANVAS + SIMULATED HOST — NOT BROWSER SCREENSHOTS**.
These are exact-source Skia Canvas renders. Main runs with a simulated browser
host; the candidate uses its actual `fillText` renderer. They are useful for
geometry, glyph hierarchy, contact and phase comparison, not browser CSS/input
or physical-device performance.

| Setting | Classic study comparison | Gallery comparison |
| --- | --- | --- |
| Baseline | Main octopus, seed 17, size 1.3, density 1.45, ember, glow off, independent hover | Main octopus, seed 7, size 1, normal shared defaults, reactive scene |
| Candidate | Pocket Trickster, seed 17 | Pocket Trickster, seed 7 |
| Art canvases | 960 × 600 desktop; 390 × 500 phone; DPR 1 | Same |
| Replay | 60 fixed ticks/s; invitation at tick 90; release at 280; left disturbance at 360 | Same |

Equivalent CSS-pixel input positions are used for main. Candidate coordinates are
`(.70, .33)` for the invitation and `(-.5, 0)` for the disturbance. Checkpoints
cover idle, anticipation, reach, contact, recoil, gather, hide, peek, settling and
restored idle. Labels report the actual baseline diagnostic stage: for example,
main is in `examine` at the candidate's contact checkpoint and `jet` at its peek
checkpoint. Main is not described as having the new peekaboo action.

The late release in this common replay does not demonstrate early cancellation;
that branch is verified in the core/controller tests. This avoids overstating
what the motion clip shows. The MP4s show the candidate at normal elapsed speed:
361 frames at 30 fps, 12.033 seconds, sampling a 60 Hz simulation. They are fixed
tick render replays, not recordings of browser wall-clock frame rate. Both files
fully decoded without errors. GIF previews use 15 fps at the same elapsed speed.

The native baseline uses periodic canvas snapshots to bound native memory. A
320 × 240 direct-versus-checkpoint parity check found zero differing RGBA
channels. The manifest records exact source hashes, options, ticks, logical grid
hashes, image hashes, font policy and native runtime. No font was downloaded or
bundled; the native renderer resolved the existing fallback to Liberation Mono.

### Browser limitation

The real browser could inspect the shipped site but could not reach the local
candidate server. A separate project Chromium runner failed before page load with
`socket() failed: Operation not permitted`; ptrace was also denied. An attempted
standalone data URL was rejected by the browser's URL policy. No security setting
was relaxed and no alternate transport was used to bypass that rejection.

Consequently, there are no candidate browser screenshots and no passing browser
end-to-end results. `tests/capture.mjs` and `capture-harness.html` are supplied to
repeat browser captures and input/lifecycle checks in an ordinary development
environment. Preparation is not a test pass. The full-page responsive shell,
screen-reader behavior, trusted key/touch delivery and browser font rendering
still need that run.

## 5. API, determinism and lifecycle

The existing public API and all shared source remain untouched. The prototype
adds a separately named local `createOctopusTrickster` controller with declarations;
it is not exported from the package and is not `createArtwork` compatible. A
coordinated gallery integration would need to adapt this design into the shared
octopus contract after review. Existing support-contact and fixed-length-arm
tests still pass because the original 3D species implementation is unchanged;
they are not claims that the elastic cartoon curves satisfy that 3D model.

The pure core uses an explicit unsigned seed, integer 60 Hz ticks and bounded,
ordered normalized input. Sampling is pure. Fixed replay grouped in different
render batches produces identical state/cells. There is no clock, DOM access or
global randomness in the core. Cross-platform font-pixel identity and serialized
state migration are outside the promise.

Work is bounded by eight arm curves, at most 4096 grid cells, 64 pending events,
five catch-up steps per callback, DPR at most 2 and 8,294,400 backing pixels.
With visibility observation enabled and IntersectionObserver available,
hidden/offscreen/zero-size states detach recurring animation work. Resuming drops
hidden elapsed time instead of catching up. User pause and reduced motion compose
with visibility. Explicit Play can opt into motion; pointer input, restart and
option changes cannot silently clear a pause. Teardown releases listeners,
observers and the shared scheduler; constructor failure also rolls back ownership.

These lifecycle behaviors passed simulated-host tests. They are code-level
evidence, not a browser energy-use or heap measurement.

## 6. Validation and measured limits

| Check | Result | Meaning |
| --- | --- | --- |
| `npm run build` | Passed | Existing distribution build succeeds; no tracked distribution change |
| New prototype suite | 38 passed, 0 failed | Core 10, controller 13, renderer 9, standalone 6 |
| Selected existing suites | 45 passed, 0 failed | Public API, shared lifecycle/scheduler, species geometry, original octopus |
| Local TypeScript declarations | Passed with TypeScript 5.9.3 | Core/controller examples type-check |
| Native canvas checkpoint parity | Exact at tested 320 × 240 case | Capture memory guard does not alter those RGBA pixels |
| MP4 decode | Both passed | Complete 361-frame, 30 fps streams |
| Candidate real-browser run | Blocked before page load | No layout, input or FPS pass claimed |

The new tests cover seed/input determinism, finite geometry, eight arms, left/right
contact, release and startle continuity, invalid/burst events, full conceal, peek
side, printable glyphs, viewport bounds, rendering purity, pause causes, visibility,
reduced motion, focused shortcuts, resize, teardown, template bindings and the
self-contained build. The complete repository test suite was not run.

In the supplied sample the desktop grid is 4080 cells and the phone grid 3484,
with a maximum of 851 displayed glyphs across retained candidate checkpoints.
The native timing run covered the action sequence at 960 × 600, with 30 warmup
frames and 330 measured frames. Pure cell rasterization measured p50 0.939 ms /
p95 8.168 ms. Native Canvas raster-and-draw, including a state-purity guard,
measured p50 7.327 ms / p95 31.369 ms. **The declared 16 ms reference is not met
for that complete native measurement.** This does not establish browser or phone
FPS. A production integration needs a browser trace and any optimization justified
by that trace; no renderer performance sign-off is claimed.

## 7. Remaining work and custody

The completed deliverable is the isolated prototype and review patch. The remaining
integration gates are the unavailable candidate browser run, physical-phone input
and performance review, and coordination of the shared renderer/API adaptation.
The classic/gallery pages continue to ship the original character.

Art limitations are explicit: the prototype is frontal, arm bends are elastic
cartoon curves, and its quiet pose retains some bilateral curl regularity. Upper
curls and lower arm roots overlap in some compact poses; eight arms in the model
does not guarantee eight separately countable arms in every frame. The new reach,
gather and peek produce visibly different silhouettes; further idle asymmetry
can be judged during the eventual browser review without adding texture.

To review locally, apply `octopus-pocket-trickster.patch` to the pinned main,
run the commands in the prototype README, and open the supplied standalone HTML.
The exported `patch-verification.json` records clean application and scope checks.
Keep any integration or publication as a separate, coordinated decision.
