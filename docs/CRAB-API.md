# Crab API candidate

Newly authored, not recovered Pro-chat work. Private and unpublished.

```ts
import {createCrabArtwork,createCrabModel} from 'ascii-animals-review/crab';
const art=createCrabArtwork(canvas,{behavior:'scuttle'});
art.guide(-1,0); art.pulse(); // notice → defend → settle
art.pause(); art.pulse(); // static raised-claw poster, no playback
art.dispose();
```

Atomic typed options: columns80–180(default120), rows32–90(default50), seed integer0–2147483647(default7), speed.25–2(default1), scale.6–1.3(default1), sway0–.4(default.18), behavior scuttle/curious/guard, facing left/right, palette brass/lagoon/rose, paused boolean, reducedMotion system/ignore. Unknown options and nonfinite values reject before mutation.

Pure model advances bounded integer ticks0–600; ordered equal events/seed/ticks give equal logical cells, not guaranteed identical device pixels. Browser mount borrows the shared scheduler, caps six catch-up ticks, stops for pause/reduced-motion/visibility/zero-size, and cleans up observers/listeners on disposal. System reduced motion remains authoritative even Play. Browser methods: update/play/pause/restart/pulse/guide/resize/dispose/getOptions/getStatus/getFrame. Caller owns canvas and supplied frameSource.

Broad shell, paired open claws, eye stalks and eight separately jointed legs are original stylized geometry. No external imagery, tracking or runtime dependencies. Independent browser acceptance pending; no performance or WCAG certification claim.

Validation:86 aggregate tests pass (10 Crab-specific), strict TypeScript passes,
actual offline packed SSR/consumer/type checks pass. Author Chrome inspection
confirmed the recognisable shell/claws/legs and paused STILL / DEFEND state.
Independent responsive/reduced-motion/interaction QA remains pending.
