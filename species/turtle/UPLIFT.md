# Green sea turtle — shell, stroke and breath study

## Authoring brief (written before implementation)

Base: `castlemilk/ascii-animals` main, independently rechecked as
`b8f222dab868821f27bf2a64a98434f3483fc8e6` on 19 November 2026. Work is isolated
to turtle source, demo, documentation, tests and evidence tooling. Generated
entry points, other species, shared engines, workflows and repository settings
are owned by central integration. Publication authority is a working branch and
PR only; no merge or deployment.

The reference is a stylized **green sea turtle, Chelonia mydas**, viewed from
above and slightly to one side. Its three recognition anchors are a low oval
carapace with a continuous rim, a compact projecting head on a visible neck,
and two long shoulder paddles with two much shorter rear steering flippers.
The supported minimum remains 80×32 cells; the phone review is 390×280 pixels
at 100×40 cells. Left/right facing and shallow climb/dive attitudes are supported;
this is not a freely rotating anatomical model.

| Part | Attachment and construction | Readability priority |
| --- | --- | --- |
| Carapace | One analytic domed surface; five vertebral, four paired costal and peripheral marginal plates in shell-local coordinates | Rim, dome, major plate seams before secondary streaks |
| Head and neck | Neck under the anterior rim, rounded compact skull and modest beak; never retracts into the shell | Eye and continuous neck at small grids |
| Foreflippers | Fixed paired shoulder roots; curved tapered paddles; synchronized work with slight near/far variation | Root continuity and long paddle silhouette |
| Rear flippers and tail | Rear rim; small trim motions and short tail | Clearly subordinate to foreflippers |

## Reference and rights ledger

All geometry, plate boundaries and motion are independently authored procedural
code. No reference photograph, diagram, ASCII art, model or font is copied.
System monospace fonts are requested, with no bundled font binaries.

| Reference (read 2026-11-19) | Observation used |
| --- | --- |
| [NOAA green turtle](https://www.fisheries.noaa.gov/species/green-turtle) | Small head, five central/four paired side scutes, muted brown/olive shell, need to surface for air |
| [WIDECAST pictorial key](https://www.widecast.org/biology/pictorial-key/pictorial-key-green/) | Broadly oval, smooth to scalloped rim and rounded head |
| [Wild adult swimming kinematics, 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9622894/) | Downstroke, inward sweep, recovery, upstroke and preparation form a closed flipper trajectory |
| [Biomimetic propulsion study, 2023](https://www.nature.com/articles/s41598-023-37904-5) | Brief working part and longer recovery glide inspire the duty cycle; exact timing is artistic |
| [Dive angles, Glen et al., 2001](https://www.cambridge.org/core/journals/journal-of-the-marine-biological-association-of-the-united-kingdom/article/abs/dive-angles-for-a-green-turtle-chelonia-mydas/C69E428B00475584E22640099AE061E1) | Descent can begin steeply and flatten; one animal's observations do not define a universal trajectory |

## Directed sequences and input contract

The existing runtime exports, typed methods, options, state shape and public
reaction discriminators remain unchanged. New intent is private state. Upper-water
`inspect(x, y)` targets at `y <= -.55` invite a breath; lower-water targets at
`y >= .55` invite a dive; midwater targets retain an inspection. Buttons, touch,
and focused-canvas keyboard guidance invoke that same API. Hover suggests an
attitude without snapping the animal to the pointer or starting another cue.

| Sequence | Anticipation | Response | Recovery |
| --- | --- | --- | --- |
| Ordinary glide | Slow preparation at the shoulders | Short paired downstroke and inward sweep | Edge-on return and a long quiet coast; rear flippers trim |
| Surface breath | Head/neck lift, paddles open | Forward ascent, snout at a sparse surface band, brief breath dwell | Nose lowers, one working sweep, descent and leveling along the continuing forward path |
| Responsive dive | Head leads before the body descends | Heavier stroke along a forward/downward curve | Body levels, paddles extend and original cruising depth returns without reversing the forward displacement |

Directed public phases remain inspect 0–89, bank 90–159 and recover 160–279
raw ticks, followed by a 60-tick cooldown. The historical solo phases remain
0–44 / 45–109 / 110–179. These are compatibility phase names, not new biological
labels. Repeated cues cannot restart a moving response or enqueue future work.
Deliberate still cues replace a poster at the same tick. A breath is a compressed
artistic sequence, not a claimed physiological breathing duration.

Recover vertical displacement, depth and attitude along a continuing route;
retain forward distance already earned. Heading follows the path tangent with
bounded lag. Flipper, shell and material coordinates share that pose. Surface
light, sparse rear particles, distant reef and foreground corner seagrass provide
depth while leaving the animal's silhouette clear.

## Determinism, resource limits and acceptance

Same engine/version, options, seed and ordered normalized input ticks must yield
the same state and logical cells, regardless of render grouping. Director and
habitat time accumulate speed rather than resampling all history on a speed edit.
Materials contain no time input. No cross-font pixel guarantee is made.

Existing limits remain: five turtles; 180×90 cells; at most 600 explicit ticks or
six browser catch-up ticks; one coalesced hover; no event queue, particle pool,
new runtime dependency or additional scheduler. Pause, system reduced motion,
hidden/offscreen/zero size and disposal compose independently. Static redraws do
not advance ticks. Browser lifecycle and the shared scheduler remain owned by
their existing adapters.

Acceptance is matched seed/options/events at desktop and phone sizes, distinct
surface/dive postures, shell-bound scutes, forward recovery, recognizable minimum
silhouettes, deterministic replay, strict typed consumers and existing package
checks. Native Canvas captures are explicitly separate from browser evidence.
The current local Chromium launch failed with `socket() failed: Operation not
permitted`; real CSS layout, browser input, phone scrolling, assistive technology
and sustained target-device performance are not claimed.

Verification commands, source hashes, exact captured ticks, independent critique
and remaining acceptance are recorded in the final review manifest.

## Review corrections

Independent review caught and corrected a rapid pitch change at the breath dwell,
a cropped far foreflipper, insufficient small-grid seam contrast, lifetime drift
that emptied later looping passages, and stale travel on reactivated IDs. Pitch
has a per-tick angular bound; the far paddle folds for the breath; seams receive
a resolution-aware width and depth preference on the same shell surface. Route
progress is cycle-local; reactivated IDs start with clean motion state.

A second review found that a fixed root-height target let the nose float above
the waterline. Breath contact now comes from the same projected snout used by the
renderer. The solo tracking view also prevents repeated autonomous breaths from
carrying the default specimen permanently offscreen. Final evidence includes the
whole recovered silhouette and an explicitly reset second animation take.
