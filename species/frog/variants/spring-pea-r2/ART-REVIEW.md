# Spring Pea R2 — native art review

This is a NEW private reconstruction begun on `3b5ffcce7bea56e1402fc16d0edc2c14c3cd5779`, informed by the retained Spring Pea concept board. These observations concern R2's actual native Canvas output. They do not establish a browser, mobile-device performance, or cross-font pixel claim. Original remains a separate, unchanged renderer.

## Final character decisions

The two raised cream eye domes carry recognition at small sizes. Their widened footprint avoids the narrow towers seen in the first R2 frame; contained dark pupils track the canonical gaze. Tall oval haunches and their inner bracket strokes separate the folded hindlegs from the belly. The torso and throat use quiet `:` interiors, while the cheek, contour and lip carry the brighter marks. A light lip curve is readable over a sparse ASCII surface; a dark line disappeared into the empty cell background. A small depth bias prevents an adjacent cheek sample from covering this shallow facial stroke. It changes neither the lip's projected coordinates nor the mathematical tongue root.

The leap preserves the canonical root trajectory, endpoint and phase durations. Local shape treatment broadens the loaded crouch, stretches the launch with directional lean/reach, gathers the limbs before touchdown, and widens the impact squash. The late gathered fall is narrower than the neutral rest. The coral feeding stroke uses the same transformed mouth point as the face and canonical `tonguePoint`/`tongueTarget` functions. Its insect shares the exact endpoint at contact and follows the return. All action timing remains in canonical state; this renderer owns no timer, listener or observer.

Habitat is rendered as ASCII too: muted pad contours, two reed clusters, restrained rings and four landing droplets. Unoccupied pads have smaller contours, reducing overlap in the one-frog view while retaining every pad and its canonical input target. There is no photographic shading, per-sample skin noise, mutable glyph atlas, or autonomous renderer animation.

## Inspected development frames

The paths below are native development captures retained in the review ZIP, separate from the final matched comparison. They were rendered with the native host's Liberation Mono registration and the preview's requested weight 700. Source revision fingerprints are recorded below.

| Frame | Actual file | Inspection |
| --- | --- | --- |
| Desktop single, 880×560 | `review/evidence/development/r2-refine2-desktop-single.png` | Separate eyes, visible lip curve, quiet lower body, folded haunch contours and four contacts. |
| Phone focused rest, 354×360 | `review/evidence/development/r2-refine2-phone-rest.png` | Recognition survives; small facial expression differences are necessarily coarse. |
| Phone hunt contact, tick 180 | `review/evidence/development/r2-refine2-phone-contact.png` | Coral stroke visibly joins mouth to insect; the quiet habitat keeps it distinct. |
| Phone leap keys | `review/evidence/development/r2-final-hop-keys.png` | Ticks 0, 36, 46, 52, 72, 80, 88 and 120 show rest, load, launch, gathered fall, contact, squash and recovery. No clipping appears in these inspected keys. |

The canonical event log for the leap has one `hop` input at tick 24, frog 0, pad 4. The hunt has one `hunt` input at tick 24, frog 0, point `(0.2, 0.55)`; contact is near tick 180. Both use seed 23, count 1, shelter layout, stillwater scene, autonomy false. The contact sheet samples actual ticks; it is not normal-speed motion evidence. Matched normal-speed clips, current-main critique and comparison captures are documented separately by the review workflow.

## Final runtime measurements

These measurements were taken from the final adapter at default private preview settings, front view, seed 23. Geometry emits 17,918 samples per actor in every pose; it does not substitute an illustration for ASCII rendering.

| Surface and frame | Realized cell field | Occupied glyphs | Actor glyphs | Total samples |
| --- | --- | ---: | ---: | ---: |
| Desktop single, rest | 96×46 | 369 | — | 17,996 |
| Phone single, rest | 59×45 | 277 | — | 17,996 |
| Desktop focused pond, rest | 96×46 | 490 | 283 | 18,699 |
| Phone focused pond, rest | 59×45 | 284 | 146 | 18,699 |
| Desktop focused hunt, contact | 96×46 | 481 | 255 | 18,908 |
| Phone focused hunt, contact | 59×45 | 274 | 129 | 18,908 |

The configured scene budgets are at most 18,000 cells, 32,000 samples per actor, 6,246 environment samples and 60,000 samples per frame. These are numerical bounds, not a measured browser frame-rate guarantee. Final tests and camera sweeps belong in `tests/VALIDATION.md`; development-image inspection alone does not close those gates.

## Limits and freeze

Front view is the strongest face presentation. Fine mouth and eyelid changes collapse to a few cells on a phone; this direction depends on silhouette, eye mass and staged body action more than subtle facial acting. The camera retains a fixed, conservative legal-motion envelope rather than reframing each jump. Browser rendering and actual touch/keyboard behavior require the separately reported browser gate; this native review cannot substitute for it.

Runtime frozen for final validation and captures:

| File | SHA-256 |
| --- | --- |
| `pose.mjs` | `b4e8a1fe0096f3309fc5bf745327707a617515f676b5fa779ac0452f563cffa7` |
| `geometry.mjs` | `302b7e848b39b18311f940622b460e7abb2abeb884046809e81bcb5e369ed8e4` |
| `preview.mjs` | `6382392f7c05abba679008d82c4c4c3cef1737c8c6c5d5cffd323783894b1958` |

Final patch base: `26ee6ffc623e0adb2256e66d5b7cefc9ff36c7dd`. All Frog/runtime sources used in these captures are byte-identical across those bases; see `BASE-COMPATIBILITY.json`.
