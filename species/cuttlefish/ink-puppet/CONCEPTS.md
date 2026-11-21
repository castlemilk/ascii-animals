# Cuttlefish: two character directions

**Design record — 21 November 2026, Australia/Melbourne.** These are editable
concepts for a local, isolated prototype. They are not a description of a released
gallery update. ImageGen boards were used as visual exploration before choosing
Direction A; generated images are not executable ASCII, animation evidence or a
dependency of the proposed renderer.

## The problem in the inspected source

The current source baseline is
[`f63b20e2045b1070b10bde2efc4eb3a8536e606b`](https://github.com/castlemilk/ascii-animals/commit/f63b20e2045b1070b10bde2efc4eb3a8536e606b).
The gallery mounts the canonical marine renderer through its movement adapter,
with one reactive Cuttlefish at seed 7. The classic study and the separate authored
field study are different entry points. The latter is not the gallery's default
renderer. See the [gallery mounting code](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/demo/src/lib/renderers.ts)
and [API map](https://github.com/castlemilk/ascii-animals/blob/f63b20e2045b1070b10bde2efc4eb3a8536e606b/docs/ANIMAL-APIS.md).

The committed gallery still has a broad mantle and an identifiable arm direction,
but the lateral eye competes with similarly weighted body cells. The canonical
26-character luminance ramp, fine surface detail and glow spread visual emphasis
across the animal. The existing authored study reduces that detail and gives the
animal gentle investigation, turning and retreat sequences. Its investigation
still uses a small positional and angular excursion around almost the same hover.
This is a source and committed-asset critique; the final review must identify
separately which observations were reproduced in a live browser.

The new proposal starts with character acting: a clear silhouette, an intentional
point of attention, a readable anticipation pose, and a changed outcome caused by
the input. Surface detail follows those decisions.

## Direction A — Inquisitive Ink Puppet — selected

**Character:** a curious, slightly cautious visitor that notices a tiny moving
shrimp, gathers itself to inspect it, then decides how close to come. Its soft
jet retreat feels like a startled breath followed by a cautious return.

**Shape:** a broad, rounded, flattened mantle; one thin fin skirt; a substantial
connected shoulder and head; eight arms composed as a few overlapping, readable
bundles. Rounded shapes have directional tension. The forearms lean into a cue
while the mantle lags, making the line of action visible without adding a human
mouth or brow.

**Face:** one lateral eye dominates the profile view. The iris sits inside the
head contour. Its upper lid and dark W aperture carry attention through angle,
contrast and a restrained narrowing response. Turning away naturally reduces
eye visibility. The far eye never becomes a second frontal button. The W may
resolve into a simple dark slit when there are too few cells to show its troughs.

**Palette:** deep ink blue water, warm copper body, cream highlights and seafoam
fin accents. Reserve cream for the face, leading fin edge and a few skin marks.
Use a small number of broad pigment bands with generous quiet areas; change the
bands' coverage or contrast as part of a reaction. Do not add frame-random speckle.

**Habitat:** two low graphic sand contours and a few offset seagrass stems. The
empty observation area is part of the composition. Habitat stays behind the
animal and well below the contrast of the eye and arm tips.

**Motion keys:** quiet fin-led swimming → head/arms lean toward the shrimp while
the mantle counterleans → approach and tentacle response → arms gather → drift
settles. For retreat: small contraction and restrained skin change → mantle-first
jet away from the chosen disturbance → short fading ink punctuation → decelerate
and return to quiet swimming.

## Direction B — Tide Calligrapher — alternative

**Character:** a lean, alert shoreline performer whose body reads like a folded
leaf moving through a current. The same inquisitiveness is expressed by longer
negative spaces and angular staging rather than a rounded puppet mass.

**Shape:** a slender leaf mantle held on a diagonal S-curve; broad but spare fin
ribbons; head and shoulder continuing into long, staggered arm ribbons. Turns
show distinct profile, compressed foreshortening and reverse-profile silhouettes.

**Face:** a small recessed lateral W, set into a chalk-coloured head plane. The
eye remains anatomically attached; the face is more reserved and graphic than A.

**Palette:** navy, chalk and one vermilion signal accent. Large flat separations
replace volumetric shading. The vermilion is reserved for one moving pigment band
or a response key, not spread across every appendage.

**Habitat:** angular paper-theatre seaweed and a broken diagonal sand line. A few
long strokes establish depth. The animal's negative spaces remain open.

**Motion keys:** diagonal glide → hinge-like counterlean → ribbon arms trace a
sharp but eased inspection arc → broad shape compresses for a jet → a single
vermilion band releases as the body unfolds and settles.

## The directions differ in construction, not just colour

| Decision | A: Ink Puppet | B: Tide Calligrapher |
| --- | --- | --- |
| Primary mass | Broad rounded mantle, substantial shoulder | Lean leaf, tapered diagonal body |
| Line of action | Soft counterlean and compact curves | Extended diagonal S and hinged turns |
| Arm reading | Shorter overlapping bundles and open tips | Longer separated ribbons and cut-out gaps |
| Expression | Lateral-eye attention plus broad pigment bands | Plane changes, ribbon spacing and one signal band |
| Contrast | Copper mass, cream face, seafoam edge | Chalk silhouette on navy, vermilion punctuation |
| Habitat rhythm | Low horizontal contours, sparse curved stems | Broken diagonal stage, angular blades |
| Main risk at phone size | Broad mass could swallow the face | Long ribbons could fragment into stray glyphs |

## Selection

**Direction A is selected.** It best answers the requested inquisitive ink-puppet
character while giving the lateral eye, shoulder-to-arm connection and soft jet
a common visual language. Its compact masses should remain easier to read at
phone size. This is a design judgment to validate in actual glyph output, not a
claim established by the concept board.

Keep B as a genuinely different future option. Do not dilute A by adding B's
angular limbs or a second palette to the same creature.

## Two input-driven moments

Times below are authored staging targets, not measured biological timings.
Exact implemented ticks, timings and API names must be recorded in the final
review beside the tested code.

### 1. “What is that?” — investigate a shrimp

The pointer or a tap places a small shrimp in the water. Keyboard arrows place
the same target; a labelled button or the page's documented shortcut invites the
same investigation. Shrimp position must affect heading, approach side, reach
and final standoff. A cue near the animal and one far away must not produce an
identical canned pose with only the marker moved.

| Phase | Body and expression | Arms, skin and target | Readable outcome |
| --- | --- | --- | --- |
| Anticipation | Quiet swimming checks; head aims toward target; mantle counterleans | Front arm bundle opens; one broad skin band gathers contrast | Attention is visible before translation |
| Approach | Fin-led movement follows a bounded route toward the selected point | Eye remains embedded; primary arms stay attached | Left/right and near/far targets produce different routes |
| Response | Brief standoff and a deliberate inspection or feeding-tentacle reach | Two normally concealed feeding tentacles may become visible in the authored response | A reachable target can be contacted; a distant target receives a bounded attempt |
| Settling | Head and mantle return together to quiet swimming | Reach retracts, arms regroup, skin contrast softens | No snap, no indefinitely held strike and no missing animal |

If the implemented prototype does not distinguish reachable and unreachable
outcomes, describe its actual bounded investigation honestly rather than claiming
that it catches prey. Whether the fictional shrimp is consumed is an interaction
decision, not a biological claim.

### 2. “A little room, please.” — soft jet away from a disturbance

The chosen disturbance point is the cause of the movement. A labelled disturbance
control, keyboard equivalent and deliberate touch action use the same normalized
target. Ordinary hover should invite attention rather than repeatedly startling
the animal.

| Phase | Body and expression | Arms, skin and ink | Readable outcome |
| --- | --- | --- | --- |
| Anticipation | Mantle compresses slightly; body aims away while retaining its shoulder line | Arms gather, fin skirt tightens, broad bands change contrast | A warning pose precedes any jet |
| Response | Mantle-first movement goes away from the selected point | Arms stream behind; a short local ink punctuation begins after preparation | Moving the target to the opposite side reverses the escape direction |
| Deceleration | Translation eases within the observation area | Ink disperses and expires; fins resume gentle motion | The animal remains reviewable rather than spending the sequence offscreen |
| Settling | Body eases into its swimming envelope | Arms relax and pigment bands return to a calm pattern | No position jump, abrupt heading flip or leftover particle accumulation |

Inputs during an action must follow one documented policy. Prefer a bounded,
noninterrupting action with a coalesced next target over an unbounded event queue.
Pause and reduced motion always win over autoplay.

## Phone acceptance

- Review at **390 CSS pixels** wide, with **320 pixels** as a stress case. Inspect
  at 100% display scale, not only an enlarged crop.
- Read the flattened mantle, continuous shoulder and attached arm crown in a
  single tone before judging colour or effects.
- A lateral eye needs a distinct dark aperture surrounded by head tissue. When
  there are insufficient cells for the W, simplify the aperture; do not enlarge
  or protrude the eye to preserve a literal W.
- Keep arm bundles separate at their tips while preserving the common crown.
  Occluded arms may be hidden; do not make eight detached hooks merely to count
  them in every frame.
- During anticipation, response and settling, the animal remains the highest
  contrast object. Ink and habitat never erase the face for an entire phase.
- Compare normal-speed motion, not just attractive keyframes. Reject pops,
  flickering glyph density, prolonged offscreen travel and unreadable targets.

## Biological references and artistic boundary

| Source | Fact used | Authored interpretation |
| --- | --- | --- |
| [Monterey Bay Aquarium — common cuttlefish](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/common-cuttlefish) | A rippling lateral fin follows the mantle; cuttlefish alter skin patterns and use ink defensively. | Graphic fin ribbon, four-colour palette, emotion-like band choreography and habitat staging. |
| [Monterey Bay Aquarium — broadclub cuttlefish](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/broadclub-cuttlefish) | Eight arms and two feeding tentacles distinguish the part inventory. | Bundled primary-arm silhouettes and an intentionally simplified shrimp interaction. |
| [Mäthger et al. — W-shaped pupil study, 2013](https://pubmed.ncbi.nlm.nih.gov/23474299/) | The light-adapted common-cuttlefish pupil has a W-shaped horizontal aperture. | A deliberately legible lateral aperture inside a stylized head; graphic compression at small cell sizes. |
| [Woods Hole Oceanographic Institution — Sensitive Creature](https://www.whoi.edu/ocean-learning-hub/multimedia/sensitive-creature/) | Cuttlefish swim by jet propulsion and have W-shaped pupils. | Bounded soft retreat, timing, input semantics and return to the observer's frame. |

Reference facts inform original shapes. No source photograph, diagram, ASCII
drawing, font binary or animal mesh is copied into the renderer. Generated boards
are concept references only. The final review should retain their exact prompts
and original image references separately; this document does not reconstruct
prompts that it has not read.

## Preserved baseline and proposal boundary

The approved classic full-lens encounter and current small-scale independent
swimming stay intact in the canonical renderer. This prototype is a new,
intentionally stylized **2D ASCII interpretation**. It does not inherit or claim
pixel-equivalent canonical lens behavior merely because both depict Cuttlefish.
Any future replacement of the gallery renderer needs a separate integration
decision and explicit verification of those modes.

All proposed code, documentation and local review assets belong under
`species/cuttlefish/ink-puppet/`. No other species, public package exports,
shared navigation or deployed files are changed by this concept scope. No remote
write, merge, publication or deployment is authorized.
