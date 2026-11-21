# Art review — shipped Frog and R2

## Evidence used

The public gallery, gallery Frog study and classic studio were inspected in the browser on 21 November 2026. Their screenshots are in `evidence/browser/`. The live pages do not expose their deployed Git revision, so these are the observed shipped presentation rather than a verified exact-main build. The exact local-main comparison comes from native captures at base `3b5ffcce7bea56e1402fc16d0edc2c14c3cd5779`.

The final R2 assessment uses the full-size native phone/desktop stills, source-pixel crops, silhouette studies, phone leap/hunt contact sheets and encoded sequence provenance. It is not an assessment of a running browser prototype. Contact sheets establish pose differences; the separately supplied clips use normal-speed explicit-tick encoding.

## Shipped presentation

**Gallery card:** the recognisable anatomy is present—raised eyes, squat body and folded limbs—but the frog occupies a small, low part of a dark thumbnail. Its similar-toned internal glyphs do more work than the face. The immediate impression is a textured anatomical study rather than a character expressing a clear emotion.

**Gallery Frog study:** pausing and restarting reveals the same priorities at a larger size. The eye shapes and legs can be found, but pupil, mouth and silhouette hierarchy are subdued. There is considerable empty space above the figure. The page's playback controls are clear; changing the character's shape and acting is the useful art intervention.

**Classic pond:** three frogs, labels and many habitat marks share a similar low-contrast green/gold value range. The roles and scene controls communicate interaction well, while the pictured characters blend into the pond texture. The captured Stillwater scene was paused/reset with autonomy off. The classic screenshot's returned scale is not a qualified mobile layout test.

## What R2 improves

R2 gives the raised eyes a distinct cream mass, separates the pupils from the skin, reduces the torso to quieter marks, and uses a small set of lime, cream, petrol, teal and coral colors. Sparse pad contours and reed clusters leave space around the actor. The current prototype's explicit mouth is visible in the final phone still, where the first R2 pass had lost it inside a bright slab of `+` marks. That observed problem caused the final bounded renderer refinement.

The leap reads through changing silhouettes: a low wide preload, tall directional launch, narrower gather, flat contact and restored squat stance. The frog's final position changes with the selected pad. In the hunt, the cream fly and coral tongue distinguish the action; the sampled contact and return frames show the tongue coming from the mouth region and returning before rest. Exact attachment and state rules are numerical-test questions, recorded in the source audit rather than inferred solely from pixels.

## Remaining gaps from Spring Pea's board

- The cream eye cells still form a coarse grid at phone scale. Their round domes and pupil acting are less fluid than the retained vector-like reference.
- The mouth is now readable, but the small-grid smile is a compact horizontal feature; it does not reproduce the broad soft grin and subtle smug expression of the board.
- The haunches and forelimbs remain angular in ASCII. They communicate the folded support structure, but are less round and overlapping than the chosen concept.
- The scene leaves deliberate room for travel. Consequently the resting actor is still modest in the full phone-sized composition; the supplied source-pixel crops help inspect it without pretending to be an alternative camera view.
- The hunt's diagonal coral glyphs are coarse at small size. Its timing and readability on an actual phone remain browser/device acceptance work.

The result is a new opt-in ASCII character prototype with clearer facial hierarchy and staged shape changes. It is not a full-fidelity reconstruction of the retained board or the missing previous implementation. Browser acceptance remains open, and no publication or default-renderer replacement is implied.

## Final base verification

The final patch is based on `26ee6ffc623e0adb2256e66d5b7cefc9ff36c7dd`, fetched while completing this work. The original brief and native captures were made on `3b5ffcce7bea56e1402fc16d0edc2c14c3cd5779`. Every Frog path, public Frog facade, scheduler, root package file and build script is byte-identical between them; `BASE-COMPATIBILITY.json` records the check. Captured labels and fingerprints remain historical; final test receipts identify the final base.
