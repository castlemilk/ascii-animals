# Sea turtle reef-director authoring and review record

## Scope and custody

- Task: improve the current integrated sea turtle, with authored scene arcs,
  bounded ensembles, motives, contextual input/recovery and accessible controls.
- Initially inspected release/main: `castlemilk/ascii-animals`
  `c06114404900884814bef879a02f1a49a3e7d590`.
- Final patch base: `c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`; main advanced
  during the task with README-only PR #21. Its integration is retained unchanged.
- New isolated branch: `feat/director-turtle`.
- Allowed publication: reviewed species-local changes and a draft PR only, after
  a downloadable source ZIP, binary patch, hashes, PR body and validation manifest.
- Source: `src/public/turtle.ts`; demo sources: `species/turtle/demo`; generated
  output: `dist/turtle`; tests and docs use turtle-only paths.
- The turtle is not in `src/species` on this base. Shared marine source
  `src/animals/cuttlefish.js`, core/scheduler, exports, registry, catalogue, other
  species and shared build scripts are untouched.
- The inaccessible original conversation was not recovered or reconstructed.
  This work extends the newly authored turtle already integrated on main.

## Inspected current baseline

Both live demos and their downloaded assets match current-main files exactly.
This is HTTP/source verification, not a live rendered-browser observation.

| Source | SHA-256 |
| --- | --- |
| `dist/cuttlefish-demo.html` | `1616f654d1bf06ed17bb9cdaa5c1d950904121896a5d7a2ffc3e1336dbbf4918` |
| `dist/app.js` | `ca670894193c1d51d53676031dae6281b337b524c725a3c401bb5dd2015168bc` |
| `dist/artwork.js` | `1da1dd3a479394c7cc2586f97a725087e4f797eab9d20e4d781917dbdbf82e4b` |
| Original `src/public/turtle.ts` | `86ea6025fc8904137e28418237787b1c4b9a17f4ae0b70d88224a2fa24954e27` |
| Live/base `dist/turtle/index.html` | `21b63a7a02b4fcbbdad90f510e1136ec0dc6ff182de10c8340252ebc59c5beab` |
| Live/base turtle runtime | `a0d45aab8f9d2dbed303311ba331e43819acf4f6b4517fcc4f92206d7fd82dfd` |

Source links below identify the immutable baseline independently.

[API map](https://github.com/castlemilk/ascii-animals/blob/c06114404900884814bef879a02f1a49a3e7d590/docs/ANIMAL-APIS.md),
[turtle source](https://github.com/castlemilk/ascii-animals/blob/c06114404900884814bef879a02f1a49a3e7d590/src/public/turtle.ts),
[cuttlefish demo](https://github.com/castlemilk/ascii-animals/blob/c06114404900884814bef879a02f1a49a3e7d590/dist/cuttlefish-demo.html),
[cuttlefish controls](https://github.com/castlemilk/ascii-animals/blob/c06114404900884814bef879a02f1a49a3e7d590/dist/app.js).

## Gap / behavior / scene matrix, written before implementation

| Baseline gap | Chosen behavior/composition | Scene |
| --- | --- | --- |
| One centered turtle, slight sway | Up to five stable travelers; distinct near/far lanes; size, depth, names and roles | Reef passage |
| No arrival/linger/departure | Staggered entry, readable middle composition, bank and outgoing path; loop, once or hold | All directed scenes |
| One repeated gesture | Inspect a point, bank with asymmetric flippers, recover to continuing route; only selected/visible owner responds | All directed scenes |
| Uniform idle personality | Navigator strokes, forager inspections, long drifter coasts, lookout rises, explorer variation | Seagrass stop / reef |
| No spacious solitary route | Longer glide duty, open-water scenery, optional one traveler | Blue drift |
| No scene/role editor | Presets, act selection, route, current, water depth, spacing, individual motive/size/interest | Director demo |
| Frozen poster lacked scene intent | Deliberate still tableaux and inspection; paused option edits redraw without ticking | Reduced motion / pause |

The cuttlefish comparison covered 1–12 population, five formations, stable roles,
size/reverse, depth/ownership, staged arrival/linger/departure, ASCII/points,
curiosity/disturbance/ink, PNG and standalone exports. Current source exposes an
explicit stepping API for recording hosts; no live video-recording UI was found.
Its current-like movement/scenery is not a separately named current-strength UI.
No claim of inspecting a recording feature that the source did not expose is made.

## Anatomy, representation and rights

This is a stylized three-quarter dorsal sea turtle. Recognition anchors are the
oval domed/scuted shell, projecting beaked head, and four tapered flippers plus a
small tail. Streamlining folds flippers, not the head into the shell. This work
reuses the repository's integrated procedural geometry, with independently
written direction, choreography, scenery and UI. No online ASCII picture, photo,
model, font binary or generated concept image was copied into it.

| Part | Attachment / local geometry | Motion and occlusion |
| --- | --- | --- |
| Shell | Ellipse, radii .96 × .67; margin and scute lines | Preserved volume; whole-body tilt; drawn over flipper roots |
| Head / neck | Front at local x < -.71; head ellipse centered -1.23 | Projects during every gesture; eye/beak remain attached |
| Fore flippers | Paired front shell roots | Power/recovery/coast; asymmetric stroke amplitude and bank |
| Rear flippers | Paired rear shell roots | Smaller counter-motion; remain beneath shell |
| Tail | Rear shell root to x 1.36 | Short, attached, bounded |

Representation: printable ASCII logical cells plus Canvas glyphs. The tone ramp
is `.,:;+=*#%@`; scenery uses `.`, `:`, `/`, `|`, `_`, and `+`. Validated ASCII
labels are optional. Empty cells are spaces and text has equal-width rows.
Projection uses a .56 cell-width-to-height ratio; the demo uses aspect ratio 1.4.
Font requests remain system monospace families; no font asset is bundled.
Pixel appearance depends on the actual fallback, recorded by the render evidence.

The supported grid minimum is 80×32; the demo initially chooses 100×40 on narrow
screens and 160×64 otherwise. All four flippers, shell and head must remain
recognizable in the native evidence. This is not biological-validation evidence.

## Motion and input specification

The original study keeps its idle/inspect/streamline/settle behavior and API.
The director adds its own independent arrival/linger/departure scene state.

| Phase | Trigger | Root / local motion | Exit |
| --- | --- | --- | --- |
| Arrival | Scene/reset or explicit act | Staggered offstage origins; depth approaches assigned lanes | Configured arrival seconds |
| Linger | Arrival finishes | Role-specific coasts, strokes, short excursions, lookout rises or inspections | Configured linger seconds, unless hold |
| Departure | Linger finishes | Staggered outgoing route, banking and deeper perspective | Configured departure seconds |
| Inspection | Owned glyph / selected invitation | Bounded point of interest, head-down tilt, braking motion | 90 raw ticks |
| Bank | Following inspection | Asymmetric folded flippers and modest tilt | 70 raw ticks |
| Recover | Following bank | Smooth return to continuing route | 120 raw ticks, then 60-tick cooldown |

Current produces coherent signed route drift; assistance relative to facing
lengthens glide duty and reduces stroke effort. This is an artistic control,
not a physical simulation. Count is capped at five. No imitation of cuttlefish
ink, school/flee rules, or a compulsory 12-animal population is included.

Hover guidance coalesces and affects only the nearby selected member. Touch down
normalizes its own CSS-rectangle coordinates and uses the last rendered visible
owner. Empty-water input creates an explicit inspection point for selection.
Canvas-focused arrows/Enter/Escape provide keyboard equivalence; Tab and modified
keys are untouched. Pointer cancel/leave/lost capture clear transient hover,
while deliberate markers persist until Clear. There is no unbounded event queue.

Clock and frame details, all validated ranges/defaults, identity preservation,
configuration/reset/disposal contracts, and reduced-motion behavior are in
[the Turtle API](../../docs/TURTLE-API.md).

## Budgets fixed for this implementation

- 1–5 travelers, one frame and one Canvas, at most 16,200 logical cells.
- 5 sparse individual override records; one pending pointer guide; no invitation
  queue or particle pool. All geometry loops depend on bounded options.
- Pure advance: 0–600 integer ticks per call. Browser: at most 6 catch-up ticks.
- Existing logical/backing caps retained: 2048 per logical axis, DPR at most 2,
  at most 4096×4096 backing pixels.
- Shared scheduler subscription only; none while paused, reduced, hidden,
  offscreen, zero-sized, complete in once mode, or disposed.
- No new package runtime dependency, shared engine contract, registry entry or
  catalogue rewrite. Test-only native Canvas is optional and external.

These bounds are source constraints, not measured desktop/mobile frame rates.

## Verification and critique record

The original 10 turtle tests remain unchanged. New director tests cover atomic
nested validation, immutable snapshots, stable IDs, preset differences, tick
replay, reset equality, loop continuity, motive diversity, reaction/cooldown,
finite max-count cells, CSS-coordinate ownership, input storms, pointer
cancellation, scoped keys, still-mode editing, borrowed scheduler ownership,
partial construction rollback, SSR and root-export agreement. Separate strict
positive/negative type fixtures cover new and existing consumers.

Independent review found and corrected sparse-array validation poisoning,
unchanged paused composition, stale hover after cancellation, and floating-point
reset residue. Actual native captures revealed overlapping silhouettes during
inspection; a bounded excursion corridor now preserves the authored separation.
The full-resolution follow-up shows each traveler remains readable during that
response and recovery. The original solo study also matches the captured base
logical text and native PNG at seed 7, tick 120, grid 120×50; this is a specific
parity fixture, not a cross-font or universal pixel guarantee.

The evidence script uses the actual compiled controller with real native Canvas
and a mocked document/scheduler host. It rejects stale compiled source. Captures
cover base/new solo, actual arrival ticks, linger, departure, seagrass inspection,
solitary blue drift, inspection/bank/recovery, 390px native output, five travelers,
and reduced motion. A normal-speed sampled GIF records ticks from the same
controller. Its encoding rate is not an achieved-browser-FPS measurement.

### Remaining gates

A local Chromium launch was attempted and failed with `socket() failed:
Operation not permitted`. No settings, credentials or approval policy were
changed. Browser focus/keyboard dispatch, CSS reflow, real phone touch scrolling,
assistive technology, cross-browser appearance, sustained performance and heap
behavior remain unverified. Native renders are not screenshots of the page UI.
The small Canvas names are secondary to the HTML roster at narrow widths.

The chat's validation manifest records exact base/head hashes, actual commands,
results, source/output hashes and remaining gates. It and the source ZIP, binary
patch, PR body, contact sheet and motion preview are exported before publication.
No merge, deployment or npm publication is part of this work.
