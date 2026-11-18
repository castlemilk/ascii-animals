# Live Cuttlefish / Gecko comparison

Inspection date: 2026-11-18. Regular Pro Chat cloud browser; no Work handoff. Read-only public interaction, with local screenshots and downloads. No source or GitHub changes during the comparison.

## Provenance

- Live Cuttlefish: https://castlemilk.github.io/ascii-animals/cuttlefish-demo.html — title “Cuttlefish — In the Current”.
- Live Gecko: https://castlemilk.github.io/ascii-animals/gecko/ — title “Gecko — A small act of courage”. The catalogue links `gecko/index.html`, so the directory URL is the real route.
- Separately inspected source checkout: `c06114404900884814bef879a02f1a49a3e7d590`, initially clean, at `/workspace/scratch/2b42caa0b4f6/gecko-director-work`.
- The live site did not expose a deployment SHA. This report does not assert that the deployed resources are byte-identical to the source checkout.
- 15 browser JPEG screenshots, one PNG produced by the baseline's UI, and one HTML produced by its UI were saved and verified readable. These are actual browser evidence, not mocks or native-Canvas-only renders.

## What was exercised in the live UI

| Area | Cuttlefish observed | Gecko observed |
| --- | --- | --- |
| Initial experience | Three scenes; four independent animals by default; prominent School director | One centered dorsal study; guide pad and Startle |
| Population | Changed the range to 12; UI showed 12 in school / 12 in view and 12 role controls | No population control in the deployed page |
| Formation | Selected Horizontal; role controls became disabled with a clear precedence explanation | No formation or route controls |
| Roles | Switched back to Mixed/Independent; assigned Hover to animal 01 and Orbit to animal 02; labels showed “Hovering in the current” and “Circling” | No cast or individual roles |
| Solo story | Selected solo Swim-by and Invite a visit; actual phases “Arriving in a hurry”, “Hanging in the current”, and later “Swimming out of view” were observed | Guidance changed the pose and produced Curious; no arrival/linger/depart scene journey |
| Close approach | Selected Close encounter; observed Turning toward you, Coming closer, Finding a hold, then Exploring the lens; close screenshot fills the canvas with the arm crown | No close-encounter scene or adjustable depth control |
| Surprise | Triggered Startle; observed Reacting / gathering arms, disabled action with recovery guidance, then Circling back | Triggered Startle; attached tail curl visible, then Finding courage and Taking a moment. Startle remained enabled throughout the observed response |
| Pointer | Follow your cursor toggle successfully enabled. Continuous hover agitation and individual hit ownership were not proven | Canvas tap changed state to Curious; guide-right produced a changed pose. Stage-local Space resumed playback, ArrowLeft was accepted with focus on canvas |
| Pause/reset | Controls present; no comprehensive lifecycle test in this pass | Paused, Reset, enabled Neutral silhouette, refreshed portrait; the page remained Paused with Play available |
| Export | PNG downloaded, verified 946×710; standalone HTML downloaded, verified 188,186 bytes with inline renderer and app scripts | Expanded and refreshed the selectable text portrait; no PNG/settings/standalone export controls |

## Visual findings

1. Cuttlefish has a clear spatial story. The default view distributes differently sized visitors through the stage; Close encounter changes scale and brings the subject against the lens. The bright character shading and glow distinguish surfaces and make that change legible.
2. The existing Gecko is identifiable: broad head, splayed pad feet, attached tapered tail. The startle screenshot contains a continuous curled tail. Its field-study typography and restrained colors are worth retaining.
3. The existing Gecko spends most of its time in the central portion of a large, largely empty wall. Guidance visibly changes orientation and gait, but the experience lacks a larger journey and an obvious reason for travel. Its flat dorsal framing has less visual depth than the Cuttlefish approach sequence.
4. The 12-animal Horizontal screenshot is densely overlapping. It demonstrates population/formation controls, not successful readability of every animal. A Gecko extension should keep each resident legible rather than copy the maximum count indiscriminately.
5. Current Gecko recovery feedback conflicts: the phase changes to A little startled / Finding courage / Taking a moment, while the stage help still says “Move gently to invite a few steps” and the Startle button remains enabled. Source confirms repeated busy input is ignored by the model, yet the demo always announces a surprise. This is a concrete repair target.
6. The plain-text portrait is useful, but its fixed-height scroll region shows only part of the text at once. It is selectable text, not a downloaded file in the deployed demo.

## Source-only corroboration

- `dist/gecko/runtime/species/gecko/demo.js` mounts the actual public facade through `../../public/gecko.js`; the current demo should keep that library route when rebuilt.
- Gecko core root travel is ±0.26 horizontally and ±0.13 vertically. The local preview's world is 3.4×2.6, so full root translation spans about 15.3% of world width and 10% of world height. This explains the restricted stage travel; it is a source-derived ratio, not a browser measurement.
- The preview describes itself as orthographic. It should not be described as a perspective renderer.
- Busy startle events are ignored in the deterministic model, but the deployed demo's click handler does not distinguish that result in its user message.
- Cuttlefish's ordered spray/jet response, per-animal hit testing, additional formations and tuning capabilities are present in source. Only the representative live actions above were exercised.
- Gecko's persisted `pagehide` handling preserves controller/listeners; nonpersisted navigation disposes. The comparison pass did not simulate bfcache or hidden/zero-size/disposal policies in the live browser.

## Evidence files

Most useful comparison pair:
- `cuttlefish-close-encounter.jpg` — 1348×1941, actual close encounter.
- `gecko-default.jpg` — 1348×1331, actual deployed solo page before its Guide test.

Representative actions:
- `cuttlefish-12-horizontal.jpg` — 1348×2412, role controls disabled under formation.
- `cuttlefish-independent-roles.jpg` — 1348×2203, assigned Hover and Orbit.
- `cuttlefish-solo-linger.jpg` and `cuttlefish-solo-observed.jpg` — actual solo observations.
- `cuttlefish-escape.jpg` and `cuttlefish-after-startle.jpg` — actual reaction / return observations; do not infer exact intermediate phase timing from filenames.
- `gecko-guide.jpg`, `gecko-startle.jpg`, `gecko-options-portrait.jpg`, `gecko-paused-neutral.jpg`, `gecko-keyboard.jpg`, `gecko-pointer.jpg`.
- `cuttlefish-default.jpg` — original default four-animal page.
- `cuttlefish-export.png` — actual UI-generated PNG, 946×710, 479,223 bytes.
- `cuttlefish-export.html` — actual UI-generated standalone file, 188,186 bytes. Download verified; offline execution unrun. This is an evidence artifact, not implementation source for Gecko.

## Unrun acceptance / limits

- No mobile viewport, physical touch device, screen-reader, live reduced-motion preference, or browser lifecycle matrix was tested.
- No FPS, frame time, heap, long-task, or throughput benchmark was run. The baseline displays an FPS label; that label is not a performance pass.
- No independent hover-motion/agitation or per-animal hit isolation test was completed.
- Only Horizontal and Independent formations were actively selected. Vertical, Diagonal, Random, reversal and all palette/render controls were seen but not exhaustively exercised.
- PNG download and format were verified; standalone HTML was not executed offline.
- The live page remained accessible throughout. Selector timing failures during phase sampling were observation failures, not evidence of a site outage.

The live Gecko tab was marked as the reviewable result, and the CUA session was completed normally.
