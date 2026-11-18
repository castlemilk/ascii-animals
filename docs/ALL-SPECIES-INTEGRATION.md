# All-species integration candidate

This candidate combines the reviewed source branches for the thirteen-animal collection with catalogue availability enabled after bounded independent visual acceptance. No npm package is published.

## Provenance

- Cuttlefish: original microsite, canonical renderer and strict TypeScript facade.
- Manta and Octopus: recovered original research artifacts, ported into the canonical bounded marine renderer (PR #6).
- Fox: accepted typed adapter and demo (PR #7, already merged).
- Dragonfly, Gecko, Pufferfish, Frog and Owl: recovered original source, explicit typed factories and generated demos (PRs #11–14 and #16).
- Seahorse, Crab, Turtle and Butterfly: newly authored original implementations after the prior chat source became inaccessible, explicitly documented in their species notes (PRs #15, #17–19). They are not claimed to be recovered artifacts.

All source commits are retained as merge ancestors. The original source-only Dragonfly/Gecko proposals are superseded by their integration branches; no history was rewritten.

## Combined verification

On macOS, the combined candidate passed:

- 307 tests, including species models, geometry, lifecycle, options validation, shared scheduling, generated-module completeness and legacy parity.
- Strict TypeScript source and species consumer fixtures.
- Actual local npm tarball, repeatable packaging, offline installation and SSR imports.
- Packed NodeNext/Bundler TypeScript consumers and esbuild fixtures.
- Existing legacy numerical and authoring-bridge checks, rerun after final integration.

The combined build regenerates Pufferfish's copied module dependencies from the canonical renderer, including Manta/Octopus modules. A new dependency-completeness check guards relative imports across every generated demo. This is a cross-branch change and requires a Pufferfish browser check against this combined output, not just its older isolated demo.

## Visual acceptance and release gate

Tests are not visual acceptance. Independent browser reviewers completed bounded checks of recognizable anatomy, unique reactions, playback/reset, reduced motion, responsive layout and observed errors for every study. See [the acceptance matrix and limits](VISUAL-ACCEPTANCE.md). Catalogue availability is enabled for the verified release. Do not infer a completed interaction from a state label or numerical particle count alone.

No measured browser-FPS, power-use, complete assistive-technology or universal cross-browser claims are made. Marine built-ins are bundled together; per-species lazy tree-shaking is not claimed. Other species have explicit typed subpaths rather than casting incompatible interaction semantics into one interface.

The package stays private/UNLICENSED and blocks publication. A source merge or Pages deployment does not authorize npm publishing.
