# Independent review and bounded corrections

Review date: 18 November 2026. Independent assistant reviewers inspected raw source/contracts, tests and actual rendered files. These are not GitHub approvals or human acceptance. No reviewer edited another author's branch.

## Model/API review

The first independent runtime run passed 19 of 21 cases and exposed two failures:

1. `normalizeFoxPointer` required a plain rectangle object, rejecting a native DOMRect-style prototype. The boundary now accepts structural finite rectangle fields; a prototype-based test preserves this case.
2. A facing/scale update during a pounce correctly retained the captured plan, but after cooldown the old foot positions remained. The failing far-hind local x was −0.322 instead of the new left-facing +0.2668. The plan-to-idle handoff now replants using current morphology before walking resumes. That public-output regression passes.

The reviewer additionally tested prolonged opposite guidance at maximum scale/speed/breathing/tail settings. The committed 3,060-tick scenario checks continuous joint chains and world bounds. Numeric results establish geometry/input/state properties, not visual smoothness.

The initial strict compilation also found an indexed option type and `Array.isArray` narrowing issues. These were fixed in source; `noEmitOnError` is enabled. Final strict fixtures include 16 required errors and positive use of the discriminated result/behavior and scheduler shape.

## Native visual review

The reviewer saw the actual native idle, sniff, crouch, airborne and landing images, ordered contact sheet and 80×32 monochrome left/right profiles. The initial fox was recognizable, but the eye became `oo`, the nose became a block of `@@` cells and the pale muzzle could resemble two bars. Tall narrow ears weakened fox-specific proportions.

The bounded correction did the following:

- Kept the cream cheek behind a closed tapering muzzle tip.
- Assigned exactly one stable visible eye cell and one nose cell in both color and neutral rendering.
- Shortened and widened the pointed ears.
- Moved the fixed framing upward, leaving space for the jump.
- Letterboxed the cell grid so an arbitrary canvas preserves the declared 1:2 cell aspect.

The reviewer then viewed the corrected artifacts and compared them with the retained earlier images. The largest face issue was resolved; both profiles retained the ears/muzzle, distinct foot positions and bushy tail. Crouch, airborne and forepaw-first landing remain visibly different.

| Before | After |
| --- | --- |
| [Idle face](evidence/review/before-face-idle.png) | [Corrected idle](evidence/native-idle.png) |
| [Sniff face](evidence/review/before-face-sniff.png) | [Corrected sniff](evidence/native-interest.png) |
| [Small neutral profiles](evidence/review/before-neutral-80x32.png) | [Corrected 80×32 profiles](evidence/native-neutral-80x32.png) |
| [Stretched 900×600 paint](evidence/review/before-aspect-900x600.png) | [Fitted 900×600 paint](evidence/review/after-aspect-900x600.png) |

The painter correction is covered by a position/aspect test at 900×600, 390×300, 1280×768 and 200×700. The landmark test checks supported profiles and response phases at minimum/default/maximum grid sizes. An initial post-correction neutral/color footprint mismatch of one cell was caught by the existing test; both render modes now use the same landmark placement and retain identical occupancy.

At 80×32 the hind joints remain visually compact; four separated paws communicate the leg inventory more clearly than fine joint detail. This is the smallest accepted grid, not a claim of full anatomical detail at every size. The independent review found no new blocking silhouette regression after correction.

## Lifecycle review

An independent browser-slice review covered setup rollback, callback failures, late callbacks, borrowed scheduler ownership and composed suspension causes. Twelve DOM/Canvas mock tests cover these properties. A root source review also corrected the demo's `pagehide` listener: a cached-page departure must not consume a once-only cleanup hook before a later genuine departure. It now shares the page control AbortSignal and remains until final cleanup.

## Explicit limits

Visual review used actual native-rendered stills and the ordered contact sheet. Normal-speed GIF playback was not watched in a browser/video player in this environment. GIF metadata, finite samples and mocks do not establish absence of every inter-frame pop, device performance, accessibility conformance or browser heap cleanup.

The browser smoke was blocked before page launch by `socket() failed: Operation not permitted` and `ptrace: Operation not permitted`. No workaround of the host restriction was attempted. See [VALIDATION.md](VALIDATION.md) for the remaining gates and exact evidence classes.
