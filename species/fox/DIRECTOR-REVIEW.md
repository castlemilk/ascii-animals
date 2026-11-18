# Fox meadow director: implementation and bounded review

## Outcome and ownership

This change replaces the Fox demo's single centered specimen with a composed dusk meadow and an optional, typed 1–3-fox director. Existing consumers that omit `director` keep the original single-animal model, API vocabulary and timing. New director helpers are confined to the existing `ascii-animals-review/fox` subpath. This is an unmerged source change; the current Pages release is not changed by a branch or draft PR.

Initial inspection/base: `c06114404900884814bef879a02f1a49a3e7d590`. Final branch base: `c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`, whose only intervening change is the central README reconciliation in PR #21. That change was read and retained by rebasing this new `feat/director-fox` branch. No original Fox branch was replayed. No other author's branch was changed.

Only Fox canonical source, its demo/generated modules, Fox-specific public wrapper/declaration bridges, tests and documentation change. Shared package metadata, root exports, renderer, scheduler, registry, catalogue, central README and all other species remain untouched. No shared seam is proposed or required for this implementation: the integrated Fox geometry/rasterizer and shared browser scheduling seam already suffice.

## What was learned from Cuttlefish

The current [Cuttlefish demo](../../dist/cuttlefish-demo.html) and [canonical source](../../src/animals/cuttlefish.js) were inspected, along with the actual live page. The original has a coherent hierarchy: authored scenes, school presets, count, formations, individual roles and fine tuning, with a scene phase visible beside the artwork. Its source gives different paths/arrival/linger/depart behavior to a bounded population. Fixed-camera depth, individual timing, pointer interest/disturbance and staged reaction make the composition readable over time. The live diagonal preset and formation-dependent disabling of individual roles were observed. A targeted click was attempted, but an ink episode was not reliably captured; the ink choreography comparison is source-based. The page's FPS label was not treated as performance evidence.

| Expressive/compositional gap | Fox implementation | Intentional boundary |
| --- | --- | --- |
| Cuttlefish has several scene/preset compositions; old Fox had one centered animal | Three scene cards: Dusk hunt, Moonlit mischief, Den watch; foreground/companion/far lanes, grass and moon | Side-profile foxes remain on a static camera; no copied marine formation engine |
| Cuttlefish offers a 1–12 school with individual roles | Stable named cast of Ember/Pip/Bracken, count 1–3, per-ID hunter/playmate/lookout/dreamer motives | Three is the readable Fox ensemble bound, not an assertion that 12 would perform well |
| Paths and scene arcs create anticipation and recovery | Arrival/listening/investigation/response/settling clock; seeded episodes; local attention → stalk/sniff → captured pounce → recovery; play bows and delayed answering hops | Fixed lane composition and modest curved paths, not a generic path editor |
| Pointer influence is contextual | Hover attends through selected fox; holding a guide invites approach; a localized rustle selects painted/nearest-presented ownership and starts a multi-stage investigation; other foxes notice | Contextual Fox curiosity/play/rest instead of ink or copied fleeing-school behavior |
| Fine tuning has visible consequences | Tempo, count, curiosity, wind, spacing, names and per-fox motive; separate existing anatomy/pounce configuration remains available | No marine size/reverse/particle mode is implied by Fox options |
| Director status is understandable | Beat track, selected cast rail, contextual action wording, explicit pause/replay and deliberate listen/crouch/rest stills | Canvas labels are supplemented by readable DOM names/roles |
| Original has recording/export tools | Real current-frame ASCII and Canvas PNG export; typed consumed-input callback; exact seven-event native replay fixture | No video recorder UI or arbitrary state restore. Application code must also record immediate configuration/selection/reset edits |

## Authored behavior

**Dusk hunt** places a hunter near a listening lookout and an optional playful companion. A rustle first arrests attention, then guides cautious stalking/sniffing, followed by the existing crouch, short arcing leap, forepaw landing, recovery and cooldown. A responding fox ignores repeated invitations. The companions notice rather than all leaping at once.

**Moonlit mischief** changes automatic motives to playmates with a sentinel. Seeded bows, raised tails, curved guidance and staggered hops create social timing. A deliberate play invitation schedules one bounded delayed answer for each eligible companion; no growing action queue exists.

**Den watch** folds dreamers into rest while a sentinel keeps attending. Resting actors hold their scene anchors. Independent breathing, head/ear attention and tail expressions remain local; they do not require continual translation of a sleeping animal.

The director's authored cycle is 1,800 scene ticks. Tempo changes scene progress only; every model still consumes explicit next-integer 60 Hz ticks. New discriminated intent/action/scene/result types leave the closed original `FoxBehavior`/`FoxStaticPose` unions unchanged. All defaults, allowed ranges, immediate versus sequenced edits, reset semantics and replay limits are in [the API guide](../../docs/FOX-API.md).

## Review findings and corrections

Independent model/API review, browser-controller review and native capture review were followed by bounded corrections. Review here means code/test/actual-frame review in this task, not a GitHub approval or human acceptance.

| Evidence | Finding | Correction and verification |
| --- | --- | --- |
| First actual desktop and 390-pixel portrait captures | Bracken stood above the horizon, reading as a floating specimen | Raised the horizon behind the cast, redistributed grass into the far lane and added at most nine fixed ground glyphs. Preserved original captures; rerendered identical scene/seed/tick for the before/after comparison |
| Rest-path source review and deterministic run | Tucked dreamers still translated with the scene sine path | Hold scene x/y while resting; regression checks fixed anchors across 180 continuing ticks |
| Presented-layout review and pointer tests | Portrait empty-space taps and gaze used landscape coordinates | Store actual fitted actor transforms with the owner grid, inverse-project cell coordinates, and route visible owner or nearest presented center. Tests cover desktop/portrait, empty space, selected hover, letterboxing and DPR1/3 |
| Independent model tests | Sparse roles and invalid nested `fox` values could evade validation | Validate complete roles/plain objects before normalization; atomic rejection tests |
| Independent reset/configuration tests | Reset lost a configured left profile; unrelated tuning overwrote individual facing | Recreate actors from configured facing and apply only the requested animal patch; deterministic reset/config regression tests |
| Browser constructor review | Nested director `seed`/`fox` were accepted despite the narrower browser type | Validate the browser director options before adding separately supplied animal creation settings |
| Reentrant callback execution | Reset inside an input callback let the retired catch-up frame advance the fresh scene | Check scheduler generation after each step; both legacy and director callback-reset regressions |
| Demo/native pose review | Paused Play announced listening although it displayed a crouch; pounce still wording suggested airborne motion | Read the actual tableau for announcements; label the still “Before the leap” / “Crouch, held still”; executable demo test |
| Recorded state versus first sample | Tick 290 showed only two ticks of flight, underrepresenting the arc | Use actual apex tick306 and landing tick328 in the replay contact sheet; manifest records the states |

The final native scene and replay sheets were viewed. Foxes remain separated in both arrangements. Long muzzles, pointed ears and pale tail tips read at the inspected sizes, while the rest silhouette is visibly tucked. The apex/landing frames show lift away from and return toward fixed ground marks. At three-fox portrait density, individual legs, ear movement and Canvas labels are small. Hunt/play differ more clearly over their action sequences than in an isolated still. This is a bounded improvement, not a claim of parity with every Cuttlefish capability or final owner creative acceptance.

## Evidence and remaining gates

Actual native Skia Canvas output, not a mock drawing: [scene contact sheet](evidence/director/native-scenes-contact.png), [ordered replay](evidence/director/native-replay-contact.png), [before/after](evidence/director/native-grounding-before-after.png), [portrait](evidence/director/native-portrait-112x64.png) and [16.08-second GIF](evidence/director/native-director-replay.gif). The GIF contains 193 real rendered frames at nominal 12 fps; encoding cadence is not measured throughput. Its finite excerpt restarts and is not advertised as a seamless loop. No image-generation tool produced or edited the evidence.

[Capture provenance](evidence/director/native-render.json) records compiled runtime hashes, exact configuration/events, per-frame state/grid hashes, installed font and tool versions. No font binaries or outside artwork were copied. [Evidence instructions](evidence/director/README.md) distinguish the preserved before images from corrected output. [Validation](DIRECTOR-VALIDATION.md) lists executed commands and test scopes.

The cloud browser could inspect both live baselines, but returned `ERR_CONNECTION_REFUSED` for the workspace loopback preview. Therefore new-demo browser/font/normal-speed playback acceptance remains **unrun**. Real mobile touch, 200% zoom/focus order, screen-reader announcements, preference/visibility/resize behavior in real browsers and measured device p95/p99 timing remain open. Mock tests exercise those policy branches but are not browser evidence. New live deployment and GitHub review/CI are coordinator gates; no deployment or release was attempted.
