# Independent eelgrass patch review — 19 November 2026

Applied the supplied `seahorse-eelgrass.patch` without source edits to exact main
`b8f222dab868821f27bf2a64a98434f3483fc8e6`. Regenerated only the tracked Seahorse
demo output using the standard build. No shared engine or other species changed.

Independent checks on macOS arm64, Node 26.7.0:
- `npm test`: 626 passed, zero failed/skipped (includes build).
- `npm run typecheck` and Seahorse TypeScript fixture passed.
- `npm run check:package`: passed with its explicitly unrun optional bundlers.
- Geometry tool: 1,440 poses / 4,844,468 points; zero nonfinite/outside points;
  all 18 contact-depth scenarios passed.
- Public declaration SHA-256 matches the author's baseline declaration hash.
- All four supplied native-render evidence files match manifest hashes and sizes.
- `git diff --check` and capture-tool JavaScript syntax passed.

A fresh headless installed Chrome context loaded the generated demo from a local
HTTP server, with external requests blocked, at 390×900 and 1280×900. Both passed:
no horizontal document overflow; expected initial visitor counts (one/three);
pause; release and keyboard Enter/R/H without unpausing; switching to a duet;
canvas touch (phone emulation) or click; live reduced-motion change disabling
playback; deliberate brace remaining still; no page JavaScript errors. Full-page
screenshots were visually inspected at both widths. These are independent smoke
checks, not physical-phone, Safari/Firefox, screen-reader, performance or exhaustive
browser acceptance. Supplied before/after images and GIF remain native Canvas
artifacts, not browser captures. No normal-speed browser motion review claimed.

The patch has no new dependencies, copied external art, credentials or network
calls. Source-only capture/review tools and procedural evidence remain species
scoped. No duplicate eelgrass branch or PR existed at publication check; old
Seahorse integration branches are distinct. Draft review only: no merge, deploy,
package release or repository settings changes.
