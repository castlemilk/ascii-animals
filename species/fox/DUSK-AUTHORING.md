# Fox — dusk, weight and attention

## Scope and custody

Fox-only review from `b8f222dab868821f27bf2a64a98434f3483fc8e6`, verified as
`castlemilk/ascii-animals` main on 19 November 2026. The implementation, tests,
demo and evidence scripts live under `species/fox/`. Shared engines, public
entry points, generated distribution files and workflows are centrally owned.
This branch is for a PR and independent patch; merging/deployment is not part
of this work. The requested reactive-animal skill and its authoring, portable
contract, accessibility and validation references were read before editing.

## Animal and representation

An original, stylized side-profile **red fox (Vulpes vulpes)**. Recognition
anchors: two separate pointed ears above a narrow wedge muzzle; slender legs
with dark stockings; a long, low-carried brush with a pale tapered tip. Left
and right profiles are supported. Full frontal views and continuous yaw are
not supported. Two-dimensional head pitch stands in for a lateral head cock.

The coat has a dark dorsal plane, warm flank, pale throat and subdued underfur.
Broad attached patches describe volume first; short directional glyph strokes
describe guard hairs second. Fur is deterministic and attached to the sampled
geometry rather than regenerated as screen-space noise. Small grids simplify
the texture while retaining ear separation, one eye, one nose and paw contact.

The rendering remains a printable ASCII cell grid painted by Canvas; it is
also available as text. No reference photograph, online ASCII drawing, model,
font binary or image-generated concept is part of the implementation.

| Part | Attachment | Motion and readability |
| --- | --- | --- |
| Torso and coat planes | Scene root | Local breathing, supported weight shift, continuous dorsal/flank bands |
| Head and cream throat | Shoulder/neck overlap | Bounded pitch; muzzle remains a taper, not a separate light bar |
| Ears | Skull | Independent rotations with an attention envelope |
| Four leg chains | Torso | Stored stance feet, separate swing phases, paw spread under load |
| Tail and its coat layers | Rump | Shared cubic centerline; pale tip follows the same tangent and curvature |
| Habitat | Scene | Distant ridge, grouped grass banks, open hunting lane and bounded contact marks |

Minimum grids remain 80×32 for the original solo renderer and 112×48 for the
director. Evidence includes the normal 160×64 desktop / 112×64 phone director
grids. Cells keep physical 1:2 proportions. Host-installed monospace fallbacks
are unchanged; no font is bundled. Pixel agreement is environment-specific.

## Directed sequences and input

The public `rustle` and `play` cues carry the two authored sequences without
changing `FoxInput`, `FoxBehavior`, `FoxCue` or any public option shape.

| Sequence | Anticipation | Response | Recovery |
| --- | --- | --- | --- |
| Focused hunt (`rustle`) | Hold the paws, cock the head, direct the ears independently | Measured stalk, sniff, compress, captured arcing pounce; forepaws land before hindpaws | Absorb the weight, settle the brush, allow the captured cooldown to finish |
| Tail-led curiosity (`play`) | Brush lifts/unfurls before head and shoulders answer | Cock toward the invitation, bow and approach, then a short answering hop | Unwind the bow and tail, return to a grounded attentive stance |

Exact timing is authored, not a measurement of wild fox behaviour. Tail-first
curiosity is expressly an expressive interpretation. Pointer stillness invites
attention, a canvas tap creates a rustle, and labelled buttons provide touch
and keyboard equivalents. The demo exposes curiosity directly in every scene;
focused canvas shortcuts retain arrows/Enter/P/Space/Escape and add C. Tab is
never trapped, page-wide keys are not captured, and touch scrolling is retained.

Repeated cues during an investigation/captured pounce are ignored by the existing
bounded busy policy. Motion preferences, explicit pause, visibility, zero size
and disposal retain their existing independent precedence. Static tableaux do
not advance the simulation. No new particles, timers, observers or listeners
are introduced in the core or renderer.

## Reference and rights ledger

All references were read on 19 November 2026 and used for observation only.
No source photograph or source geometry is redistributed.

| Reference | Observation used | Rights and copied material |
| --- | --- | --- |
| [NPS Yellowstone, Red Fox](https://www.nps.gov/yell/learn/nature/red-fox.htm) | Darker back/shoulders, dark lower legs, warm flank, long muzzle, white-tipped brush | Reference only; NPS / Neal Herbert photo credit retained in research notes; no copied assets |
| [NPS Species Spotlight, Red Fox](https://www.nps.gov/articles/species-spotlight-red-fox.htm) | Independent ear orientation, head cocking and tail balance in a hunting leap | Reference only; Ed Sharron article/photo credit; no copied assets |
| [NPS, The Clever Red Fox](https://www.nps.gov/articles/fox.htm) | Tucked forepaws, trailing hind legs and extended balancing tail in the inspected pounce photo | Reference only; exact sequence remains stylized; no copied assets |
| [NPS Yosemite, red fox biology](https://www.nps.gov/yose/learn/nature/redfox-biology.htm) | Long low-carried tail, pointed ears, slender body and pale underside | Subspecies-specific reference; no subspecies accuracy claim or copied assets |
| Existing repository fox source | API and lifecycle contracts, seeded model, attached geometry | Existing repository provenance/license retained |

## Reproducibility and fixed budgets

The simulation stays at 60 integer ticks per second with explicit ordered
normalized inputs. Same-version seed/options/events/ticks reproduce state and
logical cells regardless of render grouping. No identical pixels across fonts,
OSs or engines and no cross-version replay identity are promised. Model state
and option types remain unchanged. The new coat and choreography intentionally
change rendered poses/cells relative to the base.

Existing limits are retained: 3 actors, 48 polygons / 1,024 vertices per fox,
160×64 scene cells, 16 input events per tick, 5 catch-up ticks per frame,
1,280×768 logical backing pixels and DPR≤2. Habitat work is fixed and bounded;
48 grass stems are a stem budget, not the count of all scenery characters.

## Acceptance record

Before acceptance, inspect matched baseline/candidate desktop and phone output;
both sequences at normal cadence and representative anticipation, response and
recovery ticks; a monochrome solo profile; planted contacts after composition;
and extreme options/three-actor geometry. Run the existing fox model, renderer,
director, routing, lifecycle, demo and package/type checks, plus targeted new
regressions for authored timing and coat/weight invariants.

Native Skia Canvas, deterministic numerical tests, mocked DOM lifecycle and real
browser execution are separate evidence categories. A denied browser launch is
a blocked gate. Exact commands, runtime/font hashes, source hashes, findings,
screenshots and any remaining acceptance are recorded in the review manifest.
