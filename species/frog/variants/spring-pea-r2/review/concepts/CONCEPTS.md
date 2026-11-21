# New R2 editable concepts

These SVGs and their Python authoring script are **new reconstruction assets**, informed by the two retained raster boards. They are not recovered original editable source, original prompts, browser screenshots or runtime frames. The SVGs contain editable vector shapes and text, with named character, eye, mouth, haunch and pose groups; neither embeds a raster image.

## Direction decision

**A / Spring Pea** is the implementation direction: broad squat body, large separated cream eyes, round folded haunches, short planted forefeet, a curved smile, lime contour and a coral tongue. The five poses differ in width, height and line of action: compressed preload, diagonal stretch, gathered body, wide low contact, recovered calm. Habitat is a small number of muted teal pad and reed marks.

**B / Reed Rascal** is the alternative: teal kite body, trapezoid eye towers, skeptical lids, angular bracket legs, warm cream ground and amber insect accents. Its shape and personality are deliberately sharper and drier. It remains a reference alternative, not another runtime renderer.

## Glyph translation intent

Favor contour and a few explicit feature cells over uniformly shaded geometry. Separate eyes with negative space, keep pupils readable, and preserve gaps between forearms and thighs. Use round contours for Spring Pea and diagonal contour glyphs for Reed Rascal. The exact cell selection belongs to the runtime renderer; these vector studies do not claim an exact ASCII layout or cross-font pixel match.

## Attachment and pose specification

The Spring Pea smile is `M -47 2 Q 0 26 47 2`; the tongue root is its exact midpoint `(0,14)` in face-local coordinates. The Reed Rascal mouth lies at `y=-7` and its tongue root is `(0,-7)`. Apply the same whole-body pose/view transform to mouth and tongue root. Aim changes the endpoint. The vector tongue is an authored attachment study, not a claim that runtime attachment has been tested.

Preload and contact scale around the foot support line, launch introduces diagonal stretch, gather reduces the footprint, and recover restores the characteristic folded shape. Runtime model timing, endpoints and landing ownership remain canonical.

## Reconstructed art briefs

These briefs were written for R2 from the retained images; **the original generation prompts were not recovered**.

**Spring Pea:** Design an original squat comic frog with two enormous cream eye domes, a broad smiling lime head and body, rounded folded thighs and small planted forefeet. Use a dark petrol stage, restrained teal pads/reeds and coral tongue. Show calm, startled and smug faces; a mouth-rooted tongue reaching a firefly; and clear preload, elongated diagonal launch, compact airborne gather, wide squash contact and recovered rest. Keep broad flat shapes and strong negative space. Label as concept art, not browser evidence.

**Reed Rascal:** Design a contrasting angular frog with a teal kite body, trapezoid eye towers, skeptical lids and sharp bracket legs on warm cream. Use amber and coral accents. Show wary, startled and satisfied expressions, a precise mouth-attached tongue and five sharp diagonal leap keys. Keep the graphic silhouette spare and dry. Label as concept art, not browser evidence.

Run `python review/concepts/build_concepts.py` from the variant directory to regenerate both SVGs. PNG proofs, if present, are vector render proofs, not browser evidence.
