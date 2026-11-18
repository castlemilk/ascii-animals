# Frog verification and review

## Result and boundary

The original frog state, geometry, typed API, local demo and temporary legacy-renderer adapter are implemented. **36 tests passed:** 15 pure-core, four geometry, 11 mocked lifecycle/input, two static demo markup/reference checks, and four actual native Canvas/legacy-renderer cases. Strict TypeScript source and emitted-declaration consumers passed, including **27 negative type assertions**. The original Cuttlefish regression passed and its source/standalone hashes stayed unchanged.

The full-size front frog is independently recognizable in actual native glyph captures. Minimum 72×40 all-anchor anatomical legibility is **partial/open**, profile is **diagnostic**, and normal-speed human motion review is **unrun**. Chromium could not launch, so browser behavior, browser pixels, accessibility, target-device timing and heap acceptance are not passed. This is a draft; shared integration remains pending.

## Reproduction custody

- Worktree/branch: isolated `ascii-animals-frog`, `feat/animal-frog`.
- Exact base main: `0e446c47b491b751d484e40db753ec725652b515`.
- Brief committed before implementation locally: `a7c4b78` (`docs(frog): record species authoring brief before implementation`).
- Existing import: `7e5984d34a139b8de4643f1ed0607897a42d88dc`.
- Skill examined: requested `23e078642157a273e2b886222470bd247e5737b5`, reviewed head `e721252075a30888198aafba0953a23fd07bd3c6`; identical SKILL.md blob. Template/references and teaching code read; no teaching ray core copied.
- PR2 examined initially at `e7c16104a1e90c8650f7d3e09cdb1124d0321308`, refreshed at `8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1`. Its new strict TypeScript facade accepts only cuttlefish. See [INTEGRATION.md](INTEGRATION.md).
- Final incoming-change audit also read catalogue PR4 at `5015dbcffb75b1036b21b4b8e3e65bf0697a46f1`; no frog directory overlap or renderer change. No other author branch was checked out or modified.
- No saved microsite/live deployment or earlier conversation contents are asserted as inspected here. No deployment or package publication was performed.
- New implementation/media/brief/test paths all live under `species/frog/`. `source-manifest.json` records file hashes and source identity; raw evidence is below.

## Actual test results

| Category | Command actually run | Result | Evidence limits |
| --- | --- | --- | --- |
| TypeScript build/types | `FROG_TSC=…/typescript/lib/tsc.js node species/frog/scripts/build.mjs` | Exit 0, TS 5.9.3 | Strict .mts source and emitted .d.mts consumers; not npm tarball acceptance |
| Core/geometry/lifecycle | `node --test species/frog/tests/core.test.mjs species/frog/tests/geometry.test.mjs species/frog/tests/lifecycle.test.mjs` | 30/30, zero failures/skips | Lifecycle uses injected doubles, not browser APIs |
| Static demo host | `node --test species/frog/tests/demo.test.mjs` | 2/2, zero failures/skips | Control options, markup and asset references only; no browser parsing or interaction |
| Native renderer | `node --test --test-reporter=tap species/frog/tests/native-preview.test.mjs` | 4/4, zero failures/skips; ~76.8s total test time | Actual @napi-rs/canvas and real legacy methods; test time is not frame performance |
| Legacy regressions | `node scripts/check-engine.cjs` | Exit 0 | Original numerical harness with stubbed Canvas/DOM |
| Syntax | `node --check` on dist artwork/app and new browser/capture scripts | Exit 0 | Syntax only |
| Standalone parity | `python3 scripts/build-standalone.py` then `git diff --exit-code -- dist/` | Exit 0; 145,266 bytes, unchanged | Rebuild only, no deployment |
| Authoring spec | Reviewed skill's `scripts/validate-spec.mjs species/frog/authoring.json` | Valid `frog-v1` | Structure/bounds only, not anatomy/rights certification |
| Actual browser attempt | `node species/frog/scripts/browser-smoke.mjs` | Exit 1 at **launch**, zero page checks | `socket() failed: Operation not permitted`; ptrace also denied. No security/settings change attempted |

Raw outputs: [types](evidence/types.log), [30 Node tests](evidence/tests-node.log), [two static demo checks](evidence/tests-demo.log), [four native cases](evidence/tests-native.log), [legacy regression](evidence/legacy-regression.log), [spec validation](evidence/authoring-validation.json), [browser failure](evidence/browser-attempt.json).

The initial combined native stress run was terminated with SIGKILL. Its exact resource cause was not measured. The final harness explicitly materializes complete frames and runs each unchanged case in its own process so native allocations cannot accumulate across cases. The successful isolated results do **not** establish a browser heap or long-session pass. A test-harness correction also removed the parent Node test-runner protocol variable from nested test processes, so each child emits its own actual assertion results; a missing child pass is a test failure.

### Meaningful coverage

Core tests prove integer next-tick enforcement, globally increasing input sequence, whole-batch atomic rejection, eight-event cap, frozen state/config, changed-seed and changed-input controls, exact configured phase durations, bounded destination, latched in-flight endpoints, no queued busy leap, ballistic altitude/landing, periodic throat, static alternatives, independent instances, reset semantics and CSS-rect normalization. A fresh-process import and replay forbids Date/performance/Math.random and omits browser globals.

Geometry tests sweep 131 ticks × front/left/right/profile, all behavior phases, default and allowed extremes. They check finite bounds/lights/materials, stable sample IDs/count, four limb chains, shared attachments, planted grounded tips, raised eyes and motion-disabled sampling. Sample count remains **17,918** across poses/views, below the 32,000 cap.

Lifecycle tests prove independent pause causes, no scheduled RAF while paused/reduced/hidden/offscreen/zero/undersized, fresh resume clock, at most five catch-up ticks, bounded coalescing of 10,000 pointer events to a target plus action, pointer/gesture cancellation, focused-canvas keyboard ownership, static-pose retention, exact pause gaze, idempotent teardown, two-instance separation, inert late callbacks and setup/consumer-callback failure rollback. These are resource-accounting doubles.

Native cases validate same actual logical glyph cells under 1/2/5-tick presentation grouping, real pixel production, printable/equal-width ASCII export, DPR/backing/cell caps, invalid adapter/config rejection, post-disposal behavior, and the projected envelope across target corners/views at largest size/highest jump. They load the unchanged actual `dist/artwork.js` and verify its SHA-256 before invoking it. No educational rasterizer or stubbed glyph output is substituted.

Original Cuttlefish regression: 60 geometry combinations, 4,748,048 sampled points including later checks, maximum active sample count 23,764, near-plane denominator minimum ~0.65539, zero clipped/nonfinite samples. Targeted react→spray→escape→recover→idle, pause/restart, directional/reverse formations, neighbor progression and encounter hold pass. This remains a numerical/stub test.

## Actual visual artifacts

- [Frog poster](evidence/frog-poster.png): native Canvas, 720×540, default 144×80 logical grid.
- [Contact sheet](evidence/frog-contact-sheet.png): explicit ticks 0,10,24,36,47,72,88,109 plus 72×40 single-tone front/left/right/profile.
- [Frog replay GIF](evidence/frog-leap.gif): 101 actual PNG frames, 720×540, 20fps; sample every three ticks of the 60Hz simulation. No image-generation tool, interpolation or raster frog asset used.
- [Replay fixture](evidence/replay.json), [capture metadata](evidence/native-capture.json), and [actual ASCII cell snapshot](evidence/frog-specimen.txt).
- [Before-critique poster](evidence/critique-before/poster.png), [before sheet](evidence/critique-before/contact-sheet.png), [before small silhouette](evidence/critique-before/silhouette-front.png). Same seed, settings and installed capture font as final comparison.

Capture stack: Node v24.22.1, @napi-rs/canvas **0.1.100**, Linux native Canvas, DPR 1. The actual repository `makeAtlas()` requests SFMono-Regular, Consolas, Liberation Mono, monospace. Capture explicitly registered the installed Liberation Mono font (`/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf`, SHA-256 `5883330d94debd992952cd8f0571b225f478c2d797d3f36c7521b0a5c9bde0f2`). No font file ships. Native and browser rasterizers can differ; pixels are not promised cross-platform identical.

The GIF records the fixed replay at explicit ticks, not a real pointer/touch recording. Native frame sequence is reproducible with `render-evidence.mjs`; individual frame files are ignored to keep the PR small. Reticle/floor rings and caption text are disclosed preview overlays, not frog ASCII export cells.

## Bounded critique and independent review

The pre-code brief and raw source/artifacts were reviewed independently. The geometry author also performed a separately labelled author critique. A reviewer who **did not author geometry** inspected final/before PNGs and the minimum-grid views without a seeded pass verdict.

### Evidence-led changes

1. **Recognizability:** first rendered forelimbs merged into belly/haunch shading. A single bounded revision changed torso vertical radius .46→.40, fore elbow x .60→.70 and wrist/toe x by .04. Shoulder anchors, planted foot y, sample count and timing remained unchanged. The same geometry tests passed unchanged. Independent final review observed clearer chest/inner-foot separation and preserved frog identity.
2. **Right-boundary action:** a default next leap after a rightward landing could validate an internal fallback beyond +1 and throw. Internal default target now clamps before input validation; a regression lands at x=.9, clears target, and leaps again.
3. **Reset validation:** null seed was accidentally treated as omitted. It now rejects consistently with creation; invalid reset leaves the original state intact.
4. **Lifecycle/input:** review exposed static pose reverting after redraw, touch out-and-back drag being mistaken for a tap, late media/key callbacks acting after disposal, and Pause clearing committed gaze. Each was fixed and pinned by tests. The pause regression actually failed (`gaze` changed 1→0) before the fix and now passes.
5. **Demo markup:** final independent review found the Rest option's opening tag was missing. It is corrected, and two static tests now verify control choices, labels, closing tags and local asset references. These tests do not replace the blocked browser acceptance.

### Independent visual conclusion

Full-size front recognition is supported: squat torso, large raised paired eyes, lateral folded hind-leg masses and connected forelimbs are visible. Crouch, airborne extension, landing compression and recovered posture are distinct in sampled frames; no detached landmarks are apparent. The 72×40 single-tone outline retains eye peaks and squat stance, but forelimbs and exact hind-leg articulation merge. Profile alone is ambiguous and remains diagnostic.

Reviewers inspected PNGs, not GIF playback at normal speed. Consequently **launch/landing smoothness, perceived weight, glyph shimmer and throat-pulsation quality remain unaccepted human-motion gates** despite numerical continuity checks and the genuine generated GIF.

## Budgets and unrun acceptance

The predeclared targets have not been relaxed. Implemented caps are one frog; 32,000 sample capacity (17,918 emitted); 180×100 cells; eight events/tick; two coalesced host inputs; five catch-up ticks; DPR ≤2; main backing ≤1200×700 logical pixels × DPR²; zero particles. The local typed buffers cap at 768KB sample storage plus ≤234KB cell storage, excluding JS geometry objects, strings, native contexts and the glyph atlas. The atlas is bounded by the viewport/grid/DPR caps; its memory and GC behavior are not profiled.

| Remaining gate | State and acceptance owner |
| --- | --- |
| 72×40 all-three-anchor anatomy in front/turns | Partial/open after one refinement; needs another visual iteration or an explicitly revised product minimum in a later review, not a retroactive pass |
| Profile recognition | Diagnostic only; no supported-recognition claim |
| Normal-speed human motion | Unrun; review the supplied GIF and a live supported browser |
| Browser pixels, keyboard, touch, zoom/reflow and real font fallback | Blocked at Chromium launch; run supplied smoke and manual interactions on a supported browser |
| Screen reader/contrast/physical touch | Unrun; semantic markup/mocks are insufficient |
| Desktop target p95≤8ms, p99≤16ms after3s warmup/30s at900×600 DPR1/2 | Unmeasured; no FPS, speedup or device-performance claim |
| Physical mobile p95≤20ms, thermals | Unmeasured; native Canvas or touch emulation cannot replace hardware |
| Heap/long-session and framework double mount | Unrun; no framework support claim |
| PR2/shared species contract, public adapter and real tarball export | Pending central owner; current typed facade only accepts cuttlefish |
| Published/deployed frog | Not performed; only own draft branch/PR publication is authorized |

No unknown/failing gate above is represented as passed.
