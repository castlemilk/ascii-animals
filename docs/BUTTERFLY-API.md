# Butterfly API candidate

Newly authored, not recovered Pro-chat work. Private and unpublished.

```ts
import {createButterflyArtwork,createButterflyModel} from 'ascii-animals-review/butterfly';
const art=createButterflyArtwork(canvas,{behavior:'hover'});
art.guide(-1,0); art.pulse(); // approach → display → settle
art.pause(); art.pulse(); // static patterned-wing display, no playback
art.dispose();
```

Atomic typed options: columns80–180(default120), rows32–90(default50), seed integer0–2147483647(default7), speed.25–2(default1), scale.6–1.3(default1), sway0–.4(default.18), behavior hover/curious/perch, facing left/right, palette brass/lagoon/rose, paused boolean, reducedMotion system/ignore. Unknown options and nonfinite values reject before mutation.

Pure model advances bounded integer ticks0–600; ordered equal events/seed/ticks give equal logical cells, not guaranteed identical device pixels. Browser mount borrows the shared scheduler, caps six catch-up ticks, stops for pause/reduced-motion/visibility/zero-size, and cleans up observers/listeners on disposal. System reduced motion remains authoritative even Play. Browser methods: update/play/pause/restart/pulse/guide/resize/dispose/getOptions/getStatus/getFrame. Caller owns canvas and supplied frameSource.

Four distinct wing lobes, patterned eyespots/veins, segmented body and clubbed antennae are original stylized geometry. No external imagery, tracking or runtime dependencies. Independent browser acceptance pending; no performance or WCAG certification claim.


106 aggregate tests, strict TypeScript and actual packed-consumer/SSR/declaration
checks passed before the final antenna-spacing refinement; its10 focused tests
and strict build passed after. Author Chrome confirmed the four wing lobes,
patterned display and improved visible antennae. Independent browser QA pending.
