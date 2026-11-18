# Crab director evidence

These files support a draft review, not a release. The final exported validation
manifest records the exact patch base, local head, tree and file hashes.

## Executed checks

| Check | Result | Evidence |
|---|---|---|
| Repository `npm test` | 329 passed, zero failed | `aggregate-tests.log` |
| Final crab model/lifecycle tests | 32 passed: 10 legacy + 22 new | `crab-tests.log` |
| Repository strict TypeScript | Passed | `typecheck.log` |
| Crab positive/negative consumer types | Passed, no diagnostics | `crab-types.log`, `../tests/types.ts` |
| Local package/SSR consumer check | Passed with optional bundlers unrun | `package-check.json` |
| Generated crab demo freshness | Passed in crab test suite | `crab-tests.log` |
| Native Canvas rendering | Eight panels and 160 sampled frames | `native-render-manifest.json` |

Package validation packed and installed only a local tarball. It did not publish
to npm. Esbuild, Rollup, Webpack, real-browser hydration and performance were not
certified by that command.

## Visual evidence

- [Comparison contact sheet](crab-contact-sheet.png).
- [16-second deterministic tide sequence](crab-tide-sequence.gif).
- [Renderer, options, source/font hashes and snapshots](native-render-manifest.json).

The actual `createCrabArtwork` Canvas2D draw path ran on `@napi-rs/canvas`, with a
mocked window/lifecycle and installed DejaVu Sans Mono. Images are actual adapter
pixels. They are **not browser screenshots**, and the GIF's ten samples per
second are **not a measured frame rate**.

Independent visual review first found merged shelters and an unrecognizable
minimum-grid silhouette. Outward shelter placement, a roughly 20-column theatre
footprint and one blank label row corrected those failures. The final static
review found all five boundary specimens recognizable. At the 80×32 extreme,
Pip's raised claw can touch Moss's lower leg; their bodies remain distinct.
Rock contour, subtle contrast and fine fingers still deserve real-display review.

## Browser gate remains open

The original live Cuttlefish and Crab were inspected through the cloud browser.
The new demo could not be reached from that browser's isolated localhost. An
attempt to launch installed Chromium 156.0.8078.79 locally through Playwright
failed before any page opened:

```text
FATAL:chrome/browser/process_singleton_posix.cc:297
Check failed: . socket() failed: Operation not permitted (1)
```

No browser flags, permissions, credentials or network policy were changed to
work around this denial. Accordingly, no revised-demo browser or performance
test is marked passing.

## Coordinator acceptance pass

1. Build with `npm ci --ignore-scripts` then `npm run build`. Serve `dist/`
   over HTTP; open `crab/index.html`.
2. Watch one full cycle of each scene. Confirm asymmetrical claw calls,
   alternating planted scuttle feet, shy/curious/territorial reactions, cover,
   peeking and staggered return. Confirm normal-speed motion and loop joins.
3. Tap an actual resident and empty sand. Verify correct selection/role cue,
   guidance clearing on touch release/cancel, and continued page scrolling.
4. Use the whole interface by keyboard. Focus the canvas; exercise arrows,
   1–5, F/S/H/N, Space and Escape. Form controls must keep ordinary key behavior.
5. Pause; change scenes/chapters/cues/options and restart. Repeat under system
   reduced motion and a live preference change. Stills must stay still.
6. Inspect 320/390/430px widths, large text/zoom, minimum density, five residents,
   all palettes and both facing directions. Verify focus and contrast with real
   system fonts, plus useful screen-reader announcements.
7. Snapshot ASCII, let the scene advance, then save the displayed snapshot.
   Confirm the exact captured text downloads. Check PNG capture and retained URL
   cleanup. Check real BFCache navigation, hidden/offscreen/zero-size recovery,
   and multiple mount/dispose cycles.
8. Profile intended desktop/phone workloads separately before making any FPS,
   memory, CPU/GPU or accessibility-conformance claim.
