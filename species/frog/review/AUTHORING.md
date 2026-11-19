# Frog / wetland movement revision

## Scope and source

- Repository: `castlemilk/ascii-animals`; integration base: `b8f222dab868821f27bf2a64a98434f3483fc8e6`, verified against remote main on 19 November 2026.
- Own only `species/frog/`. Preserve the public typed facade, core scheduler, other species, shared generated entry points and workflows. Deliver an independent patch and working branch/PR; central integration owns merging and deployment.
- Canonical implementation: frog-local `src/*.mts`. Existing single-frog and optional pond APIs remain supported. No new package options, public state fields or event types are required.
- Sources read: reactive ASCII Animals skill and its authoring, portable-contract, accessibility and validation guidance; actual source, typed API map, frog API and shipped director.

## Animal and visual brief (before implementation)

Stylized pond frog, with green-and-golden bell frog colour cues. This is original procedural geometry, not a scientifically exact reconstruction of one species. The firefly encounter and water splash are authored scene fiction.

Three recognition anchors: low broad head with raised horizontal-pupil eyes; substantial folded thighs beside the flank; slim connected forelegs ending at a stable support plane. Front and both three-quarter views are primary; profile remains a diagnostic view. Three visible digits per foot remain a small-grid simplification.

Wetness comes from coherent highlights on brow, cheek and knee, restrained gold-green skin planes and a pale jaw. Avoid a uniformly bright spherical body. Thighs and forearms retain negative space; crouch lowers shoulders and hips without translating the feet. The pond has a distant reed margin, quiet water/leaf plane, and a short foreground bank, with shadows and reflected light kept below the animal's contrast.

Minimum verification: 390 × 520 native-canvas phone composition and 1200 × 700 desktop composition; 72 × 40 single-frog grid remains a recognition stress test. System monospace font stack is unchanged; no font binary or reference image is redistributed.

## Directed sequences

| Phase | Root and limb direction | Effect and transition |
| --- | --- | --- |
| Hop preparation | Latched landing target; pronounced body compression with all four contact points planted | Existing configured crouch ticks; busy inputs never restart the phase |
| Launch and flight | Unfold muscular hindlegs early, then gather for landing along the existing ballistic arc | Keep fixed 60 Hz body clock and current landing ownership/reservations |
| Contact | Body compresses at the destination, then restores the crouch | Splash crown/droplets begin only on touchdown, followed by expanding, fading rings |
| Stalk | Gaze leads a supported, subtle lowering; safe approach hop when required | Existing track state and reachable pad contract |
| Feeding preparation | Wait for the approach landing to finish before striking | No airborne tongue catch |
| Tongue | Root remains at the transformed mouth; rapid projection, brief contact, visible prey return | 30-tick authored readable strike; biological capture is much faster |
| Feeding recovery | Tongue vanishes into mouth, head/body ease back to rest | Existing bounded settle state; no per-frame random variation |

Pointer/touch: preserve owner-cell frog selection, free-pad hop, open-water ripple, scrolling drag cancellation, and semantic action buttons. Keyboard: existing 1–3, arrows, Enter/Space, C/H/R/Escape route through the same controller. Static Hunt gives a deliberate tongue-contact study without starting time; static leap and call remain available. Motion preference, pause, hidden/offscreen/zero-size and disposal remain authoritative.

## Reproducibility and limits

- Same engine/version, seed, tick sequence and normalized input log must produce identical immutable state and logical cells, including 1/2/5-tick presentation grouping. Cross-engine/font pixels are not promised.
- Preserve 17,918 original geometry samples per frog, at most three frogs, 32,000 workspace samples, 6,246 environment samples, 60,000 total samples, 180 × 100 cells and 2400 × 1400 backing pixels.
- No new timers, RAF subscriptions, observers, listeners, public event queues, or external assets. Effects derive only from bounded state and explicit tick age.
- Validate real native Canvas content after redraw/resize, not just buffer length. Keep offscreen scene-label updates and deferred resize protections.
- Real browser acceptance is a separate gate: local Chromium startup is currently blocked by socket permissions; cloud browser cannot reach the local review URL. No browser/device performance or touch-hardware claim is inferred from native renders or mocked lifecycle checks.

## Reference and rights ledger

| Source | Observation used | Rights / incorporated material |
| --- | --- | --- |
| [Australian Museum: Green and Golden Bell Frog](https://australian.museum/learn/animals/frogs/green-and-golden-bell-frog/) | Green/gold back, pale belly, gold iris and horizontal pupil | Reference facts only; no photograph, drawing or text copied into artwork |
| [Li et al. 2021, jumping coordination](https://onlinelibrary.wiley.com/doi/full/10.1002/ece3.7589) | Preparation, hindlimb extension, aerial reposition, landing/recovery; species differences | Motion reference only; our timing and splash are stylized |
| [Noel et al. 2017, tongue capture](https://cbid.gatech.edu/wp-content/uploads/2018/05/Hu17-frog.pdf) | Soft tongue projection and prey adhesion during retraction | Motion reference only; readable slowed action is explicitly authored |

Full command results, source hashes, matched state logs, review findings and remaining acceptance are recorded in the final review manifest/evidence, not presumed by this pre-code brief.
