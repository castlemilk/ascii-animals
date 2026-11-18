# Independent Owl director review — closing report

Review scope: `/workspace/scratch/cf77d9b29d10/ascii-animals-director-owl`, branch `feat/director-owl`, base `c06114404900884814bef879a02f1a49a3e7d590`.

The bounded review findings are closed in the refreshed implementation and regenerated evidence. This report distinguishes independently executed checks, source inspection, implementation-owner test results, and unrun native-browser/device acceptance. The reviewer did not modify implementation, operate a browser, or perform GitHub writes. Final commit/tree/source hashes belong to the coordinator's artifact manifest; this is not a commit attestation.

## Findings and verified closures

1. **Strict enum and tuple validation — closed, independently retested.** Boxed strings, arrays used as enum values, and sparse role tuples were accepted in the first implementation. Primitive string checks and explicit tuple-index checks now reject all five exact reproductions before mutation.

2. **Premature companion response — closed, independently retested.** A rustle addressed to Ash previously woke the drowsy Ember before its intended reply delay because the global cue phase replaced its autonomous baseline. The final generated build preserves the companion's uncued blink and yaw exactly at cue ages 0 and 15 in the independent reproduction. The implementation also includes a full delayed-response regression.

3. **False stretch acceptance during supported long cooldown — closed, independently retested.** With legal maximum core reaction timings, a second stretch at tick 600 was previously reported accepted although the target remained in cooldown until tick 1141. The exact reproduction now returns `acceptedCues: 0`, `ignoredCues: 1`, and `cue: null`. Readiness uses captured cycle durations and checks the companion's scheduled turn at +60 ticks, preserving the existing core timing semantics.

4. **Actor-local pointer gaze — closed by source inspection and reported host regression results.** Correct actor selection previously fed whole-scene coordinates directly into that owl's gaze. The final host first chooses visible/nearest ownership in scene cells, then maps the point into the selected actor's rectangle. Explicit `guide(x, y, target)` remains actor-local and defaults to Ash. Cue markers map actor-local coordinates back into the selected composed rectangle. The implementation owner reports 27 browser-stub tests passing, including wide/stacked pointer direction and guide cases; this closing pass did not duplicate that suite.

5. **Detached shared-bough connector — closed by independent visual reinspection.** The first saved contact sheet showed the join floating above Ash's perch endpoint. The compositor now derives endpoints from actual sampled `perch` cells. The regenerated wide contact sheet and minimum-grid sheet show the connector meeting both branch ends. Its stepped text-cell appearance is consistent with the ASCII representation. A grid-boundary regression was added by the implementation owner.

6. **GIF encoded timing/provenance mismatch — closed by independent metadata audit.** Initial 83/84 ms delays encoded as uniform 80 ms, contrary to the 12 fps claim. Final files encode a repeating **80, 80, 90 ms** pattern and provenance explicitly records that pattern plus the 12 fps simulation sampling. `lookout.gif` and `duet.gif` each contain 157 frames at 904×732 and run for 13,080 ms; `roost.gif` contains 217 frames at 904×732 and runs for 18,080 ms. The final extra sampled endpoint frame explains the small duration beyond the 13/18-second simulated cycles. No seamless-loop or browser-playback claim is made.

7. **Stopped scene preset presentation — closed by source inspection and reported demo regressions.** Scene selection initially reset to neutral poses even while the reduced-motion policy promised deliberate stills. The demo now explicitly chooses a roost rest, duet call, or lookout attention still when stopped, without advancing simulation. Scene buttons are scoped to `.scene-choice[data-scene]`, avoiding the body's shared data attribute and unintended bubbling resets. The owner reports three demo control tests passing, including real still selection while paused.

## Independently executed checks

The original review independently ran the complete then-current Owl Node suite: **62 / 62 tests passed**, covering original core, geometry, browser lifecycle, scheduler ownership, proposal bridge, director, and director-host behavior.

The closing pass reran only the three existing focused probes against the refreshed generated build, as requested. All exited successfully:

- `probe.mjs`: five invalid enum/tuple reproductions rejected; delayed companion blink/yaw equal their uncued control.
- `core-check.mjs`: **120 deterministic state comparisons**, **120 bounded geometry/pose checks**, **54 wide/stacked/layout/pose combinations**, **12,357 visible owner-target samples**, and **12 invalid input-batch atomicity checks**.
- `long-cycle.mjs`: the falsely accepted second stretch is now correctly ignored during the original captured cooldown.

Composition cases include 128×48, 144×60, 160×90, 64×80, 80×90, and 112×80. Both eyes, face, head, beak, wings, body, feet, printable ASCII, equal line lengths, and actor identity remain represented. Replay comparisons use 1/2/5-tick render groupings. Feet remain planted, surfaces stay bounded, and head angles honor the existing configured limits.

Separately, the implementation owner reports the expanded **69-test Owl suite**, build and type checks passing during its final validation run. This report does not present that owner-run total as an independent rerun.

## Final visual evidence assessment

The reviewer viewed the regenerated `species/owl/evidence/director/director-contact-sheet.png` and `director-small-grid.png`. They are **Pillow rasterizations of executed composed ASCII cells, not browser screenshots**.

Broad facial disks, paired dark eye apertures, folded wings, and planted feet remain readable in wide and stacked compositions. Last light's spread wings → heavy eyelids → waking poses provide the clearest scene contrast. The duet visibly changes which owl attends and which answers. Lookout's head/eyelid changes are more subtle, so temporal playback and the scene-status labels remain important to its readability. The stacked layout preserves both subjects rather than shrinking or dropping one. The repaired bough join connects the two perch endpoints.

The GIF files were parsed for frame counts, dimensions, and encoded durations. This is not a native-browser playback or smoothness measurement. No raster image was generated to stand in for an unobserved runtime result.

## Remaining acceptance boundaries

- Native browser loading, actual DOM/font layout, keyboard and pointer interaction, reduced-motion media behavior, hidden/zero-size recovery, and cleanup require coordinator browser acceptance beyond this review's Node/stub checks.
- Real mobile/touch devices, zoom, screen readers and other assistive technology remain untested by this reviewer.
- Real browser frame-time, memory, power, and sustained performance have not been measured; no performance pass is claimed.
- Root-package full-regression results, final exact base/head/tree/source hashes, publication, and deployed acceptance are recorded by the coordinator's final validation and artifact workflow, not inferred here.
- Native Canvas testing is not applicable to Owl's preserved DOM text renderer.

No unresolved correctness blocker remains from this bounded independent review. This conclusion is limited to the inspected implementation, executed generated-code checks, stub evidence reported above, and actual saved-cell visual evidence.

## Reproduction files

All independent files remain outside the implementation checkout at `species/owl/scripts/review-probes`:

- `probe.mjs`
- `core-check.mjs`
- `long-cycle.mjs`
- `independent-review.md`
