# Gecko: anchored wall uplift

Integrated against main `b8f222dab868821f27bf2a64a98434f3483fc8e6`.
Scope: Gecko source, generated Gecko package outputs, tests, scripts and API grid documentation. No shared engine, other animal, deployment or workflow changes.

Tokay-inspired broader head, spotted trunk, slit eyes, banded tail and oriented toe pads on a textured wall. Directed climbing uses latched contacts and sequential foot transfer; moth hunting has anticipation, jaw-proximity catch and sequential recovery. C/M/Escape remain canvas-local and reduced-motion aware. References and authorship: [AUTHORING.md](AUTHORING.md).

## Evidence

- Native Canvas comparisons: [desktop](evidence/matched-native-desktop.png), [phone](evidence/matched-native-phone.png). These are renderer captures, not browser screenshots. The phone framing intentionally changes to a closer selected view.
- Native directed sequences: [climb states](evidence/after-native-directed-climb-states.png), [moth states](evidence/after-native-directed-moth-states.png).
- Independent real Chrome 158 captures: [desktop](evidence/chrome-desktop-wall.png), [phone](evidence/chrome-phone-wall.png), [320px page](evidence/chrome-minimum-320.png), [reduced motion](evidence/chrome-desktop-reduced-motion.png).
- [Browser acceptance summary](browser-validation.json): 11 checks passed, no page errors. Actual page, pointer, keyboard and touch events exercised; RAF delivery controlled at 60 Hz for reproducible model ticks. This is not an FPS benchmark or physical-phone test.

Independent integration validation: npm run build; npm run typecheck; node --test species/gecko/test/*.test.mjs (80 passed); npm run check:package (passed-with-unrun-optional-checks, private unpublished candidate); git diff --check. Parent independently inspected public API, anchor stability, interrupted hunts, deterministic replay and keyboard/reduced-motion handling.

The supplied capture script originally expected guidance to persist after a touch tap; real Chrome emits departure on release and correctly clears guidance. The harness now tests contact followed by release separately. Runtime was not changed to satisfy this assertion. Desktop automatic grid documentation corrected to 224×112. Bulk original native videos/frames and raw execution logs retained outside the published source, with representative evidence above.

Remaining gates: physical-device/performance and full package release checks. No merge, deployment or npm publication performed.
