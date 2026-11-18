# Owl twilight director — validation and reproduction

## Reviewed change and exact bases

Branch: `feat/director-owl`. The isolated authoring checkout started from main
`c06114404900884814bef879a02f1a49a3e7d590`; the pre-code brief is commit
`19f908a0bff804d4ea1ec0c2a2129260ea528a5e`. During review, main advanced to
`c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02` through PR21. Read-only comparison
showed that its only change was `README.md`. That upstream commit was merged
locally without rewriting the Owl work. The final binary patch uses this latest
main as its exact base. Final head/tree and bundle checksums are in the external
handoff manifest, avoiding a self-referential commit hash inside its own tree.

All implementation changes remain in Owl source, generated output, demo, tests,
species documentation and the explicit existing `src/public/owl.ts` entry.
No package export, root registry, shared scheduler, catalogue, marine or other
species implementation changes are part of the patch.

## Executed checks

| Check | Result | Evidence and limit |
| --- | --- | --- |
| Repository build | PASS | All generated assets rebuilt through existing scripts; only Owl output differs. |
| Root and Owl strict TypeScript | PASS | Source, positive/negative type fixtures and public-entry typed example. |
| Owl suite | 69/69 PASS | Original 40 cases plus director/composition, host and demo-control regressions. |
| Repository suite | 90/90 PASS | Existing canonical parity, lifecycle/scheduler, public API, integrated species and generated-demo checks. |
| Original Cuttlefish numerical regression | PASS | Existing `scripts/check-engine.cjs`, including encounter hold. |
| Catalogue/local assets | PASS | 13 unique species and local links/assets. |
| Generated Owl demo syntax | PASS | Actual `dist/owl/demo.mjs`. |
| Independent generated-build probes | PASS | 120 deterministic comparisons, 120 bounded geometry checks, 54 grids, 12,357 ownership samples, 12 invalid atomic batches. |
| Typed example execution | PASS | Two replays match at tick720; two accepted cues, one ignored; 60 text rows; deliberate still differs. |
| Logical render evidence | Executed and reviewed | 531 captured animation frames, 12 phase contact frames, nine small-grid/silhouette specimens, three GIFs. |
| Live baseline browser | Inspected | Existing public Cuttlefish scene/roles/choreography and integrated single-Owl demo; saved baseline screenshot only. |
| Revised demo browser | UNRUN | Cloud browser could not reach local server: `ERR_CONNECTION_REFUSED`. |
| Device/frame performance | UNRUN | No FPS, frame-time, memory, mobile or smoothness pass is inferred from source caps or Node duration. |

The whole validation command writes exact commands, exit codes, durations and logs
to `evidence/director/validation-run.json`. Durations measure these checks on this
runtime; they are not animation performance measurements. Tests were executed
before the final upstream README-only merge; executable source is identical.

The host tests use real Owl models, geometry and the shared scheduler with a
simulated document, animation callbacks, pointer events, media query and observers.
The demo tests use a small bubbling DOM stub to verify script control flow.
Neither is a native browser or assistive-technology test. Native Canvas is not
applicable: Owl remains a DOM text renderer.

## Reproduce

Use Node20+ and the repository's pinned TypeScript5.9.3 dev dependency. Generated
species JavaScript/declarations and the HTTP demo are committed; the downloadable
source bundle also includes the generated `lib/` tree used by public consumers.
No installation, network mutation or service use occurs in the validation script.

```sh
node species/owl/scripts/validate-director.mjs
node species/owl/scripts/review-probes/probe.mjs
node species/owl/scripts/review-probes/core-check.mjs
node species/owl/scripts/review-probes/long-cycle.mjs
node species/owl/scripts/capture-director.mjs
python3 species/owl/scripts/render-director.py
python3 -m http.server 8768
```

Open `http://localhost:8768/dist/owl/` in a browser with access to that server.
Pillow and the installed DejaVu Sans Mono font are used only by the optional
evidence rasterizer. No font is bundled. Its exact font hash is recorded in
`evidence/director/raster-provenance.json`.

The fixture `fixtures/director-replay.json` starts at seed7 and advances all
integer ticks1..1080 at a logical60 ticks/second. Events at60/120/121/360/480/840
exercise attention, rustle, a rejected repeat, leave, call and stretch.
`replay-result.json` records three accepted cues, one ignored cue, 36 cell hashes
and the final immutable state. The core tests compare state and text across
1/2/5-tick render groupings.

## Visual evidence and bounded critique

`logical-scenes.json` contains exact output from the executed director and
existing Owl glyph sampler, before rasterization. `director-contact-sheet.png`
shows four phases from each authored scene. `director-small-grid.png` preserves
both actors in minimum wide/stacked grids and silhouette views. The three GIFs
sample at12Hz with a GIF-compatible80/80/90ms delay pattern; lookout and duet
contain157 frames /13,080ms, roost217 frames /18,080ms. Each repeat restarts the
fixture; seamless looping is not claimed. These are Pillow renders, not native
browser pixels, a concept image, or deployed evidence.

The independent review is in `DIRECTOR-REVIEW.md`. Evidence-led corrections include
primitive enum/sparse-role validation, genuinely delayed companion waking, core
cooldown-aware stretch acceptance, letterbox-aware ownership, actor-local pointer
direction, sampled branch endpoints, accurate GIF timing, scoped scene-button
listeners and deliberate paused scene presets. Relevant reproductions became
regression tests. The final sheets retain facial disks, two eye apertures,
rounded bodies, wings and planted feet; Last light has the strongest visible
wing/rest contrast, while lookout intentionally relies on gentler gaze changes.

## Remaining acceptance gates

- Native browser verification of the revised typography, layout, pointer cues,
  keyboard focus, text/config downloads and console output.
- Actual narrow/mobile/touch devices; physical control reach and scrolling.
- Screen-reader interpretation and real `prefers-reduced-motion` settings.
- The brief's browser performance workload, frame time, memory and multiple
  simultaneous artworks. Source caps are two cores, 14,400 composed cells,
  24 stars, one brief cue mark, two queued host actions and five catch-up ticks.
- Coordinator review of the optional Owl-specific API and creative acceptance.
- Authorized publication, CI and a draft PR; later merged/deployed acceptance.

The earlier GitHub approval boundary is not bypassed or retried. This change is
provided as exact reviewed source, binary patch and PR-ready artifacts. No PR merge,
deployment, npm publication, settings/credentials change or paid service was run.
