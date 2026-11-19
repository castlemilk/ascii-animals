# Manta / Reef shadows

## Scope and source custody

This is a **manta-only review candidate** based on `castlemilk/ascii-animals` main
`b8f222dab868821f27bf2a64a98434f3483fc8e6`, independently checked by Git and the
GitHub branch API. The working branch is `review/manta-reef-shadows`. No other
species, shared engine, public package entry, catalogue, workflow, or deployment
belongs to this change. The package remains private and unpublished.

The actual marine species source is `src/animals/manta.js`, not a speculative
`src/species/manta` registry. The existing public contract is
`createArtwork(canvas, {species:'manta', ...})` and the established marine subpath.
The geometry change benefits those consumers. The authored reef experience is
an isolated **study adapter**, `species/manta/reef-artwork.mjs`, consuming the
actual built marine package. It is not silently added to the stable exports.

The requested authoring skill, `docs/ANIMAL-APIS.md`, the strict facade,
`docs/MARINE-DIRECTOR.md`, and shipped marine director implementation were read.
The live Pages deployment was not used as source authority. Earlier conversation
pages were not read or reconstructed from memory.

### Earlier anatomy candidate

The original `ascii-animals-anatomy-b8f222d.patch` was read in the private review
collection. Its manta hunk only removed the raised bright eye discs and added a
comment omitting lateral eyes in the dorsal view; it did not change wings,
lobes, or tail. This revision preserves that deletion and replaces the old
geometry-freezing hashes with attachment, bounds, no-eye, and fin-lag invariants.
The old source/candidate Git blob pair was
`1a7c95216292e1bc9e97c987e2b04d8b5a8ce996` →
`ee2cc08b4fcd22f31d067bcaed2ea13e49a27368`.

## Animal brief

**Reference species:** reef manta, *Mobula alfredi*. This is an original stylized
procedural dorsal study, not a validated biological simulation.

Three recognition anchors carry the image: broad swept pectoral wings; two
forward cephalic lobes joined to a broad terminal head; one slender trailing
tail. The supported primary views are dorsal, oblique, and banked. A true
frontal mouth or scientifically complete ventral specimen is outside the brief.
Lateral eyes are deliberately omitted; there are no front/centre eye glyphs.

Intended review sizes are **1100×620** and **390×470 CSS-like pixels**, DPR 1,
with the 390px phone kept readable at native size. The underlying package keeps
its inherited smaller-grid/resource policy. No real-phone performance claim is
made from these dimensions.

| Part | Attachment and dimensions | Motion and reading constraint |
| --- | --- | --- |
| Disc | Central body, local x −.99…1.06, half-width .455 | Flatter depth than the old ellipsoid; broad forehead closes between lobes |
| Pectorals | Overlap the disc from y ±.20 to ±2.70 | Curved span/chord deformation; anterior base leads, flexible tip/trailing edge lag |
| Cephalic lobes | Roots x .85, y ±.27; extend forward to x 1.405 | Rolled contours with restrained opening; roots remain inside head silhouette |
| Tail | Root x −.88, y 0, tip x −3.11 | Small delayed sway; no detached root and no bright exhaust-like streak |
| Material | Dark dorsal disc, broad soft shoulder fields | Diffuse black V; pale underside is revealed during banks, not isolated eye-like spots |

## References and rights

| Primary source | Observation used | Material copied |
| --- | --- | --- |
| [Manta Trust: reef manta guide](https://www.mantatrust.org/mobula-alfredi) | Soft dorsal pattern boundary forming a dark V; reef context and tail proportions | None. Its credited Guy Stevens image was inspected privately for anatomy and is not redistributed. |
| [NOAA: giant manta ray](https://www.fisheries.noaa.gov/species/giant-manta-ray) | Broad diamond disc, elongated pectorals, lateral eyes, terminal mouth and cephalic lobes | None; general manta anatomy reference |
| [Fish et al. 2016](https://www.mdpi.com/2226-4310/3/3/20) | Flexible fin-tip lag and spanwise/chordwise deformation | None; original geometry and motion equations |
| [SICB: open-water maneuverability](https://sicb.org/abstracts/kinematics-of-swimming-in-the-manta-ray-manta-birostris-3d-analysis-of-open-water-maneuverability/) | Shallow banked glides and asymmetric fin loading during turns | None |
| [Manta Trust: behavioural ecology](https://www.mantatrust.org/mobulid-behavioural-ecology) | Natural somersault feeding uses a backward 360° loop | None. The interactive roll here is explicitly an authored **barrel bank**, not that feeding loop. |
| [Jaine et al. 2012](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0046170) | Cruising has rolled lobes; ram feeding is against current | None. Current-following travel is not labelled feeding. |

References were retrieved during this review on 19 November 2026 UTC. All reef
shapes, geometry, marks, code, and control layout are original work. Existing
repository licensing is preserved. No photo, model, external ASCII drawing, or
font binary is included.

## Representation and habitat

The manta uses the host's existing neutral material ramp (charcoal through ivory);
the selected palette continues to colour the surrounding water.

The animal uses the existing **Canvas glyph atlas**, not selectable terminal
text. The glyph ramp remains `.,:;!i1l+txzvcofnae0&%8B@`, with the inherited
SFMono-Regular / Consolas / Liberation Mono / monospace fallback. Point mode
shares exactly the same geometry. Glyph metrics and DPR/resource limits remain
owned by the existing renderer.

The scene is a disclosed hybrid: three muted raster reef strata, sparse sediment
glyphs, small fixed sea fans, a soft projected ray shadow, and a few current
tracers. Their contrast stays below the ray and the central water stays open.
The habitat is drawn after water and before animal glyphs. It never writes to
the animal's ownership or depth buffers, so a reef click cannot become a hit.

## Directed sequences

| Sequence and phase | Body intent | Fin/lobe intent | Timing |
| --- | --- | --- | --- |
| Current / anticipation | Read the selected current with a shallow heading change | Load the anterior pectoral surface | First 16% of a 32s default loop |
| Current / glide | Follow a broad bounded arc over the reef | Lower stroke energy, slight dihedral, rolled lobes | 16–67% |
| Current / recovery | Settle and rejoin the original arc smoothly | Recover the ordinary stroke | 67–100%; position and velocity join at the seam |
| Barrel / anticipation | Slight counter-bank before committing | Load one wing, restrained lobe opening | 0–.8s |
| Barrel / response | Bank toward the chosen side, with matching heading and depth | Near/far loading differs; pale underside becomes visible | .8–3s; peak authored roll about 1.12 radians |
| Barrel / recovery | Slowly unroll and return to the same-time current route | Correcting stroke and relaxing dihedral | 3–8.8s |

Representative stills preserve the live clock. **Resume live** returns to that
saved route; it does not claim to continue the displayed still.

Pointer attention changes heading and the turn response. Mouse click or touch
on a visible manta cell triggers a bank; empty water is excluded. Semantic
left/right buttons and focused-canvas arrow keys provide deliberate direction;
Space/Enter toggle playback and Escape pauses. Touch scrolling is preserved.
The original input adapter owns CSS-rectangle mapping and pointer cancellation.
The response side is frozen at acceptance and additional triggers during the
8.8-second response are ignored. Paused bank buttons show a still and do not
resume animation.

## Determinism and lifecycle

Default seed is 17. The pure director has no wall clock, DOM, font reads, ambient
randomness, or event queue. Its sampled current route uses the engine's
speed-scaled time; bank response age uses the inherited simulation seconds.
Current changes ease for three elapsed seconds. The same version, options,
initial state, dimensions, 60Hz tick sequence, and ordered input log reproduce
state/cells. Extra draws do not advance the director. Cross-browser font pixels
and arbitrary timestep equivalence are not promised. No serialized save/restore
format is introduced.

The study subclasses the existing renderer only at the local camera/render
seams; projection, rasterization, hit ownership, bounded buffers, pointer input,
visibility handling, reduced motion, and scheduler still belong to that host.
The camera is recomposed as one basis with matching local light/half/view vectors
and near-plane containment. The habitat hook runs during rendering only.
Constructor calls before subclass initialization are guarded, and validation
happens before browser resources are allocated.

The demo has descriptive text, visible focus, semantic controls, a separate
pause action, and four deliberate static states. The operating-system motion
preference starts static; pointer actions cannot silently restart it. Resize,
zero-size, hidden/offscreen transitions, restart, and disposal preserve the host
contract. The demo's sparse status read timer and handlers are cleared on
unmount/page exit. It does not create a second animation loop.

## Budgets and acceptance boundary

The study intentionally composes one manta. It preserves the host's default
65,536-cell, 36,000-sample, 8,294,400-pixel and DPR≤2 caps. The geometry's declared
bound is x −3.16…1.48, |y|≤2.72, |z|≤1.05; the species sweep requires fewer than
18,000 emitted samples per draw. Habitat work has three 81-point contours,
viewport-bounded sediment glyphs, two five-branch sea fans, and ten tracers.

Numerical/type/lifecycle results, native raster captures, attempted browser
checks, source hashes, and actual commands are recorded separately in the review
manifest. Native Canvas is useful appearance evidence, not DOM layout,
accessibility, Safari/Chrome raster, or real-device performance verification.
