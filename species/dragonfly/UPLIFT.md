# Dragonfly · flight and twig study

## Authoring brief — written before implementation

Scope: Dragonfly-owned source, demo, tests and review artifacts only. Integration
base: `b8f222dab868821f27bf2a64a98434f3483fc8e6` on `castlemilk/ascii-animals/main`,
verified by `git ls-remote` on 19 November 2026. Publication is a working branch
and PR only. Shared engines, entry points, generated distribution and workflows
belong to central integration. No deployment or merge is authorized.

### Anatomy and visual direction

A stylized blue-green skimmer, not an identification model of one named species.
Three recognition anchors: two broad compound eyes on a distinct rounded head;
four transparent, separately attached wings with broader hindwing bases; a long
ten-segment abdomen. Preserve a minimum 72×44 logical grid, portrait composition,
dorsal and oblique views. The membrane should read as air between fine veins,
with restrained dark pterostigmata near the tips. No opaque butterfly-like wings.

| Part | Parent | Construction and motion |
| --- | --- | --- |
| Four wings | Two thoracic attachment pairs | Tapered, independently phased fore/hind blades; stable span; no per-frame noise |
| Eyes and head | Thorax front | Paired rounded domes and a narrower face; readable medial valley |
| Abdomen | Thorax rear | Ten joined segments, muted collars and a narrow dorsal highlight |
| Six legs | Thorax underside | Flight basket unfolds into a grip across a real transverse twig |
| Habitat | Scene | Distant bank, quiet water contours, nearer forked stems; geometry ownership wins |

### Directed sequences

Use the existing public `dart`, `perch`, `return` cues and existing phase union.
An explicit dart captures the current heading: anticipation (`launch`), tail-first
retreat (`dart`), visible counter-pitch/braking (`settle`), measured return and
hover recovery. Keep yaw stable through retreat rather than rotating to face the
velocity. Deliberate landing approaches the assigned twig, lowers the legs and
settles before wingbeat stops. A held perch ignores guide motion. Resume first
spools up the wings and releases the grip, then lifts and returns to the route.

Hover is an active stable lookout: low-amplitude root drift, slower abdominal
response and independently phased wings. The timing, attitude exaggeration and
slowed visible wingbeat are authored for legibility, not measured biology.

### Inputs and lifecycle

Retain semantic cue/selection/motion controls and focused-canvas arrows, 1–4 and
Space. Add focused D/L/R equivalents for the three flight cues. Touch guidance
must stay passive and allow scrolling. A selected visitor's visible geometry can
be picked directly; empty habitat remains a guide target. Reduced motion and user
pause stay static; explicit actions change pose without reactivating animation.

Keep the existing 60 Hz integer clock, seed, bounded ordered inputs and fixed-step
catch-up policy. Interpolate private presentation poses (root, attitude, wing
phase and leg grip), then regenerate rigid geometry. Public `sample()` remains
the exact-tick sample and observational; no presentation sampling changes state.

### References and rights

Read on 19 November 2026:

- [Australian Museum: anatomy](https://australian.museum/learn/species-identification/ask-an-expert/what-do-dragonflies-and-damselflies-look-like/): two clear wing pairs, broader hindwings, large eyes, six legs, perch-return behaviour.
- [Australian Museum: Odonata](https://australian.museum/learn/animals/insects/dragonflies-and-damselflies-order-odonata/): hover/backward flight, forward leg basket, freshwater habitat.
- [Queensland Museum: dragonflies and damselflies](https://www.museum.qld.gov.au/learn-and-discover/animals-of-queensland/insects/dragonflies-and-damselflies): broader hindwing bases, outspread resting wings, blue skimmer colour context.

All geometry and habitat are independently authored equations. No reference
photos, ASCII drawings, font files, meshes or third-party implementation are
copied. Keep the installed system monospace stack; pixels are environment-specific.
The output is a Canvas rendering of printable ASCII cells with optional UI labels,
and the existing plain-text cell export remains available.

### Acceptance before measurement

Preserve 6,144 samples per individual, four individuals, 72–160 columns,
44–88 rows, 1,200×700 logical pixels, DPR≤2 and five catch-up ticks. Require
unchanged public type consumers, exact-seed/log equality across sampling cadences,
separated wing silhouettes at the minimum grid, bounded acceleration through
braking, stationary held perches, smooth interpolation without shortening blades,
and resource release on disposal. Capture matched desktop/phone before and after,
then inspect representative motion states. Distinguish native Canvas, browser
execution and physical-device measurements; an unavailable gate is not a pass.

Final commands, source hashes, captures and remaining limits are in the review
manifest delivered with the patch.
