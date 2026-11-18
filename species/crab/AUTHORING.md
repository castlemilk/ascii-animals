# Crab — tidepool theatre authoring notes

## Provenance and scope

This work was inspected and started from the integrated repository's actual `main` at
`c06114404900884814bef879a02f1a49a3e7d590`, using a new
`feat/director-crab` branch. The final patch is based on the rechecked `main`
`c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`; the intervening update changes only
README. The crab on the inspected base was newly authored after the
earlier conversation became inaccessible. This revision extends the integrated
implementation; no unavailable source or conversation is claimed as recovered.

Canonical source is [`src/public/crab.ts`](../../src/public/crab.ts), demo source
is in [`demo/`](demo/), generated output is in `dist/crab/`, and species tests are
in `test/crab*.test.mjs` and `species/crab/tests/`. See the
[typed API guide](../../docs/CRAB-API.md). The existing build seam compiles and
copies the crab public module. Marine source, other animals, shared core,
registry, package exports and catalogue are outside this branch's scope.

The inherited original geometry has a broad carapace, paired jointed chelipeds
with separated fingers, eye stalks and four walking legs per side. Its lifecycle
scaffolding followed this repository's seahorse implementation. The director
adds an authored world, resident motives, world-space foot contacts and theatre
rendering while borrowing the existing shared scheduler. This is a stylized
study, not biological simulation. No external imagery or bundled fonts are used.

## Baseline comparison and behavior matrix

The author inspected the live
[cuttlefish](https://castlemilk.github.io/ascii-animals/cuttlefish-demo.html),
[integrated crab](https://castlemilk.github.io/ascii-animals/crab/) and current
sources. Cuttlefish's strength is compositional direction: scenes, population,
individual roles, paths/formations, arrival/linger/depart arcs, current, pointer
response and render/export options. The old crab offered one centered animal,
three behaviors, a fixed alert response and a text snapshot.

| Baseline gap | Crab-specific implementation | Scene / observable result |
|---|---|---|
| One crab on an empty field | 1–5 residents with homes, patches, names, sizes and roles | Three in the demo; five-resident density fixture |
| Small sinusoidal motion | Destination-directed lateral scuttle with stance/swing legs | Emerge, work a patch, return; planted feet stay in world space |
| One fixed response | Curious inspection, shy retreat, territorial display, bounded cues | The same guide produces distinct resident reactions |
| No scene arc | Three four-chapter scenes | Breakfast, claw council, returning wash |
| Uniform idle life | Different deterministic grooming, inspecting, sifting and rest offsets | Activity without a click |
| No environmental direction | Tide reaches shore; signed current moves marks and biases retreat | Brace → retreat → hide/peek → staggered return |
| Generic controls | Chapter choice, hold/auto director, resident/role selection, timing/current/layout | Readable story and individual motives |
| One still pose | Explicit chapter and cue posters | Different compositions without starting playback |
| One text snapshot | View/copy ASCII, `.txt` and PNG snapshots | Bounded URL lifetime; no recorder in this revision |

### Scene scores

**Breakfast on the sand** (`forage`) moves from cover to individual sand
patches. Working claws sift, eyes investigate and grooming interrupts the
routine. A discovery becomes a staggered call before residents return to rocks.

**A show of hands** (`signals`) gathers the cast across terraces. A claw call
gets delayed, differently sized answers. The territorial resident holds its
patch in a challenge; the shy one seeks cover while curiosity inches closer.
The gathering then disperses.

**Here comes the water** (`tide`) begins with foraging, raises the waterline,
braces feet, seeks shelter, hides and peeks. Return is staggered by identity and
caution. Releasing a visitor or completing a cue restores the scene's motives.

Cues last 300 logical ticks, with at most one active cue and one pending reply
per resident. Repeated ordinary cues do not restart the same actor's active
action. Chapter selection clears cues/replies. Manual direction holds chapter
transitions while allowing internal progress and continuous small gestures.

## Anatomy and composition anchors

- **Broad low shell:** scalloped carapace and small plate texture stay central;
  the body should not read as a tall rounded insect.
- **Two distinct claws:** shoulder, elbow, palm and fingers articulate
  independently. A lowered working claw forages; a raised asymmetric claw
  signals. Chelipeds remain separate from the eight walking legs.
- **Paired eye stalks:** bounded gaze follows the guide without requiring whole
  body translation.
- **Four legs per side:** feet alternate contact and swing, preserving planted
  world coordinates while the body moves. Facing matches the corresponding leg
  sides. Geometry changes may reseat feet; color and labels do not.
- **Persistent shelters and patches:** rocks sit at world anchors, with covering
  surfaces while hiding. Labels sit below feet and do not own creature hits.
- **Readable ensemble:** three residents are the primary composition; four/five
  use bounded alternatives. A roughly 20-column silhouette floor preserves
  anatomy at minimum/dense grids, so smaller size values can saturate. Aspect
  fitting also caps height.

Rendering uses printable ASCII, visible layers and creature ownership. A click
resolves its displayed glyph before the guide marker is added. Covered anatomy,
rocks and labels are not invisible hitboxes. Brass uses sand, mint and copper
role colors; names and state descriptions carry the information without color.

## Compatibility and controls

`createCrabArtwork(canvas)` still creates the original study. Existing options,
phase values, model/browser methods, strict validation, SSR-safe imports,
immutable frames and shared scheduler ownership remain. New theatre activity
uses separate discriminated states, preserving notice/defend/settle. The demo
explicitly chooses `scene:'forage'`, `count:3`, a 140×56 grid, labels and four
seconds per chapter.

Proximity, targeted taps, labelled cues and canvas shortcuts offer overlapping
ways to act. `touch-action:pan-y` preserves scrolling; release/cancel clears
guidance. Controls expose actor, chapter, motive, role, formation, current,
chapter duration and footwork. Status uses controller subscriptions, not a
second animation clock. Pause/reset and user/system reduced-motion policy stay
authoritative. Still chapter/cue alternatives are deliberate compositions.

The demo implements a skip link, described focusable canvas, visible focus,
labelled controls, at least 44 CSS-pixel control heights, action-only polite
announcements and responsive CSS. Real browser and assistive-technology
acceptance remains required.

## Evidence, critique and remaining acceptance

**Automated behavior:** `test/crab-director.test.mjs` adds 22 tests to the 10
legacy crab tests. Coverage includes full recovery, manual stages, roles,
finite cue/reply lifetimes, replay, atomic configuration, immutability, actor
bounds/ownership, moving-foot contacts, input targeting, scheduler lifetime,
subscriptions, disposal and still alternatives. `tests/types.ts` checks old
consumers and positive/negative additive types. The coordinator's aggregate
`npm test` run passed 329 tests; `npm run typecheck` and the crab type fixture
passed. Exact final commands/results and repository hashes belong to the
delivered validation manifest.

Independent review corrected harmless options reseating feet, manual chapters
stalling internal retreat/return, guide overlays intercepting creature hits,
and failed initial subscriptions leaking callbacks. Regressions exercise all
four and the independent removal of duplicate callback subscriptions.

**Pixel evidence:** [`tests/render-evidence.mjs`](tests/render-evidence.mjs)
drives the actual adapter's Canvas2D output through `@napi-rs/canvas`, using a
mocked lifecycle window and installed DejaVu Sans Mono. It does not reimplement
the animal. Eight panels compare baseline, breakfast, council, challenge,
shelter, return, five-resident and minimum-grid compositions. A tide sequence
spans 16 logical seconds at 10 sampled frames per second; this is a sampling
choice, **not measured FPS**. The native manifest includes source/font hashes,
backend version, dimensions, options, state and logical frame hashes.

The contact sheet makes the ensemble/role differences visible. Claw and shelter
poses distinguish chapters, labels stay below walking feet, and the minimum-grid
floor preserves recognizable open claws and eye stalks. The pool deliberately
keeps negative space around its small cast. The lowest-density grid still loses
fine fingers/leg detail through character aliasing, and subtle water/shelter
contrast needs checking on actual displays. Native pixels do not establish DOM
usability.

**Browser boundary:** live baseline cuttlefish and crab were inspected through
browser interaction. The revised demo did not receive browser/DOM acceptance:
the cloud browser could not reach the local preview, while local Chromium failed
with `Operation not permitted` during socket creation. No permission bypass was
attempted. Native rendering does not establish responsive CSS, real touch/event
delivery, screen-reader behavior, downloads, BFCache restoration or device
performance.

Before release, inspect the revised demo in real desktop/touch browsers,
including 320–430 CSS-pixel widths, zoom/enlarged text, keyboard-only use,
reduced-motion changes, touch scrolling, exports, background/resume and repeated
mount/dispose. Check dense cast legibility using actual browser monospace fonts
and compare all chapters. FPS, memory, CPU/GPU behavior and WCAG conformance are
unmeasured. This is a review candidate, not a merge, deployment or npm release.
