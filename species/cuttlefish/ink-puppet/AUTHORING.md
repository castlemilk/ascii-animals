# Cuttlefish Ink Puppet — authoring record

**Written as the design brief before prototype implementation.** Updated results
belong in a separate final review record, so proposed requirements remain
distinguishable from executed verification. Date: 21 November 2026,
Australia/Melbourne.

**Final implementation status:** see [REVIEW.md](./REVIEW.md). The pending entries
below intentionally preserve the pre-implementation brief; the final review
separately records executed checks and remaining browser acceptance.

This follows the existing
[generate-reactive-ascii-animals workflow](https://github.com/skunkworq/skunkworq-skills/tree/main/generate-reactive-ascii-animals),
including its authoring template and anatomy/glyph guidance. The existing
workflow was read rather than replaced with a guessed API.

## Scope and custody

| Field | Record |
| --- | --- |
| Goal | An expressive, recognisable cartoon Cuttlefish in readable ASCII, with two input-dependent moments and a complete settling phase. |
| Audience | The user's local design and integration review; phone and desktop. |
| Allowed work | Isolated Cuttlefish prototype, editable concepts, evidence and reviewable patch. |
| Held actions | No remote write, merge, publication or deployment. Integration remains coordinated by the user. |
| Repository | `https://github.com/castlemilk/ascii-animals` |
| Base branch/commit | `main` at `f63b20e2045b1070b10bde2efc4eb3a8536e606b` |
| Canonical source | `src/animals/cuttlefish.js` |
| Canonical SHA-256 | `de394dc99c7d6455b9bc7fd942a810372a3c22fe65fc739ef7cd1dc672c1f8fe` |
| Allowed paths | `species/cuttlefish/ink-puppet/` only |
| Originals preserved | Canonical marine renderer, existing authored study, gallery, classic full-lens encounter, current independent patrol, other species and public exports. |
| Deployment identity | Live gallery URL is supplied, but its deployed revision must be established by the final browser evidence. A Git commit alone is not a deployment receipt. |
| Conversation basis | Current user request and parent task; no claim to have recovered private historical conversations. |
| API status | Existing public marine APIs remain unchanged. Any Ink Puppet API is local and provisional, not a new published package subpath. |

## Animal and anatomy

**Name:** Inquisitive Ink Puppet. An independently authored, stylized 2D ASCII
Cuttlefish inspired by biological anatomy; not a measured model of a specific
animal.

Three recognition anchors:

1. Broad, flattened rounded mantle with a thin continuous fin skirt.
2. Substantial head continuing from the shoulder, carrying a recessed lateral
   eye with a W-shaped aperture when the cell count supports it.
3. Connected crown of eight primary arms, composed into readable overlapping
   bundles. Two feeding tentacles are distinct and normally concealed.

Review at 390 CSS pixels wide and at a 320-pixel stress width. Record the actual
logical grid for each capture in the final evidence receipt. Supported views are
profile, reverse profile and a stylized shallow turning/foreshortened pose. A
fully anatomical three-dimensional front view is not claimed by this 2D design.

| Part | Parent attachment | Shape/proportion intent | Motion limits and occlusion |
| --- | --- | --- | --- |
| Mantle | Whole-body root | Broad rounded flattened primary mass | Small squash for anticipation; keep a stable readable body volume. |
| Fin skirt | Mantle edge | One thin ribbon following mantle contour | Low-amplitude travelling wave; contracts during jet and reopens during settling. |
| Head/shoulder | Anterior mantle | Full continuation into crown | Never narrows into a detached neck or transverse cap. |
| Eye | Lateral head tissue | Flush perimeter and dark recessed aperture | No bulging sphere/stalk; far side occludes; W simplifies to slit at small scale. |
| Eight primary arms | Shared anterior crown | Overlapping bundles with open directional tips | Roots stay connected each frame; controlled asymmetric tip lag; bounded stretch. |
| Two feeding tentacles | Inside anterior arm crown | Concealed until authored reach | A response may reveal them; retract before settling finishes. |
| Ink glyphs | Local release point near the animal | Small bounded punctuation | Delayed until after anticipation; finite lifetime and no unbounded trail. |

Artistic exaggerations are the broad shape, compact bundles, limited palette,
graphic pigment bands and pose timing. No human mouth, eyebrows or floating eye
icons are added.

## Reference and rights ledger

References were consulted for anatomical facts and direction, not copied as
assets. Linked pages remain under their owners' terms; a source citation is not
permission to redistribute its photography.

| Source | Observation learned | Permission/copy status |
| --- | --- | --- |
| [Monterey Bay Aquarium, common cuttlefish](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/common-cuttlefish) | Rippling lateral mantle fin, skin pattern changes and defensive ink. | Research reference; no photograph, text passage or geometry copied. |
| [Monterey Bay Aquarium, broadclub cuttlefish](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/broadclub-cuttlefish) | Eight arms plus two feeding tentacles. | Part inventory only; species proportions are not transferred or claimed. |
| [Mäthger et al., 2013](https://pubmed.ncbi.nlm.nih.gov/23474299/) | W-shaped light-adapted horizontal pupil in common cuttlefish. | Research fact; no figure or source geometry copied. |
| [WHOI, Sensitive Creature](https://www.whoi.edu/ocean-learning-hub/multimedia/sensitive-creature/) | Jet propulsion and W pupils. | Research reference only. |
| Existing source at pinned commit | Canonical eye, crown, lens and patrol invariants; public contract. | Retained unchanged; prototype does not redistribute a copied substitute for shared source. |
| Original ImageGen A/B concept boards | Alternative shape language, face placement and staged keys. | Concept exploration, not runtime art or interaction evidence. Exact prompts/board references must accompany final handoff. |

No font binary is bundled by this brief. The implementation should use an
available monospace stack and report the actual browser/font environment for
pixel evidence. Pixel identity across fallback fonts is not promised.

## Representation and renderer plan

- A pure model produces a bounded logical cell composition. Canvas draws the
  resulting **printable ASCII characters**, not a raster cuttlefish asset.
- Character output must remain U+0020 through U+007E plus newline row separators
  if text export is provided. No Unicode shading blocks, emoji or ANSI escapes
  are required for recognition.
- Use fewer characters with distinct jobs: contour, mass, fin edge, skin mark,
  eye aperture and sparse habitat. Record the final exact repertoire in the
  review manifest; do not introduce a noisy luminance ramp by default.
- Correct cell aspect in projection/layout. Do not distort the head to compensate
  for a font change. Record cell width/height and baseline after implementation.
- A deep blue solid background and canvas compositing are presentation. Animal,
  ink and habitat marks should stay character-rendered. Identify any nonglyph
  decorative effect explicitly if one is later introduced.
- Geometry and pigment placement are original procedural construction. Generated
  concept boards are never used as an image mask or a hidden sprite.
- A text representation is only advertised if actually implemented and tested.
  Canvas characters alone are not selectable terminal output.

## Behavior and input contract

The exact authored timings below are intentionally left to the implementation's
versioned constants; the phase ordering and outcome requirements are fixed by
this brief. Final review must report actual ticks and frame evidence, not infer
them from a storyboard.

| State/phase | Trigger | Body path/heading | Appendages/effects | Exit |
| --- | --- | --- | --- | --- |
| Quiet swim | Start, restart or completed recovery | Bounded continuous travel within the observation area | Gentle fin wave, small arm-tip phase offsets, calm pigment pattern | Explicit accepted cue |
| Shrimp anticipation | Place/invite at normalized target | Aim toward target with visible counterlean before translation | Front bundle opens, broad pigment band signals attention | Authored anticipation interval |
| Shrimp approach | Accepted investigation sequence | Bounded route toward target and standoff | Eye orientation stays attached; fins guide movement | Reach/standoff point |
| Shrimp response | Target-relative arrival | Brief hold or bounded reach | Optional reveal of two feeding tentacles; outcome depends on target | Response interval |
| Shrimp settling | Response completes | Ease into swimming envelope | Tentacles retract, arms regroup, skin contrast settles | Return to quiet swim |
| Jet anticipation | Deliberate disturbance cue | Contract and establish escape direction away from target | Arms gather and fin skirt tightens | Preparation completed |
| Soft jet | Prepared disturbance | Mantle-first bounded translation away from target | Arms stream; brief local ink after preparation | Escape distance/time bound |
| Jet settling | Escape completes | Decelerate and return smoothly | Ink expires, fins reopen, pigment resets | Return to quiet swim |

Required input properties:

- Normalize pointer/touch positions against the visible canvas CSS rectangle.
  Validate finite coordinates before stepping or allocating.
- Left/right target changes must produce left/right differences in approach and
  escape. Near/far inputs must affect reach/standoff rather than only the marker.
- Use semantic buttons and equivalent keyboard actions. Arrow keys move the
  point of interest; the displayed help must match actual implemented shortcuts.
- Ordinary pointer movement must not repeatedly emit ink. Disturbance is an
  intentional action.
- Coalesce high-frequency pointer motion. Keep at most one active sequence and
  a bounded target/cue policy. Document whether competing actions are rejected
  or deferred; do not silently restart every frame.
- Pointer leave/cancel/lost capture clears transient interest. Settling continues
  deterministically after a valid action unless the user pauses it.
- Pause, reduced motion and disposal take precedence over input. Inputs must not
  implicitly restart the animation clock.
- This prototype is solo. A new school/formation system is outside scope.

## Reproducibility and clocks

The implementation plan is a pure **60 Hz integer-tick model**, a logical cell
renderer, and a browser adapter using the repository's shared per-window
scheduler. Rendering does not advance the model. The model uses an explicit seed,
ordered normalized inputs and versioned options; no ambient `Math.random`, DOM
reads, wall clock or font metrics belong in species logic.

Replay guarantee to test: same implementation/runtime, seed, initial options,
ordered input log and ticks produce the same state and cell output. Different
presentation groupings must not alter model state. Exact pixels remain dependent
on font, browser and device environment.

Bound each presentation catch-up to **six model ticks**. Discard/report excess
elapsed wall time and reset the wall-clock origin when resuming; do not replay a
large hidden-tab backlog. Preserve explicit pause across restart and option
changes. State serialization is unsupported unless an explicit implementation
and test are included in the final package.

## Accessibility and lifecycle

Provide a meaningful initial still showing mantle, connected crown and lateral
eye, with a concise image description and controls outside the frame. Do not
announce every glyph or animation frame. Announce accepted/rejected actions and
major completion states through a restrained status region.

Reduced motion begins with a static composition. Deliberate action selection may
compose an informative still, but must not start continuous motion. A live change
to the reduced-motion preference pauses the scene. Turning the preference off
must not override an explicit user pause.

All work owned by the prototype—including status polling, observers and render
subscriptions—must stop or become event-driven when hidden/offscreen. A zero-size
host holds state without projecting invalid coordinates or allocating full
buffers. Resume resets wall time. Destroy is idempotent and removes all owned
listeners, observers, timers and subscriptions. Repeated and multiple mounts must
remain independent. A partially failed mount must clean up acquired resources.

## Budgets and acceptance plan

Predeclared scope: **one animal**, one active action, coalesced pointer target,
60 Hz logical ticks, maximum six catch-up ticks per presentation frame. No
continuous work while hidden, offscreen, paused or zero-size.

Exact maximum cells, ink particles, canvas pixels and DPR must be written from
the implementation's chosen caps **before** performance verification. They are
not supplied by this brief, and this document makes no achieved-FPS claim.
Benchmark hardware, browser, viewport, duration and rendering quality must be
reported alongside measurements. A source cap is not a measured performance
result.

| Gate | Fixed scenario | Pass condition | Status at brief creation |
| --- | --- | --- | --- |
| Recognition | Neutral one-tone side/turn views at 390px and 320px widths | Mantle, connected head/arm crown and lateral eye remain readable without the species caption | Pending prototype |
| Face | Normal/alert/turn views at actual phone size | Eye remains inside tissue; no bulge; W or intentional small-scale slit is distinguishable | Pending prototype |
| Investigation | Equal seed, opposite-side and near/far targets | Different direction/reach; anticipation precedes response; complete settling | Pending prototype |
| Soft jet | Equal seed, opposite disturbance points | Escape goes away from input; delayed finite ink; animal remains within its bounded envelope | Pending prototype |
| Replay | Same tick log rendered in 1/2/5/6-tick groups | Exact same-runtime state and cells | Pending prototype |
| Input | Invalid coordinates, repeated cues, cancel/leave, keyboard and touch | Bounded deterministic policy, valid target handling, no accidental resume | Pending prototype |
| Lifecycle | Pause, live reduced-motion change, hidden/offscreen, zero-size, destroy | No owned recurring work in rest states; clean idempotent teardown | Pending prototype |
| Browser | Normal-speed desktop/phone recordings, real keyboard/touch path | No runtime errors; controls match documentation; no crop or action-phase gaps | Pending prototype |
| Baseline preservation | Hashes, classic lens and small-swimmer tests | Canonical source unchanged and existing gates retained | Existing baseline checks below; rerun after patch |
| Packaging | Exact-base patch application in a clean copy | Only species-local files change; reproduction instructions work | Pending final handoff |

## Baseline checks actually run before implementation

The read-only source audit ran these existing checks at the pinned baseline:

| Test file | Result | Evidence class |
| --- | ---: | --- |
| `test/cuttlefish-study-director.test.mjs` | 7 passed | Pure model assertions |
| `test/cuttlefish-study-adapter.test.mjs` | 12 passed | Real model/projection/cells with simulated DOM/Canvas sink |
| `test/cuttlefish-encounter-framing.test.mjs` | 4 passed | Canonical lens footprint/cell assertions with simulated DOM |
| `test/independent-swimby.test.mjs` | 2 passed | Canonical patrol/visibility assertions with simulated DOM |

**Total: 25 passing baseline tests.** These do not verify the proposed puppet,
fresh browser appearance, real touch input or frame rate. The study adapter check
compared 124,503 raw primary-arm samples in its core matrix plus its threshold
case, and checked deterministic replay across 1/2/5/6-tick render groups. No new
prototype test is claimed here.

## Final evidence and handoff checklist

The integration owner must complete the final review with:

- Actual implementation paths and API signatures; exact patch base and source
  hashes; a changed-path list showing species-only scope.
- Exact concept prompts and references for the two previously shown boards.
- Matched original/prototype desktop and phone captures with seed, viewport,
  canvas size, time/tick and input log. If the models differ, say so; do not call
  them pixel-identical poses.
- Normal-speed motion showing anticipation, response, settling and quiet tail
  for both moments. State recording frame rate separately from simulation rate.
- Clear labels for **live browser**, **local browser**, **native Canvas render**
  and **generated concept board**. None substitutes for the others.
- Commands actually executed, runtime versions, exit codes and failed/unrun
  checks. Do not reuse historical documentation's totals as new results.
- One independent visual/code critique and the changes made in response.
- Remaining acceptance risks, especially phone eye resolution, bundled-arm
  readability, browser interaction and performance.
- A reviewable patch and reproduction steps. No release, merge, publication or
  deployment claim.

The classic full-lens encounter and small-scale swimming remain preserved in
their original renderer. This isolated 2D puppet is not a drop-in claim of exact
canonical lens, projection, multi-animal or public API behavior. Any later
integration must state and test that additional scope explicitly.
