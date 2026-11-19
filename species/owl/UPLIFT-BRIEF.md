# Owl — the listening ruff and a returning flight

## Scope and custody

Owl-only candidate on `castlemilk/ascii-animals` main
`b8f222dab868821f27bf2a64a98434f3483fc8e6`, independently checked with
`git ls-remote` on 2026-11-19. Work branch: `owl/face-disc-flight-20261119`.
The authoritative implementation is `species/owl/src`; the normal species demo
uses `mountOwl`, while central integration wraps it with `createOwlArtwork`.
Both render printable ASCII as semantic DOM text, not Canvas. No original
species, shared engine, generated public entry, workflow or deployment is owned
by this change. Existing core v1 options, events and behavior remain supported.

## Animal brief before implementation

Tawny-inspired woodland owl, with a rounded tuft-free crown, a broad facial ruff,
and short body/tail under overlapping folded wings. The three silhouette anchors
are rounded disc/head, tapering feathered breast and connected broad wings.
The eyes remain dark quiet apertures inside the face; added detail belongs to
the facial disc, ruff and plumage. Geometry is original analytic construction.
Supported views are front and modest three-quarter turns, not full profile.
The returning flight is an authored frontal 2.5D excursion, not a biological
flight simulation. Its shortened distance and timing serve a bounded text scene.

The existing minimum per-actor grid is 64×36 with cell aspect 0.55. All animals
keep that grid; phone duet uses stacked windows. Desktop and phone before/after
must use the same seed, configuration, explicit tick and grid. The repertoire
remains printable ASCII; system mono fonts are requested but never bundled.

## Anatomy and material

| Part | Attachment and material | Planned motion |
| --- | --- | --- |
| Facial disc | Fine radial feathers within a darker coarse outer ruff | Whole head aims and cants; pupils remain fixed within the head |
| Breast | A few overlapping scalloped contour-feather tiers | Small attached ruffle; no screen-space noise |
| Wing | Shoulder coverts overlap secondaries and rounded primaries | Independent small left/right lag; roots remain connected |
| Feet | Two planted feet grip the sampled branch | Release after crouch, tuck in glide, reach together before contact |
| Tail | Short barred feathers behind body | Fan for braking, fold during recovery |
| Habitat | Far trunks, a middle-distance branch and near perch | Sparse stable glyphs; clear face and flight corridor |

## Two directed sequences

1. **Listen (`rustle`, 300 ticks):** anticipation and head commitment, held
   disc aim with a deliberate cant/second fixation, then uncant, feather settling
   and return to scene. Companion delay remains 48 ticks. Pointer/touch location
   and arrow guidance supply a meaningful direction; R/Enter and native buttons
   request the sequence. Leave/cancel clears transient guidance.
2. **Flight (`flight`, 360 ticks):** 0–42 crouch/commit, 42–90 push-off and wing
   opening, 90–198 held glide, 198–264 flare/tail fan/feet reach, 264–360 contact,
   absorption, wing folding and recovery. This is a new additive cue; the original
   `stretch`, `call`, autonomous scene arcs and solo `react` keep their semantics.
   F and native buttons request flight. One actor flies; its companion watches.
   The existing cue lock and 60-tick cooldown prevent competing interruptions.

Reduced motion uses deliberate listening or open-wing stills without advancing
the core or initiating travel. Pause freezes the current pose. All transforms
are optional pose data, outside authoritative core simulation.

## Reproducibility and budgets

Keep 60 explicit integer ticks/s, seed 7 for review, whole-batch validation,
strictly increasing ordered input sequence, at most 16 inputs/tick, at most two
actors, 96 surfaces/actor and 14,400 composed cells. Catch-up remains capped at
five ticks/frame. Compare identical logical state/cells for 1/2/5 render grouping.
System-font/browser pixels are environment-specific. Runtime performance must
be reported separately from logical test duration; no phone-hardware FPS claim.

## Reference and rights ledger

Retrieved 2026-11-19. These are observations only: no photographs, diagrams,
fonts, source or model assets are copied into the artwork.

- RSPB, Tawny Owl: https://www.rspb.org.uk/birds-and-wildlife/tawny-owl/
  Rounded head, dark facial rim/eyes, mottled plumage, broad wings and short tail.
- BTO, Owl hearing: https://www.bto.org/learn/about-birds/owls/hearing
  Coarse outer ruff and finer sound-directing facial feathers.
- Bachmann, Wagner & Tropea (2012): https://pmc.ncbi.nlm.nih.gov/articles/PMC3390528/
  Overlapping flight feathers form a continuous wing surface.
- Usherwood et al. (2014): https://pmc.ncbi.nlm.nih.gov/articles/PMC4148188/
  Preparatory dip, leg-driven leap and wing contribution in a barn owl.
- Zimmerman et al. (2018), Figure 3:
  https://discovery.ucl.ac.uk/id/eprint/10048807/1/Sainsbury_Is%20it%20advisable%20to%20rehabilitate%20and%20release%20owls%20with%20monocular%20vision_VoR.pdf
  Braking wings and both feet reaching before landing. Cross-owl pose reference;
  no claim that authored timing measures natural tawny-owl movement.

## Acceptance record

Final hashes, exact commands, run results, screenshots, motion states, browser
limitations and central generation commands belong in the accompanying compact
review manifest. Test failures are fixed or explicitly retained as gaps; numerical
tests never substitute for browser input or appearance. Push a working branch
and open a PR only; central integration retains merging/deployment authority.
