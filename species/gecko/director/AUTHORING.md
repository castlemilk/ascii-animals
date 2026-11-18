# Gecko director — Moonlit masonry

Brief completed before director code. Date: 18 November 2026.

## Scope and custody

- Base/main: `c06114404900884814bef879a02f1a49a3e7d590`; new isolated branch
  `feat/director-gecko`. The earlier animal branch is not replayed.
- Actual canonical source is `species/gecko/src`, compiled through the existing
  Gecko builder into `lib/species/gecko` and `dist/gecko`. `src/public/gecko.ts`
  is the real package facade. `src/species/gecko` contains declaration bridges.
- Only Gecko source/demo/tests/docs/generated output may change. Shared package,
  scheduler, registry, catalogue, marine runtime and other species stay owned by
  their coordinators. No AGENTS.md exists in the inspected checkout/ancestors.
- Skill: supplied main `23e078642157a273e2b886222470bd247e5737b5`, reviewed parent
  `e721252075a30888198aafba0953a23fd07bd3c6`; actual skill and linked template /
  references read, with unchanged source copies retained from the original work.
- Current live Cuttlefish and Gecko are separately inspected in the cloud
  browser. Source findings are not substituted for browser observations. The
  original microsite conversation remains unavailable; no reconstruction.
- Artifact-first: ZIP, binary patch, PR body, identities and validation manifest
  must be delivered in chat before any publication attempt. Stop a publication
  path at approval/failure; no alternate-path retry. Draft only, no deployment.

## Compact gap / behavior / scene matrix

| Current gap | Authored behavior | Scene / control |
| --- | --- | --- |
| One local visitor; tiny travel area | Up to three persistent individuals climb real routes using their contact gait | Moonlit wall |
| Breathing without purpose | Scout inspects seams, hunter watches light, sentry pauses and checks shelter | Independent roles and seeded idle timing |
| Only guidance/startle | Notice → stalk → hold → strike or miss → return | Lantern hunt; movable moth cue |
| Uniform surprise | Nearby individuals curl/retreat, shelter, then approach again | Passing shadow; contextual shadow cue |
| No composition/director | Authored route arcs, role-specific timing and collision yielding | Scene, population, roles, tempo, boldness, reverse, route display |
| Limited explanation/export | Visible beat and individual motives; focus, text and scene settings | Semantic controls, focused mobile view, PNG/text/settings export |

## Animal and anatomy

Stylized dorsal pad-toed gecko. Preserve three anchors: broad wedge head,
four splayed limbs with five analytic toe pads each, long attached tapered tail.
Original sampler and joint geometry are reused; no marine or educational ray
renderer is copied. In-plane views only, no claim of frontal/profile 3D anatomy.

| Part | Parent / dimensions | Movement and readability |
| --- | --- | --- |
| Head/body | Existing body, head half-size .20×.155 | Contact-gated heading and translation; no scene-level dragging |
| Four limbs/toes | Existing .19/.25 joints and five pads per foot | At least three stance contacts; exact world pad/fan invariance |
| Tail | Existing pelvis attachment and tapered integrated curve | Smooth curious/focused/wary curl overlays; never detached |
| Environmental cues | Original procedural wall, moon, crack and moth cells | Low-contrast context; no external sprites, images or fonts |

The ensemble gets its own reviewed grid: default 224×144 across a 6.6×4.4 world,
maximum 256×168. Below 640 CSS pixels use a close view of the selected individual
at 112×72; the cast controls retain access to all members. Minimum director width
320 CSS pixels; existing solo minimum and grid limits remain unchanged. Ensemble
readability requires fresh evidence, not inherited acceptance of a smaller solo.

## References, rights and representation

The merged Cuttlefish source/live demo supplies the lesson: direction is a scored
scene with independent motives, not a bigger button panel. No geometry or code is
copied from it. Existing Gecko analytic geometry is the implementation reused.
New wall marks, routes, moon and insect cues are independently constructed.
Use printable ASCII (32–126 plus newlines), existing tone/material mapping and
system monospace fallbacks. No font binaries are bundled. Cell text is exported
with textContent, while Canvas pixels are not claimed selectable. The wall and
animal share one cell raster; UI labels are semantic HTML. DPR remains capped at2.

## Behavior script and input

| Phase | Entry / body action | Tail / contextual result | Exit |
| --- | --- | --- | --- |
| Idle/watch | Staggered seeded pauses and short nearby interests | Breathing, low curl, stable contacts | Role timer or cue |
| Route/explore | Authored seam waypoint, bounded turn/creep | Curious curl; one foot swings | Reach point or scene beat |
| Inspect/stalk | Light/moth cue; nearest or selected member owns interest | Head follows through gait, focused tail | Hold, strike if close, otherwise miss |
| Startle/retreat | Deliberate nearby shadow, per-member cooldown | Existing continuous curl/short retreat | Shelter then return |
| Return/settle | Resume route or shelter after cue expiry | Curl relaxes, independent pauses | Next scored beat/cycle |

Three scores: Moonlit wall (emerge/climb/inspect/perch), Lantern hunt
(notice/stalk/poise/strike/return), Passing shadow (peek/explore/shadow/shelter/return).
Route targets can change at a beat; body and contacts never teleport at a loop
boundary. A loop is continuing choreography, not a promise of identical first /
last pixels. Individuals keep stable IDs, seeds, static scale and model ownership.
Population 1–3 preserves survivors; scene changes restart only the score clock.

Pointer CSS coordinates map through the actual letterboxed/focused viewport.
Guidance belongs to the selected/nearest individual; the others keep motives.
Tap gives the same cue; no touch scroll cancellation. Native scene/cast controls,
arrow guidance, Space pause and labelled cue controls provide keyboard parity.
Each exact simulation tick consumes a validated ordered event batch (max32).
Browser queues coalesce guidance and the latest deliberate cue; selection is
bounded. Shadow reactions cannot be extended by repeated busy triggers.

## Reproducibility and typed API

60 integer ticks/second; default seed37. Director score time advances by finite
tempo per simulation tick, not by wall time. Same version/config/seed/ordered
inputs and updates produce identical state/cells under 1/2/5 render grouping;
no cross-font pixel promise. All new options/defaults/ranges and discriminated
states/results are typed. Default mounts remain the original solo. Director
is opt-in; update/reset/disposal and shared scheduler aliases keep their contracts.
An additive reset-only habitat allows real model movement over the wall. The
default habitat preserves the previous ±.26/±.13 domain exactly.

Use one existing host subscription, five-tick catch-up cap and dropped-time
telemetry. Reset clears scene/input clocks and restores seed/roles/poses while
retaining configuration and user pause. Snapshot import is unsupported; exported
scene settings restart a recipe and are not an arbitrary save-state/replay claim.

## Accessibility, lifecycle and budgets

Reduced motion and user pause keep static poses. Deliberate scene/cue actions
select an informative still without advancing simulation or overriding rest.
Status live region announces user actions only; beat/individual telemetry is not
live-announced per frame. Preserve hidden/offscreen/zero-size/bfcache causes,
listener/observer ownership, rollback, multiple instances and idempotent disposal.
Director disposal releases only its subscription, never the borrowed scheduler.

Hard limits: 3 animals; ≤36,864 animal samples/frame (actual baseline9,260 each);
≤43,008 cells; ≤4,096 environmental marks; ≤32 events/tick; no free particle pool;
Canvas ≤1000×780 logical and DPR≤2; at most5 ticks/callback. Browser target at
1000px/3 animals/default grid: p95 rendering/update work≤16.7ms after2s warmup,
30s collection. This is a predeclared target, not a measured pass. No device or
heap claim follows from source limits or mock cleanup.

## Acceptance / handoff

All director gates initially UNRUN: native scene/close-view anchors; seeded
motion/attachments; role/scene diversity; contact invariance; invalid/rapid input;
deterministic grouping; lifecycle/SSR/shared scheduler; positive/negative type
fixtures; current consumers and generated-demo regression; real keyboard/touch /
reduced motion; measured performance/heap. Record actual evidence and remaining
gaps in the director review, including one bounded independent critique/repair.
Preserve old evidence as historical. Source hashes, exact test commands/versions,
new captures and publication boundary belong in the final validation manifest.

## Implementation-pinned defaults and final base

The completed pre-code brief above is retained. The final branch base is
`c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`, a README-only main update from the
original inspected release. Runtime contracts were unchanged.

Implemented score tick durations: wall 120/480/180/480/180; hunt
150/540/120/90/420; shadow 180/420/120/180/420/120. Roles default to
scout/hunter/sentry; population3; seed37; tempo1 (.4–1.6); boldness.55 (0–1);
reverse/routes false; autonomy true. A pointer interest lasts180+round(180×boldness)
ticks. A manual moth lasts480 ticks; an unsuccessful hunt releases into a bounded
900-tick return. A real catch holds its planted strike24 ticks. Shadow display
lasts150 ticks, and contact-model cooldown cannot be restarted by busy cues.
Default selection is Mica; null chooses nearest, with stable cast order for ties.
Close view renders only the selected member, while the whole cast continues
simulating. These implemented details are covered by fresh evidence and tests.
