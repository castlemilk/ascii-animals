# Seahorse: newly authored bounded study

This implementation is newly authored in this branch. The earlier Pro Seahorse
conversation reached its length limit before exporting its source; this code is
**not** represented as a recovered implementation or its artwork.

## Visual brief

Stylized side-profile seahorse, ASCII-only glyphs, system monospace. Silhouette
anchors: tubular left-facing snout and small coronet, upright ringed trunk with
rounded belly and fluttering dorsal fan, tapering prehensile spiral tail. Neck,
head, fins and tail remain attached during gestures. Default 100×60 cells;
minimum supported 64×36 is a deliberate simplified view, not anatomical proof.

Whole-body hover is slow and bounded. Local dorsal and pectoral fins use distinct
phases. Hover, curious and holdfast behaviors preserve the same skeleton. A
keyboard/touch Greet control starts inspect → curl → settle → idle over 3 seconds.
Pointer guidance tilts the animal and moves the snout without forcing playback.
Holdfast shows a stylized frond and a tighter tail; it is not a simulation of
seahorse locomotion or physiology. Right-facing view is a geometric mirror.

## Reproducibility and budgets

Pure integer-tick model at 60Hz, version1, same seed/options/events/ticks yields
same character grid. Browser drops stalls beyond100ms and advances at most6ticks
per frame. Grid capped160×100; backing canvas DPR capped2 and dimension4096.
Pause, hidden tab, offscreen and zero-size stop subscriptions. Reduced motion is
authoritative by default; initial and dynamic reduce display a static poster.
Explicit `reducedMotion:'ignore'` is an opt-in setting, not automatic override.

## Rights and acceptance

Independent geometric drawing, no copied online ASCII, asset, model, font or
reference-video code. No biological precision, browser FPS or battery claims.
Numerical and browser acceptance must be recorded separately. Original Pro source
unavailable; provenance is explicit rather than silently reconstructed.
