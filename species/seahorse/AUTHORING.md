# Seahorse: the holdfast garden

> Historical director record. The current seahorse-only eelgrass revision, its
> exact source base, anatomy changes and executed validation are documented in
> [EELGRASS-REVIEW.md](EELGRASS-REVIEW.md). Historical geometry, counts and
> evidence claims below describe the previous contribution.

## Provenance and scope

This director extends the **current newly authored integrated Seahorse**, reviewed
from `main` at `c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`. The earlier exhausted
Pro chat did not export its implementation; this work does not recover that
source or its artwork.

Canonical code is [`src/public/seahorse.ts`](../../src/public/seahorse.ts), with
species-only demo inputs under [`demo`](demo), generated output under
[`dist/seahorse`](../../dist/seahorse), and the full contract in
[`docs/SEAHORSE-API.md`](../../docs/SEAHORSE-API.md). This contribution does not
replace the shared engine, scheduler, registry, catalogue or another species.
The shared scheduler is consumed through its existing subscription API.

## Gap, behavior and scene matrix

The integrated baseline already had a recognizable upright portrait, three small
behavior variations and an inspect/curl/settle greeting. The gap was sustained
direction and composition: one subject, a mostly fixed location and little
reason to keep watching after the greeting.

| Baseline gap | Implemented behavior/composition | Scene or control | Verification boundary |
|---|---|---|---|
| One subject, no individual intentions | Bounded 1–4 visitors, stable IDs/names, keeper/explorer/dreamer/partner roles | Roster, role and individual size/facing controls | Typed options, independent cues and finite snapshots tested |
| Holdfast was a frond behind a tighter tail | Tail endpoint solved onto its own kelp node; release, grip and recovery share a skeleton | Kelp garden; Find a hold / Release | Exact attachment, mirror/scale and motive consistency tested |
| No authored scene arc | Staggered arrival, substantial rest, departure and a returning lower arc | Scene, duration, spacing and tempo | Arc intervals, seek, replay and held-beat semantics documented/tested |
| Behavior variants shared a composition | Residents, inward-rising partners and a solitary current passage | Kelp garden / Tidal duet / Drift passage | Distinct logical frames; rendered appearance needs visual evidence |
| Pointer supplied a small tilt | Selected snout attention, targeted touch inspection, keyboard selection and shelter/recovery | Stage input and gesture controls | Input routing, cancellation and still behavior tested |
| Still greeting offered one curl | Four scene-beat stills and replaceable inspect/release/anchor/shelter posters | Compose a still; gestures while paused/reduced | Consecutive changes keep ticks and scheduling unchanged |
| Current and ensemble composition absent | Signed continuous current, sparse water traces, kelp sway and fitted slots | Current, population and size | Zero-crossing continuity and numeric anatomy bounds tested |
| Controls did not explain the scene | Scene cards, arc/motive status, roster and ASCII/PNG capture | Director layout | Native controls and labels implemented; usability needs browser evidence |

The cuttlefish reference establishes the useful expectation of authored scenes,
population control, individual roles and legible timing. Seahorse direction is
built around **holding, releasing, looking and returning**. Four visitors are the
maximum so that a curled tail and upright silhouette have room. Marine school
paths, ink, particles and video recording are outside this species's API.

## Authored scenes

**Kelp garden** gives each visitor a branch. A sentinel maintains its grip while
an explorer makes a larger excursion and a dreamer makes a smaller one. Stronger
current reduces wandering. Each visitor has a recognizable home, giving release
and recovery a visible destination.

**Tidal duet** pairs neighboring partner IDs. Their rest phrase loosens the tails,
brings them toward a shared center and lifts them together, with complementary
lean and a small phased detail. They retain separate holdfasts. Unpaired visitors
keep garden behavior. This is courtship-inspired direction, not a simulation of
seahorse mating or physiology.

**Drift passage** gives a solitary traveler space to loosen, cross the clearing,
leave and return. Counts above one support a small passing ensemble. Direction
is continuous through zero current, so moving a slider across still water does
not jump the visitor between opposite sides of a route.

The existing **study** remains a close portrait. `scene:'study', count:1` retains
its geometry and greeting thresholds. New scene-only controls are disabled
where they would not affect that portrait. Its director snapshot is bookkeeping,
not a renderer-exact replacement for the legacy portrait geometry.

## Anatomy and composition

Silhouette anchors are the tubular snout, small coronet, curved neck, segmented
upright trunk, independently fluttering fins and tapered spiral tail. Eye and
coronet establish head direction; the long snout turns curiosity into a small
readable gesture. Snout attention changes the tip without stretching the neck.
Local fin motion does not translate the entire body.

The director and renderer share the same mathematical tail endpoint. The model
rotates, mirrors and scales that endpoint, then solves body translation so a
completed grip lands on its kelp node. Partial release blends away from that
solution. `anchorId` is non-null only for a completed grip; an `anchored` motive
identifies that same holdfast. Facing, scale, current and attention cannot detach
a tail while the model reports it attached.

One centered logical grid contains water, kelp, all visitors and labels. Positive
Y is downward. Water stays behind kelp, animals occlude their fronds and numbered
labels identify individuals. There are no per-visitor canvases or animation
loops. A wide garden of four uses two rows; a narrow one stacks its visitors.
Requested size is fitted with space for anatomy and movement. Free-body roots
are constrained using a rotated anatomy footprint before blending to a grip.

Numeric bounds protect eye, snout, coronet, tail and label locations on supported
narrow/wide grids. They do not prove that every fine detail is readable in a
low-resolution composition. The demo uses 160×76 cells on larger layouts and
100×76 on compact layouts. The API retains 64–160 columns and 36–100 rows.
Minimum grids simplify anatomy; four visitors in a narrow grid remain a useful
visual-review case. A system monospace font supplies glyphs; no external font or
art asset is required.

## Direction and deliberate stills

Directed scenes use arrival `[0,.18)`, rest `[.18,.68)`, depart `[.68,.87)` and
return `[.87,1)`. The long rest gives viewers time to read individual motives.
Duration is 16–90 nominal seconds and individual spacing is 0–3 seconds. Tempo
scales route advancement and idle details. Legacy greeting and explicit cues
retain their raw tick durations.

Hold mode starts at `.42` and freezes route progress while fins, attention and
cue recovery can continue on advancing ticks. Seek while held chooses a new beat
and holds it. Pause separately stops browser advancement. The storyboard
combines pause and seek into Arrival, Rest, Release and Return compositions.

Each visitor has one cue slot: release/startle lasts 240 ticks; anchor/inspect
lasts 180. Cues ease into the action and recover to the ongoing scene. Repeated
live cues on the same visitor are ignored while active, preventing queues and
endless retrigger. Other visitors keep their own intentions.

A blocked browser selects deliberate ages within each gesture. A new still cue
replaces the previous one without resetting the scene, advancing time or
resuming the scheduler. Poster ages are release 90, anchor 70, inspect 70 and
startle 50 ticks. The retained legacy pulse/greet response is separate: phase
boundaries are 45, 110 and 180 ticks, paused greeting selects curl at age 70, and
its original active-response lock remains.

Pointer motion supplies one latest target. Touch uses the tap's coordinates to
select and inspect a nearby visitor. Empty-water taps guide attention; leave,
cancel and Escape clear it. Canvas-only keys and labelled native controls make
selection, gestures, scene beats and pause available without hover or precise
pointing.

## Reproducibility, ownership and limits

The DOM-free model uses integer 60 Hz ticks, accepting up to 600 per call. Seed,
ordered input and identical ticks reproduce logical state and characters,
including different tick batches. Options, individual entries, members, points,
motives and frames are immutable snapshots. Validation precedes mutations;
unknown keys, invalid enums, nonfinite/out-of-range values and invalid IDs reject.

The adapter subscribes to the existing per-window scheduler or an injected
borrowed source. It owns its subscription and listeners, not the scheduler or
host canvas. Pause, hidden document, offscreen state, zero size and live reduced
motion stop scheduling. Restart preserves user pause; play cannot remove system
or visibility blockers. Disposal and failed mounting clean up owned resources
without disrupting another instance.

Work is bounded: four visitors, four cue slots, 28 water tracers, 16,000 cells
maximum, six catch-up ticks per frame, a 100 ms active-time catch-up window, DPR
at most 2 and backing dimensions at most 4096 per axis. These are implementation
limits, not measured FPS, CPU, memory, battery or mobile-performance results.

## Verification and remaining acceptance evidence

The focused existing-plus-director run passed **31/31 tests**, and strict species
declaration fixtures passed after the reviewed changes. Tests cover legacy
behavior, validation, scene intervals, individual cues, replay, consecutive
poster replacement, zero-current continuity, exact attachment and numeric
landmark bounds. Browser-harness checks cover input, motion policy, shared/
injected scheduling, disposal and mounting rollback. The generated-demo check
ensures output matches the compiled source.

The landmark test samples all three directed scenes, one/four visitors,
64×100/160×36/160×76 grids, both facings, four beats and release/inspect posters
for every visitor. It checks world-coordinate bounds and matching attachment
state. It does not inspect font rasterization or certify recognizability at the
smallest resolution.

The delivery records the full suite passing 328/328 tests, strict project/species
types passing, and offline packed-consumer SSR, NodeNext/Bundler and core-type
checks passing. Optional esbuild/Rollup/Webpack checks were not run. Visual review
used eight actual logical poses rendered offline with DejaVu Sans Mono. The
28-second, 336-frame, 12-fps replay GIF is deterministic model output, not a
browser recording or a performance measurement. The single-file preview passed
syntax checking but was not browser-executed.

Changed-demo browser verification was blocked: the cloud browser could not reach
the local server and local Chromium launch was denied socket creation. Physical
touch, real phones, screen readers, Safari and Firefox were not verified.
Browser usability, font rasterization and measured performance remain separate
acceptance gates. This document makes no WCAG, device-performance or biological
accuracy claim. Artwork is independently procedural; no copied ASCII drawing,
model, reference-video code or external image is used.
