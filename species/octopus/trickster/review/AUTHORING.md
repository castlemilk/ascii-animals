# Pocket Trickster — octopus authoring brief

## Scope and custody

Original, isolated cartoon study for the existing ASCII Animals project. Base:
`f63b20e2045b1070b10bde2efc4eb3a8536e606b` (current main checked 21 November 2026,
Australia/Melbourne). Only `species/octopus/trickster/**` is owned by this patch.
No existing public exports, shared engine, other species, deployment or generated
distribution file is changed. This is a review prototype, not a published replacement.

The actual live gallery and Octopus Den were inspected. The live den HTML SHA-256
matches the checked-out `dist/octopus-den.html`. Prior native Skia images are not
used as browser evidence. See REVIEW.md for the actual capture environment.

## Art directions, chosen before implementation

**A — Pocket Trickster (chosen).** Broad coral bean-shaped mantle, cream eyes with
horizontal pupils, unequal eyelids, thick tapered arm loops and large gaps. One
small stone shelf, a shell and a few seafoam current marks. Intent reads through
body lean, gaze and a single leading arm. The giant eyes and arm elasticity are
intentional cartoon exaggerations, not a biological reconstruction.

**B — Ink Magician.** Low tilted violet kite mantle, narrow amber eyes and long
angular ribbon arms. Strong diagonal silhouette, theatrical black ink curtain,
single rock plane. Distinct but less forgiving at the smallest grid. Retain its
sideways peek idea within direction A.

ImageGen boards are visual concepts only. Their prompts accompany this record;
neither board is executable geometry, a browser screenshot or evidence of motion.

## Animal and representation

- Stylized octopus; three anchors: broad mantle, paired slit eyes, eight attached
  tapering arms with curved tips. No invented visible human mouth.
- Printable ASCII only; bounded logical cell grid rendered with Canvas `fillText`.
  No bitmap character, SVG illustration or raster silhouette is used in runtime.
- Minimum target: 390 CSS-pixel phone, with 320 CSS-pixel robustness check. Desktop
  and mobile preserve character proportions; small detail is suppressed first.
- Original procedural curves; no copied animal drawings, photographs or fonts.
- Generic monospace font fallback, no bundled font. Logical cells are replayable;
  cross-platform font raster pixels are not promised identical.

## Behavior script

| Moment | Anticipation | Response | Settling | Input consequence |
|---|---|---|---|---|
| Tactile invitation | Eyes lead, mantle leans, chosen arm coils | One arm unfolds; its tip reaches the invitation with clear contact | Tip curls back, mantle overshoots gently and returns | Position selects left/right arm, target and extension; release causes an early recoil |
| Ink peekaboo | Body squashes, eyes widen, arms gather | Compact ink cloud conceals the body; one eye and arm peek from a chosen edge | Cloud thins; arms unfold on staggered phases; sly eyelid returns | Disturbance side determines the peek edge; busy triggers are bounded |

Idle keeps a quiet breathing rhythm and staggered arm tips. Pose sampling is pure.
Keyboard/touch provide both moments; buttons duplicate them. Status updates occur
on actions, not every animation tick. Pausing, restarting, resizing and pointer
movement never override reduced motion or user pause.

## Reproducibility and budgets (declared before measurement)

- Versioned core, explicit seed, 60 integer ticks/s, ordered normalized event log.
- At most five catch-up steps per callback. Extra elapsed wall time is dropped and
  counted; hidden/offscreen/zero-size resume clears accumulated wall time.
- Eight arm curves, at most 4096 visual cells, at most 64 queued inputs, one canvas.
- Target: recognizable face and leading arm at 390 px; no recurring RAF work while
  hidden/offscreen/paused/destroyed. Measured desktop p95 frame work target 16 ms;
  real mobile performance remains unclaimed without a physical-device run.
- Pure core contains no DOM reads, clocks, random globals or rendering calls.
- No state serialization or cross-version migration promise. Same implementation,
  seed, ticks and normalized input log produce the same logical cells.

## Accessibility and lifecycle

Semantic Reach / Ink peekaboo / Release / Pause / Restart buttons; descriptive
canvas alternative; visible focus; focused-canvas shortcuts; touch permits vertical
page scrolling. Reduced motion begins with a meaningful still. Independent pause
causes compose. DOM listeners, shared-scheduler subscription and observers are
owned and released by an idempotent controller. No resource survives disposal.

## Acceptance

The original acceptance plan covered matched desktop/phone browser captures,
normal-speed motion, left/right contact, ink conceal/peek, deterministic grouped
rendering, invalid/rapid input, resize, keyboard/touch, reduced motion, offscreen
behavior and disposal. Final outcomes are in `REVIEW.md`: 38 prototype tests and
45 selected existing tests passed; native matched art and normal-speed replays
were produced. The candidate browser run was blocked by the environment. Native
raster-and-draw p95 exceeded the 16 ms reference. Browser/physical-device visual,
input and performance acceptance remains unresolved; it is not inferred from
mocked tests or native images.
