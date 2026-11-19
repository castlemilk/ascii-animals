# Seahorse director review

> Historical director record. The current seahorse-only eelgrass revision, its
> exact source base, anatomy changes and executed validation are documented in
> [EELGRASS-REVIEW.md](EELGRASS-REVIEW.md). Historical geometry, counts and
> evidence claims below describe the previous contribution.

## Source custody

Branch: `feat/director-seahorse`.
Base: `c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02` (current main rechecked before
editing; only the README changed after the original `c061144` release).
The baseline was the newly authored integrated Seahorse, not recovered old-chat
source. Canonical source is `src/public/seahorse.ts`.

Only Seahorse source, demo, tests, tools, generated output and documentation are
changed. Shared package metadata, exports, core scheduler, catalogue, marine
source and other species are unchanged. The generated copy of the shared
scheduler is byte-identical to the base.

The live cuttlefish and live integrated Seahorse were inspected before the edit.
Cuttlefish's scene cards, population/preset controls, formation precedence,
individual roles, fine tuning and scene labeling informed the gap matrix in
[AUTHORING.md](AUTHORING.md). The implementation uses Seahorse holdfasts and
paired rising paths. It does not copy the marine school or ink contract.

## Review findings and fixes

1. Still gestures initially obeyed the live cue cooldown. Under reduced motion
   that made later gestures inert. Poster commands now replace the prior poster
   without ticks or subscriptions; moving cues retain their bounded cooldown.
2. Four-member duet/drift rises initially clipped upper heads. Route and cue
   displacement now scales with individual size; layout reserves movement space
   and constrains free poses using rotated anatomy bounds before attachment.
3. A partial grip initially reported an anchored motive. The discriminated state
   now reports anchored only when the final tail constraint is complete.
4. Current direction initially used a sign and jumped at zero. Smooth signed
   current response removes that jump.
5. Invalid legacy greeting poster input now validates before changing state.

An independent numerical rereview sampled 720 configurations / 1,800 member
poses without a sampled landmark outside the frame allowance. The committed
regression suite separately covers specified scene/count/grid/facing/beat/cue
combinations. Neither numerical check proves browser font rendering.

## Rendered critique

Eight actual logical frames were rendered to SVG/PNG and inspected: garden
arrival/rest/release/return, paired duet, solitary passage, four-member duet and
the compact 100×76 garden. A 28-second, 336-frame replay includes a selected
inspection at 7 seconds and a different visitor's shelter cue at 14 seconds.
The images and GIF are **offline rasterizations of the real model**, not browser
screenshots or a video recording.

The snout, crown, upright ribbed trunk and open tail spiral remain distinct in
these samples. Separate fronds give the garden readable destinations. Inward
facing partners and their rising phrase differ visibly from residents in the
three-visitor garden; the solo passage leaves more negative space. The selected
visitor responds while neighbors preserve their own intentions. Upper duet heads
remain in frame after the composition fix.

Kelp is intentionally schematic; the depiction has no biological depth model.
Small grids simplify the eyes, spines and tail interior. Four visitors at the
narrowest API grid are a density boundary, not a claim of equal legibility to the
large default composition. Browser font/zoom/reflow remains to be inspected.

## Executed validation

- `npm test`: **328/328 passed**, including all original species tests.
- `npm run typecheck`: passed.
- `node node_modules/typescript/bin/tsc -p species/seahorse/tests/tsconfig.types.json`:
  passed positive and negative declaration fixtures.
- Final focused source/demo check:
  `node --test test/seahorse.test.mjs test/seahorse-director.test.mjs test/demo-module-dependencies.test.mjs`:
  **32/32 passed**.
- `node scripts/check-package.mjs --report <path>`: local repeatable tarball,
  offline consumer import, SSR, NodeNext/Bundler and core type checks passed.
  Optional esbuild, Rollup and Webpack checks were not run.
- JavaScript syntax, generated Seahorse assets and `git diff --check`: passed.
- A standalone HTML preview was generated from the actual compiled module,
  unchanged scheduler and canonical demo. Inline syntax passed; it was not
  executed in a browser.

## Browser gate and reproduction

The changed demo could not be executed in a browser in this environment. The
cloud browser could not reach the local server. The installed local Chromium
failed before opening a page: `socket() failed: Operation not permitted`.
No permission/security settings were changed or bypassed. Physical touch,
real-phone layouts, screen readers, Safari/Firefox, heap behavior and measured
FPS/frame cost are unverified. There is no WCAG or target-device performance
claim. These remain draft-review gates.

For a coordinator with a local browser:

```sh
npm ci --ignore-scripts
npm run build
python3 -m http.server 8764 --directory dist
```

Open `http://localhost:8764/seahorse/index.html`. Check the three directed presets,
1–4 visitors, current crossing zero, roster roles/facing, targeted tap/keyboard
selection, full arrival/rest/depart/return, and repeat poster cues under reduced
motion. Pause and replay must stay paused. At 390px width the demo changes to
100×76 cells; verify overflow, focus, control targets and anatomy. Test PNG and
ASCII capture, then mount/dispose two instances. Record browser/device details
before making performance or accessibility conclusions.

Reproduce review artifacts without a browser:

```sh
node species/seahorse/tools/export-preview.mjs artifacts/seahorse-director-preview.html
node species/seahorse/tools/render-evidence.mjs artifacts/seahorse-frames
```

The second command creates actual-cell SVG/JSON and a bounded replay log.
`rasterize-evidence.py` optionally converts that replay using Pillow and an
installed DejaVu Sans Mono font. It does not bundle a font or install anything.
The delivery archive includes the already rendered images, GIF, exact base/head
manifest, validation logs, source ZIP, git binary patch and draft PR description.
