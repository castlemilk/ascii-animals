# Pufferfish uplift — authoring record

## Current uplift

This brief records the fine-spine, shape and recovery revision against main `b8f222dab868821f27bf2a64a98434f3483fc8e6`, verified on **2026-11-19 UTC**. It is a source-only handoff with an unchanged public typed API. [UPLIFT-REVIEW.md](UPLIFT-REVIEW.md) is the current evidence and command record; [README.md](README.md) provides the review entry point and [the integrated API](../../docs/PUFFERFISH-API.md) documents the preserved contract.

Earlier `DIRECTOR-*` documents and `evidence/director/` describe the shipped director before this revision. Original handoff documents and captures describe an earlier integration still. Their bases, results and browser reviews are historical, not acceptance of this uplift.

## Scope and source

- Goal: a legible, fine-spined pufferfish whose material, silhouette and behaviour change together.
- Repository: castlemilk/ascii-animals; main verified by git ls-remote on 2026-11-19 as b8f222dab868821f27bf2a64a98434f3483fc8e6.
- Branch: pufferfish/fine-spines-and-recovery. Clean starting baseline; only species/pufferfish source, tests, documentation and review scripts, plus its specific `docs/PUFFERFISH-API.md` reference, are owned.
- Publication boundary: branch and PR only. Central integration owns generated output, merge and deployment.
- Read: actual model, geometry, painter, controller, shipped reef/current/shadow directors, public facade, docs/ANIMAL-APIS.md and the generate-reactive-ascii-animals skill.
- Existing API: all types, inputs, factories, scenes, default tick durations, seeded replay protocol and public exports remain unchanged.
- Representation: original procedural 3D samples through the current private marine depth buffer and glyph atlas. Printable ASCII text export is retained. Canvas atmosphere is a raster gradient, not terminal text.

## Animal, anatomy and provenance

A stylized fine-spined Arothron puffer, informed by A. nigropunctatus, not an exact specimen reconstruction.
Three anchors: oblong resting trunk; small forward muzzle with lateral irises; narrow tail base, small fins and a short clear fan tail.
Inflation expands the abdomen and flanks disproportionately toward a sphere while the face and appendages stay comparatively small.
Views: front and left/right three-quarter, including bounded director turns. Minimum animated canvas remains 360 × 270 CSS pixels; smaller embeds retain still actions.
Forty-two existing discrete spine attachments remain; shorter fine points and fixed surface microrelief replace long quill-like cones.
Pale ventral skin, stable scattered dark spots, fine spines and translucent-looking fin rays change with stretch, never with frame randomness.

| Reference | Observation | Rights / copied material |
| --- | --- | --- |
| https://fishesofaustralia.net.au/Home/species/850 | Pale underside, dark spots, fine spinules, clean muzzle and caudal peduncle; coastal/outer reef | Text consulted; photo Erik Schlogl CC BY-NC inspected as reference only; no photo copied into deliverable |
| https://fishesofaustralia.net.au/Home/genus/125 | Oblong profile and rounded cross-section | Reference only; original parametric geometry |
| https://ocean.si.edu/ocean-life/fish/pufferfishes-and-their-relatives | Pufferfish versus long-quilled porcupinefish | Reference only |
| https://www.aims.gov.au/information-centre/news-and-stories/03-december-do-pufferfish-hold-their-breath-while-inflated | Water gulping, continued gill breathing, energetic recovery | Reference only; paired Canthigaster photos unavailable to local image fetch |
| https://researchonline.jcu.edu.au/37227/ | Metabolic recovery takes far longer than a demo | Recovery pauses and demo seconds are authored compression, not a physiological claim |

No external art, font binary, or geometry is bundled. Existing system font fallback and glyph repertoire remain unchanged.

## Directed sequences

1. Reef drift / inspection: a slow sweeping route approaches a reef station; fins brake and eyes attend; the fish hovers with a small inspection dip; it backs away and regains drift. The existing invite event chooses a target with an initial **30-tick brake**, followed by approach, inspection and release. Nearby pointer attention is distinct from deliberate inflation.
2. Startle / recover: approach input or the shadow cue brakes/recoils; the 30-tick notice leads into belly expansion (42 ticks), spine erection (36), guarded hold (180), hesitant deflation (150), then cooldown (180). Recovery has two finite pauses at normalized .29–.37 and .63–.71, monotone release and smooth release velocity. The midpoint stays .5; maximum default-tick deflation stays below .011. Tiny fin/gill motion continues during the hold.

The reef/current/shadow scene clock remains 1200 ticks, with tempo separate from the defensive model.
Pause/resume and every existing normalized event retain their semantics. Touch targets and focused-canvas keyboard actions remain explicit.
No new global listeners, timers, public options, generated entrypoints, engine changes, or new dependencies.

## Input and accessibility

- Hover at a distance: attend/investigate; a sustained close approach triggers notice.
- Tap/click fish: select. Tap empty water / I / Invite: cautious inspection.
- A / Approach: selected fish's defence. Escape / Give space: release the group; retreat has priority.
- Space: pause; R: reset; 1–3: select. Native buttons offer touch/keyboard equivalents.
- Reduced motion, explicit pause and compact canvases: deliberate still poses; no resumed clock.
- Preserve CSS-rectangle mapping, touch scrolling, cancel/leave cleanup, queue bounds, independent suspension causes and idempotent disposal.

## Resource bounds and integration

The total scene budget remains 16,000 samples with at most three actors; the latest reviewed trio used 15,622. Grid and backing limits remain 160 × 90 cells, DPR <= 2 and 1200 × 675 logical pixels. The event budget remains 16 core events per tick and catch-up remains capped at five ticks per frame. These are work/allocation bounds, not an FPS claim.

`small` retains a 72-column ceiling. `standard` and `fine` share a 96-column ceiling through 520 logical pixels wide, interpolating to 120 and 160 respectively at 700 pixels. The 90-row ceiling can reduce the effective column count further. The existing trio geometry multiplier remains 0.72 through 520 pixels, smoothly reaching 1 at 700 pixels; this revision does not change it.

The patch excludes generated `build/`, `lib/` and `dist/` outputs and shared generated entry points. After applying the source, central integration runs `npm run build`, which regenerates package modules, species builds and demos. No engine, other species or workflow modification is part of this handoff.

## Evidence and remaining acceptance

[capture-uplift-native.mjs](scripts/capture-uplift-native.mjs) captures freshly built baseline and candidate modules through the canonical painter with identical seed 23, view, viewport, ticks and event logs. It covers desktop and phone specimens, calm/inflated/recovering states, front and three-quarter views, minimum-size alternatives and motion excerpts. It records source/runtime hashes, simulation/cell/pixel hashes and native backend details. Motion is sampled from explicit 60 Hz simulation ticks at a 15 fps capture cadence; it is not a live-throughput measurement or seamless loop.

The separate [review-uplift.mjs](scripts/review-uplift.mjs) harness is supplied for real-Chromium entry-page, interaction and lifecycle review. Local Chromium launch was blocked at process creation before a page loaded. The cloud-browser route could not reach the local service and encountered a policy block. **There is no new real-browser acceptance.** Script syntax validation alone does not prove that the harness ran or that any browser assertion passed. Native Canvas evidence does not certify browser glyph rendering, responsive HTML controls, physical touch or device performance.

Exact build, pufferfish model/geometry/controller/director, typed consumer, package integration and replay results are reported in [UPLIFT-REVIEW.md](UPLIFT-REVIEW.md), with the final source hashes, commands, captures and limitations. This brief does not substitute anticipated checks or historical counts for that record.
