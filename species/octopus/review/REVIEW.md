# Octopus review record

Candidate against main `b8f222dab868821f27bf2a64a98434f3483fc8e6`.
Renderer SHA-256: `48c2f1ca0be6d2d36182a184a115c32c1c5245779e33f45ff67d8ae419937165`.
Only `src/animals/octopus.js` and `species/octopus/**` are owned by this change.

## Result

The dim rocky den now gives three support arms fixed world contacts. A rounded
mantle, shallow web, warmer lateral eyes, exposed paired suckers and a travelling
dark skin band establish the material and silhouette. Examination has a small
anticipating turn, selected reaching arms, a hold, and a peel. Startle gathers
the arms before the existing ink/jet response, then returns with staggered
contact recovery. The shared engine, its timing and director routes are retained.

Read the anatomy and cross-species reference ledger in [AUTHORING.md](AUTHORING.md).
The machine-readable summary is [manifest.json](manifest.json).

## Evidence to inspect

- [Matched desktop, 1200 × 800](evidence/before-after-desktop.png)
- [Matched phone-sized Canvas, 390 × 640](evidence/before-after-phone.png)
- [Twelve candidate sequence states](evidence/after-motion-contact-sheet.png)
- [Corresponding baseline states](evidence/before-motion-contact-sheet.png)
- [Normal-speed native motion](evidence/octopus-examine-jet-native.gif)

The separate delivery bundle contains all 48 full-resolution captures, MP4,
full capture manifest, exact test logs, standalone HTML and an independent patch.
Both comparisons use seed 17, identical options, speed 1, fixed 1/60-second steps,
and the same ordered pointer/pulse log. Idle comparisons are at tick 120.

These are **native Skia Canvas renders of the exact source with a simulated
browser host**. The capture adapter preserves RGBA pixels while periodically
resetting native backing storage; direct-versus-adapted 320 × 240 renders match
exactly for baseline and candidate. They are not browser screenshots.

## What passed

| Check | Result |
| --- | --- |
| Existing repository suite (`npm test`, including build) | 618 passed |
| Octopus source, transitions, preview controls, existing geometry sweep | 23 passed: 22 new, 1 existing |
| Preview controls after final explanatory-copy edit | 4 passed |
| `npm run typecheck` | Passed, TypeScript 5.9.3 |
| `npm run check:package` | Passed with unrun optional bundler checks |
| Source syntax and whitespace | Passed |
| Fixed contact error, 60 sampled frames | Maximum 8.22e-12 world units; gate 1e-6 |
| Eight 40-link arms; finite/bounded geometry and LOD | Passed; captured desktop peak 13,781 samples |
| Zero-time startle during a reach | Exactly zero arm-point displacement |
| Small transition steps / nearby targets | Below the declared .01 local-unit continuity gate |
| Same seed, input log and extra redraws | Identical logical state/buffers |

Build, repository, type and package checks ran in an isolated base checkout with
the exact candidate renderer. Shared generated files from that build are not
part of the patch. The package check passed repeatable tarball, offline install,
SSR import, export guards and TypeScript NodeNext/Bundler/core-no-DOM consumers.
Optional esbuild, Rollup and webpack compatibility checks were unavailable.

Independent review found and drove fixes for frozen repeat invitations, rapid
reacquisition snapping, zero-time startle snapping, autonomous-probe takeover,
release-to-autonomy discontinuity, and abrupt secondary-arm switching. Seven
regression tests preserve those cases and the shared director phase boundaries.

The initial smallest-size glyph threshold was rejected because the baseline
also failed it. The optional 320 × 240, size .35, density .6 stress case now
checks finite geometry and bounds. Intended reading sizes retain their visual
floor. Contact, timing, topology and sample-budget gates were not relaxed.

## Remaining acceptance and limits

Real-browser validation is **not run**. Local Chromium could not create its
required socket. The regular-chat connected-browser route cannot capture the
needed screenshots, and the cloud browser rejected the local-file URL. No Work
conversion or alternate route was attempted after that rejection. CSS layout,
actual device touch/keyboard delivery, browser accessibility and phone FPS remain
for central review. Simulated control tests do not establish those properties.

Independent visual review covered matched views and all twelve desktop phases,
plus full-resolution examine and phone ink/jet/replant. It found no remaining
blocking issue in those states. Reviewers inspected representative native states
and numerical continuity, not live browser playback. The exported motion is a
16.25-second, 12-fps replay of a 60-Hz simulation, not a performance benchmark.

Phone cups read as pale surface highlights; individual paired rings are clearest
on desktop. Overlap prevents counting all eight arms in every idle view. Notice
is restrained. The upright stance and inherited pale violet ink are stylized.
The den is intentionally limited to solo reactive hover/curious behaviour;
formations and enabled shared directors keep their existing body routes.

## Central integration

Apply the patch against the stated base and follow [the exact commands](../README.md#verification-and-central-integration).
Regenerate shared compatibility bundles, demos, package output and dependent
copies centrally with `npm run build`; if preparing Pages artifacts, also run
the existing `python3 scripts/build-standalone.py` step. Run the explicit octopus
tests as well as `npm test`. Review the standalone in a real desktop and phone
browser before acceptance. This change does not merge, publish or deploy.
